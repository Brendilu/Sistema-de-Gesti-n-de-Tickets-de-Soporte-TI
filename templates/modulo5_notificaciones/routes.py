"""Módulo 5 · Notificaciones internas (tabla notificaciones)."""
from flask import Blueprint, jsonify, render_template, request

from auth import login_requerido, usuario_actual
from db import conexion
from servicios import TITULOS_POR_TIPO, ErrorNegocio, generar_alertas_sla

bp = Blueprint("modulo5", __name__,
               static_folder="static", static_url_path="/modulo5/static")


@bp.route("/modulo5")
@login_requerido
def notificaciones():
    return render_template("modulo5_notificaciones/notificaciones.html")


@bp.get("/api/notificaciones")
@login_requerido
def api_listar():
    u = usuario_actual()
    uid = u["id"]
    with conexion() as cur:
        generar_alertas_sla(cur, u["empresa_id"])
        cur.execute(
            "SELECT n.id, n.ticket_id, n.tipo, n.titulo, n.mensaje, n.leida, n.creada_en, "
            "TIMESTAMPDIFF(SECOND, n.creada_en, NOW()) AS hace_segundos, t.codigo AS ticket "
            "FROM notificaciones n LEFT JOIN tickets t ON t.id = n.ticket_id "
            "WHERE n.usuario_id=%s ORDER BY n.creada_en DESC, n.id DESC LIMIT 200", (uid,))
        filas = cur.fetchall()
    for f in filas:
        f["leida"] = bool(f["leida"])
    return jsonify(filas)


@bp.get("/api/notificaciones/contador")
@login_requerido
def api_contador():
    u = usuario_actual()
    uid = u["id"]
    with conexion() as cur:
        generar_alertas_sla(cur, u["empresa_id"])
        cur.execute("SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id=%s AND leida=FALSE", (uid,))
        return jsonify(sin_leer=cur.fetchone()["n"])


@bp.post("/api/notificaciones")
@login_requerido
def api_crear():
    """Generación manual (de prueba) de una notificación para el usuario en sesión."""
    d = request.get_json(silent=True) or {}
    tipo = d.get("tipo")
    mensaje = (d.get("mensaje") or "").strip()
    if tipo not in TITULOS_POR_TIPO:
        raise ErrorNegocio("Tipo de evento no válido.")
    if len(mensaje) < 5:
        raise ErrorNegocio("El mensaje debe tener al menos 5 caracteres.")
    ticket_id = d.get("ticket_id") or None
    with conexion() as cur:
        if ticket_id:
            cur.execute("SELECT 1 FROM tickets WHERE id=%s AND empresa_id=%s",
                        (ticket_id, usuario_actual()["empresa_id"]))
            if not cur.fetchone():
                raise ErrorNegocio("El ticket indicado no existe.")
        cur.execute(
            "INSERT INTO notificaciones (usuario_id, ticket_id, tipo, titulo, mensaje) VALUES (%s,%s,%s,%s,%s)",
            (usuario_actual()["id"], ticket_id, tipo, TITULOS_POR_TIPO[tipo], mensaje[:255]))
        nuevo = cur.lastrowid
    return jsonify(ok=True, id=nuevo), 201


@bp.patch("/api/notificaciones/marcar-todas")
@login_requerido
def api_marcar_todas():
    with conexion() as cur:
        cur.execute("UPDATE notificaciones SET leida=TRUE WHERE usuario_id=%s AND leida=FALSE",
                    (usuario_actual()["id"],))
        return jsonify(ok=True, actualizadas=cur.rowcount)


@bp.patch("/api/notificaciones/<int:nid>/leer")
@login_requerido
def api_leer(nid):
    with conexion() as cur:
        cur.execute("UPDATE notificaciones SET leida=TRUE WHERE id=%s AND usuario_id=%s",
                    (nid, usuario_actual()["id"]))
    return jsonify(ok=True)


@bp.delete("/api/notificaciones/leidas")
@login_requerido
def api_eliminar_leidas():
    with conexion() as cur:
        cur.execute("DELETE FROM notificaciones WHERE usuario_id=%s AND leida=TRUE", (usuario_actual()["id"],))
        return jsonify(ok=True, eliminadas=cur.rowcount)


@bp.delete("/api/notificaciones/<int:nid>")
@login_requerido
def api_eliminar(nid):
    with conexion() as cur:
        cur.execute("DELETE FROM notificaciones WHERE id=%s AND usuario_id=%s", (nid, usuario_actual()["id"]))
    return jsonify(ok=True)
