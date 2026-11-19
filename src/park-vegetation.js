import * as THREE from 'three';
import {nearSegment,pointInPolygon,seeded} from './geo.js';
import {contactTexture} from './park-surfaces.js';
import {parkStyle,realParkStyle,realParkDetailRadius,pathWidth,realPathAppearance,qualityProfiles} from './visual-settings.js';

function pathSegments(features,real){
  const segments=[];
  for(const feature of features){
    if(feature.kind!=='path'&&feature.kind!=='rail')continue;
    const width=Math.max(pathWidth(feature),real?realPathAppearance(feature).width:0);
    for(let i=1;i<feature.points.length;i++){
      const a=feature.points[i-1],b=feature.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(length>.05)segments.push({a,b,length,edge:width/2});
    }
  }
  return segments;
}

function beside({a,b,length,edge},extra,rand,t=rand(),side=rand()<.5?-1:1){
  const offset=(edge+extra)*side;
  return [a[0]+(b[0]-a[0])*t-(b[1]-a[1])*offset/length,
    a[1]+(b[1]-a[1])*t+(b[0]-a[0])*offset/length];
}

function realGroves(bounds,footpaths,zone,rand){
  const [minX,minZ,maxX,maxZ]=bounds;
  const groves=[];
  function add(point,radius,spacing,count){
    const type=zone(point);
    if(type!=='wood'&&type!=='park'&&type!=='fringe')return;
    if(groves.some(grove=>Math.hypot(grove.point[0]-point[0],grove.point[1]-point[1])<spacing))return;
    const budget=type==='wood'?count+3:type==='fringe'?2:count;
    groves.push({point,radius,count:budget,species:Math.floor(rand()*realParkStyle.trees.length)});
  }
  // Seed verges by metres of trail, carrying the spacing over short segments.
  // This also distributes groves along simplified and densely sampled ways alike.
  let next=0;
  for(const segment of footpaths){
    for(;next<segment.length;next+=12+rand()*13){
      for(const side of [-1,1])
        add(beside(segment,4+rand()*9,rand,next/segment.length,side),6+rand()*8,12,4);
    }
    next-=segment.length;
  }
  for(let i=0;i<280;i++){
    const point=[minX+rand()*(maxX-minX),minZ+rand()*(maxZ-minZ)];
    add(point,10+rand()*13,zone(point)==='wood'?18:27,4);
  }
  return groves;
}

function grassTuft(){
  const vertices=[];
  for(const angle of [0,2.1,4.2]){
    const x=Math.cos(angle),z=Math.sin(angle);
    vertices.push(-x*.22,0,-z*.22,x*.22,0,z*.22,x*.37,1,z*.37);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  return geometry;
}

function broadCrown(phase){
  const geometry=new THREE.DodecahedronGeometry(1);
  const positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const radius=.98+.10*Math.sin(x*5+z*3-y*4+phase);
    positions.setXYZ(i,x*radius+.13*y,y*(.98+.08*Math.sin(z*6+phase)),z*radius);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function plantPark(scene,world,portals,blocked,clearings=[]){
  const real=world.mode==='osm',style=real?realParkStyle:parkStyle;
  const rand=seeded(99471), segments=pathSegments(world.features,real);
  const footpaths=segments.filter(segment=>segment.edge<=1.65);
  const greens=world.features.filter(f=>f.kind==='green');
  const landmarks=[...portals.map(p=>p.position),world.memory].filter(Boolean);
  const bounds=world.bbox||[-220,-220,220,220];
  const [minX,minZ,maxX,maxZ]=bounds;
  const woods=greens.filter(f=>f.tags?.natural==='wood'||f.tags?.landuse==='forest');
  const lawns=greens.filter(f=>f.tags?.landuse==='grass'||['pitch','garden'].includes(f.tags?.leisure));
  const contains=(features,point)=>features.some(f=>pointInPolygon(point,f.points));
  function zone(point){
    const lawn=lawns.find(f=>pointInPolygon(point,f.points));
    if(lawn){
      if(lawn.tags.landuse==='grass'&&lawn.points.some((p,i,ring)=>nearSegment(point,p,ring[(i+1)%ring.length])<8))
        return 'fringe';
      return 'open';
    }
    if(contains(woods,point))return 'wood';
    return contains(greens,point)?'park':null;
  }
  function clear(point,radius){
    const [x,z]=point;
    if(x<minX+radius||x>maxX-radius||z<minZ+radius||z>maxZ-radius)return false;
    if(landmarks.some(([a,b])=>Math.hypot(x-a,z-b)<style.landmarkClearance+radius))return false;
    if(clearings.some(([a,b,extent])=>Math.hypot(x-a,z-b)<extent+radius))return false;
    if(segments.some(({a,b,edge})=>nearSegment(point,a,b)<edge+radius+style.pathMargin))return false;
    return !blocked(point,radius);
  }
  const geometry={
    trunk:new THREE.CylinderGeometry(.19,.31,1,5),
    round:real?broadCrown(1.5):new THREE.IcosahedronGeometry(1,1),
    spire:new THREE.CylinderGeometry(real?.28:.14,1,2,7),
    column:new THREE.IcosahedronGeometry(1,real?0:1),
    spread:real?broadCrown(4):new THREE.DodecahedronGeometry(1),
    grass:grassTuft(),
    ...(real?{flower:new THREE.CircleGeometry(1,5).rotateX(-Math.PI/2)}:{}),
    stone:new THREE.IcosahedronGeometry(1),
    contact:new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2),
  };
  const groups=new Map(), dummy=new THREE.Object3D(), color=new THREE.Color();
  function add(shape,x,y,z,sx,sy,sz,tint){
    const entries=groups.get(shape)||[];
    if(!groups.has(shape))groups.set(shape,entries);
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.y=rand()*Math.PI*2;dummy.updateMatrix();
    entries.push({x,z,matrix:dummy.matrix.clone(),color:color.set(tint).multiplyScalar(.86+rand()*.24).clone()});
  }
  const trees=[], cameraVolumes=[];
  const limit=Math.min(style.treeLimit,Math.ceil((maxX-minX)*(maxZ-minZ)/460));
  // Groves have variable radii and a dominant species. Mixing between groves
  // leaves open lawns and isolated trees without a regular planting grid.
  const groves=real?realGroves(bounds,footpaths,zone,rand):[];
  for(let i=0;!real&&i<Math.ceil(limit/9);i++){
    const point=segments.length&&i%3===0?beside(segments[i%segments.length],6+rand()*12,rand):
      [minX+rand()*(maxX-minX),minZ+rand()*(maxZ-minZ)];
    if(i%3!==0&&!contains(greens,point))continue;
    groves.push({point,radius:style.clusterRadius*(.5+rand()),species:Math.floor(rand()*style.trees.length)});
  }
  function plantTree(grove){
    const angle=rand()*Math.PI*2, radius=grove?Math.sqrt(rand())*grove.radius:0;
    const point=grove?[grove.point[0]+Math.cos(angle)*radius,grove.point[1]+Math.sin(angle)*radius]:
      segments.length?beside(segments[Math.floor(rand()*segments.length)],4+rand()*14,rand):
      [minX+rand()*(maxX-minX),minZ+rand()*(maxZ-minZ)];
    if(!grove&&!segments.length&&!contains(greens,point))return false;
    const species=grove&&rand()<.68?grove.species:Math.floor(rand()*style.trees.length);
    const tree=style.trees[species], scale=real?.66+rand()*.58:.7+rand()*.44;
    const width=tree.width*scale,height=tree.height*scale,depth=tree.depth*scale;
    const type=real?zone(point):null;
    const spacing=real&&type!=='wood'?style.treeSpacing+.35:style.treeSpacing;
    if(real&&(!type||type==='open'))return false;
    if(!clear(point,width*1.25)||trees.some(([x,z])=>Math.hypot(x-point[0],z-point[1])<spacing))return false;
    const [x,z]=point;trees.push(point);
    const crownY=height-depth*.65;
    const trunkWidth=real?scale*(.77+width*.18):scale;
    add('trunk',x,crownY*.5,z,trunkWidth,crownY,trunkWidth,0x826249);
    add(tree.shape,x,crownY,z,width,depth,width*.9,tree.leaf);
    if(tree.shape==='spread'||tree.shape==='round'){
      const angle=real?rand()*Math.PI*2:0;
      const cx=x+width*(real?.52*Math.cos(angle):.53),cz=z+width*(real?.52*Math.sin(angle):.2);
      add(tree.shape,cx,crownY-depth*.29,cz,width*.72,depth*.71,width*.72,tree.leaf);
      cameraVolumes.push({center:[cx,crownY-depth*.29,cz],radii:[width*.74,depth*.75,width*.74]});
    }
    if(tree.shape==='spire'){
      add('spire',x,crownY+depth*.65,z,width*.68,depth*.62,width*.66,tree.leaf);
      cameraVolumes.push({center:[x,crownY+depth*.65,z],radii:[width*.68,depth*.62,width*.66]});
    }
    add('contact',x+(real?1.05:.4),.009,z+(real?.86:.24),width*(real?1.8:1.22),1,width*(real?1.32:.86),real?0x46583e:0x596d4a);
    cameraVolumes.push({center:[x,crownY,z],radii:[width,depth,width]});
    cameraVolumes.push({center:[x,crownY/2,z],radii:[.32*trunkWidth,crownY*.58,.32*trunkWidth]});
    return true;
  }
  if(real){
    // Round-robin quotas keep distant woods from consuming the verge budget.
    for(let round=0;round<12&&trees.length<style.treeLimit;round++){
      for(const grove of groves){
        if(!grove.count)continue;
        for(let attempt=0;attempt<4;attempt++){
          if(plantTree(grove)){grove.count--;break;}
        }
        if(trees.length===style.treeLimit)break;
      }
    }
  }else for(let i=0;i<limit*9&&trees.length<limit;i++){
    plantTree(groves.length&&rand()<.84?groves[Math.floor(rand()*groves.length)]:null);
  }
  // Plant short groups on footpath edges, staggered with gaps between patches.
  let details=0;
  for(const segment of segments){
    if(segment.edge>1.65||details>=style.detailLimit*.36)continue;
    if(real&&segment.length<3)continue;
    const {a,b,length,edge}=segment, dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
    for(let along=2+rand()*3;along<length-1 && details<style.detailLimit*.36;along+=3.5+rand()*8){
      const side=rand()<.5?-1:1;
      for(let i=0;i<4;i++){
        const distance=along+rand()*1.1, lateral=(edge+.8+rand()*1.15)*side;
        const point=[a[0]+dx*distance-dz*lateral,a[1]+dz*distance+dx*lateral];
        if(!clear(point,.2)||(real&&!zone(point)))continue;
        const size=.18+rand()*.19;
        add('grass',point[0],.008,point[1],size*1.3,size,size*1.3,i===0?0xb8a568:0x77954c);
        if(real&&i<2&&rand()<.23){
          add('flower',point[0],size*.83,point[1],.081,1,.081,rand()<.5?0xe9cb76:0xe7e3c8);
        }
        details++;
      }
    }
  }
  // Fill gaps with independent grove and verge samples.
  for(let i=0;segments.length && i<style.detailLimit*4 && details<style.detailLimit;i++){
    const kind=rand(),size=kind<.33?.6+rand()*.53:.19+rand()*.21;
    const grove=groves.length&&rand()<.42?groves[Math.floor(rand()*groves.length)]:null;
    const point=grove?[grove.point[0]+(rand()-.5)*grove.radius,grove.point[1]+(rand()-.5)*grove.radius]:
      beside(segments[Math.floor(rand()*segments.length)],size+.45+rand()*2.6,rand);
    const type=real?zone(point):null;
    if(!clear(point,size*1.13)||(real&&(!type||(type==='open'&&kind<.33))))continue;
    const [x,z]=point;details++;
    if(kind<.33){
      add('shrub',x,size*.36,z,size,size*.52,size*.86,real?0x72894f:0x819864);
      add('shrub',x+size*.17,size*.40,z-size*.17,size*.74,size*.61,size*.69,real?0x8a9c57:0x96a961);
    }
    else if(kind<.93){
      const tint=rand()<.24?0xb8a568:0x77954c;
      add('grass',x,.008,z,size*.92,size*1.23,size*.92,tint);
    }
    else add('stone',x,size*.21,z,size*.78,size*.54,size,0xb1a58b);
  }
  // Material/geometry sharing is local to this region, so SceneManager owns disposal.
  geometry.shrub=geometry.stone;
  const detailBatches=[];
  let contacts;
  for(const [shape,entries] of groups){
    const contact=shape==='contact';
    const material=contact?new THREE.MeshBasicMaterial({map:contactTexture(),transparent:true,
      opacity:real?style.contactOpacity.high:.29,depthWrite:false}):
      new THREE.MeshLambertMaterial({flatShading:true,side:shape==='grass'?THREE.DoubleSide:THREE.FrontSide});
    const batch=new THREE.InstancedMesh(geometry[shape],material,entries.length);
    batch.name='park:'+shape;
    entries.forEach(({matrix,color},i)=>{batch.setMatrixAt(i,matrix);batch.setColorAt(i,color);});
    batch.computeBoundingSphere();
    scene.add(batch);
    if(contact)contacts=batch;
    if(['shrub','grass','stone','flower'].includes(shape))detailBatches.push({batch,entries});
  }
  for(const item of new Set(Object.values(geometry))){
    if(![...groups.keys()].some(shape=>geometry[shape]===item))item.dispose();
  }
  let profile='high',focusX=null,focusZ=null,dirty=true;
  function updateDetails(x=null,z=null){
    if(!dirty&&x===focusX&&z===focusZ)return;
    if(!dirty&&x!==null&&focusX!==null&&Math.hypot(x-focusX,z-focusZ)<5)return;
    dirty=false;focusX=x;focusZ=z;
    const radius=real&&x!==null?realParkDetailRadius[profile]:Infinity;
    const quality=qualityProfiles[profile];
    for(const {batch,entries} of detailBatches){
      const budget=Math.ceil(entries.length*quality.details);
      let count=0;
      for(let i=0;i<budget;i++){
        const item=entries[Math.floor(i*entries.length/budget)];
        if(x!==null&&Math.hypot(item.x-x,item.z-z)>radius)continue;
        batch.setMatrixAt(count,item.matrix);batch.setColorAt(count,item.color);count++;
      }
      batch.count=count;
      batch.instanceMatrix.needsUpdate=true;batch.instanceColor.needsUpdate=true;
    }
  }
  function vegetationMetrics(){
    const count=(shape)=>groups.get(shape)?.length??0;
    const grid=(shape)=>{
      const rows=Array.from({length:4},()=>Array(4).fill(0));
      for(const {x,z} of groups.get(shape)??[]){
        const row=Math.floor((z-minZ)/(maxZ-minZ)*4),col=Math.floor((x-minX)/(maxX-minX)*4);
        rows[row][col]++;
      }
      return rows;
    };
    const detailsEnabled=Object.fromEntries(detailBatches.map(({batch})=>[batch.name.slice(5),batch.count]));
    return {procedural:true,placed:{trees:count('trunk'),shrubInstances:count('shrub'),grass:count('grass'),flowers:count('flower')},
      detailInstancesEnabled:detailsEnabled,grid:{bounds,order:'Norte a sul nas linhas, oeste a leste nas colunas.',
        treeCounts:grid('trunk'),shrubInstanceCounts:grid('shrub')}};
  }
  return {trees:trees.length,cameraVolumes,vegetationMetrics:real?vegetationMetrics:undefined,
    setDetailFocus:real?updateDetails:undefined,setQuality(next){
    profile=Object.hasOwn(qualityProfiles,next)?next:'balanced';
    if(contacts){
      contacts.visible=qualityProfiles[profile].contact;
      if(real)contacts.material.opacity=style.contactOpacity[profile];
    }
    if(real){dirty=true;updateDetails(focusX,focusZ);}
    else for(const {batch,entries} of detailBatches)batch.count=Math.ceil(entries.length*qualityProfiles[profile].details);
  }};
}
