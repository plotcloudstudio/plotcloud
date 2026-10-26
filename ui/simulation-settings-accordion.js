// Preserve real controls/listeners. Disclosure changes presentation, never input values.
export function settingsAccordion(doc,settings,extraNodes){
 const groups=[...settings.querySelectorAll('.sec')].filter(node=>!['pilotSettings','exteriorSettings'].includes(node.id)&&node.querySelector(':scope>h2'));
 for(const section of groups){
  const detail=doc.createElement('details');detail.className='pc-settings-section';detail.open=true;
  const summary=doc.createElement('summary');summary.textContent=section.querySelector(':scope>h2').textContent.replace(/^\s*\d+\s*/,'').trim();detail.append(summary);section.before(detail);detail.append(section);extraNodes.push(detail);
 }
 // Preserve the user's disclosure state. Native scrolling handles long content.
 return()=>true;
}
