document.addEventListener('DOMContentLoaded', () => {

    // 1. Establecer el Año Actual en el Footer
    document.getElementById('year').textContent = new Date().getFullYear();

    // 2. Slideshow del Hero (ajuste de tiempos para más naturalidad y Paneo Aleatorio)
    const slides = document.querySelectorAll('.slide');
    const panClasses = ['pan-tl', 'pan-tr', 'pan-bl', 'pan-br', 'pan-c', 'pan-tl', 'pan-tr']; // Mas peso a diagonales
    let currentSlide = 0;

    if (slides.length > 0) {
        // Asignar dirección de paneo inicial
        slides[0].classList.add(panClasses[Math.floor(Math.random() * panClasses.length)]);

        setInterval(() => {
            // Limpiar clases
            slides[currentSlide].classList.remove('slide-active', ...panClasses);
            currentSlide = (currentSlide + 1) % slides.length;

            // Asignar nueva dirección aleatoria y activarla
            const randomPan = panClasses[Math.floor(Math.random() * panClasses.length)];
            slides[currentSlide].classList.add('slide-active', randomPan);
        }, 7000); // Cambia cada 7 segundos para poder apreciar mejor el arte
    }

    // 3b. Animación letra a letra (Efecto de máquina de escribir moderna)
    const overlayElements = document.querySelectorAll('.hero-overlay h1, .hero-overlay p');
    let delayCounter = 0;

    const wrapLetters = (element) => {
        const nodes = Array.from(element.childNodes);
        element.innerHTML = '';

        nodes.forEach(node => {
            if (node.nodeType === 3) { // Si es texto puro
                const text = node.textContent;
                for (let char of text) {
                    const span = document.createElement('span');
                    span.className = 'letter';
                    span.innerHTML = char === ' ' ? '&nbsp;' : char;
                    element.appendChild(span);
                }
            } else if (node.nodeType === 1) { // Si es un elemento HTML como <span class="highlight">
                const wrapper = document.createElement(node.tagName);
                wrapper.className = node.className;
                const text = node.textContent;
                for (let char of text) {
                    const span = document.createElement('span');
                    span.className = 'letter';
                    span.innerHTML = char === ' ' ? '&nbsp;' : char;
                    wrapper.appendChild(span);
                }
                element.appendChild(wrapper);
            }
        });
    };

    overlayElements.forEach(el => {
        wrapLetters(el);
    });

    const runTextAnimation = () => {
        let delayCounter = 0;
        overlayElements.forEach(el => {
            el.querySelectorAll('.letter').forEach(letter => {
                letter.style.animation = 'none';
                void letter.offsetWidth; // Trigger reflow to restart animation
                letter.style.animation = `fadeLetter 0.6s forwards cubic-bezier(0.2, 0.8, 0.2, 1) ${delayCounter * 0.03}s`;
                delayCounter++;
            });
            delayCounter += 10; // Pequeña pausa adicional antes de cargar el siguiente renglón (p)
        });
    };

    // Ejecutar inicialmente y luego repetir cada 10 segundos
    runTextAnimation();
    setInterval(runTextAnimation, 10000);

    // Modal logic (removed to use native video fullscreen instead)

    // 5. Lógica del Carrusel (Acordeón Flex)
    const charCards = document.querySelectorAll('.char-card');
    // Simple typewriter for character cards (no looping)
    const typeWriterSimple = (el, speed = 100) => {
        const fullText = el.textContent.trim();
        el.textContent = '';
        let i = 0;
        const interval = setInterval(() => {
            if (i < fullText.length) {
                el.textContent += fullText.charAt(i);
                i++;
            } else {
                clearInterval(interval);
            }
        }, speed);
    };

    const startTypewriter = (el, speed = 100, delay = 150, loop = true) => {
        clearInterval(el.typingTimer);
        clearTimeout(el.loopTimer);

        // Capturar texto original de forma segura
        let text = el.getAttribute('data-original-text');
        if (!text) {
            text = el.innerText.trim();
            el.setAttribute('data-original-text', text);
        }

        const typeLoop = () => {
            el.innerText = '\u200B';
            let i = 0;

            setTimeout(() => {
                el.typingTimer = setInterval(() => {
                    if (i === 0) el.innerText = '';

                    if (i < text.length) {
                        el.innerText += text.charAt(i);
                        i++;
                    } else {
                        clearInterval(el.typingTimer);
                        if (loop) {
                            el.loopTimer = setTimeout(typeLoop, 5000);
                        }
                    }
                }, speed);
            }, delay);
        };

        typeLoop();
    };

    // Updated helper to use simple typewriter for character cards
    const activateCardsTypewriter = (card) => {
        const nameEl = card.querySelector('.char-name');
        const roleEl = card.querySelector('.char-role');
        if (nameEl) typeWriterSimple(nameEl, 100);
        if (roleEl) typeWriterSimple(roleEl, 50);
    };

    // Click handler for each character card
    charCards.forEach(card => {
        card.addEventListener('click', () => {
            if (card.classList.contains('active')) return;

            // Reset all cards and stop any running typewriters
            charCards.forEach(c => {
                c.classList.remove('active');
                // No need to clear intervals for typeWriterSimple, it stops itself.
                // If startTypewriter was used elsewhere and needed stopping, it would be handled here.
            });

            // Activate clicked card and start its typewriter
            card.classList.add('active');
            activateCardsTypewriter(card);
        });
    });

    // Activate first card on page load
    const initialActiveCard = document.querySelector('.char-card.active');
    if (initialActiveCard) {
        activateCardsTypewriter(initialActiveCard);
    }

    // Parallax Scroll Effect on Accordion Backgrounds
    const charAccordion = document.querySelector('.char-accordion');
    window.addEventListener('scroll', () => {
        if (!charAccordion) return;
        const rect = charAccordion.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        // Si el carrusel está visible en la pantalla
        if (rect.top < viewportHeight && rect.bottom > 0) {
            // Porcentaje de scroll relativo al contenedor
            let scrollPercent = (viewportHeight - rect.top) / (viewportHeight + rect.height);
            let offset = (scrollPercent - 0.5) * 2; // -1 to 1

            // Aplicar leve parallax solo al background del acordeón activo o de todos
            const charBgs = document.querySelectorAll('.char-card-bg');
            charBgs.forEach(bg => {
                // translate en Y para efecto sutil
                bg.style.backgroundPositionY = `${50 + (offset * 15)}%`;
            });
        }
    });

    // 6. Animaciones de scroll (Reveal effect)
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const sectionsToAnimate = document.querySelectorAll('.presentation-container, .section-title, .gallery-item, .animation-item, .char-accordion');

    sectionsToAnimate.forEach(section => {
        section.classList.add('fade-in');
        observer.observe(section);
    });

    // 7. Dynamic Illustration Gallery
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
        illustrationFiles.forEach(file => {
            const item = document.createElement('div');
            item.className = 'gallery-item fade-in';

            item.style.animationDelay = `${Math.random() * -5}s`; // Balanced random start
            item.style.animationDuration = `${2 + Math.random() * 1.5}s`; // Balanced speeds

            item.innerHTML = `
                <img src="assets/images/feed/ilustrations/${file}" alt="${file}">
                <div class="gallery-overlay">
                    <button class="expand-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                        </svg>
                    </button>
                </div>
            `;

            // Expand button logic
            const expandBtn = item.querySelector('.expand-btn');
            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openLightbox(`assets/images/feed/ilustrations/${file}`);
            });

            // Click on item also expands
            item.addEventListener('click', () => {
                openLightbox(`assets/images/feed/ilustrations/${file}`);
            });

            illustrationsGrid.appendChild(item);
            observer.observe(item); // Observe for fade-in animation
        });
    }

    // 8. Video Animations Hover & Interactions Logic
    const videoContainers = document.querySelectorAll('.video-container');

    videoContainers.forEach(container => {
        const video = container.querySelector('.anim-video');
        const playPauseBtn = container.querySelector('.play-pause-btn');
        const fullscreenBtn = container.querySelector('.fullscreen-btn');
        const icon = playPauseBtn.querySelector('i');

        // Play on hover
        container.addEventListener('mouseenter', () => {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => console.log("Autoplay prevented:", e));
            }
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
        });

        // Pause on mouseleave
        container.addEventListener('mouseleave', () => {
            video.pause();
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
        });

        // Toggle play/pause click
        playPauseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (video.paused) {
                video.play();
                icon.classList.remove('fa-play');
                icon.classList.add('fa-pause');
            } else {
                video.pause();
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play');
            }
        });

        // Expanded View toggle click (Lightbox)
        fullscreenBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Pausar el video de fondo del grid
            video.pause();
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');

            const source = video.querySelector('source');
            if (source) {
                openVideoLightbox(source.src);
            }
        });
    });
});

// Lightbox para la imagen de info personajes
function openLightbox(imageSrc) {
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    if (lightbox && lightboxImg) {
        lightboxImg.src = imageSrc;
        lightbox.style.display = 'block';
        setTimeout(() => {
            lightbox.style.opacity = '1';
        }, 10);
    }
}

function closeLightbox() {
    const lightbox = document.getElementById('image-lightbox');
    if (lightbox) {
        lightbox.style.opacity = '0';
        setTimeout(() => {
            lightbox.style.display = 'none';
        }, 300);
    }
}

// Lightbox ampliado para animaciones (Videos)
function openVideoLightbox(videoSrc) {
    const lightbox = document.getElementById('video-lightbox');
    const lightboxVid = document.getElementById('lightbox-video');

    if (lightbox && lightboxVid) {
        lightboxVid.src = videoSrc;
        lightboxVid.load(); // Fuerza a recargar el src
        lightbox.style.display = 'block';
        setTimeout(() => {
            lightbox.style.opacity = '1';
            lightboxVid.play().catch(e => console.log('Autoplay modal prevented', e));
        }, 10);
    }
}

function closeVideoLightbox(event) {
    const lightbox = document.getElementById('video-lightbox');
    const lightboxVid = document.getElementById('lightbox-video');

    // Si el usuario hace click directamente sobre el video (ej. controles), no cerrar
    if (event && event.target === lightboxVid) {
        return;
    }

    if (lightbox) {
        lightbox.style.opacity = '0';
        setTimeout(() => {
            lightbox.style.display = 'none';
            if (lightboxVid) {
                lightboxVid.pause();
                lightboxVid.removeAttribute('src'); // Limpiar fuente
                lightboxVid.load();
            }
        }, 300);
    }
}

// Logic para Settings y Asistente Alessio
document.addEventListener('DOMContentLoaded', () => {
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    const darkModeSwitch = document.getElementById('dark-mode-switch');
    const languageSelect = document.getElementById('language-select');
    const alessioVideo = document.getElementById('alessio-video');
    const alessioBubble = document.getElementById('alessio-bubble');
    const alessioText = document.getElementById('alessio-text');

    if (alessioVideo) {
        alessioVideo.playbackRate = 0.7; // El video va un 30% más lento
    }

    // Traducciones
    const translations = {
        en: {
            nav_about: "About", nav_animations: "Animations", nav_characters: "Characters", nav_illustrations: "Illustrations",
            hero_title: "Illustrator & Animator",
            presentacion_title: "Hello! I'm the author",
            animaciones_title: "Animations",
            personajes_title: "Character Design",
            ilustraciones_title: "Illustrations",
            alessio_welcome: "Hi! I'm Alessio. I'll be your guide through this portfolio!",
            alessio_hero: "Welcome to my creative universe! I hope you enjoy the tour.",
            alessio_presentacion: "This is me! Here you can learn more about my background and passion.",
            alessio_animaciones: "Check out my motion work! These projects were a lot of fun to animate.",
            alessio_personajes: "Character design is one of my favorite parts of the process.",
            alessio_ilustraciones: "Here is my full illustration gallery. Every stroke tells a story!"
        },
        es: {
            nav_about: "Sobre Mí", nav_animations: "Animaciones", nav_characters: "Personajes", nav_illustrations: "Ilustraciones",
            hero_title: "Ilustradora & Animadora",
            presentacion_title: "¡Hola! Soy la autora",
            animaciones_title: "Animaciones",
            personajes_title: "Diseño de Personajes",
            ilustraciones_title: "Ilustraciones",
            alessio_welcome: "¡Hola! Soy Alessio. ¡Sere tu guía en este portfolio!",
            alessio_hero: "¡Bienvenido a mi universo creativo! Espero que disfrutes el recorrido.",
            alessio_presentacion: "¡Esta soy yo! Aquí puedes conocer más sobre mi trayectoria y pasión.",
            alessio_animaciones: "¡Mira mis trabajos de animación! Fue muy divertido darles vida.",
            alessio_personajes: "El diseño de personajes es una de mis partes favoritas del proceso.",
            alessio_ilustraciones: "Aquí está mi galería completa. ¡Cada trazo cuenta una historia!"
        },
        pt: {
            nav_about: "Sobre Mim", nav_animations: "Animações", nav_characters: "Personagens", nav_illustrations: "Ilustrações",
            hero_title: "Ilustradora & Animadora",
            presentacion_title: "Olá! Eu sou a autora",
            animaciones_title: "Animações",
            personajes_title: "Design de Personagens",
            ilustraciones_title: "Ilustrações",
            alessio_welcome: "Olá! Eu sou o Alessio. Seréi o seu guia neste portfólio!",
            alessio_hero: "Bem-vindo ao meu universo criativo! Espero que goste do passeio.",
            alessio_presentacion: "Esta sou eu! Aqui você pode aprender mais sobre minha história.",
            alessio_animaciones: "Veja minhas animações! Foi muito divertido animar esses projetos.",
            alessio_personajes: "O design de personagens é uma das minhas partes favoritas.",
            alessio_ilustraciones: "Aqui está minha galeria completa. Cada traço conta uma história!"
        },
        fr: {
            nav_about: "À propos", nav_animations: "Animations", nav_characters: "Personnages", nav_illustrations: "Illustrations",
            hero_title: "Illustratrice & Animatrice",
            presentacion_title: "Bonjour ! Je suis l'auteure",
            animaciones_title: "Animations",
            personajes_title: "Design de Personnages",
            ilustraciones_title: "Illustrations",
            alessio_welcome: "Salut ! Je suis Alessio. Je serai votre guide dans ce portfolio !",
            alessio_hero: "Bienvenue dans mon univers créatif ! J'espère que vous apprécierez la visite.",
            alessio_presentacion: "C'est moi ! Ici, vous pouvez en savoir plus sur mon parcours.",
            alessio_animaciones: "Regardez mes animations ! C'était très amusant de les animer.",
            alessio_personajes: "Le design de personnages est l'une de mes parties préférées.",
            alessio_ilustraciones: "Voici ma galerie d'illustrations. Chaque trait raconte une histoire !"
        }
    };

    let currentLang = localStorage.getItem('lang') || 'en';
    languageSelect.value = currentLang;

    function updateLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('lang', lang);

        // Update Nav
        document.querySelectorAll('.nav-links a')[0].innerText = translations[lang].nav_about;
        document.querySelectorAll('.nav-links a')[1].innerText = translations[lang].nav_animations;
        document.querySelectorAll('.nav-links .dropbtn')[0].childNodes[0].textContent = translations[lang].nav_characters + " ";
        document.querySelectorAll('.nav-links a')[2].innerText = translations[lang].nav_illustrations;

        // Update Titles
        document.querySelector('.hero-overlay h1').innerText = translations[lang].hero_title;
        document.querySelector('#presentacion .section-title h2').innerText = translations[lang].presentacion_title;
        document.querySelector('#animaciones .section-title h2').innerText = translations[lang].animaciones_title;
        document.querySelector('#personajes .section-title h2').innerText = translations[lang].personajes_title;
        document.querySelector('#ilustraciones .section-title h2').innerText = translations[lang].ilustraciones_title;
    }

    updateLanguage(currentLang);

    languageSelect.addEventListener('change', (e) => updateLanguage(e.target.value));

    // Toggle Settings Panel
    settingsToggle.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });

    // Dark Mode Switch
    darkModeSwitch.addEventListener('change', () => {
        if (darkModeSwitch.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        }
    });

    // Cargar Tema Guardado
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        darkModeSwitch.checked = true;
    }

    // Lógica del Asistente Alessio por Secciones (Permanente mientras estés allí)
    const getMessageKey = (id) => `alessio_${id}`;

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sectionId = entry.target.id;
                const messageKey = getMessageKey(sectionId);
                if (translations[currentLang][messageKey]) {
                    alessioText.innerText = translations[currentLang][messageKey];
                    alessioBubble.classList.add('show');
                }
            }
        });
    }, { threshold: 0.4 });

    document.querySelectorAll('section, header').forEach(section => {
        sectionObserver.observe(section);
    });

    // Typewriter effect for 3D section titles on scroll
    const headingObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('typed')) {
                const heading = entry.target;
                heading.classList.add('typed');
                startTypewriter(heading, 80, 200, false); // false = no loop
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.typewriter-3d').forEach(h => {
        headingObserver.observe(h);
    });

    // Saludo inicial
    setTimeout(() => {
        if (!alessioBubble.classList.contains('show')) {
            alessioText.innerText = translations[currentLang].alessio_welcome;
            alessioBubble.classList.add('show');
        }
    }, 2000);
});
