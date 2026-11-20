import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {seeded} from './geo.js';

function merge(parts){
  const result=mergeGeometries(parts);
  for(const part of parts)part.dispose();
  return result;
}

function branch(start,end,base,tip){
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end);
  const axis=b.clone().sub(a);
  const geometry=new THREE.CylinderGeometry(tip,base,axis.length(),5,1);
  const orientation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());
  return geometry.applyQuaternion(orientation).translate(...a.lerp(b,.5).toArray());
}

export function sakuraWoodGeometry(){
  const parts=[
    [[0,0,0],[.17,2.18,.04],.29,.16],
    [[.15,1.4,.02],[-1.67,3.46,.24],.16,.075],
    [[.17,2.05,.05],[1.67,3.83,-.31],.15,.068],
    [[-.69,2.42,.11],[-.56,3.61,-1.3],.085,.035],
    [[.55,2.55,-.04],[.74,3.43,1.48],.09,.034],
    [[.17,2.06,0],[.03,4.16,-.24],.115,.052],
  ];
  return merge(parts.map(args=>branch(...args)));
}

export function sakuraCrownGeometry(variant){
  const random=seeded(8042+variant*217);
  const lobes=[
    [-1.72,3.8,.26,1.36,.95,1.13],[-.75,3.93,-1.34,1.12,.84,1.19],
    [.09,4.56,-.23,1.52,1.13,1.36],[1.54,4.07,-.48,1.25,.87,1.05],
    [.84,3.79,1.39,1.28,.83,1.09],[-.88,3.69,1.03,1.02,.76,.89],
    [2.05,3.84,.58,.91,.7,.85],
  ].map(([x,y,z,sx,sy,sz],index)=>{
    const geometry=new THREE.IcosahedronGeometry(1,index%3===2?0:1);
    const dy=(random()-.5)*.44;
    geometry.rotateY(random()*Math.PI).scale(sx,sy,sz).translate(x,y+dy,z);
    const vertices=geometry.getAttribute('position'),colors=[];
    const bottom=new THREE.Color(variant?0xdba4b9:0xe9c4d1),top=new THREE.Color(variant?0xffe4eb:0xfff3ed);
    const tint=new THREE.Color();
    for(let i=0;i<vertices.count;i+=3){
      const height=(vertices.getY(i)+vertices.getY(i+1)+vertices.getY(i+2))/3;
      const shade=THREE.MathUtils.clamp(.43+(height-y)/1.55+(random()-.5)*.22,0,1);
      tint.copy(bottom).lerp(top,shade);
      for(let j=0;j<3;j++)colors.push(tint.r,tint.g,tint.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    return geometry;
  });
  return merge(lobes);
}
