/* modulo4.js · SLA + semáforo visual
   Los datos vienen de GET /api/tickets: el servidor calcula el tiempo transcurrido
   (TIMESTAMPDIFF entre creado_en y ahora/cerrado_en) y el semáforo según sla_horas de la prioridad. */
const ES_ADMIN = document.querySelector(".app").dataset.esAdmin === "1";
const YO_ID = Number(document.querySelector(".app").dataset.yo);
let tickets = [];
let catalogo = null;

const ETIQUETAS = { "vencido": "Vencido", "por-vencer": "Por vencer", "en-plazo": "En plazo", "cerrado": "Cerrado" };
const CLASES = { "vencido": "r", "por-vencer": "y", "en-plazo": "g", "cerrado": "cl" };
const COLORES = { "vencido": "var(--r)", "por-vencer": "var(--y)", "en-plazo": "var(--g)", "cerrado": "#9aa7ad" };

const $ = (id) => document.getElementById(id);

function mostrarError(texto) {
    const el = $("msgError");
    el.textContent = texto ? "⚠ " + texto : "";
    el.style.display = texto ? "flex" : "none";
}

const barra = $("filtros");

function ticketsFiltrados() {
    const f = (n) => valorFiltro(barra, n);
    return tickets.filter(t =>
        coincide(f("q"), t.codigo, t.titulo, t.descripcion, t.solicitante, t.tecnico, t.area) &&
        (!f("sem") || t.semaforo === f("sem")) &&
        (!f("prioridad") || String(t.prioridad_id) === f("prioridad")) &&
        (!f("estado") || String(t.estado_id) === f("estado")) &&
        (!f("tec") || (f("tec") === "libres" ? !t.tecnico_id : String(t.tecnico_id) === f("tec"))) &&
        enRango(t.creado_en, f("desde"), f("hasta")));
}

// Acciones por fila: el admin edita/elimina; el técnico solo gestiona lo suyo o lo que no tiene dueño.
function accionesDe(t) {
    const historial = `<a class="btn sm" href="/modulo3/${t.id}">${ES_ADMIN ? "Historial" : "Gestionar"}</a>`;
    if (ES_ADMIN) {
        return `<button class="btn sm" onclick="editar(${t.id})">Editar</button>${historial}
      <button class="btn sm" onclick="pedirEliminar(${t.id})">Eliminar</button>`;
    }
    const puede = !t.tecnico_id || t.tecnico_id === YO_ID;
    return puede ? historial : '<span class="sub" title="Solo el administrador puede gestionarlo">Asignado a otro técnico</span>';
}

function render() {
    const visibles = ticketsFiltrados();
    $("resumenFiltro").textContent = `Mostrando ${visibles.length} de ${tickets.length} tickets`;

    $("ticketRows").innerHTML = visibles.map(t => `
   <tr>
    <td data-l="SLA"><span class="pill ${CLASES[t.semaforo]}">${ETIQUETAS[t.semaforo]}</span></td>
    <td data-l="Ticket"><b>${esc(t.codigo)}</b><br>${esc(t.titulo)}<br>${t.solicitante ? distintivo({ nombre: t.solicitante, cargo: t.cargo, area: t.area }, { mini: true }) + ' <small style="color:var(--mu)">' + esc(t.solicitante) + "</small>" : ""}</td>
    <td data-l="Prioridad">${esc(t.prioridad)}</td>
    <td data-l="Estado"><span class="pill">${esc(t.estado)}</span></td>
    <td data-l="Técnico">${t.tecnico ? distintivo({ nombre: t.tecnico, rol: "Técnico" }) : '<span class="sub">Sin asignar</span>'}</td>
    <td data-l="Tiempo">
     ${formatearHoras(t.segundos / 3600)} de ${t.sla_horas} h
     <div class="pb"><i style="width:${t.porcentaje}%;background:${COLORES[t.semaforo]}"></i></div>
    </td>
    <td data-l="Acciones"><div class="acciones">${accionesDe(t)}</div></td>
   </tr>`).join("") || '<tr><td colspan="7" style="text-align:center;color:var(--mu)">No hay tickets para mostrar.</td></tr>';

    const vencidos = tickets.filter(t => t.semaforo === "vencido").length;
    const porVencer = tickets.filter(t => t.semaforo === "por-vencer").length;
    const alerta = $("alertaSLA");
    if (vencidos + porVencer > 0) {
        alerta.style.display = "flex";
        alerta.textContent = `⚠ ${vencidos} ticket(s) fuera de plazo y ${porVencer} por vencer.`;
    } else {
        alerta.style.display = "none";
    }
    $("resumenTop").textContent = `${tickets.length} tickets · ${vencidos} vencidos`;
}

async function cargar() {
    try {
        tickets = await api("/api/tickets");
        mostrarError("");
        render();
    } catch (e) { mostrarError(e.message); }
}

// ---------- Formulario (crear / editar) ----------
function limpiarErrores() {
    ["errorTitulo", "errorDescripcion", "errorSolicitante"].forEach(i => $(i).textContent = "");
}

function resetFormulario() {
    $("formTicket").reset();
    $("ticketId").value = "";
    $("tituloFormulario").textContent = "Nuevo ticket";
    $("btnGuardar").textContent = "Crear ticket";
    $("btnCancelar").hidden = true;
    $("ticketPrioridad").value = (catalogo.prioridades.find(p => p.nombre === "Media") || catalogo.prioridades[0]).id;
    $("ticketEstado").value = (catalogo.estados.find(e => e.nombre === "Abierto") || catalogo.estados[0]).id;
    limpiarErrores();
}

function editar(id) {
    const t = tickets.find(x => x.id === id);
    $("ticketId").value = t.id;
    $("ticketTitulo").value = t.titulo;
    $("ticketDescripcion").value = t.descripcion;
    $("ticketSolicitante").value = t.solicitante_id || "";
    $("ticketPrioridad").value = t.prioridad_id;
    $("ticketTecnico").value = t.tecnico_id || "";
    $("ticketEstado").value = t.estado_id;
    $("tituloFormulario").textContent = `Editar ${t.codigo}`;
    $("btnGuardar").textContent = "Guardar cambios";
    $("btnCancelar").hidden = false;
    limpiarErrores();
    $("formTicket").scrollIntoView({ behavior: "smooth", block: "center" });
}

$("btnCancelar").addEventListener("click", resetFormulario);

$("formTicket").addEventListener("submit", async (e) => {
    e.preventDefault();
    limpiarErrores();
    const titulo = $("ticketTitulo").value.trim();
    const descripcion = $("ticketDescripcion").value.trim();
    let valido = true;
    if (titulo.length < 5) { $("errorTitulo").textContent = "El título debe tener al menos 5 caracteres."; valido = false; }
    if (!descripcion) { $("errorDescripcion").textContent = "La descripción es obligatoria."; valido = false; }
    if (!$("ticketSolicitante").value) { $("errorSolicitante").textContent = "Selecciona un solicitante."; valido = false; }
    if (!valido) return;

    const datos = {
        titulo, descripcion,
        solicitante_id: $("ticketSolicitante").value,
        prioridad_id: $("ticketPrioridad").value,
        tecnico_id: $("ticketTecnico").value || null,
        estado_id: $("ticketEstado").value
    };
    const id = $("ticketId").value;
    try {
        if (id) await api(`/api/tickets/${id}`, { method: "PUT", json: datos });
        else await api("/api/tickets", { method: "POST", json: datos });
    } catch (err) { mostrarError(err.message); return; }
    resetFormulario();
    await cargar();
});

// ---------- Eliminar (solo administrador) ----------
let idAEliminar = null;
function pedirEliminar(id) {
    const t = tickets.find(x => x.id === id);
    idAEliminar = id;
    $("dialogoMensaje").textContent = `Se eliminará ${t.codigo} · ${t.titulo} junto con su historial y fotos. Esta acción no se puede deshacer.`;
    $("dialogoEliminar").showModal();
}
$("dialogoEliminar").addEventListener("close", async () => {
    if ($("dialogoEliminar").returnValue !== "confirmar" || idAEliminar === null) return;
    try {
        await api(`/api/tickets/${idAEliminar}`, { method: "DELETE" });
        if ($("ticketId").value === String(idAEliminar)) resetFormulario();
    } catch (e) { mostrarError(e.message); }
    idAEliminar = null;
    cargar();
});


// ---------- Inicio ----------
(async function () {
    catalogo = await cargarCatalogos();
    llenarSelect($("ticketSolicitante"), catalogo.empleados, "id",
        e => `${e.nombre_completo}${e.area ? " · " + e.area : ""}`, "— Selecciona un empleado —");
    llenarSelect($("ticketPrioridad"), catalogo.prioridades, "id", p => `${p.nombre} (${p.sla_horas} h)`);
    llenarSelect($("ticketTecnico"), catalogo.tecnicos, "id", "nombre", "Sin asignar");
    llenarSelect($("ticketEstado"), catalogo.estados, "id", "nombre");
    llenarSelect($("f-prioridad"), catalogo.prioridades, "id", "nombre", "Todas");
    llenarSelect($("f-estado"), catalogo.estados, "id", "nombre", "Todos");
    llenarSelect($("f-tec"), [{ id: "libres", nombre: "Sin asignar" }, ...catalogo.tecnicos], "id", "nombre", "Todos");
    conectarFiltros(barra, render);
    resetFormulario();
    await cargar();
    setInterval(cargar, 30000);   // refresca el semáforo contra la BD cada 30 s
})();
