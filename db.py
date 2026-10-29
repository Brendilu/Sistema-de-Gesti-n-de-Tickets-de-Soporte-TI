"""Acceso a la base de datos (SQLite en PythonAnywhere gratuito)."""
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime

RUTA_BD = os.getenv(
    "DB_PATH",
    "/home/aplicacioneswebgrupo5/mysite/database/tickets_ti.db",
)

# Las columnas DATETIME vuelven como datetime (igual que con pymysql)
sqlite3.register_converter("DATETIME", lambda b: datetime.fromisoformat(b.decode()))
sqlite3.register_adapter(datetime, lambda d: d.isoformat(" "))


def _dict_factory(cursor, row):
    return {col[0]: row[i] for i, col in enumerate(cursor.description)}


class _Cursor:
    """Envuelve el cursor para aceptar %s (estilo pymysql)."""

    def __init__(self, cur):
        self._cur = cur

    def execute(self, sql, params=None):
        self._cur.execute(sql.replace("%s", "?"), params or ())
        return self

    def executemany(self, sql, seq):
        self._cur.executemany(sql.replace("%s", "?"), seq)
        return self

    def __getattr__(self, nombre):
        return getattr(self._cur, nombre)


def obtener_conexion():
    con = sqlite3.connect(RUTA_BD, detect_types=sqlite3.PARSE_DECLTYPES)
    con.row_factory = _dict_factory
    con.execute("PRAGMA foreign_keys = ON")
    return con


@contextmanager
def conexion():
    """Entrega un cursor dentro de una transacción.

    Hace commit al salir bien y rollback si ocurre una excepción.
    """
    con = obtener_conexion()
    try:
        yield _Cursor(con.cursor())
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