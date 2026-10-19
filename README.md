# Atlas Soporte · Sistema de tickets de TI (Flask + XAMPP) · **multiempresa**

## Multiempresa (cada empresa ve solo lo suyo)
Una sola base de datos y una sola aplicación atienden a varias empresas a la vez.
- Tabla `empresas`; las tablas `areas`, `empleados`, `usuarios` y `tickets` llevan `empresa_id` (adjuntos, historial y notificaciones heredan la empresa del ticket/usuario). Roles, prioridades y estados son catálogos globales.
- Al iniciar sesión, la empresa del usuario se guarda en la sesión firmada del servidor. **Todas** las consultas filtran por ese valor; el navegador nunca envía ni puede cambiar la empresa. Un ticket/usuario/foto de otra empresa responde 404.
- El correo de login es único en todo el sistema (así se sabe a qué empresa pertenece). Los códigos `TCK-0001…` se numeran por empresa.
- Registro: la persona escribe el **código de empresa** (ej. `grupoflores`); su correo solo se vincula a empleados de esa empresa.
- **Crear empresas y usuarios (panel web)**: define la variable de entorno `PLATAFORMA_CLAVE` (una clave solo tuya), abre `/plataforma`, entra con esa clave y crea la empresa con su administrador. Desde ahí también agregas más usuarios (admin, técnico o usuario) a cualquier empresa y puedes desactivar una empresa. Ningún usuario de una empresa puede entrar a este panel. (Alternativa por terminal: `python crear_empresa.py ...`.)
- Empresas demo (contraseña `Demo2026!`): `santaaurora` → admin@/soporte@/usuario@santaaurora.demo · `andesnorte` → admin@/soporte@/usuario@andesnorte.demo · `grupoflores` → cuentas de abajo.

### Variables de entorno para ponerlo en línea
`DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME`, `SECRET_KEY` (obligatorio cambiarla), `SESSION_COOKIE_SECURE=1` (con HTTPS), `UPLOAD_FOLDER`, `FLASK_DEBUG=0`. Servidor: `gunicorn main:app`. Nota: `database/tickets_ti.sql` borra y recrea las tablas; úsalo solo en la primera carga.


Los 5 módulos del zip unidos en un solo proyecto y conectados a la BD `tickets_ti`.

## Puesta en marcha con XAMPP
1. Abre XAMPP y enciende **MySQL** (Apache solo hace falta para phpMyAdmin).
2. En phpMyAdmin → *Importar* → `database/tickets_ti.sql` (crea la BD y los datos de ejemplo).
3. Si tu `root` de MySQL tiene contraseña, ajústala en `obtener_conexion()` de `db.py`.
4. Instala dependencias: `pip install flask pymysql`
5. Arranca: `python main.py` → http://localhost:5000
   Ingreso de prueba: `sistemas@grupoflores.pe` / `CALEB1306$` (Administrador).
   Otras cuentas de demo: `laura.medina@empresa.com` / `VALKO7685%` (Admin), `ana.ruiz@empresa.com` / `POWERPU1·` (Técnico), `carlos.vega@empresa.com` / `f01201037$` (Técnico), `luis.paz@empresa.com` / `HOLA7161%` (Usuario, inactivo).
   En la BD las contraseñas se guardan como hash; para cambiar una, el Admin la edita en Módulo 1.
   Técnicos: `ana.ruiz@empresa.com`, `carlos.vega@empresa.com`. `luis.paz@empresa.com` está inactivo en la BD.

## Estructura (una carpeta por módulo, dentro de `templates/`)
```
main.py                      Arranque: registra los módulos, arma el menú por rol y los errores
config.py  db.py             COMPARTIDOS: límites/roles y obtener_conexion() a MySQL
auth.py    servicios.py      COMPARTIDOS: login/roles · reglas de tickets, historial, SLA y notificaciones
utiles.py                    COMPARTIDO: leer datos de la petición (entero, cuerpo, fecha_iso)
static/                      COMPARTIDO: css/ sidebar.css, filtros.css, nav.css · js/ api.js, nav.js
templates/
  partials/sidebar.html      trozo de HTML reutilizable: el menú lateral
  acceso_denegado.html
  modulo1_usuarios/          routes.py (Python) · login.html, usuarios.html · static/css y static/js
  modulo2_tickets/           routes.py · registro_tickets.html, admin_tickets.html · static/…   + API /api/tickets
  modulo3_historial/         routes.py · historial.html · static/…   gestión (asignar/estado) + historial por rol
  modulo4_sla/               routes.py · sla.html · static/…   SLA y semáforo
  modulo5_notificaciones/    routes.py · notificaciones.html · static/…   notificaciones y campana
  catalogos/                 routes.py   /api/catalogos (llena los <select> de todos los módulos)
uploads/                     Fotos de los tickets
database/tickets_ti.sql      Estructura y datos de ejemplo
```

### ¿Qué pantallas afecta cada archivo?
- **Una carpeta de `templates/moduloN_…/`** (su `routes.py`, sus `.html`, su `static/css` y `static/js`): solo afecta a ese módulo.
- **Archivos compartidos** (`config.py`, `db.py`, `auth.py`, `servicios.py`, `utiles.py`, `static/`, `templates/partials/sidebar.html`, la lista `MODULOS` de `main.py`): afectan a **todas** las pantallas.
- **Los módulos se conectan** por la API y las reglas comunes: el 3 usa `/api/tickets` del 2, y todos usan `/api/catalogos` y el menú compartido. Si cambias una URL de la API, revisa los `.js` que la llaman.
- Un módulo nuevo = una carpeta nueva dentro de `templates/` con `routes.py` (Blueprint con `static_folder`), sus `.html` y `static/`, y registrarlo en `main.py`.
- Con `flask --app main run --debug` los cambios en `.py` se recargan solos; html/css/js se ven recargando el navegador (Ctrl+F5).

## Quién puede hacer qué
| Rol | Ve el menú | Tickets | Historial |
|---|---|---|---|
| Usuario (cualquier empleado) | Registro de tickets, Notificaciones | Envía tickets (hasta **4 fotos**), ve y edita **solo los suyos** mientras estén en Nuevo/Abierto | No ve historial |
| Técnico | + Asignación, SLA | Ve todos; **gestiona solo los suyos o los sin asignar** (al gestionarlo queda a su nombre). El ticket de otro técnico solo lo gestiona el Admin | Solo **sus propias acciones** (ticket y listado global) |
| Administrador | Todos los módulos | Gestiona, edita, reasigna y elimina cualquiera | Ve las acciones de **todos** y filtra por persona |

- Cada módulo tiene filtros (texto sin importar tildes, estado, prioridad, técnico, fechas). Las pantallas son responsive (menú lateral → franja superior en celular, tablas → tarjetas).
- **Distintivo**: cada trabajador muestra un círculo con sus iniciales (color según su área), cargo, área y código `EMP-000N` en el menú lateral, listas y tablas.

## Cómo se relacionan los módulos (según la BD)
| Módulo | Pantalla | Tablas |
|---|---|---|
| 1 | `/login`, `/modulo1` (solo Admin) | usuarios, roles, empleados |
| 2 | `/modulo2` (todos), `/modulo2/admin` (Admin) | tickets, ticket_adjuntos, ticket_historial |
| 3 | `/modulo3/<id>` (Admin/Técnico) | ticket_historial, tickets, usuarios |
| 4 | `/modulo4` (Admin/Técnico) | tickets + prioridades.sla_horas + estados.es_final |
| 5 | `/modulo5` + contador en el menú | notificaciones |

- Crear un ticket genera su primera fila de historial y notifica a los administradores; asignar técnico notifica al técnico; cambiar el estado notifica al técnico y al solicitante.
- Cada cambio de estado/técnico se guarda en `ticket_historial` en la misma transacción que el `UPDATE` de `tickets`. `cerrado_en` se llena al pasar a un estado con `es_final`.
- El semáforo (verde/amarillo/rojo) se calcula en el servidor con `TIMESTAMPDIFF` y el SLA de la prioridad; al llegar al 80 % se crea una sola notificación `sla` por ticket.
- Un usuario con rol **Usuario** solo ve sus propios tickets; para eso su cuenta debe estar vinculada a un empleado (se vincula sola si el correo coincide con `empleados.correo`; si no, el Admin la vincula en Módulo 1 → Editar).

## Notas sobre la adaptación
- La autenticación usa **sesión de Flask + hash de werkzeug (incluido con Flask)** (el prototipo hablaba de JWT).
- `MODULO 4/css/layout.css` y `MODULO 4/js/datos.js` no se usaban/no existían; el HTML del módulo 4 usaba clases que su CSS no definía, así que el template se rehízo con las clases de `modulo4.css` y se añadieron los estilos de formulario faltantes. `layout.css` quedó como `css/modulo4_layout.css` (sin enlazar).
- `datos.js` del módulo 5 ya no hace falta: los datos vienen de la BD.
- Las fuentes vienen de Google Fonts; sin internet se usa la fuente del sistema.
