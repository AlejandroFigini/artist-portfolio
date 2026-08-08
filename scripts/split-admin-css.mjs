/* Separa de styles/legacy/style.css los bloques que SOLO pueden aplicar en modo
   gestión, para que no viajen en la hoja que bloquea el render del visitante.

   Medido con coverage sobre producción: de 217 KB de CSS el visitante usa el
   36%, y 51 KB son selectores de CMS/admin con 1% de uso. Esa hoja es la que
   ata el FCP (40 KB comprimidos compitiendo con 238 KB de JS por el mismo
   caño), así que sacarle los bytes que nadie va a usar baja el FCP y, con él,
   el LCP.

   Seguridad del corte: un bloque se mueve solo si su selector NO puede matchear
   nada del DOM que ve un visitante. Por eso hay dos listas y KEEP gana siempre:
   los contenedores vacíos, el media montado y los retirados SÍ los ve el
   visitante aunque su clase empiece con `cms-`.

   Uso:  node scripts/split-admin-css.mjs --check   (solo reporta)
         node scripts/split-admin-css.mjs --write   (aplica) */

import fs from 'node:fs'
import path from 'node:path'

const SRC = path.join('styles', 'legacy', 'style.css')
const OUT = path.join('styles', 'legacy', 'admin.css')

/* Clases `cms-*` que el visitante SÍ ve. Si un selector toca cualquiera de
   estas se queda en la hoja principal, sin importar qué más mencione. */
const KEEP = [
  'cms-empty-slot',
  'cms-empty-overlay',
  'cms-media',
  'cms-mount',
  'cms-retired',
  'hide-cms-controls',
]

/* Familias que solo existen con sesión de gestión abierta. */
const ADMIN = [
  'is-admin',
  'cms-tools',
  'cms-edit',
  'cms-tool-btn',
  'cms-modal',
  'cms-picker',
  'cms-repo',
  'cms-filter',
  'cms-icon-btn',
  'cms-container-editable',
  'cms-rename',
  'cms-slot',
  'cms-count',
  'cms-section',
  'cms-hint',
  'cms-label',
  'cms-input',
  'cms-select',
  'cms-textarea',
  'cms-checkbox',
  'cms-radio',
  'cms-badge',
  'cms-title',
  'cms-sub',
  'cms-head',
  'cms-foot',
  'cms-close',
  'cms-nav',
  'cms-lang-admin',
  'cms-auth',
  'cms-session',
  'cms-gear',
  'cms-hero-gear',
  'cms-name',
  'cms-dup',
  'cms-trash',
  'cms-basurero',
  'cms-unused',
  'cms-used',
  'cms-mlib',
  'cms-admin',
  'cms-btn',
  'cms-info',
  'cms-audit',
  'cms-manager',
  'cms-collection',
  'cms-upload',
  'cms-login',
  'cms-setup',
  'cms-export',
  'cms-confirm',
  'cms-overlay',
  'cms-drop',
  'cms-field',
  'cms-row',
  'cms-lib',
  'cms-seg',
  'cms-switch',
  'cms-toast',
  'cms-tag',
  'cms-social',
  'cms-settings',
  'ga-',
  'admin-',
]

const has = (sel, list) => list.some((k) => sel.includes(k))

/** Corta el CSS en bloques de nivel superior conservando el texto literal. */
function topLevelBlocks(css) {
  const blocks = []
  let i = 0
  let start = 0
  while (i < css.length) {
    const ch = css[i]
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end < 0 ? css.length : end + 2
      continue
    }
    if (ch === '{') {
      let depth = 1
      let j = i + 1
      while (j < css.length && depth > 0) {
        if (css[j] === '/' && css[j + 1] === '*') { const e = css.indexOf('*/', j + 2); j = e < 0 ? css.length : e + 2; continue }
        if (css[j] === '{') depth++
        else if (css[j] === '}') depth--
        j++
      }
      /* El prefijo arrastra los comentarios que preceden a la regla. Se guardan
         en `text` (van con el bloque) pero NO deben decidir la clasificación:
         un comentario que diga "vacío" no convierte a la regla en visible. */
      const prefix = css.slice(start, i).replace(/\/\*[\s\S]*?\*\//g, ' ').trim()
      blocks.push({ text: css.slice(start, j), selector: prefix })
      i = j
      start = j
      continue
    }
    i++
  }
  if (start < css.length) blocks.push({ text: css.slice(start), selector: '' })
  return blocks
}

const css = fs.readFileSync(SRC, 'utf8')
const blocks = topLevelBlocks(css)

const moved = []
const kept = []
for (const b of blocks) {
  const sel = b.selector
  // Las at-rules con cuerpo (@media, @supports) se quedan: pueden mezclar
  // reglas de admin y de visitante, y partirlas por dentro es otro problema.
  const isAtRule = sel.startsWith('@')
  const isAdmin = !isAtRule && sel !== '' && has(sel, ADMIN) && !has(sel, KEEP)
  ;(isAdmin ? moved : kept).push(b)
}

const movedBytes = moved.reduce((s, b) => s + b.text.length, 0)
const keptBytes = kept.reduce((s, b) => s + b.text.length, 0)

console.log(`[split-admin-css] bloques: ${blocks.length} | a admin.css: ${moved.length} | quedan: ${kept.length}`)
console.log(`[split-admin-css] ${Math.round(movedBytes / 1024)} KB salen de la hoja crítica, quedan ${Math.round(keptBytes / 1024)} KB`)

if (process.argv.includes('--check')) {
  console.log('\n--- muestra de lo que se movería ---')
  moved.slice(0, 25).forEach((b) => console.log('  ', b.selector.replace(/\s+/g, ' ').slice(0, 90)))
  console.log('\n--- selectores con `cms-` que SE QUEDAN (deben ser los visibles) ---')
  kept.filter((b) => b.selector.includes('cms-')).slice(0, 25).forEach((b) => console.log('  ', b.selector.replace(/\s+/g, ' ').slice(0, 90)))
  process.exit(0)
}

if (!process.argv.includes('--write')) {
  console.error('Usá --check para revisar o --write para aplicar.')
  process.exit(1)
}

const header = `/* Estilos que SOLO aplican en modo gestión — extraídos de legacy/style.css
   por scripts/split-admin-css.mjs. No los carga el visitante: se importan bajo
   demanda al activarse el modo admin, para no meter 50 KB que nadie va a usar
   en la hoja que bloquea el primer render. */\n\n`

fs.writeFileSync(OUT, header + moved.map((b) => b.text).join(''), 'utf8')
fs.writeFileSync(SRC, kept.map((b) => b.text).join(''), 'utf8')
console.log(`[split-admin-css] escrito ${OUT}`)
