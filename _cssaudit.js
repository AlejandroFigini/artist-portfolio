const fs = require('fs');

const css = fs.readFileSync('style.css', 'utf8');
const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

// Gather "used" content from all html + js (style.css excluded)
const files = fs.readdirSync('.').filter(f => /\.(html|js)$/.test(f) && f !== '_cssaudit.js');
let used = '';
files.forEach(f => { used += '\n' + fs.readFileSync(f, 'utf8'); });

// Extract class and id names referenced in CSS selectors (outside { } bodies)
// Remove rule bodies first.
let selectorsText = '';
let depth = 0, curSel = '';
for (let p = 0; p < noComments.length; p++) {
  const ch = noComments[p];
  if (ch === '{') { if (depth === 0) selectorsText += curSel + '\n'; curSel = ''; depth++; }
  else if (ch === '}') { depth = Math.max(0, depth - 1); }
  else if (depth === 0) curSel += ch;
}

const classNames = new Set();
const idNames = new Set();
let m;
const classRe = /\.(-?[A-Za-z_][\w-]*)/g;
const idRe = /#(-?[A-Za-z_][\w-]*)/g;
while ((m = classRe.exec(selectorsText))) classNames.add(m[1]);
while ((m = idRe.exec(selectorsText))) idNames.add(m[1]);

function isUsed(name) {
  // word-ish boundary: name surrounded by non-word char or quote/dot/hash
  const re = new RegExp('[^\\w-]' + name.replace(/[-]/g, '\\-') + '[^\\w-]');
  return re.test(used);
}

const deadClasses = [...classNames].filter(n => !isUsed(n)).sort();
const deadIds = [...idNames].filter(n => !isUsed(n)).sort();

console.log('CSS class names total: ' + classNames.size + ' | dead (not in any html/js): ' + deadClasses.length);
console.log(deadClasses.join('\n'));
console.log('\nCSS id names total: ' + idNames.size + ' | dead: ' + deadIds.length);
console.log(deadIds.join('\n'));
