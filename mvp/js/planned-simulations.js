// Presentation-only studies. Keep these out of the runnable SIMS registry. (Vehicle swept path and Parking layout run since 2026-11-18: data.js.)
export const PLANNED_SIMS = [
  {id:'clinical-visibility',name:'Clinical Visibility',scope:'Interior',category:'interior',
    question:'Where should staff stand to see the spaces that matter?',
    blurb:'Explore observation points, sightline gaps and door or window positions in healthcare interiors.',
    inputs:['Observation points','Doors & glazing'],
    intent:'Help healthcare designers compare staff observation points and the placement of observation windows. The planned study will consider visible areas, obstructions and patient privacy.'}
].map(s=>({...s,status:'planned',image:`img/home/${s.id}.jpg?v=planned-20261104-1`}));

export const plannedStudy = id => PLANNED_SIMS.find(s=>s.id===id);
