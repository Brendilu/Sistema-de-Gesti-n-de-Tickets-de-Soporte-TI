(function() {
    // ---------- ESTADO ----------
    let tickets = [];                // arreglo de tickets (con fotos base64)
    let pendingFiles = [];           // archivos validados listos para previsualizar (File objects)
    let pendingBase64 = [];          // sus correspondientes base64 (mismo índice)

    // ---------- REFERENCIAS DOM ----------
    const form = document.getElementById('ticketForm');
    const tituloInput = document.getElementById('titulo');
    const descripcionInput = document.getElementById('descripcion');
    const categoriaSelect = document.getElementById('categoria');
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

    // ---------- UTILIDADES ----------
    function showToast(msg, duration = 2500) {
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
    }

    // Validar tipo MIME real usando FileReader
    function validateImageMime(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const arr = new Uint8Array(e.target.result).subarray(0, 4);
                let header = '';
                for (let i = 0; i < arr.length; i++) {
                    header += arr[i].toString(16).padStart(2, '0');
                }
                // Firmas: jpeg (ffd8ff), png (89504e47), gif (474946), webp (52494646 + 57454250)
                const isJpeg = header.startsWith('ffd8ff');
                const isPng = header.startsWith('89504e47');
                const isGif = header.startsWith('474946');
                const isWebp = header.startsWith('52494646') && header.includes('57454250');
                if (isJpeg || isPng || isGif || isWebp) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            };
            reader.onerror = () => resolve(false);
            reader.readAsArrayBuffer(file.slice(0, 12));
        });
    }

    // Convierte File a Base64
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ---------- MANEJO DE ARCHIVOS (PREVISUALIZACIÓN) ----------
    async function handleFiles(files) {
        const fileList = Array.from(files);
        for (const file of fileList) {
            // Validar que sea imagen por tipo MIME real
            const isValid = await validateImageMime(file);
            if (!isValid) {
                showToast(`"${file.name}" no es una imagen válida (JPEG, PNG, GIF, WEBP)`, 3000);
                continue;
            }
            // Evitar duplicados por nombre y tamaño (simple)
            const existe = pendingFiles.some(f => f.name === file.name && f.size === file.size);
            if (existe) {
                showToast(`"${file.name}" ya está adjunto`, 2000);
                continue;
            }
            try {
                const base64 = await fileToBase64(file);
                pendingFiles.push(file);
                pendingBase64.push(base64);
                renderPreview();
            } catch (err) {
                showToast(`Error al procesar "${file.name}"`, 2000);
            }
        }
        // Limpiar input para permitir subir el mismo archivo de nuevo si se desea
        fileInput.value = '';
    }

    // Renderiza las miniaturas pendientes
    function renderPreview() {
        previewContainer.innerHTML = '';
        pendingBase64.forEach((base64, index) => {
            const div = document.createElement('div');
            div.className = 'thumb-preview';
            const img = document.createElement('img');
            img.src = base64;
            img.alt = `preview-${index}`;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-preview';
            removeBtn.innerHTML = '✕';
            removeBtn.type = 'button';
            removeBtn.dataset.index = index;
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = Number(e.target.dataset.index);
                pendingFiles.splice(idx, 1);
                pendingBase64.splice(idx, 1);
                renderPreview();
            });
            div.appendChild(img);
            div.appendChild(removeBtn);
            previewContainer.appendChild(div);
        });
    }

    // ---------- ALMACENAMIENTO LOCAL ----------
    function loadTicketsFromStorage() {
        const stored = localStorage.getItem('prototipo_tickets');
        if (stored) {
            try {
                tickets = JSON.parse(stored);
            } catch (e) {
                tickets = [];
            }
        } else {
            tickets = [];
        }
        renderTickets();
    }

    function saveTicketsToStorage() {
        localStorage.setItem('prototipo_tickets', JSON.stringify(tickets));
    }

    // ---------- RENDERIZAR LISTA DE TICKETS ----------
    function renderTickets() {
        ticketCount.textContent = tickets.length;
        if (tickets.length === 0) {
            ticketsList.innerHTML = '<li class="empty-message">No hay tickets registrados aún.</li>';
            return;
        }

        ticketsList.innerHTML = '';
        // Orden: más reciente primero
        const sorted = [...tickets].sort((a, b) => b.id - a.id);

        sorted.forEach(ticket => {
            const li = document.createElement('li');
            li.className = 'ticket-item';
            li.dataset.id = ticket.id;

            // Información principal
            const infoDiv = document.createElement('div');
            infoDiv.className = 'ticket-info';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'ticket-title';
            titleDiv.innerHTML = `${escapeHtml(ticket.titulo)} 
                <span class="priority-badge priority-${ticket.categoria.toLowerCase()}">${ticket.categoria}</span>`;

            const metaDiv = document.createElement('div');
            metaDiv.className = 'ticket-meta';
            metaDiv.innerHTML = `<span>📅 ${new Date(ticket.fecha).toLocaleString()}</span>
                                 <span>🆔 #${ticket.id}</span>
                                 <span>📎 ${ticket.fotos.length} foto(s)</span>`;

            const descDiv = document.createElement('div');
            descDiv.className = 'ticket-desc';
            descDiv.textContent = ticket.descripcion;

            // Miniaturas (máximo 4 visibles)
            const thumbsDiv = document.createElement('div');
            thumbsDiv.className = 'ticket-thumbs';
            const maxThumbs = Math.min(ticket.fotos.length, 4);
            for (let i = 0; i < maxThumbs; i++) {
                const img = document.createElement('img');
                img.className = 'ticket-thumb';
                img.src = ticket.fotos[i];
                img.alt = `foto-${i}`;
                img.loading = 'lazy';
                // Al hacer clic abre la imagen en grande (visor completo)
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openFullImage(ticket.fotos[i]);
                });
                thumbsDiv.appendChild(img);
            }
            if (ticket.fotos.length > 4) {
                const moreSpan = document.createElement('span');
                moreSpan.style.alignSelf = 'center';
                moreSpan.style.fontSize = '0.75rem';
                moreSpan.style.color = '#5e6f8d';
                moreSpan.textContent = `+${ticket.fotos.length - 4}`;
                thumbsDiv.appendChild(moreSpan);
            }

            infoDiv.appendChild(titleDiv);
            infoDiv.appendChild(metaDiv);
            infoDiv.appendChild(descDiv);
            infoDiv.appendChild(thumbsDiv);

            // Acciones
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'ticket-actions';

            const detailBtn = document.createElement('button');
            detailBtn.className = 'btn-icon';
            detailBtn.innerHTML = '🔍 Detalle';
            detailBtn.type = 'button';
            detailBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openDetailModal(ticket.id);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-icon delete';
            deleteBtn.innerHTML = '🗑️ Eliminar';
            deleteBtn.type = 'button';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteTicket(ticket.id);
            });

            actionsDiv.appendChild(detailBtn);
            actionsDiv.appendChild(deleteBtn);

            li.appendChild(infoDiv);
            li.appendChild(actionsDiv);
            ticketsList.appendChild(li);
        });
    }

    // Escapar HTML para prevenir XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ---------- ELIMINAR TICKET ----------
    function deleteTicket(id) {
        if (!confirm('¿Eliminar este ticket de forma permanente?')) return;
        tickets = tickets.filter(t => t.id !== id);
        saveTicketsToStorage();
        renderTickets();
        showToast('Ticket eliminado', 1500);
        // Cerrar modal si estaba abierto con ese ticket
        if (detailModal.classList.contains('active')) {
            const currentId = detailModal.dataset.ticketId;
            if (currentId == id) closeModal();
        }
    }

    // ---------- MODAL DETALLE ----------
    function openDetailModal(id) {
        const ticket = tickets.find(t => t.id === id);
        if (!ticket) return;
        detailModal.dataset.ticketId = id;
        modalBody.innerHTML = `
            <h3>${escapeHtml(ticket.titulo)}</h3>
            <div class="modal-detail">
                <p><strong>🆔 Ticket:</strong> #${ticket.id}</p>
                <p><strong>📅 Fecha:</strong> ${new Date(ticket.fecha).toLocaleString()}</p>
                <p><strong>🏷️ Categoría/Prioridad:</strong> <span class="priority-badge priority-${ticket.categoria.toLowerCase()}">${ticket.categoria}</span></p>
                <p><strong>📝 Descripción:</strong> ${escapeHtml(ticket.descripcion)}</p>
                <p><strong>📸 Fotos adjuntas (${ticket.fotos.length}):</strong></p>
            </div>
        `;
        if (ticket.fotos.length > 0) {
            const photosDiv = document.createElement('div');
            photosDiv.className = 'modal-photos';
            ticket.fotos.forEach((foto, idx) => {
                const img = document.createElement('img');
                img.src = foto;
                img.alt = `foto-${idx}`;
                img.addEventListener('click', () => openFullImage(foto));
                photosDiv.appendChild(img);
            });
            modalBody.appendChild(photosDiv);
        } else {
            const p = document.createElement('p');
            p.textContent = 'Sin fotos adjuntas.';
            p.style.marginTop = '1rem';
            p.style.color = '#8a9bb5';
            modalBody.appendChild(p);
        }
        detailModal.classList.add('active');
    }

    function closeModal() {
        detailModal.classList.remove('active');
        delete detailModal.dataset.ticketId;
    }

    // ---------- VISOR DE IMAGEN COMPLETA ----------
    function openFullImage(src) {
        fullImage.src = src;
        fullImagePreview.classList.add('active');
    }

    function closeFullImageFunc() {
        fullImagePreview.classList.remove('active');
        fullImage.src = '';
    }

    // ---------- REGISTRO DE TICKET (SIMULACIÓN MULTIPART) ----------
    async function handleSubmit(e) {
        e.preventDefault();

        const titulo = tituloInput.value.trim();
        const descripcion = descripcionInput.value.trim();
        const categoria = categoriaSelect.value;

        if (!titulo || !descripcion) {
            showToast('Completa título y descripción', 2000);
            return;
        }

        // Simular envío multipart / retardo de red
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Enviando...';

        // Simulamos un pequeño delay para emular el envío multipart
        await new Promise(resolve => setTimeout(resolve, 600));

        // Crear nuevo ticket con las fotos pendientes (base64)
        const nuevoTicket = {
            id: Date.now(),
            titulo: titulo,
            descripcion: descripcion,
            categoria: categoria,
            fecha: new Date().toISOString(),
            fotos: [...pendingBase64]  // array de base64
        };

        // Guardar en "base de datos" local
        tickets.push(nuevoTicket);
        saveTicketsToStorage();
        renderTickets();

        // Resetear formulario y miniaturas
        form.reset();
        pendingFiles = [];
        pendingBase64 = [];
        renderPreview();

        submitBtn.disabled = false;
        submitBtn.textContent = '📤 Registrar ticket';

        showToast(`Ticket #${nuevoTicket.id} registrado con ${nuevoTicket.fotos.length} foto(s)`, 2500);
    }

    // ---------- EVENT LISTENERS ----------
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    });

    // Drag & drop sencillo para el input file (opcional, pero mejora UX)
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
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });

    form.addEventListener('submit', handleSubmit);

    closeModalBtn.addEventListener('click', closeModal);
    detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) closeModal();
    });

    closeFullImage.addEventListener('click', closeFullImageFunc);
    fullImagePreview.addEventListener('click', (e) => {
        if (e.target === fullImagePreview) closeFullImageFunc();
    });

    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (fullImagePreview.classList.contains('active')) closeFullImageFunc();
            else if (detailModal.classList.contains('active')) closeModal();
        }
    });

    // ---------- INICIALIZAR ----------
    function init() {
        loadTicketsFromStorage();
        renderPreview();
    }
    init();

})();