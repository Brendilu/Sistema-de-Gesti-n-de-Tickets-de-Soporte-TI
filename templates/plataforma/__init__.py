"""Cada carpeta es un módulo: su routes.py (Python), sus .html y static/ (css y js)."""
from flask import Blueprint

# El nombre 'plataforma' es solo una etiqueta, pero la variable DEBE llamarse 'bp'
bp = Blueprint('plataforma', __name__) 

@bp.route('/')
def inicio():
    return "Hola"