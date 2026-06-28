# Artist Portfolio — Lucia Montaña

## ⚠️ Next.js 16 Breaking Changes

This project uses **Next.js 16.2.9** which has breaking changes from your training data. Before writing code, consult `node_modules/next/dist/docs/` for API changes, deprecations, and new conventions.

---

## Behavioral Guidelines

> Estas reglas aplican a cualquier tarea en este proyecto. Priorizan la cautela sobre la velocidad.

### 1. Pensar antes de codear

- Declarar supuestos explícitamente. Si hay incertidumbre, preguntar.
- Si existen múltiples interpretaciones, presentarlas — no elegir en silencio.
- Si existe un enfoque más simple, decirlo. Hacer pushback cuando corresponde.
- Si algo no está claro, parar. Nombrar qué confunde. Preguntar.

### 2. Simplicidad primero

- Sin features más allá de lo pedido.
- Sin abstracciones para código de un solo uso.
- Sin "flexibilidad" ni "configurabilidad" que no fue solicitada.
- Sin manejo de errores para escenarios imposibles.
- Si el código tiene 200 líneas y podría ser 50, reescribirlo.

### 3. Cambios quirúrgicos

- No "mejorar" código adyacente, comentarios ni formato.
- No refactorizar cosas que no están rotas.
- Mantener el estilo existente aunque se haría diferente.
- Si se detecta código muerto no relacionado, mencionarlo — no borrarlo.
- Remover solo imports/variables/funciones que LOS PROPIOS cambios dejaron sin uso.

### 4. Ejecución orientada a objetivos

Transformar tareas en criterios verificables:
- "Agregar validación" → "Escribir tests para inputs inválidos, luego hacer que pasen"
- "Corregir el bug" → "Escribir un test que lo reproduzca, luego hacer que pase"

Para tareas de múltiples pasos, enunciar un plan breve:
```
1. [Paso] → verificar: [check]
2. [Paso] → verificar: [check]
```

### 5. Calidad de código y limpieza activa

- Seguir principios SOLID, DRY, KISS. Naming semántico. Sin magic numbers ni strings sueltos.
- Dentro del scope de cualquier cambio: eliminar código muerto, imports sin usar, variables redundantes y lógica duplicada. No dejar deuda técnica visible.
- Si una lógica se repite 3+ veces, extraerla a una función/hook reutilizable.
- Preferir expresiones concisas sobre verbosas cuando la legibilidad no sufre.

### 6. Tecnologías modernas y escalabilidad

- Usar las últimas features estables de React, Next.js y TypeScript. No usar patrones deprecados.
- Preferir APIs nativas modernas sobre polyfills o librerías wrapper.
- Diseñar componentes con props claras y composición explícita. Evitar acoplamiento implícito.
- Cada módulo debe poder modificarse o reemplazarse sin efecto cascada en el resto del sistema.
- Preferir un modelo de trabajo escalable: lo que se construye hoy debe poder extenderse mañana sin reescribirse.

### 7. Seguridad

- Validar y sanitizar inputs en todos los boundaries del sistema (formularios, APIs, uploads).
- No exponer secrets, tokens ni credenciales en el frontend bajo ninguna circunstancia.
- Sanitizar datos de usuario antes de renderizarlos para prevenir XSS.
- Aplicar protecciones contra CSRF en endpoints que mutan estado.
- Usar HTTPS, Content Security Policy headers, y parametrizar queries SQL para prevenir inyección.
- En uploads de archivos: validar tipo MIME real (no solo extensión), tamaño máximo, y escanear nombre de archivo.

### 8. Responsive y compatibilidad de pantallas

Todo cambio visual debe funcionar correctamente en:

| Breakpoint | Ancho | Uso |
|------------|-------|-----|
| Mobile S | 320px | iPhone SE y similares |
| Mobile M | 375–430px | iPhones modernos |
| Tablet | 768px | iPads, tablets Android |
| Laptop | 1024px | laptops pequeñas |
| Desktop | 1280–1440px | escritorio estándar |
| Ultra-wide | 1920px+ | monitores grandes |

- Usar unidades relativas (`rem`, `%`, `dvh`, `clamp()`) sobre píxeles fijos.
- Contemplar aspect ratios comunes: 4:3, 16:9, 21:9.
- Probar en orientación portrait y landscape en mobile/tablet.
- Nunca asumir que un diseño que se ve bien en desktop funciona en mobile.

### 9. Modo de comunicación

Activar `/caveman ultra` al inicio de cada sesión. Respuestas terse: sin filler, sin cortesías, fragmentos OK, flechas para causalidad. Sustancia técnica intacta. Desactivar solo si el usuario dice "stop caveman".

### 10. Usar todas las herramientas disponibles

- Utilizar activamente los skills, tools y capacidades disponibles en el entorno cuando sean relevantes para la tarea. No limitarse a lo básico si existe una herramienta más adecuada.
- Antes de resolver un problema manualmente, evaluar si un skill existente ya lo resuelve mejor (graphify para preguntas de código, gstack para navegación web, skills de diseño para UI, etc.).
- Si una tarea requiere investigación web, análisis de código, generación de UI, o revisión de seguridad — invocar el skill correspondiente en lugar de aproximar la respuesta desde memoria.
- No ignorar herramientas por comodidad. El criterio de selección es cuál produce el resultado más correcto y completo, no cuál es más rápida de invocar.

### 11. Performance

- Usar Core Web Vitals como criterio de aceptación: LCP < 2.5s, CLS < 0.1, INP < 200ms.
- Lazy loading por defecto en imágenes y componentes pesados.
- Code splitting por ruta en Next.js (`dynamic()` para componentes grandes).
- Imágenes en formato moderno (WebP/AVIF) con `next/image`.
- Animaciones solo con propiedades `transform` y `opacity` para evitar reflows y forzar GPU acceleration.
- Usar `will-change` con criterio — solo en elementos que realmente animarán.

---

## Stack actual

**Next.js 16 (App Router) + Tailwind CSS v4 + TypeScript**

Backend **dentro de Next** (`app/api/*` route handlers). 1 solo servicio, sin Express ni proxy.
- DB: PostgreSQL vía `pg` (`lib/db.ts` → pool + `initDb` con `CREATE TABLE IF NOT EXISTS` + runner de migraciones idempotentes en `MIGRATIONS[]`). Sin `DATABASE_URL` → modo mock (front usa localStorage).
- Media: `lib/storage.ts` decide por entorno → Cloudinary si hay credenciales (prod), filesystem `public/uploads` si no (local). Una subida en local NUNCA toca Cloudinary.
- Rutas: `/api/content` (GET/POST), `/api/login` (admin+2FA TOTP), `/api/upload-test`, `/api/delete-media`.
- Env en `.env.example`. Estructura (tablas/migraciones) viaja con el commit; los datos no.

### Setup & operación (backend/DB)

**Correr local:** solo `npm run dev` (ya NO existe `npm run server`). Postgres nativo local en `:5432`, DB `artistportfolio`. `.env` local → `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/artistportfolio`, Cloudinary **vacío** (uploads van a `public/uploads`, gitignoreado). `initDb` crea las tablas al primer request.

**Entornos (aislados, NO se sincronizan datos):**
- Local: Postgres local + `public/uploads`. Login admin requiere `ADMIN_USER/PASS/2FA_SECRET` en `.env`.
- Prod (Railway): 1 servicio app + servicio Postgres. Setear en el servicio app: `DATABASE_URL` (referencia al Postgres), `CLOUDINARY_*`, `ADMIN_*`.

**Modelo deploy:** `git push` a `main` → Railway redeploya. Viaja **código + estructura** (las migraciones de `MIGRATIONS[]` corren al bootear). **Los datos/contenido NO viajan** — el contenido de prod se carga en el sitio live (admin); el local queda local.

**Cambios de esquema:** agregar entradas a `MIGRATIONS[]` en `lib/db.ts` (idempotentes, `ALTER ... IF (NOT) EXISTS`). Nunca romper tablas existentes; los datos no se migran solos.

**Login admin:** user+pass → si no manda código, pide 2FA → verifica TOTP (`otplib`, `epochTolerance` ±30s). Secreto en `ADMIN_2FA_SECRET` (base32, mismo que la app autenticadora).

### Sistema de Traducción Automática (Admin-Driven)

**Objetivo**: Traducir todo el contenido editable a múltiples idiomas sin presupuesto API. Admin controla el flujo completamente en la UI.

**Idiomas soportados**: ES (base), EN, PT, FR

**Flujo**:
1. **Admin edita contenido** en el CMS (en español) → Guarda en BD
2. **Admin presiona "Export for Translation"** en Admin Settings → Descarga `translations-export.json`
   ```json
   {
     "es": {
       "about_title": "Sobre mí",
       "about_lede": "Artista basada...",
       "hero_subtitle": "Animation, illustration & 3D art"
     }
   }
   ```
3. **Admin copia el JSON → lo pega en Claude**
   ```
   Prompt: "Traduce el siguiente contenido a inglés, portugués y francés.
   Mantén el contexto profesional y artístico.
   Retorna el mismo JSON con las traducciones."
   ```
4. **Claude retorna `translations-translated.json`** con ES, EN, PT, FR completados
5. **Admin presiona "Import Translations"** → Adjunta el archivo descargado
6. **Sistema valida estructura** → Guarda TODO en BD
   - Nueva tabla `translations`: `{ key, lang, value }`
   - Cada contenedor tiene sus 4 variantes de idioma

**Frontend lee según idioma seleccionado**:
- Usuario selecciona idioma en Nav o Settings
- Componentes leen el valor correcto de la BD según `localStorage['preferredLang']`

**¿Nuevos contenedores se incluyen automáticamente?**

✅ **SÍ**. El export lee TODO el texto de `cms_data` filtrando media/URLs vía `isTranslatableEntry` (`lib/i18n.ts`): incluye prosa, excluye valores que son URL/ruta/data-url y las claves `*.settings`. No hay lista fija de claves.

Cuando el admin agrega un nuevo contenedor de texto (ej. `new.section.title#0`), apenas tenga contenido en español la próxima exportación lo incluye solo. El admin solo repite el flujo (export → Claude → import).

**Arquitectura**:
- **Tabla `cms_translations`** (`lib/db.ts → createBaseTables`): `(key, lang, value)`, PK `(key, lang)`. Solo idiomas destino (en/pt/fr); el base (es) vive en `cms_data`.
- **`lib/i18n.ts`**: `BASE_LANG='es'`, `TARGET_LANGS=['en','pt','fr']`, `LANG_META`, `isTranslatableEntry`.
- **Endpoint único `app/api/translations/route.ts`**:
  - `GET` → `{ base, langs, items: { es, en, pt, fr } }`. `es` = texto base vivo (filtrado); en/pt/fr = `cms_translations`. Lo usa el cliente (aplicar idioma) y el botón Export (descargar para Claude).
  - `POST` → recibe `{ items: { en, pt, fr } }`, upsertea en `cms_translations`.
- **Aplicación en el front**: `engine.setLanguage(lang)` reaplica el texto del DOM (base o traducción, con fallback al base si falta la clave); persiste en `localStorage[cms_lang_v1]`. `CmsRoot` trae las traducciones al iniciar y aplica el idioma guardado. Los selectores de Nav y Settings comparten `state.lang` vía el store.
- **UI admin**: botones "Export for Translation" / "Import Translations" en el panel de Admin Settings (`SettingsPanel.tsx`).

**Alcance actual**: la aplicación de idioma corre donde está montado `CmsRoot` (la portada `/`). Extender a las páginas de galería requiere inicializar el engine en esas rutas — pendiente para una iteración futura.

**Ventajas**:
- ✅ Cero presupuesto (usa Claude API desde Claude Code)
- ✅ Totalmente dinámico (sin Git commits)
- ✅ Admin auto-suficiente (sin intervención de dev)
- ✅ Escalable (nuevos contenedores automáticamente incluidos)
- ✅ Revisable (Claude produce traducciones de calidad)

### Enlaces a redes sociales (global)

**Objetivo**: una única fuente para los enlaces sociales que se aplica a TODOS los iconos del sitio (menú, pie, cualquier sección que redirija a una red). Editable desde Gestión.

**Lista única**: `lib/social.ts → SOCIAL_NETWORKS` (Artstation, Vimeo, Youtube, Instagram, Behance, LinkedIn, Email). Cada red define `id`, `label`, `icon`, `brand` (fa-brands vs fa-solid), `type` (`url`/`email`) y `placeholder`. `socialHref(net, value)` arma el href final (`mailto:` para email). Agregar una red = una entrada en este array.

**Almacenamiento**: las URLs viven en `cms_data` con la clave `social.<id>` (son contenido normal). Las escrituras reusan `POST /api/content`; la lectura liviana es `GET /api/social` (`app/api/social/route.ts`) que devuelve `{ items: { <id>: url } }` solo de las claves `social.*`.

**Aplicación site-wide**: `components/ui/SocialProvider.tsx` (montado en `Providers`) hace un fetch único a `/api/social` y expone `{ links, setLinks }` vía `useSocial()`. Nav y Footer consumen ese contexto → los enlaces funcionan en TODAS las páginas (no dependen del store CMS, que es solo-home). Solo se renderizan las redes con URL configurada (las vacías se ocultan).

**Edición (admin)**: Gestión → "Redes sociales" (`components/admin/SocialSettings.tsx`). Form con un input por red; al guardar hace `POST /api/content`, refleja en `state.items`, y llama `setLinks` para aplicar en vivo en Nav/Footer sin recargar.

**Nota**: el bloque de redes de "Sobre mí" es aparte (editable por item vía `ABOUT_SOCIAL_FIELDS` del engine) — no se rige por esta lista global.

## Reglas

### Stack y frameworks

- React 19 + Next.js 16 App Router (`app/`)
- Animaciones de UI y transiciones entre páginas → Framer Motion (cuando sea necesario)
- Animaciones complejas (cursor, canvas, SVG, secuencias) → GSAP con `useEffect` + cleanup
- Estilos → Tailwind utility classes + variables CSS para la estética blueprint
- Backend = route handlers de Next (`app/api/*`). Para cambios de esquema, agregar a `MIGRATIONS[]` en `lib/db.ts` (no romper tablas existentes)

### Diseño y experiencia visual

- La estética **blueprint cinematic** es la identidad central del proyecto — nunca comprometer esa identidad en favor de conveniencia técnica.
- El diseño debe ser moderno, sofisticado y con vida. Evitar páginas estáticas o sin movimiento.
- Cada sección o panel que aparece en pantalla debe tener una animación de entrada definida (estado inicial oculto/reducido → animación de reveal al hacer scroll o al montar).
- Usar stagger en listas y grillas: los elementos deben aparecer en cascada, nunca todos juntos.
- Priorizar movimiento continuo donde corresponda: partículas, gradientes animados, elementos flotantes.
- Antes de implementar una animación, buscar una referencia visual concreta (Awwwards, Dribbble, CodePen). Documentar la referencia en el componente con un comentario de una línea.

### Animaciones — reglas técnicas

- GSAP: cursor custom, canvas, SVG, starfield, secuencias cronometradas complejas.
- Usar `IntersectionObserver` o `ScrollTrigger` para disparar animaciones on-scroll — nunca animar elementos que el usuario no puede ver.
- Todas las animaciones deben respetar `prefers-reduced-motion`. Wrappear con:
  ```tsx
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ```

## Sistema de Bloques — Arquitectura de Contenido

> Esta es la regla de diseño más importante para la escalabilidad del proyecto. Aplica a toda imagen, video, o contenido audiovisual.

### Principio fundamental

**El contenedor es la unidad atómica, no el archivo de media.**

Antes de colocar cualquier imagen o video, crear primero el contenedor que define su espacio. Si el contenido se reemplaza por algo nuevo, el contenedor permanece intacto con todas sus propiedades.

### Propiedades que viven en el contenedor (nunca en el archivo)

- Dimensiones o aspect ratio (`aspect-video`, `aspect-square`, `aspect-[4/3]`)
- Comportamiento de recorte (`object-fit`, `overflow`)
- Estado vacío / placeholder mientras no hay contenido
- Animaciones de carga y de entrada
- Estilos hover e interacciones
- Accesibilidad (`aria-label`, rol)

### Reglas de implementación

1. **Primero el contenedor, después el contenido.** Nunca al revés.
2. Al reemplazar un archivo de media, el nuevo hereda todas las propiedades del contenedor sin modificarlo.
3. El contenedor nunca se modifica para acomodar las dimensiones de un archivo específico — el archivo se adapta al contenedor.
4. Cada contenedor debe ser accesible desde el CMS: el usuario puede reemplazar el contenido sin tocar código.
5. Si se planea agregar una nueva pieza de contenido, el primer commit es el contenedor vacío con su placeholder.

### Estilo genérico de contenedor vacío (OBLIGATORIO)

> Cuando se diga "contenedor", **siempre** se refiere a un elemento con estas cualidades. Aplica a toda la página, de aquí en adelante, sin excepción para contenedores de media (imagen/video).

Todo contenedor **sin contenido** debe verse EXACTAMENTE así (estilo único, no overridear por sección):

- **Fondo**: violeta claro casi transparente → `rgba(124, 58, 237, 0.06)`.
- **Borde**: punteado (`2px dashed var(--accent)`), `border-radius: 14px`.
- **Centro**: icono de nube de subir contenido (`fa-cloud-arrow-up`).
- **Debajo del icono**: el **nombre del contenedor** (label del CMS).

**Fuente de verdad única**: la clase base `.cms-empty-overlay` en `styles/legacy/style.css`. El engine (`components/cms/engine.ts → showEmptySlot`) inyecta el overlay con `<i class="fa-cloud-arrow-up"> + <span>{nombre}</span>`. **Nunca** redefinir `background`/`border`/`border-radius`/colores del overlay en CSS por sección — eso rompe la uniformidad (era el bug de Animations/About/Characters/3D que usaban fondo blanco).

**Sin efectos en el contenedor vacío**: sombras, glow, gradientes, float/breathe, blur del contenido **NO** se aplican al contenedor — solo aparecen al subir contenido. El neutralizador global `.cms-empty-slot { background/box-shadow/animation/filter/backdrop-filter: none !important }` (en `legacy/style.css`) garantiza esto. Si un efecto vive en un ancestro (ej. float del `.about-reel` exterior), neutralizarlo con `:has(.cms-empty-slot)`.

**Excepción**: slots de icono inline muy chicos (logos de software `.sw-*`, burbujas wave `.wave-item`) usan el mismo borde punteado + icono pero **ocultan el nombre** (`span { display: none }`) por falta de espacio físico.

**Admin vs visitante (mismo marco, distinto contenido)**: el contenedor vacío se muestra para TODOS (el engine inyecta el overlay sin gate de admin). El **marco punteado + fondo violeta translúcido son idénticos** en ambas vistas. La diferencia: en **admin** se ven el icono nube + el nombre + es clickeable (abre el picker); para el **visitante** (`body:not(.is-admin)`) o con **"Hide Edit actions"** (`body.hide-cms-controls`) se ocultan icono + nombre (`> i, > span { display: none }`) y el marco deja de ser interactivo (`pointer-events: none`). Nunca dejar que un contenedor vacío muestre su fondo propio (oscuro/gradiente) al visitante — debe ser el mismo dashed translúcido.

**Flujo al crear una sección nueva**: primero colocar los contenedores vacíos (con esta estética), recién después subir el contenido por el CMS.

### Estructura de componente de referencia

```tsx
// MediaBlock — contenedor reutilizable
<MediaBlock
  aspectRatio="16/9"          // define el espacio, no el archivo
  placeholder="/placeholder.webp"
  cmsKey="hero-reel"          // editable desde el CMS
  animation="fadeUp"          // animación de entrada del contenedor
>
  <video src={src} ... />     // el contenido es intercambiable
</MediaBlock>
```

## Setup para colaboradores

Para trabajar en este proyecto instalar gstack:

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup
```

Requiere: `bun` — instalar con `curl -fsSL https://bun.sh/install | bash`

## gstack

Para navegación web usar siempre `/browse` de gstack. **Nunca usar `mcp__claude-in-chrome__*` tools.**

Skills disponibles: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
