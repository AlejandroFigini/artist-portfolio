/* Characters — character select (un panel a la vez) + filtros sobre el roster */
(function () {
    Gallery.reveal();

    var panels = [].slice.call(document.querySelectorAll('.cs-panel'));
    var picks = [].slice.call(document.querySelectorAll('.cs-pick'));

    function select(i) {
        panels.forEach(function (p, idx) { p.classList.toggle('active', idx === i); });
        picks.forEach(function (p) { p.classList.toggle('active', +p.getAttribute('data-index') === i); });
    }
    picks.forEach(function (pick) {
        pick.addEventListener('click', function () { select(+pick.getAttribute('data-index')); });
    });

    // Filtros: filtran el roster; si el personaje activo queda oculto, salta al primero visible
    var chips = document.querySelectorAll('.gallery-filters .gallery-chip');
    var countEl = document.getElementById('char-count-n');
    function applyFilter(f) {
        var firstVisible = -1, n = 0;
        picks.forEach(function (p) {
            var match = (f === 'all' || p.getAttribute('data-faction') === f);
            p.classList.toggle('is-hidden', !match);
            if (match) { n++; if (firstVisible === -1) firstVisible = +p.getAttribute('data-index'); }
        });
        if (countEl) countEl.textContent = n;
        var activePick = document.querySelector('.cs-pick.active');
        if (firstVisible !== -1 && (!activePick || activePick.classList.contains('is-hidden'))) select(firstVisible);
    }
    chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
            chips.forEach(function (c) { c.classList.remove('active'); });
            chip.classList.add('active');
            applyFilter(chip.getAttribute('data-filter'));
        });
    });

    // Galería por personaje: las miniaturas cambian la imagen principal
    panels.forEach(function (panel) {
        var portrait = panel.querySelector('.cs-portrait');
        var phIcon = portrait ? portrait.querySelector('.cs-ph i') : null;
        var thumbs = panel.querySelectorAll('.cs-thumb');
        thumbs.forEach(function (thumb) {
            thumb.addEventListener('click', function () {
                if (portrait) portrait.className = 'cs-portrait ' + thumb.getAttribute('data-color');
                if (phIcon) phIcon.className = 'fa-solid ' + thumb.getAttribute('data-icon');
                thumbs.forEach(function (t) { t.classList.remove('active'); });
                thumb.classList.add('active');
            });
        });
    });

    // Sección expandible (referencias/notas)
    document.querySelectorAll('.cs-more').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var extra = btn.parentElement.querySelector('.cs-extra');
            if (!extra) return;
            var open = extra.classList.toggle('show');
            btn.classList.toggle('open', open);
        });
    });
})();
