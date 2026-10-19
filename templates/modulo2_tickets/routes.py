"""Módulo 2 · Registro de tickets + fotos (y panel de administración).
Aquí vive la API REST de tickets (listar, detalle, crear, editar, eliminar) que usan los demás módulos.
La gestión (asignar/cambiar estado) y el historial viven en el módulo 3."""
import os
import uuid

from flask import Blueprint, jsonify, render_template, request, send_from_directory

from auth import empresa_id_actual, login_requerido, rol_requerido, usuario_actual
from config import (MAX_ARCHIVO_MB, MAX_FOTOS_POR_TICKET, ROL_ADMIN, ROL_TECNICO,
                    ROL_USUARIO, UPLOAD_FOLDER)
from db import conexion
from servicios import (ErrorNegocio, actualizar_ticket, borrar_archivos, crear_ticket,
                       eliminar_ticket, generar_alertas_sla, listar_tickets, puede_gestionar)
from utiles import cuerpo, entero

bp = Blueprint("modulo2", __name__,
               static_folder="static", static_url_path="/modulo2/static")
PERSONAL = (ROL_ADMIN, ROL_TECNICO)


# ------------------------------------------------------------------ vistas ----
@bp.route("/modulo2")
@login_requerido
def registro():
    return render_template("modulo2_tickets/registro_tickets.html")


@bp.route("/modulo2/admin")
@rol_requerido(ROL_ADMIN)
def admin():
    return render_template("modulo2_tickets/admin_tickets.html")


# ----------------------------------------------------------------- helpers ----
def _tipo_imagen(cabecera):
    """Valida el tipo real por la firma del archivo (no por la extensión)."""
    if cabecera.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if cabecera.startswith(b"\x89PNG"):
        return "image/png", "png"
    if cabecera.startswith(b"GIF8"):
        return "image/gif", "gif"
    if cabecera[:4] == b"RIFF" and cabecera[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None, None


def _leer_fotos():
    fotos = []
    archivos = [f for f in request.files.getlist("fotos") if f and f.filename]
    if len(archivos) > MAX_FOTOS_POR_TICKET:
        raise ErrorNegocio(f"Máximo {MAX_FOTOS_POR_TICKET} fotos por ticket.")
    for f in archivos:
        datos = f.read()
        if len(datos) > MAX_ARCHIVO_MB * 1024 * 1024:
            raise ErrorNegocio(f'"{f.filename}" supera {MAX_ARCHIVO_MB} MB.')
        mime, ext = _tipo_imagen(datos[:12])
        if not mime:
            raise ErrorNegocio(f'"{f.filename}" no es una imagen válida (JPEG, PNG, GIF, WEBP).')
        fotos.append({"nombre": os.path.basename(f.filename)[:255], "datos": datos, "mime": mime, "ext": ext})
    return fotos


def _puede_ver(cur, ticket_id):
    """Devuelve el ticket si el usuario actual puede verlo; si no, lanza ErrorNegocio."""
    u = usuario_actual()
    filtro = u["empleado_id"] if u["rol_id"] == ROL_USUARIO else None
    if u["rol_id"] == ROL_USUARIO and filtro is None:
        raise ErrorNegocio("Ticket no encontrado.", 404)
    filas = listar_tickets(cur, u["empresa_id"], empleado_id=filtro, ticket_id=ticket_id)
    if not filas:
        raise ErrorNegocio("Ticket no encontrado.", 404)
    return filas[0]


# --------------------------------------------------------------------- API ----
@bp.get("/api/tickets")
@login_requerido
def api_listar():
    u = usuario_actual()
    with conexion() as cur:
        generar_alertas_sla(cur, u["empresa_id"])
        if u["rol_id"] == ROL_USUARIO:
            filas = (listar_tickets(cur, u["empresa_id"], empleado_id=u["empleado_id"])
                     if u["empleado_id"] else [])
        else:
            filas = listar_tickets(cur, u["empresa_id"])
        if request.args.get("fotos") and filas:  # rutas de las fotos para las miniaturas
            ids = [f["id"] for f in filas]
            cur.execute("SELECT ticket_id, ruta FROM ticket_adjuntos WHERE ticket_id IN (%s) ORDER BY id"
                        % ",".join(["%s"] * len(ids)), ids)
            por_ticket = {}
            for a in cur.fetchall():
                por_ticket.setdefault(a["ticket_id"], []).append("/uploads/" + a["ruta"])
            for f in filas:
                f["fotos"] = por_ticket.get(f["id"], [])
    return jsonify(filas)


@bp.get("/api/tickets/<int:tid>")
@login_requerido
def api_detalle(tid):
    yo = usuario_actual()
    with conexion() as cur:
        t = _puede_ver(cur, tid)
        t["puede_gestionar"] = puede_gestionar(yo, t)
        # Historial según el rol: el administrador ve todo, cada técnico solo sus propias
        # acciones y el usuario común no ve el historial.
        t["historial_alcance"] = {ROL_ADMIN: "todo", ROL_TECNICO: "propio"}.get(yo["rol_id"], "ninguno")
        if t["historial_alcance"] == "ninguno":
            t["historial"] = []
        else:
            sql = ("SELECT h.id, h.estado_anterior_id, ea.nombre AS estado_anterior, h.estado_nuevo_id, "
                   "en.nombre AS estado_nuevo, h.usuario_id, COALESCE(u.nombre, 'Sistema') AS usuario, "
                   "r.nombre AS rol, e.cargo, a.nombre AS area, h.comentario, h.fecha "
                   "FROM ticket_historial h "
                   "LEFT JOIN estados ea ON ea.id = h.estado_anterior_id "
                   "JOIN estados en ON en.id = h.estado_nuevo_id "
                   "LEFT JOIN usuarios u ON u.id = h.usuario_id "
                   "LEFT JOIN roles r ON r.id = u.rol_id "
                   "LEFT JOIN empleados e ON e.id = u.empleado_id "
                   "LEFT JOIN areas a ON a.id = e.area_id "
                   "WHERE h.ticket_id=%s")
            params = [tid]
            if t["historial_alcance"] == "propio":
                sql += " AND h.usuario_id=%s"
                params.append(yo["id"])
            cur.execute(sql + " ORDER BY h.fecha, h.id", params)
            t["historial"] = cur.fetchall()
        cur.execute("SELECT id, nombre_archivo, ruta, mime, tamano_bytes, subido_en "
                    "FROM ticket_adjuntos WHERE ticket_id=%s ORDER BY id", (tid,))
        t["adjuntos"] = cur.fetchall()
    for a in t["adjuntos"]:
        a["url"] = "/uploads/" + a["ruta"]
    return jsonify(t)


@bp.post("/api/tickets")
@login_requerido
def api_crear():
    u = usuario_actual()
    d = cuerpo()
    fotos = _leer_fotos()
    es_personal = u["rol_id"] in PERSONAL

    if es_personal:
        solicitante_id = entero(d.get("solicitante_id"), "solicitante", obligatorio=True)
        estado_id = entero(d.get("estado_id"), "estado") or 1
        tecnico_id = entero(d.get("tecnico_id"), "técnico")
    else:
        if not u["empleado_id"]:
            raise ErrorNegocio("Tu cuenta no está vinculada a un empleado. "
                               "Pide a un administrador que la vincule (Módulo 1).", 409)
        solicitante_id, estado_id, tecnico_id = u["empleado_id"], 1, None

    escritos = []
    try:
        with conexion() as cur:
            tid, codigo = crear_ticket(
                cur, empresa_id=u["empresa_id"],
                titulo=(d.get("titulo") or "").strip(),
                descripcion=(d.get("descripcion") or "").strip(),
                prioridad_id=entero(d.get("prioridad_id"), "prioridad") or 2,
                estado_id=estado_id, solicitante_id=solicitante_id,
                tecnico_id=tecnico_id, usuario_id=u["id"])
            if fotos:
                os.makedirs(os.path.join(UPLOAD_FOLDER, str(tid)), exist_ok=True)
            for f in fotos:
                ruta = f"{tid}/{uuid.uuid4().hex}.{f['ext']}"
                with open(os.path.join(UPLOAD_FOLDER, ruta), "wb") as fh:
                    fh.write(f["datos"])
                escritos.append(ruta)
                cur.execute(
                    "INSERT INTO ticket_adjuntos (ticket_id, nombre_archivo, ruta, mime, tamano_bytes) "
                    "VALUES (%s,%s,%s,%s,%s)", (tid, f["nombre"], ruta, f["mime"], len(f["datos"])))
    except Exception:
        borrar_archivos(escritos)
        raise
    return jsonify(ok=True, id=tid, codigo=codigo, fotos=len(fotos)), 201


@bp.put("/api/tickets/<int:tid>")
@rol_requerido(ROL_ADMIN)
def api_actualizar(tid):
    d = cuerpo()
    cambios = {}
    for campo in ("titulo", "descripcion"):
        if campo in d:
            cambios[campo] = (d[campo] or "").strip()
    for campo, etiqueta in (("prioridad_id", "prioridad"), ("estado_id", "estado"),
                            ("solicitante_id", "solicitante"), ("tecnico_id", "técnico")):
        if campo in d:
            cambios[campo] = entero(d[campo], etiqueta, obligatorio=campo in ("prioridad_id", "estado_id"))
    with conexion() as cur:
        actualizar_ticket(cur, empresa_id_actual(), tid, cambios, usuario_actual()["id"],
                          comentario=d.get("comentario"))
    return jsonify(ok=True)


@bp.put("/api/tickets/<int:tid>/mio")
@login_requerido
def api_editar_mio(tid):
    """El solicitante (cualquier empleado con cuenta) corrige su propio ticket mientras
    siga en Nuevo o Abierto, es decir, antes de que alguien empiece a atenderlo."""
    u = usuario_actual()
    d = cuerpo()
    with conexion() as cur:
        cur.execute("SELECT t.solicitante_id, e.orden FROM tickets t JOIN estados e ON e.id = t.estado_id "
                    "WHERE t.id=%s AND t.empresa_id=%s", (tid, u["empresa_id"]))
        t = cur.fetchone()
        if not t:
            raise ErrorNegocio("Ticket no encontrado.", 404)
        if not u["empleado_id"] or t["solicitante_id"] != u["empleado_id"]:
            raise ErrorNegocio("Solo puedes editar los tickets que tú enviaste.", 403)
        if t["orden"] > 2:
            raise ErrorNegocio("El ticket ya está en atención; ya no se puede editar.", 409)
        cambios = {"titulo": (d.get("titulo") or "").strip(),
                   "descripcion": (d.get("descripcion") or "").strip(),
                   "prioridad_id": entero(d.get("prioridad_id"), "prioridad", obligatorio=True)}
        actualizar_ticket(cur, u["empresa_id"], tid, cambios, u["id"],
                          comentario="El solicitante editó su ticket.")
    return jsonify(ok=True)


@bp.delete("/api/tickets/<int:tid>")
@rol_requerido(ROL_ADMIN)
def api_eliminar(tid):
    with conexion() as cur:
        rutas = eliminar_ticket(cur, empresa_id_actual(), tid)
    borrar_archivos(rutas)
    return jsonify(ok=True)


@bp.get("/uploads/<int:tid>/<path:nombre>")
@login_requerido
def archivo(tid, nombre):
    with conexion() as cur:
        _puede_ver(cur, tid)
    return send_from_directory(os.path.join(UPLOAD_FOLDER, str(tid)), nombre)
