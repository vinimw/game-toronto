import * as THREE from 'three';
import {createWalkTest, buildingHeight} from './movement.js';
import {seeded} from './geo.js';
import {buildDemoCafe} from './demo-cafe.js';
import {plantPark} from './park-vegetation.js';
import {addPathBatches,terrainTexture,worldUVs} from './park-surfaces.js';
import {parkStyle as style,pathWidth} from './visual-settings.js';
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
  scene.background=new THREE.Color(style.sky);scene.fog=new THREE.Fog(style.sky,...style.fog);
  const hemi=new THREE.HemisphereLight(style.hemisphere.sky,style.hemisphere.ground,style.hemisphere.strength);scene.add(hemi);
  const sun=new THREE.DirectionalLight(style.sun.color,style.sun.strength);sun.position.set(...style.sun.position);scene.add(sun);
  const texture=terrainTexture(), groundGeometry=new THREE.PlaneGeometry(8000,8000);
  worldUVs(groundGeometry,true);
  const ground=new THREE.Mesh(groundGeometry,new THREE.MeshLambertMaterial({color:style.ground,map:texture}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.1;scene.add(ground);
  const greens=world.features.filter(f=>f.kind==='green'),paths=world.features.filter(f=>f.kind==='path'||f.kind==='rail');
  const buildings=world.features.filter(f=>f.kind==='building'),waters=world.features.filter(f=>f.kind==='water');
  for(const feature of greens){
    const mesh=flat(feature.points,-.025,feature.tags?.landuse==='forest'?style.woodland:style.meadow);
    worldUVs(mesh.geometry,true);mesh.material.map=texture;scene.add(mesh);
    evidence?.polygon(feature,mesh);
  }
  waters.forEach(feature=>{
    const mesh=flat(feature.points,.02,style.water);scene.add(mesh);
    evidence?.polygon(feature,mesh);
  });
  addPathBatches(scene,paths,style,pathWidth,texture,evidence?.strip);
  const furniture=[],cameraObstacles=[];
  buildings.forEach((feature,index)=>{
    if(world.mode==='demo'&&feature.visual==='park-cafe'){
      const cafe=buildDemoCafe(feature);
      scene.add(cafe.group);furniture.push(...cafe.obstacles);
      cameraObstacles.push({points:feature.points,height:cafe.ridge});
    }else{
      const mesh=makeBuilding(feature,index);
      if(mesh){scene.add(mesh);evidence?.polygon(feature,mesh.children[1]);}
      cameraObstacles.push({points:feature.points,height:buildingHeight(feature.tags)});
    }
  });
  cameraObstacles.push(...furniture);
  const collisionFeatures=furniture.length?[...world.features,...furniture]:world.features;
  const canWalk=createWalkTest(collisionFeatures,world.bbox||[-1000,-1000,1000,1000]);
  const vegetation=world.vegetation===false?{trees:0,cameraVolumes:[],setQuality(){}}:
    plantPark(scene,world,portals,(point,radius)=>!canWalk(point[0],point[1],radius),
      furniture.length?[[60,114.5,10]]:[]);
  const {trees,cameraVolumes,setQuality}=vegetation;
  // Ground deco around memory: simple warm glow / recognizable interaction point.
  let markerRoot=null;
  if(world.memory&&world.mode!=='osm'){
  markerRoot=new THREE.Group();markerRoot.name='memory-marker';markerRoot.position.set(world.memory[0],0,world.memory[1]);scene.add(markerRoot);
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,.19,20),material(0xffedc9));plinth.position.y=.11;markerRoot.add(plinth);
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,1.05,10),material(0x90624d));pedestal.position.y=.7;markerRoot.add(pedestal);
  const heart=new THREE.Mesh(new THREE.IcosahedronGeometry(.67,1),new THREE.MeshStandardMaterial({color:0xd56e75,emissive:0x9b3747,emissiveIntensity:.5,metalness:.04,roughness:.4}));heart.position.y=2.05;markerRoot.add(heart);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.95,.033,6,36),new THREE.MeshBasicMaterial({color:0xffe7ae,transparent:true,opacity:.85}));halo.rotation.x=-Math.PI/2;halo.position.y=.23;markerRoot.add(halo);
  markerRoot.userData.animate=t=>{heart.rotation.y=t*.55;heart.position.y=2.05+Math.sin(t*2)*.18;halo.material.opacity=.35+Math.abs(Math.sin(t*1.5))*.48;};
  }
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
    cameraVolumes.push({center:[px,3.3,pz],radii:[1.8,.2,.18]});
  }
  return {canWalk,cameraObstacles,cameraVolumes,setQuality,markerRoot,trees,counts:{paths:paths.length,buildings:buildings.length,water:waters.length,trees}};
}
