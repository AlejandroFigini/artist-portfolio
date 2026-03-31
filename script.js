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
            animations_title: "Animations", characters_title: "Design de Personnages", models_3d_title: "Modèles 3D", illustrations_title: "Ilustrations"
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
        let lastWasBig = false;
        illustrationFiles.forEach((file, index) => {
            const item = document.createElement('div');
            
            // Dynamic Artistic Rhythm — Weighted Probability Distribution
            const rand = Math.random();
            let bentoClass = '';
            if (rand < 0.12 && !lastWasBig) {
                bentoClass = 'big';
                lastWasBig = true;
            } else if (rand < 0.30) {
                bentoClass = 'wide';
                lastWasBig = false;
            } else if (rand < 0.48) {
                bentoClass = 'tall';
                lastWasBig = false;
            } else {
                lastWasBig = false;
            }
            
            item.className = `gallery-item fade-in ${bentoClass}`;
            const imgPath = 'assets/images/feed/ilustrations/' + file;
            
            // Clean Title for meta
            const cleanTitle = file.split('.')[0].replace(/_/g, ' ').replace(/-/g, ' ');
            const capitalizedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
            
            // Randomized organic cosmic drift timing for the WHOLE CONTAINER
            const driftDuration = (Math.random() * 16 + 12).toFixed(2) + 's';
            const driftDelay = (Math.random() * -20).toFixed(2) + 's';
            
            item.innerHTML = `
                <div class="drift-wrapper" style="width: 100%; height: 100%; animation: cosmic-drift ${driftDuration} ${driftDelay} infinite ease-in-out;">
                    <img src="${imgPath}" alt="${file}" loading="lazy" decoding="async">
                    <div class="gallery-overlay">
                        <button class="expand-btn">
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                            </svg>
                        </button>
                    </div>
                </div>`;

            item.addEventListener('click', () => openLightbox(imgPath, capitalizedTitle, "A unique illustrative exploration by Lucia Montaña."));
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

    // Updated Animation Click Listeners for Info
    document.querySelectorAll('.animation-item.video-container').forEach(container => {
        container.addEventListener('click', (e) => {
            if (e.target.closest('.play-pause-btn')) return;
            const source = container.querySelector('source');
            const title = container.dataset.title;
            const desc = container.dataset.desc;
            if (source) openVideoLightbox(source.src, title, desc);
        });
    });
});

// Lightbox functions (Global scope)
function openLightbox(src, title, desc) {
    const lb = document.getElementById('image-lightbox');
    const img = document.getElementById('lightbox-img');
    const titleEl = lb.querySelector('.info-title');
    const descEl = lb.querySelector('.info-desc');
    const panel = lb.querySelector('.lightbox-info-panel');
    
    if (lb && img) { 
        img.src = src; 
        if (titleEl) titleEl.innerText = title || "Illustration";
        if (descEl) descEl.innerText = desc || "A piece from my collection.";
        if (panel) panel.classList.add('hidden'); // Reset to hidden
        
        lb.style.display = 'flex'; 
        setTimeout(() => lb.style.opacity = '1', 10); 
    }
}

function closeLightbox() {
    const lb = document.getElementById('image-lightbox');
    if (lb) { 
        lb.style.opacity = '0'; 
        setTimeout(() => lb.style.display = 'none', 300); 
    }
}

function openVideoLightbox(src, title, desc) {
    const lb = document.getElementById('video-lightbox');
    const vid = document.getElementById('lightbox-video');
    const titleEl = lb.querySelector('.info-title');
    const descEl = lb.querySelector('.info-desc');
    const panel = lb.querySelector('.lightbox-info-panel');
    
    if (lb && vid) { 
        vid.src = src; 
        if (titleEl) titleEl.innerText = title || "Animation";
        if (descEl) descEl.innerText = desc || "Action sequence study.";
        if (panel) panel.classList.add('hidden'); // Reset to hidden
        
        lb.style.display = 'flex'; 
        setTimeout(() => { 
            lb.style.opacity = '1'; 
            vid.play(); 
        }, 10); 
    }
}

function closeVideoLightbox() {
    const lb = document.getElementById('video-lightbox');
    if (lb) { 
        lb.style.opacity = '0'; 
        setTimeout(() => { 
            lb.style.display = 'none'; 
            const vid = document.getElementById('lightbox-video'); 
            if (vid) { vid.pause(); vid.src = ''; } 
        }, 300); 
    }
}

function toggleLightboxInfo(event) {
    event.stopPropagation();
    const btn = event.currentTarget;
    const panel = btn.parentElement.querySelector('.lightbox-info-panel');
    if (panel) {
        panel.classList.toggle('hidden');
    }
}

function handleLightboxClick(event, type) {
    // If click is on the background (the lightbox itself), close it
    if (event.target.classList.contains('lightbox')) {
        if (type === 'video') closeVideoLightbox();
        else closeLightbox();
    }
}

function createBubbles() {
    const container = document.getElementById('bubbles-container');
    if (!container) return;
    const bubbleCount = 10; // Optimized for performance (Reduced from 20)
    for (let i = 0; i < bubbleCount; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        const size = Math.random() * 50 + 15 + 'px'; // Slightly smaller bubbles
        const left = Math.random() * 100 + '%';
        const delay = Math.random() * 8 + 's';
        const duration = Math.random() * 5 + 12 + 's'; // Slower for less CPU stress
        bubble.style.width = size;
        bubble.style.height = size;
        bubble.style.left = left;
        bubble.style.animationDelay = delay;
        bubble.style.animationDuration = duration;
        container.appendChild(bubble);
    }

    // --- VIGNETTE TELEPORTATION ENGINE ---
    function initVignetteTeleportation() {
        const vignettes = document.querySelectorAll('.decor-motion');
        if (!vignettes.length) return;

        // 6 Safe spots (avoiding the central 3x2 grid)
        const SPOTS = [
            { top: '8%', left: '3%', right: 'auto', bottom: 'auto' },
            { top: '10%', right: '4%', left: 'auto', bottom: 'auto' },
            { top: '42%', left: '2%', right: 'auto', bottom: 'auto' },
            { top: '48%', right: '2%', left: 'auto', bottom: 'auto' },
            { bottom: '15%', left: '4%', right: 'auto', top: 'auto' },
            { bottom: '12%', right: '3%', left: 'auto', top: 'auto' }
        ];

        let currentSpots = [0, 5]; // Initial Top-Left / Bottom-Right

        function applySpot(el, spotIdx) {
            const s = SPOTS[spotIdx];
            el.style.top = s.top;
            el.style.left = s.left;
            el.style.right = s.right;
            el.style.bottom = s.bottom;
        }

        // Initial setup
        applySpot(vignettes[0], currentSpots[0]);
        applySpot(vignettes[1], currentSpots[1]);
        vignettes.forEach(v => v.style.opacity = 0.85); // Fully visible-ish but integrated

        setInterval(() => {
            // Fade out
            vignettes.forEach(v => v.style.opacity = 0);

            setTimeout(() => {
                // Shuffle used spots
                let available = [0, 1, 2, 3, 4, 5];
                let next1 = available.splice(Math.floor(Math.random() * available.length), 1)[0];
                let next2 = available.splice(Math.floor(Math.random() * available.length), 1)[0];

                applySpot(vignettes[0], next1);
                applySpot(vignettes[1], next2);

                // Fade back in
                vignettes.forEach(v => v.style.opacity = 0.85);
            }, 1600); // Wait for CSS transition fade-out (1.5s)
        }, 15000); // Teleport every 15s
    }

    initVignetteTeleportation();
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
            () => `BITMAP: ${[512, 1024, 2048, 4096][Math.floor(Math.random() * 4)]}x${[512, 1024, 2048, 4096][Math.floor(Math.random() * 4)]}`,
            () => `SUBDIVISION: level ${Math.floor(Math.random() * 5)}`,
            () => `CAM_FOV: ${Math.floor(Math.random() * (90 - 18) + 18)}mm`,
            () => `RENDER_TIME: 00:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
            () => `RETOPOLOGY: ${(Math.floor(Math.random() * 20000) + 2000).toLocaleString()} tris`,
            () => `SPLINE: ${Math.floor(Math.random() * 64)} knots`,
            () => `KEYFRAME: f.${Math.floor(Math.random() * 600)}`,
            () => `CHAMFER: ${(Math.random() * 2.5).toFixed(1)} segs:${Math.floor(Math.random() * 5)}`,
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
        span.style.animationDuration = (Math.random() * 6 + 6) + 's';
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
        }, 13000);
    }

    // Initial batch (20 elements for density, staggered)
    for (let i = 0; i < 20; i++) {
        setTimeout(() => spawnText(), i * 350);
    }

    // Keep spawning frequently (every 800ms)
    setInterval(spawnText, 800);
})();

// =============================================
// HUD LIVE STATS UPDATER (Poly, FPS, Angle)
// =============================================
(function initHUDUpdater() {
    const elPoly = document.getElementById('hud-poly');
    const elFps = document.getElementById('hud-fps');
    const elSnap = document.getElementById('hud-snap');
    if (!elPoly) return;

    setInterval(() => {
        const basePoly = 42500;
        const poly = basePoly + Math.floor(Math.random() * 1200);
        const verts = Math.floor(poly * 0.52);
        if (elPoly) elPoly.innerText = `POLY: ${poly.toLocaleString()} | VERTS: ${verts.toLocaleString()}`;

        const fpsBase = Math.random() > 0.9 ? 58 : 60;
        const fps = (fpsBase + Math.random() * 2.5).toFixed(1);
        if (elFps) elFps.innerText = `FPS: ${fps} | RENDER: Scanline`;

        if (Math.random() > 0.98) {
            const angle = (Math.random() * 90).toFixed(1);
            if (elSnap) elSnap.innerText = `SNAP: ON | ANGLE: ${angle}°`;
        }
    }, 250);
})();

// ── Characters Background sanitized for Deep Minimalism ──

// =============================================
// ANIMATIONS SECTION — Morphing Stretchy Blobs (Canvas)
// =============================================
function initAnimationsBackground() {
    const canvas = document.getElementById('animBlobCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = canvas.closest('.animations-section');

    let W, H, paths = [], raf;
    const PATH_COUNT = 3; 
    const COLORS = ['#8b5cf6', '#7c3aed', '#a78bfa', '#4c1d95', '#6d28d9'];

    class MotionPath {
        constructor() { this.init(); }
        init() {
            this.points = []; this.numPoints = 8;
            this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
            this.offset = Math.random() * 2000; this.baseY = Math.random() * H;
            this.particles = Array.from({ length: 4 }, () => ({
                pos: Math.random(), speed: 0.00008 + Math.random() * 0.0002, 
                size: 1.5 + Math.random() * 2.5, twinkle: Math.random() * Math.PI * 2
            }));
            for (let i = 0; i <= this.numPoints; i++) {
                this.points.push({
                    x: -200 + (i / this.numPoints) * (W + 400), y: 0,
                    phase: (i / this.numPoints) * Math.PI * 3 + Math.random(),
                    amp: Math.random() * 80 + 40
                });
            }
        }
        update() {
            this.offset += 0.1;
            this.points.forEach(p => p.y = this.baseY + Math.sin(this.offset * 0.02 + p.phase) * p.amp);
            this.particles.forEach(p => { p.pos += p.speed; if (p.pos > 1) p.pos = 0; p.twinkle += 0.04; });
        }
        draw() {
            ctx.shadowBlur = 12; ctx.shadowColor = this.color;
            ctx.beginPath(); ctx.lineWidth = 1.8; ctx.strokeStyle = this.color; ctx.globalAlpha = 0.25;
            ctx.moveTo(this.points[0].x, this.points[0].y);
            for (let i = 0; i < this.points.length - 1; i++) {
                const xc = (this.points[i].x + this.points[i + 1].x) / 2;
                const yc = (this.points[i].y + this.points[i + 1].y) / 2;
                ctx.quadraticCurveTo(this.points[i].x, this.points[i].y, xc, yc);
            }
            ctx.stroke();
            this.particles.forEach(part => {
                const index = Math.floor(part.pos * this.numPoints);
                const p1 = this.points[index]; const p2 = this.points[Math.min(index + 1, this.numPoints)];
                if (!p1 || !p2) return;
                const t = (part.pos * this.numPoints) % 1;
                const x = p1.x + (p2.x - p1.x) * t; const y = p1.y + (p2.y - p1.y) * t;
                const pulse = (Math.sin(part.twinkle) + 1.2) / 2;
                ctx.save(); ctx.translate(x, y); ctx.globalAlpha = 0.4 + pulse * 0.5;
                ctx.fillStyle = ctx.strokeStyle = this.color; ctx.shadowBlur = 15;
                ctx.beginPath(); ctx.arc(0, 0, part.size * 0.4 * pulse, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.lineWidth = 0.8; const s1 = part.size * 2.5 * pulse;
                ctx.moveTo(-s1, 0); ctx.lineTo(s1, 0); ctx.moveTo(0, -s1); ctx.lineTo(0, s1);
                ctx.rotate(Math.PI / 4); const s2 = s1 * 0.5;
                ctx.moveTo(-s2, 0); ctx.lineTo(s2, 0); ctx.moveTo(0, -s2); ctx.lineTo(0, s2); ctx.stroke();
                ctx.restore();
            });
        }
    }

    function resize() {
        W = canvas.width = container.offsetWidth; H = canvas.height = container.offsetHeight;
        if (paths.length === 0) paths = Array.from({ length: PATH_COUNT }, () => new MotionPath());
    }
    function loop() {
        ctx.clearRect(0, 0, W, H); paths.forEach(p => { p.update(); p.draw(); });
        raf = requestAnimationFrame(loop);
    }

    const io = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) { if (!raf) loop(); }
        else { cancelAnimationFrame(raf); raf = null; }
    }, { threshold: 0.1 });
    io.observe(container);
    window.addEventListener('resize', resize); resize();
}

// ── SMART VIDEO STACK (Auto-play when visible, No-load when hidden) ──
function initVideoAutoplayEngine() {
    const vObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const vid = entry.target;
            if (entry.isIntersecting) {
                // Prime the video (start fetching since preload=none)
                if (vid.paused) vid.play().catch(() => {});
            } else {
                if (!vid.paused) vid.pause();
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.obs-video, .decor-video').forEach(v => vObserver.observe(v));
}

// --- STAGGERED INITIALIZATION (Main Thread Optimization) ---
setTimeout(() => { if (typeof createBubbles === 'function') createBubbles(); }, 1500);
setTimeout(() => { initAnimationsBackground(); }, 2500);
setTimeout(() => { initVideoAutoplayEngine(); }, 3500);


// --- VIGNETTE TELEPORTATION ENGINE ---
(function initVignetteTeleportation() {
    const vignettes = document.querySelectorAll('.decor-motion');
    if (!vignettes.length) return;

    // 6 Safe spots (avoiding the central 3x2 grid)
    const SPOTS = [
        { top: '8%', left: '3%', right: 'auto', bottom: 'auto' },
        { top: '10%', right: '4%', left: 'auto', bottom: 'auto' },
        { top: '42%', left: '2%', right: 'auto', bottom: 'auto' },
        { top: '48%', right: '2%', left: 'auto', bottom: 'auto' },
        { bottom: '15%', left: '4%', right: 'auto', top: 'auto' },
        { bottom: '12%', right: '3%', left: 'auto', top: 'auto' }
    ];

    function applySpot(el, spotIdx) {
        const s = SPOTS[spotIdx];
        if (!s) return;
        el.style.top = s.top;
        el.style.left = s.left;
        el.style.right = s.right;
        el.style.bottom = s.bottom;
        el.style.opacity = '1';
    }

    // Initial setup
    if (vignettes.length >= 2) {
        applySpot(vignettes[0], 0);
        applySpot(vignettes[1], 5);
    }

    setInterval(() => {
        // Fade out
        vignettes.forEach(v => v.style.opacity = '0');

        setTimeout(() => {
            // Pools to ensure NO overlap and balanced layout
            let leftPool = [0, 2, 4]; // Spots 0, 2, 4 are LEFT
            let rightPool = [1, 3, 5]; // Spots 1, 3, 5 are RIGHT

            let nextLeft = leftPool[Math.floor(Math.random() * leftPool.length)];
            let nextRight = rightPool[Math.floor(Math.random() * rightPool.length)];

            // Assign one to each vignette (always one per side)
            if (vignettes[0]) applySpot(vignettes[0], nextLeft);
            if (vignettes[1]) applySpot(vignettes[1], nextRight);

            // Fade back in
            vignettes.forEach(v => v.style.opacity = '0.95');
        }, 900); // Wait for fade-out
    }, 12000); // Teleport every 12s (Slower)
})();



// =============================================
// ILLUSTRATIONS SECTION — High-Performance Canvas Engine
// =============================================
(function initNebulaEngine() {
    const canvas = document.getElementById('nebula-canvas');
    const section = document.querySelector('.gallery-section');
    if (!canvas || !section) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    let stars = [];
    let meteors = [];
    let gasClouds = [];
    const cloudColors = ['rgba(124, 58, 237, 0.3)', 'rgba(157, 80, 187, 0.25)', 'rgba(34, 211, 238, 0.2)'];

    function resize() {
        const dpr = window.devicePixelRatio || 1;
        width = section.offsetWidth;
        height = section.offsetHeight;
        if (width === 0 || height === 0) return;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        initElements();
    }

    class Star {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            // Optimización de tamaño para visibilidad: 0.5 a 2.5px
            this.size = Math.random() * 1.8 + 0.5;
            this.baseOpacity = Math.random() * 0.4 + 0.1;
            this.opacity = this.baseOpacity;
            this.twinkleSpeed = Math.random() * 0.008 + 0.003; 
            this.twinkleDir = 1;
            this.color = Math.random() > 0.8 ? (Math.random() > 0.5 ? '#a78bfa' : '#bae6fd') : '#ffffff';
            this.halo = Math.random() > 0.92; // 8% son estrellas protagonistas (Menos coste CPU)
        }
        update() {
            this.opacity += this.twinkleSpeed * this.twinkleDir;
            if (this.opacity > 1) {
                this.opacity = 1;
                this.twinkleDir = -1;
            } else if (this.opacity < 0.05) { 
                this.opacity = 0.05;
                this.twinkleDir = 1;
                
                // Quantum Rebirth: Al llegar al punto más oscuro, nace en otro lugar
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.size = Math.random() * 1.8 + 0.5;
                this.halo = Math.random() > 0.92;
            }
        }
        draw() {
            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.fillStyle = this.color;
            if (this.halo) {
                ctx.shadowBlur = 15; // Sombreado ligero para rendimiento
                ctx.shadowColor = this.color;
            }
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();

            // Efecto Glint (+) — Solo cuando brilla con fuerza para ahorrar recursos
            if (this.halo && this.opacity > 0.6) {
                ctx.strokeStyle = this.color;
                ctx.globalAlpha = this.opacity * 0.4;
                ctx.lineWidth = 0.5;
                const flareSize = this.size * 4;
                ctx.beginPath();
                ctx.moveTo(this.x - flareSize, this.y);
                ctx.lineTo(this.x + flareSize, this.y);
                ctx.moveTo(this.x, this.y - flareSize);
                ctx.lineTo(this.x, this.y + flareSize);
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    class NebulaCore {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            // Núcleos masivos para lavar el fondo de color: 600 a 1400px
            this.size = Math.random() * 800 + 600;
            this.hue = Math.random() * 360;
            this.vx = (Math.random() - 0.5) * 0.15;
            this.vy = (Math.random() - 0.5) * 0.15;
        }
        update() {
            this.hue = (this.hue + 0.05) % 360; // Cambio de color lento y suave
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < -this.size || this.x > width + this.size) this.vx *= -1;
            if (this.y < -this.size || this.y > height + this.size) this.vy *= -1;
        }
        draw() {
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            grad.addColorStop(0, `hsla(${this.hue}, 80%, 50%, 0.1)`);
            grad.addColorStop(1, 'transparent');
            ctx.save();
            ctx.globalAlpha = 0.05; // Muy sutil para no saturar
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    class GasCloud {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 350 + 250;
            // Paleta expandida: Violeta, Cian, Oro, Magenta, Azul Eléctrico
            const colors = [
                'rgba(124, 58, 237, 0.2)',  // Violeta
                'rgba(34, 211, 238, 0.25)', // Cian
                'rgba(212, 175, 55, 0.15)', // Oro
                'rgba(244, 114, 182, 0.2)', // Magenta
                'rgba(59, 130, 246, 0.15)'  // Azul
            ];
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.opacity = Math.random() * 0.08 + 0.04;
            this.pulse = Math.random() * 0.005;
            this.pulseDir = 1;
            this.vx = (Math.random() - 0.5) * 0.18;
            this.vy = (Math.random() - 0.5) * 0.18;
        }
        update() {
            // Oscilación de opacidad para que el cielo "respire"
            this.opacity += this.pulse * this.pulseDir;
            if (this.opacity > 0.15 || this.opacity < 0.04) this.pulseDir *= -1;

            this.x += this.vx;
            this.y += this.vy;
            if (this.x < -this.size || this.x > width + this.size) this.vx *= -1;
            if (this.y < -this.size || this.y > height + this.size) this.vy *= -1;
        }
        draw() {
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            grad.addColorStop(0, this.color);
            grad.addColorStop(1, 'transparent');
            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    class Meteor {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * (height * 0.85);
            this.len = Math.random() * 350 + 200;
            this.speed = Math.random() * 5 + 3;
            this.opacity = 0;
            this.active = false;
            this.wait = Math.random() * 900;
        }
        update() {
            if (!this.active) {
                this.wait--;
                if (this.wait <= 0) this.active = true;
                return;
            }
            this.x += this.speed;
            this.y += this.speed * 0.48;
            if (this.x > width + 400 || this.y > height + 400) this.reset();
        }
        draw() {
            if (!this.active) return;
            ctx.save();
            const grad = ctx.createLinearGradient(this.x, this.y, this.x - this.len, this.y - this.len * 0.48);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - this.len, this.y - this.len * 0.48);
            ctx.stroke();
            ctx.restore();
        }
    }

    let nebulaCores = [];
    function initElements() {
        // Rediseño de Economía: 1 estrella por cada 6500px²
        const starCount = Math.max(300, Math.floor((width * height) / 6500));
        stars = Array.from({ length: starCount }, () => new Star());
        
        // Lavado de color dinámico: 4 núcleos masivos que desplazan el tono
        nebulaCores = Array.from({ length: 4 }, () => new NebulaCore());
        
        // 8 capas de nebulosa multicolor para mayor profundidad
        gasClouds = Array.from({ length: 8 }, () => new GasCloud());

        // 5 meteoros discretos
        meteors = Array.from({ length: 5 }, () => new Meteor());
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        nebulaCores.forEach(c => { c.update(); c.draw(); });
        gasClouds.forEach(g => { g.update(); g.draw(); });
        stars.forEach(s => { s.update(); s.draw(); });
        meteors.forEach(m => { m.update(); m.draw(); });
        requestAnimationFrame(animate);
    }

    // Ultra-Responsive Tracking
    const observer = new ResizeObserver(() => {
        requestAnimationFrame(() => {
            const currentW = section.offsetWidth;
            const currentH = section.offsetHeight;
            if (currentW !== width || currentH !== height) resize();
        });
    });
    observer.observe(section);

    resize();
    animate();
})();
