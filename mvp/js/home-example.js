// One source of truth: engine screenshots and figures recorded by capture-sun-example.cjs.
export async function mountSunExample(root,isCurrent=()=>true){
  const response=await fetch(new URL('../sun-example.json',import.meta.url));if(!response.ok)throw Error('Sun example record unavailable');const data=await response.json();
  if(!isCurrent())return;const section=root.querySelector('#example');if(!section)return;
  const figures=section.querySelectorAll('.compare-image');figures.forEach((figure,i)=>{const image=figure.querySelector('img');image.removeAttribute('data-image');image.src=new URL(`../img/sun-example-v${i+1}.png`,import.meta.url);image.alt=`Actual Sun Hours engine result, version ${i+1}`;figure.style.aspectRatio='982 / 805';image.style.objectFit='contain';figure.querySelector('figcaption').textContent=`V${i+1} / CONTEXT HEIGHT ${i?data.inputs.change.after:data.inputs.change.before} m`;});
  const value=(record,key)=>{const lines=record.stats.split('\n'),at=lines.indexOf(key);if(at<0)throw Error('Missing engine figure '+key);return lines[at+1];};
  const metrics=[['Ground, average','Mean ground sunlight'],['Ground with ≥ 2 h','Ground with ≥ 2 h'],['Facades, average','Mean facade sunlight']];
  section.querySelector('.metrics').replaceChildren(...metrics.map(([key,label])=>{const el=document.createElement('div');el.className='metric';const small=document.createElement('small');small.textContent=label;const values=document.createElement('div'),after=document.createElement('em');values.append(value(data.records[0],key)+' → ');after.textContent=value(data.records[1],key);values.append(after);el.append(small,values);return el;}));
  section.querySelector('.source-note').textContent='Actual Sun Hours engine runs · Vancouver · 20 March 2026 · 0.50 m grid · 15-minute steps · same Plan view and settings. Only the east context building height changes: 9 m → 3.6 m. These are sample results, not your project.';
}
