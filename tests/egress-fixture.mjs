import fs from 'node:fs';
import vm from 'node:vm';
import {hospitalModel,adaptScene} from '../mvp/js/egress/scene.js';
export function fixture(){const html=fs.readFileSync(new URL('../emb/modeler.html',import.meta.url),'utf8'),start=html.indexOf('const STC = (() => {'),end=html.indexOf("if (typeof module !== 'undefined') module.exports = STC;",start),box={module:{exports:{}}};vm.runInNewContext(html.slice(start,end)+ ';module.exports=STC;',box);const st=box.module.exports,model=hospitalModel().studio;st.migrate(model);const built=st.build(model);return adaptScene({studio:model,scenes:model.levels.map(l=>st.planScene(model,built,l.id,'wayfinding'))});}
