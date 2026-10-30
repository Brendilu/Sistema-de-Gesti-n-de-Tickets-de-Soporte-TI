"""Módulo 3 · Asignación e historial de estados (tabla ticket_historial).

- Vistas: /modulo3 y /modulo3/<id>
- API:    POST /api/tickets/<id>/gestion  (asignar técnico + cambiar estado con comentario)
          GET  /api/historial             (historial de acciones filtrable)
Reglas: el administrador gestiona todo y ve el historial de todos; un técnico solo gestiona lo suyo
(o lo que no tiene dueño) y solo ve sus propias acciones.
"""
from flask import Blueprint, jsonify, render_template, request

from auth import rol_requerido, usuario_actual
from config import ROL_ADMIN, ROL_TECNICO
from db import conexion
from servicios import ErrorNegocio, actualizar_ticket, puede_gestionar
from utiles import cuerpo, entero, fecha_iso

bp = Blueprint("modulo3", __name__,
               static_folder="static", static_url_path="/modulo3/static")


@bp.route("/modulo3")
@rol_requerido(ROL_ADMIN, ROL_TECNICO)
def inicio():
    return render_template("modulo3_historial/historial.html", ticket_id=0)


@bp.route("/modulo3/<int:tid>")
@rol_requerido(ROL_ADMIN, ROL_TECNICO)
def historial(tid):
    return render_template("modulo3_historial/historial.html", ticket_id=tid)


@bp.post("/api/tickets/<int:tid>/gestion")
@rol_requerido(ROL_ADMIN, ROL_TECNICO)
def api_gestion(tid):
    """Módulo 3: asignar técnico + cambiar estado con comentario obligatorio (transacción única)."""
    u = usuario_actual()
    d = cuerpo()
    cambios = {"estado_id": entero(d.get("estado_id"), "estado", obligatorio=True),
               "tecnico_id": entero(d.get("tecnico_id"), "técnico")}
    with conexion() as cur:
        cur.execute("SELECT tecnico_id FROM tickets WHERE id=%s AND empresa_id=%s",
                    (tid, u["empresa_id"]))
        t = cur.fetchone()
        if not t:
            raise ErrorNegocio("El ticket no existe.", 404)
        if not puede_gestionar(u, t):
            raise ErrorNegocio("Este ticket está asignado a otro técnico. "
                               "Solo el administrador puede gestionarlo.", 403)
        if u["rol_id"] == ROL_TECNICO:
            cambios["tecnico_id"] = u["id"]      # al gestionarlo queda a su nombre
        actualizar_ticket(cur, u["empresa_id"], tid, cambios, u["id"],
                          comentario=d.get("comentario"), exigir_comentario=True)
    return jsonify(ok=True)


@bp.get("/api/historial")
@rol_requerido(ROL_ADMIN, ROL_TECNICO)
def api_historial():
    """Historial de acciones. Administrador: de todos (puede filtrar por persona).
    Técnico: únicamente las acciones que hizo él mismo."""
    u = usuario_actual()
    a = request.args
    cond, params = ["t.empresa_id = %s"], [u["empresa_id"]]
    if u["rol_id"] == ROL_TECNICO:
        cond.append("h.usuario_id = %s"); params.append(u["id"])
    else:
        uid = entero(a.get("usuario_id"), "persona")
        if uid:
            cond.append("h.usuario_id = %s"); params.append(uid)
    q = (a.get("q") or "").strip()
    if q:
        cond.append("(t.codigo LIKE %s OR t.titulo LIKE %s OR h.comentario LIKE %s OR u.nombre LIKE %s)")
        params += [f"%{q}%"] * 4
    estado = entero(a.get("estado_id"), "estado")
    if estado:
        cond.append("h.estado_nuevo_id = %s"); params.append(estado)
    tid = entero(a.get("ticket_id"), "ticket")
    if tid:
        cond.append("h.ticket_id = %s"); params.append(tid)
    desde, hasta = fecha_iso(a.get("desde"), "desde"), fecha_iso(a.get("hasta"), "hasta")
    if desde:
        cond.append("DATE(h.fecha) >= %s"); params.append(desde)
    if hasta:
        cond.append("DATE(h.fecha) <= %s"); params.append(hasta)
    sql = ("SELECT h.id, h.ticket_id, t.codigo, t.titulo, ea.nombre AS estado_anterior, en.nombre AS estado_nuevo, "
           "h.usuario_id, COALESCE(u.nombre, 'Sistema') AS usuario, r.nombre AS rol, e.cargo, ar.nombre AS area, "
           "h.comentario, h.fecha "
           "FROM ticket_historial h "
           "JOIN tickets t ON t.id = h.ticket_id "
           "LEFT JOIN estados ea ON ea.id = h.estado_anterior_id "
           "JOIN estados en ON en.id = h.estado_nuevo_id "
           "LEFT JOIN usuarios u ON u.id = h.usuario_id "
           "LEFT JOIN roles r ON r.id = u.rol_id "
           "LEFT JOIN empleados e ON e.id = u.empleado_id "
           "LEFT JOIN areas ar ON ar.id = e.area_id")
    if cond:
        sql += " WHERE " + " AND ".join(cond)
    sql += " ORDER BY h.fecha DESC, h.id DESC LIMIT 300"
    with conexion() as cur:
        cur.execute(sql, params)
        return jsonify(cur.fetchall())
