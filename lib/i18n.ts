/* Constantes y helpers de internacionalización compartidos cliente/servidor.
   Modelo: el contenido base (es) vive en cms_data (lo edita el admin); las
   traducciones (en/pt/fr) viven en cms_translations. Flujo admin-driven:
   exportar base → traducir con Claude → importar JSON → guardar en BD. */

export const BASE_LANG = 'en' as const
export const TARGET_LANGS = ['es', 'pt', 'fr'] as const
export const ALL_LANGS = [BASE_LANG, ...TARGET_LANGS] as const

export type Lang = (typeof ALL_LANGS)[number]

export const LANG_META: Record<Lang, { flag: string; label: string }> = {
  en: { flag: 'us', label: 'English' },
  es: { flag: 'es', label: 'Español' },
  pt: { flag: 'pt', label: 'Português' },
  fr: { flag: 'fr', label: 'Français' },
}

/** Un valor es media (no traducible) si es una URL, ruta absoluta o data URL. */
export function isMediaValue(v: string): boolean {
  return /^(https?:\/\/|\/|data:)/.test(v.trim())
}

/** Una entrada de cms_data es texto traducible si su valor es prosa
    (no media/URL), no es configuración JSON (claves *.settings del carrusel)
    ni un ajuste global del sitio (claves settings.* — loader, cv, etc.). */
export function isTranslatableEntry(key: string, value: string): boolean {
  if (!value || !value.trim()) return false
  if (key.endsWith('.settings')) return false
  if (key.startsWith('settings.')) return false
  return !isMediaValue(value)
}

export const UI_TRANSLATIONS: Record<string, Record<Lang, string>> = {
  // Nav links
  nav_feed: { en: 'Feed', es: 'Feed', pt: 'Feed', fr: 'Flux' },
  nav_gallery: { en: 'Gallery', es: 'Galería', pt: 'Galeria', fr: 'Galerie' },
  nav_illustrations: { en: 'Illustrations', es: 'Ilustraciones', pt: 'Ilustrações', fr: 'Illustrations' },
  nav_animations: { en: 'Animations', es: 'Animaciones', pt: 'Animações', fr: 'Animations' },
  nav_characters: { en: 'Characters', es: 'Personajes', pt: 'Personagens', fr: 'Personnages' },
  nav_3d: { en: '3D Models', es: 'Modelos 3D', pt: 'Modelos 3D', fr: 'Modèles 3D' },
  nav_multimedia: { en: 'Multimedia', es: 'Multimedia', pt: 'Multimídia', fr: 'Multimédia' },
  nav_portfolio: { en: 'Portfolio', es: 'Portfolio', pt: 'Portfólio', fr: 'Portfolio' },
  nav_about: { en: 'About me', es: 'Sobre mí', pt: 'Sobre mim', fr: 'À propos' },
  nav_contact: { en: 'Contact', es: 'Contacto', pt: 'Contato', fr: 'Contact' },

  // Footer
  footer_exploration: { en: 'Exploration', es: 'Exploración', pt: 'Exploração', fr: 'Exploration' },
  footer_connect: { en: 'Connect', es: 'Conectar', pt: 'Conectar', fr: 'Contact' },
  footer_role: { en: "Bachelor's Degree in Animation & Video Games", es: 'Licenciatura en Animación y Videojuegos', pt: 'Bacharelado em Animação e Videogames', fr: 'Licence en Animation et Jeux Vidéo' },
  footer_rights: { en: 'All rights reserved', es: 'Todos los derechos reservados', pt: 'Todos os direitos reservados', fr: 'Tous droits réservés' },
  footer_no_repost: { en: 'Please do not repost my work without authorization', es: 'Por favor no republique mi trabajo sin autorización', pt: 'Por favor, não reposte meu trabalho sem autorização', fr: 'Veuillez ne pas republier mon travail sans autorisation' },

  // General UI & Showcases
  cv: { en: 'CV', es: 'CV', pt: 'CV', fr: 'CV' },
  download_cv: { en: 'Download CV', es: 'Descargar CV', pt: 'Baixar CV', fr: 'Télécharger CV' },
  no_image: { en: 'No image', es: 'Sin imagen', pt: 'Sem imagem', fr: "Pas d'image" },
  software: { en: 'Software', es: 'Software', pt: 'Software', fr: 'Logiciel' },
  all: { en: 'All', es: 'Todos', pt: 'Todos', fr: 'Tous' },
  view_more: { en: 'View more', es: 'Ver más', pt: 'Ver mais', fr: 'Voir plus' },
  read_more: { en: 'Read more', es: 'Leer más', pt: 'Leia mais', fr: 'Lire la suite' },
  close: { en: 'Close', es: 'Cerrar', pt: 'Fechar', fr: 'Fermer' },
  previous: { en: 'Previous', es: 'Anterior', pt: 'Anterior', fr: 'Précédent' },
  next: { en: 'Next', es: 'Siguiente', pt: 'Próximo', fr: 'Suivant' },

  // About Page static texts
  ab_file_00: { en: 'FILE 00 — ABOUT / LUCÍA MONTAÑA', es: 'ARCHIVO 00 — SOBRE MÍ / LUCÍA MONTAÑA', pt: 'ARQUIVO 00 — SOBRE MIM / LUCÍA MONTAÑA', fr: 'FICHIER 00 — À PROPOS / LUCÍA MONTAÑA' },
  ab_generalist: { en: '3D Generalist', es: 'Generalista 3D', pt: 'Generalista 3D', fr: 'Généraliste 3D' },
  ab_available: { en: 'Available for projects', es: 'Disponible para proyectos', pt: 'Disponível para projetos', fr: 'Disponible pour des projets' },
  ab_fig_01: { en: 'FIG. 01 — Subject', es: 'FIG. 01 — Sujeto', pt: 'FIG. 01 — Sujeito', fr: 'FIG. 01 — Sujet' },
  ab_bio_title: { en: '// Biography', es: '// Biografía', pt: '// Biografia', fr: '// Biographie' },
  ab_toolkit_title: { en: '// Toolkit', es: '// Herramientas', pt: '// Ferramentas', fr: '// Outils' },
  ab_toolkit_h2: { en: 'Day-to-day Software', es: 'Software diario', pt: 'Software do dia a dia', fr: 'Logiciels au quotidien' },
  ab_timeline_title: { en: '// Career Timeline', es: '// Trayectoria', pt: '// Trajetória', fr: '// Parcours' },
  ab_timeline_h2: { en: 'Where I come from', es: 'De dónde vengo', pt: 'De onde venho', fr: "D'où je viens" },
  ab_contact_title: { en: '// Contact', es: '// Contacto', pt: '// Contato', fr: '// Contact' },
  ab_contact_h2: { en: "Let's work <em>together</em>.", es: 'Trabajemos <em>juntos</em>.', pt: 'Vamos trabalhar <em>juntos</em>.', fr: 'Travaillons <em>ensemble</em>.' },
  ab_get_in_touch: { en: 'Get in touch', es: 'Escribirme', pt: 'Entrar em contato', fr: 'Me contacter' },

  // Specs & Timeline
  spec_role_k: { en: 'ROLE', es: 'ROL', pt: 'PAPEL', fr: 'RÔLE' },
  spec_role_v: { en: '3D Generalist & Animator', es: 'Generalista 3D y Animadora', pt: 'Generalista 3D e Animadora', fr: 'Généraliste 3D et Animatrice' },
  spec_base_k: { en: 'BASE', es: 'BASE', pt: 'BASE', fr: 'BASE' },
  spec_base_v: { en: 'Montevideo · GMT-3', es: 'Montevideo · GMT-3', pt: 'Montevideo · GMT-3', fr: 'Montevideo · GMT-3' },
  spec_practice_k: { en: 'PRACTICE', es: 'EXPERIENCIA', pt: 'EXPERIÊNCIA', fr: 'EXPÉRIENCE' },
  spec_practice_v: { en: 'Freelance, est. 2019', es: 'Freelance, est. 2019', pt: 'Freelance, est. 2019', fr: 'Freelance, est. 2019' },
  spec_edu_k: { en: 'EDUCATION', es: 'EDUCACIÓN', pt: 'EDUCAÇÃO', fr: 'ÉDUCATION' },
  spec_edu_v: { en: 'B.A. Animation', es: 'Lic. en Animación', pt: 'Lic. em Animação', fr: 'Licence Animation' },

  tl_2024_role: { en: 'Senior 3D Generalist', es: 'Generalista 3D Senior', pt: 'Generalista 3D Sênior', fr: 'Généraliste 3D Senior' },
  tl_2024_desc: { en: 'Character direction and lookdev for animated short films and commercial pieces.', es: 'Dirección de personajes y lookdev para cortometrajes animados y piezas comerciales.', pt: 'Direção de personagens e lookdev para curtas de animação e peças comerciais.', fr: "Direction de personnages et lookdev pour des courts métrages d'animation et des publicités." },
  tl_2022_role: { en: '3D Artist & Animator', es: 'Artista 3D y Animadora', pt: 'Artista 3D e Animadora', fr: 'Artiste 3D et Animatrice' },
  tl_2022_desc: { en: 'Modeling, rigging, and animation pipeline for game art and motion projects.', es: 'Pipeline de modelado, rigging y animación para arte de videojuegos y proyectos de motion.', pt: 'Pipeline de modelagem, rigging e animação para arte de jogos e projetos de motion.', fr: 'Pipeline de modélisation, rigging et animation pour des projets de jeux vidéo et motion.' },
  tl_2019_role: { en: 'Freelance Start', es: 'Inicio Freelance', pt: 'Início Freelance', fr: 'Début en Freelance' },
  tl_2019_desc: { en: 'Early illustration and 3D modeling commissions combining traditional techniques and digital pipeline.', es: 'Primeros encargos de ilustración y modelado 3D combinando técnicas tradicionales y pipeline digital.', pt: 'Primeiras encomendas de ilustração e modelagem 3D combinando técnicas tradicionais e pipeline digital.', fr: "Premières commandes d'illustration et de modélisation 3D combinant techniques traditionnelles et pipeline numérique." },
  tl_2017_role: { en: 'B.A. in Animation', es: 'Lic. en Animación', pt: 'Lic. em Animação', fr: 'Licence en Animation' },
  tl_2017_desc: { en: 'Foundation in animation, visual storytelling, and cinematic language.', es: 'Formación en animación, narrativa visual y lenguaje cinematográfico.', pt: 'Formação em animação, narrativa visual e linguagem cinematográfica.', fr: 'Formation en animation, narration visuelle et langage cinématographique.' },
}

/** Aplica traducciones automáticas en código a los elementos estáticos (no editables) de la página. */
export function applyStaticTranslations(lang: Lang) {
  if (typeof document === 'undefined') return

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n')
    if (!key || !UI_TRANSLATIONS[key]) return
    const text = UI_TRANSLATIONS[key][lang] || UI_TRANSLATIONS[key].en
    if (!text) return
    if (text.includes('<') && text.includes('>')) {
      el.innerHTML = text
    } else {
      el.textContent = text
    }
  })

  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title')
    if (key && UI_TRANSLATIONS[key]) {
      const text = UI_TRANSLATIONS[key][lang] || UI_TRANSLATIONS[key].en
      if (text) el.setAttribute('title', text)
    }
  })

  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria')
    if (key && UI_TRANSLATIONS[key]) {
      const text = UI_TRANSLATIONS[key][lang] || UI_TRANSLATIONS[key].en
      if (text) el.setAttribute('aria-label', text)
    }
  })
}

