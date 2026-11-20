import * as THREE from 'three';
import {nearSegment,pointInPolygon,seeded} from './geo.js';

export const mapleWay=251569209;
export const mapleSector='high-park:maple-leaf-garden';
export const mapleBounds=[-166,992,-111,1051];

export function buildMapleGarden(world,feature,quality){
  const root=new THREE.Group(),random=seeded(mapleWay);
  root.name=mapleSector;
  const ring=feature.points.slice(0,-1);
  const vertices=ring.map(([x,z])=>new THREE.Vector2(x,z));
  const faces=THREE.ShapeUtils.triangulateShape(vertices,[]);
  const height=(x,z)=>world.terrain.at(x,z);
  const top=[],edge=[];
  for(const face of faces){
    for(const index of [...face].reverse()){
      const [x,z]=ring[index];top.push(x,height(x,z)+.29,z);
    }
  }
  for(let i=0;i<ring.length;i++){
    const [x,z]=ring[i],[u,v]=ring[(i+1)%ring.length];
    const a=[x,height(x,z)+.025,z],b=[u,height(u,v)+.025,v];
    const c=[x,height(x,z)+.29,z],d=[u,height(u,v)+.29,v];
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
  root.add(new THREE.Mesh(geometry(top),material(0x4d392d)),new THREE.Mesh(geometry(edge),material(0x74664d)));
  const samples=[];
  const step=quality==='high'?.25:quality==='balanced'?.38:.61;
  for(let z=1014;z<1030;z+=step)for(let x=-147;x<-132;x+=step){
    const point=[x+random()*step,z+random()*step];
    if(!pointInPolygon(point,ring)||ring.some((a,i)=>nearSegment(point,a,ring[(i+1)%ring.length])<.22))continue;
    if(random()<.11)continue;
    samples.push(point);
  }
  const leaf=[];
  for(let k=0;k<5;k++){
    const angle=k*2.399,x=Math.cos(angle),z=Math.sin(angle);
    const base=[0,0,0],left=[x*.12-z*.049,.14,z*.12+x*.049],right=[x*.12+z*.049,.14,z*.12-x*.049];
    const ridge=[x*.13,.166,z*.13],tip=[x*.25,.12,z*.25];
    leaf.push(...base,...left,...ridge,...base,...ridge,...right,...left,...tip,...ridge,...ridge,...tip,...right);
  }
  const batch=new THREE.InstancedMesh(geometry(leaf),material(0xffffff),samples.length);
  const tint=new THREE.Color(),pose=new THREE.Object3D();
  const palette=[0x778847,0x6c773b,0x61904d,0x8f7950,0x75514b,0x9da461];
  samples.forEach(([x,z],index)=>{
    pose.position.set(x,height(x,z)+.29,z);
    pose.rotation.y=random()*Math.PI*2;
    pose.scale.setScalar(.68+random()*.64);pose.updateMatrix();
    batch.setMatrixAt(index,pose.matrix);
    const bronze=random()<.16+Math.max(0,Math.sin(z*.8+x))*.15;
    batch.setColorAt(index,tint.setHex(palette[bronze?3+Math.floor(random()*2):Math.floor(random()*3)]));
  });
  root.add(batch);
  return {root,coverage,quality,count:samples.length};
}
