# Handoff — Artist Portfolio (Lucia Montaña)
_2026-06-10_

---

## Goal

Migrar el proyecto completo de vanilla HTML/CSS/JS a **Next.js 15 (App Router) + Tailwind CSS v4 + TypeScript**, manteniendo intacta la estética blueprint cinematic y el backend Express existente.

El resultado final es un portfolio moderno, escalable, con animaciones complejas, CMS funcional y panel admin con 2FA — todo en el nuevo stack.

---

## Current state of the code

- **Frontend:** vanilla HTML/CSS/JS — funcional pero no escalable. GSAP para cursor, starfield, wave marquee y animaciones de galería.
- **Backend:** Express + PostgreSQL + Cloudinary + 2FA (`otplib`) — estable, no se toca.
- **Dev server:** Vite (reemplazó live-server, 0 vulnerabilidades).
- **CLAUDE.md:** configurado con reglas de comportamiento, stack objetivo, sistema de bloques y parámetros de diseño.
- **Knowledge graph:** `graphify-out/graph.json` — 362 nodos, 646 edges, grafo del proyecto actual listo para consultas.
- **Framer Motion + GSAP:** ambos instalados (`package.json`).
- **gstack + graphify hooks:** instalados y activos.

---

## Files actively editing

**Sesión 1 COMPLETADA (2026-06-10)** — proyecto Next.js creado en `../artist-portfolio-next/` (Next 16.2.9 + Tailwind v4 + TS, App Router). Build y lint limpios, 7 rutas estáticas.

Qué se hizo:
```
index.html              → app/page.tsx + components/home/* (Hero, WaveMarquee, About,
                          AnimationsShowcase, CharactersShowcase, Models3DSection,
                          IllustrationsSection, ScrollReveal)
style.css (+5 css pág.) → styles/legacy/*.css verbatim (paridad visual exacta),
                          importados desde styles/globals.css (Tailwind sin preflight)
shared-ui.js            → components/ui/{Nav,Footer,SettingsPanel,Lightboxes}.tsx
gallery-common.js       → components/gallery/GalleryToolbar.tsx + hooks/useReveal.ts
5 páginas de galería    → app/{animations,characters,illustrations,models-3d,multimedia}/page.tsx
                          + components/gallery/*Gallery.tsx (filtros/roster/dots funcionales)
loader + boot scripts   → components/ui/PageLoader.tsx + BOOT_SCRIPT en app/layout.tsx
```

Decisiones Sesión 1:
- Next 16.2.9 (latest de create-next-app; plan decía 15 — App Router idéntico)
- CSS legacy copiado verbatim, NO reescrito a utilities (identidad blueprint intacta);
  Tailwind queda para componentes nuevos
- Preflight de Tailwind omitido a propósito (el CSS legacy asume defaults del browser)
- Dev server: `.claude/launch.json` config "next" (npm --prefix, puerto 3000)
- Dark mode legacy NO swapea --bg-primary (selector `:root, [data-theme=dark]` comparte
  vars; el dark son overrides por componente) — el port replica eso, no es bug

---

## Everything tried that failed (o no se completó)

- **`./setup --team` de gstack:** Playwright Chromium encontró lockfile activo (`C:\Users\figin\AppData\Local\ms-playwright\__dirlock`). Skill docs `.agents/skills/gstack-*.md` sí se generaron. Fix manual: `Remove-Item "C:\Users\figin\AppData\Local\ms-playwright\__dirlock" -Recurse -Force` → `npx playwright install chromium`.
- **`ruflo init wizard`:** requiere input interactivo (arrow keys) — no ejecutable desde Claude Code. Correr directo en terminal.
- **Extracción semántica full corpus:** 3624 archivos (3501 son `.agent/` gstack docs). Reducido a 39 archivos raíz para el knowledge graph.

---

## Next step

**Sesión 2 COMPLETADA (2026-06-11)** — GSAP + cursor + animaciones migradas. Build y lint limpios.

Qué se hizo (Sesión 2):
```
hooks/useGSAP.ts            ← wrapper gsap.context + cleanup + reduced-motion
hooks/useDragScroll.ts      ← dragScroll de gallery-common.js
hooks/useTilt.ts            ← tilt 3D de gallery-common.js
lib/media.ts                ← realMedia()
lib/perf.ts                 ← tipado de window.PERF (boot script)
components/ui/Cursor.tsx    ← cursor GSAP (quickTo + expand, delegación)
components/ui/LiveClock.tsx ← reloj MVD (en portrait-stamp del About)
components/ui/lightbox.ts   ← open/close/toggle lightbox (port script.js)
components/home/Slideshow.tsx     ← crossfade GSAP del hero carousel
components/home/HomeFx.tsx        ← reveals + typewriter + section-inactive + video autoplay
components/home/AnimBlobCanvas.tsx / NebulaCanvas.tsx ← canvases portados
AboutSection: ScrollTrigger reveals + tilt/glare bezels
AnimationsShowcase: hover-play + controles + doble-tap táctil + viñetas
Models3DSection: HUD vivo + texto 3D random + split móvil React-friendly
Galerías: stagger/tilt/lightbox + spotlight autorotate + modes 3D + orbit-drag cubo
```

Verificado headless: spotlight rota, lightbox abre/cierra con lock de scroll, modes
wire/clay/render, orbit-drag (math exacta), thumbs+read-more characters, reloj tickea.
**Pendiente verificación visual** (preview corrió con tab hidden → rAF/IO muertos):
cursor follow, crossfade hero, typewriter, canvases, HUD — ports directos, abrir
localhost:3000 con ventana visible y recorrer el index.

Notas:
- Slideshow con progress bar + dots (interactions.js) apunta a markup del hero CMS
  (.slide/#slide-progress-bar) que no existe en el index actual → Sesión 3 con cms.js.
- initHeroEntrance (interactions.js) apunta a .title-serif/.hero-gallery-frame —
  markup viejo inexistente; no se portó (no-op en legacy también).
- createBubbles() era no-op (#bubbles-container no existe) — no se portó.
- syncWaveGroups (MutationObserver CMS) + enhanceImages (.img-loaded) + masonry
  de ilustraciones → Sesión 3 (dependen del CMS).

**Sesión 3 COMPLETADA (2026-06-12)** — CMS + Admin + conexión backend. Build y lint
limpios, 8 rutas + proxy. MIGRACIÓN COMPLETA (3/3 sesiones).

Qué se hizo (Sesión 3, en el orden del grafo):
```
lib/utils.ts                ← fmtBytes/fmtDate/fmtDateOnly/fmtTimeOnly/isVideo (de-dup cms+admin)
hooks/useKeyHandler.ts      ← reemplaza esc() de admin.js
components/ui/Toast.tsx     ← parte "notificación" del toast()
components/ui/Modal.tsx     ← UN sistema (CmsModal declarativo + useModal imperativo)
lib/commands.tsx            ← CommandContext (la parte command-bus del toast())
lib/api.ts + next.config.ts ← cliente del Express + rewrite /api/* → :3001
lib/cms/store.ts            ← estado compartido sitio/admin (mismas claves LS legacy)
                              + ops admin (restore/associate/rename/trash) + useSyncExternalStore
lib/media.ts                ← validateFile/fileToDataURL (validación MIME+25MB en boundary)
components/cms/engine.ts    ← motor DOM: REGISTRY (selectores adaptados al markup Next),
                              index/hydrate/applyMedia/seed/retired/tools/syncWaveGroups
components/cms/*            ← CmsRoot (orquestador+portal auth+file input) y modales React:
                              Login (2FA 2 fases), Upload (Cloudinary), ContentPicker (rename
                              inline), RepoPicker, EditText/EditInfo/ConfirmMove/Export,
                              CarouselManager, AuditOverlay, AddIllustration
components/admin/*          ← dashboard /admin completo (Resumen, En uso/Sin usar/Repo/
                              Basurero con multi-select+lotes, Subir, Usuarios, Auditoría,
                              Ajustes) + vista previa + asociar/renombrar/restaurar
proxy.ts                    ← gate de /admin por cookie (middleware deprecado en Next 16)
app/(site)/ route group     ← /admin con layout propio (sin Nav/Footer del sitio)
SettingsPanel               ← motion-off + hide-cms cableados (IIFE finales de cms.js)
Slideshow                   ← CMS-aware (evento cms:hero: slides + duración del backend)
```

Verificado E2E (Express real en :3001, npm `$env:PORT='3001'; node server.js`):
login 2FA con TOTP real ✓ → cookie + chip + 89 toolbars + 3 slots + tuerca carrusel ✓;
editText/ContentPicker/RepoPicker (45 entradas del seed) ✓; /admin: resumen con stats
reales (58 usados, 776.5 KB), 6 grupos, multi-select + batch bar, vista previa, repo
con filtro ✓; logout limpia todo ✓; /admin sin cookie → redirect / (proxy) ✓.

NO verificado (requiere credenciales/datos):
- Subida Cloudinary E2E (sin credenciales en el entorno; flujo portado y cableado)
- Hidratación con contenido real (sin DATABASE_URL no hay items; hydrate() cableado)

Notas Sesión 3:
- La cookie cms_admin es gate de CONVENIENCIA (paridad con el flag localStorage del
  prototipo). Seguridad real = sesiones server-side en el Express (pendiente backend).
- admin NO postea a /api/content (paridad legacy): sus cambios van a LS_OVERRIDES y
  el server pisa local en el merge del init. Mismo comportamiento que el original.
- i18n runtime (translations de script.js) NO portado — única pieza legacy restante.
  El selector de idioma cambia bandera/sigla pero no re-traduce textos (data-i18n
  attrs ya están en el markup, listos).

**Leer antes de empezar:**
1. `docs/migration-react-nextjs.md` — plan + correcciones críticas
2. `graphify-out/GRAPH_REPORT.md` — arquitectura actual
3. `CLAUDE.md` — reglas, sistema de bloques, stack objetivo

---

## Advertencias críticas (descubiertas por análisis de grafo)

- `toast()` en `cms.js:L457` es un command bus, no notificación → necesita `CommandContext` antes de migrar CMS/Admin
- `fmtBytes()` + `fmtDate()` duplicadas en `cms.js` y `admin.js` → extraer a `lib/utils.ts` primero
- Dos sistemas de modal paralelos (cms.js / admin.js) → unificar en `<ModalProvider>` antes de Sesión 3
- `esc()` (admin.js:L28) llamada desde `editMedia()` (cms.js) → extraer a `hooks/useKeyHandler.ts`

Orden correcto Sesión 3:
```
1. lib/utils.ts              ← fmtBytes, fmtDate, isVideo
2. hooks/useKeyHandler.ts    ← reemplaza esc()
3. components/ui/Modal.tsx   ← unifica los dos sistemas de modal
4. lib/commands.ts           ← reemplaza toast() como CommandContext
5. hooks/useMediaPersist.ts  ← unifica persist* del CMS
6. components/cms/           ← migración limpia
7. app/admin/page.tsx        ← migración limpia
```
