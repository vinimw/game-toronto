import * as THREE from 'three';
import {buildNatureCentreGrounds} from './nature-centre-grounds.js';

const eave=3.16;
const palette={
  wood:[0x584035,0x5e4639,0x61493a,0x5a4336], roof:[0x41453c,0x4d5045,0x3b433b],
  post:0x4b3a2d, trim:0xd1c6a0, glass:0x3e5552, upperGlass:0x657970,
  door:0x3e5443, masonry:0x755348,
};

// Project the pavilion's low, paired roof ridges along the long axis of the
// existing OSM outline. Intersect its triangulation with each ridge/eave line.
const profile=p=>p[1]+.122*(p[0]-105);
const cuts=[113,114.2,118.5,123.2,124.1,130.7,137.1,138.5];
const levels=[eave,3.51,4.40,3.45,3.49,4.36,3.46,eave];
function roofY(p){
  const v=profile(p);
  for(let i=1;i<cuts.length;i++){
    if(v<=cuts[i]){
      const t=Math.max(0,(v-cuts[i-1])/(cuts[i]-cuts[i-1]));
      return THREE.MathUtils.lerp(levels[i-1],levels[i],t);
    }
  }
  return eave;
}
function splitAt(points,edge,side){
  const output=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    const av=profile(a)-edge,bv=profile(b)-edge;
    if(av*side>=0)output.push(a);
    if(av*bv<0){
      const t=av/(av-bv);
      output.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
    }
  }
  return output;
}
function roofMesh(ring){
  const contour=ring.map(([x,z])=>new THREE.Vector2(x,z));
  const triangles=THREE.ShapeUtils.triangulateShape(contour,[]);
  const positions=[],colors=[],indices=[],vertices=new Map();
  function index(p){
    const key=p.map(x=>x.toFixed(6)).join(',');
    if(!vertices.has(key)){
      vertices.set(key,positions.length/3);
      positions.push(p[0],roofY(p),p[1]);
      const tint=new THREE.Color(palette.roof[Math.floor((profile(p)+2)/4)%palette.roof.length]);
      colors.push(tint.r,tint.g,tint.b);
    }
    return vertices.get(key);
  }
  for(const ids of triangles){
    const polygon=ids.map(i=>ring[i]);
    const bands=[-1000,...cuts,1000];
    for(let i=1;i<bands.length;i++){
      const slice=splitAt(splitAt(polygon,bands[i-1],1),bands[i],-1);
      for(let j=2;j<slice.length;j++){
        const a=index(slice[0]),b=index(slice[j-1]),c=index(slice[j]);
        if(a!==b&&a!==c&&b!==c)indices.push(a,c,b);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true,side:THREE.DoubleSide}));
}

function entrySign(group,at,nx,nz){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=64;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#3c4d39';ctx.fillRect(0,0,384,64);
  ctx.strokeStyle='#aa9974';ctx.strokeRect(3,3,378,58);
  ctx.fillStyle='#f3ecd5';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='bold 23px Georgia';ctx.fillText('HIGH PARK NATURE CENTRE',192,33,357);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.12,.48),new THREE.MeshBasicMaterial({map}));
  sign.position.set(...at(.54,2.78,.075));
  sign.rotation.y=Math.atan2(nx,nz);
  sign.name='nature-centre-sign';
  group.add(sign);
  return sign;
}

// A soft ground-only contact follows the walls. The southeast side extends
// slightly farther away from the afternoon sun.
function groundContact(ring,winding){
  const normal=(a,b)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    return length>.0001?[dz/length*winding,-dx/length*winding]:[0,0];
  };
  const outer=ring.map((p,i)=>{
    const a=normal(ring[(i+ring.length-1)%ring.length],p);
    const b=normal(p,ring[(i+1)%ring.length]);
    const nx=a[0]+b[0],nz=a[1]+b[1],length=Math.hypot(nx,nz)||1;
    const distance=.79+.64*Math.max(0,(nx+nz)*.71/length);
    return [p[0]+nx/length*distance,p[1]+nz/length*distance];
  });
  const positions=[],colors=[];
  const vertex=([x,z],alpha)=>{
    positions.push(x,.011,z);
    colors.push(1,1,1,alpha);
  };
  for(let i=0;i<ring.length;i++){
    const j=(i+1)%ring.length;
    vertex(ring[i],1);vertex(outer[i],0);vertex(ring[j],1);
    vertex(outer[i],0);vertex(outer[j],0);vertex(ring[j],1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x505346,vertexColors:true,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true}));
  mesh.name='nature-centre-ground-contact';
  return mesh;
}

export function buildNatureCentre(feature){
  const ring=feature.points.slice(0,-1), positions=[],colors=[];
  let forecourt,entry,sign,grounds;
  const accents=new THREE.Group();
  const group=new THREE.Group();
  group.name='high-park-nature-centre';
  const winding=Math.sign(THREE.ShapeUtils.area(ring.map(([x,z])=>new THREE.Vector2(x,z))));
  const {wood,trim,glass,upperGlass,door}=palette;
  function quad(a,b,c,d,color){
    const {r,g,b:blue}=new THREE.Color(color);
    for(const p of [a,b,c,a,c,d]){positions.push(...p);colors.push(r,g,blue);}
  }
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<.001)continue;
    const nx=dz/length*winding,nz=-dx/length*winding;
    const at=(u,y,depth=0)=>[a[0]+dx*u+nx*depth,y,a[1]+dz*u+nz*depth];
    const westEntry=(a[0]+b[0])/2<85&&length>2.4;
    const face=westEntry?-.48:0;
    const panel=(u0,u1,lo,hi,tint,depth=0)=>{
      const plane=depth+face;
      quad(at(u0,lo,plane),at(u1,lo,plane),at(u1,hi,plane),at(u0,hi,plane),tint);
    };

    panel(0,1,-.027,.11,0x5e5142);
    panel(0,1,.11,.49,palette.masonry);
    for(let j=0;j<13;j++){
      const lo=.49+(eave-.49)*j/13,hi=.49+(eave-.49)*(j+1)/13;
      panel(0,1,lo,hi,wood[(i*7+j*3+Math.floor(j/3))%wood.length]);
      if(westEntry)panel(0,1,lo,lo+.017,0x49372e,.006);
    }
    // Gable panels follow the same height profile as the roof, including the
    // intersections with the outline. The foundation never leaves the OSM ring.
    const av=profile(a),bv=profile(b);
    const divisions=[0,1,...cuts.map(edge=>(edge-av)/(bv-av)).filter(t=>t>0&&t<1)].sort((x,y)=>x-y);
    for(let j=1;j<divisions.length;j++){
      const u=divisions[j-1],v=divisions[j],p=at(u,eave),q=at(v,eave);
      const topP=roofY([p[0],p[2]]),topQ=roofY([q[0],q[2]]);
      if(topP>eave||topQ>eave)quad(p,q,at(v,topQ),at(u,topP),0x5a4336);
      quad(at(u,topP-.10,.024),at(v,topQ-.10,.024),at(v,topQ,.024),at(u,topP,.024),0x383a31);
    }
    panel(0,1,eave-.13,eave-.055,0x645244,.014-face);
    panel(0,1,eave-.055,eave,0x353b32,.022-face);
    if(length<2.4)continue;

    if(westEntry){
      forecourt=[(a[0]+b[0])/2-8,(a[1]+b[1])/2,8];
      entry={at,length};
      for(const u of [0,1])
        quad(at(u,0,face),at(u,0),at(u,eave),at(u,eave,face),palette.post);
      quad(at(0,2.99,face),at(1,2.99,face),at(1,2.99),at(0,2.99),0x6a5540);
      panel(0,1,2.92,3.10,0x503e31,-face+.044);
      for(const u of [.055,.262,.415,.666,.818,.947]){
        const half=.084/length;
        panel(u-half,u+half,.22,2.99,palette.post,-face+.034);
        quad(at(u+half,.22,.034),at(u+half,.22,-.18),at(u+half,2.99,-.18),at(u+half,2.99,.034),0x674e39);
      }
      // Ground-level threshold and brick plinth, within the imported wall line.
      quad(at(.30,.10,face),at(.77,.10,face),at(.77,.10,.01),at(.30,.10,.01),0x96816a);
      panel(.30,.77,.05,.10,0x6c5547,-face+.010);
      sign=entrySign(accents,at,nx,nz);
    }
    const count=westEntry?5:Math.min(8,Math.max(1,Math.floor(length/2.05)));
    for(let j=0;j<count;j++){
      const u=westEntry?[.15,.34,.54,.74,.89][j]:(j+.5)/count;
      const entrance=westEntry&&j===Math.floor(count/2);
      const half=(entrance?.97:westEntry?.70:.62)/length,lo=entrance?.11:westEntry?.65:.95,hi=entrance?2.54:2.57;
      panel(u-half,u+half,lo,hi,trim,.025);
      const inset=.083/length;
      panel(u-half+inset,u+half-inset,lo+.08,hi-.08,entrance?door:glass,.042);
      if(entrance){
        for(const side of [-1,1]){
          const center=u+side*half*.46, light=half*.36;
          panel(center-light,center+light,1.25,2.13,upperGlass,.052);
          panel(center-light,center+light,1.24,1.66,glass,.056);
          panel(u+side*.10/length-.022/length,u+side*.10/length+.022/length,1.02,1.17,0xb9a780,.060);
        }
        panel(u-.021/length,u+.021/length,lo+.08,2.20,0x2e4035,.058);
        panel(u-half+inset,u+half-inset,2.25,hi-.09,upperGlass,.052);
      }else{
        panel(u-half+inset,u+half-inset,1.93,hi-.074,upperGlass,.048);
        panel(u-half+inset,u+half-inset,1.88,1.94,trim,.052);
        panel(u-.024/length,u+.024/length,lo+.06,hi-.06,trim,.054);
        panel(u-half-.04/length,u+half+.04/length,lo-.052,lo,0x938068,.075);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const walls=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));
  const roof=roofMesh(ring);
  const contact=groundContact(ring,winding);
  group.add(walls,roof,contact,accents);
  let level='grounds',focusX=null,focusZ=null;
  const detailAnchor=entry?.at(.54,0);
  function updateDetails(){
    const near=focusX===null||!detailAnchor||
      Math.hypot(focusX-detailAnchor[0],focusZ-detailAnchor[2])<(level==='grounds'?76:52);
    const detailed=level!=='structure'&&near;
    contact.visible=detailed;
    contact.material.opacity=level==='grounds'?.29:.21;
    if(sign)sign.visible=detailed;
    if(grounds){
      grounds.group.visible=detailed;
      if(grounds.gravel)grounds.gravel.visible=level==='grounds';
    }
  }
  updateDetails();
  return {group,roof,height:Math.max(...levels),forecourt,
    setDetail(next){level=next;updateDetails();},
    setFocus(x=null,z=null){focusX=x;focusZ=z;updateDetails();},
    decorate(options){
      if(!entry)return;
      grounds=buildNatureCentreGrounds(entry.at,entry.length,options);
      group.add(grounds.group);
      updateDetails();
    }};
}
