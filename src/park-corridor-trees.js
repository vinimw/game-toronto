import * as THREE from 'three';
import {nearSegment,pointInPolygon} from './geo.js';
import {collectResources,disposeScene} from './scene-resources.js';

const variants=['maple-43','oak-31'];
export const corridors=[
  {id:'north-corridor',bounds:[-95,-78,24,130],trees:[[-47,-48],[-65,-15],[-33,57],[-82,90]]},
  {id:'west-road-corridor',bounds:[-210,475,-63,690],trees:[[-150,500],[-165,535],[-116,590],[-189,642]]},
  {id:'hillside-corridor',bounds:[-228,850,-120,982],trees:[[-183,885],[-165,910],[-151,938],[-132,965]]},
];

export async function loadCorridor(world,corridor,quality,signal){
  const module=await import('./environment-assets.js');
  signal.throwIfAborted();
  const lod=quality==='high'?'high':'balanced';
  const leases=variants.map(variant=>module.acquireEnvironmentAsset(variant+'-'+lod+'.glb'));
  const release=()=>leases.forEach(lease=>lease.release());
  signal.addEventListener('abort',release,{once:true});
  const root=new THREE.Group(),shared=new Set();
  try{
    const models=await Promise.all(leases.map(lease=>lease.ready));
    signal.throwIfAborted();
    const blocked=world.features.filter(f=>f.kind==='building'||f.kind==='water'||f.kind==='sport');
    const paths=world.features.filter(f=>f.kind==='path'||f.kind==='rail');
    const trees=corridor.trees.filter(p=>!blocked.some(f=>pointInPolygon(p,f.points))&&
      paths.every(f=>f.points.slice(1).every((b,i)=>nearSegment(p,f.points[i],b)>6)));
    const pose=new THREE.Object3D();
    for(const [variant,model] of models.entries()){
      const selection=trees.filter((_,i)=>i%variants.length===variant);
      if(!selection.length)continue;
      for(const asset of collectResources(model))shared.add(asset);
      model.traverse(part=>{
        if(!part.isMesh)return;
        const geometry=part.geometry.clone().applyMatrix4(part.matrixWorld);
        const material=part.material.clone();
        if(material.name.startsWith('LeafCards')){
          material.alphaTest=.44;material.transparent=false;material.side=THREE.DoubleSide;
        }
        const batch=new THREE.InstancedMesh(geometry,material,selection.length);
        selection.forEach(([x,z],i)=>{
          pose.position.set(x,world.terrain.at(x,z),z);pose.rotation.y=i*2.39+variant;
          pose.scale.setScalar(.72+i*.11);pose.updateMatrix();batch.setMatrixAt(i,pose.matrix);
        });
        root.add(batch);
      });
    }
    return {root,dispose(){root.removeFromParent();disposeScene(root,shared);release();}};
  }catch(error){disposeScene(root,shared);release();throw error;}
  finally{signal.removeEventListener('abort',release);}
}
