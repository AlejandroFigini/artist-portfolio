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
    var LS_CONTAINER_NAMES = 'cms_container_names_v1';
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
          get: function (c) { return txt(c.querySelector('.video-date')) || c.getAttribute('data-date'); },
          set: function (c, v) { setTxtKeepIcon(c.querySelector('.video-date'), v); c.setAttribute('data-date', v); } },
        { key: 'project',label: 'Proyecto',
          get: function (c) { return txt(c.querySelector('.video-project')) || c.getAttribute('data-project'); },
          set: function (c, v) { setTxtKeepIcon(c.querySelector('.video-project'), v); c.setAttribute('data-project', v); } },
        { key: 'inspiration',label: 'Inspiración',
          get: function (c) { return c.getAttribute('data-inspiration') || ''; },
          set: function (c, v) { c.setAttribute('data-inspiration', v); } },
        { key: 'fsdesc', label: 'Descripción (al ver en pantalla completa)', textarea: true,
          get: function (c) { return c.getAttribute('data-desc') || ''; },
          set: function (c, v) { c.setAttribute('data-desc', v); } }
    ];

    // Campos para ilustraciones: info de pantalla completa + link al repositorio
    var ILLU_FIELDS = [
        { key: 'title', label: 'Título',
          get: function (c) { return c.dataset.title || ''; }, set: function (c, v) { c.dataset.title = v; } },
        { key: 'date', label: 'Fecha',
          get: function (c) { return c.dataset.date || ''; }, set: function (c, v) { c.dataset.date = v; } },
        { key: 'project', label: 'Proyecto',
          get: function (c) { return c.dataset.project || ''; }, set: function (c, v) { c.dataset.project = v; } },
        { key: 'inspiration', label: 'Inspiración',
          get: function (c) { return c.dataset.inspiration || ''; }, set: function (c, v) { c.dataset.inspiration = v; } },
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

    // Campos para las herramientas de la wave (texto + imagen)
    var WAVE_FIELDS = [
        { key: 'text', label: 'Nombre de la Herramienta',
          get: function (c) { return txt(c.querySelector('.wave-text')); },
          set: function (c, v) { var e = c.querySelector('.wave-text'); if (e) e.textContent = v; } }
    ];

    // Registro de elementos editables: cobertura de toda la página
    var REGISTRY = [
        // Portada
        { base: 'hero.title', sel: '.hero-overlay h1', kind: 'text', mount: 'parent', section: 'Portada', label: 'Título Principal' },
        { base: 'hero.sub', sel: '.hero-overlay p', kind: 'text', mount: 'parent', section: 'Portada', label: 'Subtítulo' },
        { base: 'hero.slide', sel: '.slideshow-container .slide', kind: 'image', accept: 'webp', mount: 'none', section: 'Portada', label: function (el, i) { return 'Imagen Carrusel #' + (i + 1); } },
        { base: 'hero.wave', sel: '.hero-software-wave .wave-track .wave-item img.wave-icon', kind: 'image', accept: 'webp,png,svg', mount: 'parent', section: 'Portada', container: '.wave-item', fields: WAVE_FIELDS, label: function (el, i) { return 'Herramienta Wave #' + (i + 1); } },
        
        // Production Stack
        { base: 'soft.hero', sel: '.icon-wave-container .icon-circle', kind: 'image', accept: 'webp', mount: 'self', section: 'Portada', label: function (el, i) { return 'Logo Stack Portada #' + (i + 1); } },
        { base: 'soft.global', sel: '.global-soft-icons .soft-item', kind: 'image', accept: 'webp', mount: 'self', section: 'Animaciones', label: function (el, i) { return 'Logo Stack Animaciones #' + (i + 1); } },
        // Animaciones de fondo
        { base: 'anim.bg', sel: '.decor-motion .decor-video', kind: 'video', accept: 'webm', mount: 'parent', section: 'Animaciones', label: function (el, i) { return 'Video Fondo Animaciones #' + (i + 1); } },
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
        { base: 'char.portrait', sel: '.cd-portrait', kind: 'image', accept: 'webp', mount: 'self', section: 'Character Design', label: charLabel('Retrato principal') },
        { base: 'char.concept',  sel: '.cd-concept',  kind: 'image', accept: 'webp', mount: 'self', section: 'Character Design', label: charLabel('Concept') },
        { base: 'char.railname', sel: '.cd-rail-name', kind: 'text', mount: 'self', section: 'Character Design', label: function (el, i) { return 'Nombre carrusel inferior #' + (i + 1); } },
        { base: 'char.railthumb', sel: '.cd-rail-thumb', kind: 'image', accept: 'webp', mount: 'self', section: 'Character Design', label: function (el, i) { return 'Miniatura carrusel inferior #' + (i + 1); } },
        { base: 'char.railrole', sel: '.cd-rail-role', kind: 'text', mount: 'self', section: 'Character Design', label: function (el, i) { return 'Rol carrusel inferior #' + (i + 1); } },
        // Ilustraciones (se generan por JS → re-escaneo)
        { base: 'illu', sel: '#illustrations-container .gallery-item img', kind: 'image', accept: 'webp', mount: 'parent', section: 'Ilustraciones', dynamic: true, container: '.gallery-item', fields: ILLU_FIELDS, label: function (el, i) { return 'Ilustración #' + (i + 1); } },
        // Animations (video + metadata + descripción de pantalla completa)
        { base: 'anim', sel: '.animations-grid .anim-video', kind: 'video', accept: 'webm', mount: 'parent', section: 'Animations', container: '.animation-item', fields: ANIM_FIELDS, label: function (el, i) { return 'Animación #' + (i + 1); } },
        // 3D Models
        { base: 'model3d.soft', sel: '.software-icons-mini .soft-icon-wrap img', kind: 'image', accept: 'webp', mount: 'parent', section: '3D Models', label: function (el, i) { return 'Logo Software 3D #' + (i + 1); } },
        { base: 'model3d.title', sel: '.model-text h3', kind: 'text', mount: 'self', section: '3D Models', label: function (el, i) { return 'Título 3D #' + (i + 1); } },
        { base: 'model3d.desc', sel: '.model-text p', kind: 'text', mount: 'self', section: '3D Models', label: function (el, i) { return 'Texto 3D #' + (i + 1); } },
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
            }).then(function(r) {
                if (!r.ok) {
                    r.json().then(function(err) {
                        toast('Error al sincronizar con el servidor: ' + (err.error || r.statusText), 'error');
                    }).catch(function() {
                        toast('Error al sincronizar con el servidor (' + r.status + ')', 'error');
                    });
                }
            }).catch(function(e) {
                console.error('Error saving to backend', e);
                toast('Error de red al sincronizar con el servidor', 'error');
            });
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
    // Para icon-circle / soft-item: retornar el <a> padre (cada icono se oculta individualmente).
    function isIconSlot(el) {
        return el && (el.classList.contains('icon-circle') || el.classList.contains('soft-item') || el.classList.contains('slide'));
    }
    function visualHost(key) {
        var el = elementsByKey[key]; if (!el) return null;
        if (isIconSlot(el)) {
            // Si está dentro de un <a>, usar el <a> como host para ocultar solo ese icono
            var anchor = el.closest('a');
            return anchor || el;
        }
        return el.closest('.gallery-item, .animation-item, .model-video-card') || el.parentElement || el;
    }
    // Slot retirado: para el ADMIN se deja el contenedor con un botón de subir;
    // para visitantes se oculta del todo.
    function showEmptySlot(key) {
        var h = visualHost(key); if (!h) return;
        h.classList.add('cms-empty-slot');
        if (!h.querySelector('.cms-empty-overlay')) {
            var meta = metaByKey[key];
            var labelText = meta ? meta.label : 'Asignar contenido';
            var ov = document.createElement('div'); ov.className = 'cms-empty-overlay';
            ov.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i><span>' + labelText + '</span>';
            ov.title = 'Subir o asignar contenido aquí';
            ov.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openContentPicker(key); });
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
            if (el.classList.contains('icon-circle') || el.classList.contains('soft-item')) {
                // Hide SVG, i, or span children
                Array.from(el.children).forEach(function(c) { 
                    var tag = c.tagName.toLowerCase();
                    if (tag === 'svg' || tag === 'i' || c.classList.contains('soft-badge') || c.classList.contains('soft-name')) {
                        c.style.display = 'none'; 
                    }
                });
                // Insert an img as the new icon
                var img = el.querySelector('img.cms-custom-icon');
                if (!img) {
                    img = document.createElement('img');
                    img.className = 'cms-custom-icon';
                    if (el.classList.contains('icon-circle')) {
                        img.style.width = '55%'; img.style.height = '55%'; img.style.objectFit = 'contain';
                    } else {
                        img.style.height = '2.8rem'; img.style.objectFit = 'contain';
                    }
                    el.insertBefore(img, el.firstChild);
                }
                img.src = value;
            } else {
                el.style.backgroundImage = 'url("' + value + '")';
                if (el.classList.contains('slide')) {
                    var siblings = el.parentElement ? el.parentElement.querySelectorAll('.slide') : [];
                    siblings.forEach(function(s) { s.classList.remove('slide-active'); });
                    el.classList.add('slide-active');
                }
            }
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
        var containerNames = loadJSON(LS_CONTAINER_NAMES, {});
        REGISTRY.forEach(function (entry) {
            document.querySelectorAll(entry.sel).forEach(function (el, i) {
                var key = el.getAttribute('data-cms-key');
                if (!key) {
                    key = entry.base + '#' + i;
                    el.setAttribute('data-cms-key', key);
                }
                if (elementsByKey[key]) return; // ya procesado en esta sesin

                elementsByKey[key] = el;
                typeByKey[key] = entry.kind === 'image' ? 'media' : (entry.kind === 'video' ? 'media' : 'text');
                var defLabel = resolveLabel(entry, el, i);
                var customLabel = containerNames[key];
                metaByKey[key] = {
                    label: customLabel || defLabel,
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

        // Agregar tuerca global para el carrusel en modo admin
        var heroContainer = document.querySelector('.slideshow-container');
        if (heroContainer && !heroContainer.querySelector('.cms-hero-gear')) {
            var btn = document.createElement('button');
            btn.className = 'cms-hero-gear';
            btn.innerHTML = '<i class="fa-solid fa-layer-group"></i>';
            btn.title = 'Configurar Carrusel';
            btn.onclick = function(e) { e.preventDefault(); openCarouselManager(); };
            heroContainer.appendChild(btn);
        }
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
            if (accept === 'webp' && file.type.indexOf('image/') !== 0) {
                return 'Debe ser un archivo de imagen válido.';
            } else if (accept === 'webm' && file.type.indexOf('video/') !== 0) {
                return 'Debe ser un archivo de video válido.';
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
        
        var header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '1.2rem';
        
        var h = document.createElement('h3'); 
        h.className = 'cms-modal-title'; 
        h.textContent = title; 
        h.style.margin = '0';
        header.appendChild(h);

        var closeX = document.createElement('button');
        closeX.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeX.style.background = 'transparent';
        closeX.style.border = 'none';
        closeX.style.color = 'var(--text-secondary)';
        closeX.style.fontSize = '1.4rem';
        closeX.style.cursor = 'pointer';
        closeX.title = 'Cerrar';
        closeX.onclick = function() { closeModal(ov); };
        header.appendChild(closeX);

        m.appendChild(header);
        
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
    // ----- EDICIÓN DE MEDIA (Cloudinary Flow) --------------------------------
    function editMedia(key) {
        var meta = metaByKey[key];
        var accept = meta.accept;
        
        function esc(s) { return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
        
        var input = document.createElement('input'); 
        input.type = 'file';
        input.accept = accept === 'webp' ? 'image/*' : 'video/*';
        
        input.addEventListener('change', function() {
            var f = input.files && input.files[0]; 
            if (!f) return;
            
            validateFile(f, accept).then(function(err) {
                if (err) { toast(err, 'error'); return; }
                
                var origSize = f.size;
                var origName = f.name;
                var origType = f.type;
                var isVid = origType.indexOf('video') >= 0;
                
                var body = document.createElement('div');
                body.className = 'cms-upload';
                
                // Info de metadata
                var fieldsHtml = '';
                var fieldInputs = [];
                var cont = elementsByKey[key].closest(meta.container);
                if (meta.fields) {
                    fieldsHtml += '<div class="cms-up-fields" style="margin-top:1.5rem;"><div class="cms-fields-title">Datos del contenido</div>';
                    meta.fields.forEach(function (fld) {
                        var compositeKey = key + '::' + fld.key;
                        var current = items[compositeKey] != null ? items[compositeKey] : fld.get(cont);
                        fieldsHtml += '<label class="cms-field"><span>' + esc(fld.label) + '</span>';
                        if (fld.textarea) {
                            fieldsHtml += '<textarea id="field-' + fld.key + '" rows="2" style="width:100%; padding:0.6rem; border-radius:8px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); font-family:inherit;">' + esc(current || '') + '</textarea>';
                        } else {
                            fieldsHtml += '<input type="text" id="field-' + fld.key + '" value="' + esc(current || '') + '" style="width:100%; padding:0.6rem; border-radius:8px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); font-family:inherit;">';
                        }
                        fieldsHtml += '</label>';
                        fieldInputs.push({ f: fld, compositeKey: compositeKey, cont: cont, id: 'field-' + fld.key });
                    });
                    fieldsHtml += '</div>';
                }

                body.innerHTML = '<div style="background:var(--bg-secondary); padding:1.5rem; border-radius:12px; border:1px solid var(--border);">' +
                    '<div style="margin-bottom:1rem;">' +
                        '<label style="display:block; font-size:0.85rem; font-weight:600; color:var(--text-secondary); margin-bottom:0.4rem;">Nombre del archivo</label>' +
                        '<input type="text" id="upload-custom-name" class="cms-field" value="' + esc(origName) + '" style="width:100%; padding:0.6rem; border-radius:8px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); font-family:inherit;">' +
                    '</div>' +
                    '<div style="display:flex; flex-direction:column; gap:0.4rem; font-size:0.85rem; color:var(--text-secondary);">' +
                        '<div><strong>Tamaño:</strong> <span style="font-family:\'Fira Code\',monospace;">' + fmtBytes(origSize) + '</span></div>' +
                        '<div><strong>Formato:</strong> ' + esc(origType || 'Archivo') + '</div>' +
                    '</div>' +
                    '<p class="cms-admin-sub" style="margin: 1rem 0 0;">Se procesará con IA en la nube para máxima optimización.</p>' +
                    '</div>' + fieldsHtml;

                var ov = modal('Subir contenido', body, [
                    { label: 'Cancelar', onClick: closeModal },
                    { label: 'Comprimir y subir a Cloudinary', primary: true, onClick: function(ovInstance) {
                        var customNameInput = body.querySelector('#upload-custom-name');
                        var finalName = customNameInput && customNameInput.value.trim() ? customNameInput.value.trim() : origName;

                        // Recolectar valores de los campos de texto ANTES de cambiar el body
                        var fieldValues = [];
                        fieldInputs.forEach(function(fi) {
                            var inp = body.querySelector('#' + fi.id);
                            if (inp) fieldValues.push({ fi: fi, val: inp.value });
                        });

                        var actionsDiv = ovInstance.querySelector('.cms-modal-actions');
                        if (actionsDiv) actionsDiv.style.display = 'none';
                        
                        body.innerHTML = '<div style="text-align:center; padding: 2rem 1rem;"><i class="fa-solid fa-circle-notch fa-spin fa-3x" style="color:var(--accent);"></i><h3 style="margin-top:1rem; color:var(--text-primary);">Subiendo y comprimiendo...</h3><p class="cms-admin-sub">Esto puede tardar unos segundos dependiendo del tamaño.</p></div>';

                        var reader = new FileReader();
                        reader.onload = function(evt) {
                            var base64Data = evt.target.result;
                            fetch('/api/upload-test', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    base64Data: base64Data,
                                    originalSize: origSize,
                                    originalName: finalName
                                })
                            }).then(function(r) { return r.json(); }).then(function(data) {
                                if (!data.success) throw new Error(data.error || 'Error en la subida');
                                
                                // Registrar en 'unused' el archivo reemplazado si existe
                                var prev = usedContent[key];
                                if (prev) {
                                    unused.push({ key: key, src: prev.src, dataUrl: prev.src, name: prev.name, size: prev.size,
                                        type: prev.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
                                        label: prev.label, section: prev.section, original: prev.original, reason: 'replaced' });
                                    persistUnused();
                                }

                                // Aplicar media nueva
                                items[key] = data.secure_url; 
                                applyMedia(key, data.secure_url);
                                
                                // Guardar campos metadata
                                fieldValues.forEach(function(fv) {
                                    var fi = fv.fi;
                                    var v = fv.val;
                                    var prevVal = items[fi.compositeKey] != null ? items[fi.compositeKey] : fi.f.get(fi.cont);
                                    if (v !== prevVal) {
                                        items[fi.compositeKey] = v; fi.f.set(fi.cont, v);
                                        recordAudit({ section: meta.section, label: meta.label, kind: 'metadata', summary: 'Campo "' + fi.f.label + '" actualizado' });
                                    }
                                });
                                persistOverrides();

                                // Guardar en usedContent
                                usedContent[key] = { key: key, label: meta.label, section: meta.section, kind: meta.kind,
                                    src: data.secure_url, name: finalName, size: data.final_bytes, original: false };
                                persistUsed();
                                
                                var ri = retired.indexOf(key); if (ri >= 0) { retired.splice(ri, 1); persistRetired(); }
                                clearEmptySlot(key);
                                recordAudit({ section: meta.section, label: meta.label, kind: (accept === 'webp' ? 'imagen' : 'video'),
                                    summary: (accept === 'webp' ? 'Imagen' : 'Video') + ' reemplazado',
                                    file: { name: finalName, size: data.final_bytes, type: data.final_format } });

                                // Mostrar el éxito
                                var mediaHtml = isVid ? 
                                    '<video src="'+esc(data.secure_url)+'" controls style="max-width:100%; border-radius:8px; margin-top:1rem; display:block;"></video>' :
                                    '<img src="'+esc(data.secure_url)+'" alt="Prueba" style="max-width:100%; max-height:40vh; object-fit:contain; border-radius:8px; margin-top:1rem; display:block; margin: 1rem auto 0;">';

                                body.innerHTML = '<div style="padding:1.5rem; border-radius:12px; border:1px solid var(--border); background:var(--bg-secondary);">' +
                                    '<h3 style="margin-bottom:1.5rem; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;"><i class="fa-solid fa-cloud-arrow-up" style="color:var(--accent);"></i> Subida exitosa</h3>' +
                                    '<div style="background:var(--bg-primary); padding:1rem; border-radius:8px; border:1px solid var(--border); font-size:0.9rem; color:var(--text-secondary); line-height:1.6; margin-bottom:1.5rem;">' +
                                    '<div><strong style="color:var(--text-primary);">Archivo:</strong> <span style="font-weight:500;">' + esc(finalName) + '</span></div>' +
                                    '<div><strong style="color:var(--text-primary);">Tamaño:</strong> <span style="font-family:\'Fira Code\',monospace;">' + fmtBytes(data.final_bytes) + '</span> <span style="font-size:0.8rem; color:var(--text-secondary);">(inicial: ' + fmtBytes(origSize) + ')</span></div>' +
                                    '<div><strong style="color:var(--text-primary);">Tipo de contenido:</strong> ' + (isVid ? 'Video' : 'Imagen') + '</div>' +
                                    '<div><strong style="color:var(--text-primary);">Formato:</strong> ' + esc(data.final_format) + '</div>' +
                                    '<div style="margin-top:0.4rem;"><strong style="color:var(--accent);">Ahorro de tamaño:</strong> <strong style="color:var(--accent); font-family:\'Fira Code\',monospace;">' + (origSize > data.final_bytes ? Math.round((1 - data.final_bytes/origSize)*100) + '%' : '0%') + '</strong></div>' +
                                    (data.asset_id ? '<div style="margin-top:0.6rem; padding-top:0.6rem; border-top:1px dashed var(--border);"><strong style="color:var(--text-primary);">Enlace en Cloudinary:</strong> <br><a href="https://console.cloudinary.com/app/c-a240be86a764a00eb530a9f52db056/assets/media_library/search/asset/' + esc(data.asset_id) + '/manage/summary?q=&view_mode=mosaic&context=manage" target="_blank" style="color:#a78bfa; text-decoration:none; font-size:0.85rem; word-break:break-all;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75rem;"></i> Ver en consola</a></div>' : '') +
                                    '</div>' + mediaHtml +
                                    '</div>';
                                    
                                if (actionsDiv) {
                                    actionsDiv.style.display = 'flex';
                                    actionsDiv.innerHTML = '<button type="button" class="cms-btn cms-btn--primary">Cerrar y actualizar</button>';
                                    actionsDiv.querySelector('button').addEventListener('click', function() {
                                        closeModal(ovInstance);
                                    });
                                }
                            }).catch(function(err) {
                                body.innerHTML = '<div style="color:#ef4444; padding:1rem; background:rgba(239,68,68,0.1); border-radius:8px;"><i class="fa-solid fa-circle-exclamation"></i> Error: ' + esc(err.message) + '</div>';
                                if (actionsDiv) {
                                    actionsDiv.style.display = 'flex';
                                    actionsDiv.innerHTML = '<button type="button" class="cms-btn">Cerrar</button>';
                                    actionsDiv.querySelector('button').addEventListener('click', function() { closeModal(ovInstance); });
                                }
                            });
                        };
                        reader.readAsDataURL(f);
                    } }
                ], true);
            });
        });
        
        // Disparar input nativo directamente (requiere interacción de usuario sincrónica previa)
        input.click();
    }

    // ----- CAROUSEL MANAGER (GLOBAL PARA PORTADA) -----------------------------
    // ----- CAROUSEL MANAGER (GLOBAL PARA PORTADA) -----------------------------
    function openCarouselManager() {
        var settingsRaw = items['hero.settings'];
        var settings = { count: 3, duration: 7000 };
        if (settingsRaw) { 
            try { 
                var parsed = JSON.parse(settingsRaw); 
                if (parsed) settings = Object.assign(settings, parsed);
            } catch(e) {} 
        }
        settings.count = settings.count || 3;
        settings.duration = settings.duration || 7000;

        var originalSlides = [];
        for (var i = 0; i < settings.count; i++) {
            originalSlides.push('hero.slide#' + i);
        }
        var currentSlides = originalSlides.slice();
        var nextNewId = settings.count;

        function isDirty() {
            if (currentSlides.length !== originalSlides.length) return true;
            for (var i = 0; i < currentSlides.length; i++) {
                if (currentSlides[i] !== originalSlides[i]) return true;
            }
            return false;
        }

        var body = document.createElement('div');
        body.className = 'cms-carousel-manager';
        body.innerHTML = '<p style="margin-bottom:1rem; font-size:0.9rem; color:var(--text-secondary);">Configura la portada principal. Puedes reordenar o eliminar diapositivas.</p>';
        
        var controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '1rem';
        controls.style.alignItems = 'center';
        controls.style.marginBottom = '1.5rem';
        
        var durDiv = document.createElement('div');
        durDiv.innerHTML = '<label style="font-size:0.8rem; color:var(--text-secondary); display:block; margin-bottom:0.3rem;">Duración (segundos)</label>';
        var durInput = document.createElement('input');
        durInput.type = 'number';
        durInput.min = '2';
        durInput.max = '30';
        durInput.value = settings.duration / 1000;
        durInput.style.width = '80px';
        durInput.style.padding = '0.4rem';
        durInput.style.borderRadius = '6px';
        durInput.style.border = '1px solid var(--border)';
        durInput.style.background = 'var(--bg-secondary)';
        durInput.style.color = 'var(--text-primary)';
        durDiv.appendChild(durInput);
        
        var btnDiv = document.createElement('div');
        btnDiv.style.marginTop = '1.2rem';
        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'cms-btn';
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Añadir Slide';
        addBtn.onclick = function() {
            if (currentSlides.length >= 7) {
                toast('Máximo 7 diapositivas permitidas', 'error');
                return;
            }
            currentSlides.push('new_slide_' + (nextNewId++));
            renderList();
        };
        btnDiv.appendChild(addBtn);

        controls.appendChild(durDiv);
        controls.appendChild(btnDiv);
        body.appendChild(controls);

        var listContainer = document.createElement('div');
        listContainer.className = 'cms-carousel-list';
        listContainer.style.display = 'flex';
        listContainer.style.flexDirection = 'column';
        listContainer.style.gap = '1rem';
        body.appendChild(listContainer);

        var ov; 
        var actionsDiv; 

        function saveGraph(onSuccess) {
            var newItems = Object.assign({}, items);
            var toRemove = [];
            
            var oldData = {};
            for (var i = 0; i < originalSlides.length; i++) {
                var k = originalSlides[i];
                oldData[k] = items[k]; 
            }

            for (var i = 0; i < currentSlides.length; i++) {
                var vKey = currentSlides[i];
                var realKey = 'hero.slide#' + i;
                if (vKey.startsWith('hero.slide#')) {
                    if (oldData[vKey]) newItems[realKey] = oldData[vKey];
                    else delete newItems[realKey];
                } else {
                    delete newItems[realKey];
                }
            }

            for (var i = 0; i < originalSlides.length; i++) {
                var k = originalSlides[i];
                if (currentSlides.indexOf(k) === -1) {
                    toRemove.push(k);
                }
            }

            var unusedChanged = false;
            toRemove.forEach(function(k) {
                var prev = usedContent[k];
                if (prev) {
                    unused.push({ key: k, src: prev.src, dataUrl: prev.src, name: prev.name, size: prev.size,
                        type: prev.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
                        label: prev.label, section: prev.section, original: prev.original, reason: 'deleted' });
                    unusedChanged = true;
                    delete usedContent[k];
                }
            });

            if (unusedChanged) {
                persistUnused();
                persistUsed();
            }

            for (var i = currentSlides.length; i < originalSlides.length; i++) {
                delete newItems['hero.slide#' + i];
            }

            items = newItems;
            settings.count = currentSlides.length;
            
            var payload = { items: {} };
            payload.items['hero.settings'] = JSON.stringify(settings);
            items['hero.settings'] = payload.items['hero.settings'];

            for (var i = 0; i < Math.max(originalSlides.length, currentSlides.length); i++) {
                var rk = 'hero.slide#' + i;
                if (items[rk] !== undefined) {
                    payload.items[rk] = items[rk];
                } else {
                    payload.items[rk] = '';
                    items[rk] = '';
                }
            }

            try {
                var overrides = loadJSON(LS_OVERRIDES, {});
                Object.keys(payload.items).forEach(function(k) { overrides[k] = payload.items[k]; });
                localStorage.setItem(LS_OVERRIDES, JSON.stringify(overrides));
            } catch(e) {}

            fetch('/api/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(function() {
                // Insted of reload, update originalSlides to current state and re-render
                originalSlides = [];
                for (var i = 0; i < settings.count; i++) {
                    originalSlides.push('hero.slide#' + i);
                }
                currentSlides = originalSlides.slice();
                toast('Grafo guardado correctamente', 'success');
                renderList();
                if (typeof onSuccess === 'function') onSuccess();
            }).catch(function() {
                toast('Error guardando el grafo', 'error');
                if (typeof onSuccess === 'function') onSuccess();
            });
        }

        function renderList() {
            listContainer.innerHTML = '';
            var dirty = isDirty();
            
            var hasEmptySlide = false;
            for (var i = 0; i < currentSlides.length; i++) {
                var vKey = currentSlides[i];
                var src = '';
                if (vKey.startsWith('hero.slide#')) {
                    if (items[vKey]) src = items[vKey];
                    else if (elementsByKey[vKey]) src = currentSrcOf(elementsByKey[vKey]);
                }
                if (!src || src.trim() === '' || src === 'url("")' || src === 'url()') {
                    hasEmptySlide = true;
                }
            }

            for (var i = 0; i < currentSlides.length; i++) {
                var vKey = currentSlides[i];
                var row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.gap = '1rem';
                row.style.padding = '0.5rem';
                row.style.background = 'var(--bg-secondary)';
                row.style.borderRadius = '8px';
                row.style.border = '1px solid var(--border)';

                var thumb = document.createElement('div');
                thumb.style.width = '100px';
                thumb.style.height = '60px';
                thumb.style.borderRadius = '4px';
                thumb.style.backgroundSize = 'cover';
                thumb.style.backgroundPosition = 'center';
                
                var src = '';
                if (vKey.startsWith('hero.slide#')) {
                    if (items[vKey]) {
                        src = items[vKey];
                    } else {
                        var el = elementsByKey[vKey];
                        src = currentSrcOf(el);
                    }
                }
                thumb.style.backgroundImage = 'url("' + src + '")';

                var info = document.createElement('div');
                info.style.flex = '1';
                info.innerHTML = '<strong style="display:block; margin-bottom:0.3rem;">Slide ' + (i + 1) + '</strong>';

                var actionsGroup = document.createElement('div');
                actionsGroup.style.display = 'flex';
                actionsGroup.style.gap = '0.5rem';

                var btnImage = document.createElement('button');
                btnImage.className = 'cms-btn';
                btnImage.textContent = 'Cambiar Imagen';
                if (vKey.startsWith('new_slide_') || dirty) {
                    btnImage.disabled = true;
                    btnImage.title = 'Guarda el grafo primero para editar';
                } else {
                    (function(k) {
                        btnImage.onclick = function() {
                            ov.style.display = 'none';
                            
                            var checker = setInterval(function() {
                                var modals = document.querySelectorAll('.cms-modal-overlay');
                                if (modals.length > 0 && modals[modals.length - 1] === ov) {
                                    ov.style.display = 'flex';
                                    clearInterval(checker);
                                    renderList();
                                } else if (!document.body.contains(ov)) {
                                    clearInterval(checker);
                                }
                            }, 500);
                            
                            openContentPicker(k);
                        };
                    })(vKey);
                }

                var btnUp = document.createElement('button');
                btnUp.className = 'cms-btn';
                btnUp.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
                btnUp.title = 'Subir';
                if (i === 0 || hasEmptySlide) {
                    btnUp.disabled = true;
                    if (hasEmptySlide) btnUp.title = 'Añade una imagen a todas las slides primero';
                } else {
                    (function(idx) {
                        btnUp.onclick = function() {
                            var tmp = currentSlides[idx-1];
                            currentSlides[idx-1] = currentSlides[idx];
                            currentSlides[idx] = tmp;
                            renderList();
                        };
                    })(i);
                }

                var btnDown = document.createElement('button');
                btnDown.className = 'cms-btn';
                btnDown.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
                btnDown.title = 'Bajar';
                if (i === currentSlides.length - 1 || hasEmptySlide) {
                    btnDown.disabled = true;
                    if (hasEmptySlide) btnDown.title = 'Añade una imagen a todas las slides primero';
                } else {
                    (function(idx) {
                        btnDown.onclick = function() {
                            var tmp = currentSlides[idx+1];
                            currentSlides[idx+1] = currentSlides[idx];
                            currentSlides[idx] = tmp;
                            renderList();
                        };
                    })(i);
                }

                var btnDel = document.createElement('button');
                btnDel.className = 'cms-btn';
                btnDel.innerHTML = '<i class="fa-solid fa-trash"></i>';
                btnDel.title = 'Eliminar';
                btnDel.style.color = '#ef4444';
                (function(idx) {
                    btnDel.onclick = function() {
                        currentSlides.splice(idx, 1);
                        renderList();
                    };
                })(i);

                actionsGroup.appendChild(btnImage);
                actionsGroup.appendChild(btnUp);
                actionsGroup.appendChild(btnDown);
                actionsGroup.appendChild(btnDel);

                info.appendChild(actionsGroup);
                row.appendChild(thumb);
                row.appendChild(info);
                listContainer.appendChild(row);
            }

            if (actionsDiv) {
                actionsDiv.innerHTML = '';
                actionsDiv.style.display = 'flex';
                actionsDiv.style.justifyContent = 'space-between';
                actionsDiv.style.alignItems = 'center';
                
                var leftGroup = document.createElement('div');
                var rightGroup = document.createElement('div');

                if (dirty) {
                    var btnSaveGraph = document.createElement('button');
                    btnSaveGraph.className = 'cms-btn cms-btn--primary';
                    btnSaveGraph.textContent = 'Guardar Grafo';
                    btnSaveGraph.onclick = function() {
                        btnSaveGraph.disabled = true;
                        btnSaveGraph.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
                        saveGraph();
                    };
                    leftGroup.appendChild(btnSaveGraph);
                }

                var btnSave = document.createElement('button');
                btnSave.className = 'cms-btn cms-btn--primary';
                btnSave.textContent = 'Guardar Configuración';
                if (dirty) {
                    btnSave.disabled = true;
                    btnSave.style.opacity = '0.5';
                    btnSave.title = 'Debes guardar el grafo primero';
                }
                btnSave.onclick = function() {
                    btnSave.disabled = true;
                    btnSave.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
                    
                    // Check for empty slides
                    var finalSlides = [];
                    var cleaned = false;
                    for (var i = 0; i < currentSlides.length; i++) {
                        var k = currentSlides[i];
                        var src = '';
                        if (items[k]) src = items[k];
                        else if (elementsByKey[k]) src = currentSrcOf(elementsByKey[k]);
                        
                        if (src && src.trim() !== '' && src !== 'url("")') {
                            finalSlides.push(k);
                        } else {
                            cleaned = true;
                        }
                    }

                    function proceedToSaveSettings() {
                        var dur = parseInt(durInput.value, 10);
                        if (isNaN(dur) || dur < 1) dur = 7;
                        settings.duration = dur * 1000;
                        
                        var payload = { items: {} };
                        payload.items['hero.settings'] = JSON.stringify(settings);
                        items['hero.settings'] = payload.items['hero.settings'];
                        
                        try {
                            var overrides = loadJSON(LS_OVERRIDES, {});
                            overrides['hero.settings'] = payload.items['hero.settings'];
                            localStorage.setItem(LS_OVERRIDES, JSON.stringify(overrides));
                        } catch(e) {}

                        fetch('/api/content', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        }).then(function() {
                            window.location.reload();
                        }).catch(function() {
                            window.location.reload();
                        });
                    }

                    if (cleaned) {
                        currentSlides = finalSlides;
                        saveGraph(proceedToSaveSettings); // This will wait for saveGraph to finish!
                    } else {
                        proceedToSaveSettings();
                    }
                };
                rightGroup.appendChild(btnSave);
                
                actionsDiv.appendChild(leftGroup);
                actionsDiv.appendChild(rightGroup);
            }
        }

        renderList(); 
        ov = modal('Gestión de Carrusel', body, [], false);
        actionsDiv = ov.querySelector('.cms-modal-actions');
        renderList(); 
    }

    // ----- CONTENT PICKER: modal selector de 2 opciones -----------------------
    function openContentPicker(key) {
        var meta = metaByKey[key] || {
            label: "Slide " + (parseInt(key.split('#')[1]) + 1 || "Nuevo"),
            section: "hero",
            kind: "image",
            accept: "webp",
            size: 1920
        };
        var containerNames = loadJSON(LS_CONTAINER_NAMES, {});
        var body = document.createElement('div');
        var head = document.createElement('div'); head.className = 'cms-up-head';

        // Construir header con info detallada
        var pageLine = document.createElement('div'); pageLine.className = 'cms-meta-line';
        pageLine.innerHTML = '<strong>Página:</strong> Principal';
        head.appendChild(pageLine);

        var secLine = document.createElement('div'); secLine.className = 'cms-meta-line';
        secLine.innerHTML = '<strong>Sección:</strong> ' + meta.section;
        head.appendChild(secLine);

        // Línea de contenedor con lápiz para renombrar
        var contLine = document.createElement('div'); contLine.className = 'cms-meta-line cms-container-editable';
        var contLabel = document.createElement('strong'); contLabel.textContent = 'Contenedor:';
        contLine.appendChild(contLabel);
        contLine.appendChild(document.createTextNode(' '));
        var contName = document.createElement('span'); contName.className = 'cms-container-name-text';
        contName.textContent = meta.label;
        contLine.appendChild(contName);
        var pencilBtn = document.createElement('button'); pencilBtn.type = 'button';
        pencilBtn.className = 'cms-rename-pencil';
        pencilBtn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
        pencilBtn.title = 'Renombrar contenedor';
        pencilBtn.addEventListener('click', function () {
            var inp = document.createElement('input'); inp.type = 'text';
            inp.className = 'cms-rename-inline'; inp.value = meta.label;
            contName.style.display = 'none';
            pencilBtn.style.display = 'none';
            contLine.appendChild(inp);
            var confirmBtn = document.createElement('button'); confirmBtn.type = 'button';
            confirmBtn.className = 'cms-rename-confirm';
            confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            contLine.appendChild(confirmBtn);
            inp.focus(); inp.select();
            function doRename() {
                var newName = inp.value.trim();
                if (newName && newName !== meta.label) {
                    containerNames[key] = newName;
                    try { localStorage.setItem(LS_CONTAINER_NAMES, JSON.stringify(containerNames)); } catch (e) {}
                    meta.label = newName;
                    contName.textContent = newName;
                    recordAudit({ section: meta.section, label: newName, kind: 'gestión', summary: 'Contenedor renombrado' });
                    toast('Contenedor renombrado');
                }
                inp.remove(); confirmBtn.remove();
                contName.style.display = ''; pencilBtn.style.display = '';
            }
            confirmBtn.addEventListener('click', doRename);
            inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') { inp.remove(); confirmBtn.remove(); contName.style.display = ''; pencilBtn.style.display = ''; } });
        });
        contLine.appendChild(pencilBtn);
        head.appendChild(contLine);

        var typeLine = document.createElement('div'); typeLine.className = 'cms-meta-line';
        typeLine.innerHTML = '<strong>Tipo requerido:</strong> ' + (meta.kind === 'video' ? 'Video' : 'Imagen');
        head.appendChild(typeLine);

        body.appendChild(head);

        var grid = document.createElement('div'); grid.className = 'cms-picker-grid';

        // Opción 1: Subir desde local
        var optLocal = document.createElement('button'); optLocal.type = 'button';
        optLocal.className = 'cms-picker-option';
        optLocal.innerHTML = '<i class="fa-solid fa-file-arrow-up"></i>' +
            '<span class="cms-picker-title">Subir desde tu PC</span>' +
            '<span class="cms-picker-desc">Selecciona un archivo nuevo de tu computadora para subirlo y asignarlo aquí.</span>';
        grid.appendChild(optLocal);

        // Opción 2: Usar desde repositorio
        var optRepo = document.createElement('button'); optRepo.type = 'button';
        optRepo.className = 'cms-picker-option';
        optRepo.innerHTML = '<i class="fa-solid fa-cloud"></i>' +
            '<span class="cms-picker-title">Usar desde repositorio</span>' +
            '<span class="cms-picker-desc">Elige un archivo que ya fue subido previamente al repositorio de contenidos.</span>';
        grid.appendChild(optRepo);

        body.appendChild(grid);

        var ov = modal('¿Qué deseas hacer?', body, [
            { label: 'Cancelar', onClick: closeModal }
        ]);

        optLocal.addEventListener('click', function () {
            closeModal(ov);
            editMedia(key); // Sincrónico, para que el input.click() sea válido
        });
        optRepo.addEventListener('click', function () {
            closeModal(ov);
            openRepoPicker(key); // Sincrónico también
        });
    }

    // ----- REPO PICKER: grilla de contenido existente -------------------------
    function openRepoPicker(key) {
        var meta = metaByKey[key];
        var isVideoSlot = meta.kind === 'video';

        // Recopilar todo el contenido disponible
        var all = [];
        // Contenido usado
        Object.keys(usedContent).forEach(function (k) {
            var e = usedContent[k];
            var eIsVid = e.kind === 'video';
            if (isVideoSlot !== eIsVid) return; // filtrar por tipo compatible
            all.push({ src: e.src, name: e.name, size: e.size, label: e.label,
                section: e.section, kind: e.kind, _state: 'usado', _key: k, ts: e.ts });
        });
        // Contenido no usado
        unused.forEach(function (e) {
            var eIsVid = (e.type && (e.type.indexOf('video') >= 0 || e.type.indexOf('webm') >= 0)) || (e.name && /\.webm$/i.test(e.name));
            if (isVideoSlot !== eIsVid) return;
            all.push({ src: e.src || e.dataUrl, name: e.name, size: e.size, label: e.label,
                section: e.section, kind: eIsVid ? 'video' : 'image', _state: 'sin usar', _key: e.key, ts: e.ts });
        });

        var selected = null;

        var body = document.createElement('div');
        var head = document.createElement('div'); head.className = 'cms-up-head';
        head.innerHTML = '<div class="cms-meta-line"><strong>Asignar a:</strong> ' + meta.label + ' (' + meta.section + ')</div>' +
                         '<div class="cms-meta-line"><strong>Mostrando:</strong> ' +
                         (isVideoSlot ? 'Videos' : 'Imágenes') + ' disponibles en el repositorio</div>';
        body.appendChild(head);

        // Filtro por estado (botones con iconos y colores como en Gestión)
        var filterBar = document.createElement('div'); filterBar.className = 'cms-repo-filter-bar';
        var activeFilter = 'all';
        var filters = [
            { value: 'all', label: 'Repositorio', icon: 'fa-database', colorClass: 'cms-filter-repo' },
            { value: 'usado', label: 'En uso', icon: 'fa-circle-check', colorClass: 'cms-filter-used' },
            { value: 'sin usar', label: 'Sin usar', icon: 'fa-box-archive', colorClass: 'cms-filter-unused' }
        ];
        filters.forEach(function (f) {
            var btn = document.createElement('button'); btn.type = 'button';
            btn.className = 'cms-repo-filter-btn ' + f.colorClass + (f.value === activeFilter ? ' active' : '');
            btn.innerHTML = '<i class="fa-solid ' + f.icon + '"></i> ' + f.label;
            btn.setAttribute('data-filter', f.value);
            btn.addEventListener('click', function () {
                activeFilter = f.value;
                filterBar.querySelectorAll('.cms-repo-filter-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                renderGrid(f.value);
            });
            filterBar.appendChild(btn);
        });
        body.appendChild(filterBar);

        var gridEl = document.createElement('div'); gridEl.className = 'cms-repo-grid';
        body.appendChild(gridEl);

        function renderGrid(filter) {
            gridEl.innerHTML = '';
            selected = null;
            var filtered = filter === 'all' ? all : all.filter(function (e) { return e._state === filter; });
            if (!filtered.length) {
                gridEl.innerHTML = '<div class="cms-repo-empty"><i class="fa-solid fa-box-open" style="font-size:2rem; margin-bottom:0.5rem; display:block; color:var(--accent);"></i>No hay contenido disponible de este tipo.</div>';
                return;
            }
            filtered.forEach(function (entry, i) {
                var thumb = document.createElement('div'); thumb.className = 'cms-repo-thumb';
                thumb.setAttribute('data-repo-idx', i);

                var src = entry.src || '';
                var isVid = entry.kind === 'video';

                // Miniatura
                if (src && src.indexOf('data:') !== 0 && !isVid) {
                    // Para Cloudinary, usar transformación de thumb
                    var thumbSrc = src;
                    if (src.indexOf('res.cloudinary.com') !== -1) {
                        thumbSrc = src.replace('/upload/', '/upload/c_fill,w_150,h_150,q_auto,f_auto/');
                    }
                    thumb.innerHTML = '<img class="cms-repo-thumb-img" src="' + thumbSrc + '" alt="" loading="lazy">';
                } else if (isVid) {
                    thumb.innerHTML = '<div class="cms-repo-thumb-icon"><i class="fa-solid fa-film"></i></div>';
                } else if (src && src.indexOf('data:image') === 0) {
                    thumb.innerHTML = '<img class="cms-repo-thumb-img" src="' + src + '" alt="" loading="lazy">';
                } else {
                    thumb.innerHTML = '<div class="cms-repo-thumb-icon"><i class="fa-solid fa-image"></i></div>';
                }

                // Info
                var info = document.createElement('div'); info.className = 'cms-repo-thumb-info';
                info.innerHTML = '<strong>' + (entry.name || entry.label || '—') + '</strong><br>' +
                    (entry.size ? fmtBytes(entry.size) : '') +
                    ' <span style="opacity:0.7;">· ' + entry._state + '</span>';
                thumb.appendChild(info);

                thumb.addEventListener('click', function () {
                    gridEl.querySelectorAll('.cms-repo-thumb.selected').forEach(function (t) { t.classList.remove('selected'); });
                    thumb.classList.add('selected');
                    selected = entry;
                });

                gridEl.appendChild(thumb);
            });
        }

        renderGrid('all');

        modal('Elegir del repositorio', body, [
            { label: 'Cancelar', onClick: closeModal },
            { label: 'Usar este contenido', primary: true, onClick: function (ov) {
                if (!selected) { toast('Seleccioná un contenido primero', 'error'); return; }

                var src = selected.src;
                if (!src) { toast('El contenido seleccionado no tiene un recurso válido', 'error'); return; }

                // Mover la versión anterior a no usados (si la hay)
                var prev = usedContent[key];
                if (prev) {
                    unused.push({ key: key, src: prev.src, dataUrl: prev.src, name: prev.name, size: prev.size,
                        type: prev.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
                        label: prev.label, section: prev.section, original: prev.original, reason: 'replaced' });
                    persistUnused();
                }

                // Aplicar el contenido seleccionado al slot
                items[key] = src;
                applyMedia(key, src);

                // Actualizar registro de contenido usado
                usedContent[key] = { key: key, label: meta.label, section: meta.section, kind: meta.kind,
                    src: src, name: selected.name, size: selected.size, original: false,
                    fields: computeFields(key, elementsByKey[key], meta) };
                persistUsed();
                persistOverrides();

                // Si el slot estaba retirado, restaurarlo
                var ri = retired.indexOf(key);
                if (ri >= 0) { retired.splice(ri, 1); persistRetired(); }
                clearEmptySlot(key);

                recordAudit({ section: meta.section, label: meta.label, kind: meta.kind === 'video' ? 'video' : 'imagen',
                    summary: 'Contenido asignado desde repositorio (' + (selected.name || 'archivo existente') + ')' });

                closeModal(ov);
                toast('Contenido asignado correctamente');
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
        tools.appendChild(toolBtn('fa-arrow-up-from-bracket', 'Reemplazar: ' + meta.label, 'cms-tool-replace', function () { openContentPicker(key); }));
        tools.appendChild(toolBtn('fa-box-archive', 'Mover a no usados: ' + meta.label, 'cms-tool-move', function () { confirmMovePage(key); }));
        return tools;
    }
    function attachEditControls() {
        REGISTRY.forEach(function (entry) {
            document.querySelectorAll(entry.sel).forEach(function (el) {
                var key = el.getAttribute('data-cms-key');
                if (!key || el.getAttribute('data-cms-has-btn') === '1') return;
                if (entry.mount === 'none') { el.setAttribute('data-cms-has-btn', '1'); return; }
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
    function doLogin(u, p, c, overlay, formWrap) {
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: u, pass: p, code: c })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.require2FA) {
                formWrap.innerHTML = 
                    '<label class="cms-field"><span>Código 2FA (Google Authenticator)</span><input type="text" id="cms-code" autocomplete="off" maxlength="6"></label>' +
                    '<p class="cms-hint" style="color:var(--color-primary);"><i class="fa-solid fa-shield-halved"></i> Ingresa el código dinámico de tu app.</p>';
                var codeInp = $('#cms-code', formWrap);
                codeInp.focus();
                codeInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') overlay.querySelector('.cms-btn--primary').click(); });
                var btn = overlay.querySelector('.cms-btn--primary');
                if (btn) btn.textContent = 'Verificar';
            } else if (data.success) {
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
            '<p class="cms-hint" style="margin-top: 15px;"><i class="fa-solid fa-lock"></i> Asegurado con Google Authenticator 2FA.</p>';
        
        var uVal = '', pVal = '';

        var ov = modal('Acceso de administrador', w, [
            { label: 'Cancelar', onClick: closeModal },
            { label: 'Entrar', primary: true, onClick: function (overlay) {
                var codeEl = $('#cms-code', w);
                if (!codeEl) {
                    uVal = $('#cms-user', w).value.trim();
                    pVal = $('#cms-pass', w).value;
                    doLogin(uVal, pVal, null, overlay, w);
                } else {
                    doLogin(uVal, pVal, codeEl.value.trim(), overlay, w);
                }
            } }
        ]);
        var pass = $('#cms-pass', w);
        if (pass) pass.addEventListener('keydown', function (e) { if (e.key === 'Enter') ov.querySelector('.cms-btn--primary').click(); });
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
                
                // Aplicar hero settings
                var settingsRaw = items['hero.settings'];
                var settings = { count: 3, duration: 7000 };
                if (settingsRaw) {
                    try { settings = JSON.parse(settingsRaw); } catch(e) {}
                }
                window.CMS_HERO_DURATION = settings.duration || 7000;
                
                var container = document.querySelector('.slideshow-container');
                if (container) {
                    var slides = Array.from(container.querySelectorAll('.slide'));
                    var currentCount = slides.length;
                    var targetCount = settings.count || 3;
                    
                    if (targetCount > currentCount) {
                        for (var i = currentCount; i < targetCount; i++) {
                            var div = document.createElement('div');
                            div.className = 'slide';
                            div.style.backgroundSize = 'cover';
                            div.style.backgroundPosition = 'center';
                            // insert before the hero-overlay
                            var overlay = container.querySelector('.hero-overlay');
                            if (overlay) container.insertBefore(div, overlay);
                            else container.appendChild(div);
                        }
                    } else if (targetCount < currentCount) {
                        for (var i = currentCount - 1; i >= targetCount; i--) {
                            slides[i].remove();
                        }
                    }
                    
                    // Restart slideshow from script.js
                    if (targetCount !== currentCount || window.CMS_HERO_DURATION !== 7000) {
                        if (typeof window.initHeroSlideshow === 'function') {
                            window.initHeroSlideshow();
                        }
                    }
                    
                    // Force re-index since DOM changed (to add data-cms-key to new slides)
                    if (targetCount !== currentCount) {
                        indexEditables();
                    }
                }

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
