"""Autenticación: hash de contraseñas (werkzeug) + sesión de Flask + decoradores por rol."""
from functools import wraps

from flask import jsonify, redirect, render_template, request, session, url_for

from werkzeug.security import check_password_hash, generate_password_hash

from config import ROL_ADMIN, ROL_TECNICO, ROL_USUARIO  # noqa: F401


def hashear_password(password: str) -> str:
    return generate_password_hash(password, method="pbkdf2:sha256")


def verificar_password(password: str, password_hash: str) -> bool:
    try:
        return check_password_hash(password_hash, password)
    except (ValueError, TypeError):
        return False


def usuario_actual():
    return session.get("usuario")


def empresa_id_actual():
    """Id de la empresa del usuario en sesión (aislamiento multiempresa)."""
    return session["usuario"]["empresa_id"]


def iniciar_sesion(fila):
    session.clear()
    session["usuario"] = {
        "id": fila["id"],
        "nombre": fila["nombre"],
        "email": fila["email"],
        "rol_id": fila["rol_id"],
        "rol": fila["rol"],
        "empleado_id": fila["empleado_id"],
        # Empresa (tenant): TODA consulta se filtra con este valor, que solo sale de la sesión
        # firmada del servidor, nunca de lo que envía el navegador.
        "empresa_id": fila["empresa_id"],
        "empresa": fila.get("empresa"),
        # Distintivo del trabajador (solo si la cuenta está vinculada a un empleado)
        "empleado": fila.get("empleado"),
        "cargo": fila.get("cargo"),
        "area": fila.get("area"),
    }


def _es_api():
    return request.path.startswith("/api/")


def login_requerido(f):
    @wraps(f)
    def envoltura(*a, **kw):
        if not usuario_actual():
            if _es_api():
                return jsonify(error="Sesión no iniciada."), 401
            return redirect(url_for("modulo1.login"))
        return f(*a, **kw)
    return envoltura


def rol_requerido(*roles):
    """Permite el acceso solo a los rol_id indicados (ej. rol_requerido(ROL_ADMIN))."""
    def decorador(f):
        @wraps(f)
        @login_requerido
        def envoltura(*a, **kw):
            if usuario_actual()["rol_id"] not in roles:
                if _es_api():
                    return jsonify(error="No tienes permiso para esta acción."), 403
                return render_template("acceso_denegado.html"), 403
            return f(*a, **kw)
        return envoltura
    return decorador
