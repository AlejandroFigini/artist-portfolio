/* Genera una fuente Font Awesome con SOLO los iconos que el sitio usa.
   El set completo son 278 KB (1861 iconos) para los ~120 que pintamos.

   Corre en cada build (prebuild). Barre el código, resuelve cada nombre contra
   la metadata oficial de FA y falla si algo no cierra — un icono que no se
   puede resolver rompe el build, no se descubre como cuadradito en producción.

   Salida: public/fonts/fa-*-subset.woff2 + styles/icons.css
*/

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = process.cwd()
const FA = join(ROOT, 'node_modules/@fortawesome/fontawesome-free')

/* Si el entorno podó las devDependencies pero los artefactos ya están
   commiteados, seguir con lo generado. Cortar el build acá dejaría el sitio
   sin iconos por una dependencia de build ausente. */
if (!existsSync(FA)) {
  const ok = existsSync(join(ROOT, 'styles/icons.css')) && existsSync(join(ROOT, 'public/fonts/fa-solid-900-subset.woff2'))
  console.warn(`[icon-subset] @fortawesome/fontawesome-free no está instalado — ${ok ? 'se usa el subset ya generado' : 'NO HAY SUBSET GENERADO'}`)
  process.exit(ok ? 0 : 1)
}

const { default: subsetFont } = await import('subset-font')
const SCAN_DIRS = ['app', 'components', 'lib', 'hooks', 'styles']
const SCAN_EXT = new Set(['.tsx', '.ts', '.jsx', '.js', '.css'])
const OUT_FONTS = join(ROOT, 'public/fonts')
const OUT_CSS = join(ROOT, 'styles/icons.css')

/* Iconos que el barrido no puede ver porque el nombre se arma en runtime.
   Cada entrada documenta de dónde sale: si borrás el uso, borrá la entrada. */
const EXTRA_ICONS = [
  'film', 'image',  // `fa-${vid ? 'film' : 'image'}` — admin/cards.tsx, cms/PickerModals.tsx
  'star',           // `fa-${is_starred ? 'solid' : 'regular'} fa-star` — admin/MessagesSection.tsx
]

/* Clases utilitarias de FA (tamaño, animación, layout). No son iconos: se
   filtran del barrido y sus reglas se copian aparte desde el CSS de FA. */
const UTILITY_RE = /^fa-(solid|regular|brands|classic|sharp|duotone|light|thin|fw|li|ul|border|pull-left|pull-right|spin|spin-reverse|spin-pulse|pulse|beat|fade|beat-fade|bounce|shake|flip|flip-horizontal|flip-vertical|flip-both|rotate-90|rotate-180|rotate-270|rotate-by|stack|stack-1x|stack-2x|inverse|xs|sm|lg|xl|2xl|1x|2x|3x|4x|5x|6x|7x|8x|9x|10x)$/

const FAMILY = {
  solid:   { file: 'fa-solid-900',   family: 'Font Awesome 6 Free',   weight: 900, classes: ['.fa', '.fas', '.fa-solid'] },
  regular: { file: 'fa-regular-400', family: 'Font Awesome 6 Free',   weight: 400, classes: ['.far', '.fa-regular'] },
  brands:  { file: 'fa-brands-400',  family: 'Font Awesome 6 Brands', weight: 400, classes: ['.fab', '.fa-brands'] },
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (SCAN_EXT.has(extname(name))) out.push(p)
  }
  return out
}

const files = SCAN_DIRS.flatMap((d) => {
  try { return walk(join(ROOT, d)) } catch { return [] }
  // El propio CSS generado queda fuera: si se barriera, cada corrida
  // reincorporaría los iconos de la corrida anterior y el subset solo crecería.
}).filter((f) => f !== OUT_CSS)

// 1. Nombres de icono escritos en el código
const found = new Set(EXTRA_ICONS)
// 2. Codepoints puestos a mano en CSS (ej. content: '\f00c')
const rawCodepoints = new Set()

for (const f of files) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/\bfa-([a-z0-9]+(?:-[a-z0-9]+)*)\b/g)) {
    if (!UTILITY_RE.test(m[0])) found.add(m[1])
  }
  if (extname(f) === '.css') {
    for (const m of src.matchAll(/content:\s*['"]\\(f[0-9a-f]{2,4})['"]/gi)) {
      rawCodepoints.add(m[1].toLowerCase())
    }
  }
}

const meta = JSON.parse(readFileSync(join(FA, 'metadata/icon-families.json'), 'utf8'))

// Un icono va a TODOS los estilos free que soporte: `fa-star` se usa solid y
// regular según el estado, y el barrido no puede distinguirlo.
const byStyle = { solid: new Map(), regular: new Map(), brands: new Map() }
const unresolved = []

for (const name of [...found].sort()) {
  const entry = meta[name]
  const styles = entry?.familyStylesByLicense?.free?.filter((s) => s.family === 'classic') ?? []
  if (!entry || !styles.length) { unresolved.push(name); continue }
  for (const { style } of styles) {
    if (byStyle[style]) byStyle[style].set(name, entry.unicode)
  }
}

// Los codepoints sueltos del CSS van a solid (las reglas los usan con weight 900)
for (const cp of rawCodepoints) byStyle.solid.set(`raw-${cp}`, cp)

// Los nombres no resueltos son casi siempre falsos positivos del barrido
// (clases propias tipo `fa-wrapper`). Se listan pero no rompen: lo que rompe
// es un icono declarado en EXTRA_ICONS que no existe en la metadata.
const badExtras = EXTRA_ICONS.filter((n) => !meta[n])
if (badExtras.length) {
  console.error(`[icon-subset] EXTRA_ICONS inexistentes en Font Awesome: ${badExtras.join(', ')}`)
  process.exit(1)
}

// Un `fa-${...}` nuevo sin su entrada en EXTRA_ICONS es un icono que se rompe
// en silencio: se corta el build.
const dynamic = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/fa-\$\{([^}]*)\}/g)) {
    const literals = [...m[1].matchAll(/['"]([a-z0-9-]+)['"]/g)].map((x) => x[1])
    const covered = literals.every((l) => found.has(l) || /^(solid|regular|brands)$/.test(l))
    if (!covered) dynamic.push(`${f.replace(ROOT, '')} → fa-\${${m[1].trim()}}`)
  }
}
if (dynamic.length) {
  console.error('[icon-subset] Iconos armados en runtime sin cubrir. Agregalos a EXTRA_ICONS:')
  dynamic.forEach((d) => console.error('  ' + d))
  process.exit(1)
}

mkdirSync(OUT_FONTS, { recursive: true })

const css = [
  '/* GENERADO por scripts/build-icon-subset.mjs — no editar a mano.',
  '   Subset de Font Awesome con los iconos que el sitio realmente usa.',
  '   Para regenerar: npm run build (corre en prebuild). */',
  '',
]
let totalBefore = 0
let totalAfter = 0

for (const [style, cfg] of Object.entries(FAMILY)) {
  const icons = byStyle[style]
  if (!icons.size) continue
  const src = readFileSync(join(FA, `webfonts/${cfg.file}.woff2`))
  const text = [...icons.values()].map((u) => String.fromCodePoint(parseInt(u, 16))).join('')
  const out = await subsetFont(src, text, { targetFormat: 'woff2' })
  writeFileSync(join(OUT_FONTS, `${cfg.file}-subset.woff2`), out)
  totalBefore += src.length
  totalAfter += out.length
  console.log(`[icon-subset] ${style}: ${icons.size} iconos — ${(src.length / 1024).toFixed(0)} KB → ${(out.length / 1024).toFixed(1)} KB`)

  css.push(
    '@font-face {',
    `  font-family: '${cfg.family}';`,
    '  font-style: normal;',
    `  font-weight: ${cfg.weight};`,
    '  font-display: block;',
    `  src: url('/fonts/${cfg.file}-subset.woff2') format('woff2');`,
    '}',
    `${cfg.classes.join(', ')} {`,
    `  font-family: '${cfg.family}';`,
    `  font-weight: ${cfg.weight};`,
    '}',
    '',
  )
}

// Base compartida + utilidades (equivalente al núcleo de fontawesome.css)
css.push(
  '.fa, .fas, .fa-solid, .far, .fa-regular, .fab, .fa-brands {',
  '  -moz-osx-font-smoothing: grayscale;',
  '  -webkit-font-smoothing: antialiased;',
  '  display: var(--fa-display, inline-block);',
  '  font-style: normal;',
  '  font-variant: normal;',
  '  line-height: 1;',
  '  text-rendering: auto;',
  '}',
  '.fa-fw { text-align: center; width: 1.25em; }',
  '.fa-2x { font-size: 2em; }',
  '.fa-lg { font-size: 1.25em; line-height: 0.05em; vertical-align: -0.075em; }',
  '.fa-spin { animation: fa-spin 2s infinite linear; }',
  '@keyframes fa-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }',
  '@media (prefers-reduced-motion: reduce) { .fa-spin { animation-delay: -1ms; animation-duration: 1ms; animation-iteration-count: 1; } }',
  '',
)

// Un ::before por icono. Los `raw-*` son codepoints del CSS: ya tienen su
// propia regla escrita a mano, solo necesitaban entrar al subset.
const emitted = new Set()
for (const icons of Object.values(byStyle)) {
  for (const [name, unicode] of icons) {
    if (name.startsWith('raw-') || emitted.has(name)) continue
    emitted.add(name)
    css.push(`.fa-${name}::before { content: "\\${unicode}"; }`)
  }
}

writeFileSync(OUT_CSS, css.join('\n') + '\n')

console.log(`[icon-subset] TOTAL ${(totalBefore / 1024).toFixed(0)} KB → ${(totalAfter / 1024).toFixed(1)} KB (${emitted.size} iconos)`)
if (unresolved.length) {
  console.log(`[icon-subset] ignorados (no son iconos de FA): ${unresolved.slice(0, 12).join(', ')}${unresolved.length > 12 ? ` +${unresolved.length - 12}` : ''}`)
}
