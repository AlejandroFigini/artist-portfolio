/* ============================================================
   GALLERY COMMON — helpers compartidos por las páginas de galería.
   window.Gallery:
     reveal()              → reveal en scroll (IntersectionObserver)
     filter(opts)          → filtros por chips
     realMedia(el)         → true si <img>/<video> tiene media real
     stagger(sel, step)    → retrasa la entrada (reveal) en cascada
     tilt(sel, opts)       → tilt 3D por puntero (solo mouse / no reduced-motion)
     dragScroll(sel)       → arrastrar + rueda para scroll horizontal
   ============================================================ */
(function () {
    var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    function reveal() {
        document.documentElement.classList.add('has-reveal');
        var els = document.querySelectorAll('.reveal');
        if ('IntersectionObserver' in window) {
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (e.isIntersecting) {
                        var t = e.target;
                        t.classList.add('in');
                        // limpiar el delay de cascada para que NO afecte hover/tilt luego
                        setTimeout(function () { t.style.transitionDelay = ''; }, 900);
                        io.unobserve(t);
                    }
                });
            }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
            els.forEach(function (el) { io.observe(el); });
        } else {
            els.forEach(function (el) { el.classList.add('in'); });
        }
    }

    // opts: { chips, items, attr, count }
    function filter(opts) {
        var chips = document.querySelectorAll(opts.chips);
        var items = document.querySelectorAll(opts.items);
        var attr = opts.attr || 'data-category';
        var countEl = opts.count ? document.querySelector(opts.count) : null;

        function apply(f) {
            var n = 0;
            items.forEach(function (it) {
                var match = (f === 'all' || it.getAttribute(attr) === f);
                it.classList.toggle('is-hidden', !match);
                if (match) n++;
            });
            if (countEl) countEl.textContent = n;
        }
        chips.forEach(function (chip) {
            chip.addEventListener('click', function () {
                chips.forEach(function (c) { c.classList.remove('active'); });
                chip.classList.add('active');
                apply(chip.getAttribute('data-filter'));
            });
        });
    }

    function realMedia(el) {
        if (!el) return false;
        if (el.tagName === 'IMG') {
            var s = el.getAttribute('src') || '';
            return s && s.slice(0, 14) !== 'data:image/gif';
        }
        if (el.tagName === 'VIDEO') return !!(el.currentSrc || el.getAttribute('src'));
        return false;
    }

    // Entrada en cascada: aplica transition-delay incremental a los .reveal
    function stagger(sel, step) {
        step = step || 60;
        document.querySelectorAll(sel).forEach(function (el, i) {
            el.style.transitionDelay = (i * step) + 'ms';
        });
    }

    // Tilt 3D siguiendo el puntero (no en táctil ni con reduced-motion)
    function tilt(sel, opts) {
        if (!FINE_POINTER || REDUCED) return;
        opts = opts || {};
        var max = opts.max || 8;
        document.querySelectorAll(sel).forEach(function (el) {
            el.addEventListener('pointerenter', function () { el.style.transition = 'transform 0.12s ease-out'; });
            el.addEventListener('pointermove', function (e) {
                var r = el.getBoundingClientRect();
                var px = (e.clientX - r.left) / r.width - 0.5;
                var py = (e.clientY - r.top) / r.height - 0.5;
                el.style.transform = 'perspective(800px) rotateX(' + (-py * max).toFixed(2) +
                    'deg) rotateY(' + (px * max).toFixed(2) + 'deg) translateY(-6px)';
            });
            el.addEventListener('pointerleave', function () { el.style.transition = ''; el.style.transform = ''; });
        });
    }

    // Scroll horizontal con arrastre (mouse) + rueda vertical → horizontal
    function dragScroll(sel) {
        var el = document.querySelector(sel);
        if (!el) return;
        var down = false, startX = 0, startScroll = 0, moved = false;
        el.addEventListener('pointerdown', function (e) {
            if (e.pointerType === 'touch') return;
            down = true; moved = false; startX = e.clientX; startScroll = el.scrollLeft;
            el.classList.add('dragging');
        });
        window.addEventListener('pointermove', function (e) {
            if (!down) return;
            var dx = e.clientX - startX;
            if (Math.abs(dx) > 4) moved = true;
            el.scrollLeft = startScroll - dx;
        });
        window.addEventListener('pointerup', function () { down = false; el.classList.remove('dragging'); });
        el.addEventListener('wheel', function (e) {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault(); }
        }, { passive: false });
        // un arrastre no debe disparar el click (p.ej. abrir lightbox)
        el.addEventListener('click', function (e) { if (moved) { e.stopPropagation(); e.preventDefault(); } }, true);
        return el;
    }

    // Transforma los .gallery-chip de una toolbar en un dropdown compacto.
    // No cambia la lógica de filtrado: al elegir una opción, "clickea" el chip
    // original (oculto) y deja que su handler existente filtre. Preserva i18n
    // copiando data-i18n del chip a la opción y a la etiqueta actual.
    function dropdownFilter(toolbar) {
        if (typeof toolbar === 'string') toolbar = document.querySelector(toolbar);
        if (!toolbar || toolbar.querySelector('.gfilter')) return;
        var filters = toolbar.querySelector('.gallery-filters');
        if (!filters) return;
        var chips = [].slice.call(filters.querySelectorAll('.gallery-chip'));
        if (!chips.length) return;
        var activeChip = chips.filter(function (c) { return c.classList.contains('active'); })[0] || chips[0];

        var dd = document.createElement('div');
        dd.className = 'gfilter';

        var trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'gfilter-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        var curKey = activeChip.getAttribute('data-i18n');
        trigger.innerHTML = '<i class="fa-solid fa-sliders"></i><span class="gfilter-current"' +
            (curKey ? ' data-i18n="' + curKey + '"' : '') + '>' + activeChip.textContent.trim() +
            '</span><i class="fa-solid fa-chevron-down gfilter-caret"></i>';
        var curSpan = trigger.querySelector('.gfilter-current');

        var list = document.createElement('ul');
        list.className = 'gfilter-list';
        list.setAttribute('role', 'listbox');
        chips.forEach(function (chip) {
            var li = document.createElement('li');
            var opt = document.createElement('button');
            opt.type = 'button';
            opt.className = 'gfilter-opt' + (chip.classList.contains('active') ? ' active' : '');
            opt.setAttribute('role', 'option');
            var k = chip.getAttribute('data-i18n');
            if (k) opt.setAttribute('data-i18n', k);
            opt.textContent = chip.textContent.trim();
            opt.addEventListener('click', function () {
                chip.click(); // dispara la lógica de filtrado original
                list.querySelectorAll('.gfilter-opt').forEach(function (o) { o.classList.remove('active'); });
                opt.classList.add('active');
                curSpan.textContent = opt.textContent;
                if (k) curSpan.setAttribute('data-i18n', k); else curSpan.removeAttribute('data-i18n');
                dd.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
            });
            li.appendChild(opt);
            list.appendChild(li);
        });

        dd.appendChild(trigger);
        dd.appendChild(list);
        filters.parentNode.insertBefore(dd, filters);
        filters.style.display = 'none';

        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = dd.classList.toggle('open');
            trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        document.addEventListener('click', function () { dd.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') dd.classList.remove('open'); });
    }

    // Auto-init: convierte toda .gallery-toolbar a dropdown una vez parseado el DOM.
    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.gallery-toolbar').forEach(function (tb) { dropdownFilter(tb); });
    });

    window.Gallery = { reveal: reveal, filter: filter, realMedia: realMedia, stagger: stagger, tilt: tilt, dragScroll: dragScroll, dropdownFilter: dropdownFilter };
})();
