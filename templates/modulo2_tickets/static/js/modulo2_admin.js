/* modulo2_admin.js · CRUD de tickets contra la BD
   GET /api/tickets · POST /api/tickets · PUT /api/tickets/:id · DELETE /api/tickets/:id */
document.addEventListener('DOMContentLoaded', async () => {
    const ticketForm = document.getElementById('ticket-form');
    const ticketsTbody = document.getElementById('tickets-tbody');
    const ticketModal = document.getElementById('ticket-modal');
    const btnNuevo = document.getElementById('btn-nuevo');
    const modalClose = document.getElementById('modal-close');
    const btnCancel = document.getElementById('btn-cancel');
    const modalTitle = document.getElementById('modal-title');
    const msgError = document.getElementById('msg-error');
    const formError = document.getElementById('form-error');

    const ticketIdInput = document.getElementById('ticket-id');
    const codigoInput = document.getElementById('codigo');
    const tituloInput = document.getElementById('titulo');
    const descripcionInput = document.getElementById('descripcion');
    const prioridadSelect = document.getElementById('prioridad_id');
    const estadoSelect = document.getElementById('estado_id');
    const solicitanteSelect = document.getElementById('solicitante_id');
    const tecnicoSelect = document.getElementById('tecnico_id');
    const comentarioInput = document.getElementById('comentario');
    const grupoComentario = document.getElementById('grupo-comentario');

    let tickets = [];

    function mostrar(el, texto) {
        el.textContent = texto || '';
        el.hidden = !texto;
    }

    // Selects llenados desde la BD (prioridades, estados, empleados, usuarios técnico/admin)
    const cat = await cargarCatalogos();
    llenarSelect(prioridadSelect, cat.prioridades, 'id', p => `${p.nombre} (SLA: ${p.sla_horas}h)`);
    llenarSelect(estadoSelect, cat.estados, 'id', 'nombre');
    llenarSelect(solicitanteSelect, cat.empleados, 'id', e => `${e.nombre_completo}${e.area ? ' · ' + e.area : ''}`);
    llenarSelect(tecnicoSelect, cat.tecnicos, 'id', 'nombre', 'Sin asignar');

    // Filtros: buscar, estado, prioridad, técnico y fechas
    const barra = document.getElementById('filtros');
    llenarSelect(document.getElementById('f-estado'), cat.estados, 'id', 'nombre', 'Todos los estados');
    llenarSelect(document.getElementById('f-prioridad'), cat.prioridades, 'id', 'nombre', 'Todas las prioridades');
    llenarSelect(document.getElementById('f-tecnico'),
        [{ id: 'libres', nombre: 'Sin asignar' }, ...cat.tecnicos], 'id', 'nombre', 'Todos los técnicos');
    function filtrados() {
        const f = n => valorFiltro(barra, n);
        return tickets.filter(t =>
            coincide(f('q'), t.codigo, t.titulo, t.descripcion, t.solicitante, t.tecnico, t.area) &&
            (!f('estado') || String(t.estado_id) === f('estado')) &&
            (!f('prioridad') || String(t.prioridad_id) === f('prioridad')) &&
            (!f('tecnico') || (f('tecnico') === 'libres' ? !t.tecnico_id : String(t.tecnico_id) === f('tecnico'))) &&
            enRango(t.creado_en, f('desde'), f('hasta')));
    }

    async function cargar() {
        try {
            tickets = await api('/api/tickets');
            mostrar(msgError, '');
        } catch (e) {
            mostrar(msgError, e.message);
            return;
        }
        renderTickets();
    }

    function renderTickets() {
        const lista = filtrados();
        document.getElementById('resumen-filtro').textContent =
            tickets.length ? `Mostrando ${lista.length} de ${tickets.length} tickets` : '';
        if (tickets.length === 0) {
            ticketsTbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No hay tickets registrados en el sistema.</td></tr>`;
            return;
        }
        if (lista.length === 0) {
            ticketsTbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Ningún ticket coincide con los filtros.</td></tr>`;
            return;
        }
        ticketsTbody.innerHTML = lista.map(t => `
            <tr>
                <td data-l="Código"><strong>${esc(t.codigo)}</strong></td>
                <td data-l="Título">${esc(t.titulo)}</td>
                <td data-l="Prioridad">${esc(t.prioridad)}</td>
                <td data-l="Estado">${esc(t.estado)}</td>
                <td data-l="Solicitante">${distintivo({ nombre: t.solicitante, cargo: t.cargo, area: t.area })}</td>
                <td data-l="Técnico">${t.tecnico ? esc(t.tecnico) : 'Sin asignar'}</td>
                <td data-l="Acciones"><div class="acc">
                    <button class="btn-edit" onclick="editarTicket(${t.id})">Modificar</button>
                    <a class="btn-edit" href="/modulo3/${t.id}" style="text-decoration:none">Historial</a>
                    <button class="btn-delete" onclick="eliminarTicket(${t.id})">Eliminar</button>
                </div></td>
            </tr>`).join('');
    }

    function resetForm() {
        ticketForm.reset();
        ticketIdInput.value = '';
        mostrar(formError, '');
    }

    btnNuevo.addEventListener('click', () => {
        resetForm();
        const media = cat.prioridades.find(p => p.nombre === 'Media') || cat.prioridades[0];
        prioridadSelect.value = media.id;
        estadoSelect.value = (cat.estados.find(e => e.nombre === 'Abierto') || cat.estados[0]).id;
        grupoComentario.hidden = true;
        modalTitle.textContent = 'Registrar Nuevo Ticket';
        ticketModal.style.display = 'flex';
    });

    function closeModal() {
        ticketModal.style.display = 'none';
        resetForm();
    }
    modalClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    ticketForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        mostrar(formError, '');
        const id = ticketIdInput.value;
        const datos = {
            titulo: tituloInput.value.trim(),
            descripcion: descripcionInput.value.trim(),
            prioridad_id: prioridadSelect.value,
            estado_id: estadoSelect.value,
            solicitante_id: solicitanteSelect.value,
            tecnico_id: tecnicoSelect.value || null
        };
        try {
            if (id) {
                datos.comentario = comentarioInput.value.trim();
                await api(`/api/tickets/${id}`, { method: 'PUT', json: datos });
            } else {
                await api('/api/tickets', { method: 'POST', json: datos });
            }
        } catch (err) {
            mostrar(formError, err.message);
            return;
        }
        closeModal();
        cargar();
    });

    window.editarTicket = function (id) {
        const t = tickets.find(x => x.id === id);
        resetForm();
        ticketIdInput.value = t.id;
        codigoInput.value = t.codigo;
        tituloInput.value = t.titulo;
        descripcionInput.value = t.descripcion;
        prioridadSelect.value = t.prioridad_id;
        estadoSelect.value = t.estado_id;
        solicitanteSelect.value = t.solicitante_id || '';
        tecnicoSelect.value = t.tecnico_id || '';
        grupoComentario.hidden = false;
        modalTitle.textContent = 'Modificar Ticket';
        ticketModal.style.display = 'flex';
    };

    window.eliminarTicket = async function (id) {
        if (!confirm('¿Está seguro de eliminar este ticket del sistema?')) return;
        try {
            await api(`/api/tickets/${id}`, { method: 'DELETE' });
            cargar();
        } catch (e) { mostrar(msgError, e.message); }
    };

    conectarFiltros(barra, renderTickets);
    cargar();
});
