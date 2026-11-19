import * as THREE from 'three';
import {seeded} from './geo.js';
import {realPathAppearance} from './visual-settings.js';

// Small repeating texture with broad color variation and fine grain. It changes
// only surface color: elevations and imported geometry stay in the data layer.
export function terrainTexture(real=false){
  const size=128,rand=seeded(7382),pixels=new Uint8Array(size*size*4);
  const layer=(cells,seed)=>{
    const random=seeded(seed), samples=Array.from({length:cells*cells},()=>random());
    return (x,y)=>{
      const u=x*cells/size,v=y*cells/size,i=Math.floor(u),j=Math.floor(v);
      const smooth=t=>t*t*(3-2*t);
      const tx=smooth(u-i),ty=smooth(v-j);
      const at=(a,b)=>samples[(b%cells)*cells+(a%cells)];
      const a=THREE.MathUtils.lerp(at(i,j),at(i+1,j),tx);
      const b=THREE.MathUtils.lerp(at(i,j+1),at(i+1,j+1),tx);
      return THREE.MathUtils.lerp(a,b,ty)-.5;
    };
  };
  const broad=layer(5,96712), fine=layer(21,43118);
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const u=x/size*Math.PI*2,v=y/size*Math.PI*2;
      const patches=real?42*broad(x,y)+20*fine(x,y):13*Math.sin(u+Math.sin(v*2))+8*Math.cos(2*v-u)+5*Math.sin(4*u+3*v);
      const grain=(real?17:7)*(rand()-.5), tone=Math.round(224+patches+grain);
      pixels.set([Math.min(255,tone+3),Math.min(255,tone),Math.min(255,Math.round(tone-3+patches*.24)),255],(y*size+x)*4);
    }
  }
  const texture=new THREE.DataTexture(pixels,size,size);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

export function worldUVs(geometry,plane=false){
  const p=geometry.getAttribute('position'),uv=[];
  for(let i=0;i<p.count;i++)uv.push(p.getX(i)/31,(plane?-p.getY(i):p.getZ(i))/31);
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
}

export function appendStrip(vertices,points,width,height){
  for(let i=1;i<points.length;i++){
    const [ax,az]=points[i-1],[bx,bz]=points[i];
    const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
    if(length<.05)continue;
    const nx=-dz/length*width/2,nz=dx/length*width/2;
    vertices.push(ax+nx,height,az+nz,ax-nx,height,az-nz,bx+nx,height,bz+nz,
      ax-nx,height,az-nz,bx-nx,height,bz-nz,bx+nx,height,bz+nz);
  }
}

// A small disk underneath each interior junction covers the outside of the
// bend. Its radius matches the strip half-width and it is purely decorative.
function appendJoins(vertices,points,width,height){
  const radius=width/2,sides=10;
  for(const [x,z] of points.slice(1,-1)){
    for(let side=0;side<sides;side++){
      const a=side*Math.PI*2/sides,b=(side+1)*Math.PI*2/sides;
      vertices.push(x,height,z,x+Math.cos(b)*radius,height,z+Math.sin(b)*radius,
        x+Math.cos(a)*radius,height,z+Math.sin(a)*radius);
    }
  }
}

export function addPathBatches(scene,paths,style,pathWidth,texture,onGeometry,real=false){
  const batches=new Map(), featherPositions=[], featherColors=[];
  const evidence=onGeometry?new Map():null;
  const add=(points,width,height,color)=>{
    if(!batches.has(color))batches.set(color,[]);
    const vertices=batches.get(color),start=vertices.length;
    appendStrip(vertices,points,width,height);
    return {start:start/3,end:vertices.length/3};
  };
  for(const feature of paths){
    const appearance=real?realPathAppearance(feature):null;
    const width=appearance?.width??pathWidth(feature);
    const color=real?style[appearance.surface]:feature.kind==='rail'?style.rail:
      width>=4 && !['pedestrian','living_street'].includes(feature.tags?.highway)?style.road:style.trail;
    const road=color!==style.trail;
    const height=real?(appearance.crossing?.035:road?.033:.031):.032;
    if(!real)add(feature.points,width+(road?.36:.22),.023,style.verge);
    if(real?appearance.softEdge:!road)appendFeather(feature.points,width,featherPositions,featherColors,real);
    const strip=add(feature.points,width,height,color);
    if(real)appendJoins(batches.get(color),feature.points,width,height-.0006);
    if(evidence){
      if(!evidence.has(color))evidence.set(color,[]);
      evidence.get(color).push({feature,...strip});
    }
  }
  for(const [color,vertices] of batches){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.computeVertexNormals();worldUVs(geometry);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({color,map:texture,side:THREE.DoubleSide}));
    scene.add(mesh);
    for(const {feature,start,end} of evidence?.get(color)??[])onGeometry(feature,mesh,start,end);
  }
  if(featherPositions.length){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(featherPositions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(featherColors,4));
    geometry.computeVertexNormals();worldUVs(geometry);
    scene.add(new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({color:style.verge,map:texture,
      vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide})));
  }
}

function appendFeather(points,width,positions,colors,real=false){
  for(let i=1;i<points.length;i++){
    const [ax,az]=points[i-1],[bx,bz]=points[i];
    const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
    if(length<.05)continue;
    const slices=Math.min(72,Math.ceil(length/2.65));
    for(const side of [-1,1]){
      const nx=-dz/length*side,nz=dx/length*side,edge=width/2+(real?-.035:.08);
      const outer=t=>edge+.31+.13*Math.sin((ax+dx*t)*1.11+(az+dz*t)*.74+side);
      const add=(t,offset,alpha)=>{
        positions.push(ax+dx*t+nx*offset,.024,az+dz*t+nz*offset);
        colors.push(1,1,1,alpha);
      };
      const opacity=real?.62:.83;
      for(let j=0;j<slices;j++){
        const a=j/slices,b=(j+1)/slices;
        add(a,edge,opacity);add(a,outer(a),0);add(b,edge,opacity);
        add(a,outer(a),0);add(b,outer(b),0);add(b,edge,opacity);
      }
    }
  }
}

export function contactTexture(){
  const size=32,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const r=Math.hypot((x+.5-size/2)/(size/2),(y+.5-size/2)/(size/2));
    pixels.set([255,255,255,Math.round(255*Math.max(0,1-r*r)**2)],(y*size+x)*4);
  }
  const texture=new THREE.DataTexture(pixels,size,size);
  texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return texture;
}
