"""Crea una empresa nueva (con su primer administrador) para el demo.

Uso:
    python crear_empresa.py "Mi Empresa SAC" miempresa admin@miempresa.pe "ClaveSegura123"

El código ("miempresa") es lo que usan los empleados para registrarse (/login → Registrarte).
El correo del administrador debe ser único en todo el sistema.
"""
import sys

from auth import hashear_password
from config import ROL_ADMIN
from db import conexion


def main(nombre, codigo, email, password):
    codigo, email = codigo.strip().lower(), email.strip().lower()
    with conexion() as cur:
        cur.execute("INSERT INTO empresas (nombre, codigo) VALUES (%s,%s)", (nombre.strip(), codigo))
        empresa_id = cur.lastrowid
        cur.execute(
            "INSERT INTO usuarios (empresa_id, nombre, email, password_hash, rol_id, activo) "
            "VALUES (%s,%s,%s,%s,%s,TRUE)",
            (empresa_id, "Administrador", email, hashear_password(password), ROL_ADMIN))
    print(f"Empresa «{nombre}» creada (id {empresa_id}, código '{codigo}'). Admin: {email}")


if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    main(*sys.argv[1:])
