// Preserve real controls/listeners. Disclosure changes presentation, never input values.
export function settingsAccordion(doc,settings,extraNodes){
 const groups=[...settings.querySelectorAll('.sec')].filter(node=>!['pilotSettings','exteriorSettings'].includes(node.id)&&node.querySelector(':scope>h2'));
 for(const section of groups){
  const detail=doc.createElement('details');detail.className='pc-settings-section';detail.open=true;
  const summary=doc.createElement('summary');summary.textContent=section.querySelector(':scope>h2').textContent.replace(/^\s*\d+\s*/,'').trim();detail.append(summary);section.before(detail);detail.append(section);extraNodes.push(detail);
 }
 const owner=node=>node?.closest?.('details.pc-settings-section,details.pc-settings-subgroup,details.pc-unified-display,#unifiedViewSettings');
 let preferred=owner(settings.querySelector('#run'));
 settings.addEventListener('toggle',event=>{if(event.target.open)preferred=owner(event.target);},true);
 settings.addEventListener('click',event=>{const summary=event.target.closest('summary');if(summary)preferred=owner(summary.parentElement)||preferred;});
 settings.addEventListener('focusin',event=>{preferred=owner(event.target)||preferred;});
 return available=>{
  if(settings.getBoundingClientRect().height<=available+2)return true;
  const active=owner(doc.activeElement),keep=active||preferred;
  const sections=[...settings.querySelectorAll('details.pc-settings-section,details.pc-settings-subgroup,details.pc-unified-display,#unifiedViewSettings')];
  for(const detail of sections.reverse()){
   if(detail===keep||detail.contains(keep)||!detail.open)continue;
   detail.open=false;
   if(settings.getBoundingClientRect().height<=available+2)return true;
  }
  return settings.getBoundingClientRect().height<=available+2;
 };
}
