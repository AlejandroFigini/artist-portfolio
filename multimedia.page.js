/* Multimedia — interacciones propias (reveal/filtros vienen de gallery-common.js) */
(function () {
    Gallery.stagger('.mm-wall .mm-card', 45);   // entrada en cascada
    Gallery.reveal();
    Gallery.filter({ chips: '.gallery-filters .gallery-chip', items: '.mm-wall .mm-card', attr: 'data-type', count: '#mm-count-n' });
    Gallery.tilt('.mm-card', { max: 6 });        // tilt 3D al puntero

    // Click → lightbox según el tipo de media (solo si hay media real)
    document.querySelectorAll('.mm-wall .mm-card').forEach(function (card) {
        card.addEventListener('click', function () {
            var type = card.getAttribute('data-type');
            if (type === 'image') {
                var img = card.querySelector('img.illu-img');
                if (Gallery.realMedia(img) && typeof window.openLightbox === 'function') {
                    window.openLightbox(img.currentSrc || img.src, card.getAttribute('data-title') || '',
                        card.getAttribute('data-desc') || '', card.getAttribute('data-link') || '');
                }
            } else if (type === 'video') {
                var v = card.querySelector('video.anim-video');
                if (Gallery.realMedia(v) && typeof window.openVideoLightbox === 'function') {
                    window.openVideoLightbox(v.currentSrc || v.getAttribute('src'),
                        card.getAttribute('data-title') || '', card.getAttribute('data-desc') || '');
                }
            }
        });
    });
})();
