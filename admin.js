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

    var LS_ADMIN = 'cms_admin_v1';
    var LS_OVERRIDES = 'cms_overrides_v1';
    var LS_AUDIT = 'cms_audit_v1';
    var LS_UNUSED = 'cms_unused_v1';
    var LS_USED = 'cms_used_content_v1';
    var LS_RETIRED = 'cms_retired_v1';

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
    function sum(arr) { return arr.reduce(function (s, e) { return s + (e.size || 0); }, 0); }
    function isAdmin() { return localStorage.getItem(LS_ADMIN) === '1'; }
    function isVideo(t, n) { return (t && (t.indexOf('webm') >= 0 || t.indexOf('video') >= 0)) || (n && /\.webm$/i.test(n)); }
    function kindOf(e) { return (e.kind === 'video' || isVideo(e.type, e.name)) ? 'video' : 'image'; }

    function thumb(src, typeOrKind, name) {
        if (isVideo(typeOrKind, name) || typeOrKind === 'video') return '<span class="cms-mlib-noimg"><i class="fa-solid fa-film"></i></span>';
        if (!src) return '<span class="cms-mlib-noimg"><i class="fa-solid fa-image"></i></span>';
        return '<img src="' + esc(src) + '" alt="" loading="lazy">';
    }

    function appendAudit(e) {
        var a = load(LS_AUDIT, []);
        a.push({ ts: Date.now(), user: 'superadmin', section: e.section || '', label: e.label || '', kind: e.kind || 'gestión', summary: e.summary || '', file: null });
        save(LS_AUDIT, a);
    }

    // ----- Estado -------------------------------------------------------------
    var root = document.getElementById('admin-root');
    var current = 'resumen';
    var contentTab = 'usado';        // sub-pestaña de Contenidos: 'usado' | 'nousado'
    var usedArr = [], unusedArr = [], auditArr = [];

    function loadState() {
        var used = load(LS_USED, {});
        usedArr = Object.keys(used).map(function (k) { return used[k]; });
        unusedArr = load(LS_UNUSED, []);
        unusedArr.forEach(function (e, i) { e._idx = i; });
        auditArr = load(LS_AUDIT, []);
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
            b.textContent = a.label; b.addEventListener('click', function () { a.onClick(ov); }); foot.appendChild(b);
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
        var tag = e.original ? '<span class="cms-tag">original</span>' : '<span class="cms-tag cms-tag--up">subido</span>';
        return '<div class="cms-mlib-item">' +
            thumb(e.src || e.dataUrl, e.kind, e.name) +
            '<div class="cms-mlib-info"><div class="cms-mlib-label">' + esc(e.label) + ' ' + tag + '</div>' +
            '<div class="cms-mlib-meta">' + esc(e.name || '—') + ' · ' + fmtBytes(e.size) + '</div>' +
            '<div class="cms-mlib-actions">' +
            '<button type="button" class="cms-iconbtn" data-act="edit-info" data-key="' + esc(e.key) + '" title="Editar información"><i class="fa-solid fa-pen"></i></button>' +
            '<button type="button" class="cms-iconbtn cms-iconbtn--move" data-act="move-unused" data-key="' + esc(e.key) + '" title="Mover a no usados"><i class="fa-solid fa-box-archive"></i></button>' +
            '</div></div></div>';
    }
    function unusedCard(e) {
        return '<div class="cms-mlib-item">' + thumb(e.src || e.dataUrl, e.type, e.name) +
            '<div class="cms-mlib-info"><div class="cms-mlib-label">' + esc(e.label || 'Contenido') +
            (e.reason === 'replaced' ? ' <span class="cms-tag">reemplazado</span>' : (e.reason === 'retired' ? ' <span class="cms-tag">retirado</span>' : '')) + '</div>' +
            '<div class="cms-mlib-meta">' + esc(e.name || '—') + ' · ' + fmtBytes(e.size) + '</div>' +
            '<div class="cms-mlib-actions">' +
            (e.key ? '<button type="button" class="cms-btn cms-btn--sm cms-mlib-restore" data-act="restore-unused" data-idx="' + e._idx + '"><i class="fa-solid fa-rotate-left"></i> Restaurar</button>' : '') +
            '<button type="button" class="cms-btn cms-btn--sm cms-mlib-del" data-act="del-unused" data-idx="' + e._idx + '"><i class="fa-solid fa-trash"></i> Eliminar</button>' +
            '</div></div></div>';
    }
    function renderGroups(arr, cardFn, emptyMsg) {
        if (!arr.length) return '<p class="cms-admin-sub">' + emptyMsg + '</p>';
        return groupBySection(arr).map(function (g) {
            return '<div class="admin-group"><div class="admin-group-head">' +
                '<h4>' + esc(g.section) + '</h4>' +
                '<span class="admin-badge">' + g.items.length + ' · ' + fmtBytes(sum(g.items)) + '</span></div>' +
                '<div class="cms-mlib-grid">' + g.items.map(cardFn).join('') + '</div></div>';
        }).join('');
    }
    function sectionContenidos() {
        var totalUsed = sum(usedArr), totalUnused = sum(unusedArr);
        var tabs = '<div class="admin-subtabs">' +
            '<button type="button" class="admin-subtab' + (contentTab === 'usado' ? ' active' : '') + '" data-subtab="usado">' +
            '<i class="fa-solid fa-photo-film"></i> Contenido usado <span class="admin-badge">' + usedArr.length + ' · ' + fmtBytes(totalUsed) + '</span></button>' +
            '<button type="button" class="admin-subtab' + (contentTab === 'nousado' ? ' active' : '') + '" data-subtab="nousado">' +
            '<i class="fa-solid fa-trash-can"></i> Contenido no usado <span class="admin-badge admin-badge--warn">' + unusedArr.length + ' · ' + fmtBytes(totalUnused) + '</span></button>' +
            '</div>';
        var panel;
        if (contentTab === 'usado') {
            panel = '<div class="admin-card">' +
                '<h2><i class="fa-solid fa-photo-film"></i> Contenido usado</h2>' +
                '<p class="cms-admin-sub">Todo lo que el sitio muestra ahora, agrupado por sección. Tocá un contenido para editar su información, o movelo a no usados.</p>' +
                renderGroups(usedArr, usedCard, 'Todavía no hay contenido registrado. Iniciá sesión en el sitio para indexarlo.') +
            '</div>';
        } else {
            panel = '<div class="admin-card">' +
                '<div class="admin-card-head"><h2><i class="fa-solid fa-trash-can"></i> Contenido no usado</h2>' +
                (unusedArr.length ? '<button type="button" class="cms-btn cms-btn--sm cms-btn--primary" data-act="purge">Vaciar todo lo no usado</button>' : '') + '</div>' +
                '<p class="cms-admin-sub">Versiones reemplazadas o retiradas. Restauralas a su ubicación o eliminalas para liberar espacio.</p>' +
                renderGroups(unusedArr, unusedCard, 'No hay contenidos sin usar. 👌') +
            '</div>';
        }
        return tabs + panel;
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
        contenidos: sectionContenidos,
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
        root.innerHTML = (SECTIONS[current] || sectionResumen)();
    }
    function setSection(s) {
        if (!SECTIONS[s]) return;
        current = s;
        document.querySelectorAll('.admin-nav-item').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-section') === s);
        });
        renderActive();
    }
    function reload() {
        loadState();
        Promise.all([resolveSizes(usedArr), resolveSizes(unusedArr)]).then(renderActive);
    }

    // ----- Acciones (delegación de eventos) -----------------------------------
    document.addEventListener('click', function (e) {
        if (e.target.closest('a[href="index.html"]')) { try { sessionStorage.setItem('cms_skip_loader', '1'); } catch (err) {} }

        var navBtn = e.target.closest('.admin-nav-item');
        if (navBtn) { setSection(navBtn.getAttribute('data-section')); return; }

        var sub = e.target.closest('[data-subtab]');
        if (sub) { contentTab = sub.getAttribute('data-subtab'); renderActive(); return; }

        var btn = e.target.closest('[data-act]');
        if (btn) {
            var act = btn.getAttribute('data-act');
            if (act === 'goto') { setSection(btn.getAttribute('data-target')); }
            else if (act === 'edit-info') { editInfo(btn.getAttribute('data-key')); }
            else if (act === 'move-unused') {
                var mkey = btn.getAttribute('data-key'); var u = load(LS_USED, {}); var lbl = (u[mkey] && u[mkey].label) || mkey;
                confirmModal('Mover a no usados',
                    'Vas a mover <strong>' + esc(lbl) + '</strong> a <strong>contenidos no usados</strong>.' +
                    '<div class="cms-confirm-warn"><i class="fa-solid fa-triangle-exclamation"></i> Se quitará del sitio. Podrás restaurarlo desde acá.</div>',
                    function () { moveUsedToUnused(mkey); });
            }
            else if (act === 'restore-unused') { askRestore(parseInt(btn.getAttribute('data-idx'), 10)); }
            else if (act === 'del-unused') {
                var idx = parseInt(btn.getAttribute('data-idx'), 10);
                var ul = load(LS_UNUSED, []); ul.splice(idx, 1); save(LS_UNUSED, ul); reload();
            } else if (act === 'purge') {
                if (confirm('¿Vaciar TODOS los contenidos no usados? Libera espacio y no se puede deshacer.')) { save(LS_UNUSED, []); reload(); }
            } else if (act === 'clear-audit') {
                if (confirm('¿Vaciar el registro de auditoría?')) { save(LS_AUDIT, []); reload(); }
            }
            return;
        }

        // Click en una tarjeta de contenido usado → editar su información.
        var card = e.target.closest('.cms-mlib-item[data-edit-key]');
        if (card) { editInfo(card.getAttribute('data-edit-key')); }
    });

    // ----- Init ---------------------------------------------------------------
    if (!isAdmin()) { renderDenied(); }
    else {
        loadState();
        renderActive(); // primer pintado inmediato (sin esperar tamaños)
        Promise.all([resolveSizes(usedArr), resolveSizes(unusedArr)]).then(renderActive);
    }
})();
