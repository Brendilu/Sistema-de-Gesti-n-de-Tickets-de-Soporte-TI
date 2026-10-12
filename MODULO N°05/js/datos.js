/* ==========================================================================
   datos.js · Datos del Módulo 5
   Simula la tabla `notificaciones`. En el sistema real estas filas vendrían
   del backend (GET /api/notificaciones) y no estarían escritas a mano aquí.
   ========================================================================== */

// Cada notificación tiene: id, tipo, mensaje, fecha y si ya fue leída.
let notificaciones = [
    {
        id: 1,
        tipo: "asignado",
        mensaje: "El ticket #204 fue asignado a Marco Ruiz.",
        fecha: "Hace 12 min",
        leida: false
    },
    {
        id: 2,
        tipo: "sla",
        mensaje: "El ticket #198 vence en menos de 1 hora.",
        fecha: "Hace 40 min",
        leida: false
    },
    {
        id: 3,
        tipo: "estado",
        mensaje: "El ticket #187 pasó a \"Resuelto\".",
        fecha: "Hace 2 h",
        leida: true
    }
];

// Título que se muestra según el tipo de evento.
const TITULOS_POR_TIPO = {
    creado: "Nuevo ticket creado",
    asignado: "Ticket asignado",
    estado: "Cambio de estado",
    sla: "SLA por vencer"
};
