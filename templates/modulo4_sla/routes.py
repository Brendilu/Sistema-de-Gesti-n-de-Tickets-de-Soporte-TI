"""Módulo 4 · SLA + semáforo visual. El semáforo lo calcula servicios.calcular_semaforo()
con la diferencia de timestamps (creado_en → ahora, o → cerrado_en si ya se cerró)."""
from flask import Blueprint, render_template

from auth import rol_requerido
from config import ROL_ADMIN, ROL_TECNICO

bp = Blueprint("modulo4", __name__,
               static_folder="static", static_url_path="/modulo4/static")


@bp.route("/modulo4")
@rol_requerido(ROL_ADMIN, ROL_TECNICO)
def sla():
    return render_template("modulo4_sla/sla.html")
