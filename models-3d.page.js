/* 3D Models — interacciones propias (reveal/filtros vienen de gallery-common.js) */
(function () {
    Gallery.stagger('.m3d-grid .m3d-card', 50);   // entrada en cascada
    Gallery.reveal();
    Gallery.filter({ chips: '.gallery-filters .gallery-chip', items: '.m3d-grid .m3d-card', attr: 'data-cat', count: '#m3d-count-n' });
    Gallery.tilt('.m3d-card', { max: 6 });        // tilt 3D al puntero

    // Orbit-drag del cubo del hero (arrastrar para rotarlo)
    (function () {
        var stage = document.querySelector('.m3d-cube-stage');
        var cube = document.querySelector('.m3d-cube');
        if (!stage || !cube) return;
        var down = false, sx = 0, sy = 0, rx = -24, ry = 0;
        stage.style.cursor = 'grab';
        stage.addEventListener('pointerdown', function (e) { down = true; sx = e.clientX; sy = e.clientY; cube.classList.add('grabbed'); stage.style.cursor = 'grabbing'; });
        window.addEventListener('pointermove', function (e) {
            if (!down) return;
            cube.style.transform = 'rotateX(' + (rx - (e.clientY - sy) * 0.5) + 'deg) rotateY(' + (ry + (e.clientX - sx) * 0.5) + 'deg)';
        });
        window.addEventListener('pointerup', function (e) {
            if (!down) return; down = false; stage.style.cursor = 'grab';
            rx = rx - (e.clientY - sy) * 0.5; ry = ry + (e.clientX - sx) * 0.5;
        });
    })();

    // Toggle de modo (wire / clay / render)
    document.querySelectorAll('.m3d-viewport').forEach(function (vp) {
        var btns = vp.querySelectorAll('.m3d-modes button');
        btns.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                vp.classList.remove('mode-wire', 'mode-clay', 'mode-render');
                vp.classList.add('mode-' + btn.getAttribute('data-mode'));
                btns.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
            });
        });
    });

    // Lightbox de turntable (solo con video real)
    function openIfReal(card) {
        var v = card.querySelector('video.obs-video');
        if (!Gallery.realMedia(v)) return;
        if (typeof window.openVideoLightbox === 'function') {
            window.openVideoLightbox(v.currentSrc || v.getAttribute('src'),
                card.getAttribute('data-title') || '', card.getAttribute('data-desc') || '');
        }
    }
    document.querySelectorAll('.m3d-card .m3d-viewport').forEach(function (vp) {
        vp.addEventListener('click', function () { openIfReal(vp.closest('.m3d-card')); });
    });
    document.querySelectorAll('.m3d-spin').forEach(function (btn) {
        btn.addEventListener('click', function (e) { e.stopPropagation(); openIfReal(btn.closest('.m3d-card')); });
    });
})();
