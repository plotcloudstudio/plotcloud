// Rebuild the shareable HTML with esbuild available in NODE_PATH.
const fs=require('node:fs');
const path=require('node:path');
const {buildSync}=require('esbuild');
const directory=__dirname;
let source=fs.readFileSync(path.join(directory,'toronto.js'),'utf8');
source="import * as T from '../furniture/three.module.min.js';\n"+source.replace("  const T = await import('../furniture/three.module.min.js');",'');
const result=buildSync({stdin:{contents:source,resolveDir:directory,sourcefile:'toronto.js'},bundle:true,write:false,format:'iife',target:'es2020',minify:true,legalComments:'inline'});
const css=fs.readFileSync(path.join(directory,'toronto.css'),'utf8');
const script=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
let html=fs.readFileSync(path.join(directory,'toronto.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="toronto.css">',()=>'<style>'+css+'</style>');
html=html.replace('<script type="module" src="toronto.js"></script>',()=>'<script>'+script+'</script>');
fs.writeFileSync(path.join(directory,'toronto-standalone.html'),html);
console.log('Built toronto-standalone.html: '+Buffer.byteLength(html)+' bytes; no external runtime files.');
