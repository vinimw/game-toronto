import * as THREE from 'three';
import {nearSegment,pointInPolygon,seeded} from './geo.js';
import {contactTexture} from './park-surfaces.js';
import {parkStyle as style,pathWidth,qualityProfiles} from './visual-settings.js';

function pathSegments(features){
  const segments=[];
  for(const feature of features){
    if(feature.kind!=='path'&&feature.kind!=='rail')continue;
    for(let i=1;i<feature.points.length;i++){
      const a=feature.points[i-1],b=feature.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(length>.05)segments.push({a,b,length,edge:pathWidth(feature)/2});
    }
  }
  return segments;
}

function beside({a,b,length,edge},extra,rand){
  const t=rand(), offset=(edge+extra)*(rand()<.5?-1:1);
  return [a[0]+(b[0]-a[0])*t-(b[1]-a[1])*offset/length,
    a[1]+(b[1]-a[1])*t+(b[0]-a[0])*offset/length];
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

export function plantPark(scene,world,portals,blocked,clearings=[]){
  const rand=seeded(99471), segments=pathSegments(world.features);
  const greens=world.features.filter(f=>f.kind==='green');
  const landmarks=[...portals.map(p=>p.position),world.memory].filter(Boolean);
  const [minX,minZ,maxX,maxZ]=world.bbox || [-220,-220,220,220];
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
    round:new THREE.IcosahedronGeometry(1,1),
    spire:new THREE.CylinderGeometry(.14,1,2,7),
    column:new THREE.IcosahedronGeometry(1,1),
    spread:new THREE.DodecahedronGeometry(1),
    grass:grassTuft(),
    stone:new THREE.IcosahedronGeometry(1),
    contact:new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2),
  };
  const groups=new Map(), dummy=new THREE.Object3D(), color=new THREE.Color();
  function add(shape,x,y,z,sx,sy,sz,tint){
    const entries=groups.get(shape)||[];
    if(!groups.has(shape))groups.set(shape,entries);
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.y=rand()*Math.PI*2;dummy.updateMatrix();
    entries.push({matrix:dummy.matrix.clone(),color:color.set(tint).multiplyScalar(.86+rand()*.24).clone()});
  }
  const trees=[], cameraVolumes=[];
  const limit=Math.min(style.treeLimit,Math.ceil((maxX-minX)*(maxZ-minZ)/460));
  // Groves have variable radii and a dominant species. Mixing between groves
  // leaves open lawns and isolated trees without a regular planting grid.
  const groves=[];
  for(let i=0;i<Math.ceil(limit/9);i++){
    const point=segments.length&&i%3===0?beside(segments[i%segments.length],6+rand()*12,rand):
      [minX+rand()*(maxX-minX),minZ+rand()*(maxZ-minZ)];
    if(i%3!==0 && !greens.some(f=>pointInPolygon(point,f.points)))continue;
    groves.push({point,radius:style.clusterRadius*(.5+rand()),species:Math.floor(rand()*style.trees.length)});
  }
  for(let i=0;i<limit*9 && trees.length<limit;i++){
    const grove=groves.length&&rand()<.84?groves[Math.floor(rand()*groves.length)]:null;
    const angle=rand()*Math.PI*2, radius=grove?Math.sqrt(rand())*grove.radius:0;
    const point=grove?[grove.point[0]+Math.cos(angle)*radius,grove.point[1]+Math.sin(angle)*radius]:
      segments.length?beside(segments[Math.floor(rand()*segments.length)],4+rand()*14,rand):
      [minX+rand()*(maxX-minX),minZ+rand()*(maxZ-minZ)];
    if(!grove&&!segments.length&&!greens.some(f=>pointInPolygon(point,f.points)))continue;
    const species=grove&&rand()<.68?grove.species:Math.floor(rand()*style.trees.length);
    const tree=style.trees[species], scale=.7+rand()*.44;
    const width=tree.width*scale,height=tree.height*scale,depth=tree.depth*scale;
    if(!clear(point,width*1.25)||trees.some(([x,z])=>Math.hypot(x-point[0],z-point[1])<style.treeSpacing))continue;
    const [x,z]=point;trees.push(point);
    const crownY=height-depth*.65;
    add('trunk',x,crownY*.5,z,scale,crownY,scale,0x826249);
    add(tree.shape,x,crownY,z,width,depth,width*.9,tree.leaf);
    if(tree.shape==='spread'||tree.shape==='round'){
      add(tree.shape,x+width*.53,crownY-depth*.29,z+width*.2,width*.72,depth*.71,width*.72,tree.leaf);
      cameraVolumes.push({center:[x+width*.53,crownY-depth*.29,z+width*.2],radii:[width*.74,depth*.75,width*.74]});
    }
    if(tree.shape==='spire'){
      add('spire',x,crownY+depth*.65,z,width*.68,depth*.62,width*.66,tree.leaf);
      cameraVolumes.push({center:[x,crownY+depth*.65,z],radii:[width*.68,depth*.62,width*.66]});
    }
    add('contact',x+.4,.009,z+.24,width*1.22,1,width*.86,0x596d4a);
    cameraVolumes.push({center:[x,crownY,z],radii:[width,depth,width]});
    cameraVolumes.push({center:[x,crownY/2,z],radii:[.32*scale,crownY*.58,.32*scale]});
  }
  // Plant short groups on footpath edges, staggered with gaps between patches.
  let details=0;
  for(const segment of segments){
    if(segment.edge>1.65||details>=style.detailLimit*.36)continue;
    const {a,b,length,edge}=segment, dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
    for(let along=2+rand()*3;along<length-1 && details<style.detailLimit*.36;along+=3.5+rand()*8){
      const side=rand()<.5?-1:1;
      for(let i=0;i<4;i++){
        const distance=along+rand()*1.1, lateral=(edge+.8+rand()*1.15)*side;
        const point=[a[0]+dx*distance-dz*lateral,a[1]+dz*distance+dx*lateral];
        if(!clear(point,.2))continue;
        const size=.18+rand()*.19;
        add('grass',point[0],.008,point[1],size*1.3,size,size*1.3,i===0?0xb8a568:0x77954c);
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
    if(!clear(point,size*1.13))continue;
    const [x,z]=point;details++;
    if(kind<.33){
      add('shrub',x,size*.36,z,size,size*.52,size*.86,0x819864);
      add('shrub',x+size*.17,size*.40,z-size*.17,size*.74,size*.61,size*.69,0x96a961);
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
    const material=contact?new THREE.MeshBasicMaterial({map:contactTexture(),transparent:true,opacity:.29,depthWrite:false}):
      new THREE.MeshLambertMaterial({flatShading:true,side:shape==='grass'?THREE.DoubleSide:THREE.FrontSide});
    const batch=new THREE.InstancedMesh(geometry[shape],material,entries.length);
    batch.name='park:'+shape;
    entries.forEach(({matrix,color},i)=>{batch.setMatrixAt(i,matrix);batch.setColorAt(i,color);});
    batch.computeBoundingSphere();
    scene.add(batch);
    if(contact)contacts=batch;
    if(['shrub','grass','stone'].includes(shape))detailBatches.push([batch,entries.length]);
  }
  for(const item of new Set(Object.values(geometry))){
    if(![...groups.keys()].some(shape=>geometry[shape]===item))item.dispose();
  }
  return {trees:trees.length,cameraVolumes,setQuality(profile){
    const quality=qualityProfiles[profile]||qualityProfiles.balanced;
    if(contacts)contacts.visible=quality.contact;
    for(const [batch,count] of detailBatches)batch.count=Math.ceil(count*quality.details);
  }};
}
