// Shared imagery and intent for Home DriftWall and Workspace preview cards.
const INTENTS={
  sunhours:['Where does direct sun reach?','Compare sunlight on the ground and building surfaces.','sun'],
  radiation:['Where does solar energy land?','Compare exposure before choosing shading or solar-panel locations.','sun'],
  utci:['Where might people feel too hot or cold?','Screen outdoor comfort using sun, shade and project weather.','comfort'],
  daylight:['How far does daylight reach indoors?','Compare windows and room layouts on the work-plane grid.','room'],
  wind:['Where does wind accelerate or shelter?','Inspect pedestrian-level flow around your building masses.','wind'],
  vent:['Can openings help air move through?','Explore airflow from wind and temperature differences.','wind'],
  snow:['Where will snow drift and pile up?','Find drifts, scoured ground and roof snow load from the winter wind.','water'],
  stormwater:['Where could rainwater collect?','Trace runoff and low spots under a chosen design storm.','water'],
  acoustics:['Will a room sound too reverberant?','Compare room finishes against a reverberation target.','sound'],
  spacesyntax:['Which spaces connect the plan?','Read visibility, connectivity and spatial integration.','network'],
  movementdepth:['How many steps separate the spaces?','Read spatial depth and the structure of the plan.','network'],
  evac:['Where might circulation bottleneck?','Explore movement paths and congestion in the layout.','network'],
  isovist:['What can someone see from here?','Inspect visible areas and hidden corners from a viewpoint.','view'],
  views:['Where are the useful outward views?','Compare sightlines through windows from within the rooms.','view'],
  wayfinding:['Where could people lose their way?','Find decision points and places where signs may help.','network'],
  privacy:['Which rooms can be seen from outside?','Compare exposure to the street and opposite buildings.','view'],
  cameras:['Where are the coverage gaps?','Explore camera positions and the detail they can capture.','view'],
  structure:['How does the frame carry its loads?','Screen a confirmed frame, its member sections and supports.','frame'],
  climate:['What does the local weather suggest?','Read temperature, wind and solar patterns from the project EPW.','comfort'],
  passive:['Which passive strategies fit the weather?','Explore weather opportunities before testing a building response.','comfort'],
  skyview:['How much sky is visible here?','Read sky exposure and the obstructions along the sun path.','sun'],
  shadebenefit:['Where does shade help most?','Compare the benefit and cost of selected shading objects.','sun'],
  solarenvelope:['How could massing protect solar access?','Explore sampled solar boundaries around selected receptors.','frame']
};
export function simulationPresentation(sim){
 const [question,description]=INTENTS[sim.id]||['What does this study help you decide?',sim.blurb];
 const images={sunhours:'img/home/sunhours.webp',wind:'img/home/wind.webp',daylight:'img/home/daylight.webp'};
 return {...sim,title:sim.name,question,description,image:images[sim.id]||`img/analysis-${sim.id}-day.jpg`,href:`#/simulations/${sim.id}`};
}
