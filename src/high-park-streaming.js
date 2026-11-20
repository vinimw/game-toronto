import {assetUrl} from './asset-url.js';
import * as THREE from 'three';
import {terrainSectors} from './high-park-terrain.js';
import {terrainBuildingBatches} from './terrain-buildings.js';
import {entranceArtBounds,entranceGate,installEntranceArt} from './north-entrance-art.js';
import {collectResources,disposeScene} from './scene-resources.js';
import {entranceDependencies} from './north-entrance-asset-manifest.js';
import {resolveMemoryPoints} from './memories.js';
import {createWalkTest} from './movement.js';
import {cherryHill} from './cherry-hill-manifest.js';
import {buildCherryArt,cherryPlacements} from './cherry-hill-art.js';
import {WorldStreaming} from './world-streaming.js';

const pilot=[-225,-201,225,170];
const intersects=([ax,az,bx,bz],[cx,cz,dx,dz])=>ax<dx&&bx>cx&&az<dz&&bz>cz;
const includes=([x,z],[a,b,c,d])=>x>=a&&z>=b&&x<c&&z<d;

function estimatedGeometry(root){
  const buffers=new Set();
  for(const resource of collectResources(root)){
    if(resource.isBufferGeometry){
      for(const attr of [...Object.values(resource.attributes),resource.index])if(attr)buffers.add((attr.data??attr).array.buffer);
    }
    if(resource.isInstancedMesh)buffers.add(resource.instanceMatrix.array.buffer);
  }
  return [...buffers].reduce((sum,buffer)=>sum+buffer.byteLength,0);
}

function estimatedTextures(root,sun){
  const maps=[...collectResources(root)].filter(resource=>resource.isTexture);
  const textureBytes=maps.reduce((sum,{image,generateMipmaps})=>
    sum+(image?.width??0)*(image?.height??0)*4*(generateMipmaps?4/3:1),0);
  const shadow=sun.shadow.map;
  return Math.round(textureBytes+(shadow?shadow.width*shadow.height*8:0));
}

export function highParkStreaming(scene,world,sun,style,paths,activateEntrance,buildBuilding){
  const sectors=terrainSectors(world.terrain).filter(sector=>intersects(sector.bounds,pilot));
  const buildings=new Map(sectors.map(sector=>[sector.id,[]]));
  const manifests=sectors.map(sector=>({
    id:sector.id,bounds:sector.bounds,loadRadius:140,keepRadius:228,lane:'geometry',lods:['context'],
    assets:{source:'OSM buildings',shared:[],featureCount:0},
    hasDetail:()=>buildings.get(sector.id).length>0,
    async load(signal,frame){
      const group=new THREE.Group(),batch=terrainBuildingBatches(group);
      group.name=sector.id;
      let buildMs=0;
      try{
        const features=buildings.get(sector.id);
        for(let i=0;i<features.length;){
          const start=performance.now();
          do{
            const data=features[i++];
            batch.add(buildBuilding(...data),data[0].points[0]);
          }while(i<features.length&&performance.now()-start<3);
          buildMs+=performance.now()-start;
          if(i<features.length)await frame();
          signal.throwIfAborted();
        }
        const start=performance.now();
        batch.attach();
        return {mount:()=>scene.add(group),estimatedGeometryBytes:estimatedGeometry(group),
          buildMs:buildMs+performance.now()-start,dispose(){group.removeFromParent();disposeScene(group);}};
      }catch(error){batch.dispose();disposeScene(group);throw error;}
    },
  }));
  let assetStats=()=>null,entranceArt=null,gateLease,fallback,gateBounds,renderer,disposed=false;
  if(world.entranceEnabled){
    manifests.push({
      id:'high-park:north-entrance',bounds:entranceArtBounds,loadRadius:128,keepRadius:198,lane:'assets',bias:-180,
      lods:['high','balanced'],assets:{directory:assetUrl('assets/north-entrance/'),shared:entranceDependencies},
      async load(signal,frame){
        const module=await import('./environment-assets.js');
        assetStats=module.entranceAssetStats;
        signal.throwIfAborted();
        if(!gateLease){
          gateLease=module.acquireEntranceGate();
          gateLease.ready.then(model=>{
            if(disposed)return;
            fallback=entranceGate(world,model);
            gateBounds=new THREE.Box3().setFromObject(fallback);
            fallback.visible=!entranceArt;
            scene.add(fallback);
          }).catch(()=>{gateLease?.release();gateLease=null;});
        }
        const requestStart=performance.now();
        const assets=await module.loadEntranceAssets(signal);
        const decodeEnd=performance.now();
        let textureUploadMs=0;
        try{
          if(renderer){
            const textures=[...assets.shared].filter(asset=>asset.isTexture);
            for(let i=0;i<textures.length;i+=2){
              await frame();
              signal.throwIfAborted();
              const start=performance.now();
              for(const texture of textures.slice(i,i+2))renderer.initTexture(texture);
              textureUploadMs+=performance.now()-start;
            }
          }
          await frame();
          signal.throwIfAborted();
          const start=performance.now();
          const art=installEntranceArt(scene,{...world,pathStyle:style},sun,assets,paths);
          return {mount(){entranceArt=art;if(fallback)fallback.visible=false;activateEntrance(art);},estimatedGeometryBytes:estimatedGeometry(art.root),
            buildMs:performance.now()-start,textureUploadMs,assetPreparationMs:decodeEnd-requestStart,dispose(){entranceArt=null;if(fallback)fallback.visible=true;activateEntrance(null);art.dispose();assets.release();}};
        }catch(error){assets.release();throw error;}
      },
    });
  }
  const cherryEnabled=world.cherryEnabled!==false;
  const cherryLayers=new Map();
  const memoryAnchor=cherryEnabled?resolveMemoryPoints('high-park',world,
    createWalkTest(world.features,world.bbox),[cherryHill.memory])[0]?.position:null;
  let cherryStats=()=>null,trees,quality='high';
  const cherryLod=()=>cherryLayers.has(quality)?quality:cherryLayers.has('low')?'low':null;
  const showCherryLod=()=>{
    const selected=cherryLod();
    for(const [lod,art] of cherryLayers)art.root.visible=lod===selected;
  };
  if(cherryEnabled)for(const lod of cherryHill.lods){
    const dependencies=cherryHill.models.map(model=>model+'-'+lod+'.glb');
    manifests.push({
      id:cherryHill.id+':'+lod,bounds:cherryHill.bounds,
      loadRadius:lod==='low'?108:63,keepRadius:lod==='low'?190:125,
      lane:lod==='low'?'cherry-low':'cherry-detail',bias:-90,lods:[lod],
      assets:{directory:assetUrl('assets/north-entrance/'),shared:dependencies},
      hasDetail:()=>lod==='low'||lod===quality,
      async load(signal,frame){
        const module=await import('./environment-assets.js');
        cherryStats=module.cherryAssetStats;
        signal.throwIfAborted();
        const leases=dependencies.map(key=>module.acquireEnvironmentAsset(key));
        const release=()=>{for(const lease of leases)lease.release();};
        signal.addEventListener('abort',release,{once:true});
        try{
          const requestStart=performance.now();
          const models=await Promise.all(leases.map(lease=>lease.ready));
          const assetPreparationMs=performance.now()-requestStart;
          await frame();
          signal.throwIfAborted();
          const start=performance.now();
          trees??=cherryPlacements(world);
          const art=buildCherryArt(world,trees,models,lod);
          return {
            mount(){cherryLayers.set(lod,art);scene.add(art.root);showCherryLod();},
            buildMs:performance.now()-start,assetPreparationMs,
            estimatedGeometryBytes:estimatedGeometry(art.root),
            dispose(){cherryLayers.delete(lod);art.dispose();showCherryLod();release();},
          };
        }catch(error){release();throw error;}
        finally{signal.removeEventListener('abort',release);}
      },
    });
  }
  const stream=new WorldStreaming(manifests);
  return {
    add(...data){
      const sector=sectors.find(item=>includes(data[0].points[0],item.bounds));
      // The arrival block is structural context, present before the first frame.
      if(!sector||sector.id==='high-park:4:0')return false;
      buildings.get(sector.id).push(data);
      manifests.find(item=>item.id===sector.id).assets.featureCount++;
      return true;
    },
    update:(position,velocity,look,view)=>{renderer=view.renderer;stream.update(position,velocity,look,view);},
    landmarkBounds:()=>gateBounds,
    landmarkState:()=>entranceArt?'detailed':fallback?'structure':'pending',
    setQuality(next){
      if(next===quality)return;
      quality=next;
      for(const sector of stream.sectors)
        if(sector.id.startsWith(cherryHill.id+':')&&!sector.hasDetail())stream.evict(sector);
      showCherryLod();
    },
    prime:({cherry=false}={})=>stream.prime(sector=>cherry===sector.id.startsWith(cherryHill.id+':')),
    dispose(){disposed=true;stream.dispose();fallback?.removeFromParent();gateLease?.release();},
    stats:()=>{
      const sectors=stream.stats();
      return {cherryHill:{futureMemoryPosition:memoryAnchor,lod:cherryLod(),trees:trees?.length??0,assets:cherryStats(),
        estimatedTextureBytes:cherryLod()?estimatedTextures(cherryLayers.get(cherryLod()).root,{shadow:{}}):0},
        landmarkState:entranceArt?'detailed':fallback?'structure':'pending',sectors,assets:assetStats(),
        firstPresentationCount:sectors.reduce((total,s)=>total+s.firstPresentationCount,0),
        lateActivationCount:sectors.reduce((total,s)=>total+s.lateActivationCount,0),
        visiblePopInCount:sectors.reduce((total,s)=>total+s.visiblePopInCount,0),
        estimatedTextureAndShadowBytes:entranceArt?estimatedTextures(entranceArt.root,sun):0};
    },
  };
}
