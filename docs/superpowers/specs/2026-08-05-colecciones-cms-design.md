# Reestructuración del sistema de colecciones del CMS (carruseles y galerías)

**Fecha**: 2026-08-05
**Estado**: aprobado para planificación
**Alcance**: `components/cms/`, `lib/cms/`, `components/home/`, `components/ui/useCarouselSync.ts`

---

## 1. Problema

Las galerías dinámicas (carruseles de portada, proyectos, personajes) generan bugs
intermitentes al agregar, quitar, reordenar o asignar contenido a una slide. La causa
no es un bug puntual: es el modelo de datos.

### 1.1 Causa raíz — el índice es la identidad

Las claves del CMS son posicionales:

```
hero.slide#0
proj#2::title
char#5::c1
```

La posición **es** el identificador. Por lo tanto reordenar o borrar un item obliga a
reescribir, a mano y en cascada:

- la clave del media principal,
- todas sus claves `::campo` (`::title`, `::name`, `::role`, `::summary`, `::start_date`, …),
- todos sus slots de concept art (`::c0`…`::c2`),
- la entrada correspondiente en `state.usedContent` (que rige la carpeta de Cloudinary
  `en-uso` / `sin-usar`),
- el espejo en `localStorage[cms_overrides]`,
- y el payload que se manda a `POST /api/content`.

Cada operación de UI es, de hecho, una migración de datos manual. Existen **cinco
implementaciones independientes y divergentes** de esa migración:

| # | Ubicación | Divergencia |
|---|---|---|
| 1 | `CarouselManager.saveGraph` | archiva dos veces (pasos 2 y 4 duplicados) |
| 2 | `ProjectsManager.saveGraph` | remapea `usedContent` después del `saveContent` |
| 3 | `CharactersManager.saveGraph` | igual que 2, pero con otro conjunto de sufijos |
| 4 | `engine.deleteProjectSite` | **no** remapea `usedContent` en absoluto |
| 5 | `store.compactList` | reindexa por `Set<number>` de índices borrados |

Dos rutas de borrado de proyecto (#2 y #4) dejan el estado en formas distintas. Ese es
el origen de los "bugs fantasma".

### 1.2 Segunda autoridad sobre las mismas claves

`proj`, `char`, `illustration` y `anim` tienen entrada en el `REGISTRY` de
`engine.ts` con selector DOM y `mount: 'parent'`. El engine les asigna `proj#i`
**por orden en el documento**, mientras el manager les asigna `proj#i` **por su propio
array en memoria**. Con los clones de loop de Embla intercalados en el DOM, ambas
numeraciones divergen y el contenido se aplica a la tarjeta equivocada.

### 1.3 Bugs concretos derivados

1. **Doble archivado** — `CarouselManager.tsx:104-133`: el paso 2 archiva y borra las
   claves ausentes de `finalSlides`; el paso 4 repite la misma operación. Media enviada
   a "sin usar" por duplicado.
2. **Bucle de auto-guardado** — `ProjectsManager.tsx:70` y `CharactersManager.tsx:75`:
   `useEffect([storeVersion, items])` llama `saveGraph()` → `emit()` → sube
   `storeVersion` → el efecto vuelve a correr. Además `saveGraph` hace `setItems(fresh)`,
   que también es dependencia. Las únicas guardas son un flag `hasPending` y un
   `setTimeout(0)`. Dispara peticiones de red desde un efecto.
3. **Tres defaults de `count` divergentes** — `CarouselManager.parseSettings` infiere el
   count contando slides consecutivas cuando vale 0; `HeroMediaCarousel.readCarousel`
   usa solo `settings.count` (default 0); `engine.broadcastCarousel` usa default 3.
   Al limpiar una colección reaparecen slides fantasma.
4. **Tres mecanismos de render distintos** para el mismo dato:
   - `Slideshow` escucha el `CustomEvent` `cms:hero` y guarda estado React propio —
     **nunca lee el store**. Si el evento ya se emitió antes de que el componente
     montara (navegación entre rutas, remount), queda vacío.
   - `HeroMediaCarousel` lee `state.items` en render. Correcto.
   - Los showcases de Embla renderizan con React, luego `useCarouselSync` hace
     `api.reInit()` y dispara `rescan()` con `setTimeout(100)` / `setTimeout(300)`,
     que muta el DOM por encima de lo que React acaba de pintar.
5. **`window.location.reload()`** tras "Save carousel" (`CarouselManager.tsx:217`),
   usado para tapar la desincronización.
6. **`move()` inconsistente** — en `CarouselManager` solo marca dirty; en Projects y
   Characters dispara `saveGraph` asíncrono **y** `setState`, en carrera con el efecto
   del punto 2.
7. **Reconciliación de `overrides` escrita a mano tres veces**, con lógica distinta en
   cada manager.
8. **Duplicación menor**: los literales `'url("")'` / `'url()'` repetidos en tres
   archivos; `setDummy` muerto en `ProjectsManager.tsx:214`; el chequeo hardcodeado
   `s.count !== 6 || state.items['proj#4']` en `ProjectsShowcase.tsx:178` y en
   `engine.ts:1043`.

---

## 2. Decisiones tomadas

| Decisión | Elección |
|---|---|
| Identidad de los items | uid estable + migración |
| Datos de producción | descartables (recargables a mano desde el admin) |
| Forma del panel de admin | un `CollectionManager` único, parametrizado por spec |
| Mecanismos de sync | una sola fuente de verdad: el store |
| Slots de tamaño fijo | entran al alcance, pero solo unifican **API**, no identidad |

---

## 3. Modelo de datos

### 3.1 Colecciones dinámicas

La identidad pasa a ser un uid inmutable. La forma de la clave no cambia; solo el
índice se reemplaza por el uid:

```
proj#0          →  proj#k3f9
proj#0::title   →  proj#k3f9::title
proj#0::c1      →  proj#k3f9::c1
hero.slide#0    →  hero#k3f9          ← se unifica: desaparece el infijo `.slide`
```

El orden vive en **una sola clave**, reutilizando `<prefix>.settings`:

```json
"proj.settings"  →  {"ids":["k3f9","m2b1","p8x4"]}
"hero.settings"  →  {"ids":["a1c7","b3d9"],"duration":7000}
```

`count` desaparece: la longitud de `ids` es el count. Se eliminan los tres defaults
divergentes del punto 1.3.3.

Se reutiliza la clave `.settings` (en lugar de introducir `.order`) porque
`isTranslatableEntry()` en `lib/i18n.ts` ya excluye el patrón `*.settings`. Una clave
nueva obligaría a agregar una exclusión, con el riesgo de que el array de ids terminara
en el export de traducciones.

**Generación de uid**: 6 caracteres base36 desde `crypto.getRandomValues`, verificados
contra los ids existentes de esa colección en el momento de la generación.

**Consecuencia directa**: reordenar equivale a escribir **una** clave. Cero remapeo de
`::campos`, cero remapeo de `usedContent`, cero `archiveMediaKey` espurio.

### 3.2 Slots de tamaño fijo

`illustration#0..14`, `model3d#0..5`, `model3d.gallery#0..11`, `soft.global#*`,
`char.soft#*`, `anim.soft#*`, `proj.soft#*`, `model3d.soft#*`, `hero.wave#*`,
`hero.marquee#*` **conservan la clave posicional**.

Rationale: su identidad *es* la posición en el markup estático — `illustration#7` es la
celda 7 del bento, no un item movible. Asignarles un uid exigiría una tabla de mapeo
posición↔uid que puede desincronizarse, reintroduciendo la misma clase de bug desde el
otro lado. No se reordenan ni se agregan, así que no producen los bugs de la sección 1.

Lo que sí unifican es la superficie de API: mismo hook de lectura, mismo overlay de
contenedor vacío, mismo camino de archivado, mismo `ensureMeta`.

---

## 4. Arquitectura

### 4.1 `lib/cms/collections.ts` — declaración de specs

```ts
export type CollectionSpec = {
  prefix: string                    // 'hero' | 'hero-main' | 'hero-sub' | 'about-carousel' | 'proj' | 'char'
  label: string                     // 'Hero Carousel'
  itemNoun: string                  // 'slide' | 'project' | 'character'
  section: string                   // sección del CMS, para el archivado
  accept: string                    // 'webp'
  max?: number                      // 4 para los carruseles de portada
  duration?: boolean                // true si la colección rota
  concepts?: number                 // 0 | 3 → slots ::c0..cN
  fields?: { key: string; label: string; type: 'text' | 'textarea' | 'date' }[]
}
```

Seis specs declaradas: `hero`, `hero-main`, `hero-sub`, `about-carousel` (solo media +
duración) y `proj`, `char` (media + campos + conceptos).

`anim` no se declara: es vestigial — `anim#i` solo aparece en
`getAllKnownContainerKeys` y no tiene manager ni consumidor.

### 4.2 `lib/cms/collection.ts` — implementación única

```ts
export function useCollection(spec: CollectionSpec): {
  ids: string[]                     // orden actual, editable en memoria
  dirty: boolean
  add(): string                     // devuelve el uid nuevo
  remove(id: string): void
  move(id: string, dir: -1 | 1): void
  setDuration(ms: number): void
  commit(): Promise<void>
}
```

`add` / `remove` / `move` / `setDuration` son **puras sobre el estado en memoria**. No
tocan disco ni red. Esto elimina el bucle de auto-guardado (1.3.2) y la carrera de
`move()` (1.3.6).

`commit()` es una transacción con **una sola llamada de red**:

1. `removed = prevIds − ids`
2. `archiveMediaKey` únicamente sobre `removed`, una vez, incluyendo sus `::cN`
3. borrar de `state.items` todas las claves de `removed` (media, campos y conceptos)
4. `payload = { '<prefix>.settings': JSON.stringify({ids, duration}), ...clavesDeRemoved: '' }`
5. un `saveContent(payload)` — `POST /api/content` ya trata `''` como DELETE de fila
6. el mismo payload al espejo `overrides` en localStorage
7. `emit()`

Un reordenamiento puro deja `removed` vacío → el payload es una sola clave.

Funciones auxiliares exportadas, para que no vuelvan a duplicarse:

- `mediaKeysOf(spec, id)` → `[prefix#id, prefix#id::c0, …]`
- `fieldKeysOf(spec, id)` → `[prefix#id::title, …]`
- `isEmptyMedia(src)` → centraliza los literales `'url("")'` / `'url()'` (1.3.8)
- `readIds(prefix)` → parsea `.settings`, tolerante a JSON inválido, default `[]`

### 4.3 `components/cms/CollectionManager.tsx` — manager único

Reemplaza `CarouselManager` + `ProjectsManager` + `CharactersManager`
(1154 líneas → objetivo ~350). Renderiza una fila simple o una fila rica según el spec
declare `fields` / `concepts`.

Cambios de comportamiento visibles para el admin:

- **Un solo botón "Save"**. Desaparece el flujo de dos pasos y el mensaje "Save
  structure first": el uid existe desde que se aprieta Add, así que el picker puede
  escribirle imagen inmediatamente.
- **Sin recarga de página** al guardar.
- El chip de estado se conserva (los cuatro estados actuales: sin cambios / faltan
  imágenes / listo para guardar), adaptado a un solo botón.

Los textos visibles siguen en inglés; los comentarios de código, en español.

### 4.4 Render — una sola fuente de verdad

Todos los consumidores leen del store vía `useCollection`. Se elimina:

| Se elimina | Reemplazo |
|---|---|
| `engine.broadcastCarousel()` | suscripción al store |
| el listener `cms:hero` de `Slideshow` | `useCollection(HERO)` |
| `window.location.reload()` tras guardar | `emit()` |
| el `setTimeout(() => rescan(), 100/300)` de `useCarouselSync` | — |
| la rama de slides de `engine.applyMedia` | solo `emit()` |

`useCarouselSync` conserva `api.reInit()` cuando cambia la firma de contenido: Embla
genuinamente necesita reconstruir sus clones. Lo que se quita es el `rescan()` diferido.

### 4.5 El engine lee `data-cms-key`, no lo asigna

Para las colecciones dinámicas, el markup de React emite `data-cms-key="proj#k3f9"` y
el engine **lee** ese atributo al indexar. Deja de asignar `base#i` por orden de
documento. Esto resuelve la doble autoridad de la sección 1.2 y la divergencia con los
clones de Embla.

Para los slots fijos el comportamiento no cambia: se siguen indexando posicionalmente,
que es su identidad correcta.

### 4.6 Limpieza asociada

| Se elimina / reescribe | Motivo |
|---|---|
| `ensureSlideMeta` + `ensureProjectMeta` + `ensureCharacterMeta` | → un `ensureCollectionMeta(key)` derivado del spec |
| `engine.deleteProjectSite` (4ª reindexación) | → `remove(id)` + `commit()` |
| `store.compactList` (5ª reindexación) | queda sin uso |
| entradas `*.slide` del REGISTRY | eran `mount:'none'`; sus labels pasan al spec |
| el hardcodeo `count !== 6 \|\| items['proj#4']` en `ProjectsShowcase` y `engine` | sin sentido con `ids` |
| `setDummy` en `ProjectsManager` | estado muerto |
| la rama de carruseles de `engine.clearKeys` | → `collection.clear(prefix)` |
| `getAllKnownContainerKeys`: los tramos de colecciones dinámicas | se derivan de `.settings.ids`; los tramos de slots fijos quedan igual |

---

## 5. Migración

`migrateCollections()` en `lib/cms/collection.ts`, ejecutada una vez al hidratar el
store en modo admin, después del fetch de `/api/content`:

1. Para cada spec: si `.settings` ya contiene `ids`, no hacer nada. **Idempotente.**
2. Si contiene `count` (formato legacy): generar un uid por índice; copiar
   `<prefix>#<i>` (o `<prefix>.slide#<i>`) y todos sus sufijos `::*` a `<prefix>#<uid>`;
   escribir el `.settings` nuevo; vaciar las claves viejas con `''`.
3. Un solo `saveContent` con todo el resultado.

Los datos de producción son descartables por decisión del usuario, así que no se
implementa respaldo ni rollback. Si algo queda inconsistente, el contenido se recarga a
mano desde el admin.

---

## 6. Manejo de errores

- `readIds()` tolera JSON inválido o ausente → devuelve `[]`. Nunca lanza.
- Si `commit()` falla en el `saveContent`, el estado en memoria **no** se revierte (el
  usuario ve sus cambios) pero el toast reporta el fallo y `dirty` sigue en `true`, de
  modo que reintentar es un click. No se hace rollback parcial: dejaría el estado en una
  forma peor que el fallo.
- La migración corre dentro de un `try/catch`. Si falla, se registra en consola y el
  admin sigue funcionando con el formato legacy — no se rompe el sitio.
- `useCollection` fuera de modo admin es solo-lectura: `commit()` es un no-op.

---

## 7. Criterios de verificación

Probados en local con Postgres y contenido cargado:

1. Reordenar tres proyectos → el POST manda **solo** `proj.settings`. Ninguna imagen
   aparece en "sin usar".
2. Borrar el proyecto del medio → solo sus claves se vacían; los otros dos conservan su
   uid, su título y sus conceptos.
3. Agregar slide → subir imagen → guardar: un solo click, sin recarga de página, la
   portada repinta sola.
4. "Limpiar todo" → las seis colecciones quedan con `ids: []`, el contenedor vacío
   muestra el estilo dashed correcto, y no reaparecen slides al recargar.
5. Navegar a `/about` y volver al home → `Slideshow` sigue pintando (hoy depende de que
   el `CustomEvent` haya llegado después del montaje).
6. Con el carrusel de proyectos en loop (clones de Embla activos), editar la tarjeta 2
   desde el sitio → se edita la tarjeta 2, no un clon.
7. Cambiar de idioma con una colección montada → el contenido del CMS se traduce y
   volver al idioma base restaura el texto original.
8. Responsive verificado a 320 / 375 / 768 / 1024 / 1440 px en el manager y en los seis
   carruseles.
9. `npm run build` correcto y lint en cero.

---

## 8. Riesgos declarados

1. **Regex de índice numérico.** Hay chequeos `/^proj#(\d+)/`, `/^char#(?:new_)?\d+/`,
   `/^(.+)\.slide#\d+$/` repartidos por `engine.ts`, `store.ts` y los showcases. Todos
   deben pasar a aceptar uid alfanumérico. Es el punto donde es más probable que se
   escape una ocurrencia; se barre con una búsqueda exhaustiva antes de dar por cerrada
   la implementación.
2. **`UploadModal` y los pickers** escriben claves directamente en `state.items`. Hay que
   verificar que ninguno construya la clave concatenando un índice.
3. **Tamaño de archivo.** `CollectionManager.tsx` debe quedar por debajo de 500 líneas
   (regla del proyecto). Si la fila rica y la fila simple no entran cómodas juntas, se
   extrae `CollectionRow.tsx` como componente hijo — no se vuelve a dividir por tipo de
   colección.
