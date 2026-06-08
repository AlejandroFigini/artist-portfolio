/* Illustrations — interacciones propias (reveal/filtros vienen de gallery-common.js) */
(function () {
    Gallery.stagger('.illu-gallery .illu-card', 45);   // entrada en cascada
    Gallery.reveal();
    Gallery.filter({ chips: '.gallery-filters .gallery-chip', items: '.illu-gallery .illu-card', attr: 'data-category', count: '#illu-count-n' });
    Gallery.tilt('.illu-card, .illu-spot-card', { max: 7 });   // parallax/tilt 3D al puntero

    // Click → lightbox de imagen, solo si hay imagen real cargada
    document.querySelectorAll('.illu-card, .illu-spot-card').forEach(function (card) {
        card.addEventListener('click', function () {
            var img = card.querySelector('img.illu-img');
            if (!Gallery.realMedia(img)) return;
            if (typeof window.openLightbox === 'function') {
                window.openLightbox(img.currentSrc || img.src,
                    card.getAttribute('data-title') || '',
                    card.getAttribute('data-desc') || '',
                    card.getAttribute('data-link') || '');
            }
        });
    });

    // Spotlight rotativo (carrusel imagen+texto)
    (function () {
        var slides = [].slice.call(document.querySelectorAll('.illu-spot-slide'));
        var dotsWrap = document.getElementById('illu-spot-dots');
        if (slides.length < 2 || !dotsWrap) return;
        var i = 0, timer;
        var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        slides.forEach(function (_, idx) {
            var b = document.createElement('button');
            b.className = 'illu-dot' + (idx === 0 ? ' active' : '');
            b.setAttribute('role', 'tab');
            b.setAttribute('aria-label', 'Slide ' + (idx + 1));
            b.addEventListener('click', function () { go(idx); restart(); });
            dotsWrap.appendChild(b);
        });
        var dots = [].slice.call(dotsWrap.children);
        function go(n) {
            slides[i].classList.remove('active'); dots[i].classList.remove('active');
            i = n;
            slides[i].classList.add('active'); dots[i].classList.add('active');
        }
        function next() { go((i + 1) % slides.length); }
        function restart() { if (reduced) return; clearInterval(timer); timer = setInterval(next, 5000); }
        restart();
        var sp = document.querySelector('.illu-spotlight');
        if (sp) {
            sp.addEventListener('mouseenter', function () { clearInterval(timer); });
            sp.addEventListener('mouseleave', restart);
        }
    })();
})();
