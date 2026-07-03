import type { Metadata } from 'next'
import Script from 'next/script'
import '@/styles/globals.css'
import Providers from '@/components/ui/Providers'

export const metadata: Metadata = {
  title: 'Lucia Montaña | Portfolio',
  description:
    'Animation, illustration and 3D art portfolio of Lucia Montaña — 2D/3D artist based in Montevideo, Uruguay.',
}

// Corre antes del primer paint: tema guardado + tier de performance +
// skip del loader al volver de gestión (portado del <head> legacy).
const BOOT_SCRIPT = `
(function () {
  try {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    // "Pausar animaciones" persistido: la clase debe existir ANTES de que
    // monten las secciones (sus setups GSAP la chequean vía prefersReducedMotion).
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
  var skipLoader = false;
  try {
    skipLoader = sessionStorage.getItem('cms_skip_loader') === '1' || sessionStorage.getItem('lm_seen_loader') === '1';
  } catch (e) {}
  if (skipLoader) document.documentElement.classList.add('skip-loader');
  // Solo el index tiene pantalla de carga; bloquear scroll antes del paint.
  if (!skipLoader && location.pathname === '/') document.body.classList.add('loading-active');
  try {
    var ov = JSON.parse(localStorage.getItem('cms_overrides_v1') || '{}');
    var fav = ov['settings.faviconUrl'];
    if (fav) {
      var links = document.querySelectorAll('link[rel*="icon"]');
      for (var i = 0; i < links.length; i++) links[i].parentNode.removeChild(links[i]);
      var l = document.createElement('link');
      l.rel = 'icon'; l.href = fav; document.head.appendChild(l);
      var s = document.createElement('link');
      s.rel = 'shortcut icon'; s.href = fav; document.head.appendChild(s);
    }
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `<script>${BOOT_SCRIPT}</script>` }} style={{ display: 'none' }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          precedence="default"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&family=Plus+Jakarta+Sans:wght@200..800&family=Syne:wght@400..800&family=Inter:wght@100;200;300;400;700;800&family=Raleway:wght@100;200;300;400;500;600&family=Fira+Code:wght@400;500&display=swap"
        />
        <link
          rel="stylesheet"
          precedence="default"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"
        />
        <link
          rel="stylesheet"
          precedence="default"
          href="https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/css/flag-icons.min.css"
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
