"""Módulo 1 · Autenticación y usuarios (tablas usuarios, roles, empleados)."""
import re

import pymysql
from flask import Blueprint, jsonify, redirect, render_template, request, session, url_for

from auth import (empresa_id_actual, hashear_password, iniciar_sesion, login_requerido,
                  rol_requerido, usuario_actual, verificar_password)
from config import ROL_ADMIN, ROL_USUARIO
from db import conexion
from servicios import ErrorNegocio

bp = Blueprint("modulo1", __name__,
               static_folder="static", static_url_path="/modulo1/static")

# Datos de la sesión: usuario + rol + distintivo del empleado vinculado (cargo y área)
SQL_SESION = (
    "SELECT u.id, u.nombre, u.email, u.password_hash, u.rol_id, u.activo, u.empleado_id, "
    "u.empresa_id, em.nombre AS empresa, em.activa AS empresa_activa, "
    "r.nombre AS rol, e.nombre_completo AS empleado, e.cargo, a.nombre AS area "
    "FROM usuarios u JOIN roles r ON r.id = u.rol_id "
    "JOIN empresas em ON em.id = u.empresa_id "
    "LEFT JOIN empleados e ON e.id = u.empleado_id "
    "LEFT JOIN areas a ON a.id = e.area_id "
)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def pagina_inicio(rol_id):
    """Primera pantalla según el rol."""
    return url_for("modulo2.registro" if rol_id == ROL_USUARIO else "modulo4.sla")


@bp.route("/")
def raiz():
    u = usuario_actual()
    return redirect(pagina_inicio(u["rol_id"]) if u else url_for("modulo1.login"))


@bp.route("/login")
def login():
    u = usuario_actual()
    if u:
        return redirect(pagina_inicio(u["rol_id"]))
    return render_template("modulo1_usuarios/login.html")


@bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("modulo1.login"))


@bp.route("/modulo1")
@rol_requerido(ROL_ADMIN)
def usuarios():
    return render_template("modulo1_usuarios/usuarios.html")


# ------------------------------------------------------------ API: sesión ----
@bp.post("/api/auth/login")
def api_login():
    d = request.get_json(silent=True) or {}
    email = (d.get("email") or "").strip().lower()
    password = d.get("password") or ""
    with conexion() as cur:
        cur.execute(SQL_SESION + "WHERE LOWER(u.email) = %s", (email,))
        fila = cur.fetchone()
    if not fila or not verificar_password(password, fila["password_hash"]):
        return jsonify(error="Credenciales incorrectas."), 401
    if not fila["activo"]:
        return jsonify(error="Tu cuenta está desactivada. Contacta a un administrador."), 403
    if not fila["empresa_activa"]:
        return jsonify(error="El acceso de tu empresa está desactivado."), 403
    iniciar_sesion(fila)
    return jsonify(ok=True, redirect=pagina_inicio(fila["rol_id"]))


@bp.post("/api/auth/registro")
def api_registro():
    d = request.get_json(silent=True) or {}
    nombre = (d.get("nombre") or "").strip()
    email = (d.get("email") or "").strip().lower()
    password = d.get("password") or ""
    codigo_empresa = (d.get("empresa") or "").strip().lower()
    if len(nombre) < 3 or not EMAIL_RE.match(email):
        return jsonify(error="Ingresa un nombre y un correo válidos."), 400
    if len(password) < 6 or len(password.encode()) > 72:
        return jsonify(error="La contraseña debe tener entre 6 y 72 caracteres."), 400
    try:
        with conexion() as cur:
            # La empresa se elige con su código; sin código válido no se crea la cuenta.
            cur.execute("SELECT id FROM empresas WHERE codigo=%s AND activa=TRUE", (codigo_empresa,))
            empresa = cur.fetchone()
            if not empresa:
                return jsonify(error="Código de empresa no válido."), 400
            # Si el correo coincide con un empleado DE ESA EMPRESA que aún no tiene usuario, se vincula.
            cur.execute(
                "SELECT e.id FROM empleados e WHERE LOWER(e.correo) = %s AND e.empresa_id = %s "
                "AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.empleado_id = e.id)",
                (email, empresa["id"]))
            emp = cur.fetchone()
            cur.execute(
                "INSERT INTO usuarios (empresa_id, empleado_id, nombre, email, password_hash, rol_id, activo) "
                "VALUES (%s,%s,%s,%s,%s,%s,TRUE)",
                (empresa["id"], emp["id"] if emp else None, nombre, email,
                 hashear_password(password), ROL_USUARIO))
    except pymysql.err.IntegrityError:
        return jsonify(error="Ya existe una cuenta con ese correo."), 409
    return jsonify(ok=True, vinculado=bool(emp),
                   mensaje="Cuenta creada." if emp else
                   "Cuenta creada, pero tu correo no coincide con ningún empleado. "
                   "Pide a un administrador que la vincule para poder registrar tickets.")


@bp.get("/api/auth/yo")
@login_requerido
def api_yo():
    return jsonify(usuario_actual())


# ---------------------------------------------------------- API: usuarios ----
@bp.get("/api/usuarios")
@rol_requerido(ROL_ADMIN)
def api_usuarios():
    with conexion() as cur:
        cur.execute(
            "SELECT u.id, u.nombre, u.email, u.activo, u.rol_id, r.nombre AS rol, u.empleado_id, "
            "e.nombre_completo AS empleado, e.cargo, a.nombre AS area, u.creado_en "
            "FROM usuarios u JOIN roles r ON r.id = u.rol_id "
            "LEFT JOIN empleados e ON e.id = u.empleado_id "
            "LEFT JOIN areas a ON a.id = e.area_id WHERE u.empresa_id = %s ORDER BY u.id",
            (empresa_id_actual(),))
        filas = cur.fetchall()
    for f in filas:
        f["activo"] = bool(f["activo"])
    return jsonify(filas)


def _no_dejar_sin_admin(cur, usuario_id):
    cur.execute("SELECT COUNT(*) AS n FROM usuarios WHERE rol_id=%s AND activo=TRUE AND id<>%s "
                "AND empresa_id=%s", (ROL_ADMIN, usuario_id, empresa_id_actual()))
    if cur.fetchone()["n"] == 0:
        raise ErrorNegocio("Debe quedar al menos un administrador activo.", 409)


@bp.put("/api/usuarios/<int:uid>")
@rol_requerido(ROL_ADMIN)
def api_usuario_editar(uid):
    d = request.get_json(silent=True) or {}
    nombre = (d.get("nombre") or "").strip()
    if len(nombre) < 3:
        raise ErrorNegocio("El nombre es obligatorio.")
    rol_id = int(d.get("rol_id") or 0)
    empleado_id = d.get("empleado_id") or None
    password = d.get("password") or ""
    if password and (len(password) < 6 or len(password.encode()) > 72):
        raise ErrorNegocio("La nueva contraseña debe tener entre 6 y 72 caracteres.")
    empresa_id = empresa_id_actual()
    try:
        with conexion() as cur:
            cur.execute("SELECT rol_id FROM usuarios WHERE id=%s AND empresa_id=%s", (uid, empresa_id))
            actual = cur.fetchone()
            if not actual:
                raise ErrorNegocio("Usuario no encontrado.", 404)
            if empleado_id:
                cur.execute("SELECT 1 FROM empleados WHERE id=%s AND empresa_id=%s", (empleado_id, empresa_id))
                if not cur.fetchone():
                    raise ErrorNegocio("Empleado no válido.")
            if actual["rol_id"] == ROL_ADMIN and rol_id != ROL_ADMIN:
                _no_dejar_sin_admin(cur, uid)
            cur.execute("UPDATE usuarios SET nombre=%s, rol_id=%s, empleado_id=%s WHERE id=%s AND empresa_id=%s",
                        (nombre, rol_id, empleado_id, uid, empresa_id))
            if password:
                cur.execute("UPDATE usuarios SET password_hash=%s WHERE id=%s AND empresa_id=%s",
                            (hashear_password(password), uid, empresa_id))
    except pymysql.err.IntegrityError:
        raise ErrorNegocio("Rol o empleado no válido.")
    if uid == usuario_actual()["id"]:
        with conexion() as cur:
            cur.execute(SQL_SESION + "WHERE u.id=%s", (uid,))
            iniciar_sesion(cur.fetchone())
    return jsonify(ok=True)


@bp.put("/api/usuarios/<int:uid>/estado")
@rol_requerido(ROL_ADMIN)
def api_usuario_estado(uid):
    activo = bool((request.get_json(silent=True) or {}).get("activo"))
    with conexion() as cur:
        cur.execute("SELECT rol_id FROM usuarios WHERE id=%s AND empresa_id=%s", (uid, empresa_id_actual()))
        actual = cur.fetchone()
        if not actual:
            raise ErrorNegocio("Usuario no encontrado.", 404)
        if not activo:
            if uid == usuario_actual()["id"]:
                raise ErrorNegocio("No puedes desactivar tu propia cuenta.", 409)
            if actual["rol_id"] == ROL_ADMIN:
                _no_dejar_sin_admin(cur, uid)
        cur.execute("UPDATE usuarios SET activo=%s WHERE id=%s AND empresa_id=%s",
                    (activo, uid, empresa_id_actual()))
    return jsonify(ok=True, activo=activo)
