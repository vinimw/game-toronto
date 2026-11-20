import * as THREE from 'three';
import {latLonToLocal} from './geo.js';
import {densify} from './high-park-terrain.js';
import {realPathAppearance} from './visual-settings.js';

// Site anchor estimated from the municipal photograph and Colborne Lodge Dr.
// The six primary trees correspond to mapped OSM points; species are art choices.
const gateAnchor={lat:43.65341778,lon:-79.46520858};
const trees=[
  [14007226918,-32.91,-95.30,'oak-31',1.33,.3],
  [14007226919,-41.83,-104.77,'maple-43',1.30,1.8],
  [14007226920,-43.50,-110.70,'oak-67',1.34,3],
  [14007226921,-31.93,-102.86,'maple-79',1.29,.5],
  [14007226922,-26.55,-101.01,'maple-43',1.24,2.1],
  [14007226923,-23.01,-99.09,'oak-31',1.26,1.4],
  [null,-5,-102,'maple-79',1.19,1.2],
  [null,5,-116,'oak-67',1.27,2.4],
  [null,1,-91,'oak-31',1.14,2.2],
  [null,-39,-124,'maple-79',.96,1.8],
  [null,-51,-111,'maple-43',1.19,3.4],
];
const area=[-65,-168,33,-68];
function weight(x,z){
  return THREE.MathUtils.smoothstep(Math.min(x-area[0],z-area[1],area[2]-x,area[3]-z),0,11);
}

export function installEntranceArt(scene,world,sun){
  const {models,surfaces}=world.entranceAssets;
  const terrain=world.terrain;
  const originalSky=scene.background,originalFog=scene.fog.clone();
  const sky=new THREE.Color(0xbccfdf);
  const root=new THREE.Group();root.name='north-entrance-art';scene.add(root);
  const materials=Object.fromEntries(Object.entries(surfaces).map(([key,maps])=>[key,
    new THREE.MeshStandardMaterial({...maps,color:key==='grass'?0xd6e3bb:0xcbd0cd,
      roughness:.94,metalness:0,side:THREE.DoubleSide,normalScale:new THREE.Vector2(.58,.58),aoMapIntensity:.62})]));
  const overlays={};
  function overlay(geometry,key){
    const position=geometry.attributes.position,index=geometry.index;
    const count=index?.count??position.count,vertices=[],colors=[],uv=[];
    const height=key==='grass'?.001:.045;
    for(let i=0;i<count;i+=3){
      const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
      const [a,b,c]=ids;
      if((position.getZ(b)-position.getZ(a))*(position.getX(c)-position.getX(a))<
         (position.getX(b)-position.getX(a))*(position.getZ(c)-position.getZ(a))) [ids[1],ids[2]]=[ids[2],ids[1]];
      const weights=ids.map(id=>weight(position.getX(id),position.getZ(id)));
      if(!weights.some(value=>value>0))continue;
      for(let j=0;j<3;j++){
        const id=ids[j],x=position.getX(id),z=position.getZ(id);
        vertices.push(x,position.getY(id)+height,z);
        const shade=key==='grass'?.88+.10*Math.cos(x*.52)*Math.sin(z*.55):1;
        colors.push(shade,shade,shade,weights[j]);
        uv.push(x/(key==='asphalt'?4:2.65),z/(key==='asphalt'?4:2.65));
      }
    }
    if(!vertices.length)return;
    if(!overlays[key]){
      const mat=materials[key].clone();
      mat.vertexColors=true;mat.transparent=true;mat.depthWrite=false;mat.polygonOffset=key!=='grass';
      mat.polygonOffsetFactor=-1;
      overlays[key]=mat;
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,overlays[key]);mesh.receiveShadow=true;mesh.renderOrder=key==='grass'?1:2;root.add(mesh);
  }
  for(const chunk of scene.children.filter(object=>object.name==='terrain-chunk'))overlay(chunk.geometry,'grass');
  const gatePosition=latLonToLocal(gateAnchor.lat,gateAnchor.lon,world.origin);
  const gate=models['north-gate'];
  gate.position.set(gatePosition[0],terrain.at(...gatePosition),gatePosition[1]);
  gate.rotation.y=.24;
  gate.traverse(mesh=>{
    if(!mesh.isMesh)return;
    if(mesh.material.name==='Masonry_PBR'){
      Object.assign(mesh.material,surfaces.masonry,{
        color:new THREE.Color(0xb3afa1),normalScale:new THREE.Vector2(.52,.52),aoMapIntensity:.7,
      });
      mesh.material.needsUpdate=true;
    }
    mesh.castShadow=true;mesh.receiveShadow=true;
  });
  root.add(gate);
  gate.updateMatrixWorld(true);

  // Block the four masonry pillars at their visual positions; the road and
  // pedestrian opening remain on the exact OSM geometry.
  const gateBlocks=[-10.13,-5.9,5.9,10.13].map((x,i)=>{
    const half=i===0||i===3?.42:.55;
    const points=[[-half,-half],[half,-half],[half,half],[-half,half]].map(([dx,dz])=>{
      const position=gate.localToWorld(new THREE.Vector3(x+dx,0,dz));
      return [position.x,position.z];
    });
    return {kind:'building',id:'north-gate-pier-'+i,points,
      minHeight:gate.position.y,height:gate.position.y+(half>.5?3.55:1.6)};
  });

  const instances=new Map(),batches=[],cameraVolumes=[];
  const leafMaps=new Map();
  const hidden=new Set(),zero=new THREE.Matrix4().makeScale(.0001,.0001,.0001).setPosition(0,-500,0);
  const items=trees.map(([osmId,x,z,variant,scale,yaw],index)=>({
    id:'north-tree:'+index,osmId,x,z,variant,scale,yaw,position:new THREE.Vector3(x,terrain.at(x,z),z),
  }));
  const dummy=new THREE.Object3D();
  for(const variant of new Set(items.map(item=>item.variant))){
    const selection=items.filter(item=>item.variant===variant);
    for(const lod of ['high','balanced']){
      const model=models[variant+'-'+lod];
      model.traverse(part=>{
        if(!part.isMesh)return;
        const foliage=part.material.name.startsWith('LeafCards');
        if(foliage){
          const key=variant.split('-')[0],texture=part.material.map;
          if(leafMaps.has(key)){texture.dispose();part.material.map=leafMaps.get(key);}
          else leafMaps.set(key,texture);
          part.material.alphaTest=.44;part.material.transparent=false;
          part.material.side=THREE.DoubleSide;part.material.depthWrite=true;
        }
        part.geometry.applyMatrix4(part.matrixWorld);
        const batch=new THREE.InstancedMesh(part.geometry,part.material,selection.length);
        batch.name=variant+'-'+lod+(foliage?':foliage':':bark');
        batch.castShadow=true;batch.receiveShadow=true;
        selection.forEach((tree,index)=>{
          dummy.position.copy(tree.position);dummy.scale.setScalar(tree.scale);dummy.rotation.y=tree.yaw;dummy.updateMatrix();
          const matrix=dummy.matrix.clone();
          batch.setMatrixAt(index,matrix);
          const entries=instances.get(tree.id)??[];
          entries.push({batch,index,matrix,lod,tree});
          instances.set(tree.id,entries);
        });
        batch.computeBoundingSphere();root.add(batch);batches.push(batch);
      });
    }
  }
  for(const tree of items){
    cameraVolumes.push({kind:'tree',id:tree.id,center:[tree.x,tree.position.y+2.7,tree.z],radii:[.61,2.75,.61]});
    cameraVolumes.push({kind:'tree',id:tree.id,center:[tree.x,tree.position.y+10.5,tree.z],radii:[5.8,4.6,5.8]});
  }
  let profile='high',lastFocus=null;
  function refresh(){
    const [x,z]=lastFocus??gatePosition;
    const visibleBatches=new Set();
    for(const entries of instances.values()){
      const {tree}=entries[0];
      const distance=Math.hypot(tree.x-x,tree.z-z);
      const high=profile==='high'&&distance<41;
      const visible=distance<(profile==='low'?105:165)&&!hidden.has(tree.id);
      for(const {batch,index,matrix,lod} of entries){
        const show=visible&&(high?lod==='high':lod==='balanced');
        if(show)visibleBatches.add(batch);
        batch.setMatrixAt(index,show?matrix:zero);
        batch.instanceMatrix.needsUpdate=true;
      }
    }
    for(const batch of batches)batch.visible=visibleBatches.has(batch);
    const near=Math.hypot(gatePosition[0]-x,gatePosition[1]-z)<80;
    sun.castShadow=profile!=='low'&&near;
    scene.background=near?sky:originalSky;
    scene.fog.color.copy(near?sky:originalFog.color);
    scene.fog.near=near?94:originalFog.near;
    scene.fog.far=near?310:originalFog.far;
  }
  function setDetailFocus(x,z){
    if(!Number.isFinite(x)||!Number.isFinite(z)){lastFocus=null;refresh();return;}
    if(lastFocus&&Math.hypot(lastFocus[0]-x,lastFocus[1]-z)<4)return;
    lastFocus=[x,z];refresh();
  }
  function setOccluders(ids){
    let changed=false;
    for(const id of instances.keys()){
      if(ids.has(id)===hidden.has(id))continue;
      if(ids.has(id))hidden.add(id);
      else hidden.delete(id);
      changed=true;
    }
    if(changed)refresh();
  }
  const road=world.features.find(feature=>feature.osmId===23661349);
  if(road){
    const center=densify(road.points).filter(([,z])=>z>-127&&z<-108);
    const [a,b]=[center[0],center.at(-1)];
    if(a&&b){
      const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      const half=realPathAppearance(road).width/2;
      for(const side of [-1,1]){
        const vertices=[],indices=[],uv=[];
        center.forEach(([x,z],i)=>{
          const ax=x+side*dz/length*half,az=z-side*dx/length*half;
          const bx=ax+side*dz/length*.16,bz=az-side*dx/length*.16;
          vertices.push(ax,terrain.at(ax,az)+.045,az,bx,terrain.at(bx,bz)+.16,bz);
          uv.push(i*.4,0,i*.4,.12);
          if(i){const n=i*2;indices.push(n-2,n,n-1,n-1,n,n+1);}
        });
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
        geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
        geometry.setIndex(indices);geometry.computeVertexNormals();
        const curb=new THREE.Mesh(geometry,materials.pavement);
        curb.material.side=THREE.DoubleSide;curb.receiveShadow=true;root.add(curb);
      }
    }
  }
  // Crosswalk symbols come from the mapped ladder crossing at the gateway.
  const stripes=world.features.find(f=>f.tags.footway==='crossing'&&f.points.some(([x,z])=>Math.hypot(x+18.03,z+124.2)<1));
  if(stripes){
    const [x,z]=[-18.03,-124.2];
    const material=new THREE.MeshStandardMaterial({color:0xe3e4d9,roughness:.94,polygonOffset:true,polygonOffsetFactor:-2});
    const collection=new THREE.InstancedMesh(new THREE.PlaneGeometry(.29,1.9).rotateX(-Math.PI/2),material,9);
    for(let i=0;i<9;i++){
      const dx=(i-4)*.57,px=x+dx,pz=z-dx*.26;
      dummy.position.set(px,terrain.at(px,pz)+.065,pz);dummy.rotation.y=.24;dummy.scale.setScalar(1);dummy.updateMatrix();
      collection.setMatrixAt(i,dummy.matrix);
    }
    collection.receiveShadow=true;root.add(collection);
  }

  sun.target.position.set(gatePosition[0],gate.position.y,gatePosition[1]);scene.add(sun.target);
  sun.position.set(gatePosition[0]-44,gate.position.y+63,gatePosition[1]-32);
  sun.shadow.camera.left=sun.shadow.camera.bottom=-33;
  sun.shadow.camera.right=sun.shadow.camera.top=33;
  sun.shadow.camera.near=15;sun.shadow.camera.far=140;
  sun.shadow.normalBias=.12;sun.shadow.bias=-.0002;
  const originalDispose=sun.shadow.dispose.bind(sun.shadow);
  root.addEventListener('removed',()=>originalDispose(),{once:true});
  return {
    gateBlocks,cameraVolumes,
    pathOverlay(geometry,color,style){
      const type=color===style.paved?'pavement':'asphalt';
      overlay(geometry,type);
    },
    setQuality(next){
      profile=next;
      const size=next==='high'?1536:1024;
      if(size!==sun.shadow.mapSize.x){
        sun.shadow.map?.dispose();sun.shadow.map=null;
        sun.shadow.mapSize.set(size,size);
      }
      refresh();
    },
    setDetailFocus,setOccluders,
    evidence:{gate:{geographic:gateAnchor,position:gatePosition,pillars:gateBlocks.length},
      matureTreePlacements:items.map(({osmId,x,z,variant})=>({osmId,local:[x,z],variant})),
      materials:Object.keys(materials),instancedBatches:batches.length},
  };
}
