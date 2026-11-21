import * as THREE from 'three';
import {nearSegment,pointInPolygon,seeded} from './geo.js';
import {contactTexture} from './park-surfaces.js';
import {realParkStyle,realParkDetailRadius,pathWidth,realPathAppearance,qualityProfiles} from './visual-settings.js';

import {grovePosition,parkEnvironment} from './park-environment.js';
import {sakuraWoodGeometry,sakuraCrownGeometry} from './sakura-geometry.js';

// One entry per existing species, retaining its seeded placement.
const springFoliage=[0x86a960,0x5b7b58,0xb2b969,0x668356,0xaab477,0x769b5c];

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

function broadCrown(phase,habit=null){
  const geometry=new THREE.DodecahedronGeometry(1);
  const positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const radius=.98+.10*Math.sin(x*5+z*3-y*4+phase);
    const contour=habit==='oak'?.10*Math.cos(5*Math.atan2(z,x)+.6)*Math.max(0,1-y*y):
      habit==='maple'?.065*Math.sin(y*6+z*3):0;
    positions.setXYZ(i,x*(radius+contour)+.13*y,y*(.98+.08*Math.sin(z*6+phase)),z*(radius+contour));
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function plantPark(scene,world,portals,blocked,clearings=[],environment=parkEnvironment(world)){
  const real=world.mode==='osm',{style,grove:sakuraGrove}=environment;
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
  const spring=Boolean(sakuraGrove);
  const geometry={
    trunk:new THREE.CylinderGeometry(.19,.31,1,5),
    round:real?broadCrown(1.5,spring?'maple':null):new THREE.IcosahedronGeometry(1,1),
    spire:new THREE.CylinderGeometry(real?.28:.14,1,2,7),
    column:new THREE.IcosahedronGeometry(1,real?0:1),
    spread:real?broadCrown(4,spring?'oak':null):new THREE.DodecahedronGeometry(1),
    grass:grassTuft(),
    ...(real?{flower:new THREE.CircleGeometry(1,5).rotateX(-Math.PI/2)}:{}),
    stone:new THREE.IcosahedronGeometry(1),
    contact:new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2),
    ...(spring?{
      sakuraWood:sakuraWoodGeometry(),sakuraPale:sakuraCrownGeometry(0),sakuraRose:sakuraCrownGeometry(1),
      petal:new THREE.CircleGeometry(1,4).rotateX(-Math.PI/2),
    }:{}),
  };
  const groups=new Map(), dummy=new THREE.Object3D(), color=new THREE.Color();
  function add(shape,x,y,z,sx,sy,sz,tint,treeId,rotation){
    const entries=groups.get(shape)||[];
    if(!groups.has(shape))groups.set(shape,entries);
    dummy.position.set(x,y+(world.terrain?.at(x,z)??0),z);dummy.scale.set(sx,sy,sz);dummy.rotation.y=rotation??rand()*Math.PI*2;dummy.updateMatrix();
    entries.push({x,z,treeId,matrix:dummy.matrix.clone(),color:color.set(tint).multiplyScalar(.86+rand()*.24).clone()});
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
    const tree=style.trees[species], foliage=spring?(springFoliage[species]??tree.leaf):tree.leaf, scale=real?.66+rand()*.58:.7+rand()*.44;
    const width=tree.width*scale,height=tree.height*scale,depth=tree.depth*scale;
    const type=real?zone(point):null;
    const spacing=real&&type!=='wood'?style.treeSpacing+.35:style.treeSpacing;
    if(real&&(!type||type==='open'))return false;
    if(world.entranceEnabled&&Math.hypot(point[0]+19,point[1]+111)<35)return false;
    if(!clear(point,width*1.25)||trees.some(([x,z])=>Math.hypot(x-point[0],z-point[1])<spacing))return false;
    const [x,z]=point,treeId=`tree:${trees.length}`;trees.push(point);
    const crownY=height-depth*.65;
    const trunkWidth=real?scale*(.77+width*.18):scale;
    add('trunk',x,crownY*.5,z,trunkWidth,crownY,trunkWidth,spring&&tree.shape==='spread'?0x5d5146:0x826249,treeId);
    add(tree.shape,x,crownY,z,width,depth,width*.9,foliage,treeId);
    if(tree.shape==='spread'||tree.shape==='round'){
      const angle=real?rand()*Math.PI*2:0;
      const cx=x+width*(real?.52*Math.cos(angle):.53),cz=z+width*(real?.52*Math.sin(angle):.2);
      add(tree.shape,cx,crownY-depth*.29,cz,width*.72,depth*.71,width*.72,foliage,treeId);
      cameraVolumes.push({id:treeId,kind:'tree',center:[cx,crownY-depth*.29,cz],radii:[width*.74,depth*.75,width*.74]});
    }
    if(tree.shape==='spire'){
      add('spire',x,crownY+depth*.65,z,width*.68,depth*.62,width*.66,foliage,treeId);
      cameraVolumes.push({id:treeId,kind:'tree',center:[x,crownY+depth*.65,z],radii:[width*.68,depth*.62,width*.66]});
    }
    add('contact',x+(real?1.05:.4),.009,z+(real?.86:.24),width*(real?1.8:1.22),1,width*(real?1.32:.86),real?0x46583e:0x596d4a);
    cameraVolumes.push({id:treeId,kind:'tree',center:[x,crownY,z],radii:[width,depth,width]});
    cameraVolumes.push({id:treeId,kind:'tree',center:[x,crownY/2,z],radii:[.32*trunkWidth,crownY*.58,.32*trunkWidth]});
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
        add('grass',point[0],.008,point[1],size*1.3,size,size*1.3,i===0?(spring?0xa6b574:0xb8a568):(spring?0x87a25f:0x77954c));
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
      add('shrub',x,size*.36,z,size,size*.52,size*.86,spring?0x647e4c:real?0x72894f:0x819864);
      add('shrub',x+size*.17,size*.40,z-size*.17,size*.74,size*.61,size*.69,spring?0x8ca365:real?0x8a9c57:0x96a961);
    }
    else if(kind<.93){
      const tint=rand()<.24?(spring?0xa6b574:0xb8a568):(spring?0x87a25f:0x77954c);
      add('grass',x,.008,z,size*.92,size*1.23,size*.92,tint);
    }
    else add('stone',x,size*.21,z,size*.78,size*.54,size,0xb1a58b);
  }
  const blossomPositions=[],seasonalTreePlacements=[],seasonalTreeIds=new Set();
  const center=sakuraGrove?grovePosition(world,sakuraGrove):null;
  if(center){
    const blossomRandom=seeded(1998);
    for(const [dx,dz,scale] of sakuraGrove.trees){
      const x=center[0]+dx,z=center[1]+dz;
      if(!clear([x,z],3.35*scale)||trees.some(([a,b])=>Math.hypot(x-a,z-b)<3.1))continue;
      const id=`sakura:${seasonalTreePlacements.length}`,rotation=blossomRandom()*Math.PI*2;
      const variant=seasonalTreePlacements.length%2;
      trees.push([x,z]);
      blossomPositions.push([x,z]);
      seasonalTreeIds.add(id);
      seasonalTreePlacements.push({id,x,z,scale,yaw:rotation,variant});
      add('sakuraWood',x,0,z,scale,scale,scale,0x776262,id,rotation);
      add(blossomPositions.length%3?'sakuraPale':'sakuraRose',x,0,z,scale,scale,scale,0xffffff,id,rotation);
      add('contact',x+.6,.009,z+.45,3.4*scale,1,2.5*scale,0x655749,id);
      cameraVolumes.push(
        {id,kind:'tree',center:[x,1.5*scale,z],radii:[.41*scale,1.6*scale,.41*scale]},
        {id,kind:'tree',center:[x,4.1*scale,z],radii:[3.25*scale,1.68*scale,2.84*scale]},
      );
      for(let i=0;i<38;i++){
        const angle=blossomRandom()*Math.PI*2,spread=Math.sqrt(blossomRandom())*5.2*scale;
        const px=x+Math.cos(angle)*spread,pz=z+Math.sin(angle)*spread;
        if(!clear([px,pz],.055))continue;
        const size=.04+blossomRandom()*.075;
        add('petal',px,.015,pz,size*1.55,1,size,i%3?0xf1cbc6:0xfff3dd,id);
      }
    }
  }
  // Material/geometry sharing is local to this region, so SceneManager owns disposal.
  geometry.shrub=geometry.stone;
  if(spring){
    geometry.shrub=geometry.stone.clone();
    const vertices=geometry.shrub.getAttribute('position');
    for(let i=0;i<vertices.count;i++){
      const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
      vertices.setXYZ(i,x+.19*y,y*(.9+.13*x),z*(1+.19*y));
    }
    geometry.shrub.computeVertexNormals();
  }
  const detailBatches=[];
  let contacts;
  const treeInstances=new Map();
  // Keep the instance transform invertible for the lighting shader.
  const invisibleMatrix=new THREE.Matrix4().makeScale(.0001,.0001,.0001).setPosition(0,-10,0);
  let hiddenTrees=new Set(),seasonalFallbackVisible=true;
  function setCameraOccluders(ids){
    const previous=hiddenTrees;
    hiddenTrees=new Set(ids);
    for(const id of previous)if(!hiddenTrees.has(id))updateTree(id);
    for(const id of hiddenTrees)if(!previous.has(id))updateTree(id);
  }
  function updateTree(id){
    const visible=!hiddenTrees.has(id)&&(!seasonalTreeIds.has(id)||seasonalFallbackVisible);
    for(const {batch,index,matrix} of treeInstances.get(id)??[]){
      batch.setMatrixAt(index,visible?matrix:invisibleMatrix);
      batch.instanceMatrix.addUpdateRange(index*16,16);
      batch.instanceMatrix.needsUpdate=true;
    }
  }
  function setSeasonalFallbackVisible(visible){
    visible=Boolean(visible);
    if(visible===seasonalFallbackVisible)return;
    seasonalFallbackVisible=visible;
    for(const id of seasonalTreeIds)updateTree(id);
  }
  for(const [shape,entries] of groups){
    const contact=shape==='contact',blossom=shape==='sakuraPale'||shape==='sakuraRose';
    const material=contact?new THREE.MeshBasicMaterial({map:contactTexture(),transparent:true,
      opacity:real?style.contactOpacity.high:.29,depthWrite:false}):
      new THREE.MeshLambertMaterial({vertexColors:blossom,...(blossom?{emissive:0xb8849b,emissiveIntensity:.22}:{}),flatShading:true,side:shape==='grass'?THREE.DoubleSide:THREE.FrontSide});
    const batch=new THREE.InstancedMesh(geometry[shape],material,entries.length);
    batch.name='park:'+shape;
    entries.forEach(({matrix,color,treeId},i)=>{
      batch.setMatrixAt(i,matrix);batch.setColorAt(i,color);
      if(!treeId)return;
      if(!treeInstances.has(treeId))treeInstances.set(treeId,[]);
      treeInstances.get(treeId).push({batch,index:i,matrix});
    });
    batch.computeBoundingSphere();
    scene.add(batch);
    if(contact)contacts=batch;
    if(['shrub','grass','stone','flower','petal'].includes(shape))detailBatches.push({batch,entries});
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
    const grid=(...shapes)=>{
      const rows=Array.from({length:4},()=>Array(4).fill(0));
      for(const {x,z} of shapes.flatMap(shape=>groups.get(shape)??[])){
        const row=Math.floor((z-minZ)/(maxZ-minZ)*4),col=Math.floor((x-minX)/(maxX-minX)*4);
        rows[row][col]++;
      }
      return rows;
    };
    const detailsEnabled=Object.fromEntries(detailBatches.map(({batch})=>[batch.name.slice(5),batch.count]));
    return {procedural:true,environment:environment.id,
      seasonal:sakuraGrove?{id:sakuraGrove.id,position:center,treePositions:blossomPositions,petals:count('petal')}:null,
      placed:{trees:trees.length,shrubInstances:count('shrub'),grass:count('grass'),flowers:count('flower')},
      detailInstancesEnabled:detailsEnabled,grid:{bounds,order:'Norte a sul nas linhas, oeste a leste nas colunas.',
        treeCounts:grid('trunk','sakuraWood'),shrubInstanceCounts:grid('shrub')}};
  }
  if(world.terrain)for(const {center} of cameraVolumes)center[1]+=world.terrain.at(center[0],center[2]);
  return {trees:trees.length,cameraVolumes,setCameraOccluders,seasonalTreePlacements,
    setSeasonalFallbackVisible,vegetationMetrics:real?vegetationMetrics:undefined,
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
