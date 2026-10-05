// Simula la tabla `notificaciones`. En el backend real se consultaría con
// GET /api/notificaciones/contador (cada 30 s) y GET /api/notificaciones.
let notifs = [
    { id: 1, tipo: "asignado", titulo: "Ticket asignado", msg: "El ticket #204 fue asignado a Marco Ruiz.", fecha: "Hace 12 min", leida: false },
    { id: 2, tipo: "sla", titulo: "SLA por vencer", msg: "El ticket #198 vence en menos de 1 hora.", fecha: "Hace 40 min", leida: false },
    { id: 3, tipo: "estado", titulo: "Cambio de estado", msg: 'El ticket #187 pasó a "Resuelto".', fecha: "Hace 2 h", leida: true }
];

const textos = {
    creado: { t: "Nuevo ticket creado", m: 'Se registró el ticket #212: "Impresora no responde".' },
    asignado: { t: "Ticket asignado", m: "El ticket #212 fue asignado a Lucía Torres." },
    estado: { t: "Cambio de estado", m: 'El ticket #205 pasó a "En proceso".' },
    sla: { t: "SLA por vencer", m: "El ticket #199 vence en 30 minutos." }
};

const dd = document.getElementById("dd");
const bell = document.getElementById("bell");
const cnt = document.getElementById("cnt");
const ddl = document.getElementById("ddl");   // lista dentro del panel de la campana
const nl = document.getElementById("nl");     // lista completa en el contenido de la página

function itemHTML(n) {
    return `
  <button class="nt ${n.leida ? "" : "un"}" data-id="${n.id}">
   <span class="dot"></span>
   <span><b>${n.titulo}</b><small>${n.msg}</small><br><small>${n.fecha}</small></span>
  </button>
 `;
}

function render() {
    const html = notifs.length
        ? notifs.map(itemHTML).join("")
        : '<p class="empty-state">No tienes notificaciones.</p>';

    ddl.innerHTML = html;
    nl.innerHTML = html;

    const noLeidas = notifs.filter(n => !n.leida).length;
    cnt.textContent = noLeidas;
    cnt.style.display = noLeidas ? "" : "none";
}

function marcarLeida(id) {
    // PATCH /api/notificaciones/:id { leida: true }
    const n = notifs.find(x => x.id === id);
    if (n && !n.leida) { n.leida = true; render(); }
}

function marcarTodas() {
    // PATCH /api/notificaciones/marcar-todas
    notifs.forEach(n => n.leida = true);
    render();
}

function generar(tipo) {
    const base = textos[tipo];
    notifs.unshift({ id: Date.now(), tipo, titulo: base.t, msg: base.m, fecha: "Ahora mismo", leida: false });
    render();
    dd.classList.add("on");
}

bell.addEventListener("click", e => { e.stopPropagation(); dd.classList.toggle("on"); });
document.addEventListener("click", e => { if (!dd.contains(e.target) && !bell.contains(e.target)) dd.classList.remove("on"); });

document.getElementById("marcarTodas").addEventListener("click", marcarTodas);
document.getElementById("marcarTodasDd").addEventListener("click", marcarTodas);

// Delegación de clicks tanto en el panel desplegable como en la lista completa
[ddl, nl].forEach(cont => {
    cont.addEventListener("click", e => {
        const b = e.target.closest(".nt");
        if (b) marcarLeida(Number(b.dataset.id));
    });
});

document.querySelectorAll("[data-tipo]").forEach(b => b.addEventListener("click", () => generar(b.dataset.tipo)));

render();