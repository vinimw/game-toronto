import * as THREE from 'three';

export const NATURE_CENTRE_OSM_ID=43805272;
const eave=3.3;

// Project the pavilion's low, paired roof ridges along the long axis of the
// existing OSM outline. Intersect its triangulation with each ridge/eave line.
const profile=p=>p[1]+.122*(p[0]-105);
const ridges=[117.3,122.9,130.8];
const levels=[3.3,4.85,3.3,4.25,3.3];
const cuts=[113,...ridges,138.5];
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
  const positions=[],indices=[],vertices=new Map();
  function index(p){
    const key=p.map(x=>x.toFixed(6)).join(',');
    if(!vertices.has(key)){
      vertices.set(key,positions.length/3);
      positions.push(p[0],roofY(p),p[1]);
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
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({color:0x414641,flatShading:true,side:THREE.DoubleSide}));
}

export function buildNatureCentre(feature){
  const ring=feature.points.slice(0,-1), positions=[],colors=[];
  const group=new THREE.Group();
  group.name='high-park-nature-centre';
  const winding=Math.sign(THREE.ShapeUtils.area(ring.map(([x,z])=>new THREE.Vector2(x,z))));
  const wood=[0x6d4936,0x79533c,0x77503a,0x835a41];
  const trim=0xd6c4a0, glass=0x455a53, door=0x405a4c;
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
    const panel=(u0,u1,lo,hi,tint,depth=0)=>quad(at(u0,lo,depth),at(u1,lo,depth),at(u1,hi,depth),at(u0,hi,depth),tint);

    panel(0,1,0,.47,0x85594a);
    for(let j=0;j<10;j++){
      const lo=.47+(eave-.47)*j/10,hi=.47+(eave-.47)*(j+1)/10;
      panel(0,1,lo,hi,wood[(i*7+j*3+Math.floor(j/3))%wood.length]);
    }
    // Gable panels follow the same height profile as the roof, including the
    // intersections with the outline. The foundation never leaves the OSM ring.
    const av=profile(a),bv=profile(b);
    const divisions=[0,1,...cuts.map(edge=>(edge-av)/(bv-av)).filter(t=>t>0&&t<1)].sort((x,y)=>x-y);
    for(let j=1;j<divisions.length;j++){
      const u=divisions[j-1],v=divisions[j],p=at(u,eave),q=at(v,eave);
      const topP=roofY([p[0],p[2]]),topQ=roofY([q[0],q[2]]);
      if(topP>eave||topQ>eave)quad(p,q,at(v,topQ),at(u,topP),wood[i%wood.length]);
    }
    panel(0,1,eave-.12,eave,0x3f3c32,.014);
    if(length<2.4)continue;

    const westEntry=(a[0]+b[0])/2<85;
    const count=Math.min(8,Math.max(1,Math.floor(length/2.05)));
    for(let j=0;j<count;j++){
      const u=(j+.5)/count;
      const entrance=westEntry&&j===Math.floor(count/2);
      const half=(entrance?.75:.65)/length,lo=entrance?.08:1.03,hi=entrance?2.52:2.58;
      panel(u-half,u+half,lo,hi,trim,.025);
      const inset=.083/length;
      panel(u-half+inset,u+half-inset,lo+.08,hi-.08,entrance?door:glass,.042);
      if(entrance){
        panel(u-half+.17/length,u+half-.17/length,1.35,hi-.18,glass,.052);
      }else{
        panel(u-.032/length,u+.032/length,lo+.06,hi-.06,trim,.052);
        panel(u-half+inset,u+half-inset,1.94,2.00,trim,.052);
      }
    }
    if(westEntry)panel(.32,.68,2.75,3.07,0x526454,.027);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const walls=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));
  const roof=roofMesh(ring);
  group.add(walls,roof);
  return {group,roof,height:Math.max(...levels)};
}
