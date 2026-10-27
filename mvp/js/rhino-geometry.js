// Decode placed Rhino objects only. Definition geometry is expanded at each instance transform.
export function rhinoGeometry(doc,rh,THREE){
 const layers=doc.layers(),objects=doc.objects(),definitions=doc.instanceDefinitions(),byObject=new Map(),byDefinition=new Map(),byLayer=new Map();
 const audit={source:'Rhino 3DM',objects:objects.count,definitionObjects:0,placedObjects:0,meshObjects:0,nonSurfaceObjects:0,hiddenObjects:0};
 for(let i=0;i<layers.count;i++){const l=layers.get(i);byLayer.set(String(l.id),l);}
 const layerPath=l=>{const names=[],seen=new Set();while(l&&!seen.has(String(l.id))){seen.add(String(l.id));names.unshift(l.name);l=byLayer.get(String(l.parentLayerId));}return names.join(' / ');};
 const layerVisible=l=>{const seen=new Set();while(l&&!seen.has(String(l.id))){if(l.visible===false)return false;seen.add(String(l.id));l=byLayer.get(String(l.parentLayerId));}return true;};
 for(let i=0;i<objects.count;i++){const object=objects.get(i),a=object.attributes();byObject.set(String(a.id),object);if(a.isInstanceDefinitionObject||a.mode===rh.ObjectMode.InstanceDefinitionObject)audit.definitionObjects++;}
 for(let i=0;i<definitions.count;i++){const d=definitions.get(i);byDefinition.set(String(d.id),d);}
 const root=new THREE.Group(),loader=new THREE.BufferGeometryLoader();
 function read(object,transform,stack=[],instanceName=''){
  const g=object.geometry(),a=object.attributes(),layer=layers.get(a.layerIndex);
  if(!layerVisible(layer)||a.mode===rh.ObjectMode.Hidden){audit.hiddenObjects++;return;}
  if(g instanceof rh.InstanceReference){const id=String(g.parentIdefId),definition=byDefinition.get(id);if(!definition||stack.includes(id))throw Error('Missing or recursive Rhino block definition: '+id);
   const next=transform.clone().multiply(new THREE.Matrix4().fromArray(g.xform.toFloatArray(false)));for(const childId of Array.from(definition.getObjectIds())){const child=byObject.get(String(childId));if(!child)throw Error('Missing Rhino block object '+childId);read(child,next,[...stack,id],a.name||definition.name||instanceName);}return;}
  const meshes=[];if(g instanceof rh.Mesh)meshes.push(g);else if(g instanceof rh.Brep){for(let f=0;f<g.faces().count;f++){const m=g.faces().get(f).getMesh(rh.MeshType.Any);if(!m)throw Error('Missing render mesh on Rhino face '+(f+1)+' of '+(a.name||layer?.name||a.id)+'. In Rhino, convert the full object to a mesh and save again.');meshes.push(m);}}else if(g instanceof rh.Extrusion){const m=g.getMesh(rh.MeshType.Any);if(m)meshes.push(m);}
  if(!meshes.length){if(g instanceof rh.Brep||g instanceof rh.Extrusion||rh.SubD&&g instanceof rh.SubD||rh.Surface&&g instanceof rh.Surface)throw Error('No supported render mesh for '+(a.name||layer?.name||a.id)+'. In Rhino, convert this surface to a mesh and save again.');audit.nonSurfaceObjects++;return;}
  const positions=[];for(const m of meshes){const original=loader.parse(m.toThreejsJSON()),geom=original.index?original.toNonIndexed():original;geom.applyMatrix4(transform);const p=geom.attributes.position.array;
   for(let i=0;i<p.length;i+=9){const order=transform.determinant()<0?[0,6,3]:[0,3,6];for(const j of order)positions.push(p[i+j],p[i+j+1],p[i+j+2]);}if(geom!==original)geom.dispose();original.dispose();}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const group=new THREE.Group();group.name=[instanceName,a.name||layer?.name||'Object'].filter(Boolean).join(' / ');group.userData.layer=layerPath(layer);group.userData.sourceObjectId=String(a.id);group.add(new THREE.Mesh(geo));root.add(group);audit.meshObjects++;
 }
 for(let i=0;i<objects.count;i++){const o=objects.get(i),a=o.attributes();if(a.isInstanceDefinitionObject||a.mode===rh.ObjectMode.InstanceDefinitionObject)continue;audit.placedObjects++;read(o,new THREE.Matrix4());}
 return{object:root,audit};
}
