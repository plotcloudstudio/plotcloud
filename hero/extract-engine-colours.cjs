// Read actual engine definitions; never maintain a separate art-directed palette.
const fs=require('node:fs'),vm=require('node:vm');
const source=id=>fs.readFileSync(`emb/${id}.html`,'utf8');
function literal(id,name){const text=source(id),start=text.indexOf(name+' = ');if(start<0)throw Error(id+': '+name);const at=text.indexOf('[',start);let depth=0,end=at;for(;end<text.length;end++){if(text[end]==='[')depth++;if(text[end]===']'&&--depth===0)break;}return vm.runInNewContext('('+text.slice(at,end+1)+')',{}, {timeout:1000});}
const out={};for(const [id,file,name]of [['sunhours','sunhours','RAMP'],['wind','wind','RAMP'],['vent','vent','RAMP'],['daylight','daylight','SRAMP'],['spacesyntax','spacesyntax','SPEC'],['movementdepth','spacesyntax','DEPTHMAP_SPEC'],['evac','evac','RAMPV'],['structure','structure','RAMP'],['views','views','VFC'],['cameras','cameras','CAMCOL']]){const raw=literal(file,name);out[id]={source:`emb/${file}.html`,definition:name,stops:Array.isArray(raw[0])&&typeof raw[0][0]==='number'&&Array.isArray(raw[0][1])?raw:raw.map((c,i)=>[i/(raw.length-1),c])};}
const ac=source('acoustics').match(/COLORS=(\[[^;]+?\])/);if(!ac)throw Error('acoustic colours');out.acoustics={source:'emb/acoustics.html',definition:'COLORS',discrete:true,stops:vm.runInNewContext(ac[1]).map((c,i)=>[i/4,c])};
const iso=source('isovist');if(!iso.includes('px[o] = 245; px[o + 1] = 166; px[o + 2] = 35'))throw Error('Isovist seen colour changed');out.isovist={source:'emb/isovist.html',definition:'washImage seen/blind',discrete:true,stops:[[0,[228,228,228]],[1,[245,166,35]]]};
// Stormwater is a bundled engine: inspect its decoded, original source.
const storm=source('stormwater'),embedded=storm.match(/const GRID_HTML=("(?:[^"\\]|\\.)*")/);const decoded=embedded?JSON.parse(embedded[1]):storm;
const water=decoded.match(/PAL=(\[[^\]]+\])/);if(!water)throw Error('Stormwater palette missing');out.stormwater={source:'emb/stormwater.html (GRID_HTML)',definition:'PAL depth bands',discrete:true,stops:vm.runInNewContext(water[1]).map((c,i)=>[i/4,c])};
out.cameras.discrete=true;out.views.discrete=true;
fs.writeFileSync('mvp/engine-colours.json',JSON.stringify(out,null,2)+'\n');
