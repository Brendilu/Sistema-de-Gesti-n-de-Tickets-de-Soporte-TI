/* ==========================================================================
   modulo2_voz.js · Creación de tickets por voz (Web Speech API, en español)
   - Botón de dictado en el formulario de nuevo ticket.
   - El texto reconocido llena título y descripción; el usuario puede corregirlos.
   - Indicador de grabación, compatibilidad del navegador, permisos y errores.
   - El audio NO pasa por este sistema: lo procesa el motor de voz del navegador.
   ========================================================================== */
(function () {
    const btn = document.getElementById('btnVoz');
    if (!btn) return;
    const btnTxt = document.getElementById('btnVozTxt');
    const estadoEl = document.getElementById('vozEstado');
    const vivoEl = document.getElementById('vozVivo');
    const titulo = document.getElementById('titulo');
    const descripcion = document.getElementById('descripcion');
    const form = document.getElementById('ticketForm');
    const toast = document.getElementById('toast');

    const IDIOMA = 'es-PE';          // español (Perú); cambia a 'es-ES' o 'es-MX' si hace falta
    const MAX_SEGUNDOS = 60;         // corte automático para no dejar el micrófono abierto
    const CLAVE_CONSENTIMIENTO = 'm2_voz_consentimiento';

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    let rec = null, escuchando = false, finales = '', parcial = '', huboError = false, corte = null;

    // ---------- utilidades ----------
    function avisar(msg, ms = 3500) {
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show'), ms);
    }
    function estado(msg, tipo) {      // tipo: '' | 'ok' | 'warn' | 'error' | 'rec'
        estadoEl.textContent = msg || '';
        estadoEl.className = 'voz-estado' + (tipo ? ' voz-' + tipo : '');
    }
    function leerConsentimiento() {
        try { return localStorage.getItem(CLAVE_CONSENTIMIENTO) === '1'; } catch (e) { return false; }
    }
    function guardarConsentimiento() {
        try { localStorage.setItem(CLAVE_CONSENTIMIENTO, '1'); } catch (e) { /* sin almacenamiento: se pregunta cada vez */ }
    }
    const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    function limpiar(t) { return mayuscula(String(t || '').replace(/\s+/g, ' ').trim()); }

    // Asunto = primera frase, máx. ~80 caracteres cortados en límite de palabra
    function tituloDe(texto) {
        let frase = texto.split(/[.!?\n]/)[0].trim() || texto;
        if (frase.length > 80) {
            frase = frase.slice(0, 80);
            frase = frase.slice(0, Math.max(frase.lastIndexOf(' '), 20)).trim();
        }
        return mayuscula(frase);
    }

    function marcar(el) {
        el.classList.add('voz-relleno');
        setTimeout(() => el.classList.remove('voz-relleno'), 2500);
    }

    // ---------- compatibilidad ----------
    function bloquear(msg) {
        btn.disabled = true;
        btn.classList.add('voz-no');
        btnTxt.textContent = 'Dictado no disponible';
        estado(msg, 'warn');
    }
    if (!SR) {
        bloquear('Tu navegador no admite el reconocimiento de voz. Usa Chrome o Edge, o escribe el ticket a mano.');
        return;
    }
    if (!window.isSecureContext) {
        bloquear('El dictado necesita una conexión segura (HTTPS) o localhost. Escribe el ticket a mano.');
        return;
    }

    // ---------- interfaz de grabación ----------
    function ui(grabando) {
        escuchando = grabando;
        btn.classList.toggle('grabando', grabando);
        btn.setAttribute('aria-pressed', grabando ? 'true' : 'false');
        btnTxt.textContent = grabando ? 'Detener dictado' : 'Dictar incidencia';
        vivoEl.hidden = !grabando;
        if (grabando) { vivoEl.textContent = 'Habla ahora…'; estado('● Grabando… el micrófono está activo', 'rec'); }
    }

    // ---------- reconocimiento ----------
    function iniciar() {
        finales = ''; parcial = ''; huboError = false;
        rec = new SR();
        rec.lang = IDIOMA;
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        rec.onstart = () => {
            ui(true);
            clearTimeout(corte);
            corte = setTimeout(() => { if (escuchando) { avisar('Dictado detenido: máximo ' + MAX_SEGUNDOS + ' segundos.'); detener(); } }, MAX_SEGUNDOS * 1000);
        };
        rec.onresult = (e) => {
            parcial = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const r = e.results[i];
                if (r.isFinal) finales += r[0].transcript + ' ';
                else parcial += r[0].transcript;
            }
            vivoEl.textContent = (finales + parcial).trim() || 'Habla ahora…';
        };
        rec.onerror = (e) => {
            huboError = true;
            const m = {
                'not-allowed': 'Permiso de micrófono denegado. Actívalo en el candado de la barra de direcciones y vuelve a intentar.',
                'service-not-allowed': 'El navegador no permite el reconocimiento de voz en esta página (permiso denegado).',
                'audio-capture': 'No se encontró un micrófono disponible. Conéctalo y vuelve a intentar.',
                'no-speech': 'No se detectó voz. Habla más cerca del micrófono e inténtalo de nuevo.',
                'network': 'No se pudo contactar el servicio de reconocimiento de voz del navegador. Revisa tu conexión a internet.',
                'language-not-supported': 'Tu navegador no admite reconocimiento de voz en español.',
            }[e.error];
            if (e.error === 'aborted') return;   // lo provocó el propio usuario o el navegador
            estado(m || ('Error durante el reconocimiento de voz (' + e.error + ').'), 'error');
            avisar(m || 'Error durante el reconocimiento de voz.', 4500);
        };
        rec.onend = () => {
            clearTimeout(corte);
            ui(false);
            const texto = limpiar((finales + ' ' + parcial));
            if (huboError) return;                     // ya se explicó el error
            if (!texto) { estado('No se obtuvo ninguna transcripción. Intenta de nuevo hablando cerca del micrófono.', 'warn'); return; }
            aplicar(texto);
        };

        try {
            rec.start();
            estado('Solicitando acceso al micrófono…', '');
        } catch (err) {                               // p. ej. ya estaba iniciado
            ui(false);
            estado('No se pudo iniciar el dictado. Recarga la página e inténtalo de nuevo.', 'error');
        }
    }

    function detener() {
        if (rec) { try { rec.stop(); } catch (e) { /* ya detenido */ } }
    }

    // ---------- llenar el formulario (siempre editable) ----------
    function aplicar(texto) {
        const desc = descripcion.value.trim();
        if (!desc || descripcion.dataset.voz === '1') {
            descripcion.value = texto;
        } else {                                       // ya había texto escrito a mano: se agrega al final
            descripcion.value = desc + ' ' + texto;
        }
        descripcion.dataset.voz = '1';
        marcar(descripcion);

        if (!titulo.value.trim() || titulo.dataset.voz === '1') {
            const t = tituloDe(texto);
            titulo.value = t.length >= 5 ? t : '';
            titulo.dataset.voz = '1';
            marcar(titulo);
        }
        const faltaTitulo = titulo.value.trim().length < 5;
        estado(faltaTitulo
            ? '✅ Texto transcrito. Escribe un título de al menos 5 caracteres y revisa la descripción antes de registrar.'
            : '✅ Texto transcrito. Revisa y corrige el título y la descripción antes de registrar.', 'ok');
        (faltaTitulo ? titulo : descripcion).focus();
    }

    // Si la persona edita a mano, el campo deja de considerarse «llenado por voz»
    [titulo, descripcion].forEach(el => el.addEventListener('input', () => { delete el.dataset.voz; }));
    form.addEventListener('reset', () => {
        delete titulo.dataset.voz; delete descripcion.dataset.voz;
        estado('', ''); vivoEl.hidden = true;
    });

    // ---------- botón ----------
    btn.addEventListener('click', () => {
        if (escuchando) { detener(); return; }
        if (!leerConsentimiento()) {
            const ok = confirm(
                'Privacidad del dictado por voz\n\n' +
                'Al dictar, tu navegador captura el micrófono y envía el audio a su servicio de reconocimiento de voz ' +
                '(en Chrome o Edge normalmente es un servidor externo de Google o Microsoft). ' +
                'Este sistema NO guarda el audio: solo recibe el texto que tú revises y registres.\n\n' +
                'No menciones contraseñas ni datos personales. ¿Deseas continuar?');
            if (!ok) { estado('Dictado cancelado. Puedes escribir el ticket a mano.', ''); return; }
            guardarConsentimiento();
        }
        iniciar();
    });

    // Al salir de la página se suelta el micrófono
    window.addEventListener('pagehide', () => { if (rec && escuchando) { try { rec.abort(); } catch (e) { /* nada */ } } });
})();
