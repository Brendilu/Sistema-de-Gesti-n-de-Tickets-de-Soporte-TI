# Módulo 2 · Dictado por voz y asistente con IA — instrucciones de configuración

Autor: Joel Zelada Rodriguez. Todo el código vive en `templates/modulo2_tickets/`; no se modificó ningún archivo compartido ni de otros módulos.

## Qué se agregó
| Función | Archivos |
|---|---|
| Dictado por voz (Web Speech API) | `static/js/modulo2_voz.js`, bloque `.voz-box` en `registro_tickets.html` |
| Asistente con IA + base de conocimiento | `asistente.py`, `static/js/modulo2_asistente.js`, bloque `#iaBox` en `registro_tickets.html` |
| Estilos | `static/css/modulo2_ia.css` |
| Enlaces con lo existente | `routes.py` (registra las rutas y enlaza la consulta con el ticket), `static/js/modulo2.js` (envía `consulta_id`) |

No hay dependencias nuevas (`requirements.txt` no cambia): la API del modelo se llama con `urllib` de la librería estándar.

## 1. Dictado por voz
No necesita configuración ni claves.
- Funciona en **Chrome y Edge** (escritorio y Android) y Safari; **Firefox no lo soporta** (el botón se desactiva y se avisa).
- Requiere **HTTPS** o `http://localhost` (límite del navegador para usar el micrófono).
- El audio lo procesa el servicio de voz del navegador (en Chrome/Edge, un servidor externo); el sistema **no guarda audio**, solo el texto que el usuario registra. La primera vez se muestra un aviso de privacidad que hay que aceptar.
- Idioma: `es-PE` (constante `IDIOMA` en `modulo2_voz.js`; puede cambiarse a `es-ES` o `es-MX`).

## 2. Asistente con IA
### Servicio externo y variables de entorno
Se usa la API Messages de Anthropic. Crea una clave en https://console.anthropic.com y define:

| Variable | Obligatoria | Por defecto | Para qué sirve |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **Sí** | — | Clave secreta de la API. Solo el servidor la lee. |
| `LLM_MODELO` | No | `claude-haiku-5-5` | Modelo a usar. |
| `LLM_API_URL` | No | `https://api.anthropic.com/v1/messages` | Útil para pruebas con un servidor simulado. |
| `LLM_TIMEOUT` | No | `20` | Segundos de espera máxima. |
| `ASISTENTE_MAX_POR_MINUTO` | No | `5` | Consultas por usuario por minuto. |
| `ASISTENTE_MAX_POR_DIA` | No | `20` | Consultas por usuario por día. |
| `ASISTENTE_MAX_CHARS_CONSULTA` | No | `500` | Largo máximo de la descripción del problema. |
| `ASISTENTE_MAX_ARTICULOS` | No | `3` | Artículos enviados al modelo por consulta. |
| `ASISTENTE_MAX_CHARS_ARTICULO` | No | `1200` | Texto máximo de cada artículo enviado. |
| `ASISTENTE_MAX_TOKENS` | No | `500` | Tope de tokens de la respuesta. |
| `ASISTENTE_SEMILLA` | No | `1` | `0` desactiva la carga de 6 artículos de ejemplo. |

Cómo definirla:
- **Local (Linux/Mac):** `export ANTHROPIC_API_KEY="sk-ant-..."` y luego `python main.py`.
- **Local (Windows PowerShell):** `$env:ANTHROPIC_API_KEY="sk-ant-..."`.
- **Archivo `.env`** junto a `main.py` (ya está en `.gitignore`, **no lo subas al repositorio**): una línea `CLAVE=valor` por variable; `asistente.py` lo lee solo.
- **PythonAnywhere:** en el archivo WSGI agrega `os.environ["ANTHROPIC_API_KEY"] = "..."` antes de importar la app, o usa el `.env`.

Nunca pongas la clave en el código, en el JavaScript ni en el repositorio. Si falta, el asistente avisa "no está configurado" y el usuario puede crear el ticket igual.

### Base de conocimiento
- Las tablas `kb_articulos` y `asistente_consultas` se **crean solas** la primera vez que se usa el asistente (no hace falta ejecutar SQL).
- Cada empresa recibe **6 artículos de ejemplo** la primera vez. El Administrador los reemplaza desde *Registro de tickets* → asistente → **📚 Gestionar artículos** (crear, editar, quitar).
- El asistente responde **solo con los artículos de la empresa del usuario** y los muestra como "Artículos de origen". Si no hay artículos relevantes (o el modelo dice que no alcanzan), no inventa y ofrece crear el ticket.
- Consejo: escribe en cada artículo un título claro y palabras clave que los usuarios usarían ("impresora imprimir cola papel").

### Control de costos (ya aplicado)
Consulta máx. 500 caracteres · máx. 3 artículos de 1200 caracteres · respuesta máx. 500 tokens · modelo pequeño · 5/min y 20/día por usuario · sin artículos relevantes no se llama a la API.

### Métricas
Cada consulta queda en `asistente_consultas` con su estado: `resuelta` (el usuario confirmó que le sirvió, sin ticket), `ticket` (terminó en un ticket), `sin_respuesta`, `pendiente` (no respondió si sirvió) o `error` (falló la API), más los tokens usados. Administradores y técnicos ven el resumen bajo el asistente (también en `GET /api/asistente/estadisticas`).

## 3. Cómo probarlo
1. Arranca la app (`python main.py`), entra con un usuario (por ejemplo `usuario@santaaurora.demo` / `Demo2026!`) y abre **Registro de tickets**.
2. **Voz:** pulsa **🎤 Dictar incidencia**, acepta el aviso y el permiso del micrófono, di "Mi impresora del segundo piso no imprime desde esta mañana" y pulsa **Detener dictado**. Se llenan Título y Descripción; edítalos y pulsa **Registrar ticket**.
   - Errores: niega el permiso del micrófono (mensaje de permiso) · desconecta el micrófono (no se encontró micrófono) · no hables (no se detectó voz) · abre en Firefox (botón desactivado con aviso).
3. **Asistente:** con `ANTHROPIC_API_KEY` definida, abre **¿Probamos resolverlo…?**, escribe "La impresora no imprime mis documentos" y pulsa **Buscar solución**. Deben aparecer pasos y el artículo "La impresora no imprime" como origen.
   - **✅ Esto resolvió mi problema** → la consulta queda `resuelta`.
   - **No resolvió mi problema, crear ticket** → la descripción pasa al formulario; al registrar el ticket la consulta queda `ticket`.
   - Escribe algo sin relación ("quiero vacaciones en la playa") → "No encontré información suficiente".
   - Quita la clave o desconecta internet → mensaje de error de la API y se puede crear el ticket.
4. Como Administrador, abre **📚 Gestionar artículos**, crea uno nuevo y comprueba que el asistente lo usa.
5. Revisa la línea "📊 Uso del asistente" (Admin/Técnico): consultas resueltas sin ticket y consultas que terminaron en ticket.

### Prueba sin gastar créditos
Levanta un servidor local que responda `{"content":[{"type":"text","text":"{\"suficiente\":true,\"resumen\":\"...\",\"pasos\":[\"...\"],\"fuentes\":[1]}"}],"usage":{"input_tokens":900,"output_tokens":100}}` y apunta `LLM_API_URL=http://127.0.0.1:PUERTO/v1/messages`.

## 4. Si usas otro proveedor de IA
Solo cambia la función `_llamar_llm()` de `asistente.py` (URL, cabeceras y formato de cuerpo/respuesta); el resto no cambia.
