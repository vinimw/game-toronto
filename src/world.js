import {resolveMemoryPoints} from './memories.js';
import {addMemoryMarkers} from './memory-markers.js';
import * as THREE from 'three';
import {createWalkTest, buildingHeight} from './movement.js';
import {seeded} from './geo.js';
import {findLandmark} from './landmarks.js';
import {buildDemoCafe} from './demo-cafe.js';
import {plantPark} from './park-vegetation.js';
import {addPathBatches,terrainTexture,worldUVs} from './park-surfaces.js';
import {pathWidth} from './visual-settings.js';
import {installEntranceArt} from './north-entrance-art.js';
import {terrainBuildingBatches} from './terrain-buildings.js';
import {addTerrainChunks,densify} from './high-park-terrain.js';
import {parkEnvironment} from './park-environment.js';
const material=c=>new THREE.MeshLambertMaterial({color:c,side:THREE.DoubleSide});
function flat(points,height,color){
  const s=new THREE.Shape(); points.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();
  const m=new THREE.Mesh(new THREE.ShapeGeometry(s),material(color)); m.rotation.x=-Math.PI/2; m.position.y=height; m.receiveShadow=true; return m;
}
function makeBuilding(f,index){
  const rand=seeded(91+index*23);
  const points=f.points;
  if(points.length<3)return null;
  const s=new THREE.Shape();points.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();
  const h=buildingHeight(f.tags);
  const color=new THREE.Color().setHSL(.07+rand()*.08,.13+rand()*.13,.65+rand()*.13);
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:1,steps:1}),new THREE.MeshLambertMaterial({color}));
  mesh.rotation.x=-Math.PI/2;mesh.receiveShadow=true;mesh.castShadow=false;
  const roof=flat(points,h+.04,rand()>.5?0x958575:0x8b8580); const group=new THREE.Group();group.add(mesh,roof);return group;
}
export function buildWorld(scene,world,portals=[],evidence){
  const real=world.mode==='osm',environment=parkEnvironment(world),{style}=environment;
  scene.background=new THREE.Color(style.sky);scene.fog=new THREE.Fog(style.sky,...style.fog);
  const hemi=new THREE.HemisphereLight(style.hemisphere.sky,style.hemisphere.ground,style.hemisphere.strength);scene.add(hemi);
  const sun=new THREE.DirectionalLight(style.sun.color,style.sun.strength);sun.position.set(...style.sun.position);scene.add(sun);
  const {terrain}=world;
  const texture=terrainTexture(real);
  if(!terrain){
    const groundGeometry=new THREE.PlaneGeometry(8000,8000);
    worldUVs(groundGeometry,true,real);
    const ground=new THREE.Mesh(groundGeometry,new THREE.MeshLambertMaterial({color:style.ground,map:texture}));
    ground.rotation.x=-Math.PI/2;ground.position.y=-.1;scene.add(ground);
  }
  const greens=world.features.filter(f=>f.kind==='green'),paths=world.features.filter(f=>f.kind==='path'||f.kind==='rail');
  const buildings=world.features.filter(f=>f.kind==='building'),waters=world.features.filter(f=>f.kind==='water');
  if(terrain)addTerrainChunks(scene,terrain,[...world.features.filter(f=>f.kind==='sport'),...greens],style,texture);
  else for(const feature of greens){
    const wooded=feature.tags?.landuse==='forest'||(real&&feature.tags?.natural==='wood');
    const height=real&&feature.tags?.landuse==='grass'?-.021:real&&wooded?-.023:-.025;
    const mesh=flat(feature.points,height,wooded?style.woodland:style.meadow);
    worldUVs(mesh.geometry,true,real);mesh.material.map=texture;scene.add(mesh);
    evidence?.polygon(feature,mesh);
  }
  const entrance=terrain&&world.entranceAssets?installEntranceArt(scene,world,sun):null;
  waters.forEach(feature=>{
    const mesh=flat(feature.points,terrain?.waterLevel(feature.points)??.02,style.water);scene.add(mesh);
    evidence?.polygon(feature,mesh);
  });
  const routeMeshes=terrain?paths.map(feature=>({...feature,points:densify(feature.points)})):paths;
  addPathBatches(scene,routeMeshes,style,pathWidth,texture,evidence?.strip,real,terrain,entrance&&((geometry,color)=>entrance.pathOverlay(geometry,color,style)));
  const furniture=[],cameraObstacles=[],clearings=[];
  const landmarks=[],buildingBatches=terrain?terrainBuildingBatches(scene):null;
  buildings.forEach((feature,index)=>{
    const definition=findLandmark(world,feature);
    const floor=terrain?Math.min(...feature.points.map(point=>terrain.at(...point))):0;
    const blocker={kind:'building',id:feature.osmId??null,points:feature.points,minHeight:floor};
    if(world.mode==='demo'&&feature.visual==='park-cafe'){
      const cafe=buildDemoCafe(feature);
      scene.add(cafe.group);furniture.push(...cafe.obstacles);
      cameraObstacles.push({...blocker,height:cafe.ridge});
    }else if(definition){
      const model=definition.build(feature);
      model.group.position.y+=floor;scene.add(model.group);
      landmarks.push({definition,model});
      evidence?.polygon(feature,model.roof);
      cameraObstacles.push({...blocker,height:model.height+floor});
      if(model.forecourt)clearings.push(model.forecourt);
    }else{
      const mesh=makeBuilding(feature,index);
      if(mesh){
        mesh.position.y=floor;
        if(buildingBatches)buildingBatches.add(mesh,feature.points[0]);
        else {scene.add(mesh);evidence?.polygon(feature,mesh.children[1]);}
      }
      cameraObstacles.push({...blocker,height:buildingHeight(feature.tags)+floor});
    }
  });
  buildingBatches?.attach();
  if(entrance)furniture.push(...entrance.gateBlocks);
  cameraObstacles.push(...furniture);
  const collisionFeatures=furniture.length?[...world.features,...furniture]:world.features;
  const canWalk=createWalkTest(collisionFeatures,world.bbox||[-1000,-1000,1000,1000]);
  for(const {model} of landmarks)model.decorate?.({canWalk,paths});
  if(furniture.length&&!real)clearings.push([60,114.5,10]);
  const vegetation=world.vegetation===false?{trees:0,cameraVolumes:[],setQuality(){}}:
    plantPark(scene,world,portals,(point,radius)=>!canWalk(point[0],point[1],radius),clearings,environment);
  const {trees,cameraVolumes,vegetationMetrics}=vegetation;
  if(entrance)cameraVolumes.push(...entrance.cameraVolumes);
  const setCameraOccluders=entrance?ids=>{vegetation.setCameraOccluders?.(ids);entrance.setOccluders(ids);}:vegetation.setCameraOccluders;
  const setDetailFocus=real?(x,z)=>{
    vegetation.setDetailFocus?.(x,z);
    entrance?.setDetailFocus(x,z);
    for(const {model} of landmarks)model.setFocus?.(x,z);
  }:undefined;
  function setQuality(profile){
    vegetation.setQuality(profile);
    entrance?.setQuality(profile);
    for(const {definition,model} of landmarks)
      model.setDetail(definition.detail[profile]??definition.detail.balanced);
  }
  const regionId=scene.name.startsWith('region:')?scene.name.slice('region:'.length):null;
  const memoryPoints=resolveMemoryPoints(regionId,world,canWalk);
  const animateMemoryMarkers=addMemoryMarkers(scene,memoryPoints,terrain);
  for(const portal of world.mode==='osm'?[]:portals){
    const gate=new THREE.Group();gate.name=portal.id;gate.position.set(portal.position[0],0,portal.position[1]);
    const gateMaterial=material(0x85664c);
    for(const x of [-1.7,1.7]){
      const post=new THREE.Mesh(new THREE.BoxGeometry(.22,3.3,.22),gateMaterial);post.position.set(x,1.65,0);gate.add(post);
    }
    const lintel=new THREE.Mesh(new THREE.BoxGeometry(3.6,.35,.25),gateMaterial);lintel.position.y=3.3;gate.add(lintel);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.2,.04,6,32),material(0xdba872));ring.rotation.x=-Math.PI/2;ring.position.y=.04;gate.add(ring);
    scene.add(gate);
    const [px,pz]=portal.position;
    for(const x of [px-1.7,px+1.7])cameraObstacles.push({height:3.3,points:[
      [x-.11,pz-.11],[x+.11,pz-.11],[x+.11,pz+.11],[x-.11,pz+.11],
    ]});
    cameraObstacles.push({kind:'portal',id:portal.id,minHeight:3.125,height:3.475,points:[
      [px-1.8,pz-.125],[px+1.8,pz-.125],[px+1.8,pz+.125],[px-1.8,pz+.125],
    ]});
  }
  return {terrain,entranceArt:entrance?.evidence,environment:environment.id,canWalk,cameraObstacles,cameraVolumes,setCameraOccluders,setQuality,setDetailFocus,vegetationMetrics,memoryPoints,animateMemoryMarkers,trees,
    landmarks:landmarks.map(({definition:{build,...identity}})=>identity),
    counts:{paths:paths.length,buildings:buildings.length,water:waters.length,trees}};
}
