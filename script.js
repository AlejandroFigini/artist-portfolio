document.addEventListener('DOMContentLoaded', () => {
    // =============================================
    // 1. HERO TYPEWRITER ANIMATION (SLOWER)
    // =============================================
    const ANIMATION_REPEAT_MS = 25000;
    const TYPEWRITER_SPEED_HERO = 0.1;
    const TYPEWRITER_SPEED_HERO_SUB = 0.04;

    let heroTitleHTML = "Lucia Montaña <span class='highlight'>| Portfolio</span>";
    let heroSubHTML = "Bachelor's degree on Animation and Videogames.<br>Illustrator, Character / environment design and 3D generalist";

    const heroH1 = document.querySelector('.hero-overlay h1');
    const heroP = document.querySelector('.hero-overlay p');

    function htmlToLetterSpans(htmlStr) {
        const tmp = document.createElement('div');
        tmp.innerHTML = htmlStr;
        const out = [];
        tmp.childNodes.forEach(node => {
            if (node.nodeType === 3) {
                for (const ch of node.textContent) {
                    const s = document.createElement('span');
                    s.className = 'letter';
                    s.innerHTML = ch === ' ' ? '&nbsp;' : ch;
                    out.push(s);
                }
            } else if (node.nodeType === 1) {
                if (node.tagName === 'BR') {
                    out.push(document.createElement('br'));
                } else {
                    const wrap = document.createElement(node.tagName);
                    wrap.className = node.className;
                    for (const ch of node.textContent) {
                        const s = document.createElement('span');
                        s.className = 'letter';
                        s.innerHTML = ch === ' ' ? '&nbsp;' : ch;
                        wrap.appendChild(s);
                    }
                    out.push(wrap);
                }
            }
        });
        return out;
    }

    function animateElement(el, htmlStr, startDelay, speedFactor = 0.035) {
        if (!el) return startDelay;
        el.innerHTML = '';
        const nodes = htmlToLetterSpans(htmlStr);
        nodes.forEach(n => el.appendChild(n));
        let d = startDelay;
        el.querySelectorAll('.letter').forEach(letter => {
            letter.style.animation = 'fadeLetter 0.6s ' + (d * speedFactor) + 's forwards cubic-bezier(0.2,0.8,0.2,1)';
            d++;
        });
        return d + 5;
    }

    function runHeroAnimation() {
        let d = 0;
        d = animateElement(heroH1, heroTitleHTML, d, TYPEWRITER_SPEED_HERO);
        d = animateElement(heroP, heroSubHTML, d, TYPEWRITER_SPEED_HERO_SUB);
    }

    let heroInterval = null;
    function startHeroInterval() {
        runHeroAnimation();
        if (heroInterval) clearInterval(heroInterval);
        heroInterval = setInterval(runHeroAnimation, ANIMATION_REPEAT_MS);
    }

    setTimeout(startHeroInterval, 1000);

    // =============================================
    // 2. INTERNATIONALIZATION
    // =============================================
    const translations = {
        en: {
            nav_feed: "Feed", nav_gallery: "Gallery", nav_portfolio: "Portfolio", nav_about: "About me", nav_contact: "Contact",
            nav_illustrations: "Illustrations", nav_animations: "Animations", nav_characters: "Character Design", nav_3d: "3D Models", nav_multimedia: "Multimedia",
            hero_title: "Lucia Montaña <span class='highlight'>| Portfolio</span>",
            hero_sub: "Bachelor's degree on Animation and Videogames.<br>Illustrator, Character / environment design and 3D generalist",
            hero_btn: "Explore gallery",
            about_title: "About Me",
            about_text_1: "<p>My name is <strong>Lucía Montaña</strong>, and I am a <strong>2D and 3D artist</strong> based in Montevideo, Uruguay.</p><p>I specialize in both design and animation, with a strong passion for creating characters and designs that bring identity and life to my work. I truly love conveying emotions and stories to the audience in the best possible way.</p><p>I hold a Bachelor's degree in <strong>Animation and Video Game Design</strong> from ORT University, Uruguay, and have been working as a freelance artist since 2019. I am now looking to broaden my horizons and be part of new projects!</p>",
            animations_title: "Animations", characters_title: "Character Design", models_3d_title: "3D Models", illustrations_title: "Illustrations"
        },
        es: {
            nav_feed: "Feed", nav_gallery: "Galería", nav_portfolio: "Portafolio", nav_about: "Acerca de mí", nav_contact: "Contacto",
            nav_illustrations: "Ilustraciones", nav_animations: "Animaciones", nav_characters: "Diseño de Personajes", nav_3d: "Modelos 3D", nav_multimedia: "Multimedia",
            hero_title: "Lucia Montaña <span class='highlight'>| Portafolio</span>",
            hero_sub: "Licenciada en Animación y Videojuegos.<br>Ilustradora, diseñadora de personajes/entornos y generalista 3D",
            hero_btn: "Explorar galería",
            about_title: "Sobre Mí",
            about_text_1: "<p>Mi nombre es <strong>Lucía Montaña</strong> y soy una <strong>artista 2D y 3D</strong> con sede en Montevideo, Uruguay.</p><p>Me especializo tanto en diseño como en animación, con una gran pasión por crear personajes y diseños que brinden identidad y vida a mi trabajo. Realmente amo transmitir emociones e historias a la audiencia de la mejor manera posible.</p><p>Tengo una Licenciatura en <strong>Animación y Diseño de Videojuegos</strong> de la Universidad ORT, Uruguay, y trabajo como artista freelance desde 2019. ¡Ahora busco ampliar mis horizontes y formar parte de nuevos proyectos!</p>",
            animations_title: "Animaciones", characters_title: "Diseño de Personajes", models_3d_title: "Modelos 3D", illustrations_title: "Ilustraciones"
        },
        pt: {
            nav_feed: "Feed", nav_gallery: "Galeria", nav_portfolio: "Portfólio", nav_about: "Sobre mim", nav_contact: "Contato",
            nav_illustrations: "Ilustrações", nav_animations: "Animações", nav_characters: "Design de Personagens", nav_3d: "Modelos 3D", nav_multimedia: "Multimídia",
            hero_title: "Lucia Montaña <span class='highlight'>| Portfólio</span>",
            hero_sub: "Bacharel em Animação e Videogames.<br>Ilustradora, designer de personagens/ambientes e generalista 3D",
            hero_btn: "Explorar galeria",
            about_title: "Olá! Eu sou a autora",
            about_text_1: "Apaixonada por contar histórias através do design de personagens e mundos 3D. Mesclo tradição e tecnologia para dar vida a visões únicas.",
            animations_title: "Animações", characters_title: "Design de Personagens", models_3d_title: "Modelos 3D", illustrations_title: "Ilustrações"
        },
        fr: {
            nav_feed: "Flux", nav_gallery: "Galerie", nav_portfolio: "Portfolio", nav_about: "À propos", nav_contact: "Contact",
            nav_illustrations: "Illustrations", nav_animations: "Animations", nav_characters: "Design de Personnages", nav_3d: "Modèles 3D", nav_multimedia: "Multimédia",
            hero_title: "Lucia Montaña <span class='highlight'>| Portfolio</span>",
            hero_sub: "Diplômée en Animation et Jeux Vidéo.<br>Illustratrice, designer de personnages/environnements et généraliste 3D",
            hero_btn: "Explorer la galerie",
            about_title: "Bonjour ! Je suis l'auteure",
            about_text_1: "Passionnée par le storytelling à travers le design de personnages et les mondes 3D. Je fusionne tradition et technologie pour donner vie à des visions uniques.",
            animations_title: "Animations", characters_title: "Design de Personnages", models_3d_title: "Modèles 3D", illustrations_title: "Illustrations"
        }
    };

    const updateLanguage = (lang) => {
        localStorage.setItem('lang', lang);
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = translations[lang][key];
            if (!translation) return;

            if (el.classList.contains('section-typewriter')) {
                el.dataset.text = translation;
                // If the section is already visible, we might want to re-trigger or just show
                if (el.classList.contains('visible')) {
                    animateElement(el, translation, 0, TYPEWRITER_SPEED_HERO);
                } else {
                    el.innerHTML = translation;
                }
            } else if (key === 'hero_title' || key === 'hero_sub') {
                if (key === 'hero_title') heroTitleHTML = translation;
                if (key === 'hero_sub') heroSubHTML = translation;
                // Hero animation will pick it up on next cycle or we trigger it
            } else {
                if (el.querySelector('i')) {
                    const icon = el.querySelector('i').outerHTML;
                    el.innerHTML = icon + ' ' + translation;
                } else {
                    el.innerHTML = translation;
                }
            }
        });
        startHeroInterval(); // Restart hero with new language
    };

    const langSelect = document.getElementById('language-select');
    let savedLang = localStorage.getItem('lang') || 'en';
    if (langSelect) {
        langSelect.value = savedLang;
        langSelect.addEventListener('change', (e) => updateLanguage(e.target.value));
    }
    updateLanguage(savedLang);

    // =============================================
    // 3. OTHER FEATURES (Slideshow, Video, Observer)
    // =============================================
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const slides = document.querySelectorAll('.slide');
    if (slides.length > 0) {
        let currentSlide = 0;
        const panClasses = ['pan-tl', 'pan-tr', 'pan-bl', 'pan-br', 'pan-c'];
        slides[0].classList.add(panClasses[Math.floor(Math.random() * panClasses.length)]);
        setInterval(() => {
            slides[currentSlide].classList.remove('slide-active', ...panClasses);
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('slide-active', panClasses[Math.floor(Math.random() * panClasses.length)]);
        }, 7000);
    }

    document.querySelectorAll('.video-container').forEach(container => {
        const vid = container.querySelector('video');
        const playPauseBtn = container.querySelector('.play-pause-btn');
        const fullscreenBtn = container.querySelector('.fullscreen-btn');
        if (vid) {
            container.addEventListener('mouseenter', () => {
                vid.play().then(() => { if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>'; }).catch(() => { });
            });
            container.addEventListener('mouseleave', () => {
                vid.pause(); if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            });
            if (playPauseBtn) {
                playPauseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (vid.paused) { vid.play().then(() => { playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>'; }); }
                    else { vid.pause(); playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; }
                });
            }
            if (fullscreenBtn) {
                fullscreenBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const source = vid.querySelector('source');
                    if (source) openVideoLightbox(source.src);
                });
            }
        }
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                if (e.target.classList.contains('section-typewriter') && !e.target.dataset.animated) {
                    animateElement(e.target, e.target.dataset.text, 0, TYPEWRITER_SPEED_HERO);
                    e.target.dataset.animated = "true";
                }
            }
        });
    }, { threshold: 0.1 });

    const sectionTitles = document.querySelectorAll('.section-typewriter');
    sectionTitles.forEach(title => {
        if (!title.dataset.text) title.dataset.text = title.innerHTML;
        title.innerHTML = '';
        observer.observe(title);
    });

    const illustrationsGrid = document.getElementById('illustrations-container');
    const illustrationFiles = [
        'Andy_s birthday.webp', 'Artboard 36.webp', 'Artboard_26.webp',
        'Captura de pantalla 2024-06-11 213817.webp', 'Captura de pantalla 2024-06-21 040725.webp',
        'Ejercicio 5 parte 3.webp', 'Ilustracion de escenario y personaje juntos.webp',
        'Pokemon 9gen.webp', 'Tony terminado.webp', 'afiche (1).webp',
        'concept leda 1.webp', 'fondo_1_con_personajes.webp', 'post menu.webp',
        'ramen party.webp', 'recuerdo abuelo.webp', 'recuerdo pezca sin borde.webp',
        'recuerdo11ghft.webp', 'sardins.webp', 'shoashoa.webp', 'ya.webp'
    ];
    if (illustrationsGrid) {
        illustrationsGrid.innerHTML = '';
        illustrationFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'gallery-item fade-in';
            item.style.transitionDelay = (index * 0.02) + 's';
            const duration = (Math.random() * 3 + 3).toFixed(2) + 's';
            const delay = (Math.random() * -5).toFixed(2) + 's';
            const floatAmount = (Math.random() * -10 - 10).toFixed(1) + 'px';
            const floatRotate = (Math.random() * 2 - 1).toFixed(1) + 'deg';
            item.style.animationDuration = duration;
            item.style.animationDelay = delay;
            item.style.setProperty('--float-amount', floatAmount);
            item.style.setProperty('--float-rotate', floatRotate);
            const imgPath = 'assets/images/feed/ilustrations/' + file;
            item.innerHTML = `
                <img src="${imgPath}" alt="${file}"><div class="gallery-overlay"><button class="expand-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                </button></div>`;
            item.addEventListener('click', () => openLightbox(imgPath));
            illustrationsGrid.appendChild(item);
            observer.observe(item);
        });
    }

    // =============================================
    // 5. CHARACTER ACCORDION (SLOWER NAMES, FASTER ROLES)
    // =============================================
    const ACCORDION_INTERVAL_MS = 15000;
    const TYPEWRITER_REPEAT_MS = 25000;
    const TYPEWRITER_SPEED_NAME = 0.15;
    const TYPEWRITER_SPEED_ROLE = 0.06;

    const charCards = document.querySelectorAll('.char-card');

    charCards.forEach(card => {
        const nameEl = card.querySelector('.char-name');
        const roleEl = card.querySelector('.char-role');
        if (nameEl) nameEl.dataset.text = nameEl.innerHTML;
        if (roleEl) roleEl.dataset.text = roleEl.innerHTML;
    });

    const triggerCharTypewriter = (card) => {
        const nameEl = card.querySelector('.char-name');
        const roleEl = card.querySelector('.char-role');
        if (!nameEl || !roleEl) return;
        let d = 0;
        d = animateElement(nameEl, nameEl.dataset.text, d, TYPEWRITER_SPEED_NAME);
        d = animateElement(roleEl, roleEl.dataset.text, d, TYPEWRITER_SPEED_ROLE);
    };

    const activateCardIdx = (idx) => {
        charCards.forEach(c => c.classList.remove('active'));
        charCards[idx].classList.add('active');
        triggerCharTypewriter(charCards[idx]);
    };

    let currentIdx = 0;
    charCards.forEach((card, idx) => {
        card.addEventListener('click', () => {
            if (card.classList.contains('active')) return;
            currentIdx = idx;
            activateCardIdx(idx);
            resetRotationTimer();
        });
    });

    let rotationTimer = setInterval(() => {
        currentIdx = (currentIdx + 1) % charCards.length;
        activateCardIdx(currentIdx);
    }, ACCORDION_INTERVAL_MS);

    function resetRotationTimer() {
        clearInterval(rotationTimer);
        rotationTimer = setInterval(() => {
            currentIdx = (currentIdx + 1) % charCards.length;
            activateCardIdx(currentIdx);
        }, ACCORDION_INTERVAL_MS);
    }

    setInterval(() => {
        const activeCard = document.querySelector('.char-card.active');
        if (activeCard) triggerCharTypewriter(activeCard);
    }, TYPEWRITER_REPEAT_MS);

    setTimeout(() => {
        const activeAtStart = document.querySelector('.char-card.active');
        if (activeAtStart) triggerCharTypewriter(activeAtStart);
    }, 1500);

    document.querySelectorAll('.fade-in, .presentation-container, .section-title, .animation-item, .char-accordion, .model-row, .animations-container-inner, .characters-container-inner').forEach(el => observer.observe(el));

    // Handle settings gear interaction
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsToggle && settingsPanel) {
        settingsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsPanel.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (!settingsPanel.contains(e.target) && e.target !== settingsToggle) {
                settingsPanel.classList.add('hidden');
            }
        });
    }

    // Handle Dark Mode toggle
    const darkModeSwitch = document.getElementById('dark-mode-switch');
    if (darkModeSwitch) {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        darkModeSwitch.checked = savedTheme === 'dark';
        darkModeSwitch.addEventListener('change', (e) => {
            const theme = e.target.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        });
    }
});

// Lightbox functions (Global scope)
function openLightbox(src) {
    const lb = document.getElementById('image-lightbox');
    const img = document.getElementById('lightbox-img');
    if (lb && img) { img.src = src; lb.style.display = 'block'; setTimeout(() => lb.style.opacity = '1', 10); }
}
function closeLightbox() {
    const lb = document.getElementById('image-lightbox');
    if (lb) { lb.style.opacity = '0'; setTimeout(() => lb.style.display = 'none', 300); }
}
function openVideoLightbox(src) {
    const lb = document.getElementById('video-lightbox');
    const vid = document.getElementById('lightbox-video');
    if (lb && vid) { vid.src = src; lb.style.display = 'block'; setTimeout(() => { lb.style.opacity = '1'; vid.play(); }, 10); }
}
function closeVideoLightbox(event) {
    if (event && event.target.id !== 'video-lightbox' && !event.target.classList.contains('lightbox-close')) return;
    const lb = document.getElementById('video-lightbox');
    if (lb) { lb.style.opacity = '0'; setTimeout(() => { lb.style.display = 'none'; const vid = document.getElementById('lightbox-video'); if (vid) { vid.pause(); vid.src = ''; } }, 300); }
}
function createBubbles() {
    const container = document.getElementById('bubbles-container');
    if (!container) return;
    const bubbleCount = 20;
    for (let i = 0; i < bubbleCount; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        const size = Math.random() * 60 + 20 + 'px';
        const left = Math.random() * 100 + '%';
        const delay = Math.random() * 10 + 's';
        const duration = Math.random() * 5 + 10 + 's';
        bubble.style.width = size;
        bubble.style.height = size;
        bubble.style.left = left;
        bubble.style.animationDelay = delay;
        bubble.style.animationDuration = duration;
        container.appendChild(bubble);
    }
}

// =============================================
// RANDOM 3D TEXT GENERATOR (Viewport HUD)
// =============================================
(function init3DTextGenerator() {
    const container = document.getElementById('random3dText');
    if (!container) return;

    function spawnText() {
        const generators = [
            () => `POLY_COUNT: ${(Math.floor(Math.random() * 100000) + 10000).toLocaleString()}`,
            () => `VERTEX_WELD: ${(Math.random() * 0.05).toFixed(3)}`,
            () => `SKIN_MODIFIER: ${Math.floor(Math.random() * 128)} bones`,
            () => `BITMAP: ${[512, 1024, 2048, 4096][Math.floor(Math.random()*4)]}x${[512, 1024, 2048, 4096][Math.floor(Math.random()*4)]}`,
            () => `SUBDIVISION: level ${Math.floor(Math.random() * 5)}`,
            () => `CAM_FOV: ${Math.floor(Math.random() * (90 - 18) + 18)}mm`,
            () => `RENDER_TIME: 00:${Math.floor(Math.random()*60).toString().padStart(2,'0')}:${Math.floor(Math.random()*60).toString().padStart(2,'0')}`,
            () => `RETOPOLOGY: ${(Math.floor(Math.random() * 20000) + 2000).toLocaleString()} tris`,
            () => `SPLINE: ${Math.floor(Math.random() * 64)} knots`,
            () => `KEYFRAME: f.${Math.floor(Math.random() * 600)}`,
            () => `CHAMFER: ${(Math.random() * 2.5).toFixed(1)} segs:${Math.floor(Math.random()*5)}`,
            () => `EXTRUDE: ${(Math.random() * 45).toFixed(1)} units`,
            () => `INSET: ${(Math.random() * 8.5).toFixed(1)}`,
            () => `SCATTER: ${Math.floor(Math.random() * 5000)} objects`,
            () => `MESH_DENSITY: ${(Math.random() * 0.99).toFixed(2)}`,
            () => 'UV_UNWRAP: COMPLETE', () => 'NORMALS: RECALCULATED', () => 'TURBOSMOOTH: ON',
            () => 'RELAX: 0.5 iter:10', () => 'PHYSX: simulating', () => 'SYMMETRY: ON', () => 'PIVOT: centered'
        ];

        const genIdx = Math.floor(Math.random() * generators.length);
        const currentGen = generators[genIdx];

        const span = document.createElement('span');
        span.textContent = currentGen();
        span.style.left = (Math.random() * 85 + 5) + '%';
        span.style.top = (Math.random() * 80 + 10) + '%';
        span.style.animationDuration = (Math.random() * 12 + 14) + 's';
        span.style.animationDelay = (Math.random() * 4) + 's';
        container.appendChild(span);

        // Update value while it exists (Live effect)
        const updateTimer = setInterval(() => {
            if (Math.random() > 0.6) { // 40% chance per second to update
                span.textContent = currentGen();
            }
        }, 1200);

        // Remove after animation ends
        setTimeout(() => { 
            clearInterval(updateTimer);
            if (span.parentNode) span.remove(); 
        }, 26000);
    }

    // Initial batch (30 elements for density)
    for (let i = 0; i < 30; i++) {
        setTimeout(() => spawnText(), i * 400);
    }

    // Keep spawning frequently (every 1 second)
    setInterval(spawnText, 1000);
})();

// =============================================
// HUD LIVE STATS UPDATER (Poly, FPS, Angle)
// =============================================
(function initHUDUpdater() {
    const elPoly = document.getElementById('hud-poly');
    const elGrid = document.getElementById('hud-grid');
    const elFps = document.getElementById('hud-fps');
    const elSnap = document.getElementById('hud-snap');

    if (!elPoly) return;

    setInterval(() => {
        // Randomize Poly Count slightly around a base number
        const basePoly = 42500;
        const poly = basePoly + Math.floor(Math.random() * 1200);
        const verts = Math.floor(poly * 0.52);
        elPoly.innerText = `POLY: ${poly.toLocaleString()} | VERTS: ${verts.toLocaleString()}`;

        // Randomize FPS slightly (like real software flicker)
        const fpsBase = Math.random() > 0.9 ? 58 : 60; // Occasionally drop a bit
        const fps = (fpsBase + Math.random() * 2.5).toFixed(1);
        elFps.innerText = `FPS: ${fps} | RENDER: Scanline`;

        // Occasionally fluctuate angle or snap settings for realism
        if (Math.random() > 0.98) {
            const angle = (Math.random() * 90).toFixed(1);
            elSnap.innerText = `SNAP: ON | ANGLE: ${angle}°`;
        }
    }, 150); 
})();

// =============================================
// CHARACTER DESIGN — Blueprint Rig Canvas
// =============================================
(function initCharBgCanvas() {
    const canvas = document.getElementById('charBgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const section = canvas.closest('.characters-section');

    // Palette
    const VIOLET  = 'rgba(139, 92, 246,';
    const CYAN    = 'rgba(34, 211, 238,';
    const INDIGO  = 'rgba(99, 102, 241,';
    const ROSE    = 'rgba(244, 114, 182,';

    let W, H, nodes, particles, raf;
    const NODE_COUNT   = 38;
    const PARTICLE_COUNT = 55;
    const LINK_DIST    = 180;

    function resize() {
        W = canvas.width  = section.offsetWidth;
        H = canvas.height = section.offsetHeight;
        buildNodes();
        buildParticles();
    }

    // ── Nodes (construction circles + pivots) ──
    function buildNodes() {
        nodes = Array.from({ length: NODE_COUNT }, () => ({
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            r:  Math.random() > 0.75 ? Math.random() * 55 + 25 : Math.random() * 12 + 4, // big or small
            big: Math.random() > 0.75,
            color: [VIOLET, CYAN, INDIGO, ROSE][Math.floor(Math.random() * 4)],
            pulse: Math.random() * Math.PI * 2,
            pulseSpeed: 0.015 + Math.random() * 0.02,
        }));
    }

    // ── Particles (small drifting dots) ──
    function buildParticles() {
        particles = Array.from({ length: PARTICLE_COUNT }, () => ({
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.6,
            vy: (Math.random() - 0.5) * 0.6,
            size: Math.random() * 2.5 + 0.5,
            alpha: Math.random() * 0.5 + 0.2,
            color: [VIOLET, CYAN, INDIGO][Math.floor(Math.random() * 3)],
        }));
    }

    function tick() {
        ctx.clearRect(0, 0, W, H);

        // ── Update + draw nodes ──
        for (const n of nodes) {
            n.x += n.vx; n.y += n.vy; n.pulse += n.pulseSpeed;
            if (n.x < -n.r * 2) n.x = W + n.r;
            if (n.x > W + n.r * 2) n.x = -n.r;
            if (n.y < -n.r * 2) n.y = H + n.r;
            if (n.y > H + n.r * 2) n.y = -n.r;

            const pulsedR = n.r + Math.sin(n.pulse) * (n.big ? 6 : 2);
            const alpha   = n.big ? 0.1 + Math.sin(n.pulse) * 0.06 : 0.25 + Math.sin(n.pulse) * 0.12;

            ctx.beginPath();
            ctx.arc(n.x, n.y, pulsedR, 0, Math.PI * 2);
            ctx.strokeStyle = `${n.color} ${alpha})`;
            ctx.lineWidth   = n.big ? 1 : 1.5;
            ctx.stroke();

            // Draw crosshair for big circles
            if (n.big) {
                const ch = pulsedR * 0.4;
                ctx.beginPath();
                ctx.moveTo(n.x - ch, n.y); ctx.lineTo(n.x + ch, n.y);
                ctx.moveTo(n.x, n.y - ch); ctx.lineTo(n.x, n.y + ch);
                ctx.strokeStyle = `${n.color} ${alpha * 0.8})`;
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }

            // Glowing pivot dot on small nodes
            if (!n.big) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = `${n.color} ${alpha * 1.5 > 1 ? 1 : alpha * 1.5})`;
                ctx.fill();
            }
        }

        // ── Draw rig connection lines ──
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const d  = Math.sqrt(dx * dx + dy * dy);
                if (d < LINK_DIST) {
                    const t = 1 - d / LINK_DIST;
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.strokeStyle = `${VIOLET} ${t * 0.15})`;
                    ctx.lineWidth   = 0.7;
                    ctx.stroke();
                }
            }
        }

        // ── Update + draw particles ──
        for (const p of particles) {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `${p.color} ${p.alpha})`;
            ctx.fill();
        }

        raf = requestAnimationFrame(tick);
    }

    // Start / stop with IntersectionObserver (performance)
    const io = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) { if (!raf) tick(); }
        else { cancelAnimationFrame(raf); raf = null; }
    }, { threshold: 0.05 });
    io.observe(section);

    window.addEventListener('resize', resize);
    resize();
})();
