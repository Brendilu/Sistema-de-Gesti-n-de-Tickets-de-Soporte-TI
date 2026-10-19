"""Catálogos para llenar los <select> de todos los módulos."""
from flask import Blueprint, jsonify

from auth import login_requerido, usuario_actual
from config import MAX_ARCHIVO_MB, MAX_FOTOS_POR_TICKET
from db import conexion

bp = Blueprint("catalogos", __name__)


@bp.get("/api/catalogos")
@login_requerido
def catalogos():
    with conexion() as cur:
        cur.execute("SELECT id, nombre, sla_horas FROM prioridades ORDER BY id")
        prioridades = cur.fetchall()
        cur.execute("SELECT id, nombre, orden, es_final FROM estados ORDER BY orden")
        estados = cur.fetchall()
        cur.execute("SELECT id, nombre FROM roles ORDER BY id")
        roles = cur.fetchall()
        eid = usuario_actual()["empresa_id"]
        cur.execute("SELECT e.id, e.nombre_completo, e.cargo, a.nombre AS area "
                    "FROM empleados e LEFT JOIN areas a ON a.id = e.area_id "
                    "WHERE e.empresa_id = %s ORDER BY e.nombre_completo", (eid,))
        empleados = cur.fetchall()
        cur.execute("SELECT u.id, u.nombre, u.rol_id, r.nombre AS rol FROM usuarios u JOIN roles r ON r.id=u.rol_id "
                    "WHERE u.activo=TRUE AND u.rol_id IN (1,2) AND u.empresa_id = %s ORDER BY u.nombre", (eid,))
        tecnicos = cur.fetchall()
    for e in estados:
        e["es_final"] = bool(e["es_final"])
    return jsonify(prioridades=prioridades, estados=estados, roles=roles,
                   empleados=empleados, tecnicos=tecnicos, yo=usuario_actual(),
                   max_fotos=MAX_FOTOS_POR_TICKET, max_archivo_mb=MAX_ARCHIVO_MB)
