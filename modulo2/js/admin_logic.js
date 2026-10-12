document.addEventListener('DOMContentLoaded', () => {
    const ticketForm = document.getElementById('ticket-form');
    const ticketsTbody = document.getElementById('tickets-tbody');
    const ticketModal = document.getElementById('ticket-modal');
    const btnNuevo = document.getElementById('btn-nuevo');
    const modalClose = document.getElementById('modal-close');
    const btnCancel = document.getElementById('btn-cancel');
    const modalTitle = document.getElementById('modal-title');

    const ticketIdInput = document.getElementById('ticket-id');
    const codigoInput = document.getElementById('codigo');
    const tituloInput = document.getElementById('titulo');
    const descripcionInput = document.getElementById('descripcion');
    const prioridadSelect = document.getElementById('prioridad_id');
    const estadoSelect = document.getElementById('estado_id');
    const solicitanteInput = document.getElementById('solicitante_id');
    const tecnicoInput = document.getElementById('tecnico_id');

    // Datos demo iniciales
    const defaultTickets = [
        {
            id: 1,
            codigo: 'TCK-0042',
            titulo: 'Caída de red en sede Lima',
            descripcion: 'Sin conectividad en el piso 3.',
            prioridad_id: '1',
            estado_id: '3',
            solicitante_id: '14',
            tecnico_id: '3'
        },
        {
            id: 2,
            codigo: 'TCK-0045',
            titulo: 'Impresora de contabilidad',
            descripcion: 'La impresora no responde.',
            prioridad_id: '2',
            estado_id: '2',
            solicitante_id: '26',
            tecnico_id: ''
        },
        {
            id: 3,
            codigo: 'TCK-0047',
            titulo: 'Instalación de software',
            descripcion: 'Se requiere instalar software en el equipo.',
            prioridad_id: '3',
            estado_id: '2',
            solicitante_id: '35',
            tecnico_id: '4'
        }
    ];

    let tickets = JSON.parse(localStorage.getItem('tickets_ti_admin')) || defaultTickets;

    function renderTickets() {
        ticketsTbody.innerHTML = '';

        if (tickets.length === 0) {
            ticketsTbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No hay tickets registrados en el sistema.</td></tr>`;
            return;
        }

        tickets.forEach((ticket, index) => {
            const row = document.createElement('tr');
            
            const prioridadesMap = { '1': 'Alta', '2': 'Media', '3': 'Baja' };
            const estadosMap = { '1': 'Nuevo', '2': 'Abierto', '3': 'En proceso', '4': 'Resuelto', '5': 'Cerrado' };

            row.innerHTML = `
                <td><strong>${ticket.codigo}</strong></td>
                <td>${ticket.titulo}</td>
                <td>${prioridadesMap[ticket.prioridad_id] || ticket.prioridad_id}</td>
                <td>${estadosMap[ticket.estado_id] || ticket.estado_id}</td>
                <td>${ticket.solicitante_id || 'S/N'}</td>
                <td>${ticket.tecnico_id ? 'Técnico ID: ' + ticket.tecnico_id : 'Sin asignar'}</td>
                <td>
                    <button class="btn-edit" onclick="editarTicket(${index})">Modificar</button>
                    <button class="btn-delete" onclick="eliminarTicket(${index})">Eliminar</button>
                </td>
            `;
            ticketsTbody.appendChild(row);
        });
    }

    // Abrir Modal para Nuevo
    btnNuevo.addEventListener('click', () => {
        resetForm();
        modalTitle.textContent = 'Registrar Nuevo Ticket';
        ticketModal.style.display = 'flex';
    });

    // Cerrar Modal
    function closeModal() {
        ticketModal.style.display = 'none';
        resetForm();
    }

    modalClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    // Guardar (Crear o Modificar)
    ticketForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const ticketData = {
            id: ticketIdInput.value ? parseInt(ticketIdInput.value) : Date.now(),
            codigo: codigoInput.value.trim(),
            titulo: tituloInput.value.trim(),
            descripcion: descripcionInput.value.trim(),
            prioridad_id: prioridadSelect.value,
            estado_id: estadoSelect.value,
            solicitante_id: solicitanteInput.value.trim(),
            tecnico_id: tecnicoInput.value.trim()
        };

        const editIndex = ticketIdInput.dataset.index;

        if (editIndex !== undefined && editIndex !== '') {
            tickets[editIndex] = ticketData;
        } else {
            tickets.push(ticketData);
        }

        localStorage.setItem('tickets_ti_admin', JSON.stringify(tickets));
        renderTickets();
        closeModal();
    });

    // Función global para editar / modificar
    window.editarTicket = function(index) {
        const t = tickets[index];
        ticketIdInput.value = t.id;
        codigoInput.value = t.codigo;
        tituloInput.value = t.titulo;
        descripcionInput.value = t.descripcion;
        prioridadSelect.value = t.prioridad_id;
        estadoSelect.value = t.estado_id;
        solicitanteInput.value = t.solicitante_id;
        tecnicoInput.value = t.tecnico_id;

        ticketIdInput.dataset.index = index;
        modalTitle.textContent = 'Modificar Ticket';
        ticketModal.style.display = 'flex';
    };

    // Función global para eliminar
    window.eliminarTicket = function(index) {
        if (confirm('¿Está seguro de eliminar este ticket del sistema?')) {
            tickets.splice(index, 1);
            localStorage.setItem('tickets_ti_admin', JSON.stringify(tickets));
            renderTickets();
        }
    };

    function resetForm() {
        ticketForm.reset();
        ticketIdInput.value = '';
        delete ticketIdInput.dataset.index;
    }

    renderTickets();
});