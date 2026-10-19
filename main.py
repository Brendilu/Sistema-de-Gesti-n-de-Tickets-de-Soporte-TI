"""Punto de entrada: python main.py  →  http://localhost:5000"""
import os
from datetime import date, datetime
from decimal import Decimal

import pymysql
from flask import Flask, jsonify, render_template, request
from flask.json.provider import DefaultJSONProvider

import config
from auth import usuario_actual
from templates import (catalogos, modulo1_usuarios, modulo2_tickets, modulo3_historial,
                       modulo4_sla, modulo5_notificaciones, plataforma)
from servicios import ErrorNegocio

BASE = os.path.dirname(os.path.abspath(__file__))

# Menú lateral / superior: (número, etiqueta, endpoint, roles permitidos)
MODULOS = [
    ("1", "Usuarios y roles", "modulo1.usuarios", (config.ROL_ADMIN,)),
    ("2", "Registro de tickets", "modulo2.registro",
     (config.ROL_ADMIN, config.ROL_TECNICO, config.ROL_USUARIO)),
    ("2", "Admin. de tickets", "modulo2.admin", (config.ROL_ADMIN,)),
    ("3", "Asignación + historial", "modulo3.inicio", (config.ROL_ADMIN, config.ROL_TECNICO)),
    ("4", "SLA + semáforo", "modulo4.sla", (config.ROL_ADMIN, config.ROL_TECNICO)),
    ("5", "Notificaciones", "modulo5.notificaciones",
     (config.ROL_ADMIN, config.ROL_TECNICO, config.ROL_USUARIO)),
]


class JSONProvider(DefaultJSONProvider):
    @staticmethod
    def default(o):
        if isinstance(o, datetime):
            return o.strftime("%Y-%m-%d %H:%M:%S")
        if isinstance(o, date):
            return o.isoformat()
        if isinstance(o, Decimal):
            return float(o)
        return DefaultJSONProvider.default(o)


def crear_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = config.SECRET_KEY
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = config.SESSION_COOKIE_SECURE
    app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_LENGTH
    app.json = JSONProvider(app)
    os.makedirs(config.UPLOAD_FOLDER, exist_ok=True)

    for modulo in (modulo1_usuarios, catalogos, modulo2_tickets, modulo3_historial,
                   modulo4_sla, modulo5_notificaciones, plataforma):
        app.register_blueprint(modulo.bp)

    def color_distintivo(u):
        """Mismo cálculo que distintivo() en api.js: el color sale del área (o del rol)."""
        if u and u.get("area"):
            clave, h = u["area"], 0
            for ch in clave:
                h = (h * 31 + ord(ch)) % 360
            return h
        return {"Administrador": 268, "Técnico": 176, "Usuario": 212}.get(u.get("rol") if u else None, 212)

    @app.context_processor
    def inyectar():
        u = usuario_actual()
        menu = [m for m in MODULOS if u and u["rol_id"] in m[3]]
        iniciales = "".join(p[0] for p in u["nombre"].split()[:2]).upper() if u else ""
        return dict(usuario=u, menu=menu, iniciales=iniciales, color_distintivo=color_distintivo)

    # ---- errores: JSON para /api, HTML para páginas ----
    def _json(msg, status):
        return jsonify(error=msg), status

    @app.errorhandler(ErrorNegocio)
    def _negocio(e):
        return _json(e.mensaje, e.status)

    @app.errorhandler(pymysql.err.OperationalError)
    def _bd(e):
        app.logger.exception(e)
        msg = "No se pudo conectar con la base de datos. ¿Está encendido MySQL en XAMPP y existe tickets_ti?"
        return _json(msg, 503) if request.path.startswith("/api/") else (msg, 503)

    @app.errorhandler(ValueError)
    def _valor(e):
        app.logger.exception(e)
        return _json("Datos no válidos.", 400)

    @app.errorhandler(413)
    def _grande(e):
        return _json("Los archivos son demasiado grandes.", 413)

    @app.errorhandler(404)
    def _404(e):
        if request.path.startswith("/api/"):
            return _json("Recurso no encontrado.", 404)
        return render_template("acceso_denegado.html", mensaje="Página no encontrada."), 404

    return app


app = crear_app()

if __name__ == "__main__":
    # Local: debug activo. En línea usa un servidor WSGI (gunicorn main:app) y FLASK_DEBUG=0.
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")),
            debug=os.getenv("FLASK_DEBUG", "1") == "1")
