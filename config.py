"""Configuración del sistema. Ajusta aquí los datos de tu XAMPP (o usa variables de entorno)."""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ---- Flask ----
SECRET_KEY = os.getenv("SECRET_KEY", "cambia-esta-clave-en-produccion")
# En línea (HTTPS) pon SESSION_COOKIE_SECURE=1 para que la cookie de sesión solo viaje cifrada.
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "0") == "1"
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", os.path.join(BASE_DIR, "uploads"))
MAX_ARCHIVO_MB = 5            # tamaño máximo por foto
MAX_FOTOS_POR_TICKET = 4
MAX_CONTENT_LENGTH = (MAX_ARCHIVO_MB * MAX_FOTOS_POR_TICKET + 2) * 1024 * 1024

# ---- Reglas de negocio ----
UMBRAL_POR_VENCER = 0.8       # el semáforo pasa a amarillo al consumir el 80 % del SLA

# IDs de la tabla roles
ROL_ADMIN = 1
ROL_TECNICO = 2
ROL_USUARIO = 3
