// Simula la tabla `ticket_historial`. Cada fila queda registrada con
// técnico, estado anterior → nuevo, comentario y fecha/hora.
let historial = [
 {de:"Nuevo", a:"Abierto", tecnico:"Sistema", comentario:"Ticket registrado.", fecha:"30/09 08:15"},
 {de:"Abierto", a:"En proceso", tecnico:"Ana Ruiz", comentario:"Se revisó el switch del piso 3.", fecha:"30/09 10:42"}
];

let estadoActual = "En proceso";

function renderTimeline(){
 const cont = document.getElementById("timeline");
 cont.innerHTML = historial.slice().reverse().map(h => `
  <div class="ev">
   <b>${h.de} → ${h.a}</b>
   <small>${h.tecnico} · ${h.fecha}</small>
   <p>${h.comentario}</p>
  </div>
 `).join("");
 document.getElementById("estadoActualPill").textContent = estadoActual;
}

function guardarCambio(){
 const tecnico = document.getElementById("tecnico").value;
 const nuevoEstado = document.getElementById("estado").value;
 const comentario = document.getElementById("comentario").value.trim();
 const err = document.getElementById("comentarioErr");
 const ok = document.getElementById("okMsg");

 // Validación obligatoria antes del UPDATE: sin comentario no hay cambio de estado.
 if(comentario === ""){
  err.textContent = "El comentario es obligatorio para registrar un cambio de estado.";
  ok.classList.remove("on");
  return;
 }
 err.textContent = "";

 // En el backend real: INSERT en ticket_historial + UPDATE del estado en tickets,
 // dentro de una misma transacción.
 historial.push({
  de: estadoActual,
  a: nuevoEstado,
  tecnico: tecnico,
  comentario: comentario,
  fecha: "Ahora mismo"
 });
 estadoActual = nuevoEstado;

 renderTimeline();
 document.getElementById("comentario").value = "";
 ok.classList.add("on");
 setTimeout(() => ok.classList.remove("on"), 2500);
}

renderTimeline();
