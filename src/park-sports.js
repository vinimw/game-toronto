import * as THREE from 'three';
import {pointInPolygon} from './geo.js';

export const northernSports=[14344501,14344509,14344528,680982127,1116261446,1116261447,1116261448];

export function buildNorthernSports(world){
  const root=new THREE.Group(),chalk=[],clay=[],tennis=[];
  root.name='high-park:northern-sports';
  function vertex(out,x,z,y=.065){out.push(x,world.terrain.at(x,z)+y,z);}
  function line(a,b,width=.115){
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length<.02)return;
    const nx=(b[1]-a[1])/length*width/2,nz=(a[0]-b[0])/length*width/2;
    const steps=Math.ceil(length/1.5);
    for(let i=0;i<steps;i++){
      const p=a.map((v,k)=>THREE.MathUtils.lerp(v,b[k],i/steps));
      const q=a.map((v,k)=>THREE.MathUtils.lerp(v,b[k],(i+1)/steps));
      for(const [u,side] of [[p,-1],[p,1],[q,1],[p,-1],[q,1],[q,-1]])
        vertex(chalk,u[0]+nx*side,u[1]+nz*side,.105);
    }
  }
  for(const feature of world.features.filter(f=>northernSports.includes(f.osmId))){
    const ring=feature.points.slice(0,-1);
    const sport=feature.tags.sport;
    if(sport==='baseball'){
      // Two mapped outlines have identifiable foul-line corners. Paint only
      // these infields, with decorative markings inside the surveyed boundary.
      const corners={14344509:[0,1,18],14344528:[14,12,0]}[feature.osmId];
      if(!corners)continue;
      const [home,left,right]=corners.map(i=>ring[i]);
      const direction=point=>{
        const dx=point[0]-home[0],dz=point[1]-home[1],length=Math.hypot(dx,dz);
        return [dx/length,dz/length];
      };
      const u=direction(left),v=direction(right);
      const at=(a,b)=>[home[0]+u[0]*(a+3)+v[0]*(b+3),home[1]+u[1]*(a+3)+v[1]*(b+3)];
      for(let i=0;i<14;i++)for(let j=0;j<14;j++)
        for(const [a,b] of [[0,0],[2,0],[2,2],[0,0],[2,2],[0,2]])
          vertex(clay,...at(i*2+a,j*2+b));
      line(at(0,0),at(48,0));line(at(0,0),at(0,48));
      for(const [a,b] of [[.2,.2],[26,.2],[26,26],[.2,26]]){
        line(at(a-.2,b),at(a+.2,b),.38);
      }
      continue;
    }
    if(ring.length!==4)continue;
    const c=ring.reduce(([x,z],p)=>[x+p[0]/4,z+p[1]/4],[0,0]);
    const inset=ring.map(([x,z])=>[THREE.MathUtils.lerp(x,c[0],.09),THREE.MathUtils.lerp(z,c[1],.09)]);
    const sides=inset.map(([x,z],i)=>Math.hypot(x-inset[(i+1)%4][0],z-inset[(i+1)%4][1]));
    const k=sides[0]>sides[1]?0:1;
    const point=(u,v)=>inset[k].map((_,i)=>THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(inset[k][i],inset[(k+1)%4][i],u),
      THREE.MathUtils.lerp(inset[(k+3)%4][i],inset[(k+2)%4][i],u),v));
    for(let i=0;i<4;i++)line(inset[i],inset[(i+1)%4]);
    line(point(.5,0),point(.5,1));
    if(sport==='tennis'){
      for(let u=0;u<10;u++)for(let v=0;v<5;v++)
        for(const [a,b] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]])
          vertex(tennis,...point((u+a)/10,(v+b)/5));
      for(const u of [.25,.75])line(point(u,.14),point(u,.86));
      for(const v of [.14,.86])line(point(0,v),point(1,v));
      line(point(.25,.5),point(.75,.5));
    }else{
      for(const u of [0,1]){
        const inside=u===0?.15:.85;
        line(point(u,.24),point(inside,.24));line(point(inside,.24),point(inside,.76));
        line(point(inside,.76),point(u,.76));
      }
      const anglePoint=i=>point(.5+Math.cos(i*Math.PI/20)*.085,.5+Math.sin(i*Math.PI/20)*.14);
      for(let i=0;i<40;i++)line(anglePoint(i),anglePoint(i+1));
    }
  }
  for(const [values,color] of [[chalk,0xe8e2c7],[clay,0x9b684a],[tennis,0x426d61]]){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));
    geometry.computeVertexNormals();
    root.add(new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide})));
  }
  return root;
}
