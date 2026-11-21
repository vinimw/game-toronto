import {buildingPlacement} from './building-grounding.js';
import * as THREE from 'three';

export const cafeWay=125699284;
export const stopBounds=[-111,739,-55,799];
// Stop 5 serves the café. The precise parked pose is illustrative.
const stop=[-82,793.9], yaw=Math.atan2(8.25,1.43);

function palette(colors){
  return Object.fromEntries(Object.entries(colors).map(([key,color])=>
    [key,new THREE.MeshStandardMaterial({color,roughness:.78})]));
}

function box(root,material,size,position){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
  mesh.position.set(...position);root.add(mesh);
  return mesh;
}
function cylinder(root,material,radius,length,position,rotation,segments=12){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,segments),material);
  mesh.position.set(...position);mesh.rotation.set(...rotation);root.add(mesh);
}

export function trainFootprints(world){
  const result=[];
  for(const offset of [0,-4.25,-8.5]){
    const points=[[-1,-1.95],[1,-1.95],[1,1.95],[-1,1.95]].map(([x,z])=>[
      stop[0]+x*Math.cos(yaw)+(z+offset)*Math.sin(yaw),
      stop[1]-x*Math.sin(yaw)+(z+offset)*Math.cos(yaw),
    ]);
    const floor=Math.min(...points.map(p=>world.terrain.at(...p)));
    result.push({id:'trackless-train:'+offset,kind:'building',points,minHeight:floor,height:floor+2.95});
  }
  return result;
}

export function buildGrenadierStop(world,quality){
  const root=new THREE.Group();
  root.name='high-park:grenadier-stop';
  const m=palette({red:0xa4292b,cream:0xeee4ce,dark:0x29282b,brass:0xc49b54,
    roof:0x45514e,trim:0xe7dcc4,glass:0x344749,wood:0x75634d,light:0xffdc91});
  const train=new THREE.Group();train.rotation.y=yaw;
  train.position.set(stop[0],world.terrain.at(...stop),stop[1]);root.add(train);
  const detail=quality==='high',sides=detail?14:quality==='low'?7:10;
  for(const offset of [0,-4.25,-8.5]){
    const car=new THREE.Group();car.position.z=offset;
    const axis=new THREE.Vector3(0,0,offset).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
    car.position.y=world.terrain.at(stop[0]+axis.x,stop[1]+axis.z)-train.position.y;
    train.add(car);
    box(car,m.red,[1.92,.29,3.82],[0,.62,0]);
    box(car,m.dark,[.17,.13,.56],[0,.55,-2.05]);
    for(const x of [-.96,.96])box(car,m.cream,[.028,.065,3.5],[x,.71,0]);
    for(const x of [-.88,.88])for(const z of [-1.22,1.19]){
      cylinder(car,m.dark,.4,.22,[x,.43,z],[0,0,Math.PI/2],sides);
      cylinder(car,m.brass,.20,.235,[x,.43,z],[0,0,Math.PI/2],sides);
    }
    if(offset===0){
      cylinder(car,m.red,.59,2.05,[0,1.42,.63],[Math.PI/2,0,0],sides);
      cylinder(car,m.dark,.5,.07,[0,1.42,1.69],[Math.PI/2,0,0],sides);
      cylinder(car,m.brass,.23,.16,[0,1.93,1.63],[Math.PI/2,0,0],sides);
      cylinder(car,m.light,.165,.023,[0,1.93,1.72],[Math.PI/2,0,0],sides);
      box(car,m.dark,[1.78,.22,.16],[0,.47,1.91]);
      cylinder(car,m.dark,.15,.73,[0,2.07,1.07],[0,0,0],sides);
      cylinder(car,m.brass,.17,.09,[0,2.49,1.07],[0,0,0],sides);
      box(car,m.red,[1.68,.62,1.25],[0,1.03,-1.18]);
      box(car,m.cream,[1.85,.12,1.48],[0,2.62,-1.15]);
      for(const x of [-.78,.78])for(const z of [-1.69,-.61])box(car,m.red,[.075,1.25,.075],[x,1.97,z]);
    }else{
      box(car,m.cream,[2.05,.13,3.98],[0,2.39,0]);
      for(const x of [-.87,.87]){
        box(car,m.red,[.07,.42,3.7],[x,.95,0]);
        box(car,m.cream,[.085,.06,3.77],[x,1.17,0]);
        for(const z of [-1.73,0,1.73])box(car,m.cream,[.06,1.42,.06],[x,1.63,z]);
      }
      for(const z of [-1.22,-.41,.41,1.22]){
        box(car,m.wood,[1.53,.09,.34],[0,1.02,z]);
        if(detail)box(car,m.wood,[1.53,.31,.07],[0,1.22,z-.16]);
      }
    }
  }
  const cafe=world.features.find(f=>f.osmId===cafeWay);
  if(cafe){
    const exterior=new THREE.Group();
    exterior.name='grenadier-cafe-exterior';
    root.add(exterior);
    exterior.userData.entrances=[];
    const ring=cafe.points.slice(0,-1),floor=buildingPlacement(world,cafe).floor;
    const outline=ring.map(([x,z])=>new THREE.Vector2(x,z));
    const center=ring.reduce(([x,z],p)=>[x+p[0]/ring.length,z+p[1]/ring.length],[0,0]);
    const roof=[];
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      const eave=p=>[p[0],floor+3.55,p[1]];
      const ridge=p=>[THREE.MathUtils.lerp(p[0],center[0],.55),floor+6.25,THREE.MathUtils.lerp(p[1],center[1],.83)];
      roof.push(...eave(a),...eave(b),...ridge(a),...eave(b),...ridge(b),...ridge(a));
    }
    for(const face of THREE.ShapeUtils.triangulateShape(outline,[]))
      for(const i of face){
        const [x,z]=ring[i];roof.push(THREE.MathUtils.lerp(x,center[0],.55),floor+6.25,THREE.MathUtils.lerp(z,center[1],.83));
      }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(roof,3));geo.computeVertexNormals();
    m.roof.side=THREE.DoubleSide;exterior.add(new THREE.Mesh(geo,m.roof));
    for(const [facade,[a,b]] of [[ring[0],ring[1]],[ring[3],ring[5]]].entries()){
      const angle=-Math.atan2(b[1]-a[1],b[0]-a[0]);
      for(const t of [.22,.5,.78]){
        const x=THREE.MathUtils.lerp(a[0],b[0],t),z=THREE.MathUtils.lerp(a[1],b[1],t);
        // The western panel was an invented entrance on a plain footprint.
        const door=facade===1&&t===.5;
        const dim=door?[1.95,2.35]:[2.34,1.65],y=floor+(door?1.36:2.05);
        if(door){
          const sign=Math.sign((x-center[0])*(-Math.sin(angle))+(z-center[1])*Math.cos(angle));
          exterior.userData.entrances.push({id:'south-exterior',role:'exterior-only',source:'stylized',transitable:false,threshold:[x,y-dim[1]/2,z+.07],
            approach:[x-Math.sin(angle)*sign*2,0,z+Math.cos(angle)*sign*2]});
        }
        const window=box(exterior,m.trim,[...dim,.19],[x,y,z+.07]);window.rotation.y=angle;
        const glass=box(exterior,m.glass,[dim[0]-.22,dim[1]-.23,.07],[x,y,z+.17]);glass.rotation.y=angle;
        const mullion=box(exterior,m.trim,[.067,dim[1]-.10,.07],[x,y,z+.21]);mullion.rotation.y=angle;
      }
    }
  }
  return root;
}
