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

### Idioma base del sitio: INGLÉS

> Regla dura, aplica a TODO código nuevo. El idioma de la página es el inglés.

- **Todo texto visible por el usuario se escribe en inglés.** Labels, botones, títulos, `title`, `aria-label`, `placeholder`, `alt`, mensajes de toast, errores de validación, opciones de `<select>`, textos de estado vacío, copys de email transaccional. Sin excepciones.
- **Los comentarios de código siguen en español** — son internos, no viajan al usuario. No traducirlos.
- **No se traducen**: nombres propios (Lucía Montaña), marcas de software, identificadores internos (slugs de ruta `ajustes-*` / `contenidos-*`, clases CSS `cms-tag--basurero`, carpetas de Cloudinary `portfolio/en-uso|sin-usar|basurero`). Renombrarlos rompe datos de producción.
- `lib/cms/pages.ts` conserva a propósito etiquetas de sección en español dentro de su lista de `match`: son valores heredados que siguen vivos en la BD. Se agregan variantes en inglés, no se borran las viejas.
- Formateo de números y fechas: `toLocaleString('en')`, nunca `'es'`.

### Sistema de Traducción (Admin-Driven)

**Objetivo**: llevar el sitio a varios idiomas sin presupuesto de API. El texto se divide en dos mundos con mecanismos distintos.

**Idiomas**: `en` (base) · `es` · `pt` · `fr` — definidos en `lib/i18n.ts` (`BASE_LANG`, `TARGET_LANGS`, `LANG_META`).

#### 1) Texto estático (layout, chrome, ajustes) → traducido en código

Todo lo que el admin NO puede editar (nav, footer, panel de ajustes, modal de contacto, loader, textos de las páginas fijas, chrome de las secciones) vive en `UI_TRANSLATIONS` (`lib/i18n.ts`) con **los cuatro idiomas ya escritos**. No pasa por export/import: no cambia nunca.

Dos formas de consumirlo, y hay que elegir bien:

- **Componentes React → `useUiText()`** (`lib/cms/store.ts`). Resuelve en el render y se suscribe al store, así que repinta al cambiar de idioma.
  ```tsx
  const ui = useUiText()
  <button aria-label={ui('contact_me')}>{ui('email')}</button>
  ```
  Obligatorio cuando el texto se arma en JS (condicionales, `title`, `aria-label`, `placeholder`) o cuando el componente se re-renderiza. Un `data-i18n` en un nodo que React vuelve a pintar se pierde.
- **Markup que el motor muta → `data-i18n` / `data-i18n-title` / `data-i18n-aria`**. Reservado para Server Components y markup estático (ej. `app/(site)/multimedia/page.tsx`, `components/about/AboutPage.tsx`). Lo aplica `applyStaticTranslations(lang)`.

Interpolación: `ui('err_max_chars', '', { n: 100 })` reemplaza `{n}` en la plantilla.

**Al agregar cualquier string visible nuevo**: crear la clave en `UI_TRANSLATIONS` con en/es/pt/fr completos. No dejar texto suelto en el JSX.

#### 2) Texto editable (contenedores del CMS) → export → Claude → import

1. Admin edita el contenido en inglés → se guarda en `cms_data`.
2. **Export** (Gestión → Traducciones, o la tuerca de admin del sitio) → descarga `translations-prompt.txt` con instrucciones + todo el texto base.
3. Se pega entero en Claude → devuelve `{ "items": { "es": {...}, "pt": {...}, "fr": {...} } }`.
4. **Import** del `.json` → `POST /api/translations` → upsert en `cms_translations`.
5. Se reaplica el idioma en vivo, sin recargar.

**Completitud del export** (`components/cms/engine.ts`). Une cuatro fuentes para que no dependa de en qué ruta esté el admin:
- `cms_data` del servidor,
- `state.items` (overrides locales),
- escaneo del DOM montado (`scanDomTextKeys`),
- **caché de textos por defecto** (`cms_text_defaults_v1`): `captureTextDefaults()` corre en cada `rescan()` y en cada cambio de ruta, y va memorizando el texto original de cada contenedor. Sin él, exportar desde `/animations` perdería los defaults de las secciones que solo viven en la home.

Reglas que hay que respetar al tocar esto:
- `captureTextDefaults()` y el escaneo del DOM **solo corren con el idioma base**. Con `es/pt/fr` montado el DOM tiene la traducción aplicada y guardarla contaminaría el export.
- Un contenedor **con campos** (`fields` en el REGISTRY: `about.spec`, `char`, `proj`, …) no se captura ni se aplica a nivel contenedor — su contenido son los `key::campo`. Escribirle el `textContent` entero le borra el markup interno.
- `cleanTextOf()` quita `.cms-tools` y `.cms-empty-overlay` antes de leer: si no, el nombre del contenedor se exportaría como si fuera contenido.
- `isTranslatableEntry()` (`lib/i18n.ts`) es el filtro único. Excluye `*.settings`, `settings.*`, `social.*`, campos `::url` / `::link`, fechas ISO y valores URL/ruta/data-url.

#### 3) Aplicación del idioma

`engine.setLanguage(lang)` pinta el DOM y persiste en `localStorage[cms_lang_v1]`; los selectores de banderas de Nav y del panel de Ajustes comparten `state.lang`.

- **Volver al idioma base** usa el caché de defaults como fallback. Un contenedor nunca editado no tiene entrada en `state.items`, así que sin ese fallback se quedaría con la última traducción aplicada.
- **Un componente React que pinta contenido del CMS DEBE leer con `t(key, fallback)`** (`lib/cms/store.ts`), no con `state.items[key]`. El motor aplica el idioma mutando el DOM; el siguiente render lo pisaría con el texto base. Es exactamente el bug que tenían `ProjectsShowcase` y `CharactersShowcase`.
- `rescan()` y el efecto de cambio de ruta de `CmsRoot` reaplican el idioma: las secciones con `next/dynamic` montan tarde y si no se quedarían en inglés.

**Alcance**: funciona en todo el sitio (`CmsRoot` está montado en `app/(site)/layout.tsx`), incluidas las páginas de galería, `/about` y `/multimedia`.

**Panel de admin (`/admin`)**: es herramienta interna, se mantiene solo en inglés — no se le agrega i18n.

**Arquitectura**:
- Tabla `cms_translations` (`lib/db.ts → createBaseTables`): `(key, lang, value)`, PK `(key, lang)`. Solo idiomas destino; el base (`en`) vive en `cms_data`.
- `app/api/translations/route.ts`: `GET` → `{ base, langs, items: { en, es, pt, fr } }`. `POST` → valida (idiomas conocidos, forma de la clave, largos máximos) y upsertea; responde `{ imported, skipped }`.
- `lib/translations-io.ts`: implementación **única** de export/import, compartida por `components/admin/SiteSettings.tsx` y `components/ui/SettingsPanel.tsx`. No duplicar el prompt ni el parseo en un componente.

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

### Un archivo en varios contenedores — "Contenido en uso"

> Regla de agrupación de la tab **Contenido en uso** (Gestión → Contenidos). El
> mismo archivo puede ocupar más de un contenedor; cómo se muestra depende de en
> cuántas **páginas** vive, no de cuántos contenedores.

- **Repetido dentro de UNA página** → aparece **una sola vez** en esa página, y la
  tarjeta enumera **todos** los contenedores que lo usan (`Containers: X (+n)`, con
  el detalle en el tooltip y en la vista previa).
- **Repetido en DOS o más páginas** (p. ej. Feed y Contact) → aparece **en cada
  página**, dentro de su sección colapsable, y en cada una enumera **solo los
  contenedores de esa página**. No se colapsa a una sola aparición global: el admin
  tiene que poder ver el archivo desde la página en la que lo está buscando.

De ahí que la deduplicación sea por **(página, archivo)** y no global
(`buildPageTree`, `lib/cms/pages.ts`). Consecuencias a respetar:

- El contador de la cabecera cuenta archivos **únicos de todo el sitio**, así que
  la suma de los contadores por página puede ser mayor. Es correcto: un archivo
  compartido se cuenta una vez arriba y una vez en cada página.
- `(+n reused)` por página = contenedores de esa página − archivos de esa página.
- La tarjeta recibe sus contenedores por prop (`occurrences`). Si se omite,
  `MediaCard` escanea `state.usedContent` entero y vuelve a mezclar los
  contenedores de otras páginas.
- Las acciones del menú (mover / quitar / renombrar) siguen operando sobre el
  archivo completo: es **un solo asset**, no una copia por página.

**Al crear una página nueva con contenedores propios**: agregar su entrada a
`SITE_PAGES` (`lib/cms/pages.ts`) con las `sections` del REGISTRY que le
corresponden y sus `keys` fijas, y registrar cada contenedor en `CONTAINER_BASES`
(`lib/cms/store.ts`) para que tenga sección y nombre fuera del DOM de esa ruta.
Sin eso, el contenido de la página nueva cae en el catch-all del Feed.

## Performance — trampas ya pisadas

> Cada punto de acá costó una regresión, varias en producción. No son teoría:
> son mecanismos de ESTE proyecto que se rompen de formas que no se ven venir.
> Antes de optimizar algo, leer la trampa que le corresponde.

### La regla que resume a todas

**Al sacar o mover algo, preguntar qué MÁS dependía de eso.** Verificar que el
efecto buscado ocurrió no alcanza: el fallo aparece en otro lado, y casi nunca
se parece a lo que se tocó. Dos ejemplos reales:

- Se dejó de montar Lenis en táctil. Con Lenis se iba `gsap.ticker.lagSmoothing(0)`,
  que vivía adentro de ese bloque → **el hero quedó invisible en móvil**. El
  síntoma no fue "el scroll se siente distinto".
- El hero pasó a renderizarse en el servidor. Con eso, la imagen podía terminar
  de cargar antes de hidratar → el `onLoad` nunca llegaba → **la pantalla de
  carga se colgaba en 86% para siempre**.

### GSAP

- **`gsap.ticker.lagSmoothing(0)` no se toca.** Vive en `hooks/gsap-runtime.ts`.
  Por defecto GSAP trata un frame de más de 500ms como pico de lag y avanza solo
  33ms. En el arranque en móvil hay frames de 2 segundos (medido: 757, 1936,
  1993, 1991, 1994, 2006 ms), así que un tween de 2s se congela.
- **Los reveal loops se apropian del nodo**: `typewriterRevealLoop` y
  `wordRevealLoop` reescriben el `innerHTML` en spans. Un texto bajo un loop NO
  puede pasar a estar controlado por React: el primer repintado le borra la
  animación. Ver la lista en `lib/cms/content-context.tsx`.

### Video

- **Un `<video>` con fuente y sin frame decodificado pinta NEGRO.** El póster lo
  tapa, pero `videoPosterSrc()` solo genera derivada para Cloudinary: en local
  son cero pósters. De ahí la clase `has-frame` que pone `ViewportGate`.
- **`load()` anula `preload="none"`.** Asignar `v.src` ya dispara el algoritmo
  de carga; llamar a `load()` explícitamente hace que Chrome baje el archivo
  igual. Solo hace falta con un `<source>` hijo o al vaciar el contenedor.
- **Escribir `currentTime` también fuerza la descarga.** Leerlo es gratis;
  asignarlo obliga a resolver el recurso. Rebobinar solo si de verdad avanzó.
- **`preload="metadata"` deja `readyState` en 1, no en 2.** Hay metadata pero no
  frame: sigue siendo un rectángulo negro hasta que reproduce.

### CSS

- **Nunca hacer que el estado VISIBLE dependa de que corra una transición.** En
  pestaña oculta las transiciones no avanzan y el elemento se queda en el valor
  inicial. Escribir la regla al revés: que visible sea el valor por defecto y
  solo el estado oculto declare la propiedad.
- **Toda regla CSS que ESCONDA algo va colgada de una clase que pone el JS**
  (ej. `html.video-frame-gate`). Si ese JS falla, no se oculta nada. Al revés,
  un fallo deja contenido invisible para siempre — peor que el bug original.

### Temporizadores y gates

- **Un `setInterval` que hace early-return igual despierta la CPU.** Se apaga el
  temporizador (`clearInterval` desde el IntersectionObserver), no se lo guardea
  por dentro. En móvil ese wake-up cae en medio del scroll.
- **Un chunk dinámico pedido antes del evento `load` RETRASA ese evento**, y el
  gate `windowLoad` de la pantalla de carga espera justamente a `load`.
  Precalentar secciones mientras el loader está arriba lo retiene a sí mismo.
- **Los gates del loader (`lib/loader-ready.ts`) son la primera víctima de
  cualquier cambio en el arranque.** Su peso delata cuál falló: el total es 14,
  así que clavado en 86% = falta uno de peso 2 (`heroPanel`) o `windowLoad` a
  medio crédito. Al tocar el arranque, verificar SIEMPRE que el loader cierre.

### SSR del contenido del CMS

- **`state` (`lib/cms/store.ts`) es un singleton de módulo**: escribirlo desde el
  servidor filtra contenido entre requests. El contenido va por
  `lib/cms/content-context.tsx` (`useCmsItems` / `useCmsText`).
- **La coherencia de hidratación depende de `state.itemsLoaded`**, que recién se
  enciende en el efecto de `CmsRoot`. Por eso el primer render del cliente lee
  todavía del contexto: mismo mapa que el servidor, mismo marcado.
- **Un `<img>` pintado por el servidor puede completar antes de hidratar** y su
  `onLoad` no llega nunca. Reconciliar con `complete` / `naturalWidth`, que son
  ESTADO y se pueden consultar al montar. Lo mismo con `readyState` en video.
- **Al pintar media en el servidor, revisar `loading="lazy"`**: lo que antes se
  bajaba tarde por accidente (no tenía `src` hasta hidratar) pasa a bajarse de
  entrada.

### Cómo verificar

Con el navegador disponible, estas cuatro cosas después de cualquier cambio de
arranque o de media:

1. El loader **cierra** y llega a 100%.
2. Ningún `<video>` visible con `readyState < 2` (sería un negro).
3. Nada reproduciendo ni moviéndose fuera de viewport.
4. Móvil Y escritorio: varias regresiones de esta lista salieron en uno solo.

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
