(function () {
    // ---------- ESTADO ----------
    let tickets = [];            // tickets traídos de la BD (GET /api/tickets?fotos=1)
    let pendingFiles = [];       // File seleccionados, validados y listos para enviar
    let pendingUrls = [];        // URLs de previsualización (mismo índice)
    let yo = null;               // usuario en sesión
    let prioridades = [];
    let MAX_FOTOS = 4;           // límite de fotos por ticket (viene del servidor)
    let estados = [];

    // ---------- REFERENCIAS DOM ----------
    const form = document.getElementById('ticketForm');
    const tituloInput = document.getElementById('titulo');
    const descripcionInput = document.getElementById('descripcion');
    const categoriaSelect = document.getElementById('categoria');
    const solicitanteSelect = document.getElementById('solicitante');
    const fileInput = document.getElementById('fileInput');
    const previewContainer = document.getElementById('previewContainer');
    const ticketsList = document.getElementById('ticketsList');
    const ticketCount = document.getElementById('ticketCount');
    const detailModal = document.getElementById('detailModal');
    const modalBody = document.getElementById('modalBody');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const fullImagePreview = document.getElementById('fullImagePreview');
    const fullImage = document.getElementById('fullImage');
    const closeFullImage = document.getElementById('closeFullImage');
    const toast = document.getElementById('toast');
    const barraFiltros = document.getElementById('filtros');
    const fotoHint = document.getElementById('fotoHint');

    const ICONOS = { Alta: '🔴', Media: '🟡', Baja: '🟢' };
    const esPersonal = () => yo && yo.rol_id !== 3;

    // ---------- UTILIDADES ----------
    function showToast(msg, duration = 2500) {
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
    }

    // Valida el tipo real por la firma del archivo (el servidor lo vuelve a validar)
    function validateImageMime(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const arr = new Uint8Array(e.target.result).subarray(0, 12);
                let header = '';
                for (let i = 0; i < arr.length; i++) header += arr[i].toString(16).padStart(2, '0');
                const isJpeg = header.startsWith('ffd8ff');
                const isPng = header.startsWith('89504e47');
                const isGif = header.startsWith('47494638');
                const isWebp = header.startsWith('52494646') && header.slice(16, 24) === '57454250';
                resolve(isJpeg || isPng || isGif || isWebp);
            };
            reader.onerror = () => resolve(false);
            reader.readAsArrayBuffer(file.slice(0, 12));
        });
    }

    // ---------- MANEJO DE ARCHIVOS (PREVISUALIZACIÓN) ----------
    async function handleFiles(files) {
        for (const file of Array.from(files)) {
            if (!(await validateImageMime(file))) {
                showToast(`"${file.name}" no es una imagen válida (JPEG, PNG, GIF, WEBP)`, 3000);
                continue;
            }
            if (file.size > 5 * 1024 * 1024) {
                showToast(`"${file.name}" supera 5 MB`, 3000);
                continue;
            }
            if (pendingFiles.length >= MAX_FOTOS) {
                showToast(`Máximo ${MAX_FOTOS} fotos por ticket`, 3000);
                break;
            }
            if (pendingFiles.some(f => f.name === file.name && f.size === file.size)) {
                showToast(`"${file.name}" ya está adjunto`, 2000);
                continue;
            }
            pendingFiles.push(file);
            pendingUrls.push(URL.createObjectURL(file));
            renderPreview();
        }
        fileInput.value = '';
    }

    function renderPreview() {
        fotoHint.textContent = `Máximo ${MAX_FOTOS} fotos · 5 MB cada una · ${pendingFiles.length}/${MAX_FOTOS}`;
        fotoHint.classList.toggle('lleno', pendingFiles.length >= MAX_FOTOS);
        fileInput.disabled = pendingFiles.length >= MAX_FOTOS;
        previewContainer.innerHTML = '';
        pendingUrls.forEach((url, index) => {
            const div = document.createElement('div');
            div.className = 'thumb-preview';
            const img = document.createElement('img');
            img.src = url;
            img.alt = `preview-${index}`;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-preview';
            removeBtn.innerHTML = '✕';
            removeBtn.type = 'button';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                URL.revokeObjectURL(pendingUrls[index]);
                pendingFiles.splice(index, 1);
                pendingUrls.splice(index, 1);
                renderPreview();
            });
            div.appendChild(img);
            div.appendChild(removeBtn);
            previewContainer.appendChild(div);
        });
    }

    // ---------- LISTA DE TICKETS (desde la BD) ----------
    async function cargarTickets() {
        try {
            tickets = await api('/api/tickets?fotos=1');
        } catch (e) {
            ticketsList.innerHTML = `<li class="empty-message">${esc(e.message)}</li>`;
            return;
        }
        renderTickets();
    }

    // ---------- FILTROS (buscar, estado, prioridad, asignación y fechas) ----------
    function ticketsFiltrados() {
        const f = n => valorFiltro(barraFiltros, n);
        return tickets.filter(t =>
            coincide(f('q'), t.codigo, t.titulo, t.descripcion, t.solicitante, t.tecnico, t.area) &&
            (!f('estado') || String(t.estado_id) === f('estado')) &&
            (!f('prioridad') || String(t.prioridad_id) === f('prioridad')) &&
            (f('asig') !== 'mios' || t.tecnico_id === yo.id) &&
            (f('asig') !== 'libres' || !t.tecnico_id) &&
            enRango(t.creado_en, f('desde'), f('hasta')));
    }

    function renderTickets() {
        const lista = ticketsFiltrados();
        ticketCount.textContent = lista.length === tickets.length ? tickets.length : `${lista.length} de ${tickets.length}`;
        if (tickets.length === 0) {
            ticketsList.innerHTML = '<li class="empty-message">No hay tickets registrados aún.</li>';
            return;
        }
        if (lista.length === 0) {
            ticketsList.innerHTML = '<li class="vacio-filtro">Ningún ticket coincide con los filtros.</li>';
            return;
        }
        ticketsList.innerHTML = '';
        lista.forEach(ticket => {
            const fotos = ticket.fotos || [];
            const li = document.createElement('li');
            li.className = 'ticket-item';

            const infoDiv = document.createElement('div');
            infoDiv.className = 'ticket-info';
            infoDiv.innerHTML = `
                <div class="ticket-title">${esc(ticket.titulo)}
                    <span class="priority-badge priority-${esc(ticket.prioridad.toLowerCase())}">${esc(ticket.prioridad)}</span>
                    <span class="priority-badge estado-badge">${esc(ticket.estado)}</span></div>
                <div class="ticket-meta">
                    <span>📅 ${esc(formatearFecha(ticket.creado_en))}</span>
                    <span>🆔 ${esc(ticket.codigo)}</span>
                    <span>📎 ${ticket.num_adjuntos} foto(s)</span>
                </div>
                ${esPersonal() ? `<div class="ticket-persona">
                    ${ticket.solicitante ? `<span title="Solicitante">${distintivo({ nombre: ticket.solicitante, cargo: ticket.cargo, area: ticket.area }, { mini: true })} ${esc(ticket.solicitante)}</span>` : ''}
                    <span title="Técnico asignado">🛠️ ${esc(ticket.tecnico || 'Sin asignar')}</span>
                </div>` : (ticket.tecnico ? `<div class="ticket-persona"><span>🛠️ Atiende: ${esc(ticket.tecnico)}</span></div>` : '')}
                <div class="ticket-desc">${esc(ticket.descripcion)}</div>`;

            const thumbsDiv = document.createElement('div');
            thumbsDiv.className = 'ticket-thumbs';
            fotos.slice(0, 4).forEach((src, i) => {
                const img = document.createElement('img');
                img.className = 'ticket-thumb';
                img.src = src;
                img.alt = `foto-${i}`;
                img.loading = 'lazy';
                img.addEventListener('click', (e) => { e.stopPropagation(); openFullImage(src); });
                thumbsDiv.appendChild(img);
            });
            if (fotos.length > 4) {
                const more = document.createElement('span');
                more.style.cssText = 'align-self:center;font-size:.75rem;color:#5e6f8d';
                more.textContent = `+${fotos.length - 4}`;
                thumbsDiv.appendChild(more);
            }
            infoDiv.appendChild(thumbsDiv);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'ticket-actions';
            const detailBtn = document.createElement('button');
            detailBtn.className = 'btn-icon';
            detailBtn.type = 'button';
            detailBtn.innerHTML = '🔍 Detalle';
            detailBtn.addEventListener('click', (e) => { e.stopPropagation(); openDetailModal(ticket.id); });
            actionsDiv.appendChild(detailBtn);

            if (yo && yo.rol_id === 1) {   // solo el administrador elimina
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn-icon delete';
                deleteBtn.type = 'button';
                deleteBtn.innerHTML = '🗑️ Eliminar';
                deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteTicket(ticket.id); });
                actionsDiv.appendChild(deleteBtn);
            }

            li.appendChild(infoDiv);
            li.appendChild(actionsDiv);
            ticketsList.appendChild(li);
        });
    }

    // ---------- ELIMINAR (solo administrador) ----------
    async function deleteTicket(id) {
        if (!confirm('¿Eliminar este ticket de forma permanente?')) return;
        try {
            await api(`/api/tickets/${id}`, { method: 'DELETE' });
        } catch (e) { showToast(e.message, 3000); return; }
        showToast('Ticket eliminado', 1500);
        if (detailModal.dataset.ticketId == id) closeModal();
        cargarTickets();
    }

    // ---------- MODAL DETALLE (ticket + adjuntos + historial según el rol) ----------
    async function openDetailModal(id) {
        let t;
        try { t = await api(`/api/tickets/${id}`); }
        catch (e) { showToast(e.message, 3000); return; }
        detailModal.dataset.ticketId = id;
        const aviso = t.historial_alcance === 'propio'
            ? '<div class="hist-aviso">Solo ves las acciones que hiciste tú en este ticket.</div>' : '';
        const historial = t.historial.map(h => `
            <div class="hist-item"><b>${esc(h.estado_anterior || 'Nuevo registro')} → ${esc(h.estado_nuevo)}</b>
            <div class="quien">${distintivo({ nombre: h.usuario, cargo: h.cargo, area: h.area, rol: h.rol }, { mini: true })}
                <small>${esc(h.usuario)} · ${esc(formatearFecha(h.fecha))}</small> ${chipRol(h.rol)}</div>
            <p>${esc(h.comentario)}</p></div>`).join('') || '<p style="color:#8a9bb5">Todavía no hay acciones tuyas en este ticket.</p>';
        const puedeEditar = !!yo.empleado_id && t.solicitante_id === yo.empleado_id && ['Nuevo', 'Abierto'].includes(t.estado);
        modalBody.innerHTML = `
            <h3>${esc(t.titulo)}</h3>
            <div class="modal-detail">
                <p><strong>🆔 Ticket:</strong> ${esc(t.codigo)}</p>
                <p><strong>📅 Fecha:</strong> ${esc(formatearFecha(t.creado_en))}</p>
                <p><strong>🏷️ Prioridad:</strong> <span class="priority-badge priority-${esc(t.prioridad.toLowerCase())}">${esc(t.prioridad)}</span>
                   · <strong>Estado:</strong> ${esc(t.estado)}</p>
                <p><strong>👤 Solicitante:</strong> ${distintivo({ nombre: t.solicitante, cargo: t.cargo, area: t.area })}</p>
                <p><strong>🛠️ Técnico:</strong> ${esc(t.tecnico || 'Sin asignar')}</p>
                <p><strong>📝 Descripción:</strong> ${esc(t.descripcion)}</p>
                <p><strong>📸 Fotos adjuntas (${t.adjuntos.length}):</strong></p>
            </div>`;
        const photosDiv = document.createElement('div');
        photosDiv.className = 'modal-photos';
        t.adjuntos.forEach((a, idx) => {
            const img = document.createElement('img');
            img.src = a.url;
            img.alt = a.nombre_archivo || `foto-${idx}`;
            img.addEventListener('click', () => openFullImage(a.url));
            photosDiv.appendChild(img);
        });
        if (t.adjuntos.length) modalBody.appendChild(photosDiv);
        else modalBody.insertAdjacentHTML('beforeend', '<p style="margin-top:1rem;color:#8a9bb5">Sin fotos adjuntas.</p>');
        if (puedeEditar) {
            modalBody.insertAdjacentHTML('beforeend', '<div class="fila" style="margin-top:1rem"><button type="button" class="btn-icon" id="btnEditarMio">✏️ Editar mi ticket</button></div>');
            document.getElementById('btnEditarMio').addEventListener('click', () => formularioEditar(t));
        } else if (t.solicitante_id === yo.empleado_id && yo.empleado_id) {
            modalBody.insertAdjacentHTML('beforeend', '<p class="hist-aviso" style="margin-top:1rem">Tu ticket ya está en atención, por eso ya no se puede editar.</p>');
        }
        if (t.historial_alcance !== 'ninguno') {
            modalBody.insertAdjacentHTML('beforeend', `<h4 style="margin:1.2rem 0 .4rem">Historial</h4>${aviso}${historial}`);
        }
        detailModal.classList.add('active');
    }

    // El solicitante corrige su propio ticket mientras esté en Nuevo o Abierto
    function formularioEditar(t) {
        modalBody.innerHTML = `
            <h3>✏️ Editar ${esc(t.codigo)}</h3>
            <form class="edit-mio" id="formEditarMio">
                <label>Título<input id="emTitulo" maxlength="150" minlength="5" required value="${esc(t.titulo)}"></label>
                <label>Descripción<textarea id="emDesc" rows="4" required>${esc(t.descripcion)}</textarea></label>
                <label>Prioridad<select id="emPrio"></select></label>
                <div class="fila"><button type="submit" class="btn-primary" style="width:auto;padding:.6rem 1.4rem">Guardar cambios</button>
                <button type="button" class="btn-icon" id="emCancelar">Cancelar</button></div>
            </form>`;
        llenarSelect(document.getElementById('emPrio'), prioridades, 'id', p => `${ICONOS[p.nombre] || ''} ${p.nombre}`);
        document.getElementById('emPrio').value = t.prioridad_id;
        document.getElementById('emCancelar').addEventListener('click', () => openDetailModal(t.id));
        document.getElementById('formEditarMio').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await api(`/api/tickets/${t.id}/mio`, { method: 'PUT', json: {
                    titulo: document.getElementById('emTitulo').value,
                    descripcion: document.getElementById('emDesc').value,
                    prioridad_id: Number(document.getElementById('emPrio').value) } });
            } catch (err) { showToast(err.message, 4000); return; }
            showToast('Ticket actualizado', 2000);
            await cargarTickets();
            openDetailModal(t.id);
        });
    }

    function closeModal() {
        detailModal.classList.remove('active');
        delete detailModal.dataset.ticketId;
    }

    function openFullImage(src) { fullImage.src = src; fullImagePreview.classList.add('active'); }
    function closeFullImageFunc() { fullImagePreview.classList.remove('active'); fullImage.src = ''; }

    // ---------- REGISTRO DE TICKET (multipart → POST /api/tickets) ----------
    async function handleSubmit(e) {
        e.preventDefault();
        const titulo = tituloInput.value.trim();
        const descripcion = descripcionInput.value.trim();
        if (titulo.length < 5 || !descripcion) {
            showToast('Completa el título (mín. 5 caracteres) y la descripción', 2500);
            return;
        }
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Enviando...';

        const datos = new FormData();
        datos.append('titulo', titulo);
        datos.append('descripcion', descripcion);
        datos.append('prioridad_id', categoriaSelect.value);
        if (esPersonal()) datos.append('solicitante_id', solicitanteSelect.value);
        pendingFiles.forEach(f => datos.append('fotos', f));

        try {
            const r = await api('/api/tickets', { method: 'POST', body: datos });
            form.reset();
            pendingUrls.forEach(u => URL.revokeObjectURL(u));
            pendingFiles = []; pendingUrls = [];
            renderPreview();
            categoriaSelect.value = prioridades.find(p => p.nombre === 'Media')?.id ?? prioridades[0].id;
            showToast(`Ticket ${r.codigo} registrado con ${r.fotos} foto(s)`, 3000);
            cargarTickets();
        } catch (err) {
            showToast(err.message, 4000);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '📤 Registrar ticket';
        }
    }

    // ---------- EVENTOS ----------
    fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFiles(e.target.files); });

    const fileWrapper = document.querySelector('.file-input-wrapper');
    fileWrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileWrapper.style.borderColor = '#3b7cc9';
        fileWrapper.style.background = '#f0f7ff';
    });
    fileWrapper.addEventListener('dragleave', (e) => {
        e.preventDefault();
        fileWrapper.style.borderColor = '#b9cee8';
        fileWrapper.style.background = '#f8fafd';
    });
    fileWrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        fileWrapper.style.borderColor = '#b9cee8';
        fileWrapper.style.background = '#f8fafd';
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });

    form.addEventListener('submit', handleSubmit);
    closeModalBtn.addEventListener('click', closeModal);
    detailModal.addEventListener('click', (e) => { if (e.target === detailModal) closeModal(); });
    closeFullImage.addEventListener('click', closeFullImageFunc);
    fullImagePreview.addEventListener('click', (e) => { if (e.target === fullImagePreview) closeFullImageFunc(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (fullImagePreview.classList.contains('active')) closeFullImageFunc();
            else if (detailModal.classList.contains('active')) closeModal();
        }
    });

    // ---------- INICIALIZAR ----------
    async function init() {
        const cat = await cargarCatalogos();
        yo = cat.yo;
        prioridades = cat.prioridades;
        estados = cat.estados;
        MAX_FOTOS = cat.max_fotos || MAX_FOTOS;
        llenarSelect(document.getElementById('f-estado'), estados, 'id', 'nombre', 'Todos');
        llenarSelect(document.getElementById('f-prioridad'), prioridades, 'id', 'nombre', 'Todas');
        llenarSelect(categoriaSelect, prioridades, 'id', p => `${ICONOS[p.nombre] || ''} ${p.nombre}`);
        categoriaSelect.value = (prioridades.find(p => p.nombre === 'Media') || prioridades[0]).id;
        if (esPersonal()) {
            document.getElementById('grupoSolicitante').hidden = false;
            llenarSelect(solicitanteSelect, cat.empleados, 'id',
                e => `${e.nombre_completo}${e.area ? ' · ' + e.area : ''}`);
            if (yo.empleado_id) solicitanteSelect.value = yo.empleado_id;
            document.getElementById('tituloLista').textContent = 'Todos los tickets';
            document.getElementById('f-asig-grupo').hidden = false;
        } else {
            document.getElementById('tituloLista').textContent = 'Mis tickets';
            if (!yo.empleado_id) showToast('Tu cuenta aún no está vinculada a un empleado; pide a un administrador que la vincule.', 6000);
        }
        conectarFiltros(barraFiltros, renderTickets);
        renderPreview();
        cargarTickets();
    }
    init();
})();
