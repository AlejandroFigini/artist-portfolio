import type { Metadata } from 'next'
import { GoogleAnalytics } from '@next/third-parties/google'
import '@/styles/globals.css'
import Providers from '@/components/ui/Providers'
import { getSiteSettingsServer } from '@/lib/site-server'

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
  var skipLoader = false;
  try {
    skipLoader = sessionStorage.getItem('cms_skip_loader') === '1' || sessionStorage.getItem('lm_seen_loader') === '1';
  } catch (e) {}
  if (skipLoader) document.documentElement.classList.add('skip-loader');
  if (!skipLoader && location.pathname === '/') document.body.classList.add('loading-active');
})();
`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialSettings = await getSiteSettingsServer()
  return (
    <html lang="en" data-theme="light" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="preconnect" href="https://res.cloudinary.com" />
        {/* Font Awesome ya no viene de CDN: styles/icons.css sirve un subset
            propio con los ~128 iconos que usamos (278 KB → 14 KB). */}
        {/* Solo las familias y pesos que el sitio realmente pinta:
            Plus Jakarta Sans (--font/--font-display), Raleway 300/400/500/600,
            Fira Code 400/500 (cotas blueprint) e Inter 400/800 (.soft-badge y
            .cms-mlib-meta). Cormorant Garamond y Syne no se usaban en ninguna
            regla — Syne solo aparecía como fallback de var(--font-display),
            que siempre está definido, así que nunca llegaba a aplicarse. */}
        {/* La regla apunta a pages/_document.js del Pages Router. Acá el
            layout raíz ES el documento, así que la hoja aplica a todo el sitio
            y la advertencia no corresponde. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200..800&family=Raleway:wght@300;400;500;600&family=Inter:wght@400;800&family=Fira+Code:wght@400;500&display=swap"
        />
      </head>
      <body suppressHydrationWarning>
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `<script>${BOOT_SCRIPT}</script>` }} style={{ display: 'none' }} />
        <Providers initialSettings={initialSettings}>{children}</Providers>
        <GoogleAnalytics gaId="G-SPJEZ45JR0" />
      </body>
    </html>
  )
}
