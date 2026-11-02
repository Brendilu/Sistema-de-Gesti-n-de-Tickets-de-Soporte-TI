/* ==========================================================================
   modulo2_asistente.js · Asistente con IA que sugiere soluciones antes de crear el ticket
   - Responde solo con artículos de la base de conocimiento (lo garantiza el servidor).
   - Muestra pasos + artículos de origen, «resolvió» y «no resolvió, crear ticket».
   - El Administrador gestiona los artículos; Admin/Técnico ven las estadísticas.
   La clave de la API nunca llega aquí: el navegador solo habla con /api/asistente/...
   ========================================================================== */
(function () {
    const caja = document.getElementById('iaBox');
    if (!caja) return;
    const toggle = document.getElementById('iaToggle');
    const cuerpo = document.getElementById('iaCuerpo');
    const consulta = document.getElementById('iaConsulta');
    const btnBuscar = document.getElementById('iaBuscar');
    const resultado = document.getElementById('iaResultado');
    const statsEl = document.getElementById('iaStats');
    const acciones = document.getElementById('iaAcciones');
    const titulo = document.getElementById('titulo');
    const descripcion = document.getElementById('descripcion');
    const toast = document.getElementById('toast');

    // Estado compartido con modulo2.js: id de la consulta que terminará en ticket
    const M2 = window.M2Asistente = { consultaId: null, alCrearTicket };
    let yo = null;

    function avisar(msg, ms = 3500) {
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show'), ms);
    }

    toggle.addEventListener('click', () => {
        const abierto = cuerpo.hidden;
        cuerpo.hidden = !abierto;
        toggle.setAttribute('aria-expanded', abierto ? 'true' : 'false');
        caja.classList.toggle('abierto', abierto);
        if (abierto) consulta.focus();
    });

    // ---------- consultar ----------
    btnBuscar.addEventListener('click', buscar);
    consulta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) buscar(); });

    async function buscar() {
        const texto = consulta.value.trim();
        if (texto.length < 10) { avisar('Describe tu problema con un poco más de detalle.'); return; }
        btnBuscar.disabled = true;
        btnBuscar.textContent = '⏳ Buscando en la base de conocimiento…';
        resultado.innerHTML = '';
        M2.consultaId = null;
        try {
            const r = await api('/api/asistente/consultar', { method: 'POST', json: { consulta: texto } });
            M2.consultaId = r.consulta_id;
            mostrar(r, texto);
        } catch (e) {
            // Error de la API de IA, límite excedido o sin conexión: se explica y se ofrece crear el ticket
            resultado.innerHTML = `<div class="ia-error">⚠️ ${esc(e.message)}</div>`;
            resultado.appendChild(botonCrear('Crear ticket con esta descripción', texto));
        } finally {
            btnBuscar.disabled = false;
            btnBuscar.textContent = '🔎 Buscar solución';
            cargarStats();
        }
    }

    function botonCrear(etiqueta, texto) {
        const fila = document.createElement('div');
        fila.className = 'ia-acciones';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn-ia sec';
        b.textContent = etiqueta;
        b.addEventListener('click', () => crearTicketDesde(texto));
        fila.appendChild(b);
        return fila;
    }

    function mostrar(r, texto) {
        if (!r.suficiente) {
            resultado.innerHTML = '<div class="ia-vacio">No encontré información suficiente en la base de conocimiento para tu problema. ' +
                'Crea un ticket y el equipo de TI te ayudará.</div>';
            resultado.appendChild(botonCrear('Crear ticket con esta descripción', texto));
            return;
        }
        const pasos = r.pasos.length ? `<ol>${r.pasos.map(p => `<li>${esc(p)}</li>`).join('')}</ol>` : '';
        resultado.innerHTML = `
            <div class="ia-resp">${r.resumen ? `<p>${esc(r.resumen)}</p>` : ''}${pasos}</div>
            <div class="ia-fuentes"><b>Artículos de origen:</b>
                ${r.fuentes.map(f => `<span class="ia-chip">📄 ${esc(f.titulo)}</span>`).join('')}</div>
            <small class="ia-aviso">Respuesta generada por IA solo con los artículos de arriba. Verifica antes de aplicarla.</small>
            <div class="ia-acciones">
                <button type="button" class="btn-ia ok" id="iaResolvio">✅ Esto resolvió mi problema</button>
                <button type="button" class="btn-ia sec" id="iaNoResolvio">No resolvió mi problema, crear ticket</button>
            </div>`;
        document.getElementById('iaResolvio').addEventListener('click', () => resolver(r.consulta_id));
        document.getElementById('iaNoResolvio').addEventListener('click', () => crearTicketDesde(texto));
    }

    async function resolver(id) {
        try {
            await api(`/api/asistente/${id}/resolver`, { method: 'POST', json: {} });
        } catch (e) { avisar(e.message, 4000); return; }
        M2.consultaId = null;
        resultado.innerHTML = '<div class="ia-ok">🎉 ¡Qué bueno! Registramos tu consulta como resuelta, sin necesidad de ticket.</div>';
        consulta.value = '';
        cargarStats();
    }

    // «No resolvió mi problema»: se conserva la descripción original en el formulario
    function crearTicketDesde(texto) {
        const actual = descripcion.value.trim();
        if (!actual) descripcion.value = texto;
        else if (!actual.includes(texto)) descripcion.value = actual + '\n\n' + texto;
        delete descripcion.dataset.voz;
        if (!titulo.value.trim()) {
            let t = texto.split(/[.!?\n]/)[0].trim();
            if (t.length > 80) { t = t.slice(0, 80); t = t.slice(0, Math.max(t.lastIndexOf(' '), 20)).trim(); }
            titulo.value = t.charAt(0).toUpperCase() + t.slice(1);
        }
        avisar('Pasamos tu descripción al formulario. Revísala y registra el ticket.', 4000);
        titulo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        descripcion.focus();
    }

    // Lo llama modulo2.js cuando el ticket se registró correctamente
    function alCrearTicket() {
        M2.consultaId = null;
        resultado.innerHTML = '';
        consulta.value = '';
        cargarStats();
    }

    // ---------- estadísticas (Admin / Técnico) ----------
    async function cargarStats() {
        if (!yo || yo.rol_id === 3) return;
        try {
            const s = await api('/api/asistente/estadisticas');
            statsEl.hidden = false;
            statsEl.innerHTML = `📊 <b>Uso del asistente:</b> ${s.total} consultas · ` +
                `<b>${s.resueltas_sin_ticket}</b> resueltas sin ticket · <b>${s.terminaron_en_ticket}</b> terminaron en ticket` +
                (s.tasa_resolucion != null ? ` · <b>${s.tasa_resolucion}%</b> de las cerradas se resolvieron sin ticket` : '') +
                ` · ${s.sin_respuesta} sin respuesta`;
        } catch (e) { statsEl.hidden = true; }
    }

    // ---------- gestión de artículos (solo Administrador) ----------
    function abrirGestion() {
        let ov = document.getElementById('kbModal');
        if (!ov) {
            ov = document.createElement('div');
            ov.className = 'modal-overlay';
            ov.id = 'kbModal';
            ov.innerHTML = '<div class="modal-content"><button class="modal-close" type="button" aria-label="Cerrar">&times;</button><div id="kbBody"></div></div>';
            document.body.appendChild(ov);
            ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('active'); });
            ov.querySelector('.modal-close').addEventListener('click', () => ov.classList.remove('active'));
        }
        ov.classList.add('active');
        listarArticulos();
    }

    async function listarArticulos() {
        const body = document.getElementById('kbBody');
        body.innerHTML = '<p>Cargando…</p>';
        let arts;
        try { arts = await api('/api/kb/articulos'); } catch (e) { body.innerHTML = `<p>${esc(e.message)}</p>`; return; }
        body.innerHTML = `<h3>📚 Base de conocimiento</h3>
            <p class="ia-aviso">El asistente solo responde con estos artículos. Escribe los pasos tal como quieres que se los entregue a los usuarios.</p>
            <div class="fila"><button type="button" class="btn-ia" id="kbNuevo">➕ Nuevo artículo</button></div>
            <ul class="kb-lista">${arts.map(a => `<li><span>${esc(a.titulo)}</span>
                <span><button type="button" class="btn-icon" data-e="${a.id}">✏️ Editar</button>
                <button type="button" class="btn-icon delete" data-b="${a.id}">🗑️</button></span></li>`).join('') || '<li>No hay artículos.</li>'}</ul>`;
        document.getElementById('kbNuevo').addEventListener('click', () => formulario());
        body.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => formulario(arts.find(a => a.id == b.dataset.e))));
        body.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', async () => {
            if (!confirm('¿Quitar este artículo de la base de conocimiento?')) return;
            try { await api(`/api/kb/articulos/${b.dataset.b}`, { method: 'DELETE' }); } catch (e) { avisar(e.message, 4000); return; }
            listarArticulos();
        }));
    }

    function formulario(a) {
        const body = document.getElementById('kbBody');
        body.innerHTML = `<h3>${a ? '✏️ Editar artículo' : '➕ Nuevo artículo'}</h3>
            <form class="edit-mio" id="kbForm">
                <label>Título<input id="kbTitulo" maxlength="150" minlength="5" required value="${esc(a ? a.titulo : '')}"></label>
                <label>Palabras clave (separadas por espacios)<input id="kbClaves" maxlength="255" value="${esc(a ? a.palabras_clave : '')}"></label>
                <label>Contenido (pasos de solución)<textarea id="kbContenido" rows="8" minlength="20" maxlength="4000" required>${esc(a ? a.contenido : '')}</textarea></label>
                <div class="fila"><button type="submit" class="btn-primary" style="width:auto;padding:.6rem 1.4rem">Guardar</button>
                <button type="button" class="btn-icon" id="kbCancelar">Cancelar</button></div>
            </form>`;
        document.getElementById('kbCancelar').addEventListener('click', listarArticulos);
        document.getElementById('kbForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const json = { titulo: document.getElementById('kbTitulo').value, palabras_clave: document.getElementById('kbClaves').value,
                           contenido: document.getElementById('kbContenido').value };
            try {
                await api(a ? `/api/kb/articulos/${a.id}` : '/api/kb/articulos', { method: a ? 'PUT' : 'POST', json });
            } catch (err) { avisar(err.message, 4000); return; }
            avisar('Artículo guardado', 2000);
            listarArticulos();
        });
    }

    // ---------- inicio ----------
    cargarCatalogos().then(cat => {
        yo = cat.yo;
        if (yo.rol_id === 1) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn-ia sec ia-gestion';
            b.textContent = '📚 Gestionar artículos';
            b.addEventListener('click', abrirGestion);
            acciones.appendChild(b);
        }
        cargarStats();
    }).catch(() => { /* modulo2.js ya informa el error */ });
})();
