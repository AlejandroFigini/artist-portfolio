/* ============================================================================
   CMS LIGERO (PROTOTIPO FRONT-ONLY) — Gestor/editor de contenido + auditoría
   ----------------------------------------------------------------------------
   ⚠️ El login es un MOCK (credenciales en el cliente, flag en localStorage):
   sirve SOLO para validar la experiencia. La seguridad real llega con el
   backend C#/ASP.NET Core (hash de contraseñas, [Authorize], HTTPS, y la
   re-validación de archivos del lado del servidor).
   El contenido se carga de content.json (stand-in de la BD SQLite) y los
   cambios se guardan en localStorage (simulando PUT/POST a la futura API).
   ============================================================================ */
(function () {
    'use strict';

    // Las credenciales ya no están expuestas en el cliente.
    // Se validan contra el backend.

    var LS_ADMIN = 'cms_admin_v1';
    var LS_OVERRIDES = 'cms_overrides_v1';
    var LS_AUDIT = 'cms_audit_v1';
    var LS_MEDIA = 'cms_media_meta_v1';   // metadata de cada media subida (usadas)
    var LS_UNUSED = 'cms_unused_v1';       // media reemplazada (no usadas)
    var LS_ADDED = 'cms_added_illu_v1';    // ilustraciones agregadas por admin
    var LS_USED = 'cms_used_content_v1';   // TODO el contenido actual del sitio (originales + subidos)
    var LS_RETIRED = 'cms_retired_v1';     // claves de slots retirados (movidos a no usados, sin reemplazo)
    var MAX_BYTES = 25 * 1024 * 1024;

    // Helpers de campos de animación (preservan el icono al escribir texto)
    function txt(e) { return e ? e.textContent.trim() : ''; }
    function setTxtKeepIcon(e, v) {
        if (!e) return;
        var icon = e.querySelector('i');
        e.textContent = '';
        if (icon) { e.appendChild(icon); e.appendChild(document.createTextNode(' ')); }
        e.appendChild(document.createTextNode(v));
    }

    // Campos extra para las animaciones (metadata visible + info de pantalla completa)
    var ANIM_FIELDS = [
        { key: 'title',  label: 'Título',
          get: function (c) { return txt(c.querySelector('.video-title')); },
          set: function (c, v) { var e = c.querySelector('.video-title'); if (e) e.textContent = v; c.setAttribute('data-title', v); } },
        { key: 'date',   label: 'Fecha',
          get: function (c) { return txt(c.querySelector('.video-date')); },
          set: function (c, v) { setTxtKeepIcon(c.querySelector('.video-date'), v); } },
        { key: 'project',label: 'Proyecto',
          get: function (c) { return txt(c.querySelector('.video-project')); },
          set: function (c, v) { setTxtKeepIcon(c.querySelector('.video-project'), v); } },
        { key: 'fsdesc', label: 'Descripción (al ver en pantalla completa)', textarea: true,
          get: function (c) { return c.getAttribute('data-desc') || ''; },
          set: function (c, v) { c.setAttribute('data-desc', v); } }
    ];

    // Campos para ilustraciones: info de pantalla completa + link al repositorio
    var ILLU_FIELDS = [
        { key: 'title', label: 'Título',
          get: function (c) { return c.dataset.title || ''; }, set: function (c, v) { c.dataset.title = v; } },
        { key: 'desc', label: 'Descripción (al ver en pantalla completa)', textarea: true,
          get: function (c) { return c.dataset.desc || ''; }, set: function (c, v) { c.dataset.desc = v; } },
        { key: 'link', label: 'Link al repositorio (Instagram, ArtStation, etc.)',
          get: function (c) { return c.dataset.link || ''; }, set: function (c, v) { c.dataset.link = v; } }
    ];

    function charLabel(prefix) {
        return function (el) {
            var p = el.closest('.cd-panel');
            var n = p && p.querySelector('.cd-name');
            return prefix + (n ? ' — ' + n.textContent.trim() : '');
        };
    }

    // Registro de elementos editables: cobertura de toda la página
    var REGISTRY = [
        // Sobre mí
        { base: 'about.title', sel: 'h2[data-i18n="about_title"]', kind: 'text', mount: 'self', section: 'Sobre mí', label: 'Título — Sobre mí' },
        { base: 'about.desc',  sel: '.bio-content',               kind: 'text', mount: 'self', section: 'Sobre mí', label: 'Biografía — Sobre mí' },
        { base: 'about.photo', sel: '.artist-photo-img',          kind: 'image', accept: 'webp', mount: 'parent', section: 'Sobre mí', label: 'Foto de Lucía — Sobre mí' },
        { base: 'about.video', sel: '.about-video',               kind: 'video', accept: 'webm', mount: 'parent', section: 'Sobre mí', label: 'Video — Sobre mí' },
        // Subtítulos de sección
        { base: 'subtitle', sel: '.section-title p', kind: 'text', mount: 'self', section: 'Subtítulos', label: function (el) {
            var sec = el.closest('section'); var h = sec && sec.querySelector('.section-typewriter');
            return 'Subtítulo — ' + (h ? (h.dataset.text || h.textContent).trim() : 'sección'); } },
        // Character Design
        { base: 'char.name',     sel: '.cd-name',     kind: 'text',  mount: 'self', section: 'Character Design', label: function (el, i) { return 'Nombre de personaje #' + (i + 1); } },
        { base: 'char.role',     sel: '.cd-role',     kind: 'text',  mount: 'self', section: 'Character Design', label: charLabel('Rol de personaje') },
        { base: 'char.desc',     sel: '.cd-desc',     kind: 'text',  mount: 'self', section: 'Character Design', label: charLabel('Descripción de personaje') },
        { base: 'char.portrait', sel: '.cd-portrait', kind: 'image', accept: 'webp', mount: 'self', section: 'Character Design', label: charLabel('Retrato de personaje') },
        // Ilustraciones (se generan por JS → re-escaneo)
        { base: 'illu', sel: '#illustrations-container .gallery-item img', kind: 'image', accept: 'webp', mount: 'parent', section: 'Ilustraciones', dynamic: true, container: '.gallery-item', fields: ILLU_FIELDS, label: function (el, i) { return 'Ilustración #' + (i + 1); } },
        // Animations (video + metadata + descripción de pantalla completa)
        { base: 'anim', sel: '.animations-grid .anim-video', kind: 'video', accept: 'webm', mount: 'parent', section: 'Animations', container: '.animation-item', fields: ANIM_FIELDS, label: function (el, i) { return 'Animación #' + (i + 1); } },
        // 3D Models (videos)
        { base: 'model3d', sel: '.model-video-card .obs-video', kind: 'video', accept: 'webm', mount: 'parent', section: '3D Models', label: function (el, i) { return 'Video 3D #' + (i + 1); } }
    ];

    // ----- ESTADO -------------------------------------------------------------
    var items = {};            // clave -> valor (texto o dataURL)
    var elementsByKey = {};    // clave -> elemento
    var typeByKey = {};        // clave -> kind
    var metaByKey = {};        // clave -> { label, section, accept, fields, container }
    var fieldSetters = {};     // claveCampo -> function(value)
    var audit = [];
    var mediaMeta = {};        // clave -> { name, size, type, ts, label, section } (subidas)
    var unused = [];           // [{ src, dataUrl, name, size, type, ts, label, section }] (no usadas)
    var addedIllu = [];        // ilustraciones agregadas por admin
    var usedContent = {};      // clave -> { label, section, kind, src, name, size, original, fields } (TODO lo usado)
    var retired = [];          // [clave] slots retirados (ocultos del sitio, en "no usados")
    var isAdmin = false;

    function $(s, r) { return (r || document).querySelector(s); }
    function fmtBytes(n) {
        if (n == null) return '';
        if (n < 1024) return n + ' B';
        if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1048576).toFixed(2) + ' MB';
    }
    function resolveLabel(entry, el, i) { return typeof entry.label === 'function' ? entry.label(el, i) : entry.label; }

    function loadJSON(key, def) {
        try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); }
        catch (e) { return def; }
    }
    function persistOverrides() {
        try { 
            localStorage.setItem(LS_OVERRIDES, JSON.stringify(items)); 
            // Sync with backend API
            fetch('/api/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: items })
            }).catch(function(e) { console.error('Error saving to backend', e); });
            return true; 
        }
        catch (e) { return false; }
    }
    function persistAudit() {
        try { localStorage.setItem(LS_AUDIT, JSON.stringify(audit.slice(-300))); } catch (e) {}
    }
    function persistMedia() { try { localStorage.setItem(LS_MEDIA, JSON.stringify(mediaMeta)); } catch (e) {} }
    function persistUnused() { try { localStorage.setItem(LS_UNUSED, JSON.stringify(unused)); } catch (e) {} }
    function persistAdded() { try { localStorage.setItem(LS_ADDED, JSON.stringify(addedIllu)); } catch (e) {} }
    function persistUsed() { try { localStorage.setItem(LS_USED, JSON.stringify(usedContent)); } catch (e) {} }
    function persistRetired() { try { localStorage.setItem(LS_RETIRED, JSON.stringify(retired)); } catch (e) {} }

    // ----- REGISTRO DE CONTENIDO USADO (originales + subidos) -----------------
    function basename(src) {
        if (!src) return '';
        if (src.indexOf('data:') === 0) return '(archivo subido)';
        try { return decodeURIComponent(src.split('/').pop().split('?')[0]); }
        catch (e) { return src.split('/').pop(); }
    }
    function currentSrcOf(el) {
        if (!el) return '';
        if (el.tagName === 'IMG') return el.src;
        if (el.tagName === 'VIDEO') { var s = el.querySelector('source'); return s ? s.src : el.src; }
        if (el.getAttribute && el.getAttribute('data-full')) return el.getAttribute('data-full');
        var bg = (el.style && el.style.backgroundImage) || '';
        var m = bg.match(/url\(["']?(.*?)["']?\)/);
        return m ? m[1] : '';
    }
    // Campos de información (título/descr./link/etc.) con su valor actual.
    function computeFields(key, el, meta) {
        if (!meta.fields) return null;
        var cont = meta.container ? el.closest(meta.container) : el;
        return meta.fields.map(function (f) {
            var compositeKey = key + '::' + f.key;
            var val = (items[compositeKey] != null) ? items[compositeKey] : (cont ? f.get(cont) : '');
            return { key: f.key, label: f.label, textarea: !!f.textarea, value: val || '' };
        });
    }
    // Registra como "usado" cada elemento de media indexado que aún no esté.
    function seedUsedContent() {
        var changed = false;
        Object.keys(elementsByKey).forEach(function (key) {
            if (typeByKey[key] !== 'media') return;
            if (retired.indexOf(key) >= 0) return; // retirado: no re-sembrar
            var el = elementsByKey[key], meta = metaByKey[key];
            if (usedContent[key]) {
                // Migración: refrescar campos de info si faltan.
                if (meta.fields && !usedContent[key].fields) { usedContent[key].fields = computeFields(key, el, meta); changed = true; }
                return;
            }
            var src = currentSrcOf(el);
            var name = basename(src), size = null, original = true;
            var mm = mediaMeta[key];
            if (mm) { name = mm.name; size = mm.size; original = false; }
            else if (src.indexOf('data:') === 0) {
                var found = addedIllu.filter(function (a) { return a.dataUrl === src; })[0];
                if (found) { name = found.name; size = found.size; original = false; }
            }
            usedContent[key] = { key: key, label: meta.label, section: meta.section,
                kind: meta.kind, src: src, name: name, size: size, original: original,
                fields: computeFields(key, el, meta) };
            changed = true;
        });
        if (changed) persistUsed();
    }

    // Contenedor visible de un slot (para mostrar el estado "vacío" al retirar).
    function visualHost(key) {
        var el = elementsByKey[key]; if (!el) return null;
        return el.closest('.gallery-item, .animation-item, .model-video-card') || el.parentElement || el;
    }
    // Slot retirado: para el ADMIN se deja el contenedor con un botón de subir;
    // para visitantes se oculta del todo.
    function showEmptySlot(key) {
        var h = visualHost(key); if (!h) return;
        h.classList.add('cms-empty-slot');
        if (!h.querySelector('.cms-empty-overlay')) {
            var ov = document.createElement('div'); ov.className = 'cms-empty-overlay';
            ov.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i><span>Subir contenido</span>';
            ov.title = 'Subir contenido nuevo aquí';
            ov.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); editMedia(key); });
            h.appendChild(ov);
        }
    }
    function clearEmptySlot(key) {
        var h = visualHost(key); if (!h) return;
        h.classList.remove('cms-empty-slot');
        var ov = h.querySelector('.cms-empty-overlay'); if (ov) ov.remove();
    }
    function refreshRetired() {
        document.querySelectorAll('.cms-retired').forEach(function (e) { e.classList.remove('cms-retired'); });
        document.querySelectorAll('.cms-empty-slot').forEach(function (e) { e.classList.remove('cms-empty-slot'); });
        document.querySelectorAll('.cms-empty-overlay').forEach(function (e) { e.remove(); });
        retired.forEach(function (key) {
            var h = visualHost(key); if (!h) return;
            if (isAdmin) showEmptySlot(key);     // contenedor + botón de subir
            else h.classList.add('cms-retired');   // oculto para visitantes
        });
    }
    // Mueve un contenido usado a "no usados". Deja el slot vacío con botón de subir.
    function moveToUnused(key) {
        var entry = usedContent[key];
        if (!entry) {
            var el = elementsByKey[key], meta = metaByKey[key]; if (!meta) return;
            var s = currentSrcOf(el);
            entry = { key: key, label: meta.label, section: meta.section, kind: meta.kind, src: s, name: basename(s), size: null, original: true };
        }
        unused.push({ key: key, src: entry.src, dataUrl: entry.src, name: entry.name, size: entry.size,
            type: entry.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
            label: entry.label, section: entry.section, original: entry.original, reason: 'retired' });
        delete usedContent[key];
        if (retired.indexOf(key) < 0) retired.push(key);
        persistUnused(); persistUsed(); persistRetired();
        showEmptySlot(key);
        recordAudit({ section: entry.section, label: entry.label, kind: 'gestión', summary: 'Contenido movido a no usados' });
    }

    function recordAudit(entry) {
        audit.push({
            ts: Date.now(),
            user: 'Administrador',
            section: entry.section || '',
            label: entry.label || '',
            kind: entry.kind || '',
            summary: entry.summary || '',
            file: entry.file || null
        });
        persistAudit();
    }

    // ----- APLICAR VALORES ----------------------------------------------------
    function applyValue(el, type, value) {
        if (!el || value == null) return;
        if (type === 'text') {
            var keep = el.querySelector(':scope > .cms-edit-btn');
            el.textContent = value;
            if (keep) el.appendChild(keep);
        } else if (type === 'image') {
            el.removeAttribute('srcset'); el.src = value;
        } else if (type === 'bg' || (type === 'image' && el.tagName !== 'IMG')) {
            el.style.backgroundImage = 'url("' + value + '")';
            if (el.hasAttribute('data-full')) el.setAttribute('data-full', value);
        } else if (type === 'video') {
            var s = el.querySelector('source'); if (s) s.src = value; else el.src = value;
            try { el.load(); el.play && el.play().catch(function () {}); } catch (e) {}
        }
    }
    // .cd-portrait usa background-image (no es <img>)
    function applyMedia(key, value) {
        var el = elementsByKey[key]; if (!el) return;
        if (el.tagName === 'IMG') applyValue(el, 'image', value);
        else if (el.tagName === 'VIDEO') applyValue(el, 'video', value);
        else applyValue(el, 'bg', value);
    }
    function applyStored(key, value) {
        if (fieldSetters[key]) { fieldSetters[key](value); return; }
        var el = elementsByKey[key]; if (!el) return;
        if (typeByKey[key] === 'text') applyValue(el, 'text', value);
        else applyMedia(key, value);
    }

    // ----- INDEXAR + HIDRATAR -------------------------------------------------
    function indexEditables() {
        REGISTRY.forEach(function (entry) {
            document.querySelectorAll(entry.sel).forEach(function (el, i) {
                if (el.getAttribute('data-cms-key')) return; // ya indexado
                var key = entry.base + '#' + i;
                el.setAttribute('data-cms-key', key);
                elementsByKey[key] = el;
                typeByKey[key] = entry.kind === 'image' ? 'media' : (entry.kind === 'video' ? 'media' : 'text');
                metaByKey[key] = {
                    label: resolveLabel(entry, el, i),
                    section: entry.section,
                    kind: entry.kind,
                    accept: entry.accept,
                    fields: entry.fields,
                    container: entry.container
                };
                // registrar setters de campos
                if (entry.fields) {
                    var cont = entry.container ? el.closest(entry.container) : el;
                    entry.fields.forEach(function (f) {
                        (function (fld, c) {
                            fieldSetters[key + '::' + fld.key] = function (v) { fld.set(c, v); };
                        })(f, cont);
                    });
                }
            });
        });
    }

    function hydrate() {
        Object.keys(items).forEach(function (key) { applyStored(key, items[key]); });
    }

    // ----- VALIDACIÓN DE ARCHIVOS --------------------------------------------
    function readHeader(file, n) {
        return new Promise(function (res, rej) {
            var r = new FileReader();
            r.onload = function () { res(new Uint8Array(r.result)); };
            r.onerror = rej; r.readAsArrayBuffer(file.slice(0, n));
        });
    }
    function validateFile(file, accept) {
        return readHeader(file, 16).then(function (b) {
            var name = (file.name || '').toLowerCase();
            if (file.size > MAX_BYTES) return 'El archivo supera el límite de 25 MB.';
            if (accept === 'webp') {
                if (!name.endsWith('.webp')) return 'Debe ser un archivo .webp';
                if (!(b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50))
                    return 'No es un WEBP válido (cabecera incorrecta).';
            } else if (accept === 'webm') {
                if (!name.endsWith('.webm')) return 'Debe ser un archivo .webm';
                if (!(b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3))
                    return 'No es un WEBM válido (cabecera incorrecta).';
            }
            return null;
        });
    }
    function fileToDataURL(file) {
        return new Promise(function (res, rej) {
            var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(file);
        });
    }

    // ----- UI: toasts + modales ----------------------------------------------
    function toast(msg, kind) {
        var t = document.createElement('div');
        t.className = 'cms-toast' + (kind === 'error' ? ' cms-toast--error' : '');
        t.textContent = msg; document.body.appendChild(t);
        requestAnimationFrame(function () { t.classList.add('show'); });
        setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 3400);
    }
    function modal(title, bodyEl, actions, wide) {
        var ov = document.createElement('div'); ov.className = 'cms-modal-overlay';
        var m = document.createElement('div'); m.className = 'cms-modal' + (wide ? ' cms-modal--wide' : '');
        var h = document.createElement('h3'); h.className = 'cms-modal-title'; h.textContent = title; m.appendChild(h);
        m.appendChild(bodyEl);
        var foot = document.createElement('div'); foot.className = 'cms-modal-actions';
        (actions || []).forEach(function (a) {
            var b = document.createElement('button'); b.type = 'button';
            b.className = 'cms-btn' + (a.primary ? ' cms-btn--primary' : '');
            b.textContent = a.label; b.addEventListener('click', function () { a.onClick(ov); }); foot.appendChild(b);
        });
        m.appendChild(foot); ov.appendChild(m);
        ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(ov); });
        document.body.appendChild(ov);
        document.body.classList.add('cms-modal-open'); // bloquea el scroll de fondo
        requestAnimationFrame(function () { ov.classList.add('show'); });
        return ov;
    }
    function closeModal(ov) {
        ov.classList.remove('show');
        setTimeout(function () {
            ov.remove();
            // Solo desbloquear si no queda otro modal abierto.
            if (!document.querySelector('.cms-modal-overlay')) document.body.classList.remove('cms-modal-open');
        }, 250);
    }

    // ----- EDICIÓN DE TEXTO ---------------------------------------------------
    function editText(key) {
        var el = elementsByKey[key], meta = metaByKey[key];
        var ta = document.createElement('textarea'); ta.className = 'cms-textarea'; ta.rows = 4;
        ta.value = (items[key] != null ? items[key] : el.textContent).trim();
        var info = document.createElement('p'); info.className = 'cms-meta-line';
        info.innerHTML = '<strong>Contenedor:</strong> ' + meta.label + ' &nbsp;·&nbsp; <strong>Sección:</strong> ' + meta.section;
        var wrap = document.createElement('div'); wrap.appendChild(info); wrap.appendChild(ta);
        modal('Editar texto', wrap, [
            { label: 'Cancelar', onClick: closeModal },
            { label: 'Guardar', primary: true, onClick: function (ov) {
                items[key] = ta.value; applyValue(el, 'text', ta.value); persistOverrides();
                recordAudit({ section: meta.section, label: meta.label, kind: 'texto', summary: 'Texto actualizado' });
                closeModal(ov); toast('Texto actualizado');
            } }
        ]);
        ta.focus();
    }

    // ----- EDICIÓN DE MEDIA (modal enriquecido) ------------------------------
    function editMedia(key) {
        var meta = metaByKey[key];
        var accept = meta.accept;
        var pending = { file: null, dataUrl: null, objUrl: null };

        var body = document.createElement('div'); body.className = 'cms-upload';

        // cabecera: sección + contenedor
        var head = document.createElement('div'); head.className = 'cms-up-head';
        head.innerHTML = '<div class="cms-meta-line"><strong>Sección:</strong> ' + meta.section + '</div>' +
                         '<div class="cms-meta-line"><strong>Contenedor:</strong> ' + meta.label + '</div>' +
                         '<div class="cms-meta-line cms-up-accept"><strong>Formato:</strong> ' +
                         (accept === 'webp' ? 'imagen .webp' : 'video .webm') + ' (máx 25 MB)</div>';
        body.appendChild(head);

        // zona de preview
        var preview = document.createElement('div'); preview.className = 'cms-up-preview';
        preview.innerHTML = '<span class="cms-up-empty">Sin archivo seleccionado</span>';
        body.appendChild(preview);

        // info del archivo (peso)
        var fileInfo = document.createElement('div'); fileInfo.className = 'cms-up-fileinfo';
        body.appendChild(fileInfo);

        // botón de selección
        var pick = document.createElement('button'); pick.type = 'button'; pick.className = 'cms-btn';
        pick.textContent = 'Seleccionar ' + (accept === 'webp' ? '.webp' : '.webm');
        body.appendChild(pick);

        var input = document.createElement('input'); input.type = 'file';
        input.accept = accept === 'webp' ? '.webp,image/webp' : '.webm,video/webm';
        input.style.display = 'none'; body.appendChild(input);

        pick.addEventListener('click', function () { input.click(); });
        input.addEventListener('change', function () {
            var f = input.files && input.files[0]; if (!f) return;
            validateFile(f, accept).then(function (err) {
                if (err) { toast(err, 'error'); return; }
                if (pending.objUrl) URL.revokeObjectURL(pending.objUrl);
                pending.file = f; pending.objUrl = URL.createObjectURL(f);
                preview.innerHTML = '';
                if (accept === 'webp') {
                    var img = document.createElement('img'); img.src = pending.objUrl; preview.appendChild(img);
                } else {
                    var v = document.createElement('video'); v.src = pending.objUrl; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; preview.appendChild(v);
                }
                fileInfo.innerHTML = '<strong>Archivo:</strong> ' + f.name + ' &nbsp;·&nbsp; <strong>Peso:</strong> ' + fmtBytes(f.size) +
                                     ' &nbsp;·&nbsp; <strong>Tipo:</strong> ' + (f.type || '—');
            });
        });

        // campos requeridos (animaciones, etc.)
        var fieldInputs = [];
        if (meta.fields) {
            var cont = elementsByKey[key].closest(meta.container);
            var fieldsWrap = document.createElement('div'); fieldsWrap.className = 'cms-up-fields';
            fieldsWrap.innerHTML = '<div class="cms-fields-title">Datos del contenido</div>';
            meta.fields.forEach(function (f) {
                var compositeKey = key + '::' + f.key;
                var current = items[compositeKey] != null ? items[compositeKey] : f.get(cont);
                var lab = document.createElement('label'); lab.className = 'cms-field';
                var span = document.createElement('span'); span.textContent = f.label; lab.appendChild(span);
                var inp = f.textarea ? document.createElement('textarea') : document.createElement('input');
                if (f.textarea) inp.rows = 2; else inp.type = 'text';
                inp.value = current || '';
                lab.appendChild(inp); fieldsWrap.appendChild(lab);
                fieldInputs.push({ f: f, inp: inp, compositeKey: compositeKey, cont: cont });
            });
            body.appendChild(fieldsWrap);
        }

        modal('Editar contenido', body, [
            { label: 'Cancelar', onClick: function (ov) { if (pending.objUrl) URL.revokeObjectURL(pending.objUrl); closeModal(ov); } },
            { label: 'Guardar', primary: true, onClick: function (ov) {
                var anyChange = false;
                var finish = function () {
                    // guardar campos
                    fieldInputs.forEach(function (fi) {
                        var v = fi.inp.value;
                        var prev = items[fi.compositeKey] != null ? items[fi.compositeKey] : fi.f.get(fi.cont);
                        if (v !== prev) {
                            items[fi.compositeKey] = v; fi.f.set(fi.cont, v);
                            recordAudit({ section: meta.section, label: meta.label, kind: 'metadata', summary: 'Campo "' + fi.f.label + '" actualizado' });
                            anyChange = true;
                        }
                    });
                    persistOverrides();
                    if (pending.objUrl) URL.revokeObjectURL(pending.objUrl);
                    closeModal(ov);
                    if (anyChange) toast('Contenido actualizado'); else toast('Sin cambios');
                };
                if (pending.file) {
                    fileToDataURL(pending.file).then(function (dataUrl) {
                        // La versión anterior (sea original del sitio o una subida previa)
                        // pasa a "no usados", para poder eliminarla y liberar espacio.
                        var prev = usedContent[key];
                        if (prev) {
                            unused.push({ key: key, src: prev.src, dataUrl: prev.src, name: prev.name, size: prev.size,
                                type: prev.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
                                label: prev.label, section: prev.section, original: prev.original, reason: 'replaced' });
                            persistUnused();
                        }
                        items[key] = dataUrl; applyMedia(key, dataUrl);
                        mediaMeta[key] = { name: pending.file.name, size: pending.file.size, type: pending.file.type,
                            ts: Date.now(), label: meta.label, section: meta.section };
                        persistMedia();
                        // La nueva versión pasa a "usados".
                        usedContent[key] = { key: key, label: meta.label, section: meta.section, kind: meta.kind,
                            src: dataUrl, name: pending.file.name, size: pending.file.size, original: false };
                        persistUsed();
                        // Si el slot estaba retirado (vacío), restaurarlo con el contenido nuevo.
                        var ri = retired.indexOf(key); if (ri >= 0) { retired.splice(ri, 1); persistRetired(); }
                        clearEmptySlot(key);
                        var ok = persistOverrides();
                        recordAudit({ section: meta.section, label: meta.label, kind: (accept === 'webp' ? 'imagen' : 'video'),
                            summary: (accept === 'webp' ? 'Imagen' : 'Video') + ' reemplazado',
                            file: { name: pending.file.name, size: pending.file.size, type: pending.file.type } });
                        anyChange = true;
                        if (!ok) toast('Media aplicada solo en esta sesión (archivo grande).', 'error');
                        finish();
                    });
                } else { finish(); }
            } }
        ], true);
    }

    // ----- EDITAR SOLO INFORMACIÓN (campos) DESDE LA PÁGINA -------------------
    function editInfoPage(key) {
        var meta = metaByKey[key];
        if (!meta.fields) { toast('Este contenido no tiene información editable'); return; }
        var cont = meta.container ? elementsByKey[key].closest(meta.container) : elementsByKey[key];
        var body = document.createElement('div'); body.className = 'cms-upload';
        var head = document.createElement('div'); head.className = 'cms-up-head';
        head.innerHTML = '<div class="cms-meta-line"><strong>Sección:</strong> ' + meta.section + '</div>' +
                         '<div class="cms-meta-line"><strong>Contenido:</strong> ' + meta.label + '</div>';
        body.appendChild(head);
        var wrap = document.createElement('div'); wrap.className = 'cms-up-fields';
        wrap.innerHTML = '<div class="cms-fields-title">Información (se muestra en pantalla completa)</div>';
        var inputs = [];
        meta.fields.forEach(function (f) {
            var compositeKey = key + '::' + f.key;
            var cur = items[compositeKey] != null ? items[compositeKey] : f.get(cont);
            var lab = document.createElement('label'); lab.className = 'cms-field';
            var sp = document.createElement('span'); sp.textContent = f.label; lab.appendChild(sp);
            var inp = f.textarea ? document.createElement('textarea') : document.createElement('input');
            if (f.textarea) inp.rows = 2; else inp.type = 'text';
            inp.value = cur || ''; lab.appendChild(inp); wrap.appendChild(lab);
            inputs.push({ f: f, inp: inp, compositeKey: compositeKey, cur: cur || '' });
        });
        body.appendChild(wrap);
        modal('Editar información', body, [
            { label: 'Cancelar', onClick: closeModal },
            { label: 'Guardar', primary: true, onClick: function (ov) {
                var changed = false;
                inputs.forEach(function (x) {
                    var v = x.inp.value;
                    if (v !== x.cur) {
                        items[x.compositeKey] = v; x.f.set(cont, v);
                        if (usedContent[key] && usedContent[key].fields) {
                            var ff = usedContent[key].fields.filter(function (z) { return z.key === x.f.key; })[0];
                            if (ff) ff.value = v;
                        }
                        recordAudit({ section: meta.section, label: meta.label, kind: 'metadata', summary: 'Campo "' + x.f.label + '" actualizado' });
                        changed = true;
                    }
                });
                persistOverrides(); persistUsed();
                closeModal(ov); toast(changed ? 'Información actualizada' : 'Sin cambios');
            } }
        ], true);
    }

    // Confirmación con estilo propio para mover a no usados (no usa confirm()).
    function confirmMovePage(key) {
        var meta = metaByKey[key];
        var body = document.createElement('div'); body.className = 'cms-confirm-body';
        body.innerHTML = 'Vas a mover «<strong>' + meta.label + '</strong>» a <strong>contenidos no usados</strong>.' +
            '<div class="cms-confirm-warn"><i class="fa-solid fa-triangle-exclamation"></i> Se quitará del sitio; el espacio queda libre para subir otro contenido. Podrás restaurarlo desde Gestión.</div>';
        modal('Mover a no usados', body, [
            { label: 'Cancelar', onClick: closeModal },
            { label: 'Mover a no usados', primary: true, onClick: function (ov) { closeModal(ov); moveToUnused(key); toast('Movido a no usados'); } }
        ]);
    }

    // ----- BOTONES DE EDICIÓN -------------------------------------------------
    function ensurePositioned(el) { if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; }
    function toolBtn(icon, title, extra, onClick) {
        var b = document.createElement('button'); b.type = 'button';
        b.className = 'cms-edit-btn cms-tool-btn' + (extra ? ' ' + extra : '');
        b.innerHTML = '<i class="fa-solid ' + icon + '"></i>';
        b.title = title; b.setAttribute('aria-label', title);
        b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); onClick(); });
        return b;
    }
    // Cada media (ilustración/animación/etc.) tiene su barra de herramientas:
    // editar información (si tiene campos), reemplazar (subir) y mover a no usados.
    function makeTools(key) {
        var meta = metaByKey[key];
        var tools = document.createElement('div'); tools.className = 'cms-tools';
        if (meta.kind === 'text') {
            tools.appendChild(toolBtn('fa-pen', 'Editar: ' + meta.label, 'cms-tool-edit', function () { editText(key); }));
            return tools;
        }
        if (meta.fields) tools.appendChild(toolBtn('fa-pen', 'Editar información: ' + meta.label, 'cms-tool-edit', function () { editInfoPage(key); }));
        tools.appendChild(toolBtn('fa-arrow-up-from-bracket', 'Reemplazar: ' + meta.label, 'cms-tool-replace', function () { editMedia(key); }));
        tools.appendChild(toolBtn('fa-box-archive', 'Mover a no usados: ' + meta.label, 'cms-tool-move', function () { confirmMovePage(key); }));
        return tools;
    }
    function attachEditControls() {
        REGISTRY.forEach(function (entry) {
            document.querySelectorAll(entry.sel).forEach(function (el) {
                var key = el.getAttribute('data-cms-key');
                if (!key || el.getAttribute('data-cms-has-btn') === '1') return;
                var host = (entry.mount === 'parent' && el.parentElement) ? el.parentElement : el;
                host.classList.add('cms-mount'); ensurePositioned(host); host.appendChild(makeTools(key));
                el.setAttribute('data-cms-has-btn', '1');
            });
        });
    }
    function removeEditControls() {
        document.querySelectorAll('.cms-tools').forEach(function (b) { b.remove(); });
        document.querySelectorAll('[data-cms-has-btn]').forEach(function (e) { e.removeAttribute('data-cms-has-btn'); });
        document.querySelectorAll('.cms-mount').forEach(function (e) { e.classList.remove('cms-mount'); });
    }

    // ----- AUTENTICACIÓN (MOCK) ----------------------------------------------
    function setAdmin(on) {
        isAdmin = on;
        document.body.classList.toggle('is-admin', on);
        try { localStorage.setItem(LS_ADMIN, on ? '1' : '0'); } catch (e) {}
        if (on) { indexEditables(); seedUsedContent(); attachEditControls(); addGallerySlots(); }
        else { removeEditControls(); removeGallerySlots(); }
        refreshRetired(); // empty-slot (admin) vs oculto (visitante)
        renderAuth();
    }
    function doLogin(u, p, c, overlay) {
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: u, pass: p, code: c })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                setAdmin(true);
                if (overlay) closeModal(overlay);
                toast('Sesión iniciada correctamente');
            } else {
                toast(data.error || 'Usuario o contraseña incorrectos', 'error');
            }
        })
        .catch(function(e) {
            console.error(e);
            toast('Error de conexión con el servidor', 'error');
        });
    }
    function openLogin() {
        var w = document.createElement('div'); w.className = 'cms-login-form';
        w.innerHTML =
            '<label class="cms-field"><span>Usuario</span><input type="text" id="cms-user" autocomplete="off"></label>' +
            '<label class="cms-field"><span>Contraseña</span><input type="password" id="cms-pass"></label>' +
            '<label class="cms-field"><span>Código 2FA (Google Authenticator)</span><input type="text" id="cms-code" autocomplete="off" placeholder="123456" maxlength="6"></label>' +
            '<p class="cms-hint">Ingresa tus credenciales para administrar el sitio.</p>';
        var ov = modal('Acceso de administrador', w, [
            { label: 'Cancelar', onClick: closeModal },
            { label: 'Entrar', primary: true, onClick: function (overlay) {
                doLogin($('#cms-user', w).value.trim(), $('#cms-pass', w).value, $('#cms-code', w).value.trim(), overlay);
            } }
        ]);
        var codeInp = $('#cms-code', w);
        if (codeInp) codeInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') ov.querySelector('.cms-btn--primary').click(); });
    }
    function openExport() {
        var ta = document.createElement('textarea'); ta.className = 'cms-textarea'; ta.readOnly = true; ta.rows = 12;
        ta.value = JSON.stringify({ version: 1, items: items }, null, 2);
        modal('Contenido (lo que el backend guardaría)', ta, [
            { label: 'Copiar', onClick: function () { ta.select(); try { document.execCommand('copy'); toast('Copiado'); } catch (e) {} } },
            { label: 'Cerrar', primary: true, onClick: closeModal }
        ], true);
    }

    function renderAuth() {
        // Solo el botón de la navbar (el de settings fue removido)
        var nav = document.getElementById('cms-auth-nav');
        if (!nav) return;
        nav.innerHTML = '';
        // Sesión iniciada: mostrar con qué usuario, al lado del botón.
        if (isAdmin) {
            var chip = document.createElement('span');
            chip.className = 'cms-user-chip';
            chip.innerHTML = '<i class="fa-solid fa-user-shield"></i> Administrador';
            chip.title = 'Sesión iniciada como Administrador';
            nav.appendChild(chip);
        }
        var b = document.createElement('button'); b.type = 'button'; b.className = 'cms-navauth-btn';
        if (isAdmin) {
            b.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Salir';
            b.title = 'Cerrar sesión';
            b.addEventListener('click', function () { setAdmin(false); toast('Sesión cerrada'); });
        } else {
            b.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Iniciar sesión';
            b.addEventListener('click', openLogin);
        }
        nav.appendChild(b);
    }

    // ----- PÁGINA DE AUDITORÍA (solo superadmin) -----------------------------
    function fmtDate(ts) {
        var d = new Date(ts);
        function p(x) { return ('0' + x).slice(-2); }
        return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
    function openAuditPage() {
        if (!isAdmin) { toast('Solo el superadmin puede ver la gestión', 'error'); return; }
        var ov = document.createElement('div'); ov.className = 'cms-admin-overlay';
        var rows = audit.slice().reverse().map(function (a) {
            var fileTxt = a.file ? (a.file.name + ' (' + fmtBytes(a.file.size) + ', ' + (a.file.type || '—') + ')') : '—';
            return '<tr>' +
                '<td>' + fmtDate(a.ts) + '</td>' +
                '<td>' + a.user + '</td>' +
                '<td>' + a.section + '</td>' +
                '<td>' + a.label + '</td>' +
                '<td>' + a.summary + '</td>' +
                '<td>' + fileTxt + '</td>' +
            '</tr>';
        }).join('');
        if (!rows) rows = '<tr><td colspan="6" class="cms-audit-empty">Todavía no hay cambios registrados.</td></tr>';
        ov.innerHTML =
            '<div class="cms-admin-panel">' +
                '<div class="cms-admin-head">' +
                    '<h2><i class="fa-solid fa-clipboard-list"></i> Gestión — Auditoría de cambios</h2>' +
                    '<div class="cms-admin-head-actions">' +
                        '<button type="button" class="cms-btn cms-btn--sm" id="cms-audit-clear">Vaciar registro</button>' +
                        '<button type="button" class="cms-btn cms-btn--sm cms-btn--primary" id="cms-audit-close">Cerrar</button>' +
                    '</div>' +
                '</div>' +
                '<p class="cms-admin-sub">' + audit.length + ' cambio(s) registrado(s). (En producción esto vendrá de la BD vía el backend.)</p>' +
                '<div class="cms-audit-table-wrap"><table class="cms-audit-table"><thead><tr>' +
                    '<th>Fecha</th><th>Usuario</th><th>Sección</th><th>Contenedor</th><th>Qué cambió</th><th>Archivo</th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '</div>';
        document.body.appendChild(ov);
        requestAnimationFrame(function () { ov.classList.add('show'); });
        $('#cms-audit-close', ov).addEventListener('click', function () { ov.classList.remove('show'); setTimeout(function () { ov.remove(); }, 250); });
        $('#cms-audit-clear', ov).addEventListener('click', function () {
            audit = []; persistAudit(); ov.remove(); toast('Registro vaciado'); openAuditPage();
        });
    }

    // ----- GALERÍA: agregadas por admin + slots para agregar -----------------
    function createGalleryItem(src, title, desc, link) {
        var item = document.createElement('div');
        item.className = 'gallery-item fade-in visible cms-added';
        item.dataset.title = title || 'Ilustración';
        item.dataset.desc = desc || '';
        item.dataset.link = link || '';
        // img-loaded: la grilla oculta las imágenes con opacity:0 hasta cargar.
        // Como se agrega dinámicamente (después de enhanceImages), la marcamos
        // cargada para que se vea minimizada (no solo en pantalla completa).
        item.innerHTML = '<div class="drift-wrapper" style="width:100%;height:100%;">' +
            '<img src="' + src + '" alt="' + (title || '') + '" class="img-loaded" decoding="async">' +
            '<div class="gallery-overlay"><button class="expand-btn">' +
            '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>' +
            '</button></div></div>';
        item.addEventListener('click', function () {
            var cur = item.querySelector('img');
            if (typeof window.openLightbox === 'function')
                window.openLightbox(cur ? cur.src : src, item.dataset.title, item.dataset.desc, item.dataset.link);
        });
        return item;
    }
    function renderAddedIllu() {
        var grid = document.getElementById('illustrations-container');
        if (!grid) return;
        addedIllu.forEach(function (a) {
            if (grid.querySelector('[data-added-id="' + a.id + '"]')) return;
            var item = createGalleryItem(a.dataUrl, a.title, a.desc, a.link);
            item.setAttribute('data-added-id', a.id);
            var slot = grid.querySelector('.cms-add-slot');
            if (slot) grid.insertBefore(item, slot); else grid.appendChild(item);
        });
    }
    function addGallerySlots() {
        var grid = document.getElementById('illustrations-container');
        if (!grid || grid.querySelector('.cms-add-slot')) return;
        for (var i = 0; i < 3; i++) {
            var slot = document.createElement('button');
            slot.type = 'button'; slot.className = 'cms-add-slot';
            slot.innerHTML = '<i class="fa-solid fa-plus"></i><span>Agregar ilustración</span>';
            slot.addEventListener('click', openAddIllustration);
            grid.appendChild(slot);
        }
    }
    function removeGallerySlots() { document.querySelectorAll('.cms-add-slot').forEach(function (s) { s.remove(); }); }

    function openAddIllustration() {
        var pending = { file: null, objUrl: null };
        var body = document.createElement('div'); body.className = 'cms-upload';
        var head = document.createElement('div'); head.className = 'cms-up-head';
        head.innerHTML = '<div class="cms-meta-line"><strong>Sección:</strong> Ilustraciones</div>' +
            '<div class="cms-meta-line"><strong>Acción:</strong> Agregar nueva ilustración</div>' +
            '<div class="cms-meta-line cms-up-accept"><strong>Formato:</strong> imagen .webp (máx 25 MB)</div>';
        body.appendChild(head);
        var preview = document.createElement('div'); preview.className = 'cms-up-preview';
        preview.innerHTML = '<span class="cms-up-empty">Sin archivo seleccionado</span>'; body.appendChild(preview);
        var fileInfo = document.createElement('div'); fileInfo.className = 'cms-up-fileinfo'; body.appendChild(fileInfo);
        var pick = document.createElement('button'); pick.type = 'button'; pick.className = 'cms-btn'; pick.textContent = 'Seleccionar .webp'; body.appendChild(pick);
        var input = document.createElement('input'); input.type = 'file'; input.accept = '.webp,image/webp'; input.style.display = 'none'; body.appendChild(input);
        pick.addEventListener('click', function () { input.click(); });
        input.addEventListener('change', function () {
            var f = input.files && input.files[0]; if (!f) return;
            validateFile(f, 'webp').then(function (err) {
                if (err) { toast(err, 'error'); return; }
                if (pending.objUrl) URL.revokeObjectURL(pending.objUrl);
                pending.file = f; pending.objUrl = URL.createObjectURL(f);
                preview.innerHTML = ''; var img = document.createElement('img'); img.src = pending.objUrl; preview.appendChild(img);
                fileInfo.innerHTML = '<strong>Archivo:</strong> ' + f.name + ' &nbsp;·&nbsp; <strong>Peso:</strong> ' + fmtBytes(f.size);
            });
        });
        var fieldsWrap = document.createElement('div'); fieldsWrap.className = 'cms-up-fields';
        fieldsWrap.innerHTML = '<div class="cms-fields-title">Datos del contenido</div>';
        var inputs = {};
        ILLU_FIELDS.forEach(function (f) {
            var lab = document.createElement('label'); lab.className = 'cms-field';
            var span = document.createElement('span'); span.textContent = f.label; lab.appendChild(span);
            var inp = f.textarea ? document.createElement('textarea') : document.createElement('input');
            if (f.textarea) inp.rows = 2; else inp.type = 'text';
            lab.appendChild(inp); fieldsWrap.appendChild(lab); inputs[f.key] = inp;
        });
        body.appendChild(fieldsWrap);

        modal('Agregar ilustración', body, [
            { label: 'Cancelar', onClick: function (ov) { if (pending.objUrl) URL.revokeObjectURL(pending.objUrl); closeModal(ov); } },
            { label: 'Agregar', primary: true, onClick: function (ov) {
                if (!pending.file) { toast('Seleccioná una imagen .webp', 'error'); return; }
                fileToDataURL(pending.file).then(function (dataUrl) {
                    var entry = { id: 'illu_added_' + Date.now(), dataUrl: dataUrl,
                        title: inputs.title.value || 'Ilustración', desc: inputs.desc.value || '', link: inputs.link.value || '',
                        name: pending.file.name, size: pending.file.size, type: pending.file.type, ts: Date.now() };
                    addedIllu.push(entry); persistAdded();
                    mediaMeta['added:' + entry.id] = { name: entry.name, size: entry.size, type: entry.type, ts: entry.ts,
                        label: 'Ilustración agregada — ' + entry.title, section: 'Ilustraciones' };
                    persistMedia();
                    var grid = document.getElementById('illustrations-container');
                    var item = createGalleryItem(entry.dataUrl, entry.title, entry.desc, entry.link);
                    item.setAttribute('data-added-id', entry.id);
                    var slot = grid.querySelector('.cms-add-slot');
                    if (slot) grid.insertBefore(item, slot); else grid.appendChild(item);
                    rescan();
                    seedUsedContent(); // registrar la nueva ilustración como contenido usado
                    recordAudit({ section: 'Ilustraciones', label: 'Ilustración agregada — ' + entry.title, kind: 'imagen',
                        summary: 'Ilustración agregada', file: { name: entry.name, size: entry.size, type: entry.type } });
                    if (pending.objUrl) URL.revokeObjectURL(pending.objUrl);
                    closeModal(ov); toast('Ilustración agregada');
                });
            } }
        ], true);
    }

    // ----- INIT ---------------------------------------------------------------
    function rescan() { if (isAdmin) { indexEditables(); attachEditControls(); } else { indexEditables(); } refreshRetired(); }

    function init() {
        audit = loadJSON(LS_AUDIT, []);
        mediaMeta = loadJSON(LS_MEDIA, {});
        unused = loadJSON(LS_UNUSED, []);
        addedIllu = loadJSON(LS_ADDED, []);
        usedContent = loadJSON(LS_USED, {});
        retired = loadJSON(LS_RETIRED, []);
        renderAddedIllu();   // ilustraciones agregadas por admin (las ven todos)
        indexEditables();
        refreshRetired();    // ocultar lo retirado (vale para todos los visitantes)
        fetch('/api/content', { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : { items: {} }; })
            .catch(function () { return { items: {} }; })
            .then(function (data) {
                // El backend ahora es la fuente de verdad principal
                items = Object.assign({}, loadJSON(LS_OVERRIDES, {}), (data && data.items) || {});
                hydrate();
                refreshRetired();
                var wasAdmin = false; try { wasAdmin = localStorage.getItem(LS_ADMIN) === '1'; } catch (e) {}
                setAdmin(wasAdmin);
            });
        renderAuth();
        // "Gestión" navega a la página aparte (admin.html). El href ya está en el HTML.
        // Al ir/volver de gestión, marcamos el flag para saltar la pantalla de carga.
        var adminLink = document.getElementById('nav-admin-link');
        if (adminLink) adminLink.addEventListener('click', function () {
            try { sessionStorage.setItem('cms_skip_loader', '1'); } catch (e) {}
        });

        // re-escaneo para contenido generado por JS (ilustraciones)
        window.addEventListener('load', function () { setTimeout(rescan, 300); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.CMS = {
        get items() { return items; },
        get audit() { return audit; },
        get mediaMeta() { return mediaMeta; },
        get unused() { return unused; },
        get usedContent() { return usedContent; },
        get addedIllu() { return addedIllu; },
        setAdmin: setAdmin,
        login: doLogin,
        validate: validateFile,
        editText: editText,
        editMedia: editMedia,
        addIllustration: openAddIllustration,
        applyValue: function (key, v) { applyStored(key, v); }
    };
})();

/* ============================================================================
   PAUSAR ANIMACIONES / MOVIMIENTO (ahorro de performance) — independiente
   ============================================================================ */
(function () {
    'use strict';
    var LS_MOTION = 'cms_motion_off_v1';
    function revealTypewriters() {
        // Los títulos typewriter arrancan vacíos y se "escriben" con animación.
        // Al pausar el movimiento, mostramos su texto completo para que no desaparezcan.
        document.querySelectorAll('.section-typewriter').forEach(function (el) {
            var full = el.dataset.text;
            if (full && el.innerHTML !== full) { el.innerHTML = full; el.dataset.animated = 'true'; }
        });
        var heroTitle = document.querySelector('.hero-title, .slide-text h1, #hero-title');
        var heroSub = document.querySelector('.hero-subtitle, .slide-text p, #hero-sub');
        if (heroTitle && heroTitle.dataset.text) heroTitle.innerHTML = heroTitle.dataset.text;
        if (heroSub && heroSub.dataset.text) heroSub.innerHTML = heroSub.dataset.text;
    }
    function apply(off) {
        document.documentElement.classList.toggle('motion-off', off);
        if (off) {
            document.querySelectorAll('video').forEach(function (v) { try { v.pause(); } catch (e) {} });
            revealTypewriters();
            // por si el observer aún no escribió algún título
            setTimeout(revealTypewriters, 60);
        }
        try { localStorage.setItem(LS_MOTION, off ? '1' : '0'); } catch (e) {}
    }
    function init() {
        var sw = document.getElementById('motion-switch');
        var saved = false; try { saved = localStorage.getItem(LS_MOTION) === '1'; } catch (e) {}
        if (sw) { sw.checked = saved; sw.addEventListener('change', function () { apply(sw.checked); }); }
        if (saved) apply(true);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
