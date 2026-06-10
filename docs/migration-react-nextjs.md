# Migración a React / Next.js + Tailwind
**Proyecto:** Lucia Montaña — Artist Portfolio  
**Stack actual:** Vanilla HTML/CSS/JS + Express + PostgreSQL + Cloudinary + GSAP  
**Stack destino:** Next.js 15 (App Router) + Tailwind CSS v4 + GSAP + Express (mantener backend)  
**Estimado con Claude:** 2-3 sesiones (~4-6 horas)

---

## Contexto del proyecto actual

```
artist-portfolio/
├── index.html              ← página de inicio (hero + wave marquee + burbujas)
├── animations.html         ← galería de animaciones
├── characters.html         ← galería de personajes
├── illustrations.html      ← galería de ilustraciones
├── models-3d.html          ← galería de modelos 3D
├── multimedia.html         ← galería de multimedia
├── admin.html              ← panel de admin con 2FA
├── script.js               ← JS principal del index
├── style.css               ← estilos globales
├── animations.css/page.js  ← estilos y lógica por página (patrón repetido x5)
├── characters.css/page.js
├── illustrations.css/page.js
├── models-3d.css/page.js
├── multimedia.css/page.js
├── gallery-common.css/js   ← componentes compartidos de galería
├── shared-ui.js            ← header, nav, componentes reutilizables
├── cms.js                  ← lógica del CMS
├── admin.js                ← lógica del panel admin
├── server.js               ← Express + rutas API
├── content.json            ← contenido editable
└── init.sql                ← esquema PostgreSQL
```

### Stack actual detallado
- **Backend:** Node.js + Express, PostgreSQL (`pg`), Cloudinary, 2FA con `otplib` + `qrcode`
- **Frontend:** HTML/CSS/JS puro, GSAP (animaciones + cursor custom), sin framework
- **Dev:** Vite (`npm run dev`), Playwright para tests
- **Estética:** Blueprint cinematic — cuadrícula, cursor custom, esquinas de viewport, wave marquee con burbujas

---

## Estrategia de migración

### Principio: backend no se toca
El servidor Express (`server.js`) con PostgreSQL y Cloudinary se mantiene igual.  
Next.js consume la API de Express — no migrar a API Routes de Next.js.

### Estructura destino

```
artist-portfolio-next/
├── app/
│   ├── layout.tsx           ← layout global (cursor, nav, estilos base)
│   ├── page.tsx             ← index (hero + wave marquee)
│   ├── animations/page.tsx
│   ├── characters/page.tsx
│   ├── illustrations/page.tsx
│   ├── models-3d/page.tsx
│   ├── multimedia/page.tsx
│   └── admin/page.tsx
├── components/
│   ├── ui/                  ← componentes base (Cursor, Nav, Footer)
│   ├── gallery/             ← GalleryGrid, GalleryCard (de gallery-common)
│   ├── home/                ← Hero, WaveMarquee, Bubbles
│   └── admin/               ← AdminPanel, TwoFAForm
├── hooks/
│   ├── useGSAP.ts           ← wrapper de GSAP para React
│   └── useCMS.ts            ← fetch al backend Express
├── lib/
│   └── api.ts               ← cliente HTTP para Express API
└── styles/
    └── globals.css          ← Tailwind + variables CSS blueprint
```

---

## Plan de ejecución por sesiones

### Sesión 1 — Scaffolding + páginas estáticas (2h)

**Prompt para Claude:**
> "Ejecuta la Sesión 1 del plan de migración en `docs/migration-react-nextjs.md`. El proyecto actual está en esta carpeta. Crea el proyecto Next.js en una carpeta nueva llamada `artist-portfolio-next/` al mismo nivel. No toques los archivos originales."

**Tareas:**
1. `npx create-next-app@latest artist-portfolio-next --typescript --tailwind --app --no-src-dir`
2. Migrar `style.css` → `globals.css` con variables CSS blueprint (mantener identidad visual exacta)
3. Migrar `shared-ui.js` → `components/ui/Nav.tsx` y `components/ui/Footer.tsx`
4. Migrar las 5 páginas de galería (animations, characters, illustrations, models-3d, multimedia) → páginas Next.js con Tailwind
5. Migrar `gallery-common.css/js` → `components/gallery/GalleryGrid.tsx` y `GalleryCard.tsx`
6. Migrar `index.html` → `app/page.tsx` (hero + wave marquee + burbujas)

**Verificación:** `npm run dev` en `artist-portfolio-next/` — todas las páginas renderizan visualmente igual

---

### Sesión 2 — GSAP + cursor + animaciones (1.5h)

**Prompt para Claude:**
> "Ejecuta la Sesión 2 del plan de migración en `docs/migration-react-nextjs.md`. El proyecto Next.js está en `artist-portfolio-next/`. El objetivo es migrar todas las animaciones GSAP y el cursor custom."

**Tareas:**
1. Instalar `gsap` en el proyecto Next.js
2. Crear `hooks/useGSAP.ts` — wrapper que maneja `useEffect` + cleanup para GSAP
3. Migrar cursor custom de `script.js` → `components/ui/Cursor.tsx`
4. Migrar wave marquee + burbujas → `components/home/WaveMarquee.tsx`
5. Migrar slideshow progress tracker → `components/home/Slideshow.tsx`
6. Migrar animaciones de cada página gallery desde sus `.page.js`
7. Migrar esquinas de viewport y blueprint grid → `components/ui/BlueprintOverlay.tsx`
8. Migrar reloj en vivo → `components/ui/LiveClock.tsx`

**Verificación:** cursor funciona, wave marquee anima, slideshow tiene tracker, blueprint grid visible

---

### Sesión 3 — CMS + Admin + conexión backend (1.5h)

**Prompt para Claude:**
> "Ejecuta la Sesión 3 del plan de migración en `docs/migration-react-nextjs.md`. El proyecto Next.js está en `artist-portfolio-next/`. El servidor Express corre en puerto 3001. Conectar el frontend al backend existente."

**Tareas:**
1. Crear `lib/api.ts` — cliente fetch apuntando al Express en `localhost:3001`
2. Crear `hooks/useCMS.ts` — fetch de contenido con SWR o React Query
3. Migrar `cms.js` → componentes React que consumen `lib/api.ts`
4. Migrar `admin.html` + `admin.js` → `app/admin/page.tsx` con autenticación 2FA
5. Proteger la ruta `/admin` con middleware de Next.js
6. Migrar Cloudinary upload flow al nuevo frontend
7. Migrar íconos del stack (3DS Max, Photoshop SVGs) como componentes

**Verificación:** 
- CMS carga contenido desde Express
- Admin login con 2FA funciona
- Subida de imágenes a Cloudinary funciona
- Galería muestra imágenes reales

---

## Correcciones críticas (halladas por análisis de grafo de conocimiento)

> Estas correcciones surgieron del análisis estático del código actual. Si no se aplican en el orden correcto, la Sesión 3 fallará silenciosamente.

### 1. `toast()` no es un toast — es un command bus

`toast()` en `cms.js:L457` llama a **13 funciones**: `editMedia()`, `doLogin()`, `renderAuth()`, `openAuditPage()`, `openCarouselManager()`, `openExport()`, `openRepoPicker()`, `openAddIllustration()`, `editInfoPage()`, `editText()`, `confirmMovePage()`, `persistOverrides()`. Es el despachador central de comandos del sistema.

**En React no se puede migrar como componente normal.** Necesita convertirse en un `CommandContext` antes que cualquier otra cosa de la Sesión 3:

```typescript
// lib/commands.ts
type Command =
  | { type: 'editMedia'; payload: { id: string } }
  | { type: 'doLogin' }
  | { type: 'openAuditPage' }
  | { type: 'openCarouselManager' }
  | { type: 'openRepoPicker' }
  | { type: 'openAddIllustration'; payload: { section: string } }
  | { type: 'openExport' }
  | { type: 'confirmMovePage'; payload: { id: string } }

const CommandContext = createContext<(cmd: Command) => void>(() => {})
export const useCommand = () => useContext(CommandContext)
```

### 2. Utilidades duplicadas entre `cms.js` y `admin.js`

Las siguientes funciones existen **dos veces** (una en cada archivo):

| Función | cms.js | admin.js |
|---------|--------|----------|
| `fmtBytes()` | L145 | L29 |
| `fmtDate()` | L1571 | L35 |
| `fmtDateOnly()` | — | L39 |
| `fmtTimeOnly()` | — | L43 |
| `isVideo()` | — | L49 |

**Migrar a `lib/utils.ts` antes de tocar CMS o Admin:**

```typescript
// lib/utils.ts
export const fmtBytes = (n: number): string => { ... }
export const fmtDate = (d: string): string => { ... }
export const fmtDateOnly = (d: string): string => { ... }
export const fmtTimeOnly = (d: string): string => { ... }
export const isVideo = (url: string): boolean => { ... }
```

### 3. Dos sistemas de modal en paralelo

- **CMS:** `modal()` + `closeModal()` (cms.js)
- **Admin:** `buildModal()` + `closeOv()` + `confirmModal()` (admin.js)

Ambos hacen lo mismo. Unificar en un solo proveedor antes de migrar cualquiera de los dos módulos:

```typescript
// components/ui/Modal.tsx + hooks/useModal.ts
const { open, close, confirm } = useModal()
```

### 4. `esc()` vive en el módulo equivocado

`editMedia()` (cms.js) llama a `esc()` (admin.js:L28) — el handler de teclado para cancelar edición está en admin, no en CMS. En React esto se convierte en un hook compartido:

```typescript
// hooks/useKeyHandler.ts
useKeyHandler('Escape', closeModal)
```

### 5. Orden de implementación corregido para Sesión 3

El orden original de la Sesión 3 no considera estas dependencias. Orden correcto:

```
1. lib/utils.ts          ← fmtBytes, fmtDate, fmtDateOnly, fmtTimeOnly, isVideo
2. hooks/useKeyHandler.ts ← reemplaza esc() de admin.js
3. components/ui/Modal.tsx + hooks/useModal.ts  ← unifica los dos sistemas de modal
4. lib/commands.ts + CommandContext  ← reemplaza toast() como command bus
5. hooks/useMediaPersist.ts  ← unifica persistUsed/Unused/Retired/Audit/Added/Media
6. components/cms/  ← ahora puede migrar limpio (RepoPicker, ContentPicker, etc.)
7. app/admin/page.tsx  ← puede migrar limpio una vez que 1-4 están listos
```

### 6. Funciones que migran sin dependencias cruzadas (seguras para empezar)

Estas no tienen edges hacia admin — se pueden migrar en cualquier momento de Sesión 3:

- `openRepoPicker()` → `<RepoPicker />`
- `openContentPicker()` → `<ContentPicker />`
- `seedUsedContent()`, `moveToUnused()`, `applyMedia()` → `hooks/useMediaLifecycle.ts`
- `persistUsed()`, `persistUnused()`, `persistRetired()`, `persistAudit()`, `persistAdded()` → `hooks/useMediaPersist.ts`
- `validateFile()`, `fileToDataURL()` → `lib/media.ts`

---

## Decisiones clave

| Decisión | Elegido | Por qué |
|----------|---------|---------|
| React framework | Next.js 15 App Router | SSR/SSG para SEO de portfolio |
| CSS | Tailwind v4 | Utilidades + mantener variables CSS custom para blueprint |
| Estado global | Ninguno (fetch directo) | Portfolio no necesita state complejo |
| Backend | Express existente (sin tocar) | Evitar reescribir auth 2FA y DB queries |
| GSAP | Mantener GSAP | Ya está integrado, funciona bien con React via useEffect |
| Componentes UI | 21st.dev como inspiración | El proyecto tiene estética muy custom, no usar directo |
| Deploy | Vercel (Next.js) + Railway/Render (Express) | Separar frontend y backend |

---

## Comandos útiles para la migración

```bash
# Crear proyecto Next.js
npx create-next-app@latest artist-portfolio-next --typescript --tailwind --app --no-src-dir

# Instalar dependencias en el nuevo proyecto
cd artist-portfolio-next
npm install gsap
npm install swr          # para fetch de CMS
npm install @types/node

# Correr ambos en paralelo durante desarrollo
# Terminal 1 — Express backend
node server.js           # puerto 3001

# Terminal 2 — Next.js frontend  
npm run dev              # puerto 3000
```

---

## Notas importantes para Claude

- **No borrar el proyecto original** hasta que el nuevo esté 100% verificado
- La estética blueprint (cuadrícula, cursor, esquinas) es la identidad del proyecto — debe quedar idéntica
- El reloj en vivo usa `setInterval` — en React va dentro de `useEffect` con cleanup
- Las burbujas del wave marquee son CSS + JS custom — migrar el JS a un hook `useBubbles.ts`
- La autenticación 2FA usa `otplib` en el backend — el frontend solo envía el token, no cambia nada
- `content.json` puede seguir existiendo como fallback cuando no hay DB
- Los SVGs de íconos (3DS Max, Photoshell) están en `images/` — copiar a `public/` en Next.js
