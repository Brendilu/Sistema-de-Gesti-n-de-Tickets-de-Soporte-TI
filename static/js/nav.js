/* nav.js · Contador de notificaciones sin leer en el menú (AJAX cada 30 s). */
(function () {
    const marcas = document.querySelectorAll("[data-contador-notif]");
    if (!marcas.length) return;

    async function actualizar() {
        try {
            const { sin_leer } = await api("/api/notificaciones/contador");
            marcas.forEach(m => { m.textContent = sin_leer; m.hidden = sin_leer === 0; });
        } catch (e) { /* sin conexión: se deja el valor anterior */ }
    }
    actualizar();
    setInterval(actualizar, 30000);
})();
