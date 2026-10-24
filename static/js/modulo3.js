/* modulo3.js · Asignación + historial de estados
   GET /api/tickets · GET /api/tickets/:id · POST /api/tickets/:id/gestion · GET /api/historial
   Reglas (las valida el servidor):
   - El administrador gestiona cualquier ticket y ve el historial de todos.
   - Un técnico solo gestiona tickets suyos o sin asignar (al gestionarlo queda a su nombre)
     y solo ve en el historial las acciones que hizo él mismo. */
const contenido = document.getElementById("contenido");
const ticketId = Number(contenido.dataset.ticketId);
const ES_ADMIN = contenido.dataset.rol === "1";
let ticket = null;
let yo = null;
let catalogo = null;
let todos = [];

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------ buscador de tickets ---- */
const barraTicket = $("filtrosTicket");

function ticketsFiltrados() {
    const f = (n) => valorFiltro(barraTicket, n);
    return todos.filter(t =>
        coincide(f("q"), t.codigo, t.titulo, t.solicitante, t.tecnico, t.area) &&
        (!f("estado") || String(t.estado_id) === f("estado")) &&
        (!f("prioridad") || String(t.prioridad_id) === f("prioridad")) &&
        (!f("tec") || (f("tec") === "libres" ? !t.tecnico_id : String(t.tecnico_id) === f("tec"))) &&
        enRango(t.creado_en, f("desde"), f("hasta")));
}

function renderResultados() {
    const lista = ticketsFiltrados();
    $("resumenBusqueda").textContent = `Mostrando ${lista.length} de ${todos.length} tickets`;
    $("resultados").innerHTML = lista.map(t => `
     <li class="${t.id === ticketId ? "sel" : ""}"><a href="/modulo3/${t.id}">
      <b>${esc(t.codigo)}</b>
      <span class="rt">${esc(t.titulo)}<small>${esc(t.solicitante || "Sin solicitante")} · ${esc(formatearFecha(t.creado_en))}</small></span>
      <span class="pill">${esc(t.estado)}</span>
      <span class="rc">${t.tecnico ? distintivo({ nombre: t.tecnico, rol: "Técnico" }, { mini: true }) + " " + esc(t.tecnico) : '<span class="dist-vacio">Sin asignar</span>'}</span>
     </a></li>`).join("") || '<li class="res-vacio">Ningún ticket coincide con la búsqueda.</li>';
}

/* ------------------------------------------------ ticket elegido ---- */
function renderTimeline() {
    const cont = $("timeline");
    const aviso = $("avisoHist");
    if (ticket.historial_alcance === "propio") {
        aviso.hidden = false;
        aviso.textContent = "Por privacidad solo ves las acciones que hiciste tú en este ticket.";
    } else {
        aviso.hidden = true;
    }
    cont.innerHTML = ticket.historial.slice().reverse().map(h => `
  <div class="ev">
   <b>${esc(h.estado_anterior || "Nuevo registro")} → ${esc(h.estado_nuevo)}</b>
   <div class="quien">${distintivo({ nombre: h.usuario, cargo: h.cargo, area: h.area, rol: h.rol }, { mini: true })}
     <small>${esc(h.usuario)} · ${esc(formatearFecha(h.fecha))}</small> ${chipRol(h.rol)}</div>
   <p>${esc(h.comentario)}</p>
  </div>`).join("") || "<p>Todavía no hay acciones tuyas en este ticket.</p>";
    $("estadoActualPill").textContent = ticket.estado;
}

function renderCabecera() {
    $("tituloTop").textContent = `${ticket.codigo} · ${ticket.titulo}`;
    $("ticketTitulo").textContent = `${ticket.codigo} · ${ticket.titulo}`;
    $("ticketSub").textContent =
        `Solicitado por ${ticket.solicitante || "—"}${ticket.area ? " · " + ticket.area : ""} · ${formatearFecha(ticket.creado_en)} · Prioridad ${ticket.prioridad}`;
}

// Quién puede tocar qué: el panel se bloquea si el ticket es de otro técnico.
function renderPanelGestion() {
    $("gestor").innerHTML = `${distintivo({ nombre: yo.nombre, cargo: yo.cargo, area: yo.area, rol: yo.rol })}${chipRol(yo.rol)}`;
    const puede = ticket.puede_gestionar;
    const bloqueo = $("bloqueo");
    bloqueo.hidden = puede;
    if (!puede) {
        bloqueo.textContent = `Este ticket está asignado a ${ticket.tecnico || "otro técnico"}. Solo el administrador puede gestionarlo.`;
    }
    ["tecnico", "estado", "comentario", "btnGuardar"].forEach(id => { $(id).disabled = !puede; });

    const nota = $("notaTecnico");
    if (ES_ADMIN) {
        nota.hidden = true;
        $("tecnico").disabled = false;
        $("tecnico").value = ticket.tecnico_id || "";
    } else {
        // El técnico no elige: al guardar, el ticket queda a su nombre.
        const titular = puede ? { id: yo.id, nombre: yo.nombre } : { id: ticket.tecnico_id, nombre: ticket.tecnico || "Otro técnico" };
        $("tecnico").innerHTML = `<option value="${titular.id}">${esc(titular.nombre)}</option>`;
        $("tecnico").value = titular.id;
        $("tecnico").disabled = true;
        nota.hidden = false;
        nota.textContent = ticket.tecnico_id === yo.id
            ? "Este ticket es tuyo."
            : ticket.tecnico_id ? "" : "Está sin asignar: al guardar quedará a tu nombre.";
    }
    $("estado").value = ticket.estado_id;
}

async function cargarTicket() {
    ticket = await api(`/api/tickets/${ticketId}`);
    renderCabecera();
    renderTimeline();
    renderPanelGestion();
}

async function guardarCambio() {
    const err = $("comentarioErr");
    const ok = $("okMsg");
    const comentario = $("comentario").value.trim();
    if (comentario === "") {
        err.textContent = "El comentario es obligatorio para registrar un cambio.";
        ok.classList.remove("on");
        return;
    }
    err.textContent = "";
    try {
        await api(`/api/tickets/${ticketId}/gestion`, {
            method: "POST",
            json: {
                tecnico_id: ES_ADMIN ? ($("tecnico").value || null) : yo.id,
                estado_id: Number($("estado").value),
                comentario
            }
        });
    } catch (e) {
        err.textContent = e.message;
        ok.classList.remove("on");
        return;
    }
    $("comentario").value = "";
    await cargarTicket();
    todos = await api("/api/tickets");
    renderResultados();
    cargarHistorial();
    ok.classList.add("on");
    setTimeout(() => ok.classList.remove("on"), 2500);
}

/* ------------------------------------------------ historial de acciones ---- */
const barraHist = $("filtrosHist");

async function cargarHistorial() {
    const p = new URLSearchParams();
    ["q", "usuario_id", "estado_id", "desde", "hasta"].forEach(n => {
        const v = valorFiltro(barraHist, n);
        if (v) p.set(n, v);
    });
    let filas;
    try {
        filas = await api("/api/historial?" + p.toString());
    } catch (e) {
        $("filasHist").innerHTML = `<tr><td colspan="5">${esc(e.message)}</td></tr>`;
        return;
    }
    $("resumenHist").textContent = filas.length >= 300
        ? "Mostrando las 300 acciones más recientes. Usa los filtros para acotar."
        : `${filas.length} acción(es)`;
    $("filasHist").innerHTML = filas.map(h => `
     <tr>
      <td data-l="Fecha">${esc(formatearFecha(h.fecha))}</td>
      <td data-l="Quién">${distintivo({ nombre: h.usuario, cargo: h.cargo, area: h.area, rol: h.rol })} ${chipRol(h.rol)}</td>
      <td data-l="Ticket"><a href="/modulo3/${h.ticket_id}"><b>${esc(h.codigo)}</b></a><br><small>${esc(h.titulo)}</small></td>
      <td data-l="Cambio">${esc(h.estado_anterior || "Nuevo")} <span class="flecha">→</span> <b>${esc(h.estado_nuevo)}</b></td>
      <td data-l="Comentario" class="cmt">${esc(h.comentario)}</td>
     </tr>`).join("") || '<tr><td colspan="5" style="text-align:center;color:var(--mu)">No hay acciones para mostrar.</td></tr>';
}

/* ------------------------------------------------ inicio ---- */
async function iniciar() {
    catalogo = await cargarCatalogos();
    yo = catalogo.yo;

    llenarSelect($("tecnico"), catalogo.tecnicos, "id", "nombre", "Sin asignar");
    llenarSelect($("estado"), catalogo.estados, "id", "nombre");

    // Filtros del buscador
    llenarSelect($("b-estado"), catalogo.estados, "id", "nombre", "Todos los estados");
    llenarSelect($("b-prioridad"), catalogo.prioridades, "id", "nombre", "Todas las prioridades");
    const opcionesTec = ES_ADMIN
        ? [{ id: "libres", nombre: "Sin asignar" }, ...catalogo.tecnicos]
        : [{ id: yo.id, nombre: "Asignados a mí" }, { id: "libres", nombre: "Sin asignar" }];
    llenarSelect($("b-tec"), opcionesTec, "id", "nombre", "Todos");
    conectarFiltros(barraTicket, renderResultados);

    // Filtros del historial de acciones (la persona solo la elige el administrador)
    llenarSelect($("h-estado"), catalogo.estados, "id", "nombre", "Cualquiera");
    if (ES_ADMIN) {
        $("h-persona-grupo").hidden = false;
        llenarSelect($("h-persona"), catalogo.tecnicos, "id", p => `${p.nombre} (${p.rol})`, "Todas las personas");
        $("tituloHistorial").textContent = "Historial de acciones de todos los técnicos";
        $("subHistorial").textContent = "Como administrador ves lo que hizo cada persona. Filtra por persona, estado o fecha.";
    } else {
        $("tituloHistorial").textContent = "Mi historial de acciones";
        $("subHistorial").textContent = "Aquí solo aparecen las acciones que hiciste tú. El historial de otros técnicos no es visible.";
    }
    conectarFiltros(barraHist, cargarHistorial);

    todos = await api("/api/tickets");
    renderResultados();
    cargarHistorial();

    if (ticketId) {
        $("zonaTicket").hidden = false;
        try {
            await cargarTicket();
        } catch (e) {
            $("zonaTicket").hidden = true;
            $("resumenBusqueda").textContent = e.message;
        }
        $("btnGuardar").addEventListener("click", guardarCambio);
    }
}

iniciar();
