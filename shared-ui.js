/* ============================================================
   SHARED UI — chrome común inyectado en las páginas de galería
   Genera nav (con Portfolio + Gallery completo) + footer + settings +
   lightboxes desde un único lugar, para no duplicar ~110 líneas por página.
   Debe cargarse ANTES de script.js (los handlers de script.js corren en
   DOMContentLoaded y encuentran estos elementos ya inyectados).
   El <head> y el script de tema se mantienen inline en cada página
   (deben cargar temprano para evitar FOUC).
   ============================================================ */
(function () {
    var page = (location.pathname.split('/').pop() || 'index.html');

    var NAV =
        '<header>' +
        '  <div class="nav-container">' +
        '    <a href="index.html" class="logo">Lucia Montaña <span class="highlight">| Portfolio</span></a>' +
        '    <button class="nav-toggle" id="nav-toggle" aria-label="Abrir menú" aria-expanded="false"><span></span><span></span><span></span></button>' +
        '    <nav class="nav-links">' +
        '      <a href="index.html" data-i18n="nav_feed">Feed</a>' +
        '      <div class="dropdown">' +
        '        <div class="dropbtn" id="gallery-label" data-i18n="nav_gallery">Gallery <i class="fa-solid fa-chevron-down" style="font-size:0.7em;"></i></div>' +
        '        <div class="dropdown-content">' +
        '          <a href="illustrations.html" data-i18n="nav_illustrations"><i class="fa-solid fa-paintbrush"></i> Illustrations</a>' +
        '          <a href="animations.html" data-i18n="nav_animations"><i class="fa-solid fa-clapperboard"></i> Animations</a>' +
        '          <a href="characters.html" data-i18n="nav_characters"><i class="fa-solid fa-user-astronaut"></i> Character Design</a>' +
        '          <a href="models-3d.html" data-i18n="nav_3d"><i class="fa-solid fa-cube"></i> 3D Models</a>' +
        '          <a href="multimedia.html" data-i18n="nav_multimedia"><i class="fa-solid fa-photo-film"></i> Multimedia</a>' +
        '        </div>' +
        '      </div>' +
        '      <div class="dropdown">' +
        '        <div class="dropbtn" data-i18n="nav_portfolio">Portfolio <i class="fa-solid fa-chevron-down" style="font-size:0.7em;"></i></div>' +
        '        <div class="dropdown-content">' +
        '          <a href="#" target="_blank"><i class="fa-brands fa-artstation"></i> Artstation</a>' +
        '          <a href="#" target="_blank"><i class="fa-brands fa-vimeo-v"></i> Vimeo</a>' +
        '          <a href="#" target="_blank"><i class="fa-brands fa-youtube"></i> Youtube</a>' +
        '          <a href="#" target="_blank"><i class="fa-brands fa-instagram"></i> Instagram</a>' +
        '          <a href="#" target="_blank"><i class="fa-brands fa-behance"></i> Behance</a>' +
        '        </div>' +
        '      </div>' +
        '      <a href="index.html#presentacion" data-i18n="nav_about">About me</a>' +
        '      <a href="index.html#contacto" data-i18n="nav_contact">Contact</a>' +
        '      <a href="admin.html" class="admin-only" id="nav-admin-link">Gestión</a>' +
        '    </nav>' +
        '    <div class="nav-actions">' +
        '      <button type="button" class="cv-btn" id="cv-download" title="Download CV" aria-label="Download CV"><i class="fa-solid fa-file-arrow-down"></i><span>CV</span></button>' +
        '      <div id="cms-auth-nav"></div>' +
        '      <div class="lang-selector-nav">' +
        '        <button class="lang-btn" id="lang-toggle-nav" aria-label="Change language" title="Language"><span class="fi fi-us" id="lang-flag-nav"></span><span class="lang-code" id="lang-code-nav">EN</span></button>' +
        '        <div class="lang-dropdown" id="lang-dropdown-nav">' +
        '          <button class="lang-option" data-lang="en"><span class="fi fi-us"></span> English</button>' +
        '          <button class="lang-option" data-lang="es"><span class="fi fi-es"></span> Español</button>' +
        '          <button class="lang-option" data-lang="pt"><span class="fi fi-pt"></span> Português</button>' +
        '          <button class="lang-option" data-lang="fr"><span class="fi fi-fr"></span> Français</button>' +
        '        </div>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</header>' +
        '<div class="nav-backdrop" id="nav-backdrop"></div>';

    var FOOTER =
        '<footer class="main-footer">' +
        '  <div class="footer-grid">' +
        '    <div class="footer-col branding-col">' +
        '      <h2 class="footer-name">Lucia <span>Montaña</span></h2>' +
        '      <p class="footer-role">Licenciada en Animación y Videojuegos</p>' +
        '      <div class="footer-social-bubbles">' +
        '        <a href="#" target="_blank" class="social-bubble" title="Artstation"><i class="fa-brands fa-artstation"></i></a>' +
        '        <a href="#" target="_blank" class="social-bubble" title="Vimeo"><i class="fa-brands fa-vimeo-v"></i></a>' +
        '        <a href="#" target="_blank" class="social-bubble" title="Youtube"><i class="fa-brands fa-youtube"></i></a>' +
        '        <a href="#" target="_blank" class="social-bubble" title="Instagram"><i class="fa-brands fa-instagram"></i></a>' +
        '        <a href="#" target="_blank" class="social-bubble" title="Behance"><i class="fa-brands fa-behance"></i></a>' +
        '      </div>' +
        '    </div>' +
        '    <div class="footer-col links-col">' +
        '      <h3 class="footer-label">Exploration</h3>' +
        '      <ul class="footer-links-list">' +
        '        <li><a href="index.html#presentacion" data-i18n="nav_about">About me</a></li>' +
        '        <li><a href="illustrations.html" data-i18n="nav_illustrations">Illustrations</a></li>' +
        '        <li><a href="animations.html" data-i18n="nav_animations">Animations</a></li>' +
        '        <li><a href="characters.html" data-i18n="nav_characters">Characters</a></li>' +
        '        <li><a href="models-3d.html" data-i18n="nav_3d">3D Models</a></li>' +
        '        <li><a href="multimedia.html" data-i18n="nav_multimedia">Multimedia</a></li>' +
        '      </ul>' +
        '    </div>' +
        '    <div class="footer-col contact-col">' +
        '      <h3 class="footer-label">Connect</h3>' +
        '      <p class="contact-item"><i class="fa-solid fa-location-dot"></i> Montevideo, Uruguay</p>' +
        '      <a href="mailto:lumontana23@gmail.com" class="contact-email"><i class="fa-solid fa-envelope"></i> lumontana23@gmail.com</a>' +
        '      <button type="button" class="cv-btn cv-btn-footer" id="cv-download-footer" title="Download CV" aria-label="Download CV"><i class="fa-solid fa-file-arrow-down"></i><span>CV</span></button>' +
        '    </div>' +
        '  </div>' +
        '  <div class="footer-bottom-bar">' +
        '    <p class="footer-copyright">&copy; <span id="year"></span> Lucia Montaña | All rights reserved</p>' +
        '    <div class="legal-dots">Please do not repost my work without authorization</div>' +
        '  </div>' +
        '</footer>';

    var LIGHTBOXES =
        '<div id="image-lightbox" class="lightbox" onclick="handleLightboxClick(event, \'image\')">' +
        '  <span class="lightbox-close" onclick="closeLightbox()">&times;</span>' +
        '  <div class="lightbox-wrapper">' +
        '    <img id="lightbox-img" class="lightbox-content" src="">' +
        '    <button class="info-toggle-btn" onclick="toggleLightboxInfo(event)"><i class="fa-solid fa-circle-info"></i></button>' +
        '    <div class="lightbox-info-panel hidden"><h3 class="info-title"></h3><div class="info-divider"></div>' +
        '      <div class="info-meta"><span class="info-date hidden"><i class="fa-regular fa-calendar"></i> <span class="val"></span></span><span class="info-project hidden"><i class="fa-solid fa-folder-open"></i> <span class="val"></span></span></div>' +
        '      <p class="info-desc"></p>' +
        '      <p class="info-inspiration hidden"><i class="fa-solid fa-wand-magic-sparkles"></i> <b>Inspiration:</b> <span class="val"></span></p>' +
        '      <a class="info-link" target="_blank" rel="noopener" style="display:none"><i class="fa-solid fa-up-right-from-square"></i> Ver publicación original</a>' +
        '      <div class="info-footer"><span><i class="fa-solid fa-palette"></i> Lucia Montaña</span></div></div>' +
        '  </div>' +
        '</div>' +
        '<div id="video-lightbox" class="lightbox" onclick="handleLightboxClick(event, \'video\')">' +
        '  <span class="lightbox-close" onclick="closeVideoLightbox()">&times;</span>' +
        '  <div class="lightbox-wrapper">' +
        '    <video id="lightbox-video" class="lightbox-content" controls autoplay loop></video>' +
        '    <button class="info-toggle-btn" onclick="toggleLightboxInfo(event)"><i class="fa-solid fa-circle-info"></i></button>' +
        '    <div class="lightbox-info-panel hidden"><h3 class="info-title"></h3><div class="info-divider"></div>' +
        '      <div class="info-meta"><span class="info-date hidden"><i class="fa-regular fa-calendar"></i> <span class="val"></span></span><span class="info-project hidden"><i class="fa-solid fa-folder-open"></i> <span class="val"></span></span></div>' +
        '      <p class="info-desc"></p>' +
        '      <p class="info-inspiration hidden"><i class="fa-solid fa-wand-magic-sparkles"></i> <b>Inspiration:</b> <span class="val"></span></p>' +
        '      <div class="info-footer"><span><i class="fa-solid fa-palette"></i> Lucia Montaña</span></div></div>' +
        '  </div>' +
        '</div>';

    var SETTINGS =
        '<button id="settings-toggle" class="settings-gear" aria-label="Settings"><i class="fa-solid fa-gear"></i></button>' +
        '<div id="settings-panel" class="settings-panel hidden">' +
        '  <h3>Settings</h3>' +
        '  <div class="setting-item"><span>Dark Mode</span><label class="switch"><input type="checkbox" id="dark-mode-switch"><span class="slider round"></span></label></div>' +
        '  <div class="setting-item"><span>Pausar animaciones</span><label class="switch"><input type="checkbox" id="motion-switch"><span class="slider round"></span></label></div>' +
        '  <div class="setting-item"><span>Language</span>' +
        '    <div class="lang-selector-settings" id="lang-selector-settings">' +
        '      <button class="lang-btn-settings" id="lang-toggle-settings" aria-label="Change language"><span class="fi fi-us" id="lang-flag-settings"></span><span class="lang-code" id="lang-code-settings">EN</span><i class="fa-solid fa-chevron-down chev"></i></button>' +
        '      <div class="lang-dropdown-settings" id="lang-dropdown-settings">' +
        '        <button class="lang-option" data-lang="en"><span class="fi fi-us"></span> English</button>' +
        '        <button class="lang-option" data-lang="es"><span class="fi fi-es"></span> Español</button>' +
        '        <button class="lang-option" data-lang="pt"><span class="fi fi-pt"></span> Português</button>' +
        '        <button class="lang-option" data-lang="fr"><span class="fi fi-fr"></span> Français</button>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '  <div class="setting-item"><span>Curriculum</span><button type="button" class="cv-btn cv-btn-settings" id="cv-download-settings" title="Download CV"><i class="fa-solid fa-file-arrow-down"></i><span>Download CV</span></button></div>' +
        '</div>';

    // Inyectar: nav al principio del body; el resto al final.
    document.body.insertAdjacentHTML('afterbegin', NAV);
    document.body.insertAdjacentHTML('beforeend', FOOTER + LIGHTBOXES + SETTINGS);

    // Marcar el link activo de la galería según el archivo actual.
    var active = document.querySelector('.nav-links .dropdown-content a[href="' + page + '"]');
    if (active) active.classList.add('active');
})();
