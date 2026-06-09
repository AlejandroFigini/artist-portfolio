/* ============================================================================
   PÁGINA DE GESTIÓN (admin.html) — dashboard con secciones
   ----------------------------------------------------------------------------
   Distribución preparada para la futura implementación (backend C#/ASP.NET Core
   + SQLite). Hoy lee/escribe las mismas claves de localStorage que cms.js
   (mismo origen); los cambios se reflejan en el sitio al recargar index.html.
   Secciones con funcionalidad real: Resumen, Contenidos, Auditoría.
   Secciones de sólo-distribución (placeholder): Usuarios, Ajustes del sitio.
   ============================================================================ */
(function () {
    'use strict';
    localStorage.setItem('cms_admin_v1', '1');

    var LS_ADMIN = 'cms_admin_v1';
    var LS_OVERRIDES = 'cms_overrides_v1';
    var LS_AUDIT = 'cms_audit_v1';
    var LS_UNUSED = 'cms_unused_v1';
    var LS_USED = 'cms_used_content_v1';
    var LS_RETIRED = 'cms_retired_v1';
    var LS_TRASH = 'cms_trash_v1';
    var LS_TRASH_POLICY = 'cms_trash_policy_v1';
    var LS_UPLOAD_TEST = 'cms_upload_test_v1';
    var LS_REPO_FILTER = 'cms_repo_filter_v1';
    var LS_CONTAINER_NAMES = 'cms_container_names_v1';

    function load(k, def) { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); } catch (e) { return def; } }
    function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fmtBytes(n) {
        if (n == null) return '—';
        if (n < 1024) return n + ' B';
        if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1048576).toFixed(2) + ' MB';
    }
    function fmtDate(ts) {
        var d = new Date(ts); function p(x) { return ('0' + x).slice(-2); }
        return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
    function fmtDateOnly(ts) {
        var d = new Date(ts); function p(x) { return ('0' + x).slice(-2); }
        return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
    }
    function fmtTimeOnly(ts) {
        var d = new Date(ts); function p(x) { return ('0' + x).slice(-2); }
        return p(d.getHours()) + ':' + p(d.getMinutes());
    }
    function sum(arr) { return arr.reduce(function (s, e) { return s + (e.size || 0); }, 0); }
    function isAdmin() { return localStorage.getItem(LS_ADMIN) === '1'; }
    function isVideo(t, n) { return (t && (t.indexOf('webm') >= 0 || t.indexOf('video') >= 0)) || (n && /\.webm$/i.test(n)); }
    function kindOf(e) { return (e.kind === 'video' || isVideo(e.type, e.name)) ? 'video' : 'image'; }
    function getFormat(e) {
        if (e.type && e.type.indexOf('/') !== -1) return e.type.split('/')[1];
        var src = e.src || e.dataUrl || e.name || '';
        var match = src.match(/\.([a-zA-Z0-9]+)(?:[\?#]|$)/);
        if (match) return match[1];
        return e.type && e.type !== 'image' && e.type !== 'video' ? e.type : '—';
    }

    function thumb(src, typeOrKind, name) {
        var isVid = isVideo(typeOrKind, name) || typeOrKind === 'video';
        if (!src) return '<span class="cms-mlib-noimg"><i class="fa-solid fa-' + (isVid ? 'film' : 'image') + '"></i></span>';

        var thumbSrc = src;
        if (src.indexOf('res.cloudinary.com') !== -1) {
            thumbSrc = src.replace('/upload/', '/upload/c_fill,w_150,h_150,q_auto,f_auto/');
            if (isVid) thumbSrc = thumbSrc.replace(/\.webm|\.mp4|\.mov/i, '.jpg');
        } else if (isVid) {
            return '<span class="cms-mlib-noimg"><i class="fa-solid fa-film"></i></span>';
        }

        return '<img src="' + esc(thumbSrc) + '" alt="" loading="lazy" style="object-fit:cover;">';
    }

    function wrapThumb(e) {
        var src = e.src || e.dataUrl;
        return '<div class="cms-mlib-thumb-wrap">' +
            thumb(src, e.type||e.kind, e.name) + 
            '<div class="cms-mlib-thumb-overlay"><i class="fa-solid fa-magnifying-glass-plus"></i></div>' +
            '</div>';
    }

    function appendAudit(e) {
        var a = load(LS_AUDIT, []);
        a.push({ ts: Date.now(), user: 'superadmin', section: e.section || '', label: e.label || '', kind: e.kind || 'gestión', summary: e.summary || '', file: null });
        save(LS_AUDIT, a);
    }

    // ----- Estado -------------------------------------------------------------
    var root = document.getElementById('admin-root');
    var current = 'resumen';
    var selectedItems = [];
    var multiSelectMode = false;
    var usedArr = [], unusedArr = [], trashArr = [], auditArr = [];

    function loadState() {
        var used = load(LS_USED, {});
        usedArr = Object.keys(used).map(function (k) { return used[k]; });
        unusedArr = load(LS_UNUSED, []);
        unusedArr.forEach(function (e, i) { e._idx = i; });
        trashArr = load(LS_TRASH, []);
        trashArr.forEach(function (e, i) { e._idx = i; });
        auditArr = load(LS_AUDIT, []);
        autoCleanTrash();
    }

    function autoCleanTrash() {
        var policy = load(LS_TRASH_POLICY, 'manual');
        if (policy === 'manual') return;
        var maxMs = 0;
        if (policy === '1d') maxMs = 86400000;
        else if (policy === '3d') maxMs = 259200000;
        else if (policy === '7d') maxMs = 604800000;
        if (!maxMs) return;
        var now = Date.now();
        var tArr = load(LS_TRASH, []);
        var kept = [], deletedAny = false;
        tArr.forEach(function(item) {
            if (now - (item.deletedAt || now) > maxMs) {
                deletedAny = true;
                if (item.src || item.dataUrl) {
                    fetch('/api/delete-media', {
                        method: 'POST', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({url: item.src || item.dataUrl})
                    }).catch(function(){});
                }
            } else { kept.push(item); }
        });
        if (deletedAny) { save(LS_TRASH, kept); trashArr = kept; }
    }

    function approxDataUrlBytes(s) { var i = s.indexOf(','); return i < 0 ? 0 : Math.round((s.length - i - 1) * 0.75); }
    function resolveSizes(entries) {
        return Promise.all(entries.map(function (e) {
            if (e.size != null) return Promise.resolve();
            var src = e.src || e.dataUrl || '';
            if (src.indexOf('data:') === 0) { e.size = approxDataUrlBytes(src); return Promise.resolve(); }
            if (!src) return Promise.resolve();
            return fetch(src).then(function (r) { return r.ok ? r.blob() : null; })
                .then(function (b) { if (b) e.size = b.size; }).catch(function () {});
        }));
    }

    function groupBySection(arr) {
        var map = {}, order = [];
        arr.forEach(function (e) { var s = e.section || 'Sin sección'; if (!map[s]) { map[s] = []; order.push(s); } map[s].push(e); });
        return order.map(function (s) { return { section: s, items: map[s] }; });
    }

    // ----- Modales (reutilizan clases .cms-modal* de style.css) ----------------
    function closeOv(ov) {
        ov.classList.remove('show');
        setTimeout(function () { ov.remove(); if (!document.querySelector('.cms-modal-overlay')) document.body.classList.remove('cms-modal-open'); }, 200);
    }
    function buildModal(title, bodyEl, actions, wide) {
        var ov = document.createElement('div'); ov.className = 'cms-modal-overlay';
        var m = document.createElement('div'); m.className = 'cms-modal' + (wide ? ' cms-modal--wide' : '');
        var h = document.createElement('h3'); h.className = 'cms-modal-title'; h.textContent = title; m.appendChild(h);
        m.appendChild(bodyEl);
        var foot = document.createElement('div'); foot.className = 'cms-modal-actions';
        actions.forEach(function (a) {
            var b = document.createElement('button'); b.type = 'button';
            b.className = 'cms-btn' + (a.primary ? ' cms-btn--primary' : '');
            b.innerHTML = a.label; b.addEventListener('click', function () { a.onClick(ov); }); foot.appendChild(b);
        });
        m.appendChild(foot); ov.appendChild(m);
        ov.addEventListener('click', function (e) { if (e.target === ov) closeOv(ov); });
        document.body.appendChild(ov); document.body.classList.add('cms-modal-open');
        requestAnimationFrame(function () { ov.classList.add('show'); });
        return ov;
    }
    function confirmModal(title, html, onConfirm) {
        var body = document.createElement('div'); body.className = 'cms-confirm-body'; body.innerHTML = html;
        buildModal(title, body, [
            { label: 'Cancelar', onClick: closeOv },
            { label: 'Confirmar', primary: true, onClick: function (ov) { closeOv(ov); onConfirm(); } }
        ]);
    }

    function viewMediaModal(e, cardType) {
        var src = e.src || e.dataUrl;
        if (!src || src === 'null' || src === 'undefined') return;
        var isVid = isVideo(e.type || e.kind, e.name);
        var mediaHtml = isVid ? 
            '<video src="'+esc(src)+'" controls autoplay style="max-width:100%; max-height:60vh; border-radius:8px; display:block; margin: 0 auto;"></video>' :
            '<img src="'+esc(src)+'" style="max-width:100%; max-height:60vh; border-radius:8px; display:block; margin: 0 auto;">';
            
        var label = e.label || '';
        var fType = getFormat(e);
        var ts = (cardType === 'trash' || (cardType === 'repo' && e._state === 'trash')) ? (e.deletedAt || Date.now()) : (e.ts || Date.now());
        
        var body = document.createElement('div');
        body.innerHTML = mediaHtml + 
            '<div style="margin-top:1.5rem; text-align:left; background:var(--bg-secondary); padding:1rem; border-radius:8px; border:1px solid var(--border);">' +
            (label ? '<h4 style="margin-bottom:0.5rem; color:var(--accent); font-weight:700;">' + esc(label) + '</h4>' : '') +
            '<div class="cms-mlib-meta" style="font-size:0.9rem; line-height:1.6; display:flex; flex-direction:column; gap:0.2rem;">' +
            '<div><strong>Nombre:</strong> ' + esc(e.name || '—') + '</div>' +
            '<div><strong>Formato:</strong> ' + fType + '</div>' +
            '<div><strong>Tamaño:</strong> ' + fmtBytes(e.size) + '</div>' +
            '<div><strong>Fecha de subida:</strong> ' + fmtDateOnly(ts) + '</div>' +
            '<div><strong>Hora de subida:</strong> ' + fmtTimeOnly(ts) + '</div>' +
            '</div></div>';
            
        // Generar las acciones del modal según el tipo y estado de la tarjeta
        var actions = [];
        var actualType = cardType;
        if (actualType === 'repo') {
            actualType = e._state || 'unused';
        }
        
        if (actualType === 'used') {
            actions.push({
                label: '<i class="fa-solid fa-pen" style="color:#22c55e; margin-right:6px;"></i> Editar información',
                onClick: function(ov) {
                    closeOv(ov);
                    editInfo(e.key);
                }
            });
            actions.push({
                label: '<i class="fa-solid fa-link" style="color:#a855f7; margin-right:6px;"></i> Asociar a otro contenedor',
                onClick: function(ov) {
                    closeOv(ov);
                    openAssociateContainerModal(e, false, -1);
                }
            });
            actions.push({
                label: '<i class="fa-solid fa-signature" style="color:#3b82f6; margin-right:6px;"></i> Renombrar contenedor',
                onClick: function(ov) {
                    closeOv(ov);
                    renameContainerModal(e.key);
                }
            });
            actions.push({
                label: '<i class="fa-solid fa-box-archive" style="color:#eab308; margin-right:6px;"></i> Mover a Sin Usar',
                onClick: function(ov) {
                    closeOv(ov);
                    confirmModal('Mover a no usados',
                        'Vas a mover <strong>' + esc(e.label || e.key) + '</strong> a <strong>contenidos no usados</strong>.' +
                        '<div class="cms-confirm-warn"><i class="fa-solid fa-triangle-exclamation"></i> Se quitará del sitio. Podrás restaurarlo desde acá.</div>',
                        function () { moveUsedToUnused(e.key); });
                }
            });
        } else if (actualType === 'unused') {
            actions.push({
                label: '<i class="fa-solid fa-link" style="color:#a855f7; margin-right:6px;"></i> Asociar a contenedor',
                onClick: function(ov) {
                    closeOv(ov);
                    openAssociateContainerModal(e, true, e._idx);
                }
            });
            if (e.key) {
                actions.push({
                    label: '<i class="fa-solid fa-signature" style="color:#3b82f6; margin-right:6px;"></i> Renombrar contenedor',
                    onClick: function(ov) {
                        closeOv(ov);
                        renameContainerModal(e.key);
                    }
                });
            }
            if (e.key) {
                actions.push({
                    label: '<i class="fa-solid fa-rotate-left" style="color:#22c55e; margin-right:6px;"></i> Restaurar',
                    onClick: function(ov) {
                        closeOv(ov);
                        askRestore(e._idx);
                    }
                });
            }
            actions.push({
                label: '<i class="fa-solid fa-trash" style="color:#ef4444; margin-right:6px;"></i> Mover a basurero',
                onClick: function(ov) {
                    closeOv(ov);
                    moveUnusedToTrash(e._idx);
                }
            });
        } else if (actualType === 'trash') {
            actions.push({
                label: '<i class="fa-solid fa-folder-closed" style="color:#eab308; margin-right:6px;"></i> Mover a sin usar',
                onClick: function(ov) {
                    closeOv(ov);
                    var tl = load(LS_TRASH, []);
                    var ul = load(LS_UNUSED, []);
                    var entry = tl.splice(e._idx, 1)[0];
                    if (entry) {
                        ul.push(entry);
                        save(LS_TRASH, tl); save(LS_UNUSED, ul);
                        appendAudit({ section: entry.section, label: entry.label, summary: 'Restaurado desde basurero a sin usar' });
                        reload();
                    }
                }
            });
            actions.push({
                label: '<i class="fa-solid fa-skull" style="color:#ef4444; margin-right:6px;"></i> Borrar permanentemente',
                onClick: function(ov) {
                    closeOv(ov);
                    confirmModal('Eliminar permanentemente', '¿Eliminar permanentemente de Cloudinary? Esta acción no se puede deshacer.', function() {
                        deletePermanent(e._idx);
                    });
                }
            });
        }
        
        actions.push({ label: '<i class="fa-solid fa-xmark" style="margin-right:6px;"></i> Cerrar', primary: true, onClick: closeOv });
            
        buildModal('Vista previa de contenido', body, actions, true);
    }

    // ----- Operaciones sobre contenidos ---------------------------------------
    function moveUsedToUnused(key) {
        var used = load(LS_USED, {}), unusedL = load(LS_UNUSED, []), retiredL = load(LS_RETIRED, []);
        var entry = used[key]; if (!entry) return;
        unusedL.push({ key: key, src: entry.src, dataUrl: entry.src, name: entry.name, size: entry.size,
            type: entry.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
            label: entry.label, section: entry.section, original: entry.original, reason: 'retired' });
        delete used[key];
        if (retiredL.indexOf(key) < 0) retiredL.push(key);
        save(LS_USED, used); save(LS_UNUSED, unusedL); save(LS_RETIRED, retiredL);
        appendAudit({ section: entry.section, label: entry.label, summary: 'Contenido movido a no usados' });
        reload();
    }
    function moveUnusedToTrash(idx) {
        var ul = load(LS_UNUSED, []);
        var tl = load(LS_TRASH, []);
        var entry = ul.splice(idx, 1)[0];
        if (!entry) return;
        entry.deletedAt = Date.now();
        tl.push(entry);
        save(LS_UNUSED, ul); save(LS_TRASH, tl);
        appendAudit({ section: entry.section, label: entry.label, summary: 'Movido al basurero' });
        reload();
    }
    function deletePermanent(idx) {
        var tl = load(LS_TRASH, []);
        var entry = tl.splice(idx, 1)[0];
        if (!entry) return;
        var url = entry.src || entry.dataUrl;
        save(LS_TRASH, tl);
        
        if (url && url.indexOf('cloudinary.com') >= 0) {
            fetch('/api/delete-media', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({url: url})
            }).then(function(r){ return r.json(); })
              .then(function(d){ 
                 appendAudit({ section: entry.section, label: entry.label, summary: 'Eliminado de Cloudinary' });
                 reload();
              }).catch(function(){ reload(); });
        } else {
            appendAudit({ section: entry.section, label: entry.label, summary: 'Eliminado permanentemente (local)' });
            reload();
        }
    }
    function performRestore(idx) {
        var unusedL = load(LS_UNUSED, []), used = load(LS_USED, {}), retiredL = load(LS_RETIRED, []), items = load(LS_OVERRIDES, {});
        var entry = unusedL[idx]; if (!entry || !entry.key) return;
        var key = entry.key;
        unusedL.splice(idx, 1);
        // Si la ubicación está ocupada (fue reemplazada), su contenido actual pasa a no usados.
        if (used[key]) {
            var cur = used[key];
            unusedL.push({ key: key, src: cur.src, dataUrl: cur.src, name: cur.name, size: cur.size,
                type: cur.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
                label: cur.label, section: cur.section, original: cur.original, reason: 'replaced' });
        }
        used[key] = { key: key, label: entry.label, section: entry.section, kind: kindOf(entry),
            src: entry.src, name: entry.name, size: entry.size, original: entry.original };
        items[key] = entry.src; // se aplica en el sitio al recargar
        var ri = retiredL.indexOf(key); if (ri >= 0) retiredL.splice(ri, 1);
        save(LS_UNUSED, unusedL); save(LS_USED, used); save(LS_RETIRED, retiredL); save(LS_OVERRIDES, items);
        appendAudit({ section: entry.section, label: entry.label, summary: 'Contenido restaurado a su ubicación' });
        reload();
    }
    function askRestore(idx) {
        var unusedL = load(LS_UNUSED, []); var entry = unusedL[idx]; if (!entry) return;
        if (!entry.key) { alert('Este contenido no tiene ubicación de origen y no se puede restaurar.'); return; }
        var used = load(LS_USED, {}); var occupied = !!used[entry.key];
        var msg = 'Vas a restaurar <strong>' + esc(entry.label || 'contenido') + '</strong>' +
            (entry.section ? (' en la sección <strong>' + esc(entry.section) + '</strong>') : '') + '.';
        if (occupied) {
            var cur = used[entry.key];
            msg += '<div class="cms-confirm-warn"><i class="fa-solid fa-triangle-exclamation"></i> El contenido actual de esa ubicación (<strong>' +
                esc(cur.name || cur.label || '') + '</strong>) se moverá a <strong>no usados</strong>.</div>';
        } else {
            msg += '<div class="cms-confirm-warn"><i class="fa-solid fa-circle-info"></i> Volverá a mostrarse en el sitio.</div>';
        }
        confirmModal('Restaurar contenido', msg, function () { performRestore(idx); });
    }

    // ----- Contenedores: Renombrado y Asociación -----------------------------
    function getContainerMeta(key) {
        var containerNames = load(LS_CONTAINER_NAMES, {});
        var customLabel = containerNames[key];

        var parts = key.split('#');
        var base = parts[0];
        var idx = parts[1] ? parseInt(parts[1], 10) : 0;

        var section = 'Otros';
        var label = customLabel || key;
        var kind = 'image';

        if (base === 'hero.slide') {
            section = 'Portada';
            label = customLabel || ('Imagen Carrusel #' + (idx + 1));
            kind = 'image';
        } else if (base === 'soft.hero') {
            section = 'Portada';
            label = customLabel || ('Logo Stack Portada #' + (idx + 1));
            kind = 'image';
        } else if (base === 'soft.global') {
            section = 'Animaciones';
            label = customLabel || ('Logo Stack Animaciones #' + (idx + 1));
            kind = 'image';
        } else if (base === 'anim.bg') {
            section = 'Animaciones';
            label = customLabel || ('Video Fondo Animaciones #' + (idx + 1));
            kind = 'video';
        } else if (base === 'about.title') {
            section = 'Sobre mí';
            label = customLabel || 'Título — Sobre mí';
            kind = 'text';
        } else if (base === 'about.desc') {
            section = 'Sobre mí';
            label = customLabel || 'Biografía — Sobre mí';
            kind = 'text';
        } else if (base === 'about.photo') {
            section = 'Sobre mí';
            label = customLabel || 'Foto de Lucía — Sobre mí';
            kind = 'image';
        } else if (base === 'about.video') {
            section = 'Sobre mí';
            label = customLabel || 'Video — Sobre mí';
            kind = 'video';
        } else if (base === 'subtitle') {
            section = 'Subtítulos';
            label = customLabel || ('Subtítulo #' + (idx + 1));
            kind = 'text';
        } else if (base === 'char.name') {
            section = 'Character Design';
            label = customLabel || ('Nombre de personaje #' + (idx + 1));
            kind = 'text';
        } else if (base === 'char.role') {
            section = 'Character Design';
            label = customLabel || ('Rol de personaje #' + (idx + 1));
            kind = 'text';
        } else if (base === 'char.desc') {
            section = 'Character Design';
            label = customLabel || ('Descripción de personaje #' + (idx + 1));
            kind = 'text';
        } else if (base === 'char.portrait') {
            section = 'Character Design';
            label = customLabel || ('Retrato principal #' + (idx + 1));
            kind = 'image';
        } else if (base === 'char.concept') {
            section = 'Character Design';
            label = customLabel || ('Concept #' + (idx + 1));
            kind = 'image';
        } else if (base === 'char.railname') {
            section = 'Character Design';
            label = customLabel || ('Nombre carrusel inferior #' + (idx + 1));
            kind = 'text';
        } else if (base === 'char.railthumb') {
            section = 'Character Design';
            label = customLabel || ('Miniatura carrusel inferior #' + (idx + 1));
            kind = 'image';
        } else if (base === 'illu') {
            section = 'Ilustraciones';
            label = customLabel || ('Ilustración #' + (idx + 1));
            kind = 'image';
        } else if (base === 'anim') {
            section = 'Animations';
            label = customLabel || ('Animación #' + (idx + 1));
            kind = 'video';
        } else if (base === 'model3d.soft') {
            section = '3D Models';
            label = customLabel || ('Logo Software 3D #' + (idx + 1));
            kind = 'image';
        } else if (base === 'model3d.title') {
            section = '3D Models';
            label = customLabel || ('Título 3D #' + (idx + 1));
            kind = 'text';
        } else if (base === 'model3d.desc') {
            section = '3D Models';
            label = customLabel || ('Texto 3D #' + (idx + 1));
            kind = 'text';
        } else if (base === 'model3d') {
            section = '3D Models';
            label = customLabel || ('Video 3D #' + (idx + 1));
            kind = 'video';
        }

        return { label: label, section: section, kind: kind };
    }

    function renameContainerModal(key) {
        var used = load(LS_USED, {});
        var currentLabel = '';
        if (used[key]) {
            currentLabel = used[key].label;
        } else {
            var unusedL = load(LS_UNUSED, []);
            var matchUnused = unusedL.find(function(x) { return x.key === key; });
            if (matchUnused) {
                currentLabel = matchUnused.label;
            } else {
                var containerNames = load(LS_CONTAINER_NAMES, {});
                currentLabel = containerNames[key] || key;
            }
        }

        var body = document.createElement('div');
        body.className = 'cms-upload';
        body.innerHTML = '<div class="cms-meta-line" style="margin-bottom: 1rem;"><strong>Contenedor actual:</strong> ' + esc(currentLabel) + '</div>' +
            '<div class="cms-field" style="display:flex; flex-direction:column; gap:0.5rem;">' +
            '<span>Nuevo nombre del contenedor:</span>' +
            '<input type="text" id="rename-container-input" class="cms-input" style="width:100%;" value="' + esc(currentLabel) + '">' +
            '</div>';

        buildModal('Renombrar contenedor', body, [
            { label: 'Cancelar', onClick: closeOv },
            { label: 'Guardar', primary: true, onClick: function(ov) {
                var input = document.getElementById('rename-container-input');
                var newLabel = input ? input.value.trim() : '';
                if (!newLabel) {
                    alert('El nombre no puede estar vacío.');
                    return;
                }
                closeOv(ov);
                performRenameContainer(key, newLabel);
            } }
        ]);
    }

    function performRenameContainer(key, newLabel) {
        var containerNames = load(LS_CONTAINER_NAMES, {});
        var oldLabel = containerNames[key];
        containerNames[key] = newLabel;
        save(LS_CONTAINER_NAMES, containerNames);

        var used = load(LS_USED, {});
        if (used[key]) {
            if (!oldLabel) oldLabel = used[key].label;
            used[key].label = newLabel;
            save(LS_USED, used);
        }

        var unusedL = load(LS_UNUSED, []);
        var unusedChanged = false;
        unusedL.forEach(function(item) {
            if (item.key === key) {
                if (!oldLabel) oldLabel = item.label;
                item.label = newLabel;
                unusedChanged = true;
            }
        });
        if (unusedChanged) {
            save(LS_UNUSED, unusedL);
        }

        var trashL = load(LS_TRASH, []);
        var trashChanged = false;
        trashL.forEach(function(item) {
            if (item.key === key) {
                if (!oldLabel) oldLabel = item.label;
                item.label = newLabel;
                trashChanged = true;
            }
        });
        if (trashChanged) {
            save(LS_TRASH, trashL);
        }

        appendAudit({ 
            section: (used[key] && used[key].section) || 'Contenedores', 
            label: newLabel, 
            summary: 'Contenedor renombrado (anterior: ' + (oldLabel || key) + ')' 
        });
        reload();
    }

    function openAssociateContainerModal(item, isUnused, unusedIdx) {
        var used = load(LS_USED, {});
        var retiredL = load(LS_RETIRED, []);
        
        var allKeysSet = {};
        Object.keys(used).forEach(function(k) { allKeysSet[k] = true; });
        retiredL.forEach(function(k) { allKeysSet[k] = true; });
        var allKeys = Object.keys(allKeysSet);

        var itemKind = kindOf(item);
        
        var matchingContainers = allKeys.map(function(k) {
            var meta = getContainerMeta(k);
            return { key: k, meta: meta };
        }).filter(function(c) {
            return c.meta.kind === itemKind;
        });

        matchingContainers.sort(function(a, b) {
            var secA = a.meta.section || '';
            var secB = b.meta.section || '';
            if (secA !== secB) return secA.localeCompare(secB);
            var lblA = a.meta.label || '';
            var lblB = b.meta.label || '';
            return lblA.localeCompare(lblB);
        });

        var body = document.createElement('div');
        body.className = 'cms-upload';
        body.style.maxHeight = '60vh';
        body.style.overflowY = 'auto';
        
        var info = document.createElement('p');
        info.className = 'cms-admin-sub';
        info.style.marginBottom = '1rem';
        info.innerHTML = 'Asociar el archivo <strong>' + esc(item.name || '—') + '</strong> a un nuevo contenedor.';
        body.appendChild(info);

        var listContainer = document.createElement('div');
        listContainer.style.display = 'flex';
        listContainer.style.flexDirection = 'column';
        listContainer.style.gap = '0.8rem';

        if (matchingContainers.length === 0) {
            listContainer.innerHTML = '<p class="cms-admin-sub">No se encontraron contenedores compatibles.</p>';
        } else {
            matchingContainers.forEach(function(c) {
                var isOccupied = !!used[c.key];
                var occItem = used[c.key];
                
                var itemDiv = document.createElement('div');
                itemDiv.className = 'admin-card';
                itemDiv.style.margin = '0';
                itemDiv.style.padding = '0.8rem';
                itemDiv.style.display = 'flex';
                itemDiv.style.justifyContent = 'space-between';
                itemDiv.style.alignItems = 'center';
                itemDiv.style.border = '1px solid var(--border)';
                itemDiv.style.background = 'var(--bg-secondary)';
                
                var left = document.createElement('div');
                left.style.display = 'flex';
                left.style.flexDirection = 'column';
                left.style.gap = '0.2rem';
                left.style.textAlign = 'left';
                left.style.minWidth = '0';
                left.style.flex = '1';
                
                var sectionSpan = document.createElement('span');
                sectionSpan.style.fontSize = '0.75rem';
                sectionSpan.style.color = 'var(--accent)';
                sectionSpan.style.fontWeight = '700';
                sectionSpan.style.textTransform = 'uppercase';
                sectionSpan.textContent = c.meta.section;
                
                var labelSpan = document.createElement('span');
                labelSpan.style.fontSize = '0.9rem';
                labelSpan.style.fontWeight = '600';
                labelSpan.textContent = c.meta.label;
                
                var statusSpan = document.createElement('div');
                statusSpan.style.fontSize = '0.75rem';
                
                if (isOccupied) {
                    statusSpan.innerHTML = '<span class="cms-tag" style="background:#eab308; color:#000;">Ocupado</span>' +
                        ' <span style="opacity:0.7; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px; display:inline-block; vertical-align:middle;" title="' + esc(occItem.name || '') + '">(' + esc(occItem.name || 'archivo') + ')</span>';
                } else {
                    statusSpan.innerHTML = '<span class="cms-tag" style="background:#22c55e; color:#fff;">Libre</span>';
                }
                
                left.appendChild(sectionSpan);
                left.appendChild(labelSpan);
                left.appendChild(statusSpan);
                
                var right = document.createElement('div');
                var selBtn = document.createElement('button');
                selBtn.type = 'button';
                selBtn.className = 'cms-btn cms-btn--sm';
                selBtn.style.padding = '4px 10px';
                selBtn.textContent = 'Seleccionar';
                selBtn.addEventListener('click', function(ov) {
                    closeOv(ov);
                    if (isUnused) {
                        associateUnusedToContainer(unusedIdx, c.key);
                    } else {
                        associateUsedToContainer(item.key, c.key);
                    }
                }.bind(null, body));
                
                right.appendChild(selBtn);
                
                itemDiv.appendChild(left);
                itemDiv.appendChild(right);
                listContainer.appendChild(itemDiv);
            });
        }
        
        body.appendChild(listContainer);
        
        buildModal('Asociar a nuevo contenedor', body, [
            { label: 'Cancelar', onClick: closeOv }
        ], true);
    }

    function associateUnusedToContainer(unusedIdx, targetKey) {
        var used = load(LS_USED, {}), unusedL = load(LS_UNUSED, []), retiredL = load(LS_RETIRED, []), items = load(LS_OVERRIDES, {});
        var entry = unusedL.splice(unusedIdx, 1)[0];
        if (!entry) return;

        var targetMeta = getContainerMeta(targetKey);

        if (used[targetKey]) {
            var cur = used[targetKey];
            unusedL.push({
                key: targetKey, src: cur.src, dataUrl: cur.src, name: cur.name, size: cur.size,
                type: cur.type || (cur.kind === 'video' ? 'video/webm' : 'image/webp'), ts: Date.now(),
                label: cur.label, section: cur.section, original: cur.original, reason: 'replaced'
            });
        } else {
            var ri = retiredL.indexOf(targetKey);
            if (ri >= 0) retiredL.splice(ri, 1);
        }

        used[targetKey] = {
            key: targetKey,
            label: targetMeta.label,
            section: targetMeta.section,
            kind: kindOf(entry),
            src: entry.src || entry.dataUrl,
            name: entry.name,
            size: entry.size,
            original: entry.original
        };
        items[targetKey] = entry.src || entry.dataUrl;

        save(LS_USED, used); save(LS_UNUSED, unusedL); save(LS_RETIRED, retiredL); save(LS_OVERRIDES, items);
        appendAudit({ section: targetMeta.section, label: targetMeta.label, summary: 'Contenido sin usar asociado a contenedor' });
        reload();
    }

    function associateUsedToContainer(oldKey, targetKey) {
        if (oldKey === targetKey) return;
        var used = load(LS_USED, {}), unusedL = load(LS_UNUSED, []), retiredL = load(LS_RETIRED, []), items = load(LS_OVERRIDES, {});
        var entry = used[oldKey];
        if (!entry) return;

        var targetMeta = getContainerMeta(targetKey);

        delete used[oldKey];
        delete items[oldKey];
        if (retiredL.indexOf(oldKey) < 0) retiredL.push(oldKey);

        if (used[targetKey]) {
            var cur = used[targetKey];
            unusedL.push({
                key: targetKey, src: cur.src, dataUrl: cur.src, name: cur.name, size: cur.size,
                type: cur.type || (cur.kind === 'video' ? 'video/webm' : 'image/webp'), ts: Date.now(),
                label: cur.label, section: cur.section, original: cur.original, reason: 'replaced'
            });
        } else {
            var ri = retiredL.indexOf(targetKey);
            if (ri >= 0) retiredL.splice(ri, 1);
        }

        used[targetKey] = {
            key: targetKey,
            label: targetMeta.label,
            section: targetMeta.section,
            kind: kindOf(entry),
            src: entry.src || entry.dataUrl,
            name: entry.name,
            size: entry.size,
            original: entry.original
        };
        items[targetKey] = entry.src || entry.dataUrl;

        save(LS_USED, used); save(LS_UNUSED, unusedL); save(LS_RETIRED, retiredL); save(LS_OVERRIDES, items);
        appendAudit({ section: targetMeta.section, label: targetMeta.label, summary: 'Contenido movido de contenedor ' + oldKey + ' a ' + targetKey });
        reload();
    }

    function editInfo(key) {
        var used = load(LS_USED, {}); var entry = used[key]; if (!entry) return;
        var fields = entry.fields || [];
        var body = document.createElement('div'); body.className = 'cms-upload';
        var head = document.createElement('div'); head.className = 'cms-up-head';
        head.innerHTML = '<div class="cms-meta-line"><strong>Sección:</strong> ' + esc(entry.section) + '</div>' +
            '<div class="cms-meta-line"><strong>Contenido:</strong> ' + esc(entry.label) + '</div>';
        body.appendChild(head);
        if (!fields.length) {
            var p = document.createElement('p'); p.className = 'cms-admin-sub';
            p.textContent = 'Este contenido no tiene campos de información editables.';
            body.appendChild(p);
            buildModal('Editar información', body, [{ label: 'Cerrar', primary: true, onClick: closeOv }], true);
            return;
        }
        var inputs = [];
        var wrap = document.createElement('div'); wrap.className = 'cms-up-fields';
        wrap.innerHTML = '<div class="cms-fields-title">Información (se muestra en pantalla completa)</div>';
        fields.forEach(function (f) {
            var lab = document.createElement('label'); lab.className = 'cms-field';
            var sp = document.createElement('span'); sp.textContent = f.label; lab.appendChild(sp);
            var inp = f.textarea ? document.createElement('textarea') : document.createElement('input');
            if (f.textarea) inp.rows = 2; else inp.type = 'text';
            inp.value = f.value || ''; lab.appendChild(inp); wrap.appendChild(lab);
            inputs.push({ f: f, inp: inp });
        });
        body.appendChild(wrap);
        buildModal('Editar información', body, [
            { label: 'Cancelar', onClick: closeOv },
            { label: 'Guardar', primary: true, onClick: function (ov) {
                var items = load(LS_OVERRIDES, {}); var changed = false;
                inputs.forEach(function (x) {
                    var v = x.inp.value;
                    if (v !== x.f.value) { items[key + '::' + x.f.key] = v; x.f.value = v; changed = true; }
                });
                save(LS_OVERRIDES, items); save(LS_USED, used);
                if (changed) appendAudit({ section: entry.section, label: entry.label, summary: 'Información editada' });
                closeOv(ov); reload();
            } }
        ], true);
    }

    // ----- SECCIÓN: Resumen ---------------------------------------------------
    function stat(num, label, cls) {
        return '<div class="admin-stat' + (cls ? ' ' + cls : '') + '"><span class="admin-stat-num">' + num + '</span><span>' + label + '</span></div>';
    }
    
    function renderBatchBar(type, actionLabel, actName, isDanger) {
        var cls = isDanger ? 'cms-btn--primary" style="background:#ef4444; border-color:#ef4444;' : 'cms-btn--primary';
        var filtered = selectedItems.filter(function(x) { return x.type === type; });
        var isHidden = !multiSelectMode;
        var btnCancel = '<button type="button" class="cms-btn" data-act="toggle-multi">Cancelar Selección</button>';
        return '<div id="batch-bar-' + type + '" class="cms-batch-bar ' + (isHidden ? 'cms-batch-bar-hidden' : '') + '">' +
            '<div><strong class="batch-count">' + filtered.length + '</strong> elementos seleccionados</div>' +
            '<div style="display:flex; gap:0.5rem;">' +
            btnCancel +
            '<button type="button" class="cms-btn ' + cls + '" data-act="' + actName + '">' + actionLabel + '</button>' +
            '</div></div>';
    }

    function sectionResumen() {
        var totalUsed = sum(usedArr), totalUnused = sum(unusedArr);
        return '<div class="admin-card">' +
            '<h2><i class="fa-solid fa-gauge-high"></i> Resumen</h2>' +
            '<p class="cms-admin-sub">Panel de gestión del contenido del sitio. Elegí una sección en el menú lateral.</p>' +
            '<div class="admin-stats">' +
                stat(usedArr.length, 'contenidos usados') +
                stat(fmtBytes(totalUsed), 'espacio usado') +
                stat(unusedArr.length, 'contenidos no usados') +
                stat(fmtBytes(totalUnused), 'espacio liberable', 'admin-stat--warn') +
            '</div>' +
            '<div class="admin-quick">' +
                '<button type="button" class="cms-btn" data-act="goto" data-target="contenidos"><i class="fa-solid fa-photo-film"></i> Gestionar contenidos</button>' +
                '<button type="button" class="cms-btn" data-act="goto" data-target="auditoria"><i class="fa-solid fa-clipboard-list"></i> Ver auditoría</button>' +
            '</div>' +
        '</div>';
    }

    // ----- SECCIÓN: Contenidos (sub-pestañas usado / no usado) -----------------
    function usedCard(e) {
        var titulo = e.label || '';
        var labelHtml = titulo ? '<div class="cms-mlib-label"><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;" title="'+esc(titulo)+'">' + esc(titulo) + '</span></div>' : '';
        var fType = getFormat(e);
        var isSel = !!selectedItems.find(function(x){return x.type==='used' && x.val===e.key;});
        var chk = '<input type="checkbox" class="cms-multi-check" data-sel-type="used" data-sel-val="' + esc(e.key) + '" ' + (isSel?'checked':'') + '>';
        return '<div class="cms-mlib-item" data-card-type="used" data-card-key="' + esc(e.key) + '">' + chk +
            wrapThumb(e) +
            '<div class="cms-mlib-info">' + labelHtml +
            '<div class="cms-mlib-meta">' +
            '<div><strong>Nombre:</strong> ' + esc(e.name || '—') + '</div>' +
            '<div><strong>Formato:</strong> ' + fType + '</div>' +
            '<div><strong>Tamaño:</strong> ' + fmtBytes(e.size) + '</div>' +
            '<div><strong>Fecha de subida:</strong> ' + fmtDateOnly(e.ts || Date.now()) + '</div>' +
            '<div><strong>Hora de subida:</strong> ' + fmtTimeOnly(e.ts || Date.now()) + '</div>' +
            '</div>' +
            '<div class="cms-mlib-actions"><div class="cms-dropdown">' +
            '<button type="button" class="cms-iconbtn"><i class="fa-solid fa-ellipsis-vertical"></i></button>' +
            '<div class="cms-dropdown-menu">' +
            '<button type="button" class="cms-dropdown-item" data-act="associate-container" data-key="' + esc(e.key) + '"><i class="fa-solid fa-link" style="color:#a855f7;"></i> Asociar a otro contenedor</button>' +
            '<button type="button" class="cms-dropdown-item" data-act="rename-container" data-key="' + esc(e.key) + '"><i class="fa-solid fa-signature" style="color:#3b82f6;"></i> Renombrar contenedor</button>' +
            '<button type="button" class="cms-dropdown-item" data-act="edit-info" data-key="' + esc(e.key) + '"><i class="fa-solid fa-pen" style="color:#22c55e;"></i> Editar información</button>' +
            '<button type="button" class="cms-dropdown-item" data-act="move-unused" data-key="' + esc(e.key) + '"><i class="fa-solid fa-box-archive" style="color:#eab308;"></i> Mover a Sin Usar</button>' +
            '</div></div></div></div></div>';
    }
    function unusedCard(e) {
        var titulo = e.label || '';
        var extraTags = (e.reason === 'replaced' ? ' <span class="cms-tag">reemplazado</span>' : (e.reason === 'retired' ? ' <span class="cms-tag">retirado</span>' : ''));
        var labelHtml = (titulo || extraTags) ? '<div class="cms-mlib-label"><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;" title="'+esc(titulo)+'">' + esc(titulo) + '</span>' + extraTags + '</div>' : '';
        var fType = getFormat(e);
        var isSel = !!selectedItems.find(function(x){return x.type==='unused' && x.val===String(e._idx);});
        var chk = '<input type="checkbox" class="cms-multi-check" data-sel-type="unused" data-sel-val="' + e._idx + '" ' + (isSel?'checked':'') + '>';
        return '<div class="cms-mlib-item" data-card-type="unused" data-card-idx="' + e._idx + '">' + chk + wrapThumb(e) +
            '<div class="cms-mlib-info">' + labelHtml +
            '<div class="cms-mlib-meta">' +
            '<div><strong>Nombre:</strong> ' + esc(e.name || '—') + '</div>' +
            '<div><strong>Formato:</strong> ' + fType + '</div>' +
            '<div><strong>Tamaño:</strong> ' + fmtBytes(e.size) + '</div>' +
            '<div><strong>Fecha de subida:</strong> ' + fmtDateOnly(e.ts || Date.now()) + '</div>' +
            '<div><strong>Hora de subida:</strong> ' + fmtTimeOnly(e.ts || Date.now()) + '</div>' +
            '</div>' +
            '<div class="cms-mlib-actions"><div class="cms-dropdown">' +
            '<button type="button" class="cms-iconbtn"><i class="fa-solid fa-ellipsis-vertical"></i></button>' +
            '<div class="cms-dropdown-menu">' +
            '<button type="button" class="cms-dropdown-item" data-act="associate-container" data-idx="' + e._idx + '"><i class="fa-solid fa-link" style="color:#a855f7;"></i> Asociar a contenedor</button>' +
            (e.key ? '<button type="button" class="cms-dropdown-item" data-act="rename-container" data-key="' + esc(e.key) + '"><i class="fa-solid fa-signature" style="color:#3b82f6;"></i> Renombrar contenedor</button>' : '') +
            (e.key ? '<button type="button" class="cms-dropdown-item" data-act="restore-unused" data-idx="' + e._idx + '"><i class="fa-solid fa-rotate-left" style="color:#22c55e;"></i> Restaurar</button>' : '') +
            '<button type="button" class="cms-dropdown-item" data-act="move-trash" data-idx="' + e._idx + '"><i class="fa-solid fa-trash" style="color:#ef4444;"></i> Mover a basurero</button>' +
            '</div></div></div></div></div>';
    }
    function trashCard(e) {
        var titulo = e.label || '';
        var extraTags = ' <span class="cms-tag cms-tag--basurero">En papelera</span>';
        var labelHtml = '<div class="cms-mlib-label"><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;" title="'+esc(titulo)+'">' + esc(titulo) + '</span>' + extraTags + '</div>';
        var fType = getFormat(e);
        var isSel = !!selectedItems.find(function(x){return x.type==='trash' && x.val===String(e._idx);});
        var chk = '<input type="checkbox" class="cms-multi-check" data-sel-type="trash" data-sel-val="' + e._idx + '" ' + (isSel?'checked':'') + '>';
        return '<div class="cms-mlib-item" data-card-type="trash" data-card-idx="' + e._idx + '">' + chk + wrapThumb(e) +
            '<div class="cms-mlib-info">' + labelHtml +
            '<div class="cms-mlib-meta">' +
            '<div><strong>Nombre:</strong> ' + esc(e.name || '—') + '</div>' +
            '<div><strong>Formato:</strong> ' + fType + '</div>' +
            '<div><strong>Tamaño:</strong> ' + fmtBytes(e.size) + '</div>' +
            '<div><strong>Fecha de subida:</strong> ' + fmtDateOnly(e.deletedAt || Date.now()) + '</div>' +
            '<div><strong>Hora de subida:</strong> ' + fmtTimeOnly(e.deletedAt || Date.now()) + '</div>' +
            '</div>' +
            '<div class="cms-mlib-actions"><div class="cms-dropdown">' +
            '<button type="button" class="cms-iconbtn"><i class="fa-solid fa-ellipsis-vertical"></i></button>' +
            '<div class="cms-dropdown-menu">' +
            '<button type="button" class="cms-dropdown-item" data-act="restore-trash" data-idx="'+e._idx+'" data-key="'+esc(e.key)+'"><i class="fa-solid fa-folder-closed" style="color:#eab308;"></i> Mover a sin usar</button>' +
            '<button type="button" class="cms-dropdown-item" style="color:#ef4444;" data-act="del-perm" data-idx="'+e._idx+'" data-key="'+esc(e.key)+'"><i class="fa-solid fa-skull"></i> Borrar permanentemente</button>' +
            '</div></div></div></div></div>';
    }
    function repoCard(e) {
        var stateStr = e._state === 'used' ? '<span class="cms-tag cms-tag--uso">En Uso</span>' : 
                       (e._state === 'unused' ? '<span class="cms-tag cms-tag--nouso">Sin Usar</span>' : '<span class="cms-tag cms-tag--basurero">Basurero</span>');
        var titulo = e.label || '';
        var labelHtml = '<div class="cms-mlib-label"><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;" title="'+esc(titulo)+'">' + esc(titulo) + '</span> ' + stateStr + '</div>';
        
        var actionsHtml = '';
        if (e._state === 'used') {
            actionsHtml = '<div class="cms-mlib-actions"><div class="cms-dropdown">' +
                '<button type="button" class="cms-iconbtn"><i class="fa-solid fa-ellipsis-vertical"></i></button>' +
                '<div class="cms-dropdown-menu">' +
                '<button type="button" class="cms-dropdown-item" data-act="associate-container" data-key="' + esc(e.key) + '"><i class="fa-solid fa-link" style="color:#a855f7;"></i> Asociar a otro contenedor</button>' +
                '<button type="button" class="cms-dropdown-item" data-act="rename-container" data-key="' + esc(e.key) + '"><i class="fa-solid fa-signature" style="color:#3b82f6;"></i> Renombrar contenedor</button>' +
                '<button type="button" class="cms-dropdown-item" data-act="edit-info" data-key="' + esc(e.key) + '"><i class="fa-solid fa-pen" style="color:#22c55e;"></i> Editar información</button>' +
                '</div></div></div>';
        } else if (e._state === 'unused') {
            actionsHtml = '<div class="cms-mlib-actions"><div class="cms-dropdown">' +
                '<button type="button" class="cms-iconbtn"><i class="fa-solid fa-ellipsis-vertical"></i></button>' +
                '<div class="cms-dropdown-menu">' +
                '<button type="button" class="cms-dropdown-item" data-act="associate-container" data-idx="' + e._idx + '"><i class="fa-solid fa-link" style="color:#a855f7;"></i> Asociar a contenedor</button>' +
                (e.key ? '<button type="button" class="cms-dropdown-item" data-act="rename-container" data-key="' + esc(e.key) + '"><i class="fa-solid fa-signature" style="color:#3b82f6;"></i> Renombrar contenedor</button>' : '') +
                '<button type="button" class="cms-dropdown-item" data-act="move-trash-repo" data-idx="' + e._idx + '" data-url="' + esc(e.src || e.dataUrl) + '"><i class="fa-solid fa-trash" style="color:#ef4444;"></i> Mover a basurero</button>' +
                '</div></div></div>';
        }
        
        var fType = getFormat(e);
        return '<div class="cms-mlib-item" data-card-type="repo" data-card-state="' + e._state + '" data-card-key="' + esc(e.key || '') + '" data-card-idx="' + (e._idx != null ? e._idx : '') + '">' + wrapThumb(e) +
            '<div class="cms-mlib-info">' + labelHtml +
            '<div class="cms-mlib-meta">' +
            '<div><strong>Nombre:</strong> ' + esc(e.name || '—') + '</div>' +
            '<div><strong>Formato:</strong> ' + fType + '</div>' +
            '<div><strong>Tamaño:</strong> ' + fmtBytes(e.size) + '</div>' +
            '<div><strong>Fecha de subida:</strong> ' + fmtDateOnly(e.ts || e.deletedAt || Date.now()) + '</div>' +
            '<div><strong>Hora de subida:</strong> ' + fmtTimeOnly(e.ts || e.deletedAt || Date.now()) + '</div>' +
            '</div>' +
            actionsHtml + '</div></div>';
    }
        function renderGroups(arr, cardFn, emptyMsg, type) {
        if (!arr.length) return '<p class="cms-admin-sub">' + emptyMsg + '</p>';
        return groupBySection(arr).map(function (g) {
            var groupKey = type ? esc(g.section) : ''; 
            var chk = (multiSelectMode && type) ? '<input type="checkbox" data-act="select-group" data-type="'+type+'" data-group="'+groupKey+'" style="margin-left:0.5rem; transform: scale(1.2); cursor:pointer;" title="Seleccionar toda la sección">' : '';
            return '<div class="admin-group"><div class="admin-group-head">' +
                '<h4 style="display:flex; align-items:center;">' + esc(g.section) + chk + '</h4>' +
                '<span class="admin-badge">' + g.items.length + ' archivos &middot; ' + fmtBytes(sum(g.items)) + '</span></div>' +
                '<div class="cms-mlib-grid">' + g.items.map(cardFn).join('') + '</div></div>';
        }).join('');
    }
    function sectionContenidosUsado() {
        var totalUsed = sum(usedArr);
        var selectAll = '';
        return '<div class="admin-card' + (multiSelectMode ? ' cms-multi-mode' : '') + '">' +
            '<div class="admin-card-head"><h2><i class="fa-solid fa-check" style="color:#22c55e;"></i> Contenido en Uso</h2>' + selectAll + '<button type="button" class="cms-btn cms-btn--sm" data-act="toggle-multi" ' + (multiSelectMode ? '' : 'style="margin-left: auto;"') + '><i class="fa-solid fa-check-square"></i> ' + (multiSelectMode ? 'Deshabilitar Selección' : 'Selección Múltiple') + '</button>' + '</div>' +
            renderBatchBar('used', 'Mover a Sin Usar', 'batch-move-unused') +
            '<p class="cms-admin-sub" style="display:flex; flex-direction:column; gap:0.3rem;">' +
            '<span>Todo lo que el sitio muestra ahora, agrupado por sección.</span>' +
            '<span><strong>Cantidad:</strong> ' + usedArr.length + ' archivos.</span>' +
            '<span><strong>Tamaño total:</strong> ' + fmtBytes(totalUsed) + '</span></p>' +
            renderGroups(usedArr, usedCard, 'Todavía no hay contenido registrado.', 'used') +
        '</div>';
    }
    
    function sectionContenidosNoUsado() {
        var totalUnused = sum(unusedArr);
        var selectAll = '';
        return '<div class="admin-card' + (multiSelectMode ? ' cms-multi-mode' : '') + '">' + renderBatchBar('unused', 'Mover al Basurero', 'batch-move-trash', true) +
            '<div class="admin-card-head"><h2><i class="fa-solid fa-folder-closed"></i> Contenido Sin Usar</h2>' + '<button type="button" class="cms-btn cms-btn--sm" data-act="toggle-multi" style="margin-left: auto;"><i class="fa-solid fa-check-square"></i> ' + (multiSelectMode ? 'Deshabilitar Selección' : 'Selección Múltiple') + '</button>'  +
            (unusedArr.length ? '<button type="button" class="cms-btn cms-btn--sm cms-btn--primary" data-act="purge">Vaciar todo lo no usado</button>' : '') + '</div>' +
            '<p class="cms-admin-sub">Versiones reemplazadas o retiradas. Restauralas a su ubicación o envíalas al basurero. Tamaño total: ' + fmtBytes(totalUnused) + '</p>' +
            renderGroups(unusedArr, unusedCard, 'No hay contenidos sin usar. 👌', 'unused') +
        '</div>';
    }

    function sectionContenidosRepo() {
        var all = [];
        usedArr.forEach(function(x){ var y = Object.assign({}, x); y._state = 'used'; all.push(y); });
        unusedArr.forEach(function(x){ var y = Object.assign({}, x); y._state = 'unused'; all.push(y); });
        trashArr.forEach(function(x){ var y = Object.assign({}, x); y._state = 'trash'; all.push(y); });
        
        var filter = load(LS_REPO_FILTER, 'all');
        var filtered = all;
        if (filter !== 'all') {
            filtered = all.filter(function(x) { return x._state === filter; });
        }

        return '<div class="admin-card">' +
            '<div class="admin-card-head" style="align-items:center;"><h2><i class="fa-solid fa-cloud"></i> Repositorio Total</h2>' +
            '<div style="display:flex; align-items:center; gap:0.5rem;"><span style="font-size:0.85rem; font-weight:600; color:var(--text-secondary);">Filtrar por:</span>' +
            '<select id="repo-filter-select" style="padding:0.25rem 0.5rem; border-radius:4px; font-size:0.85rem; border:1px solid var(--border);">' +
            '<option value="all" '+(filter==='all'?'selected':'')+'>Todos los contenidos</option>' +
            '<option value="used" '+(filter==='used'?'selected':'')+'>Solo en uso</option>' +
            '<option value="unused" '+(filter==='unused'?'selected':'')+'>Solo sin usar</option>' +
            '<option value="trash" '+(filter==='trash'?'selected':'')+'>Solo basurero</option>' +
            '</select></div></div>' +
            '<p class="cms-admin-sub">Vista unificada de todo el contenido gestionado en todas sus etapas.</p>' +
            '<div class="cms-mlib-grid">' + filtered.map(repoCard).join('') + '</div>' +
        '</div>';
    }

    function sectionContenidosBasurero() {
        var totalTrash = sum(trashArr);
        var pol = load(LS_TRASH_POLICY, 'manual');
        var selectAll = '';
        return '<div class="admin-card' + (multiSelectMode ? ' cms-multi-mode' : '') + '">' + renderBatchBar('trash', 'Eliminar Permanentemente', 'batch-delete-perm', true) +
            '<div class="admin-card-head" style="align-items:center;"><h2><i class="fa-solid fa-trash-can"></i> Basurero</h2>' + '<button type="button" class="cms-btn cms-btn--sm" data-act="toggle-multi" style="margin-left: auto;"><i class="fa-solid fa-check-square"></i> ' + (multiSelectMode ? 'Deshabilitar Selección' : 'Selección Múltiple') + '</button>'  +
            '<div style="display:flex; gap:0.5rem; align-items:center;">' +
            '<span style="font-size:0.85rem; font-weight:600; color:var(--text-secondary);">Borrado automático:</span>' +
            '<select id="trash-policy-select" style="padding:0.25rem 0.5rem; border-radius:4px; font-size:0.85rem; border:1px solid var(--border);">' +
            '<option value="manual" '+(pol==='manual'?'selected':'')+'>Manual</option>' +
            '<option value="1d" '+(pol==='1d'?'selected':'')+'>1 día</option>' +
            '<option value="3d" '+(pol==='3d'?'selected':'')+'>3 días</option>' +
            '<option value="7d" '+(pol==='7d'?'selected':'')+'>1 semana</option></select>' +
            (trashArr.length ? '<button type="button" class="cms-btn cms-btn--sm cms-btn--primary" data-act="empty-trash">Vaciar todo</button>' : '') + 
            '</div></div>' +
            '<p class="cms-admin-sub">Contenido marcado para eliminar. Tamaño recuperable: ' + fmtBytes(totalTrash) + '</p>' +
            renderGroups(trashArr, trashCard, 'El basurero está vacío.', 'trash') +
        '</div>';
    }

    function sectionSubirContenido() {
        var hist = load(LS_UPLOAD_TEST, []);
        var histHtml = '';
        if (hist.length) {
            histHtml = '<h3 style="margin-top:2rem;">Últimas 3 subidas</h3>' +
                '<div class="cms-mlib-grid" style="margin-top:1rem;">' +
                hist.map(function(h) {
                    return '<div class="cms-mlib-item">' +
                        thumb(h.secure_url, h.origType, h.originalName) +
                        '<div class="cms-mlib-info"><div class="cms-mlib-label">Subida ' + fmtDate(h.ts) + '</div>' +
                        '<div class="cms-mlib-meta" style="font-size:0.75rem;">' +
                        'Original: ' + fmtBytes(h.origSize) + '<br>' +
                        'Final: <strong style="color:var(--c-uso);">' + fmtBytes(h.final_bytes) + '</strong> (' + esc(h.final_format) + ')</div>' +
                        '</div></div>';
                }).join('') + '</div>';
        }

        return '<div class="admin-card">' +
            '<h2><i class="fa-solid fa-vial"></i> Subir contenido</h2>' +
            '<p class="cms-admin-sub">Sube una imagen o video a Cloudinary de manera directa y obtén su optimización automática con IA.</p>' +
            '<div class="cms-upload" style="max-width: 800px; margin: 2rem auto; border: 2px dashed var(--border); padding: 3rem 1.5rem; border-radius: 16px; text-align: center; background: var(--bg-secondary);">' +
            '<label class="cms-btn cms-btn--primary" style="display:inline-block; cursor:pointer; padding: 1rem 2rem; font-size: 1.1rem; border-radius: 12px; transition: transform 0.2s;" id="test-upload-btn-wrap" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">' +
            '<i class="fa-solid fa-file-arrow-up fa-xl" style="margin-right:0.5rem;"></i> Seleccionar archivo de tu PC' +
            '<input type="file" id="test-upload-input" accept="image/*,video/*" style="display:none;">' +
            '</label>' +
            '</div>' + histHtml +
        '</div>';
    }

    // ----- SECCIÓN: Auditoría -------------------------------------------------
    function sectionAuditoria() {
        var rows = auditArr.slice().reverse().map(function (a) {
            var f = a.file ? (esc(a.file.name) + ' (' + fmtBytes(a.file.size) + ')') : '—';
            return '<tr><td>' + fmtDate(a.ts) + '</td><td>' + esc(a.user) + '</td><td>' + esc(a.section) +
                '</td><td>' + esc(a.label) + '</td><td>' + esc(a.summary) + '</td><td>' + f + '</td></tr>';
        }).join('');
        if (!rows) rows = '<tr><td colspan="6" class="cms-audit-empty">Sin cambios registrados.</td></tr>';
        return '<div class="admin-card">' +
            '<div class="admin-card-head"><h2><i class="fa-solid fa-clipboard-list"></i> Auditoría de cambios</h2>' +
            (auditArr.length ? '<button type="button" class="cms-btn cms-btn--sm" data-act="clear-audit">Vaciar registro</button>' : '') + '</div>' +
            '<p class="cms-admin-sub">' + auditArr.length + ' cambio(s) registrado(s). En producción vendrá de la BD vía el backend.</p>' +
            '<div class="cms-audit-table-wrap"><table class="cms-audit-table"><thead><tr>' +
            '<th>Fecha</th><th>Usuario</th><th>Sección</th><th>Contenedor</th><th>Acción</th><th>Archivo</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    // ----- SECCIÓN: Usuarios (sólo distribución / placeholder) ----------------
    function sectionUsuarios() {
        var mockRows = [
            { u: 'superadmin', rol: 'Administrador', estado: 'Activo' },
            { u: 'editor', rol: 'Editor de contenido', estado: 'Invitado' }
        ].map(function (r) {
            return '<tr><td>' + esc(r.u) + '</td><td>' + esc(r.rol) + '</td>' +
                '<td><span class="cms-tag">' + esc(r.estado) + '</span></td>' +
                '<td class="admin-row-actions">' +
                '<button type="button" class="icon-btn" disabled title="Próximamente"><i class="fa-solid fa-pen"></i></button>' +
                '<button type="button" class="icon-btn" disabled title="Próximamente"><i class="fa-solid fa-trash"></i></button>' +
                '</td></tr>';
        }).join('');
        return '<div class="admin-card">' +
            '<div class="admin-card-head"><h2><i class="fa-solid fa-users-gear"></i> Gestión de usuarios</h2>' +
            '<div class="admin-card-head-actions">' +
                '<button type="button" class="cms-btn cms-btn--sm cms-btn--primary" disabled title="Próximamente"><i class="fa-solid fa-plus"></i> Alta</button>' +
                '<button type="button" class="cms-btn cms-btn--sm" disabled title="Próximamente"><i class="fa-solid fa-pen"></i> Modificar</button>' +
                '<button type="button" class="cms-btn cms-btn--sm" disabled title="Próximamente"><i class="fa-solid fa-user-minus"></i> Baja</button>' +
            '</div></div>' +
            '<p class="cms-admin-sub"><i class="fa-solid fa-circle-info"></i> Distribución preparada. Alta / baja / modificación de usuarios y roles se implementarán con el backend.</p>' +
            '<div class="cms-audit-table-wrap"><table class="cms-audit-table"><thead><tr>' +
            '<th>Usuario</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>' + mockRows + '</tbody></table></div>' +
            '<span class="admin-soon">Próximamente</span>' +
        '</div>';
    }

    // ----- SECCIÓN: Ajustes del sitio (sólo distribución / placeholder) -------
    function mockToggle(label, on) {
        return '<div class="setting-item admin-mock-setting"><span>' + esc(label) + '</span>' +
            '<label class="switch"><input type="checkbox" disabled' + (on ? ' checked' : '') + '><span class="slider round"></span></label></div>';
    }
    function sectionAjustes() {
        return '<div class="admin-card">' +
            '<div class="admin-card-head"><h2><i class="fa-solid fa-sliders"></i> Ajustes del sitio</h2>' +
            '<span class="admin-soon">Próximamente</span></div>' +
            '<p class="cms-admin-sub"><i class="fa-solid fa-circle-info"></i> Distribución preparada para futuras opciones globales del sitio.</p>' +
            mockToggle('Idioma por defecto: Español', true) +
            mockToggle('Modo mantenimiento', false) +
            mockToggle('Mostrar enlaces a redes en el pie', true) +
            mockToggle('Permitir descargas del CV', true) +
        '</div>' +
        '<div class="admin-card">' +
            '<div class="admin-card-head"><h2><i class="fa-solid fa-shield-halved"></i> Seguridad y backend</h2>' +
            '<span class="admin-soon">Próximamente</span></div>' +
            '<p class="cms-admin-sub">Conexión con la API, hash de contraseñas, control de sesiones y respaldos.</p>' +
        '</div>';
    }

    var SECTIONS = {
        resumen: sectionResumen,
        'contenidos-usado': sectionContenidosUsado,
        'contenidos-nousado': sectionContenidosNoUsado,
        'contenidos-repo': sectionContenidosRepo,
        'contenidos-basurero': sectionContenidosBasurero,
        subircontenido: sectionSubirContenido,
        usuarios: sectionUsuarios,
        auditoria: sectionAuditoria,
        ajustes: sectionAjustes
    };

    // ----- Render / navegación ------------------------------------------------
    function renderDenied() {
        document.body.classList.add('admin-locked');
        root.innerHTML =
            '<div class="admin-card admin-denied">' +
            '<h2><i class="fa-solid fa-lock"></i> Acceso restringido</h2>' +
            '<p>Esta página es solo para el superadmin. Iniciá sesión desde el sitio.</p>' +
            '<a class="cms-btn cms-btn--primary" href="index.html">Ir al sitio</a></div>';
    }
    function renderActive() {
        if (!isAdmin()) { renderDenied(); return; }
        
        var uEl = document.getElementById('nav-badge-usado');
        if (uEl) uEl.innerHTML = 'En uso <span class="admin-nav-badge-stats">[ <span class="badge-count">' + usedArr.length + '</span> · <span class="badge-size">' + fmtBytes(sum(usedArr)) + '</span> ]</span>';
        var nuEl = document.getElementById('nav-badge-nousado');
        if (nuEl) nuEl.innerHTML = 'Sin usar <span class="admin-nav-badge-stats">[ <span class="badge-count">' + unusedArr.length + '</span> · <span class="badge-size">' + fmtBytes(sum(unusedArr)) + '</span> ]</span>';
        var rEl = document.getElementById('nav-badge-repo');
        if (rEl) rEl.innerHTML = 'Repositorio <span class="admin-nav-badge-stats">[ <span class="badge-count">' + (usedArr.length+unusedArr.length+trashArr.length) + '</span> · <span class="badge-size">' + fmtBytes(sum(usedArr)+sum(unusedArr)+sum(trashArr)) + '</span> ]</span>';
        var bEl = document.getElementById('nav-badge-basurero');
        if (bEl) bEl.innerHTML = 'Basurero <span class="admin-nav-badge-stats">[ <span class="badge-count">' + trashArr.length + '</span> · <span class="badge-size">' + fmtBytes(sum(trashArr)) + '</span> ]</span>';

        root.innerHTML = (SECTIONS[current] || sectionResumen)();
    }
    function setSection(s) {
        if (!SECTIONS[s]) return;
        selectedItems = [];
        multiSelectMode = false;
        current = s;
        document.querySelectorAll('.admin-nav-item').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-section') === s);
        });
        
        var isContenidos = s.indexOf('contenidos-') === 0 || s === 'subircontenido';
        var subMenu = document.getElementById('nav-sub-contenidos');
        var mainBtn = document.getElementById('nav-btn-contenidos');
        if (subMenu && mainBtn) {
            if (isContenidos) {
                subMenu.classList.add('open');
                mainBtn.querySelector('.fa-chevron-down').style.transform = 'rotate(180deg)';
                mainBtn.classList.add('active'); // Keep the parent visually active
            } else {
                subMenu.classList.remove('open');
                mainBtn.querySelector('.fa-chevron-down').style.transform = 'rotate(0deg)';
                mainBtn.classList.remove('active');
            }
        }
        
        renderActive();
    }
    function reload() {
        loadState();
        Promise.all([resolveSizes(usedArr), resolveSizes(unusedArr)]).then(renderActive);
    }

    // ----- Acciones (delegación de eventos) -----------------------------------
    
    document.addEventListener('change', function(e) {
        
        if (e.target.getAttribute('data-act') === 'select-all') {
            var typ = e.target.getAttribute('data-type');
            var isChecked = e.target.checked;
            selectedItems = []; // clear first
            
            if (isChecked) {
                var arr = typ === 'used' ? usedArr : (typ === 'unused' ? unusedArr : trashArr);
                arr.forEach(function(item) {
                    var val = typ === 'used' ? item.key : String(item._idx);
                    selectedItems.push({type: typ, val: val});
                });
            }
            
            // Check or uncheck all multi-checks
            document.querySelectorAll('.cms-multi-check[data-sel-type="' + typ + '"]').forEach(function(c) {
                c.checked = isChecked;
            });
            
            var bar = document.getElementById('batch-bar-' + typ);
            if (bar) {
                var cnt = bar.querySelector('.batch-count');
                if(cnt) cnt.textContent = selectedItems.length;
            }
        }

        
        if (e.target.getAttribute('data-act') === 'select-group') {
            var typ = e.target.getAttribute('data-type');
            var isChecked = e.target.checked;
            
            var groupDiv = e.target.closest('.admin-group');
            if (groupDiv) {
                var checkboxes = groupDiv.querySelectorAll('.cms-multi-check');
                checkboxes.forEach(function(c) {
                    if (c.checked !== isChecked) {
                        c.checked = isChecked;
                        var val = c.getAttribute('data-sel-val');
                        if (isChecked) {
                            if (!selectedItems.find(function(x) { return x.type === typ && x.val === val; })) {
                                selectedItems.push({type: typ, val: val});
                            }
                        } else {
                            selectedItems = selectedItems.filter(function(x) { return !(x.type === typ && x.val === val); });
                        }
                    }
                });
                
                var bar = document.getElementById('batch-bar-' + typ);
                if (bar) {
                    var cnt = bar.querySelector('.batch-count');
                    if(cnt) cnt.textContent = selectedItems.filter(function(x){return x.type===typ;}).length;
                }
            }
        }

        if (e.target.classList.contains('cms-multi-check')) {
            var typ = e.target.getAttribute('data-sel-type');
            var val = e.target.getAttribute('data-sel-val');
            
            if (e.target.checked) {
                if (!selectedItems.find(function(x) { return x.type === typ && x.val === val; })) {
                    selectedItems.push({type: typ, val: val});
                }
            } else {
                selectedItems = selectedItems.filter(function(x) { return !(x.type === typ && x.val === val); });
            }
            
            var bar = document.getElementById('batch-bar-' + typ);
            if (bar) {
                var filtered = selectedItems.filter(function(x) { return x.type === typ; });
                if (filtered.length > 0) {
                    bar.classList.remove('cms-batch-bar-hidden');
                    var cnt = bar.querySelector('.batch-count');
                    if(cnt) cnt.textContent = filtered.length;
                } else {
                    bar.classList.add('cms-batch-bar-hidden');
                }
            }
        }
    });

    document.addEventListener('click', function (e) {
        if (e.target.closest('a[href="index.html"]')) { try { sessionStorage.setItem('cms_skip_loader', '1'); } catch (err) {} }

        var navBtn = e.target.closest('.admin-nav-item');
        if (navBtn) { 
            var sec = navBtn.getAttribute('data-section');
            if (sec === 'group-contenidos') {
                var subMenu = document.getElementById('nav-sub-contenidos');
                var icon = navBtn.querySelector('.fa-chevron-down');
                if (subMenu) {
                    subMenu.classList.toggle('open');
                    if (icon) icon.style.transform = subMenu.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
                }
                return;
            }
            setSection(sec); 
            return; 
        }

        var sub = e.target.closest('[data-subtab]');
        if (sub) { contentTab = sub.getAttribute('data-subtab'); renderActive(); return; }

        // Click en la tarjeta de contenido para abrir vista previa (excepto si hace click en el menú de los tres puntos)
        var card = e.target.closest('.cms-mlib-item');
        if (card && card.getAttribute('data-card-type')) {
            if (e.target.closest('.cms-mlib-actions') || e.target.closest('.cms-dropdown-menu') || e.target.closest('.cms-multi-check')) {
                // Dejar que continúe y se maneje en el bloque de [data-act] más abajo
            } else {
                var cardType = card.getAttribute('data-card-type');
                var item = null;
                if (cardType === 'used') {
                    var key = card.getAttribute('data-card-key');
                    item = usedArr.find(function(x) { return x.key === key; });
                } else if (cardType === 'unused') {
                    var idx = parseInt(card.getAttribute('data-card-idx'), 10);
                    item = unusedArr[idx];
                } else if (cardType === 'trash') {
                    var idx = parseInt(card.getAttribute('data-card-idx'), 10);
                    item = trashArr[idx];
                } else if (cardType === 'repo') {
                    var state = card.getAttribute('data-card-state');
                    var key = card.getAttribute('data-card-key');
                    var idx = card.getAttribute('data-card-idx');
                    if (state === 'used') {
                        item = usedArr.find(function(x) { return x.key === key; });
                        if (item) { item = Object.assign({}, item); item._state = 'used'; }
                    } else if (state === 'unused') {
                        item = unusedArr[parseInt(idx, 10)];
                        if (item) { item = Object.assign({}, item); item._state = 'unused'; item._idx = parseInt(idx, 10); }
                    } else if (state === 'trash') {
                        item = trashArr[parseInt(idx, 10)];
                        if (item) { item = Object.assign({}, item); item._state = 'trash'; item._idx = parseInt(idx, 10); }
                    }
                }
                if (item) {
                    viewMediaModal(item, cardType);
                    return;
                }
            }
        }

        var btn = e.target.closest('[data-act]');
        if (btn) {
            var act = btn.getAttribute('data-act');
            
            
            if (act === 'toggle-multi') {
                multiSelectMode = !multiSelectMode;
                selectedItems = [];
                renderActive();
                return;
            }
            if (act === 'batch-cancel') {
                selectedItems = [];
                document.querySelectorAll('.cms-multi-check').forEach(function(c) { c.checked = false; });
                document.querySelectorAll('.cms-batch-bar').forEach(function(b) { b.classList.add('cms-batch-bar-hidden'); });
            }
            else if (act === 'batch-move-unused') {
                var itemsToMove = selectedItems.filter(function(x) { return x.type === 'used'; });
                if (!itemsToMove.length) return;
                confirmModal('Mover múltiples a no usados', '¿Mover ' + itemsToMove.length + ' elementos a sin usar?', function() {
                    var used = load(LS_USED, {});
                    var unusedL = load(LS_UNUSED, []);
                    var items = load(LS_OVERRIDES, {});
                    var retiredL = load(LS_RETIRED, []);
                    var count = 0;
                    itemsToMove.forEach(function(item) {
                        var mkey = item.val;
                        var entry = used[mkey];
                        if (entry) {
                            delete used[mkey];
                            delete items[mkey];
                            if (retiredL.indexOf(mkey) < 0) retiredL.push(mkey);
                            unusedL.push({
                                key: entry.key, src: entry.src, dataUrl: entry.src, name: entry.name, size: entry.size,
                                type: entry.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
                                label: entry.label, section: entry.section, original: entry.original, reason: 'retired'
                            });
                            count++;
                        }
                    });
                    save(LS_USED, used); save(LS_UNUSED, unusedL); save(LS_OVERRIDES, items); save(LS_RETIRED, retiredL);
                    appendAudit({ section: 'Lote', label: count + ' ítems', summary: 'Movidos a sin usar (Batch)' });
                    selectedItems = [];
                    multiSelectMode = false;
                    reload();
                });
            }
            else if (act === 'batch-move-trash') {
                var itemsToMove = selectedItems.filter(function(x) { return x.type === 'unused'; });
                if (!itemsToMove.length) return;
                confirmModal('Mover múltiples al basurero', '¿Mover ' + itemsToMove.length + ' elementos al basurero?', function() {
                    var ul = load(LS_UNUSED, []);
                    var tl = load(LS_TRASH, []);
                    var indices = itemsToMove.map(function(x) { return parseInt(x.val, 10); });
                    indices.sort(function(a, b) { return b - a; });
                    var count = 0;
                    indices.forEach(function(idx) {
                        var entry = ul.splice(idx, 1)[0];
                        if (entry) {
                            entry.deletedAt = Date.now();
                            tl.push(entry);
                            count++;
                        }
                    });
                    save(LS_UNUSED, ul); save(LS_TRASH, tl);
                    appendAudit({ section: 'Lote', label: count + ' ítems', summary: 'Movidos al basurero (Batch)' });
                    selectedItems = [];
                    multiSelectMode = false;
                    reload();
                });
            }
            else if (act === 'batch-delete-perm') {
                var itemsToMove = selectedItems.filter(function(x) { return x.type === 'trash'; });
                if (!itemsToMove.length) return;
                confirmModal('Eliminar permanentemente', '¿Eliminar ' + itemsToMove.length + ' elementos permanentemente? Esto no se puede deshacer.', function() {
                    var tl = load(LS_TRASH, []);
                    var indices = itemsToMove.map(function(x) { return parseInt(x.val, 10); });
                    indices.sort(function(a, b) { return b - a; });
                    
                    var toDeleteUrls = [];
                    var count = 0;
                    indices.forEach(function(idx) {
                        var entry = tl.splice(idx, 1)[0];
                        if (entry) {
                            var url = entry.src || entry.dataUrl;
                            if (url && url.indexOf('cloudinary.com') >= 0) toDeleteUrls.push(url);
                            count++;
                        }
                    });
                    save(LS_TRASH, tl);
                    
                    if (toDeleteUrls.length > 0) {
                        toast('Eliminando ' + toDeleteUrls.length + ' archivos de Cloudinary...', 'info');
                        Promise.all(toDeleteUrls.map(function(url) {
                            return fetch('/api/delete-media', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({url: url})
                            });
                        })).then(function() {
                            appendAudit({ section: 'Lote', label: count + ' ítems', summary: 'Eliminados permanentemente (Batch)' });
                            selectedItems = [];
                            reload();
                        }).catch(function() {
                            toast('Ocurrió un error borrando algunos archivos de Cloudinary', 'error');
                            reload();
                        });
                    } else {
                        appendAudit({ section: 'Lote', label: count + ' ítems', summary: 'Eliminados permanentemente locales (Batch)' });
                        selectedItems = [];
                        reload();
                    }
                });
            }

            else if (act === 'goto') { setSection(btn.getAttribute('data-target')); }
            else if (act === 'edit-info') { editInfo(btn.getAttribute('data-key')); }
            else if (act === 'rename-container') { renameContainerModal(btn.getAttribute('data-key')); }
            else if (act === 'associate-container') {
                var k = btn.getAttribute('data-key');
                if (k) {
                    var item = usedArr.find(function(x) { return x.key === k; });
                    if (item) openAssociateContainerModal(item, false, -1);
                } else {
                    var idx = parseInt(btn.getAttribute('data-idx'), 10);
                    var item = unusedArr[idx];
                    if (item) openAssociateContainerModal(item, true, idx);
                }
            }
            else if (act === 'move-unused') {
                var mkey = btn.getAttribute('data-key'); var u = load(LS_USED, {}); var lbl = (u[mkey] && u[mkey].label) || mkey;
                confirmModal('Mover a no usados',
                    'Vas a mover <strong>' + esc(lbl) + '</strong> a <strong>contenidos no usados</strong>.' +
                    '<div class="cms-confirm-warn"><i class="fa-solid fa-triangle-exclamation"></i> Se quitará del sitio. Podrás restaurarlo desde acá.</div>',
                    function () { moveUsedToUnused(mkey); });
            }
            else if (act === 'restore-unused') { askRestore(parseInt(btn.getAttribute('data-idx'), 10)); }
            else if (act === 'restore-trash') {
                var tl = load(LS_TRASH, []);
                var ul = load(LS_UNUSED, []);
                var entry = tl.splice(parseInt(btn.getAttribute('data-idx'), 10), 1)[0];
                if (entry) {
                    ul.push(entry);
                    save(LS_TRASH, tl); save(LS_UNUSED, ul);
                    appendAudit({ section: entry.section, label: entry.label, summary: 'Restaurado desde basurero a sin usar' });
                    reload();
                }
            }
            else if (act === 'move-trash') { moveUnusedToTrash(parseInt(btn.getAttribute('data-idx'), 10)); }
            else if (act === 'move-trash-repo') {
                var idx = parseInt(btn.getAttribute('data-idx'), 10);
                if (isNaN(idx)) {
                    var url = btn.getAttribute('data-url');
                    idx = unusedArr.findIndex(function(x) { return (x.src || x.dataUrl) === url; });
                }
                if (idx >= 0) {
                    moveUnusedToTrash(idx);
                }
            }
            else if (act === 'del-perm') { 
                var didx = parseInt(btn.getAttribute('data-idx'), 10);
                confirmModal('Eliminar permanentemente', '¿Eliminar permanentemente de Cloudinary? Esta acción no se puede deshacer.', function() {
                    deletePermanent(didx);
                });
            } else if (act === 'empty-trash') {
                confirmModal('Vaciar basurero', '¿Vaciar TODO el basurero y eliminar permanentemente de Cloudinary?', function() {
                    var tl = load(LS_TRASH, []);
                    var promises = tl.map(function(item) {
                        var url = item.src || item.dataUrl;
                        if (url && url.indexOf('cloudinary.com') >= 0) {
                            return fetch('/api/delete-media', {
                                                method: 'POST', headers: {'Content-Type': 'application/json'},
                                                body: JSON.stringify({url: url})
                                            }).catch(function(){});
                        }
                        return Promise.resolve();
                    });
                    var resDiv = document.getElementById('admin-root');
                    resDiv.innerHTML = '<div class="admin-card"><h2><i class="fa-solid fa-spinner fa-spin"></i> Vaciando basurero...</h2><p>Borrando archivos de Cloudinary. Por favor espera.</p></div>';
                    Promise.all(promises).then(function() {
                        save(LS_TRASH, []);
                        reload();
                    });
                });
            } else if (act === 'purge') {
                confirmModal('Vaciar contenidos sin usar', '¿Vaciar TODOS los contenidos sin usar? Esto los removerá de la lista, pero para borrarlos físicamente deben pasar por el basurero o ser borrados manualmente de Cloudinary.', function() {
                    save(LS_UNUSED, []); reload();
                });
            } else if (act === 'clear-audit') {
                confirmModal('Vaciar auditoría', '¿Vaciar el registro de auditoría?', function() {
                    save(LS_AUDIT, []); reload();
                });
            }
            return;
        }
    });

    document.addEventListener('change', function (e) {
        if (e.target.id === 'repo-filter-select') {
            save(LS_REPO_FILTER, e.target.value);
            reload();
            return;
        }

        if (e.target.id === 'trash-policy-select') {
            save(LS_TRASH_POLICY, e.target.value);
            autoCleanTrash();
            reload();
            return;
        }

        if (e.target.id === 'test-upload-input') {
            var file = e.target.files[0];
            if (!file) return;
            e.target.value = ''; // Reset input to allow selecting the same file again
            
            var origSize = file.size;
            var origName = file.name;
            var origType = file.type;
            
            var body = document.createElement('div');
            body.innerHTML = '<div style="background:var(--bg-secondary); padding:1.5rem; border-radius:12px; border:1px solid var(--border);">' +
                '<div style="margin-bottom:1rem;">' +
                    '<label style="display:block; font-size:0.85rem; font-weight:600; color:var(--text-secondary); margin-bottom:0.4rem;">Nombre del archivo</label>' +
                    '<input type="text" id="upload-custom-name" class="cms-field" value="' + esc(origName) + '" style="width:100%; padding:0.6rem; border-radius:8px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); font-family:inherit;">' +
                '</div>' +
                '<div style="display:flex; flex-direction:column; gap:0.4rem; font-size:0.85rem; color:var(--text-secondary);">' +
                    '<div><strong>Tamaño:</strong> <span style="font-family:\'Fira Code\',monospace;">' + fmtBytes(origSize) + '</span></div>' +
                    '<div><strong>Tipo de contenido:</strong> ' + (origType && origType.indexOf('video') >= 0 ? 'Video' : 'Imagen') + '</div>' +
                    '<div><strong>Formato:</strong> ' + esc(origType || 'Archivo') + '</div>' +
                '</div>' +
                '<p class="cms-admin-sub" style="margin: 1rem 0 0;">Se procesará con IA en la nube para máxima optimización.</p>' +
                '</div>';
                
            var modalActions = [
                { label: 'Cancelar', onClick: closeOv },
                { label: 'Comprimir y subir en Cloudinary', primary: true, onClick: function(ov) {
                    var customNameInput = body.querySelector('#upload-custom-name');
                    var finalName = customNameInput && customNameInput.value.trim() ? customNameInput.value.trim() : origName;

                    var actionsDiv = ov.querySelector('.cms-modal-actions');
                    if (actionsDiv) actionsDiv.style.display = 'none'; // Ocultar botones durante la subida
                    
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
                            var hist = load(LS_UPLOAD_TEST, []);
                            data.origSize = origSize; data.origType = origType; data.originalName = finalName; data.ts = Date.now();
                            hist.unshift(data);
                            if (hist.length > 3) hist.length = 3;
                            save(LS_UPLOAD_TEST, hist);
                            
                            var un = load(LS_UNUSED, []);
                            var type = origType.indexOf('video') >= 0 ? 'video/webm' : 'image/webp';
                            un.push({
                                src: data.secure_url,
                                dataUrl: data.secure_url,
                                name: finalName,
                                size: data.final_bytes,
                                type: type,
                                ts: Date.now(),
                                label: finalName,
                                original: true,
                                reason: 'upload'
                            });
                            save(LS_UNUSED, un);
                            
                            var isVid = origType.indexOf('video') >= 0;
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
                                
                            // Mostrar solo un botón de cerrar que además recarga para actualizar la UI principal
                            if (actionsDiv) {
                                actionsDiv.style.display = 'flex';
                                actionsDiv.innerHTML = '<button type="button" class="cms-btn cms-btn--primary">Cerrar y actualizar</button>';
                                actionsDiv.querySelector('button').addEventListener('click', function() {
                                    closeOv(ov);
                                    reload();
                                });
                            }
                        }).catch(function(err) {
                            body.innerHTML = '<div style="color:#ef4444; padding:1rem; background:rgba(239,68,68,0.1); border-radius:8px;"><i class="fa-solid fa-circle-exclamation"></i> Error: ' + esc(err.message) + '</div>';
                            if (actionsDiv) {
                                actionsDiv.style.display = 'flex';
                                actionsDiv.innerHTML = '<button type="button" class="cms-btn">Cerrar</button>';
                                actionsDiv.querySelector('button').addEventListener('click', function() { closeOv(ov); });
                            }
                        });
                    };
                    reader.readAsDataURL(file);
                } }
            ];
            
            buildModal('Subir nuevo contenido', body, modalActions, true);
        }
    });

    // ----- Init ---------------------------------------------------------------
    if (!isAdmin()) { renderDenied(); }
    else {
        loadState();
        renderActive(); // primer pintado inmediato (sin esperar tamaños)
        Promise.all([resolveSizes(usedArr), resolveSizes(unusedArr)]).then(renderActive);
    }
})();
