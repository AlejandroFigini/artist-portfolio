const fs = require('fs');
let css = fs.readFileSync('style.css', 'utf8');
const before = css.length;
const beforeLines = css.split('\n').length;
let ok = true;

// Remove from startAnchor up to (not including) endAnchor (searched AFTER start).
function removeBetween(startAnchor, endAnchor, label) {
  const s = css.indexOf(startAnchor);
  if (s < 0) { console.log('START NOT FOUND: ' + label); ok = false; return; }
  const e = css.indexOf(endAnchor, s + startAnchor.length);
  if (e < 0) { console.log('END NOT FOUND: ' + label); ok = false; return; }
  css = css.slice(0, s) + css.slice(e);
  console.log('OK: ' + label);
}

// 1. Legacy "char-card" accordion system (replaced by cd-* showcase)
removeBetween('/* Acordeón: 4 tarjetas en grid compacto */', '/* ============ Language Selectors (flag-icons) ============ */', 'char-card legacy');

// 2. Legacy "Asistente Alessio" mascot
removeBetween('/* Asistente Alessio (Cualquier lugar de la página) */', '/* Botón Configuración (Tuerca) - Esquina inferior opuesta */', 'alessio mascot');

// 3. Dead .item-tall / .item-wide  (keep /* Modal */ .modal)
removeBetween('.item-tall {', '/* Modal */', 'item-tall/item-wide');

// 4. Dead .modal-content / .close-btn / .modal-media-placeholder (keep /* Footer */)
removeBetween('.modal-content {', '/* Footer */', 'modal-content/close-btn/placeholder');

// 5. Dead alessio rules inside @media 480 (keep .gallery-section in same block)
removeBetween('    .alessio-avatar {', '    .gallery-section {', 'alessio media rules');

// Brace balance check
const opens = (css.match(/{/g) || []).length;
const closes = (css.match(/}/g) || []).length;
console.log('\nbraces: ' + opens + ' open / ' + closes + ' close  => ' + (opens === closes ? 'BALANCED' : 'MISMATCH!'));

if (ok && opens === closes) {
  fs.writeFileSync('style.css', css);
  const afterLines = css.split('\n').length;
  console.log('WROTE style.css | lines ' + beforeLines + ' -> ' + afterLines + ' (-' + (beforeLines - afterLines) + ')  bytes -' + (before - css.length));
} else {
  console.log('NOT WRITTEN (errors above)');
}
