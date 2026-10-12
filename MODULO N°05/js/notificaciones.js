/* ==========================================================================
   notificaciones.js · Lógica del Módulo 5 (CRUD de notificaciones)
   Orden del archivo:
     1. Referencias al DOM
     2. Dibujado (HTML de la lista, contador)
     3. Acciones CRUD: crear, leer (dibujar), actualizar y eliminar
     4. Validación del formulario
     5. Eventos
     6. Inicio
   Requiere cargar antes js/datos.js
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
const campoMensaje = document.getElementById("campo-mensaje");
const errorMensaje = document.getElementById("error-mensaje");

const LONGITUD_MINIMA_MENSAJE = 5;


/* ---------- 2. Dibujado ---------- */

// Evita que un texto escrito por el usuario se interprete como HTML.
function escaparHtml(texto) {
    const contenedor = document.createElement("div");
    contenedor.textContent = texto;
    return contenedor.innerHTML;
}

// Devuelve el HTML de una notificación (se usa en el panel y en la lista completa).
function crearHtmlNotificacion(notificacion) {
    const claseSinLeer = notificacion.leida ? "" : " notificacion--sin-leer";

    return `
        <li class="notificacion${claseSinLeer}" data-id="${notificacion.id}">
            <button type="button" class="notificacion__contenido" data-accion="leer">
                <span class="notificacion__punto"></span>
                <span>
                    <span class="notificacion__titulo">${TITULOS_POR_TIPO[notificacion.tipo]}</span>
                    <span class="notificacion__mensaje">${escaparHtml(notificacion.mensaje)}</span>
                    <span class="notificacion__fecha">${notificacion.fecha}</span>
                </span>
            </button>
            <button type="button" class="notificacion__eliminar" data-accion="eliminar"
                    aria-label="Eliminar notificación">Eliminar</button>
        </li>
    `;
}

// READ: dibuja las dos listas con los mismos datos y actualiza el contador.
function dibujarNotificaciones() {
    const html = notificaciones.length > 0
        ? notificaciones.map(crearHtmlNotificacion).join("")
        : '<li class="lista-vacia">No tienes notificaciones.</li>';

    listaPanel.innerHTML = html;
    listaCompleta.innerHTML = html;

    actualizarContador();
}

// Muestra en la campana cuántas notificaciones siguen sin leer.
function actualizarContador() {
    const sinLeer = notificaciones.filter(n => !n.leida).length;

    contadorNotificaciones.textContent = sinLeer;
    contadorNotificaciones.hidden = sinLeer === 0;
}


/* ---------- 3. Acciones CRUD ---------- */

// CREATE: agrega una notificación nueva al principio de la lista.
// En el sistema real: INSERT en la tabla notificaciones (lo hace el backend).
function crearNotificacion(tipo, mensaje) {
    const ids = notificaciones.map(n => n.id);
    const nuevoId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    notificaciones.unshift({
        id: nuevoId,
        tipo: tipo,
        mensaje: mensaje,
        fecha: "Ahora mismo",
        leida: false
    });
    dibujarNotificaciones();
}

// UPDATE individual: marca una notificación como leída.
// En el sistema real: PATCH /api/notificaciones/:id
function marcarComoLeida(id) {
    const notificacion = notificaciones.find(n => n.id === id);

    if (notificacion && !notificacion.leida) {
        notificacion.leida = true;
        dibujarNotificaciones();
    }
}

// UPDATE masivo: marca todas como leídas.
// En el sistema real: PATCH /api/notificaciones/marcar-todas
function marcarTodasComoLeidas() {
    notificaciones.forEach(n => {
        n.leida = true;
    });
    dibujarNotificaciones();
}

// DELETE individual: elimina una notificación.
// En el sistema real: DELETE /api/notificaciones/:id
function eliminarNotificacion(id) {
    notificaciones = notificaciones.filter(n => n.id !== id);
    dibujarNotificaciones();
}

// DELETE masivo: elimina todas las que ya fueron leídas.
function eliminarLeidas() {
    notificaciones = notificaciones.filter(n => !n.leida);
    dibujarNotificaciones();
}


/* ---------- 4. Validación del formulario ---------- */

// Devuelve un texto de error, o "" si el mensaje es válido.
function validarMensaje(mensaje) {
    if (mensaje === "") {
        return "Escribe un mensaje para la notificación.";
    }
    if (mensaje.length < LONGITUD_MINIMA_MENSAJE) {
        return `El mensaje debe tener al menos ${LONGITUD_MINIMA_MENSAJE} caracteres.`;
    }
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
    if (panelNotificaciones.hidden) {
        abrirPanel();
    } else {
        cerrarPanel();
    }
});

// Clic fuera del panel: se cierra.
document.addEventListener("click", (evento) => {
    const clicDentro = panelNotificaciones.contains(evento.target)
        || botonCampana.contains(evento.target);

    if (!clicDentro) {
        cerrarPanel();
    }
});

// Delegación de eventos: un solo listener por lista, aunque se agreguen
// notificaciones nuevas después.
function manejarClicEnLista(evento) {
    const boton = evento.target.closest("[data-accion]");
    if (!boton) {
        return;
    }

    const id = Number(boton.closest(".notificacion").dataset.id);

    if (boton.dataset.accion === "leer") {
        marcarComoLeida(id);
    } else if (boton.dataset.accion === "eliminar") {
        eliminarNotificacion(id);
    }
}

listaPanel.addEventListener("click", manejarClicEnLista);
listaCompleta.addEventListener("click", manejarClicEnLista);

botonMarcarTodasPanel.addEventListener("click", marcarTodasComoLeidas);
botonMarcarTodas.addEventListener("click", marcarTodasComoLeidas);
botonEliminarLeidas.addEventListener("click", eliminarLeidas);

formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const mensaje = campoMensaje.value.trim();
    const error = validarMensaje(mensaje);
    errorMensaje.textContent = error;

    if (error !== "") {
        return;
    }

    crearNotificacion(campoTipo.value, mensaje);
    campoMensaje.value = "";
    abrirPanel(); // se abre el panel para que se vea la notificación nueva
});


/* ---------- 6. Inicio ---------- */
dibujarNotificaciones();
