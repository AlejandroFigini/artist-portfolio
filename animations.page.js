/* Animations — reel horizontal + hover-play + lightbox (reveal/filtros: gallery-common.js) */
(function () {
    Gallery.reveal();
    Gallery.filter({ chips: '.gallery-filters .gallery-chip', items: '.anim-grid .anim-card', attr: 'data-category', count: '#anim-count-n' });

    // Reel: arrastre + rueda; flechas avanzan de a una tarjeta
    Gallery.dragScroll('#anim-grid');
    var grid = document.getElementById('anim-grid');
    function step(dir) {
        var card = grid.querySelector('.anim-card');
        var amt = card ? card.getBoundingClientRect().width + 20 : 320;
        grid.scrollBy({ left: dir * amt, behavior: 'smooth' });
    }
    var prev = document.querySelector('.anim-arrow.prev'), next = document.querySelector('.anim-arrow.next');
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });

    // Hover-play (solo si hay un video real cargado)
    document.querySelectorAll('.anim-card, .anim-showreel').forEach(function (card) {
        var v = card.querySelector('video.anim-video');
        card.addEventListener('mouseenter', function () { if (Gallery.realMedia(v)) { try { v.play(); } catch (e) {} } });
        card.addEventListener('mouseleave', function () { if (Gallery.realMedia(v)) { try { v.pause(); } catch (e) {} } });
    });

    // Click → lightbox de video (reusa openVideoLightbox de script.js)
    document.querySelectorAll('.anim-card .anim-screen, .anim-showreel .anim-screen').forEach(function (screen) {
        screen.addEventListener('click', function () {
            var card = screen.closest('.anim-card, .anim-showreel');
            var v = screen.querySelector('video.anim-video');
            if (!Gallery.realMedia(v)) return;
            if (typeof window.openVideoLightbox === 'function') {
                window.openVideoLightbox(v.currentSrc || v.getAttribute('src'),
                    card.getAttribute('data-title') || '', card.getAttribute('data-desc') || '');
            }
        });
    });
})();
