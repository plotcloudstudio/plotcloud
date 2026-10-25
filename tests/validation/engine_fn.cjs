// Pulls named functions out of an engine page exactly as they ship (no copy), so a check tests the real code.
const fs = require('fs');
module.exports = function engineFns(file, names, prelude = '') {
  const src = fs.readFileSync(file, 'utf8');
  const body = names.map((n) => { const i = src.indexOf(`function ${n}(`); if (i < 0) throw new Error(`${n} not found in ${file}`);
    let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } throw new Error('unbalanced ' + n); }).join('\n');
  return new Function(`${prelude}\n${body}\nreturn {${names.join(',')}};`)();
};
