// =============================================
// 0. FPS AUTO-DEGRADE MONITOR
// Mide los FPS reales durante los primeros segundos. Si el equipo no
// sostiene un framerate fluido, baja a modo ligero (window.PERF.downgrade)
// para garantizar fluidez independientemente del dispositivo.
// =============================================
(function initPerfMonitor() {
    const PERF = window.PERF;
    if (!PERF || PERF.lite) return; // ya estamos en modo ligero
    let frames = 0, last = performance.now(), elapsed = 0, lowStreak = 0;
    function sample(now) {
        frames++;
        const dt = now - last;
        if (dt >= 1000) {
            const fps = (frames * 1000) / dt;
            elapsed += dt;
            frames = 0;
            last = now;
            // 2 segundos seguidos por debajo de 45 FPS → degradar
            if (fps < 45) lowStreak++; else lowStreak = 0;
            if (lowStreak >= 2) { PERF.downgrade(); return; }
            if (elapsed >= 8000) return; // suficiente muestreo, el equipo va bien
        }
        requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
})();

// =============================================
// 0b. PANTALLA DE CARGA
// Mantiene el splash visible hasta que la página terminó de cargar
// (evita mostrar elementos a medio renderizar). Con tope de seguridad
// para que nunca se quede colgado.
// =============================================
(function initPageLoader() {
    const loader = document.getElementById('page-loader');
    if (!loader) return;

    // Mostrar el loader SOLO la primera vez en la sesión: si venimos de la
    // página de gestión, o si ya se mostró antes (navegué a otra página y volví),
    // saltarlo. Se marca 'lm_seen_loader' tras la primera vez.
    let skip = false;
    try {
        skip = sessionStorage.getItem('cms_skip_loader') === '1' || sessionStorage.getItem('lm_seen_loader') === '1';
        sessionStorage.removeItem('cms_skip_loader');
        sessionStorage.setItem('lm_seen_loader', '1');
    } catch (e) {}
    if (skip) {
        document.body.classList.remove('loading-active');
        loader.remove();
        return;
    }

    let hidden = false;
    const MIN_DISPLAY_MS = 3000; // Duración mínima de 3 segundos
    const startTime = Date.now();

    function hide() {
        if (hidden) return;
        hidden = true;
        loader.classList.add('loader-hidden');
        document.body.classList.remove('loading-active');
        // Quitar del DOM tras la transición de opacidad (0.7s).
        // Liberar el buffer del video del loader para no mantenerlo en memoria.
        setTimeout(() => {
            if (loader.parentNode) {
                const loaderVid = loader.querySelector('video');
                if (loaderVid) { loaderVid.pause(); loaderVid.removeAttribute('src'); loaderVid.load(); }
                loader.remove();
            }
        }, 800);
    }

    function tryHide() {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
        setTimeout(hide, remaining);
    }

    if (document.readyState === 'complete') {
        tryHide();
    } else {
        // 'load' espera imágenes/videos/fuentes; respetar mínimo de 3s.
        window.addEventListener('load', tryHide);
    }

    // Failsafe: pase lo que pase, no bloquear más de 6 segundos.
    setTimeout(hide, 6000);
})();

document.addEventListener('DOMContentLoaded', () => {
    // =============================================
    // 1. HERO TYPEWRITER ANIMATION (SLOWER)
    // =============================================
    // Táctil: en móvil el primer tap sobre una tarjeta revela su overlay
    // (como el hover en PC) en vez de abrir el lightbox de una.
    const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    // "Vista móvil": táctil O viewport angosto. En ese caso el primer tap muestra
    // la info abreviada (overlay) y el segundo abre pantalla completa — así nunca
    // se entra a pantalla completa de una.
    const isMobileView = () => isTouch || window.innerWidth <= 768;
    const clearTouchActive = (except) => {
        document.querySelectorAll('.touch-active').forEach(x => { if (x !== except) x.classList.remove('touch-active'); });
    };
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.animation-item, .gallery-item')) clearTouchActive(null);
    });

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
    let heroVisible = false;
    function startHeroInterval() {
        runHeroAnimation();
        if (heroInterval) clearInterval(heroInterval);
        heroInterval = setInterval(runHeroAnimation, ANIMATION_REPEAT_MS);
    }
    function stopHeroInterval() {
        if (heroInterval) { clearInterval(heroInterval); heroInterval = null; }
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
            animations_title: "Animations", characters_title: "Character Design", models_3d_title: "3D Models", illustrations_title: "Illustrations",
            illu_eyebrow: "Selected works · 2D", illu_title: "Illustrations", illu_intro: "A curated gallery of illustrations, concept art and visual development — character pieces, environments and more.", illu_f_all: "All", illu_f_characters: "Characters", illu_f_environments: "Environments", illu_f_concept: "Concept art", illu_f_posters: "Posters", illu_pieces: "pieces", illu_featured: "Featured", illu_spot_title: "The piece of the month", illu_spot_desc: "Highlight a key illustration here — the process, the tools and the idea behind it. Editable from the same system.", illu_meta_medium: "Digital painting", illu_note: "These are empty placeholders. The superadmin uploads the real illustrations through the editing system.", illu_spot_b2: "Process", illu_spot_t2: "From sketch to final", illu_spot_d2: "A general caption for each rotating piece: describe the concept, the palette and the story behind it. Editable from the same system.", illu_spot_m2: "Concept & render", illu_spot_b3: "Latest", illu_spot_t3: "Latest additions", illu_spot_d3: "Rotate through the highlights — each frame keeps its own short text so the gallery always shows image and story together.",
            anim_eyebrow: "Now playing · Motion reel", anim_title: "Animations", anim_intro: "Cutscenes, loops and motion experiments — character acting, weight and timing.", anim_showreel: "Showreel", anim_f_all: "All", anim_f_cutscenes: "Cutscenes", anim_f_loops: "Loops & cycles", anim_f_experiments: "Experiments", anim_clips: "clips", anim_note: "Empty screens are placeholders — the superadmin uploads the real clips through the editing system.",
            char_eyebrow: "Cast file · Character design", char_title: "Character Design", char_intro: "The full cast: protagonists, antagonists and the creatures in between. Flip a card to read its dossier.", char_f_all: "All", char_f_protagonists: "Protagonists", char_f_antagonists: "Antagonists", char_f_creatures: "Creatures", char_entries: "entries", char_role_main: "Main character", char_role_support: "Supporting", char_role_antagonist: "Antagonist", char_role_creature: "Creature", char_bio_ph: "Short bio placeholder. The superadmin can edit the name and description from the same editing system.", char_note: "Placeholder dossiers — pick a character from the roster. The superadmin fills in portraits, names and bios.", cs_type: "Type", cs_debut: "Debut", cs_images: "Images", cs_more: "Read more", cs_less: "Read less", char_extra_ph: "References, palette notes and extra design details go here — fully editable from the same system.",
            m3d_eyebrow: "Realtime · 3D Lab", m3d_title: "3D Models", m3d_intro: "Hard-surface, organic and stylized assets — turntables, wireframes and breakdowns.", m3d_f_all: "All", m3d_f_characters: "Characters", m3d_f_props: "Props", m3d_f_environments: "Environments", m3d_assets: "assets", m3d_note: "Empty viewports are placeholders — the superadmin uploads turntables and breakdowns through the editing system.", see_all: "See full gallery",
            mm_eyebrow: "Mixed media · Wall", mm_title: "Multimedia", mm_intro: "Everything that doesn't fit a single box: videos, images and embeds living together on one wall.", mm_f_all: "All", mm_f_video: "Video", mm_f_image: "Image", mm_f_embed: "Embeds", mm_items: "items", mm_note: "Empty cards are placeholders — the superadmin uploads images, videos and embeds through the editing system."
        },
        es: {
            nav_feed: "Feed", nav_gallery: "Galería", nav_portfolio: "Portafolio", nav_about: "Acerca de mí", nav_contact: "Contacto",
            nav_illustrations: "Ilustraciones", nav_animations: "Animaciones", nav_characters: "Diseño de Personajes", nav_3d: "Modelos 3D", nav_multimedia: "Multimedia",
            hero_title: "Lucia Montaña <span class='highlight'>| Portafolio</span>",
            hero_sub: "Licenciada en Animación y Videojuegos.<br>Ilustradora, diseñadora de personajes/entornos y generalista 3D",
            hero_btn: "Explorar galería",
            about_title: "Sobre Mí",
            about_text_1: "<p>Mi nombre es <strong>Lucía Montaña</strong> y soy una <strong>artista 2D y 3D</strong> con sede en Montevideo, Uruguay.</p><p>Me especializo tanto en diseño como en animación, con una gran pasión por crear personajes y diseños que brinden identidad y vida a mi trabajo. Realmente amo transmitir emociones e historias a la audiencia de la mejor manera posible.</p><p>Tengo una Licenciatura en <strong>Animación y Diseño de Videojuegos</strong> de la Universidad ORT, Uruguay, y trabajo como artista freelance desde 2019. ¡Ahora busco ampliar mis horizontes y formar parte de nuevos proyectos!</p>",
            animations_title: "Animaciones", characters_title: "Diseño de Personajes", models_3d_title: "Modelos 3D", illustrations_title: "Ilustraciones",
            illu_eyebrow: "Obras seleccionadas · 2D", illu_title: "Ilustraciones", illu_intro: "Una galería curada de ilustraciones, concept art y desarrollo visual — personajes, entornos y más.", illu_f_all: "Todas", illu_f_characters: "Personajes", illu_f_environments: "Entornos", illu_f_concept: "Concept art", illu_f_posters: "Afiches", illu_pieces: "piezas", illu_featured: "Destacada", illu_spot_title: "La pieza del mes", illu_spot_desc: "Destacá acá una ilustración clave — el proceso, las herramientas y la idea detrás. Editable desde el mismo sistema.", illu_meta_medium: "Pintura digital", illu_note: "Estos son contenedores vacíos. El superadmin sube las ilustraciones reales desde el sistema de edición.", illu_spot_b2: "Proceso", illu_spot_t2: "Del boceto al final", illu_spot_d2: "Un texto general para cada pieza que rota: describí el concepto, la paleta y la historia detrás. Editable desde el mismo sistema.", illu_spot_m2: "Concepto y render", illu_spot_b3: "Nuevo", illu_spot_t3: "Últimas incorporaciones", illu_spot_d3: "Rotá por los destacados — cada cuadro mantiene su texto, así la galería siempre muestra imagen e historia juntas.",
            anim_eyebrow: "Reproduciendo · Reel de animación", anim_title: "Animaciones", anim_intro: "Cinemáticas, loops y experimentos de movimiento — actuación, peso y timing.", anim_showreel: "Showreel", anim_f_all: "Todas", anim_f_cutscenes: "Cinemáticas", anim_f_loops: "Loops y ciclos", anim_f_experiments: "Experimentos", anim_clips: "clips", anim_note: "Las pantallas vacías son contenedores — el superadmin sube los clips reales desde el sistema de edición.",
            char_eyebrow: "Ficha · Diseño de personajes", char_title: "Diseño de Personajes", char_intro: "El elenco completo: protagonistas, antagonistas y las criaturas del medio. Volteá una ficha para leer su dossier.", char_f_all: "Todos", char_f_protagonists: "Protagonistas", char_f_antagonists: "Antagonistas", char_f_creatures: "Criaturas", char_entries: "fichas", char_role_main: "Personaje principal", char_role_support: "Secundario", char_role_antagonist: "Antagonista", char_role_creature: "Criatura", char_bio_ph: "Bio de ejemplo. El superadmin puede editar el nombre y la descripción desde el mismo sistema de edición.", char_note: "Fichas de ejemplo — elegí un personaje del roster. El superadmin completa retratos, nombres y biografías.", cs_type: "Tipo", cs_debut: "Debut", cs_images: "Imágenes", cs_more: "Ver más", cs_less: "Ver menos", char_extra_ph: "Acá van referencias, notas de paleta y detalles extra de diseño — editable desde el mismo sistema.",
            m3d_eyebrow: "Tiempo real · Lab 3D", m3d_title: "Modelos 3D", m3d_intro: "Assets hard-surface, orgánicos y estilizados — turntables, wireframes y breakdowns.", m3d_f_all: "Todos", m3d_f_characters: "Personajes", m3d_f_props: "Props", m3d_f_environments: "Entornos", m3d_assets: "assets", m3d_note: "Los viewports vacíos son contenedores — el superadmin sube turntables y breakdowns desde el sistema de edición.", see_all: "Ver galería completa",
            mm_eyebrow: "Medios mixtos · Muro", mm_title: "Multimedia", mm_intro: "Todo lo que no entra en una sola caja: videos, imágenes y embeds conviviendo en un mismo muro.", mm_f_all: "Todos", mm_f_video: "Video", mm_f_image: "Imagen", mm_f_embed: "Embeds", mm_items: "ítems", mm_note: "Las tarjetas vacías son contenedores — el superadmin sube imágenes, videos y embeds desde el sistema de edición."
        },
        pt: {
            nav_feed: "Feed", nav_gallery: "Galeria", nav_portfolio: "Portfólio", nav_about: "Sobre mim", nav_contact: "Contato",
            nav_illustrations: "Ilustrações", nav_animations: "Animações", nav_characters: "Design de Personagens", nav_3d: "Modelos 3D", nav_multimedia: "Multimídia",
            hero_title: "Lucia Montaña <span class='highlight'>| Portfólio</span>",
            hero_sub: "Bacharel em Animação e Videogames.<br>Ilustradora, designer de personagens/ambientes e generalista 3D",
            hero_btn: "Explorar galeria",
            about_title: "Sobre Mim",
            about_text_1: "<p>Meu nome é <strong>Lucía Montaña</strong> e sou uma <strong>artista 2D e 3D</strong> baseada em Montevidéu, Uruguai.</p><p>Sou especializada tanto em design quanto em animação, com uma grande paixão por criar personagens e designs que tragam identidade e vida ao meu trabalho. Adoro transmitir emoções e histórias ao público da melhor maneira possível.</p><p>Tenho um bacharelado em <strong>Animação e Design de Videogames</strong> pela Universidade ORT, Uruguai, e trabalho como artista freelance desde 2019. Agora busco ampliar meus horizontes e fazer parte de novos projetos!</p>",
            animations_title: "Animações", characters_title: "Design de Personagens", models_3d_title: "Modelos 3D", illustrations_title: "Ilustrações",
            illu_eyebrow: "Trabalhos selecionados · 2D", illu_title: "Ilustrações", illu_intro: "Uma galeria curada de ilustrações, concept art e desenvolvimento visual — personagens, ambientes e mais.", illu_f_all: "Todas", illu_f_characters: "Personagens", illu_f_environments: "Ambientes", illu_f_concept: "Concept art", illu_f_posters: "Pôsteres", illu_pieces: "peças", illu_featured: "Destaque", illu_spot_title: "A peça do mês", illu_spot_desc: "Destaque aqui uma ilustração chave — o processo, as ferramentas e a ideia por trás. Editável pelo mesmo sistema.", illu_meta_medium: "Pintura digital", illu_note: "Estes são espaços vazios. O superadmin envia as ilustrações reais pelo sistema de edição.", illu_spot_b2: "Processo", illu_spot_t2: "Do esboço ao final", illu_spot_d2: "Um texto geral para cada peça que gira: descreva o conceito, a paleta e a história por trás. Editável pelo mesmo sistema.", illu_spot_m2: "Conceito e render", illu_spot_b3: "Novo", illu_spot_t3: "Últimas adições", illu_spot_d3: "Gire pelos destaques — cada quadro mantém seu texto, então a galeria sempre mostra imagem e história juntas.",
            anim_eyebrow: "Tocando agora · Reel de animação", anim_title: "Animações", anim_intro: "Cutscenes, loops e experimentos de movimento — atuação, peso e timing.", anim_showreel: "Showreel", anim_f_all: "Todas", anim_f_cutscenes: "Cutscenes", anim_f_loops: "Loops e ciclos", anim_f_experiments: "Experimentos", anim_clips: "clipes", anim_note: "As telas vazias são espaços — o superadmin envia os clipes reais pelo sistema de edição.",
            char_eyebrow: "Ficha · Design de personagens", char_title: "Design de Personagens", char_intro: "O elenco completo: protagonistas, antagonistas e as criaturas no meio. Vire uma carta para ler o dossiê.", char_f_all: "Todos", char_f_protagonists: "Protagonistas", char_f_antagonists: "Antagonistas", char_f_creatures: "Criaturas", char_entries: "fichas", char_role_main: "Personagem principal", char_role_support: "Coadjuvante", char_role_antagonist: "Antagonista", char_role_creature: "Criatura", char_bio_ph: "Bio de exemplo. O superadmin pode editar o nome e a descrição pelo mesmo sistema de edição.", char_note: "Fichas de exemplo — escolha um personagem no elenco. O superadmin preenche retratos, nomes e biografias.", cs_type: "Tipo", cs_debut: "Estreia", cs_images: "Imagens", cs_more: "Ver mais", cs_less: "Ver menos", char_extra_ph: "Aqui vão referências, notas de paleta e detalhes extras de design — editável pelo mesmo sistema.",
            m3d_eyebrow: "Tempo real · Lab 3D", m3d_title: "Modelos 3D", m3d_intro: "Assets hard-surface, orgânicos e estilizados — turntables, wireframes e breakdowns.", m3d_f_all: "Todos", m3d_f_characters: "Personagens", m3d_f_props: "Props", m3d_f_environments: "Ambientes", m3d_assets: "assets", m3d_note: "Os viewports vazios são espaços — o superadmin envia turntables e breakdowns pelo sistema de edição.", see_all: "Ver galeria completa",
            mm_eyebrow: "Mídia mista · Mural", mm_title: "Multimídia", mm_intro: "Tudo o que não cabe numa só caixa: vídeos, imagens e embeds juntos num mesmo mural.", mm_f_all: "Todos", mm_f_video: "Vídeo", mm_f_image: "Imagem", mm_f_embed: "Embeds", mm_items: "itens", mm_note: "Os cartões vazios são espaços — o superadmin envia imagens, vídeos e embeds pelo sistema de edição."
        },
        fr: {
            nav_feed: "Flux", nav_gallery: "Galerie", nav_portfolio: "Portfolio", nav_about: "À propos", nav_contact: "Contact",
            nav_illustrations: "Illustrations", nav_animations: "Animations", nav_characters: "Design de Personnages", nav_3d: "Modèles 3D", nav_multimedia: "Multimédia",
            hero_title: "Lucia Montaña <span class='highlight'>| Portfolio</span>",
            hero_sub: "Diplômée en Animation et Jeux Vidéo.<br>Illustratrice, designer de personnages/environnements et généraliste 3D",
            hero_btn: "Explorer la galerie",
            about_title: "À propos de moi",
            about_text_1: "<p>Je m'appelle <strong>Lucía Montaña</strong> et je suis une <strong>artiste 2D et 3D</strong> basée à Montevideo, en Uruguay.</p><p>Je me spécialise à la fois dans le design et l'animation, avec une grande passion pour la création de personnages et de designs qui apportent identité et vie à mon travail. J'aime profondément transmettre des émotions et des histoires au public de la meilleure façon possible.</p><p>Je suis titulaire d'une licence en <strong>Animation et Conception de Jeux Vidéo</strong> de l'Université ORT, en Uruguay, et je travaille en freelance depuis 2019. Je cherche maintenant à élargir mes horizons et à participer à de nouveaux projets !</p>",
            animations_title: "Animations", characters_title: "Design de Personnages", models_3d_title: "Modèles 3D", illustrations_title: "Illustrations",
            illu_eyebrow: "Travaux sélectionnés · 2D", illu_title: "Illustrations", illu_intro: "Une galerie d'illustrations, de concept art et de développement visuel — personnages, environnements et plus.", illu_f_all: "Tout", illu_f_characters: "Personnages", illu_f_environments: "Environnements", illu_f_concept: "Concept art", illu_f_posters: "Affiches", illu_pieces: "pièces", illu_featured: "À la une", illu_spot_title: "La pièce du mois", illu_spot_desc: "Mettez en avant une illustration clé — le processus, les outils et l'idée derrière. Modifiable depuis le même système.", illu_meta_medium: "Peinture numérique", illu_note: "Ce sont des espaces vides. Le superadmin téléverse les vraies illustrations via le système d'édition.", illu_spot_b2: "Processus", illu_spot_t2: "Du croquis au final", illu_spot_d2: "Une légende générale pour chaque pièce qui défile : décrivez le concept, la palette et l'histoire. Modifiable depuis le même système.", illu_spot_m2: "Concept & rendu", illu_spot_b3: "Récent", illu_spot_t3: "Derniers ajouts", illu_spot_d3: "Faites défiler les temps forts — chaque cadre garde son texte, la galerie montre toujours image et histoire ensemble.",
            anim_eyebrow: "Lecture en cours · Bande démo", anim_title: "Animations", anim_intro: "Cinématiques, boucles et expériences de mouvement — jeu d'acteur, poids et timing.", anim_showreel: "Showreel", anim_f_all: "Tout", anim_f_cutscenes: "Cinématiques", anim_f_loops: "Boucles et cycles", anim_f_experiments: "Expériences", anim_clips: "clips", anim_note: "Les écrans vides sont des espaces — le superadmin téléverse les vrais clips via le système d'édition.",
            char_eyebrow: "Dossier · Design de personnages", char_title: "Design de Personnages", char_intro: "Le casting complet : protagonistes, antagonistes et les créatures entre les deux. Retournez une carte pour lire la fiche.", char_f_all: "Tout", char_f_protagonists: "Protagonistes", char_f_antagonists: "Antagonistes", char_f_creatures: "Créatures", char_entries: "fiches", char_role_main: "Personnage principal", char_role_support: "Secondaire", char_role_antagonist: "Antagoniste", char_role_creature: "Créature", char_bio_ph: "Bio d'exemple. Le superadmin peut modifier le nom et la description depuis le même système d'édition.", char_note: "Fiches d'exemple — choisissez un personnage dans le casting. Le superadmin remplit portraits, noms et bios.", cs_type: "Type", cs_debut: "Début", cs_images: "Images", cs_more: "Voir plus", cs_less: "Voir moins", char_extra_ph: "Références, notes de palette et détails de design ici — modifiable depuis le même système.",
            m3d_eyebrow: "Temps réel · Lab 3D", m3d_title: "Modèles 3D", m3d_intro: "Assets hard-surface, organiques et stylisés — turntables, wireframes et breakdowns.", m3d_f_all: "Tout", m3d_f_characters: "Personnages", m3d_f_props: "Props", m3d_f_environments: "Environnements", m3d_assets: "assets", m3d_note: "Les viewports vides sont des espaces — le superadmin téléverse turntables et breakdowns via le système d'édition.", see_all: "Voir la galerie complète",
            mm_eyebrow: "Médias mixtes · Mur", mm_title: "Multimédia", mm_intro: "Tout ce qui n'entre pas dans une seule case : vidéos, images et embeds réunis sur un même mur.", mm_f_all: "Tout", mm_f_video: "Vidéo", mm_f_image: "Image", mm_f_embed: "Embeds", mm_items: "éléments", mm_note: "Les cartes vides sont des espaces — le superadmin téléverse images, vidéos et embeds via le système d'édition."
        }
    };

    // Mapa idioma -> código ISO de bandera (flag-icons). en usa la bandera USA.
    const flagMap = {
        'en': 'us',
        'es': 'es',
        'pt': 'pt',
        'fr': 'fr'
    };
    // Sigla mostrada al lado de la bandera seleccionada
    const codeMap = {
        'en': 'EN',
        'es': 'ES',
        'pt': 'PT',
        'fr': 'FR'
    };
    const setFlag = (el, lang) => {
        if (el) el.className = 'fi fi-' + (flagMap[lang] || 'us');
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

        // Update current-language flag + code (sigla) in navbar + settings
        setFlag(document.getElementById('lang-flag-nav'), lang);
        setFlag(document.getElementById('lang-flag-settings'), lang);
        var codeNav = document.getElementById('lang-code-nav');
        var codeSettings = document.getElementById('lang-code-settings');
        if (codeNav) codeNav.textContent = codeMap[lang] || 'EN';
        if (codeSettings) codeSettings.textContent = codeMap[lang] || 'EN';

        // Update active state on all option buttons
        document.querySelectorAll('.lang-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        startHeroInterval(); // Restart hero with new language
    };

    let savedLang = localStorage.getItem('lang') || 'en';

    // Dropdown toggles (navbar + settings)
    const langToggleNav = document.getElementById('lang-toggle-nav');
    const langDropdownNav = document.getElementById('lang-dropdown-nav');
    const langToggleSettings = document.getElementById('lang-toggle-settings');
    const langDropdownSettings = document.getElementById('lang-dropdown-settings');

    const closeLangDropdowns = () => {
        if (langDropdownNav) langDropdownNav.classList.remove('active');
        if (langDropdownSettings) langDropdownSettings.classList.remove('active');
        if (langToggleSettings) langToggleSettings.classList.remove('open');
    };

    if (langToggleNav && langDropdownNav) {
        langToggleNav.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = !langDropdownNav.classList.contains('active');
            closeLangDropdowns();
            if (willOpen) langDropdownNav.classList.add('active');
        });
    }

    if (langToggleSettings && langDropdownSettings) {
        langToggleSettings.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = !langDropdownSettings.classList.contains('active');
            closeLangDropdowns();
            if (willOpen) {
                langDropdownSettings.classList.add('active');
                langToggleSettings.classList.add('open');
            }
        });
    }

    // Close dropdowns when clicking outside either selector
    document.addEventListener('click', (e) => {
        if (e.target.closest('.lang-selector-nav') || e.target.closest('.lang-selector-settings')) return;
        closeLangDropdowns();
    });

    // Language option buttons (both selectors)
    document.querySelectorAll('.lang-option[data-lang]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            updateLanguage(btn.dataset.lang);
            closeLangDropdowns();
        });
    });

    updateLanguage(savedLang);

    // =============================================
    // 3. OTHER FEATURES (Slideshow, Video, Observer)
    // =============================================
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    window.initHeroSlideshow = function() {
        if (window.heroSlideshowTimer) { clearInterval(window.heroSlideshowTimer); window.heroSlideshowTimer = null; }
        if (window.heroSlideshowObserver) { window.heroSlideshowObserver.disconnect(); }

        const slides = document.querySelectorAll('.slide');
        if (slides.length > 0) {
            let currentSlide = 0;
            const panClasses = ['pan-tl', 'pan-tr', 'pan-bl', 'pan-br', 'pan-c'];
            // Reset state
            slides.forEach(s => s.classList.remove('slide-active', ...panClasses));
            slides[0].classList.add('slide-active', panClasses[Math.floor(Math.random() * panClasses.length)]);

            const advanceSlide = () => {
                slides[currentSlide].classList.remove('slide-active', ...panClasses);
                currentSlide = (currentSlide + 1) % slides.length;
                slides[currentSlide].classList.add('slide-active', panClasses[Math.floor(Math.random() * panClasses.length)]);
            };

            const duration = window.CMS_HERO_DURATION || 7000;
            
            // Solo correr el slideshow y el typewriter del hero mientras la sección es visible.
            const heroSection = document.getElementById('inicio');
            if (heroSection) {
                window.heroSlideshowObserver = new IntersectionObserver((entries) => {
                    heroVisible = entries[0].isIntersecting;
                    if (heroVisible) {
                        if (!window.heroSlideshowTimer) window.heroSlideshowTimer = setInterval(advanceSlide, duration);
                        if (!heroInterval) startHeroInterval();
                    } else {
                        if (window.heroSlideshowTimer) { clearInterval(window.heroSlideshowTimer); window.heroSlideshowTimer = null; }
                        stopHeroInterval();
                    }
                }, { threshold: 0 });
                window.heroSlideshowObserver.observe(heroSection);
            } else {
                window.heroSlideshowTimer = setInterval(advanceSlide, duration);
            }
        }
    };
    window.initHeroSlideshow();

    document.querySelectorAll('.video-container').forEach(container => {
        const vid = container.querySelector('video');
        const playPauseBtn = container.querySelector('.play-pause-btn');
        const fullscreenBtn = container.querySelector('.fullscreen-btn');
        if (vid) {
            container.addEventListener('mouseenter', () => {
                // No reproducir si la sección padre está fuera de viewport
                if (container.closest('.section-inactive')) return;
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
                    if (source) openVideoLightbox(source.src, container.dataset.title, container.dataset.desc, {
                        date: container.dataset.date,
                        project: container.dataset.project,
                        inspiration: container.dataset.inspiration
                    });
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
        'ramen party.webp'
    ];
    if (illustrationsGrid) {
        illustrationsGrid.innerHTML = '';
        // Patrón "bento": tamaños variados (big/wide/tall) que, con grid-auto-flow:dense,
        // rellenan la grilla sin dejar huecos. Da la galería con imágenes de distinto tamaño.
        const bentoPattern = ['big', '', 'tall', '', '', 'wide', '', 'tall', '', 'big', '', 'wide', '', 'tall'];
        illustrationFiles.forEach((file, index) => {
            const item = document.createElement('div');
            const size = bentoPattern[index % bentoPattern.length] || '';
            item.className = 'gallery-item fade-in' + (size ? ' ' + size : '');
            const imgPath = 'assets/images/feed/ilustrations/' + file;

            const cleanTitle = file.split('.')[0].replace(/_/g, ' ').replace(/-/g, ' ');
            const capitalizedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

            const driftDuration = (Math.random() * 16 + 12).toFixed(2) + 's';
            const driftDelay = (Math.random() * -20).toFixed(2) + 's';

            // Info para pantalla completa (editable por superadmin)
            item.dataset.title = capitalizedTitle;
            item.dataset.desc = 'Una exploración ilustrativa de Lucía Montaña.';
            item.dataset.date = '2024';
            item.dataset.project = 'Illustration';
            item.dataset.inspiration = 'Color, luz y momentos cotidianos.';
            item.dataset.link = '';

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

            // Lee SIEMPRE la imagen e info ACTUALES (corrige el bug de mostrar la vieja al cambiarla)
            const openThis = () => {
                const cur = item.querySelector('img');
                openLightbox(cur ? cur.src : imgPath, item.dataset.title || capitalizedTitle, item.dataset.desc || '', item.dataset.link || '', {
                    date: item.dataset.date,
                    project: item.dataset.project,
                    inspiration: item.dataset.inspiration
                });
            };
            item.addEventListener('click', (e) => {
                if (e.target.closest('.expand-btn')) return; // el botón abre el lightbox
                if (isMobileView() && !item.classList.contains('touch-active')) {
                    // Primer tap: revelar overlay (como hover); 2º tap o botón expandir abre.
                    clearTouchActive(item);
                    item.classList.add('touch-active');
                    return;
                }
                openThis();
            });
            const expandBtn = item.querySelector('.expand-btn');
            if (expandBtn) expandBtn.addEventListener('click', (e) => { e.stopPropagation(); openThis(); });
            illustrationsGrid.appendChild(item);
            observer.observe(item);
        });
    }

    // =============================================
    // 5. CHARACTER DESIGN — Showcase (un personaje a la vez)
    // Crossfade entre paneles + riel de miniaturas con autoavance.
    // Pausa en hover y cuando la sección no está en pantalla.
    // =============================================
    (function initCharShowcase() {
        const showcase = document.querySelector('.cd-showcase');
        if (!showcase) return;
        const panels = Array.from(showcase.querySelectorAll('.cd-panel'));
        const railItems = Array.from(showcase.querySelectorAll('.cd-rail-item'));
        if (!panels.length) return;

        const INTERVAL = 6000;
        showcase.style.setProperty('--cd-interval', (INTERVAL / 1000) + 's');

        let idx = 0;
        let timer = null;
        let visible = false;

        function runProgress() {
            railItems.forEach(r => {
                const bar = r.querySelector('.cd-rail-progress');
                if (bar) bar.classList.remove('run');
            });
            const activeItem = railItems[idx];
            const bar = activeItem && activeItem.querySelector('.cd-rail-progress');
            if (bar && visible) {
                void bar.offsetWidth; // reflow para reiniciar la animación
                bar.classList.add('run');
            }
        }

        function schedule() {
            clearTimeout(timer);
            if (visible) timer = setTimeout(() => setActive(idx + 1), INTERVAL);
        }

        function setActive(n) {
            idx = (n + panels.length) % panels.length;
            panels.forEach((p, i) => p.classList.toggle('active', i === idx));
            railItems.forEach((r, i) => r.classList.toggle('active', i === idx));
            runProgress();
            schedule();
        }

        railItems.forEach((r, i) => r.addEventListener('click', () => setActive(i)));

        // Abrir lightbox desde el retrato y las miniaturas de concept, con el
        // mismo sistema de info (fecha, proyecto, inspiración) del resto del feed.
        showcase.querySelectorAll('[data-full]').forEach(el => {
            el.addEventListener('click', () => {
                const full = el.getAttribute('data-full');
                const panel = el.closest('.cd-panel');
                const name = panel ? panel.querySelector('.cd-name').textContent : 'Character';
                const descEl = panel && panel.querySelector('.cd-desc');
                const role = panel && panel.querySelector('.cd-role');
                const desc = descEl ? descEl.textContent.trim() : (role ? role.textContent : '');
                const meta = panel ? {
                    date: panel.dataset.date,
                    project: panel.dataset.project || (role ? role.textContent : ''),
                    inspiration: panel.dataset.inspiration
                } : {};
                if (typeof openLightbox === 'function') openLightbox(full, name, desc, '', meta);
            });
        });

        // El carrusel NO se pausa al pasar el cursor: corre siempre que la
        // sección esté en pantalla.

        // Solo correr cuando la sección está en pantalla.
        new IntersectionObserver((entries) => {
            visible = entries[0].isIntersecting;
            if (visible) { runProgress(); schedule(); }
            else clearTimeout(timer);
        }, { threshold: 0.2 }).observe(showcase);

        setActive(0);
    })();

    document.querySelectorAll('.fade-in, .presentation-container, .section-title, .animations-grid, .cd-showcase, .model-row, .bio-content, .media-stack, .model-text, .model-visual-wrapper, .model-visual-grid-wrapper').forEach(el => observer.observe(el));

    // =============================================
    // MENÚ MÓVIL (hamburguesa)
    // =============================================
    const navToggle = document.getElementById('nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    const navBackdrop = document.getElementById('nav-backdrop');
    const navActions = document.querySelector('.nav-actions');
    const navContainer = document.querySelector('.nav-container');
    if (navToggle && navLinks) {
        // En móvil, mover CV+login al final del drawer al abrir (y devolverlos
        // a la barra al cerrar). Así no se ven duplicados y se pueden tocar
        // desde el menú reusando el login real renderizado por cms.js.
        const placeActions = (intoDrawer) => {
            if (!navActions) return;
            if (intoDrawer) navLinks.appendChild(navActions);
            else if (navContainer) navContainer.appendChild(navActions);
        };
        const closeNav = () => {
            document.body.classList.remove('nav-open');
            navToggle.setAttribute('aria-expanded', 'false');
            placeActions(false);
        };
        navToggle.addEventListener('click', () => {
            const open = document.body.classList.toggle('nav-open');
            navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            placeActions(open);
        });
        if (navBackdrop) navBackdrop.addEventListener('click', closeNav);
        // Cerrar al tocar cualquier enlace del drawer.
        navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));
        // Cerrar con Escape.
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });
    }

    // =============================================
    // DROPDOWNS abribles por TAP/CLICK (además de hover en desktop)
    // Necesario en pantallas táctiles (móvil/tablet/laptop touch) donde
    // el :hover no dispara. Toca el botón → abre; toca afuera/Escape → cierra.
    // =============================================
    const navDropdowns = document.querySelectorAll('.nav-links .dropdown');
    navDropdowns.forEach((dd) => {
        const btn = dd.querySelector('.dropbtn');
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOpen = dd.classList.contains('open');
            navDropdowns.forEach((d) => d.classList.remove('open'));
            if (!wasOpen) dd.classList.add('open');
        });
    });
    document.addEventListener('click', () => navDropdowns.forEach((d) => d.classList.remove('open')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') navDropdowns.forEach((d) => d.classList.remove('open')); });

    // =============================================
    // FUNDIDO DE IMÁGENES (anti pop-in)
    // Añade .img-loaded cuando cada imagen termina de cargar; el CSS
    // las mantiene en opacity:0 hasta entonces.
    // =============================================
    function enhanceImages() {
        const imgs = document.querySelectorAll('.gallery-item img, .feed-img, .model-media img');
        imgs.forEach(img => {
            if (img.complete && img.naturalWidth > 0) {
                img.classList.add('img-loaded');
            } else {
                img.addEventListener('load', () => img.classList.add('img-loaded'), { once: true });
                img.addEventListener('error', () => img.classList.add('img-loaded'), { once: true });
            }
        });
        // Failsafe: nunca dejar una imagen invisible por un evento perdido.
        setTimeout(() => imgs.forEach(img => img.classList.add('img-loaded')), 5000);
    }
    enhanceImages();

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
            if (e.target.closest('.play-pause-btn') || e.target.closest('.fullscreen-btn')) return;
            if (isMobileView() && !container.classList.contains('touch-active')) {
                // Primer tap: revelar overlay con la info abreviada (como el hover
                // en PC) y reproducir. NO abrir pantalla completa todavía.
                clearTouchActive(container);
                container.classList.add('touch-active');
                const v = container.querySelector('video');
                if (v) { try { v.play(); } catch (err) {} }
                return;
            }
            // Segundo tap (overlay ya visible) o desktop: abrir pantalla completa.
            const source = container.querySelector('source');
            if (source) openVideoLightbox(source.src, container.dataset.title, container.dataset.desc, {
                date: container.dataset.date,
                project: container.dataset.project,
                inspiration: container.dataset.inspiration
            });
        });
    });

    // =============================================
    // PRODUCTION STACK — click toggle (no hover)
    // =============================================
    const softReveal = document.querySelector('.global-soft-reveal');
    const softHeader = softReveal && softReveal.querySelector('.global-soft-header');
    if (softHeader) {
        softHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            softReveal.classList.toggle('open');
        });
        document.addEventListener('click', (e) => {
            if (!softReveal.contains(e.target)) softReveal.classList.remove('open');
        });
    }

    // =============================================
    // AHORRO DE RENDIMIENTO — pausar animaciones de secciones fuera de viewport
    // Cada sección (y el footer) recibe ".section-inactive" cuando NO está en
    // pantalla; el CSS pausa sus animaciones (animation-play-state). Así solo
    // corren las animaciones de las secciones visibles. Los canvas y los videos
    // ya se gatean por su cuenta. Default sin clase = corriendo (si el JS falla,
    // todo sigue animando como antes).
    // =============================================
    (function initSectionActivity() {
        const blocks = document.querySelectorAll('main > section, .main-footer');
        if (!blocks.length) return;
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => e.target.classList.toggle('section-inactive', !e.isIntersecting));
        }, { rootMargin: '120px 0px', threshold: 0 });
        blocks.forEach(b => io.observe(b));
    })();

    // =============================================
    // 3D MÓVIL — distribución "texto, 2 videos, texto, 2 videos"
    // En desktop quedan 1 y 3 videos (sin tocar). En móvil se reubica el 3er
    // video del personaje al bloque 1 para que cada bloque muestre 2 videos.
    // =============================================
    (function init3dMobileSplit() {
        const cont = document.querySelector('.models-container');
        if (!cont) return;
        const block1Visual = cont.querySelector('.model-row:not(.reverse) .model-visual-wrapper');
        const subGrid = cont.querySelector('.model-row.reverse .video-sub-grid');
        if (!block1Visual || !subGrid) return;
        const movable = subGrid.lastElementChild; // último video chico del bloque 2
        if (!movable) return;
        const mq = window.matchMedia('(max-width: 768px)');
        const apply = () => {
            if (mq.matches) {
                if (movable.parentElement !== block1Visual) block1Visual.appendChild(movable);
            } else if (movable.parentElement !== subGrid) {
                subGrid.appendChild(movable);
            }
        };
        apply();
        mq.addEventListener('change', apply);
    })();
});

// Lightbox functions (Global scope)
// Rellena los campos opcionales (fecha, proyecto, inspiración) del panel de
// info. Cada campo se oculta si no hay dato. `meta` = {date, project, inspiration}.
function applyLightboxMeta(lb, meta) {
    meta = meta || {};
    const setField = (selector, value) => {
        const el = lb.querySelector(selector);
        if (!el) return;
        const valEl = el.querySelector('.val') || el;
        if (value) { valEl.textContent = value; el.classList.remove('hidden'); }
        else { el.classList.add('hidden'); }
    };
    setField('.info-date', meta.date);
    setField('.info-project', meta.project);
    setField('.info-inspiration', meta.inspiration);
}

function openLightbox(src, title, desc, link, meta) {
    const lb = document.getElementById('image-lightbox');
    const img = document.getElementById('lightbox-img');
    const titleEl = lb.querySelector('.info-title');
    const descEl = lb.querySelector('.info-desc');
    const linkEl = lb.querySelector('.info-link');
    const panel = lb.querySelector('.lightbox-info-panel');

    if (lb && img) {
        img.src = src;
        if (titleEl) titleEl.innerText = title || "Illustration";
        if (descEl) descEl.innerText = desc || "A piece from my collection.";
        applyLightboxMeta(lb, meta);
        if (linkEl) {
            if (link) { linkEl.href = link; linkEl.style.display = ''; }
            else { linkEl.removeAttribute('href'); linkEl.style.display = 'none'; }
        }
        if (panel) panel.classList.add('hidden'); // Reset to hidden
        lb.classList.remove('info-open'); // Reset shrink state

        document.body.classList.add('lightbox-open'); // Bloquear scroll de fondo
        lb.style.display = 'flex';
        setTimeout(() => lb.style.opacity = '1', 10);

        // Auto-show info panel al abrir — se queda abierto hasta que el usuario lo cierre
        if (panel) {
            setTimeout(() => {
                panel.classList.remove('hidden');
                lb.classList.add('info-open');
            }, 650);
        }
    }
}

function closeLightbox() {
    const lb = document.getElementById('image-lightbox');
    if (lb) {
        lb.style.opacity = '0';
        document.body.classList.remove('lightbox-open'); // Restaurar scroll
        setTimeout(() => lb.style.display = 'none', 300);
    }
}

function openVideoLightbox(src, title, desc, meta) {
    const lb = document.getElementById('video-lightbox');
    const vid = document.getElementById('lightbox-video');
    const titleEl = lb.querySelector('.info-title');
    const descEl = lb.querySelector('.info-desc');
    const panel = lb.querySelector('.lightbox-info-panel');

    if (lb && vid) {
        vid.src = src;
        if (titleEl) titleEl.innerText = title || "Animation";
        if (descEl) descEl.innerText = desc || "Action sequence study.";
        applyLightboxMeta(lb, meta);
        if (panel) panel.classList.add('hidden'); // Reset to hidden
        lb.classList.remove('info-open'); // Reset shrink state

        document.body.classList.add('lightbox-open'); // Bloquear scroll de fondo
        lb.style.display = 'flex';
        setTimeout(() => {
            lb.style.opacity = '1';
            vid.play();
        }, 10);

        // Auto-show info panel al abrir — se queda abierto hasta que el usuario lo cierre
        if (panel) {
            setTimeout(() => {
                panel.classList.remove('hidden');
                lb.classList.add('info-open');
            }, 650);
        }
    }
}

function closeVideoLightbox() {
    const lb = document.getElementById('video-lightbox');
    if (lb) {
        lb.style.opacity = '0';
        document.body.classList.remove('lightbox-open'); // Restaurar scroll
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
    const lb = btn.closest('.lightbox');
    const panel = btn.parentElement.querySelector('.lightbox-info-panel');
    if (panel) {
        const willShow = panel.classList.contains('hidden');
        panel.classList.toggle('hidden');
        // Achicar el contenedor del medio para dejar lugar al panel de info
        if (lb) lb.classList.toggle('info-open', willShow);
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
    // El motor de "vignette teleportation" vive en su propio IIFE más abajo;
    // antes estaba duplicado aquí y corría dos veces sobre los mismos elementos.
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

        // Efecto "en vivo": refrescar el valor. Se omite en modo ligero
        // para evitar reflows/repaints constantes.
        let updateTimer = null;
        if (!lite) {
            updateTimer = setInterval(() => {
                if (Math.random() > 0.6) { // 40% chance per second to update
                    span.textContent = currentGen();
                }
            }, 1200);
        }

        // Remove after animation ends
        setTimeout(() => {
            if (updateTimer) clearInterval(updateTimer);
            if (span.parentNode) span.remove();
        }, 13000);
    }

    const lite = window.PERF && window.PERF.lite;
    const SPAWN_MS = lite ? 2000 : 800;
    const SEED_COUNT = lite ? 6 : 20;

    // Solo generar texto mientras la sección está en pantalla, y sembrar
    // el lote inicial la primera vez que se hace visible.
    let spawnTimer = null;
    let seeded = false;
    const start = () => { if (!spawnTimer) spawnTimer = setInterval(spawnText, SPAWN_MS); };
    const stop = () => { if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; } };

    new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            if (!seeded) {
                seeded = true;
                for (let i = 0; i < SEED_COUNT; i++) setTimeout(spawnText, i * 350);
            }
            start();
        } else {
            stop();
        }
    }, { threshold: 0 }).observe(container);
})();

// =============================================
// HUD LIVE STATS UPDATER (Poly, FPS, Angle)
// =============================================
(function initHUDUpdater() {
    const elPoly = document.getElementById('hud-poly');
    const elFps = document.getElementById('hud-fps');
    const elSnap = document.getElementById('hud-snap');
    if (!elPoly) return;

    function tick() {
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
    }

    // Solo actualizar el HUD cuando la sección está en pantalla.
    let timer = null;
    const start = () => { if (!timer) timer = setInterval(tick, 250); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const target = elPoly.closest('section') || elPoly.parentElement;
    new IntersectionObserver((entries) => {
        entries[0].isIntersecting ? start() : stop();
    }, { threshold: 0 }).observe(target);
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
            const shadowOn = window.PERF ? window.PERF.shadowBlur : true;
            ctx.shadowBlur = shadowOn ? 12 : 0; ctx.shadowColor = this.color;
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
                ctx.fillStyle = ctx.strokeStyle = this.color; ctx.shadowBlur = shadowOn ? 15 : 0;
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

    document.querySelectorAll('.obs-video, .decor-video, .about-video').forEach(v => vObserver.observe(v));

    // Las animaciones del feed (.anim-video) se reproducen por hover/tap; aquí
    // solo se PAUSAN al salir de viewport para no seguir corriendo fuera de vista.
    const pauseObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting && !entry.target.paused) entry.target.pause();
        });
    }, { threshold: 0 });
    document.querySelectorAll('.anim-video').forEach(v => pauseObserver.observe(v));
}

// --- STAGGERED INITIALIZATION (Main Thread Optimization) ---
setTimeout(() => { if (typeof createBubbles === 'function') createBubbles(); }, 1500);
setTimeout(() => { initAnimationsBackground(); }, 2500);
// El motor de video solo crea observers (los videos son preload="none" y se
// cargan/reproducen al entrar en viewport), así que puede arrancar pronto.
setTimeout(() => { initVideoAutoplayEngine(); }, 800);


// --- VIGNETTE TELEPORTATION ENGINE ---
// Solo corre el ciclo de aparición/desaparición mientras la sección
// padre está en viewport. Así no hay timers ni style-changes invisibles.
(function initVignetteTeleportation() {
    const vignettes = document.querySelectorAll('.decor-motion');
    if (!vignettes.length) return;

    const SPOTS = [
        { top: '8%',    left: '3%',  right: 'auto', bottom: 'auto' },
        { top: '10%',   right: '4%', left: 'auto',  bottom: 'auto' },
        { top: '42%',   left: '2%',  right: 'auto', bottom: 'auto' },
        { top: '48%',   right: '2%', left: 'auto',  bottom: 'auto' },
        { bottom: '15%',left: '4%',  right: 'auto', top: 'auto'    },
        { bottom: '12%',right: '3%', left: 'auto',  top: 'auto'    }
    ];

    const PEEK_OPACITY = '0.18';
    const VISIBLE_MS  = 3000;
    const CYCLE_MS    = 10000;

    function applySpot(el, idx) {
        const s = SPOTS[idx];
        if (!s) return;
        el.style.top    = s.top;
        el.style.left   = s.left;
        el.style.right  = s.right;
        el.style.bottom = s.bottom;
    }

    function showCycle() {
        const leftPool  = [0, 2, 4];
        const rightPool = [1, 3, 5];
        const nextL = leftPool [Math.floor(Math.random() * leftPool.length)];
        const nextR = rightPool[Math.floor(Math.random() * rightPool.length)];

        if (vignettes[0]) applySpot(vignettes[0], nextL);
        if (vignettes[1]) applySpot(vignettes[1], nextR);

        vignettes.forEach(v => v.style.opacity = PEEK_OPACITY);

        setTimeout(() => {
            vignettes.forEach(v => v.style.opacity = '0');
        }, VISIBLE_MS);
    }

    vignettes.forEach(v => v.style.opacity = '0');

    let cycleTimer = null;
    let firstShow = null;
    function startCycle() {
        if (cycleTimer) return;
        if (!firstShow) firstShow = setTimeout(showCycle, 2500);
        cycleTimer = setInterval(showCycle, CYCLE_MS);
    }
    function stopCycle() {
        if (cycleTimer) { clearInterval(cycleTimer); cycleTimer = null; }
        // Ocultar inmediatamente al salir de viewport
        vignettes.forEach(v => v.style.opacity = '0');
    }

    // Observar la sección que contiene las viñetas
    const section = vignettes[0].closest('section') || vignettes[0].parentElement;
    new IntersectionObserver((entries) => {
        entries[0].isIntersecting ? startCycle() : stopCycle();
    }, { threshold: 0 }).observe(section);
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

    // Ajustes de rendimiento (leídos de window.PERF, con valores por defecto).
    const perf = () => window.PERF || { dprCap: 2, particleScale: 1, shadowBlur: true };
    let shadowOn = perf().shadowBlur;

    function resize() {
        // Tope de DPR: en pantallas retina/4K evita multiplicar los píxeles x4.
        const dpr = Math.min(window.devicePixelRatio || 1, perf().dprCap);
        width = section.offsetWidth;
        height = section.offsetHeight;
        if (width === 0 || height === 0) return;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        // setTransform en vez de scale: resetea la matriz para que el factor
        // DPR NO se acumule en cada resize (bug original que escalaba de más).
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
            if (this.halo && shadowOn) {
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
        const scale = perf().particleScale;
        // Densidad de estrellas escalada por el tier (1 por cada ~6500px²).
        const density = Math.floor((width * height) / 6500);
        const starCount = Math.round(Math.max(150, density) * scale);
        stars = Array.from({ length: starCount }, () => new Star());

        // Núcleos de color, capas de gas y meteoros también escalados.
        nebulaCores = Array.from({ length: Math.max(2, Math.round(4 * scale)) }, () => new NebulaCore());
        gasClouds = Array.from({ length: Math.max(3, Math.round(8 * scale)) }, () => new GasCloud());
        meteors = Array.from({ length: Math.max(2, Math.round(5 * scale)) }, () => new Meteor());
    }

    let rafId = null;
    let running = false;
    function animate() {
        ctx.clearRect(0, 0, width, height);
        nebulaCores.forEach(c => { c.update(); c.draw(); });
        gasClouds.forEach(g => { g.update(); g.draw(); });
        stars.forEach(s => { s.update(); s.draw(); });
        meteors.forEach(m => { m.update(); m.draw(); });
        rafId = requestAnimationFrame(animate);
    }
    function start() { if (!running) { running = true; animate(); } }
    function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; }

    // Ultra-Responsive Tracking
    const observer = new ResizeObserver(() => {
        requestAnimationFrame(() => {
            const currentW = section.offsetWidth;
            const currentH = section.offsetHeight;
            if (currentW !== width || currentH !== height) resize();
        });
    });
    observer.observe(section);

    // Pausar todo el render cuando la galería NO está en pantalla:
    // este bucle era el mayor consumo de CPU/GPU corriendo siempre.
    const visObserver = new IntersectionObserver((entries) => {
        entries[0].isIntersecting ? start() : stop();
    }, { threshold: 0 });
    visObserver.observe(section);

    // Si el monitor de FPS degrada el equipo, reconstruir con menos
    // partículas, sin shadowBlur y con DPR limitado.
    window.addEventListener('perf:downgrade', () => {
        shadowOn = false;
        resize();
    });

    resize();
    // El arranque del bucle lo decide el IntersectionObserver (si ya es
    // visible, dispara start() de inmediato).
})();
