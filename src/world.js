import * as THREE from 'three';
import {createWalkTest, buildingHeight} from './movement.js';
import {pointInPolygon,nearSegment,seeded} from './geo.js';
const material=c=>new THREE.MeshLambertMaterial({color:c,side:THREE.DoubleSide});
function flat(points,height,color){
  const s=new THREE.Shape(); points.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();
  const m=new THREE.Mesh(new THREE.ShapeGeometry(s),material(color)); m.rotation.x=-Math.PI/2; m.position.y=height; m.receiveShadow=true; return m;
}
function strip(points,width,height,color){
  const pos=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    if(len<.05)continue;
    const nx=-dz/len*width/2,nz=dx/len*width/2;
    pos.push(a[0]+nx,height,a[1]+nz,a[0]-nx,height,a[1]-nz,b[0]+nx,height,b[1]+nz,
             a[0]-nx,height,a[1]-nz,b[0]-nx,height,b[1]-nz,b[0]+nx,height,b[1]+nz);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
  return new THREE.Mesh(g,material(color));
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
function makeTrees(scene,features,bbox,mode,blocked){
  const rand=seeded(99471);
  const forest=features.filter(f=>f.kind==='green' && f.points.length>3 && f.tags?.leisure !== 'garden');
  const paths=features.filter(f=>f.kind==='path' && ['footway','path','track','pedestrian','residential'].includes(f.tags?.highway));
  const positions=[];
  const minX=bbox?.[0]??-220,minZ=bbox?.[1]??-220,maxX=bbox?.[2]??220,maxZ=bbox?.[3]??220;
  const limit=mode==='demo'?340:Math.min(850,Math.max(220,Math.floor((maxX-minX)*(maxZ-minZ)/750)));
  const candidates=[];
  // Choose trees from landuse/park polygons where possible.
  for(let i=0;i<limit*8;i++){
    let p;
    if(forest.length && rand()<.72){
      const poly=forest[Math.floor(rand()*forest.length)];const id=Math.floor(rand()*poly.points.length); const v=poly.points[id];
      p=[v[0]+(rand()-.5)*170,v[1]+(rand()-.5)*170];
      if(!pointInPolygon(p,poly.points))continue;
    } else if(paths.length){
      const way=paths[Math.floor(rand()*paths.length)]; const a=way.points[Math.floor(rand()*(way.points.length-1))], b=way.points[Math.min(way.points.length-1,way.points.indexOf(a)+1)];
      const t=rand(),dir=rand()>.5?1:-1; const delta=dir*(9+rand()*28);
      const vx=b[0]-a[0],vz=b[1]-a[1],len=Math.hypot(vx,vz)||1;
      p=[a[0]+vx*t-vz/len*delta,a[1]+vz*t+vx/len*delta];
    } else p=[minX+rand()*(maxX-minX),minZ+rand()*(maxZ-minZ)];
    if(p[0]<minX+4||p[0]>maxX-4||p[1]<minZ+4||p[1]>maxZ-4)continue;
    if(blocked(p))continue;
    if(positions.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<5.8))continue;
    candidates.push(p); positions.push(p); if(positions.length===limit)break;
  }
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.19,.29,1,5),material(0x85664c),positions.length);
  const crown=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),material(0x789e65),positions.length);
  const crown2=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),material(0x91b877),positions.length);
  const dummy=new THREE.Object3D();positions.forEach(([x,z],i)=>{
    const h=3.8+rand()*3.5;dummy.position.set(x,h/2,z);dummy.scale.set(.65,h,.65);dummy.rotation.y=rand()*6.28;dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);
    dummy.position.set(x,h+.9,z);dummy.scale.set(2.35+rand()*.8,2.4+rand(),2.35+rand()*.8);dummy.updateMatrix();crown.setMatrixAt(i,dummy.matrix);
    dummy.position.set(x+(rand()-.5),h+2.1,z+(rand()-.5));dummy.scale.set(1.7+rand()*.8,1.4+rand()*.7,1.7+rand()*.8);dummy.updateMatrix();crown2.setMatrixAt(i,dummy.matrix);
  });
  trunk.instanceMatrix.needsUpdate=true;crown.instanceMatrix.needsUpdate=true;crown2.instanceMatrix.needsUpdate=true;
  scene.add(trunk,crown,crown2);
  return positions.length;
}
export function buildWorld(scene,world){
  scene.background=new THREE.Color(0xf7e6c8);scene.fog=new THREE.Fog(0xf7e6c8,230,950);
  const hemi=new THREE.HemisphereLight(0xfff6d9,0x8da58c,2.05);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffddad,2.5);sun.position.set(-120,180,-80);scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(8000,8000),material(0xc4cfac));ground.rotation.x=-Math.PI/2;ground.position.y=-.1;ground.receiveShadow=true;scene.add(ground);
  const blockedPolys=world.features.filter(f=>f.points.length>2 && (f.kind==='water'||f.kind==='building'));
  const blocked=p=>blockedPolys.some(f=>pointInPolygon(p,f.points));
  const greens=world.features.filter(f=>f.kind==='green');const paths=world.features.filter(f=>f.kind==='path'||f.kind==='rail');
  const buildings=world.features.filter(f=>f.kind==='building'); const waters=world.features.filter(f=>f.kind==='water');
  greens.forEach(f=>{try{scene.add(flat(f.points,-.025, f.tags?.landuse==='forest'?0x9cbd91:0xb5c99e));}catch{}});
  waters.forEach(f=>{try{scene.add(flat(f.points,.02,0x81b6ae));}catch{}});
  paths.forEach(f=>{
    const type=f.tags?.highway||'';
    const width=f.kind==='rail'?2.8:({motorway:17,trunk:14,primary:12,secondary:10,tertiary:9,residential:7,living_street:5,service:4,pedestrian:5,footway:2.9,cycleway:2.4,path:2.3,track:3,steps:2}[type]||3);
    const color=f.kind==='rail'?0x907770:['footway','path','track','steps'].includes(type)?0xe8d9b3:['primary','secondary','tertiary','residential','service','motorway'].includes(type)?0xa1a49e:0xdbceac;
    scene.add(strip(f.points,width,.03,color));
  });
  buildings.forEach((f,i)=>{try{const obj=makeBuilding(f,i);if(obj)scene.add(obj);}catch{}});
  const trees=makeTrees(scene,world.features,world.bbox,world.mode,blocked);
  // Ground deco around memory: simple warm glow / recognizable interaction point.
  const markerRoot=new THREE.Group();markerRoot.position.set(world.memory[0],0,world.memory[1]);scene.add(markerRoot);
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,.19,20),material(0xffedc9));plinth.position.y=.11;markerRoot.add(plinth);
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,1.05,10),material(0x90624d));pedestal.position.y=.7;markerRoot.add(pedestal);
  const heart=new THREE.Mesh(new THREE.IcosahedronGeometry(.67,1),new THREE.MeshStandardMaterial({color:0xd56e75,emissive:0x9b3747,emissiveIntensity:.5,metalness:.04,roughness:.4}));heart.position.y=2.05;markerRoot.add(heart);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.95,.033,6,36),new THREE.MeshBasicMaterial({color:0xffe7ae,transparent:true,opacity:.85}));halo.rotation.x=-Math.PI/2;halo.position.y=.23;markerRoot.add(halo);
  markerRoot.userData.animate=t=>{heart.rotation.y=t*.55;heart.position.y=2.05+Math.sin(t*2)*.18;halo.material.opacity=.35+Math.abs(Math.sin(t*1.5))*.48;};
  const canWalk=createWalkTest(world.features,world.bbox||[-1000,-1000,1000,1000]);
  const cameraObstacles=buildings.map(f=>({points:f.points,height:buildingHeight(f.tags)}));
  return {canWalk,cameraObstacles,markerRoot,trees,counts:{paths:paths.length,buildings:buildings.length,water:waters.length,trees}};
}
