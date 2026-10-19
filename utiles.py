"""Utilidades compartidas por las rutas de todos los módulos (leer datos de la petición)."""
import re
from datetime import datetime

from flask import request

from servicios import ErrorNegocio


def entero(valor, campo, obligatorio=False):
    """Convierte a int; "" o None -> None (o error si es obligatorio)."""
    if valor in (None, "", "null"):
        if obligatorio:
            raise ErrorNegocio(f"El campo {campo} es obligatorio.")
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ErrorNegocio(f"El campo {campo} no es válido.")


def cuerpo():
    """Datos enviados por el navegador: formulario (multipart) o JSON."""
    if request.mimetype == "multipart/form-data":
        return request.form.to_dict()
    return request.get_json(silent=True) or {}


def fecha_iso(valor, campo):
    """Valida una fecha YYYY-MM-DD (o vacío -> None)."""
    if not valor:
        return None
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", valor):
        raise ErrorNegocio(f"La fecha «{campo}» no es válida.")
    try:
        datetime.strptime(valor, "%Y-%m-%d")
    except ValueError:
        raise ErrorNegocio(f"La fecha «{campo}» no es válida.")
    return valor
