export const profiles={
 ambulant:{label:'Independent walking',width:.5,speedMin:.8,speedMax:1.2,responseMin:10,responseMax:40,escorts:0,preparation:0,stepFree:false},
 assisted:{label:'Assisted walking',width:.75,speedMin:.35,speedMax:.65,responseMin:20,responseMax:60,escorts:1,preparation:20,stepFree:false},
 wheelchair:{label:'Wheelchair transfer',width:.85,speedMin:.4,speedMax:.7,responseMin:20,responseMax:60,escorts:1,preparation:30,stepFree:true},
 bed:{label:'Bed transfer',width:1.15,speedMin:.2,speedMax:.5,responseMin:30,responseMax:90,escorts:2,preparation:60,stepFree:true},
 child:{label:'Child (assumption study)',width:.45,speedMin:.6,speedMax:1,responseMin:20,responseMax:60,escorts:0,preparation:0,stepFree:false}
};
export function group(room,index=1,kind='ambulant'){return {id:'g'+index,room,kind,count:5,...profiles[kind],fallProbability:0,fallMin:10,fallMax:30,fallBasis:''};}
export function settings(scene,synthetic=false){const s={mode:'final',grid:.25,specificFlow:1,staff:4,turnaround:30,horizon:3600,repeats:20,seed:104729,basis:synthetic?'Synthetic teaching assumptions. All numeric presets are illustrative, uncalibrated values; no hospital observations.':'',groups:[],doors:Object.fromEntries(scene.doors.map(d=>[d.id,{width:d.width,exit:synthetic&&d.id==='H0-exit',blocked:false}])),links:[],refuges:{}};
 if(synthetic){for(const r of scene.rooms){if(r.name.includes('Ward A'))s.groups.push(group(r.id,s.groups.length+1));if(r.name.includes('Receiving'))s.refuges[r.id]=20;}const landings=scene.rooms.filter(r=>r.name.includes('Stair landing')).sort((a,b)=>a.p[2]-b.p[2]);for(let i=1;i<landings.length;i++)s.links.push({id:'stair-'+i,from:landings[i].id,to:landings[i-1].id,width:1.4,length:9,speedFactor:.55,stepFree:false,confirmed:true,blocked:false});}
 else if(scene.rooms.length)s.groups.push(group(scene.rooms[0].id));return s;}
