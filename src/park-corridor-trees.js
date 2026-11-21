import * as THREE from 'three';
import {seeded} from './geo.js';
import {addCorridorUnderstory,corridorClearance} from './park-corridor-understory.js';
import {collectResources,disposeScene} from './scene-resources.js';

const variants=['maple-43','oak-31','maple-79','oak-67'];
const milestone=id=>id.startsWith('north-sports-grove')||id.startsWith('west-cherry-cafe-grove')||id==='north-corridor'||id==='west-road-corridor';
export const corridorModelKeys=variants.flatMap(name=>['high','balanced'].map(lod=>name+'-'+lod+'.glb'));
export const corridors=[
  {id:'north-corridor',bounds:[-95,-78,24,130],trees:[[-47,-48],[-65,-15],[-33,57],[-82,90],[-45,-67],[-52,-61],[-40,47]]},
  {id:'west-road-corridor',bounds:[-210,475,-63,690],trees:[[-150,500],[-165,535],[-116,590],[-189,642],[-146,525],[-150,541],[-124,593],[-184,623]]},
  {id:'hillside-corridor',bounds:[-228,850,-120,982],trees:[[-183,885],[-165,910],[-151,938],[-132,965]]},
  {"id":"north-sports-grove-0","bounds":[-13.29,-65.41,42.02,59.86],"trees":[[-5.29,-57.41],[1.67,-34.44],[7.89,-12.04],[34.02,51.86]]},
  {"id":"north-sports-grove-1","bounds":[26.159999999999997,67.86,47.68,154.77],"trees":[[34.16,75.86],[39.68,98.53],[38.79,123.07],[37.82,146.77]]},
  {"id":"north-sports-grove-2","bounds":[29.1,162.77,45.1,178.77],"trees":[[37.1,170.77]]},
  {"id":"west-cherry-cafe-grove-0","bounds":[-198.77,554.79,-169.21,642.63],"trees":[[-178.28,562.79],[-177.21,584.54],[-190.77,608.59],[-178.04,634.63]]},
  {"id":"west-cherry-cafe-grove-1","bounds":[-202.56,651.71,-172.62,739.88],"trees":[[-180.62,659.71],[-194.56,680.15],[-187.97,703.23],[-189.75,731.88]]},
  {"id":"west-cherry-cafe-grove-2","bounds":[-217.04,731.43,-144.74,774.02],"trees":[[-191.95,761.02],[-209.04,766.02],[-198.08,739.43],[-152.74,742.86]]},
  {"id":"west-cherry-cafe-grove-3","bounds":[-157.62,764.15,-141.62,780.15],"trees":[[-149.62,772.15]]},
  {id:'west-cherry-cafe-grove-4',bounds:[-153,740,-100,819],trees:[[-138,784],[-145,790],[-130,793],[-117,804],[-107,787]]},
  {"id":"pond-hillside-garden-grove-0","bounds":[-288.06,863.45,-210.38,913.55],"trees":[[-280.06,871.45],[-256.83,888.55],[-232.72,892.35],[-218.38,905.55]]},
  {"id":"pond-hillside-garden-grove-1","bounds":[-202.46,911.62,-173.99,996.76],"trees":[[-194.46,919.62],[-181.99,937.49],[-187.47,964.84],[-185.71,988.76]]},
  {"id":"pond-hillside-garden-grove-2","bounds":[-193.22,1003.72,-133.93,1034.95],"trees":[[-185.22,1011.72],[-157.67,1026.37],[-141.93,1026.95]]},
];

export async function loadCorridor(world,corridor,quality,signal){
  const module=await import('./environment-assets.js');
  signal.throwIfAborted();
  const lod=quality==='high'?'high':'balanced';
  const enhanced=milestone(corridor.id);
  const localVariants=enhanced?variants:variants.slice(0,2);
  const clear=corridorClearance(world,corridor.bounds);
  const trees=corridor.trees.filter(point=>clear(point,3));
  const selections=localVariants.map((_,index)=>trees.filter((_,i)=>(i+(enhanced?Math.round(trees[0][1]):0)+localVariants.length*1000)%localVariants.length===index));
  const leases=localVariants.map((variant,index)=>selections[index].length?module.acquireEnvironmentAsset(variant+'-'+lod+'.glb'):null);
  const release=()=>leases.forEach(lease=>lease?.release());
  signal.addEventListener('abort',release,{once:true});
  const root=new THREE.Group(),shared=new Set();
  try{
    const models=await Promise.all(leases.map(lease=>lease?.ready));
    signal.throwIfAborted();
    const pose=new THREE.Object3D();
    for(const [variant,model] of models.entries()){
      const selection=selections[variant];
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
          const random=seeded(Math.abs(Math.round(x*167+z*29)));
          pose.position.set(x,world.terrain.at(x,z),z);pose.rotation.y=enhanced?random()*Math.PI*2:i*2.39+variant;
          const size=enhanced?.76+random()*.34:.72+i*.11;
          pose.scale.set(size,enhanced?size*(.91+random()*.21):size,size);pose.updateMatrix();batch.setMatrixAt(i,pose.matrix);
        });
        root.add(batch);
      });
    }
    if(enhanced)addCorridorUnderstory(root,world,trees,clear,quality);
    return {root,dispose(){root.removeFromParent();disposeScene(root,shared);release();}};
  }catch(error){disposeScene(root,shared);release();throw error;}
  finally{signal.removeEventListener('abort',release);}
}
