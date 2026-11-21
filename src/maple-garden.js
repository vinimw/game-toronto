import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {nearSegment,pointInPolygon,seeded} from './geo.js';

export const mapleWay=251569209;
export const mapleSector='high-park:maple-leaf-garden';
export const mapleBounds=[-166,992,-111,1051];

// Ground-level colour continuity, even before the detailed plants load.
export function mapleGardenBase(world,feature){
  const ring=feature.points.slice(0,-1);
  const positions=[],colors=[],tint=new THREE.Color();
  const faces=THREE.ShapeUtils.triangulateShape(ring.map(([x,z])=>new THREE.Vector2(x,z)),[]);
  const tones=[0x833939,0x93463d,0x743238,0x8a393d];
  for(const face of faces)for(const index of [...face].reverse()){
    const [x,z]=ring[index];
    positions.push(x,world.terrain.at(x,z)+.057,z);
    colors.push(...tint.setHex(tones[index%tones.length]).toArray());
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.96,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,
  }));
}

export function buildMapleGarden(world,feature,quality){
  const root=new THREE.Group(),random=seeded(mapleWay);
  root.name=mapleSector;
  const ring=feature.points.slice(0,-1);
  const vertices=ring.map(([x,z])=>new THREE.Vector2(x,z));
  const faces=THREE.ShapeUtils.triangulateShape(vertices,[]);
  const height=(x,z)=>world.terrain.at(x,z);
  const top=[],edge=[];
  const bedHeight=.085;
  for(const face of faces){
    for(const index of [...face].reverse()){
      const [x,z]=ring[index];top.push(x,height(x,z)+bedHeight,z);
    }
  }
  for(let i=0;i<ring.length;i++){
    const [x,z]=ring[i],[u,v]=ring[(i+1)%ring.length];
    const a=[x,height(x,z)+.025,z],b=[u,height(u,v)+.025,v];
    const c=[x,height(x,z)+bedHeight,z],d=[u,height(u,v)+bedHeight,v];
    edge.push(...a,...b,...c,...b,...d,...c);
  }
  const coverage={value:0};
  function material(color){
    const result=new THREE.MeshStandardMaterial({color,roughness:.91,side:THREE.DoubleSide});
    result.onBeforeCompile=shader=>{
      shader.uniforms.gardenCoverage=coverage;
      shader.fragmentShader='uniform float gardenCoverage;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>',
        '#include <alphatest_fragment>\nif(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))>=gardenCoverage)discard;');
    };
    return result;
  }
  function geometry(values){
    const mesh=new THREE.BufferGeometry();
    mesh.setAttribute('position',new THREE.Float32BufferAttribute(values,3));
    mesh.computeVertexNormals();
    return mesh;
  }
  root.add(new THREE.Mesh(geometry(top),material(0x793835)),new THREE.Mesh(geometry(edge),material(0x74664d)));
  const samples=[];
  const step=quality==='high'?.25:quality==='balanced'?.38:.61;
  for(let z=1014;z<1030;z+=step)for(let x=-147;x<-132;x+=step){
    const point=[x+random()*step,z+random()*step];
    if(!pointInPolygon(point,ring)||ring.some((a,i)=>nearSegment(point,a,ring[(i+1)%ring.length])<.22))continue;
    if(random()<.11)continue;
    samples.push(point);
  }
  // Narrow, folded leaves rise around an upright stem.
  const leaf=[];
  for(let k=0;k<3;k++){
    const angle=k*2.399,x=Math.cos(angle),z=Math.sin(angle);
    const blade=[];
    for(let j=0;j<=4;j++){
      const t=j/4,reach=.18*t*t,y=.29*t+.032*Math.sin(t*Math.PI);
      const width=.038*Math.sin(Math.PI*t)**.8;
      blade.push([[x*reach-z*width,y,z*reach+x*width],[x*reach,y+.014,z*reach],
        [x*reach+z*width,y,z*reach-x*width]]);
      if(j)for(let i=0;i<2;i++){
        const a=blade[j-1],b=blade[j];
        leaf.push(...a[i],...b[i],...a[i+1],...a[i+1],...b[i],...b[i+1]);
      }
    }
  }
  const batch=new THREE.InstancedMesh(geometry(leaf),material(0xffffff),samples.length);
  const bloomSamples=samples.filter(()=>random()<.72);
  const petals=new THREE.LatheGeometry([[0,0],[.029,.009],[.045,.038],[.043,.083],[.031,.105]]
    .map(([x,y])=>new THREE.Vector2(x,y)),quality==='high'?8:6).translate(0,.34,0);
  const stem=new THREE.CylinderGeometry(.004,.005,.35,5).translate(0,.175,0);
  const flowerGeometry=mergeGeometries([stem,petals],true);
  stem.dispose();petals.dispose();
  const blooms=new THREE.InstancedMesh(flowerGeometry,[material(0x567140),material(0xffffff)],bloomSamples.length);
  const tint=new THREE.Color(),pose=new THREE.Object3D();
  const palette=[0x59773f,0x527044,0x66894a];
  samples.forEach(([x,z],index)=>{
    pose.position.set(x,height(x,z)+bedHeight,z);
    pose.rotation.y=random()*Math.PI*2;
    pose.scale.setScalar(.71+random()*.56);pose.updateMatrix();
    batch.setMatrixAt(index,pose.matrix);
    batch.setColorAt(index,tint.setHex(palette[index%palette.length]));
  });
  bloomSamples.forEach(([x,z],index)=>{
    pose.position.set(x,height(x,z)+bedHeight,z);
    pose.rotation.y=random()*6.28;pose.scale.setScalar(.85+random()*.3);pose.updateMatrix();
    blooms.setMatrixAt(index,pose.matrix);
    blooms.setColorAt(index,tint.setHex([0xb94043,0xa52f3d,0xdc5851,0x8b293a,0xcb4740,0xe48579][index%6]));
  });
  root.add(blooms);
  const center=[-139.2,1021.95];
  const apron=[];
  for(let i=0;i<72;i++){
    const point=(j,r)=>[center[0]+Math.cos(j*Math.PI/36)*r,center[1]+Math.sin(j*Math.PI/36)*r];
    const emit=([x,z])=>apron.push(x,height(x,z)+.036,z);
    for(let r=0;r<9;r++){
      const a=point(i,r),b=point(i+1,r),c=point(i,r+1),d=point(i+1,r+1);
      for(const vertex of [a,c,d,a,d,b])emit(vertex);
    }
  }
  const concrete=material(0xcac6b7);
  concrete.polygonOffset=true;concrete.polygonOffsetFactor=-2;
  root.add(new THREE.Mesh(geometry(apron),concrete));
  const paths=world.features.filter(f=>f.kind==='path'&&f.points.some(([x,z])=>Math.hypot(x-center[0],z-center[1])<38));
  const clear=(point,margin)=>paths.every(path=>path.points.slice(1).every((end,i)=>nearSegment(point,path.points[i],end)>margin));
  const shrubs=[];
  for(let i=0;i<100;i++){
    const angle=i*Math.PI/50;
    const point=[center[0]+Math.cos(angle)*20.2,center[1]+Math.sin(angle)*21.7];
    if(clear(point,2.2))shrubs.push(point);
  }
  const crown=new THREE.IcosahedronGeometry(1,quality==='low'?0:1);
  const positions=crown.getAttribute('position');
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const radius=.95+.14*Math.sin(x*15+y*9+z*17);
    positions.setXYZ(i,x*radius,Math.min(.64,y*radius),z*radius);
  }
  crown.computeVertexNormals();
  const hedge=new THREE.InstancedMesh(crown,material(0xffffff),shrubs.length);
  shrubs.forEach(([x,z],index)=>{
    pose.position.set(x,height(x,z)+.38,z);
    pose.rotation.y=random()*6.28;pose.scale.set(1.15+random()*.45,.71+random()*.18,1.14);pose.updateMatrix();
    hedge.setMatrixAt(index,pose.matrix);
    hedge.setColorAt(index,tint.setHex(index%3===0?0x495d35:0x3c532b));
  });
  root.add(hedge);
  // Early spring silhouette: trunks and open branches frame the garden.
  const pond=world.features.find(f=>f.osmId===174225267);
  const trees=[[-165,1001],[-164,1045],[-158,1051],[-109,1005],[-105,1040],[-94,998]]
    .filter(point=>clear(point,2.7)&&(!pond||!pointInPolygon(point,pond.points)));
  const branchMeshes=[];
  const up=new THREE.Vector3(0,1,0);
  function branch(a,b,width){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),axis=end.clone().sub(start);
    const g=new THREE.CylinderGeometry(width*.45,width,axis.length(),quality==='high'?7:5);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,axis.normalize()));
    g.translate(...start.lerp(end,.5).toArray());branchMeshes.push(g);
  }
  branch([0,0,0],[-.24,3.6,.18],.44);
  branch([-.24,3.6,.18],[.17,8.7,.44],.29);
  for(let i=0;i<8;i++){
    const angle=i*2.399,dx=Math.cos(angle),dz=Math.sin(angle);
    const level=3+i*.53,span=2.25+random()*1.25;
    const fork=[dx*span*.55,level+1.5,dz*span*.55];
    branch([0,level,0],fork,.15-i*.009);
    for(let j=0;j<(quality==='low'?2:3);j++){
      const direction=angle+(j-1)*.65;
      const tip=[Math.cos(direction)*span,level+2.6+random(),Math.sin(direction)*span];
      branch(fork,tip,.061);
      if(quality==='high')branch(tip,[tip[0]*1.06,tip[1]+.79,tip[2]*1.07],.025);
    }
  }
  const branches=mergeGeometries(branchMeshes);
  branchMeshes.forEach(g=>g.dispose());
  const treeBatch=new THREE.InstancedMesh(branches,material(0x655849),trees.length);
  trees.forEach(([x,z],index)=>{
    pose.position.set(x,height(x,z),z);pose.rotation.y=random()*6.28;
    pose.scale.setScalar(1+random()*.37);pose.updateMatrix();treeBatch.setMatrixAt(index,pose.matrix);
  });
  root.add(treeBatch);

  root.add(batch);
  return {root,coverage,quality,count:samples.length+bloomSamples.length+shrubs.length+trees.length};
}
