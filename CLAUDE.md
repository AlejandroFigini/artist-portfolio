# Artist Portfolio — Lucia Montaña

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

### 10. Performance

- Usar Core Web Vitals como criterio de aceptación: LCP < 2.5s, CLS < 0.1, INP < 200ms.
- Lazy loading por defecto en imágenes y componentes pesados.
- Code splitting por ruta en Next.js (`dynamic()` para componentes grandes).
- Imágenes en formato moderno (WebP/AVIF) con `next/image`.
- Animaciones solo con propiedades `transform` y `opacity` para evitar reflows y forzar GPU acceleration.
- Usar `will-change` con criterio — solo en elementos que realmente animarán.

---

## Stack objetivo

Este proyecto está migrando a **Next.js 15 (App Router) + Tailwind CSS v4 + TypeScript**.

Cualquier trabajo nuevo debe hacerse en ese stack. No agregar código nuevo en HTML/CSS/JS vanilla.

## Stack actual (legado — no extender)

- Vanilla HTML/CSS/JS
- Express + PostgreSQL + Cloudinary
- GSAP para animaciones

El backend Express se mantiene sin cambios.

## Plan de migración

Ver `docs/migration-react-nextjs.md` — tiene el plan completo dividido en 3 sesiones con prompts listos para ejecutar.

## Reglas

### Stack y frameworks

- Nuevos componentes → React + Tailwind
- Nuevas páginas → Next.js App Router (`app/`)
- Animaciones de UI y transiciones entre páginas → Framer Motion
- Animaciones complejas (cursor, canvas, SVG, secuencias) → GSAP con `useEffect` + cleanup
- Estilos → Tailwind utility classes + variables CSS para la estética blueprint
- El backend Express no se toca

### Diseño y experiencia visual

- La estética **blueprint cinematic** es la identidad central del proyecto — nunca comprometer esa identidad en favor de conveniencia técnica.
- El diseño debe ser moderno, sofisticado y con vida. Evitar páginas estáticas o sin movimiento.
- Cada sección o panel que aparece en pantalla debe tener una animación de entrada definida (estado inicial oculto/reducido → animación de reveal al hacer scroll o al montar).
- Usar stagger en listas y grillas: los elementos deben aparecer en cascada, nunca todos juntos.
- Priorizar movimiento continuo donde corresponda: partículas, gradientes animados, elementos flotantes.
- Antes de implementar una animación, buscar una referencia visual concreta (Awwwards, Dribbble, CodePen). Documentar la referencia en el componente con un comentario de una línea.

### Animaciones — reglas técnicas

- GSAP: cursor custom, canvas, SVG, starfield, secuencias cronometradas complejas.
- Framer Motion: transiciones de ruta (`AnimatePresence`), micro-interacciones, reveals on-scroll con `whileInView`.
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
