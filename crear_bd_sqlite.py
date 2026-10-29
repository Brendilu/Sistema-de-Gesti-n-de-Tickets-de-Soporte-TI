"""Crea database/tickets_ti.db (SQLite) a partir de database/tickets_ti.sql (MySQL)."""
import os
import re
import sqlite3

BASE = os.path.dirname(os.path.abspath(__file__))
SQL_ORIGEN = os.path.join(BASE, "database", "tickets_ti.sql")
BD_DESTINO = os.path.join(BASE, "database", "tickets_ti.db")

ESQUEMA = """
PRAGMA foreign_keys = OFF;

CREATE TABLE empresas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre VARCHAR(120) NOT NULL,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  activa BOOLEAN NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE prioridades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre VARCHAR(20) NOT NULL UNIQUE,
  sla_horas INTEGER NOT NULL
);

CREATE TABLE estados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre VARCHAR(20) NOT NULL UNIQUE,
  orden INTEGER NOT NULL,
  es_final BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  UNIQUE (empresa_id, nombre),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

CREATE TABLE empleados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  nombre_completo VARCHAR(120) NOT NULL,
  cargo VARCHAR(80),
  area_id INTEGER,
  celular VARCHAR(15),
  correo VARCHAR(120),
  UNIQUE (empresa_id, correo),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (area_id) REFERENCES areas(id)
);
CREATE INDEX idx_empleado_empresa ON empleados(empresa_id);

CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  empleado_id INTEGER NULL,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol_id INTEGER NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE SET NULL,
  FOREIGN KEY (rol_id) REFERENCES roles(id)
);
CREATE INDEX idx_usuario_empresa ON usuarios(empresa_id);

CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  codigo VARCHAR(12) NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  descripcion TEXT NOT NULL,
  prioridad_id INTEGER NOT NULL,
  estado_id INTEGER NOT NULL,
  solicitante_id INTEGER NULL,
  tecnico_id INTEGER NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cerrado_en DATETIME NULL,
  UNIQUE (empresa_id, codigo),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (prioridad_id) REFERENCES prioridades(id),
  FOREIGN KEY (estado_id) REFERENCES estados(id),
  FOREIGN KEY (solicitante_id) REFERENCES empleados(id) ON DELETE SET NULL,
  FOREIGN KEY (tecnico_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX idx_empresa_estado ON tickets(empresa_id, estado_id);
CREATE INDEX idx_estado ON tickets(estado_id);
CREATE INDEX idx_tecnico ON tickets(tecnico_id);
CREATE INDEX idx_creado ON tickets(creado_en);

-- Reemplaza el "ON UPDATE CURRENT_TIMESTAMP" de MySQL
CREATE TRIGGER trg_tickets_actualizado
AFTER UPDATE ON tickets
WHEN NEW.actualizado_en = OLD.actualizado_en
BEGIN
  UPDATE tickets SET actualizado_en = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE ticket_adjuntos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  ruta VARCHAR(500) NOT NULL,
  mime VARCHAR(30) NOT NULL,
  tamano_bytes INTEGER,
  subido_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

CREATE TABLE ticket_historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  estado_anterior_id INTEGER NULL,
  estado_nuevo_id INTEGER NOT NULL,
  usuario_id INTEGER NULL,
  comentario VARCHAR(500) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (LENGTH(TRIM(comentario)) > 0),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (estado_anterior_id) REFERENCES estados(id),
  FOREIGN KEY (estado_nuevo_id) REFERENCES estados(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE notificaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  ticket_id INTEGER NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('creado','asignado','estado','sla')),
  titulo VARCHAR(80) NOT NULL,
  mensaje VARCHAR(255) NOT NULL,
  leida BOOLEAN NOT NULL DEFAULT 0,
  creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);
CREATE INDEX idx_usuario_leida ON notificaciones(usuario_id, leida);
"""


def _intervalo(m):
    unidad = "minutes" if m.group(2) == "MINUTE" else "hours"
    return "datetime('now','-%s %s')" % (m.group(1), unidad)


with open(SQL_ORIGEN, encoding="utf-8") as f:
    original = f.read()

# Solo los INSERT (desde el primero), con las fechas convertidas
datos = original[original.index("INSERT INTO empresas"):]
datos = re.sub(r"NOW\(\)\s*-\s*INTERVAL\s+(\d+)\s+(MINUTE|HOUR)", _intervalo, datos)

if os.path.exists(BD_DESTINO):
    os.remove(BD_DESTINO)

con = sqlite3.connect(BD_DESTINO)
con.executescript(ESQUEMA)
con.executescript(datos)
con.commit()

print("Base creada en:", BD_DESTINO)
for (tabla,) in con.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
).fetchall():
    n = con.execute("SELECT COUNT(*) FROM %s" % tabla).fetchone()[0]
    print("  %-18s %d filas" % (tabla, n))
problemas = con.execute("PRAGMA foreign_key_check").fetchall()
print("Problemas de llaves foráneas:", problemas or "ninguno")
con.close()