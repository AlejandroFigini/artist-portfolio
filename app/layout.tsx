import type { Metadata } from 'next'
import '@/styles/globals.css'
import Providers from '@/components/ui/Providers'
import DeferredAnalytics from '@/components/ui/DeferredAnalytics'
import { getSiteSettingsServer } from '@/lib/site-server'
import { fontVariables } from '@/lib/fonts'
import { CMS_BOOTSTRAP_ID, getCmsBootstrapServer, serializeCmsBootstrap } from '@/lib/cms-bootstrap-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettingsServer()
  const iconUrl = settings.faviconUrl || '/favicon.ico'
  const appleUrl = settings.appleIconUrl || iconUrl
  return {
    title: 'Lucia Montaña | Portfolio',
    description:
      'Animation, illustration and 3D art portfolio of Lucia Montaña — 2D/3D artist based in Montevideo, Uruguay.',
    icons: {
      icon: iconUrl,
      shortcut: iconUrl,
      apple: appleUrl,
    },
  }
}

// Corre antes del primer paint: tema guardado + tier de performance +
// skip del loader al volver de gestión (portado del <head> legacy).
const BOOT_SCRIPT = `
(function () {
  try {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    if (localStorage.getItem('cms_motion_off_v1') === '1') {
      document.documentElement.classList.add('motion-off');
    }
  } catch (e) {}
  var nav = navigator;
  var mem = nav.deviceMemory || 4, cores = nav.hardwareConcurrency || 4;
  var ua = nav.userAgent || '';
  var mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = nav.connection && nav.connection.saveData;
  var lite = !!(reduced || saveData || mem <= 2 || cores <= 2 || mobile);
  window.PERF = {
    lite: lite, tier: lite ? 'lite' : 'full',
    dprCap: lite ? 1 : 2, particleScale: lite ? 0.45 : 1,
    shadowBlur: !lite, reduced: reduced,
    downgrade: function () {
      if (this.lite) return;
      this.lite = true; this.tier = 'lite';
      this.dprCap = 1; this.particleScale = 0.45; this.shadowBlur = false;
      var r = document.documentElement;
      r.classList.remove('perf-full');
      r.classList.add('perf-lite');
      window.dispatchEvent(new CustomEvent('perf:downgrade'));
    }
  };
  document.documentElement.classList.add(lite ? 'perf-lite' : 'perf-full');
  // Estado previo de los reveals mientras baja el chunk de GSAP (styles/motion-pending.css).
  // Solo si va a haber coreografía: con reduced-motion o la pausa activa el
  // contenido tiene que verse entero desde el primer paint.
  var motionOff = document.documentElement.classList.contains('motion-off');
  if (!reduced && !motionOff) document.documentElement.classList.add('motion-pending');
  /* La pantalla de carga se muestra en TODA carga del index. El único salto es
     volver desde gestión, y ese flag se lee y se BORRA acá mismo: si lo
     consumiera React más tarde, cualquier camino que corte antes lo dejaría
     vivo y se saltaría también la carga siguiente.
     'lm_seen_loader' era el "una vez por sesión" que hacía que recargar no
     mostrara nada; se limpia para que las sesiones abiertas se curen solas. */
  var skipLoader = false;
  try {
    skipLoader = sessionStorage.getItem('cms_skip_loader') === '1';
    sessionStorage.removeItem('cms_skip_loader');
    sessionStorage.removeItem('lm_seen_loader');
  } catch (e) {}
  if (skipLoader) document.documentElement.classList.add('skip-loader');
  var showLoader = !skipLoader && location.pathname === '/';
  if (showLoader) {
    document.documentElement.classList.add('loading-active');
    document.body.classList.add('loading-active');
  }
  /* Momento REAL en que la pantalla de carga quedó pintada. Se mide acá y no
     en el componente porque el loader sale en el HTML del server y se pinta en
     el FCP, mucho antes de que React hidrate: medir desde el montaje le sumaba
     al piso configurable todo el tiempo de hidratación (~3.8s en 4G lento), y
     por eso la duración de Gestión no se respetaba nunca en móvil.
     El doble rAF garantiza que el frame ya se compuso. El presupuesto de
     frames es un tope de reintentos del sondeo, NO un techo de cierre: si se
     agota, el consumidor cae a su propio fallback y el loader sigue arriba. */
  window.__loaderPaintedAt = 0;
  if (showLoader) {
    var frames = 0;
    var probe = function () {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (document.getElementById('page-loader')) window.__loaderPaintedAt = performance.now();
          else if (++frames < 120) probe();
        });
      });
    };
    probe();
  }
})();
`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [initialSettings, cmsBootstrap] = await Promise.all([
    getSiteSettingsServer(),
    getCmsBootstrapServer(),
  ])
  return (
    <html lang="en" className={fontVariables} data-theme="light" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="preconnect" href="https://res.cloudinary.com" />
        {/* Única variante de Font Awesome que aparece en el primer viewport
            (nav, hero, overlays de contenedor vacío). Con `font-display: swap`
            en styles/icons.css, precargarla evita el paso por el glifo vacío. */}
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/fa-solid-900-subset.woff2"
          crossOrigin="anonymous"
        />
        {/* Font Awesome ya no viene de CDN: styles/icons.css sirve un subset
            propio con los ~128 iconos que usamos (278 KB → 14 KB).
            Las cuatro familias de texto tampoco: las self-hostea next/font
            (ver lib/fonts.ts) y se consumen por variable CSS. */}
      </head>
      <body suppressHydrationWarning>
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `<script>${BOOT_SCRIPT}</script>` }} style={{ display: 'none' }} />
        {/* Contenido del CMS embebido: el arranque lo lee de acá en vez de
            encadenar /api/content → /api/translations después de hidratar.
            Es JSON inerte (type="application/json"), no se ejecuta. */}
        <script
          id={CMS_BOOTSTRAP_ID}
          type="application/json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: serializeCmsBootstrap(cmsBootstrap) }}
        />
        <Providers initialSettings={initialSettings} initialContent={cmsBootstrap}>{children}</Providers>
        <DeferredAnalytics gaId="G-SPJEZ45JR0" />
      </body>
    </html>
  )
}
