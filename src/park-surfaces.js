import * as THREE from 'three';
import {seeded} from './geo.js';
import {realPathAppearance} from './visual-settings.js';

// Small repeating texture with broad color variation and fine grain. It changes
// only surface color: elevations and imported geometry stay in the data layer.
export function terrainTexture(real=false){
  const size=real?256:128,rand=seeded(7382),pixels=new Uint8Array(size*size*4);
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
  const broad=layer(4,96712),middle=layer(9,12971),fine=layer(23,43118);
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const u=x/size*Math.PI*2,v=y/size*Math.PI*2;
      const soil=real?46*broad(x,y)+21*middle(x,y):0;
      const patches=real?soil+17*fine(x,y):13*Math.sin(u+Math.sin(v*2))+8*Math.cos(2*v-u)+5*Math.sin(4*u+3*v);
      const grain=(real?18:7)*(rand()-.5), tone=Math.round(224+patches+grain);
      const warm=real?Math.round(soil*.34):0;
      pixels.set([Math.min(255,tone+3+warm),Math.min(255,tone),Math.min(255,Math.round(tone-3+patches*.24-warm)),255],(y*size+x)*4);
    }
  }
  const texture=new THREE.DataTexture(pixels,size,size);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

export function worldUVs(geometry,plane=false,real=false){
  const p=geometry.getAttribute('position'),uv=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=plane?-p.getY(i):p.getZ(i);
    if(real)uv.push((x*.96-z*.28)/79,(x*.28+z*.96)/79);
    else uv.push(x/31,z/31);
  }
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

// Each cross-section is symmetric about the imported axis. Sharing it across
// bends replaces the overlapping junction disks while preserving the evidence
// tap's vertex ordering and exactly the same centreline.
function joinedSections(points){
  const segments=points.slice(1).map(([x,z],i)=>{
    const dx=x-points[i][0],dz=z-points[i][1],length=Math.hypot(dx,dz);
    return length<.05?null:{nx:-dz/length,nz:dx/length,length};
  });
  const sections=points.map(([x,z],i)=>{
    const a=segments[i-1],b=segments[i];
    const normal=a??b;
    if(!normal)return {x,z,nx:0,nz:0};
    if(!a||!b)return {x,z,nx:normal.nx,nz:normal.nz};
    const dot=1+a.nx*b.nx+a.nz*b.nz;
    // Limit acute join length. The ring still meets on both sides of the axis.
    if(dot<.08)return {x,z,nx:a.nx,nz:a.nz};
    const factor=Math.min(1/dot,1.52/Math.sqrt(2*dot));
    return {x,z,nx:(a.nx+b.nx)*factor,nz:(a.nz+b.nz)*factor};
  });
  return {sections,segments};
}

function pathVertex({x,z,nx,nz},offset,height){
  return [x+nx*offset,height,z+nz*offset];
}

function appendJoinedPath(vertices,feature,width,height,shoulder,edge){
  const {sections,segments}=joinedSections(feature.points),half=width/2;
  for(const [i,segment] of segments.entries()){
    if(!segment)continue;
    const a=sections[i],b=sections[i+1];
    const al=pathVertex(a,half,height),ar=pathVertex(a,-half,height);
    const bl=pathVertex(b,half,height),br=pathVertex(b,-half,height);
    vertices.push(...al,...ar,...bl,...ar,...br,...bl);
    if(shoulder>0)appendShoulders(a,b,half,shoulder,segment.length,edge);
  }
}

function appendShoulders(a,b,half,width,length,{positions,colors}){
  const steps=Math.ceil(length/(width<.2?5:2.7));
  const alpha=width<.2?.44:.68;
  const lerp=THREE.MathUtils.lerp;
  for(const side of [-1,1]){
    const sample=t=>{
      const section={x:lerp(a.x,b.x,t),z:lerp(a.z,b.z,t),nx:lerp(a.nx,b.nx,t),nz:lerp(a.nz,b.nz,t)};
      const variation=.82+.15*Math.sin(section.x*.51+section.z*.79+side)+.18*Math.sin(section.z*.22-section.x*.38);
      return [pathVertex(section,side*(half-.025),.025),pathVertex(section,side*(half+width*variation),.025)];
    };
    let [innerStart,outerStart]=sample(0);
    for(let i=1;i<=steps;i++){
      const [innerEnd,outerEnd]=sample(i/steps);
      positions.push(...innerStart,...outerStart,...innerEnd,...outerStart,...outerEnd,...innerEnd);
      colors.push(1,1,1,alpha,1,1,1,0,1,1,1,alpha,1,1,1,0,1,1,1,0,1,1,1,alpha);
      innerStart=innerEnd;outerStart=outerEnd;
    }
  }
}

export function addPathBatches(scene,paths,style,pathWidth,texture,onGeometry,real=false){
  const batches=new Map(), shoulders=new Map(), featherPositions=[], featherColors=[];
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
    let strip;
    if(real){
      if(!batches.has(color))batches.set(color,[]);
      if(appearance.shoulder&&!shoulders.has(color))shoulders.set(color,{positions:[],colors:[]});
      const vertices=batches.get(color),start=vertices.length/3;
      appendJoinedPath(vertices,feature,width,height,appearance.shoulder,shoulders.get(color));
      strip={start,end:vertices.length/3};
    }else{
      add(feature.points,width+(road?.36:.22),.023,style.verge);
      if(!road)appendFeather(feature.points,width,featherPositions,featherColors);
      strip=add(feature.points,width,height,color);
    }
    if(evidence){
      if(!evidence.has(color))evidence.set(color,[]);
      evidence.get(color).push({feature,...strip});
    }
  }
  for(const [color,vertices] of batches){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.computeVertexNormals();worldUVs(geometry,false,real);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({color,map:texture,side:THREE.DoubleSide}));
    scene.add(mesh);
    for(const {feature,start,end} of evidence?.get(color)??[])onGeometry(feature,mesh,start,end);
  }
  if(!real)shoulders.set(style.verge,{positions:featherPositions,colors:featherColors});
  for(const [color,{positions,colors}] of shoulders){
    if(!positions.length)continue;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
    geometry.computeVertexNormals();worldUVs(geometry,false,real);
    scene.add(new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({color,map:texture,
      vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:real})));
  }
}

function appendFeather(points,width,positions,colors){
  for(let i=1;i<points.length;i++){
    const [ax,az]=points[i-1],[bx,bz]=points[i];
    const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
    if(length<.05)continue;
    const slices=Math.min(72,Math.ceil(length/2.65));
    for(const side of [-1,1]){
      const nx=-dz/length*side,nz=dx/length*side,edge=width/2+.08;
      const outer=t=>edge+.31+.13*Math.sin((ax+dx*t)*1.11+(az+dz*t)*.74+side);
      const add=(t,offset,alpha)=>{
        positions.push(ax+dx*t+nx*offset,.024,az+dz*t+nz*offset);
        colors.push(1,1,1,alpha);
      };
      const opacity=.83;
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
