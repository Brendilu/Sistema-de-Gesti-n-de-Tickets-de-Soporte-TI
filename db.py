"""Acceso a la base de datos (MySQL / MariaDB). Local con XAMPP o en línea: se configura por variables de entorno."""
import os
from contextlib import contextmanager

import pymysql


def obtener_conexion():
    return pymysql.connect(host=os.getenv("DB_HOST", "localhost"),
                           port=int(os.getenv("DB_PORT", "3306")),
                           user=os.getenv("DB_USER", "root"),
                           password=os.getenv("DB_PASSWORD", ""),
                           database=os.getenv("DB_NAME", "tickets_ti"),
                           charset="utf8mb4",
                           cursorclass=pymysql.cursors.DictCursor)


@contextmanager
def conexion():
    """Entrega un cursor dentro de una transacción.

        with conexion() as cur:
            cur.execute("SELECT ...")

    Hace commit al salir bien y rollback si ocurre una excepción.
    """
    con = obtener_conexion()
    try:
        with con.cursor() as cur:
            yield cur
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def consultar(sql, params=None, uno=False):
    """SELECT rápido: devuelve lista de dicts (o un dict/None si uno=True)."""
    with conexion() as cur:
        cur.execute(sql, params or ())
        return cur.fetchone() if uno else cur.fetchall()
