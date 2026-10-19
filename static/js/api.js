/* ==========================================================================
   api.js · Utilidades compartidas por todos los módulos (fetch + helpers)
   ========================================================================== */

// Llama a la API Flask. Uso: api("/api/tickets", {method:"POST", json:{...}}) o body: FormData
async function api(url, opciones = {}) {
    const o = { credentials: "same-origin", headers: {}, ...opciones };
    if (o.json !== undefined) {
        o.body = JSON.stringify(o.json);
        o.headers["Content-Type"] = "application/json";
        delete o.json;
    }
    let r;
    try {
        r = await fetch(url, o);
    } catch (e) {
        throw new Error("No se pudo contactar con el servidor.");
    }
    let datos = null;
    try { datos = await r.json(); } catch (e) { /* respuesta sin JSON */ }
    if (r.status === 401 && !url.includes("/api/auth/")) {
        location.href = "/login";
    }
    if (!r.ok) {
        throw new Error((datos && datos.error) || `Error del servidor (${r.status})`);
    }
    return datos;
}

// Escapa texto para insertarlo en innerHTML sin riesgo de XSS.
function esc(texto) {
    const d = document.createElement("div");
    d.textContent = texto == null ? "" : String(texto);
    return d.innerHTML;
}

// Catálogos (prioridades, estados, empleados, técnicos, roles) — se piden una sola vez.
let _promesaCatalogos = null;
function cargarCatalogos() {
    if (!_promesaCatalogos) _promesaCatalogos = api("/api/catalogos");
    return _promesaCatalogos;
}

// Rellena un <select>. items: array de objetos; campoValor/campoTexto: nombres de campos o funciones.
function llenarSelect(select, items, campoValor, campoTexto, opcionVacia) {
    const val = (it) => typeof campoValor === "function" ? campoValor(it) : it[campoValor];
    const txt = (it) => typeof campoTexto === "function" ? campoTexto(it) : it[campoTexto];
    let html = opcionVacia != null ? `<option value="">${esc(opcionVacia)}</option>` : "";
    html += items.map(it => `<option value="${esc(val(it))}">${esc(txt(it))}</option>`).join("");
    select.innerHTML = html;
}

// "2026-10-17 08:15:00" (hora de la BD) -> Date
function aFecha(texto) {
    return texto ? new Date(String(texto).replace(" ", "T")) : null;
}
function formatearFecha(texto) {
    const f = aFecha(texto);
    return f ? f.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "—";
}

// 5.17 -> "5 h 10 min"
function formatearHoras(hDecimal) {
    const h = Math.floor(hDecimal);
    const m = Math.round((hDecimal - h) * 60);
    if (h === 0) return `${m} min`;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

// 725 segundos -> "Hace 12 min"
function haceTiempo(segundos) {
    if (segundos < 60) return "Hace un momento";
    if (segundos < 3600) return `Hace ${Math.floor(segundos / 60)} min`;
    if (segundos < 86400) return `Hace ${Math.floor(segundos / 3600)} h`;
    return `Hace ${Math.floor(segundos / 86400)} d`;
}


/* ==========================================================================
   Filtros y distintivo (compartidos por los módulos)
   ========================================================================== */

// Texto sin tildes y en minúsculas, para buscar "jose" y encontrar "JOSÉ".
function norm(texto) {
    return String(texto == null ? "" : texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// ¿La búsqueda aparece en alguno de los campos? (cada palabra debe aparecer)
function coincide(busqueda, ...campos) {
    const q = norm(busqueda).trim();
    if (!q) return true;
    const pajar = norm(campos.join(" "));
    return q.split(/\s+/).every(p => pajar.includes(p));
}

// ¿La fecha "2026-10-17 08:15:00" cae entre desde y hasta (YYYY-MM-DD, ambos opcionales)?
function enRango(fecha, desde, hasta) {
    const dia = String(fecha || "").slice(0, 10);
    if (desde && dia < desde) return false;
    if (hasta && dia > hasta) return false;
    return true;
}

function debounce(fn, ms = 200) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// Conecta una barra de filtros: cuando cambia cualquier control con [data-f] se llama a alAplicar().
// El botón [data-f-limpiar] los deja en su valor inicial.
function conectarFiltros(barra, alAplicar) {
    const controles = () => barra.querySelectorAll("[data-f]");
    const aplicar = debounce(alAplicar, 150);
    controles().forEach(c => {
        c.dataset.inicial = c.value;
        c.addEventListener("input", aplicar);
        c.addEventListener("change", aplicar);
    });
    const limpiar = barra.querySelector("[data-f-limpiar]");
    if (limpiar) limpiar.addEventListener("click", () => {
        controles().forEach(c => { c.value = c.dataset.inicial; });
        alAplicar();
    });
}
const valorFiltro = (barra, nombre) => (barra.querySelector(`[data-f="${nombre}"]`) || {}).value || "";

// ---- Distintivo del trabajador: iniciales con el color de su área + cargo y área ----
function colorDe(clave) {
    let h = 0;
    for (const ch of String(clave || "?")) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
}
const COLOR_ROL = { "Administrador": 268, "Técnico": 176, "Usuario": 212 };

function inicialesDe(nombre) {
    return String(nombre || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}
function codigoEmpleado(id) { return id ? "EMP-" + String(id).padStart(4, "0") : ""; }

// persona: { nombre, cargo, area, rol }  ·  opciones: { mini: true } para mostrar solo el círculo
function distintivo(persona, opciones = {}) {
    if (!persona || !persona.nombre) return '<span class="dist-vacio">—</span>';
    const hue = persona.area ? colorDe(persona.area) : (COLOR_ROL[persona.rol] ?? colorDe(persona.nombre));
    const detalle = [persona.cargo, persona.area].filter(Boolean).join(" · ") || persona.rol || "";
    const titulo = esc([persona.nombre, detalle].filter(Boolean).join(" — "));
    if (opciones.mini) {
        return `<span class="dist dist--mini" style="--h:${hue}" title="${titulo}"><span class="dist-av">${esc(inicialesDe(persona.nombre))}</span></span>`;
    }
    return `<span class="dist" style="--h:${hue}" title="${titulo}">
        <span class="dist-av">${esc(inicialesDe(persona.nombre))}</span>
        <span class="dist-tx"><b>${esc(persona.nombre)}</b>${detalle ? `<small>${esc(detalle)}</small>` : ""}</span></span>`;
}

function chipRol(rol) {
    if (!rol) return "";
    const clase = { "Administrador": "rol-admin", "Técnico": "rol-tec", "Usuario": "rol-usu" }[rol] || "rol-usu";
    return `<span class="rolchip ${clase}">${esc(rol)}</span>`;
}
