const LIMITES = { "Alta": 4, "Media": 24, "Baja": 72 };

function horasAtras(h) {
    return new Date(Date.now() - h * 60 * 60 * 1000);
}

let tickets = [
    { codigo: "TCK-0042", titulo: "Caída de red en sede Lima", prioridad: "Alta", tecnico: "Ana Ruiz", estado: "En proceso", creado: horasAtras(5.17) },
    { codigo: "TCK-0045", titulo: "Impresora de contabilidad", prioridad: "Media", tecnico: "Sin asignar", estado: "Abierto", creado: horasAtras(20) },
    { codigo: "TCK-0047", titulo: "Instalación de software", prioridad: "Baja", tecnico: "Carlos Vega", estado: "Abierto", creado: horasAtras(6) }
];

function formatearHoras(hDecimal) {
    const h = Math.floor(hDecimal);
    const m = Math.round((hDecimal - h) * 60);
    if (h === 0) return `${m} min`;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function calcularSLA(ticket) {
    const limite = LIMITES[ticket.prioridad];
    const horasTranscurridas = (Date.now() - ticket.creado.getTime()) / (1000 * 60 * 60);
    const porcentaje = Math.min((horasTranscurridas / limite) * 100, 100);

    let clase, etiqueta;
    if (horasTranscurridas >= limite) {
        clase = "r"; etiqueta = "Vencido";
    } else if (horasTranscurridas / limite >= 0.8) {
        clase = "y"; etiqueta = "Por vencer";
    } else {
        clase = "g"; etiqueta = "En plazo";
    }

    return { limite, horasTranscurridas, porcentaje, clase, etiqueta };
}

function render() {
    const filas = tickets.map(t => {
        const sla = calcularSLA(t);
        return `
   <tr>
    <td><span class="pill ${sla.clase}">${sla.etiqueta}</span></td>
    <td><b>${t.codigo}</b><br>${t.titulo}</td>
    <td>${t.prioridad}</td>
    <td><span class="pill">${t.estado}</span></td>
    <td>${t.tecnico}</td>
    <td>
     ${formatearHoras(sla.horasTranscurridas)} de ${sla.limite} h
     <div class="pb"><i style="width:${sla.porcentaje}%;background:${sla.clase === 'r' ? 'var(--r)' : sla.clase === 'y' ? 'var(--y)' : 'var(--g)'}"></i></div>
    </td>
   </tr>
  `;
    }).join("");

    document.getElementById("ticketRows").innerHTML = filas;

    const vencidos = tickets.filter(t => calcularSLA(t).clase === "r").length;
    const porVencer = tickets.filter(t => calcularSLA(t).clase === "y").length;

    const alerta = document.getElementById("alertaSLA");
    if (vencidos + porVencer > 0) {
        alerta.style.display = "flex";
        alerta.textContent = `⚠ ${vencidos} ticket(s) fuera de plazo y ${porVencer} por vencer.`;
    } else {
        alerta.style.display = "none";
    }

    document.getElementById("resumenTop").textContent = `${tickets.length} tickets · ${vencidos} vencidos`;
}

render();
setInterval(render, 30000);
