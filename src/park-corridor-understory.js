import * as THREE from 'three';
import {nearSegment,pointInPolygon,seeded} from './geo.js';
import {realPathAppearance} from './visual-settings.js';

export function corridorClearance(world,bounds){
  const [west,north,east,south]=bounds;
  const overlaps=points=>{
    const xs=points.map(point=>point[0]),zs=points.map(point=>point[1]);
    return Math.min(...xs)<=east+12&&Math.max(...xs)>=west-12&&
      Math.min(...zs)<=south+12&&Math.max(...zs)>=north-12;
  };
  const features=world.features.filter(feature=>overlaps(feature.points));
  const obstacles=features.filter(feature=>['building','water','sport'].includes(feature.kind));
  const paths=features.filter(feature=>feature.kind==='path'||feature.kind==='rail').map(feature=>({
    points:feature.points,halfWidth:realPathAppearance(feature).width/2,
  }));
  return (point,radius)=>!obstacles.some(({points})=>pointInPolygon(point,points)||
    points.some((a,i)=>nearSegment(point,a,points[(i+1)%points.length])<=radius))&&
    paths.every(({points,halfWidth})=>points.slice(1).every((b,i)=>nearSegment(point,points[i],b)>halfWidth+radius));
}

// Layered tufts use tapered, bent blades. Each sector has a single opaque batch.
export function addCorridorUnderstory(root,world,trees,clear,quality){
  const blades=[];
  for(let i=0;i<6;i++){
    const angle=i*2.39996,x=Math.cos(angle),z=Math.sin(angle);
    const base=.08*(i%3);
    const h=.26+(i%4)*.055;
    blades.push(x*base-z*.038,0,z*base+x*.038,x*base+z*.038,0,z*base-x*.038,
      x*(base+.08),h*.58,z*(base+.08),
      x*base+z*.038,0,z*base-x*.038,x*(base+.16),h,z*(base+.16),x*(base+.08),h*.58,z*(base+.08));
  }
  const draws=[];
  for(const [x,z] of trees){
    const random=seeded(Math.abs(Math.round(x*31+z*17)));
    const phase=random()*Math.PI*2;
    for(let i=0;i<(quality==='high'?40:24);i++){
      const angle=phase+Math.floor(i/8)*1.13+(random()-.5)*.62;
      const distance=1.3+random()*4.8;
      const p=[x+Math.cos(angle)*distance,z+Math.sin(angle)*distance];
      if(!clear(p,.43))continue;
      draws.push([p,angle,.6+random()*1.18,random()]);
    }
  }
  if(!draws.length)return;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(blades,3));
  geometry.computeVertexNormals();
  const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({
    color:0xffffff,roughness:.91,side:THREE.DoubleSide,
  }),draws.length);
  mesh.name='corridor-understory';
  const pose=new THREE.Object3D(),color=new THREE.Color();
  draws.forEach(([[x,z],angle,size,tone],i)=>{
    pose.position.set(x,world.terrain.at(x,z)-.005,z);
    pose.rotation.y=angle;
    pose.scale.set(size,size,size);
    pose.updateMatrix();
    mesh.setMatrixAt(i,pose.matrix);
    mesh.setColorAt(i,color.setHSL(.22+tone*.056,.31+tone*.15,.25+tone*.15));
  });
  root.add(mesh);
}

// One instanced batch of pinnate leaves, flowering rosettes and low stems per
// planting cell. Full crowns stay in the separately cached GLB layer.
export function addCorridorBeds(root,world,placements,spring){
  if(!placements.length)return;
  const positions=[],colors=[];
  const paint=(color,a,b,c)=>{
    positions.push(...a,...b,...c);
    const {r,g,b:blue}=new THREE.Color(color);
    for(let i=0;i<3;i++)colors.push(r,g,blue);
  };
  for(let frond=0;frond<6;frond++){
    const angle=frond*2.39996,x=Math.cos(angle),z=Math.sin(angle),length=.44+(frond%3)*.094;
    for(let node=1;node<=5;node++){
      const t=node/6,r=t*length,h=.07+Math.sin(t*2.4)*.31;
      const base=[x*r,h,z*r],tip=[x*(r+.085),h+.041,z*(r+.085)];
      for(const side of [-1,1]){
        const width=(1-t)*side*.18;
        paint(node%2?0x78964e:0x54783e,base,[x*(r+.055)+z*width,h-.01,z*(r+.055)-x*width],tip);
      }
    }
  }
  if(spring)for(let bloom=0;bloom<4;bloom++){
    const x=Math.cos(bloom*2.4)*.31,z=Math.sin(bloom*2.4)*.31,h=.19+bloom*.048;
    paint(0x527443,[x-.018,0,z],[x+.015,0,z],[x,h,z]);
    for(let petal=0;petal<5;petal++){
      const a=petal*Math.PI*.4,b=a+.64;
      paint(bloom%2?0xe1b4b8:0xe9ded1,[x,h,z],
        [x+Math.cos(a)*.078,h+.022,z+Math.sin(a)*.078],
        [x+Math.cos(b)*.078,h+.018,z+Math.sin(b)*.078]);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({
    color:0xffffff,roughness:.86,side:THREE.DoubleSide,vertexColors:true,
  }),placements.length);
  mesh.name='corridor-planted-bed';
  const pose=new THREE.Object3D(),color=new THREE.Color();
  placements.forEach(({x,z,scale,angle,tone},i)=>{
    pose.position.set(x,world.terrain.at(x,z)-.012,z);
    pose.rotation.y=angle;pose.scale.set(scale,scale*(.7+tone*.5),scale);pose.updateMatrix();
    mesh.setMatrixAt(i,pose.matrix);
    mesh.setColorAt(i,color.setScalar(.72+tone*.28));
  });
  root.add(mesh);
}
