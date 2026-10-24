/* ==========================================================================
   modulo5.js · Notificaciones internas (CRUD contra la tabla notificaciones)
   GET /api/notificaciones · POST /api/notificaciones
   PATCH /api/notificaciones/:id/leer · PATCH /api/notificaciones/marcar-todas
   DELETE /api/notificaciones/:id · DELETE /api/notificaciones/leidas
   ========================================================================== */

/* ---------- 1. Referencias al DOM ---------- */
const botonCampana = document.getElementById("boton-campana");
const contadorNotificaciones = document.getElementById("contador-notificaciones");
const panelNotificaciones = document.getElementById("panel-notificaciones");
const listaPanel = document.getElementById("lista-panel");
const listaCompleta = document.getElementById("lista-completa");

const botonMarcarTodasPanel = document.getElementById("boton-marcar-todas-panel");
const botonMarcarTodas = document.getElementById("boton-marcar-todas");
const botonEliminarLeidas = document.getElementById("boton-eliminar-leidas");

const formulario = document.getElementById("formulario-notificacion");
const campoTipo = document.getElementById("campo-tipo");
const campoTicket = document.getElementById("campo-ticket");
const campoMensaje = document.getElementById("campo-mensaje");
const errorMensaje = document.getElementById("error-mensaje");

const LONGITUD_MINIMA_MENSAJE = 5;
let notificaciones = [];   // filas de la tabla notificaciones del usuario en sesión


/* ---------- 2. Dibujado ---------- */
function crearHtmlNotificacion(n) {
    const claseSinLeer = n.leida ? "" : " notificacion--sin-leer";
    const ticket = n.ticket ? ` · ${esc(n.ticket)}` : "";
    return `
        <li class="notificacion${claseSinLeer}" data-id="${n.id}">
            <button type="button" class="notificacion__contenido" data-accion="leer">
                <span class="notificacion__punto"></span>
                <span>
                    <span class="notificacion__titulo">${esc(n.titulo)}</span>
                    <span class="notificacion__mensaje">${esc(n.mensaje)}</span>
                    <span class="notificacion__fecha">${haceTiempo(n.hace_segundos)}${ticket}</span>
                </span>
            </button>
            <button type="button" class="notificacion__eliminar" data-accion="eliminar"
                    aria-label="Eliminar notificación">Eliminar</button>
        </li>`;
}

const barraFiltros = document.getElementById("filtros");

// La lista completa se puede filtrar; el panel de la campana siempre muestra todo.
function notificacionesFiltradas() {
    const f = (n) => valorFiltro(barraFiltros, n);
    return notificaciones.filter(n =>
        coincide(f("q"), n.titulo, n.mensaje, n.ticket) &&
        (!f("tipo") || n.tipo === f("tipo")) &&
        (!f("leida") || (f("leida") === "si") === n.leida) &&
        enRango(n.creada_en, f("desde"), f("hasta")));
}

function dibujarNotificaciones() {
    const html = notificaciones.length > 0
        ? notificaciones.map(crearHtmlNotificacion).join("")
        : '<li class="lista-vacia">No tienes notificaciones.</li>';
    listaPanel.innerHTML = html;
    const filtradas = notificacionesFiltradas();
    document.getElementById("resumenFiltro").textContent =
        notificaciones.length ? `Mostrando ${filtradas.length} de ${notificaciones.length} notificaciones` : "";
    listaCompleta.innerHTML = filtradas.length > 0
        ? filtradas.map(crearHtmlNotificacion).join("")
        : `<li class="lista-vacia">${notificaciones.length ? "Ninguna notificación coincide con los filtros." : "No tienes notificaciones."}</li>`;
    actualizarContador();
}

function actualizarContador() {
    const sinLeer = notificaciones.filter(n => !n.leida).length;
    contadorNotificaciones.textContent = sinLeer;
    contadorNotificaciones.hidden = sinLeer === 0;
}


/* ---------- 3. Acciones CRUD (llaman a la API y recargan desde la BD) ---------- */
async function cargarNotificaciones() {
    try {
        notificaciones = await api("/api/notificaciones");
    } catch (e) {
        listaCompleta.innerHTML = `<li class="lista-vacia">${esc(e.message)}</li>`;
        return;
    }
    dibujarNotificaciones();
}

async function ejecutar(url, metodo, json) {
    try {
        await api(url, { method: metodo, json });
    } catch (e) {
        errorMensaje.textContent = e.message;
    }
    await cargarNotificaciones();
}

const crearNotificacion = (tipo, mensaje, ticketId) =>
    api("/api/notificaciones", { method: "POST", json: { tipo, mensaje, ticket_id: ticketId || null } });
const marcarComoLeida = (id) => ejecutar(`/api/notificaciones/${id}/leer`, "PATCH");
const marcarTodasComoLeidas = () => ejecutar("/api/notificaciones/marcar-todas", "PATCH");
const eliminarNotificacion = (id) => ejecutar(`/api/notificaciones/${id}`, "DELETE");
const eliminarLeidas = () => ejecutar("/api/notificaciones/leidas", "DELETE");


/* ---------- 4. Validación del formulario ---------- */
function validarMensaje(mensaje) {
    if (mensaje === "") return "Escribe un mensaje para la notificación.";
    if (mensaje.length < LONGITUD_MINIMA_MENSAJE)
        return `El mensaje debe tener al menos ${LONGITUD_MINIMA_MENSAJE} caracteres.`;
    return "";
}


/* ---------- 5. Eventos ---------- */
function abrirPanel() {
    panelNotificaciones.hidden = false;
    botonCampana.setAttribute("aria-expanded", "true");
}

function cerrarPanel() {
    panelNotificaciones.hidden = true;
    botonCampana.setAttribute("aria-expanded", "false");
}

botonCampana.addEventListener("click", (evento) => {
    evento.stopPropagation();
    if (panelNotificaciones.hidden) abrirPanel(); else cerrarPanel();
});

document.addEventListener("click", (evento) => {
    const clicDentro = panelNotificaciones.contains(evento.target) || botonCampana.contains(evento.target);
    if (!clicDentro) cerrarPanel();
});

function manejarClicEnLista(evento) {
    const boton = evento.target.closest("[data-accion]");
    if (!boton) return;
    const id = Number(boton.closest(".notificacion").dataset.id);
    if (boton.dataset.accion === "leer") marcarComoLeida(id);
    else if (boton.dataset.accion === "eliminar") eliminarNotificacion(id);
}

listaPanel.addEventListener("click", manejarClicEnLista);
listaCompleta.addEventListener("click", manejarClicEnLista);
botonMarcarTodasPanel.addEventListener("click", marcarTodasComoLeidas);
botonMarcarTodas.addEventListener("click", marcarTodasComoLeidas);
botonEliminarLeidas.addEventListener("click", eliminarLeidas);

formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const mensaje = campoMensaje.value.trim();
    const error = validarMensaje(mensaje);
    errorMensaje.textContent = error;
    if (error !== "") return;

    try {
        await crearNotificacion(campoTipo.value, mensaje, campoTicket.value);
    } catch (e) {
        errorMensaje.textContent = e.message;
        return;
    }
    campoMensaje.value = "";
    await cargarNotificaciones();
    abrirPanel();
});


/* ---------- 6. Inicio ---------- */
conectarFiltros(barraFiltros, dibujarNotificaciones);
(async function () {
    const tickets = await api("/api/tickets").catch(() => []);
    llenarSelect(campoTicket, tickets, "id", t => `${t.codigo} · ${t.titulo}`, "— Ninguno —");
    await cargarNotificaciones();
    setInterval(cargarNotificaciones, 30000);   // el contador de la campana se refresca desde la BD
})();
