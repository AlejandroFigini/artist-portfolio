# HANDOFF — Artist Portfolio (Lucía Montaña)

> Documento para continuar el trabajo en otra sesión. Estado al cierre + cómo seguir.
> Reglas del proyecto y estética: ver `CLAUDE.md` (NO repetir acá). Estilo de comunicación: caveman ultra (CLAUDE.md §9).
> _(Historial de la migración vanilla→Next está en el git log; este doc refleja el estado actual.)_

---

## 1. Estado actual (qué se hizo recién)

**Backend reescrito de cero (estable, deployable):**
- Migrado de Express (`server.js`, borrado) → route handlers Next en `app/api/*`. Un solo servicio, sin proxy.
- `lib/db.ts` → pool `pg` + `initDb` (CREATE TABLE IF NOT EXISTS) + runner de migraciones idempotentes (`MIGRATIONS[]`).
- `lib/storage.ts` → media por entorno: Cloudinary si hay credenciales (prod) / `public/uploads` si no (local). Local NUNCA toca Cloudinary.
- Rutas: `/api/content` (GET/POST), `/api/login` (admin + 2FA TOTP), `/api/upload-test`, `/api/delete-media`.
- Limpieza: removido express/cors/dotenv, +@types/pg, sacado proxy de `next.config.ts`.

**Frontend (fixes de esta tanda):**
- Estilo genérico único de contenedor vacío (dashed + tinte violeta + nube + nombre), igual en admin y visitante (visitante oculta icono/nombre, marco se mantiene). Label peso normal (400).
- Portada: carrusel lee de `state.items` (sin race de eventos), slides vacías permitidas, wave se mueve + pausa al hover, subtitle editable.
- 3D: slides 16/9 rectangulares, achicadas para no superponer el texto.
- typewriter loop en títulos/descripciones, lightbox panel desde el icono, rename de contenedores en vivo.

**Git:** commit `0715aa5` pusheado a `origin/main`. **Sin commitear:** edición de `CLAUDE.md` (sección "Setup & operación") + este `HANDOFF.md`.

---

## 2. Entorno local (cómo correr)

```bash
npm run dev      # ÚNICO comando. Ya NO existe `npm run server`.
```

- **PostgreSQL 17 nativo** corriendo como servicio Windows en `:5432`. DB: `artistportfolio`.
- `.env` local (gitignoreado) ya configurado:
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/artistportfolio`
  - Cloudinary **vacío** → uploads van a `public/uploads/` (gitignoreado).
  - `ADMIN_USER`, `ADMIN_PASS`, `ADMIN_2FA_SECRET` (el secret 2FA está en `.env`; cargarlo en una app autenticadora para el código de 6 dígitos).
- `initDb` crea las tablas al primer request. Verificado: persiste entre reinicios.

**Preview headless (mcp Claude_Preview):** el tab queda *frozen* (`visibilityState: hidden`) → rAF/IntersectionObserver/animaciones NO corren y los screenshots de secciones pesadas a veces cuelgan. Para animaciones → navegador real. Para lógica/CSS → `preview_eval` (computed styles, fetch a las rutas).

---

## 3. Modelo local ↔ producción (clave)

| | ¿Viaja con `git push`? |
|---|---|
| Código (front + API) | ✅ |
| Estructura DB (tablas/columnas, vía `MIGRATIONS[]`) | ✅ (corre al bootear) |
| **Datos/contenido** (imágenes, textos cargados) | ❌ por entorno, NO se sincronizan |

- Contenido de prod → se carga en el sitio live (admin). Contenido local → queda local.
- Cambios de esquema → agregar a `MIGRATIONS[]` en `lib/db.ts` (idempotente, no romper tablas).

---

## 4. Pendiente / próximos pasos

1. **Deploy a Railway** (lo que el usuario quiere):
   - 1 servicio app (este repo/`main`) + 1 servicio Postgres.
   - Setear en el **servicio app** (Variables): `DATABASE_URL` (referencia al Postgres), `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`, `ADMIN_USER/PASS/2FA_SECRET`.
   - Sin esas vars → mock (no persiste / no hay login). El build pasa igual.
   - El deploy viejo daba 500 por Express+proxy; eso ya no aplica (API en Next).
2. **Frontend:** queda por pulir (el usuario lo dijo explícito). El backend ya es estable para ir deployando.
3. **Commitear** `CLAUDE.md` + `HANDOFF.md` pendientes.

---

## 5. Mapa de archivos clave

| Área | Archivo |
|---|---|
| DB (pool + migraciones) | `lib/db.ts` |
| Storage media (env) | `lib/storage.ts` |
| Rutas API | `app/api/{content,login,upload-test,delete-media}/route.ts` |
| Cliente API (front) | `lib/api.ts` |
| Engine CMS (DOM/overlays/registro) | `components/cms/engine.ts` |
| Store CMS (estado, `CONTAINER_BASES`) | `lib/cms/store.ts` |
| Carrusel portada | `components/home/HeroMediaCarousel.tsx`, `components/cms/CarouselManager.tsx` |
| Estilo contenedor vacío (canónico) | `.cms-empty-overlay` + `.cms-empty-slot` en `styles/legacy/style.css` |
| Secciones | `components/home/{Hero,AboutSection,AnimationsShowcase,CharactersShowcase,ModelsShowcase}.tsx` |
| Animaciones GSAP | `hooks/useGSAP.ts` |

---

## 6. Gotchas (no tropezar de nuevo)

- **Contenedor vacío = estilo único** (CLAUDE.md): nunca overridear `background/border/radius` por sección. El engine borra TODOS los `.cms-empty-overlay` globalmente → para overlays propios usar clase distinta (ej. `.hero-carousel-empty`).
- **`header {}` legacy es `position: fixed`** → usar `<div>` para headers de sección.
- **Scroll container = `body`** (overflow-y), no window.
- **Railway Postgres público** requiere SSL (`rejectUnauthorized:false`); `lib/db.ts` lo detecta solo (no aplica a `localhost`/`.railway.internal`).
- **otplib v13**: API funcional `verify({ token, secret, epochTolerance })`, NO `authenticator`.
- **2 errores TS** que rompían el build ya arreglados (`char.desc` duplicado → `char.sectiondesc`; `ensureSlideMeta` sin `mount`). El build debe quedar en 0 errores.
