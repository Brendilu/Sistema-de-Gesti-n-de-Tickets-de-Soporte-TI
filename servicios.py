"""Lógica de negocio compartida entre módulos (tickets, historial, SLA, notificaciones)."""
import os
import pymysql
import sqlite3

from config import ROL_ADMIN, ROL_TECNICO, UMBRAL_POR_VENCER, UPLOAD_FOLDER

TITULOS_POR_TIPO = {
    "creado": "Nuevo ticket creado",
    "asignado": "Ticket asignado",
    "estado": "Cambio de estado",
    "sla": "SLA por vencer",
}


class ErrorNegocio(Exception):
    """Error de validación que se muestra al usuario (HTTP 400/404/409)."""

    def __init__(self, mensaje, status=400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


# ------------------------------------------------------------- permisos ----
def puede_gestionar(u, t):
    """Admin gestiona todo. Un técnico solo gestiona tickets suyos o aún sin asignar:
    el ticket de otro técnico lo gestiona únicamente el administrador."""
    if u["rol_id"] == ROL_ADMIN:
        return True
    if u["rol_id"] == ROL_TECNICO:
        return t["tecnico_id"] in (None, u["id"])
    return False


# ------------------------------------------------------------------ SLA ----
def calcular_semaforo(segundos, sla_horas, es_final):
    """Devuelve (semaforo, porcentaje). semaforo: cerrado | vencido | por-vencer | en-plazo."""
    limite = sla_horas * 3600
    porcentaje = min(segundos / limite * 100, 100) if limite else 100
    if es_final:
        return "cerrado", porcentaje
    if segundos >= limite:
        return "vencido", 100.0
    if segundos / limite >= UMBRAL_POR_VENCER:
        return "por-vencer", porcentaje
    return "en-plazo", porcentaje


SELECT_TICKETS = """
SELECT t.id, t.codigo, t.titulo, t.descripcion,
       t.prioridad_id, p.nombre AS prioridad, p.sla_horas,
       t.estado_id, e.nombre AS estado, e.es_final,
       t.solicitante_id, emp.nombre_completo AS solicitante, emp.cargo AS cargo, ar.nombre AS area,
       t.tecnico_id, u.nombre AS tecnico,
       t.empresa_id, t.creado_en, t.actualizado_en, t.cerrado_en,
       CAST((julianday(COALESCE(t.cerrado_en, datetime('now'))) - julianday(t.creado_en)) * 86400 AS INTEGER) AS segundos,
       (SELECT COUNT(*) FROM ticket_adjuntos a WHERE a.ticket_id = t.id) AS num_adjuntos
  FROM tickets t
  JOIN prioridades p   ON p.id = t.prioridad_id
  JOIN estados e       ON e.id = t.estado_id
  LEFT JOIN empleados emp ON emp.id = t.solicitante_id
  LEFT JOIN areas ar      ON ar.id = emp.area_id
  LEFT JOIN usuarios u    ON u.id = t.tecnico_id
"""


def enriquecer(fila):
    fila["es_final"] = bool(fila["es_final"])
    fila["semaforo"], fila["porcentaje"] = calcular_semaforo(
        fila["segundos"], fila["sla_horas"], fila["es_final"])
    return fila


def listar_tickets(cur, empresa_id, empleado_id=None, ticket_id=None):
    """Tickets de UNA empresa (el filtro por empresa es obligatorio y siempre va primero)."""
    sql, params = SELECT_TICKETS, [empresa_id]
    cond = ["t.empresa_id = %s"]
    if empleado_id is not None:
        cond.append("t.solicitante_id = %s"); params.append(empleado_id)
    if ticket_id is not None:
        cond.append("t.id = %s"); params.append(ticket_id)
    if cond:
        sql += " WHERE " + " AND ".join(cond)
    sql += " ORDER BY t.id DESC"
    cur.execute(sql, params)
    return [enriquecer(f) for f in cur.fetchall()]


# -------------------------------------------------------- notificaciones ----
def notificar(cur, usuario_ids, ticket_id, tipo, mensaje, excluir=None):
    """INSERT en notificaciones para cada usuario (sin repetir y sin el autor)."""
    vistos = set()
    for uid in usuario_ids:
        if uid is None or uid == excluir or uid in vistos:
            continue
        vistos.add(uid)
        cur.execute(
            "INSERT INTO notificaciones (usuario_id, ticket_id, tipo, titulo, mensaje) "
            "VALUES (%s,%s,%s,%s,%s)",
            (uid, ticket_id, tipo, TITULOS_POR_TIPO[tipo], mensaje[:255]))


def ids_administradores(cur, empresa_id):
    cur.execute("SELECT id FROM usuarios WHERE rol_id=%s AND activo=TRUE AND empresa_id=%s",
                (ROL_ADMIN, empresa_id))
    return [f["id"] for f in cur.fetchall()]


def usuarios_de_empleado(cur, empleado_id, empresa_id):
    if empleado_id is None:
        return []
    cur.execute("SELECT id FROM usuarios WHERE empleado_id=%s AND activo=TRUE AND empresa_id=%s",
                (empleado_id, empresa_id))
    return [f["id"] for f in cur.fetchall()]


def generar_alertas_sla(cur, empresa_id):
    """Crea (una sola vez por ticket) la notificación 'sla' de los tickets de ESTA empresa que ya
    consumieron el 80 % de su plazo. Va al técnico asignado o, si no hay, a los administradores."""
    cur.execute(
        SELECT_TICKETS + """
        WHERE t.empresa_id = %s AND e.es_final = FALSE
          AND (julianday('now') - julianday(t.creado_en)) * 86400 >= p.sla_horas * 3600 * %s
          AND NOT EXISTS (SELECT 1 FROM notificaciones n WHERE n.ticket_id = t.id AND n.tipo = 'sla')
        """, (empresa_id, UMBRAL_POR_VENCER))
    for t in [enriquecer(f) for f in cur.fetchall()]:
        if t["semaforo"] == "vencido":
            msg = f"El ticket {t['codigo']} superó su límite de {t['sla_horas']} h."
        else:
            msg = f"El ticket {t['codigo']} está por vencer su límite de {t['sla_horas']} h."
        destinos = [t["tecnico_id"]] if t["tecnico_id"] else ids_administradores(cur, empresa_id)
        notificar(cur, destinos, t["id"], "sla", msg)


# ----------------------------------------------------------------- tickets ----
def siguiente_codigo(cur, empresa_id):
    """Cada empresa lleva su propia numeración (TCK-0001, ...)."""
    cur.execute("SELECT COALESCE(MAX(CAST(SUBSTR(codigo, 5) AS INTEGER)), 0) + 1 AS n "
                "FROM tickets WHERE empresa_id=%s", (empresa_id,))
    return f"TCK-{int(cur.fetchone()['n']):04d}"


def _validar_catalogos(cur, empresa_id, prioridad_id, estado_id, solicitante_id, tecnico_id):
    cur.execute("SELECT 1 FROM prioridades WHERE id=%s", (prioridad_id,))
    if not cur.fetchone():
        raise ErrorNegocio("Prioridad no válida.")
    cur.execute("SELECT 1 FROM estados WHERE id=%s", (estado_id,))
    if not cur.fetchone():
        raise ErrorNegocio("Estado no válido.")
    if solicitante_id is not None:
        cur.execute("SELECT 1 FROM empleados WHERE id=%s AND empresa_id=%s", (solicitante_id, empresa_id))
        if not cur.fetchone():
            raise ErrorNegocio("El solicitante no existe en empleados.")
    if tecnico_id is not None:
        cur.execute("SELECT 1 FROM usuarios WHERE id=%s AND empresa_id=%s AND activo=TRUE AND rol_id IN (1,2)",
                    (tecnico_id, empresa_id))
        if not cur.fetchone():
            raise ErrorNegocio("El técnico indicado no existe, está inactivo o no tiene rol Técnico/Administrador.")


def crear_ticket(cur, *, empresa_id, titulo, descripcion, prioridad_id, estado_id, solicitante_id,
                 tecnico_id, usuario_id):
    """INSERT en tickets + primera fila de ticket_historial + notificaciones. Devuelve (id, codigo)."""
    if len(titulo) < 5 or len(titulo) > 150:
        raise ErrorNegocio("El título debe tener entre 5 y 150 caracteres.")
    if not descripcion:
        raise ErrorNegocio("La descripción es obligatoria.")
    _validar_catalogos(cur, empresa_id, prioridad_id, estado_id, solicitante_id, tecnico_id)

    for _ in range(5):  # reintenta si dos personas obtienen el mismo código a la vez
        codigo = siguiente_codigo(cur, empresa_id)
        try:
            cur.execute(
                "INSERT INTO tickets (empresa_id, codigo, titulo, descripcion, prioridad_id, estado_id, "
                "solicitante_id, tecnico_id, cerrado_en) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s, "
                "CASE WHEN (SELECT es_final FROM estados WHERE id=%s) THEN datetime('now') ELSE NULL END)",
                (empresa_id, codigo, titulo, descripcion, prioridad_id, estado_id, solicitante_id, tecnico_id, estado_id))
            break
        except (pymysql.err.IntegrityError, sqlite3.IntegrityError) as e:
            if isinstance(e, pymysql.err.IntegrityError):
                duplicado = e.args[0] == 1062
            else:
                duplicado = "UNIQUE" in str(e).upper()
            if not duplicado:
                raise
    else:
        raise ErrorNegocio("No se pudo generar un código de ticket único. Intenta de nuevo.", 409)
    ticket_id = cur.lastrowid

    cur.execute(
        "INSERT INTO ticket_historial (ticket_id, estado_anterior_id, estado_nuevo_id, usuario_id, comentario) "
        "VALUES (%s, NULL, %s, %s, 'Ticket registrado.')", (ticket_id, estado_id, usuario_id))

    notificar(cur, ids_administradores(cur, empresa_id), ticket_id, "creado",
              f"Se creó el ticket {codigo}: {titulo}"[:255], excluir=usuario_id)
    if tecnico_id:
        notificar(cur, [tecnico_id], ticket_id, "asignado",
                  f"El ticket {codigo} fue asignado a ti.", excluir=usuario_id)
    return ticket_id, codigo


def actualizar_ticket(cur, empresa_id, ticket_id, cambios, usuario_id, comentario=None, exigir_comentario=False):
    """UPDATE de un ticket. `cambios` puede traer: titulo, descripcion, prioridad_id,
    estado_id, solicitante_id, tecnico_id. Si cambia el estado o el técnico (o se escribe
    un comentario) se registra una fila en ticket_historial, todo en la misma transacción."""
    # SQLite no admite "FOR UPDATE"; la transacción ya bloquea la escritura.
    cur.execute("SELECT * FROM tickets WHERE id=%s AND empresa_id=%s", (ticket_id, empresa_id))
    actual = cur.fetchone()
    if not actual:
        raise ErrorNegocio("El ticket no existe.", 404)

    nuevo = dict(actual)
    nuevo.update({k: v for k, v in cambios.items() if k in actual})
    if len(nuevo["titulo"]) < 5 or len(nuevo["titulo"]) > 150:
        raise ErrorNegocio("El título debe tener entre 5 y 150 caracteres.")
    if not nuevo["descripcion"]:
        raise ErrorNegocio("La descripción es obligatoria.")
    _validar_catalogos(cur, empresa_id, nuevo["prioridad_id"], nuevo["estado_id"],
                       nuevo["solicitante_id"], nuevo["tecnico_id"])

    cambio_estado = nuevo["estado_id"] != actual["estado_id"]
    cambio_tecnico = nuevo["tecnico_id"] != actual["tecnico_id"]
    comentario = (comentario or "").strip()
    if exigir_comentario and not comentario:
        raise ErrorNegocio("El comentario es obligatorio para registrar un cambio.")

    cur.execute("SELECT es_final FROM estados WHERE id=%s", (nuevo["estado_id"],))
    es_final = bool(cur.fetchone()["es_final"])
    if es_final:
        cerrado_en_sql = "COALESCE(cerrado_en, datetime('now'))"
    else:
        cerrado_en_sql = "NULL"

    cur.execute(
        f"UPDATE tickets SET titulo=%s, descripcion=%s, prioridad_id=%s, estado_id=%s, "
        f"solicitante_id=%s, tecnico_id=%s, cerrado_en={cerrado_en_sql} WHERE id=%s",
        (nuevo["titulo"], nuevo["descripcion"], nuevo["prioridad_id"], nuevo["estado_id"],
         nuevo["solicitante_id"], nuevo["tecnico_id"], ticket_id))

    if cambio_estado or cambio_tecnico or comentario:
        prefijo = ""
        if cambio_tecnico:
            if nuevo["tecnico_id"]:
                cur.execute("SELECT nombre FROM usuarios WHERE id=%s AND empresa_id=%s", (nuevo["tecnico_id"], empresa_id))
                prefijo = f"Asignado a {cur.fetchone()['nombre']}. "
            else:
                prefijo = "Técnico desasignado. "
        texto = (prefijo + comentario).strip() or "Ticket actualizado desde el panel de administración."
        cur.execute(
            "INSERT INTO ticket_historial (ticket_id, estado_anterior_id, estado_nuevo_id, usuario_id, comentario) "
            "VALUES (%s,%s,%s,%s,%s)",
            (ticket_id, actual["estado_id"], nuevo["estado_id"], usuario_id, texto[:500]))

    codigo = actual["codigo"]
    if cambio_tecnico and nuevo["tecnico_id"]:
        notificar(cur, [nuevo["tecnico_id"]], ticket_id, "asignado",
                  f"El ticket {codigo} fue asignado a ti.", excluir=usuario_id)
    if cambio_estado:
        cur.execute("SELECT nombre FROM estados WHERE id=%s", (nuevo["estado_id"],))
        nombre_estado = cur.fetchone()["nombre"]
        destinos = [nuevo["tecnico_id"]] + usuarios_de_empleado(cur, nuevo["solicitante_id"], empresa_id)
        notificar(cur, destinos, ticket_id, "estado",
                  f'El ticket {codigo} pasó a "{nombre_estado}".', excluir=usuario_id)
    return nuevo


def eliminar_ticket(cur, empresa_id, ticket_id):
    """DELETE del ticket (adjuntos, historial y notificaciones caen por ON DELETE CASCADE).
    Devuelve las rutas de archivos para borrarlas del disco después del commit."""
    cur.execute("SELECT a.ruta FROM ticket_adjuntos a JOIN tickets t ON t.id = a.ticket_id "
                "WHERE a.ticket_id=%s AND t.empresa_id=%s", (ticket_id, empresa_id))
    rutas = [f["ruta"] for f in cur.fetchall()]
    cur.execute("DELETE FROM tickets WHERE id=%s AND empresa_id=%s", (ticket_id, empresa_id))
    if cur.rowcount == 0:
        raise ErrorNegocio("El ticket no existe.", 404)
    return rutas


def borrar_archivos(rutas):
    for r in rutas:
        try:
            os.remove(os.path.join(UPLOAD_FOLDER, r))
        except OSError:
            pass