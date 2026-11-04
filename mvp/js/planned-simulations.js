// Presentation-only studies. Keep these out of the runnable SIMS registry.
export const PLANNED_SIMS = [
  {id:'fire-evacuation',name:'Fire Evacuation',scope:'Interior',category:'interior',
    question:'How could people reach an exit during a fire?',
    blurb:'Explore escape routes, exit locations and potential bottlenecks for a fire scenario.',
    inputs:['Occupants & mobility','Exits & escape routes'],
    intent:'Help architects compare escape-route arrangements and understand where occupants could converge. The planned study will consider occupancy, mobility, route lengths and exit capacity.'},
  {id:'clinical-visibility',name:'Clinical Visibility',scope:'Interior',category:'interior',
    question:'Where should staff stand to see the spaces that matter?',
    blurb:'Explore observation points, sightline gaps and door or window positions in healthcare interiors.',
    inputs:['Observation points','Doors & glazing'],
    intent:'Help healthcare designers compare staff observation points and the placement of observation windows. The planned study will consider visible areas, obstructions and patient privacy.'},
  {id:'vehicle-swept-path',name:'Vehicle Swept Path',scope:'Building',category:'building',
    question:'Can a truck enter, turn and leave this site?',
    blurb:'Explore vehicle access, turning envelopes and clearance around buildings in tight spaces.',
    inputs:['Vehicle dimensions','Access route'],
    intent:'Help site designers assess a proposed delivery or service route. The planned study will consider vehicle dimensions, steering limits, forward and reverse manoeuvres, and obstacle clearance.'},
  {id:'parking-layout',name:'Parking Layout',scope:'Building',category:'building',
    question:'How can parking fit around the buildings?',
    blurb:'Explore parking bays, aisle arrangements, accessible spaces and vehicle circulation.',
    inputs:['Parking boundary','Bay & aisle dimensions'],
    intent:'Help site designers compare parking arrangements within a chosen boundary. The planned study will consider bay orientation, aisle widths, accessible spaces and connections to entrances.'}
].map(s=>({...s,status:'planned',image:`img/home/${s.id}.jpg?v=planned-20261104-1`}));

export const plannedStudy = id => PLANNED_SIMS.find(s=>s.id===id);
