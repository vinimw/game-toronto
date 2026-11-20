import {assetUrl} from './asset-url.js';
import * as THREE from 'three';
import {terrainSectors} from './high-park-terrain.js';
import {terrainBuildingBatches} from './terrain-buildings.js';
import {entranceArtBounds,entranceGate,installEntranceArt} from './north-entrance-art.js';
import {collectResources,disposeScene} from './scene-resources.js';
import {entranceDependencies} from './north-entrance-asset-manifest.js';
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
    prime:()=>stream.prime(),
    dispose(){disposed=true;stream.dispose();fallback?.removeFromParent();gateLease?.release();},
    stats:()=>{
      const sectors=stream.stats();
      return {landmarkState:entranceArt?'detailed':fallback?'structure':'pending',sectors,assets:assetStats(),
        lateActivationCount:sectors.reduce((total,s)=>total+s.lateActivationCount,0),
        visiblePopInCount:sectors.reduce((total,s)=>total+s.visiblePopInCount,0),
        estimatedTextureAndShadowBytes:entranceArt?estimatedTextures(entranceArt.root,sun):0};
    },
  };
}
