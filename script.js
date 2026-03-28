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
            about_title: "Hello! I'm the author",
            about_text_1: "Passionate about storytelling through character design and 3D worlds. I merge tradition and technology to give life to unique visions.",
            animations_title: "Animations", characters_title: "Character Design", models_3d_title: "3D Models", illustrations_title: "Illustrations"
        },
        es: {
            nav_feed: "Feed", nav_gallery: "Galería", nav_portfolio: "Portafolio", nav_about: "Acerca de mí", nav_contact: "Contacto",
            nav_illustrations: "Ilustraciones", nav_animations: "Animaciones", nav_characters: "Diseño de Personajes", nav_3d: "Modelos 3D", nav_multimedia: "Multimedia",
            hero_title: "Lucia Montaña <span class='highlight'>| Portafolio</span>",
            hero_sub: "Licenciada en Animación y Videojuegos.<br>Ilustradora, diseñadora de personajes/entornos y generalista 3D",
            hero_btn: "Explorar galería",
            about_title: "¡Hola! Soy la autora",
            about_text_1: "Apasionada por contar historias a través del diseño de personajes y mundos 3D. Fusiono tradición y tecnología para dar vida a visiones únicas.",
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
