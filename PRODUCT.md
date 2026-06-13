# Product

## Register

brand

## Users

Reclutadores de estudios de animación/videojuegos, art directors y clientes
freelance evaluando a Lucía Montaña (artista 2D/3D, Montevideo). Llegan con
poco tiempo, desde un link en CV/redes, a decidir en segundos si el trabajo
los retiene. Audiencia secundaria: la propia artista editando contenido vía
el CMS integrado.

## Product Purpose

Portfolio cinematográfico que demuestra el oficio de la artista *siendo él
mismo una pieza de craft*: animación, timing y dirección visual aplicados a
la web. Éxito = el visitante explora más de una sección y contacta.

## Brand Personality

Cinemática, técnica, viva. La estética **blueprint cinematic** es la
identidad central (grilla técnica, HUD, coordenadas, violeta/cyan sobre
fondos profundos) — definida en CLAUDE.md del repo y nunca se compromete
por conveniencia técnica. Todo respira: partículas, gradientes animados,
elementos flotantes; nada estático.

## Anti-references

- Portfolios-template de Behance/Squarespace: grilla de cards uniformes,
  hero estático con foto y dos botones.
- Editorial-typographic genérico (serif italic + mono labels + rules) —
  no es una revista; es un plano técnico en movimiento.
- Páginas sin movimiento o con fade-on-scroll uniforme en cada sección.

## Design Principles

1. **El sitio es el reel.** Cada interacción demuestra timing y craft de
   animación; si una sección no se mueve con intención, está incompleta.
2. **Blueprint primero.** Los adornos son instrumentos técnicos (grillas,
   marcas de registro, HUD, coordenadas), no decoración genérica.
3. **El contenedor es la unidad atómica.** Media intercambiable por CMS;
   el contenedor conserva aspect, animación y estados vacíos.
4. **Movimiento accesible.** Todo respeta prefers-reduced-motion con
   alternativa estática digna; transform/opacity para 60fps.
5. **Identidad sobre novedad.** Mejoras nuevas amplifican el lenguaje
   blueprint existente; no introducen un segundo lenguaje visual.

## Accessibility & Inclusion

- `prefers-reduced-motion: reduce` obligatorio en toda animación.
- Responsive 320px → 1920px+ (tabla de breakpoints en CLAUDE.md §8).
- Contraste AA en texto sobre fondos animados (overlays oscurecen el media).
- Touch: hover-reveals tienen equivalente de primer-tap (patrón legacy).
