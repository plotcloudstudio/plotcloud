const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
for(const file of ['mvp/index.html','mvp/home-preview.html','ui/runtime.js','ui/tokens.css','ui/components.css','mvp/css/mvp.css','mvp/js/app.js','mvp/js/home-hero.js','mvp/js/viewport.js','mvp/js/viewport2.js','hero/toronto.js','hero/toronto.css']){
 const text=fs.readFileSync(file,'utf8');assert(!/prefers-color-scheme\s*:\s*dark|setTheme|id="themeSeg"|data-(?:pc-)?theme=["']?night|visualTheme/.test(text),file+' must not expose dark mode');
}
assert(!fs.readdirSync('mvp/img').some(file=>/-night\.(jpg|png|webp)$/.test(file)));
const css=fs.readFileSync('mvp/css/mvp.css','utf8');assert.match(css,/color-scheme:\s*light/);assert(!/color-scheme:\s*dark/.test(css));
const runtime=fs.readFileSync('ui/runtime.js','utf8');assert.match(runtime,/removeItem\('pc-mvp-theme'\)/);assert(!runtime.includes("getItem('pc-mvp-theme')"));
const html=fs.readFileSync('hero/toronto-standalone.html','utf8');assert(!html.includes('visualTheme'));assert(!html.includes('[data-theme=night]'));
console.log('PASS light-only UI, removed switching/system-dark behavior, removed night artwork and legacy preference cleanup');
