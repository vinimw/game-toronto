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
import {parkEnvironment,grovePosition} from './park-environment.js';
import {buildPondShore,pondBounds,pondDetailId,pondId} from './grenadier-pond.js';
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

export function highParkStreaming(scene,world,sun,style,paths,activateEntrance,buildBuilding,options={}){
  const {
    getSeasonalTreePlacements=()=>[],
    setSeasonalFallbackVisible=()=>{},
    onSakuraArt=()=>{},
  }=options;
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
  const seasonalLayers=new Map();
  const memoryAnchor=cherryEnabled?resolveMemoryPoints('high-park',world,
    createWalkTest(world.features,world.bbox),[cherryHill.memory])[0]?.position:null;
  let cherryStats=()=>null,trees,quality='high';
  const cherryLod=()=>cherryLayers.has(quality)?quality:cherryLayers.has('low')?'low':null;
  let blend=0,lowCoverage=0,lastBlendTime;
  const updateCherryCoverage=(position,now)=>{
    const dt=lastBlendTime===undefined?0:Math.min(100,now-lastBlendTime);
    lastBlendTime=now;
    const [x,z]=position,[west,north,east,south]=cherryHill.bounds;
    const distance=Math.hypot(Math.max(west-x,0,x-east),Math.max(north-z,0,z-south));
    const target=Number(cherryLayers.has(quality)&&quality!=='low'&&distance<107);
    blend=THREE.MathUtils.clamp(blend+Math.sign(target-blend)*Math.min(Math.abs(target-blend),dt/460),0,1);
    const lowTarget=Number(cherryLayers.has('low')&&distance<160);
    lowCoverage+=Math.sign(lowTarget-lowCoverage)*Math.min(Math.abs(lowTarget-lowCoverage),dt/430);
    showCherryLod();
  };
  const showCherryLod=()=>{
    for(const [lod,art] of cherryLayers){
      const weight=lod==='low'?(1-blend)*lowCoverage:lod===quality?blend:0;
      art.root.visible=weight>0;
      art.setCoverage(weight);
    }
  };
  const seasonalGrove=parkEnvironment(world).grove;
  const seasonalCenter=seasonalGrove?grovePosition(world,seasonalGrove):null;
  const seasonalBounds=seasonalCenter?(()=>{
    const xs=seasonalGrove.trees.map(([dx])=>seasonalCenter[0]+dx),zs=seasonalGrove.trees.map(([,dz])=>seasonalCenter[1]+dz);
    return [Math.min(...xs)-8,Math.min(...zs)-8,Math.max(...xs)+8,Math.max(...zs)+8];
  })():null;
  let seasonalBlend=0,seasonalLowCoverage=0,lastSeasonalBlendTime;
  const seasonalEffectiveCoverage=()=>Math.max(seasonalBlend,seasonalLowCoverage*(1-seasonalBlend));
  const showSeasonalLod=()=>{
    if(!seasonalLayers.has(quality))seasonalBlend=0;
    if(!seasonalLayers.has('low'))seasonalLowCoverage=0;
    for(const [lod,art] of seasonalLayers){
      const weight=lod==='low'?(1-seasonalBlend)*seasonalLowCoverage:lod===quality?seasonalBlend:0;
      art.root.visible=weight>0;
      art.setCoverage(weight);
    }
    setSeasonalFallbackVisible(seasonalEffectiveCoverage()<.98);
  };
  const updateSeasonalCoverage=(position,now)=>{
    if(!seasonalBounds)return;
    const dt=lastSeasonalBlendTime===undefined?0:Math.min(100,now-lastSeasonalBlendTime);
    lastSeasonalBlendTime=now;
    const [x,z]=position,[west,north,east,south]=seasonalBounds;
    const distance=Math.hypot(Math.max(west-x,0,x-east),Math.max(north-z,0,z-south));
    const target=Number(seasonalLayers.has(quality)&&quality!=='low'&&distance<63);
    seasonalBlend=THREE.MathUtils.clamp(seasonalBlend+Math.sign(target-seasonalBlend)*Math.min(Math.abs(target-seasonalBlend),dt/460),0,1);
    const lowTarget=Number(seasonalLayers.has('low')&&distance<112);
    seasonalLowCoverage+=Math.sign(lowTarget-seasonalLowCoverage)*Math.min(Math.abs(lowTarget-seasonalLowCoverage),dt/430);
    showSeasonalLod();
  };
  if(cherryEnabled&&seasonalGrove&&seasonalBounds)for(const lod of cherryHill.lods){
    const dependencies=cherryHill.models.map(model=>model+'-'+lod+'.glb');
    manifests.push({
      id:seasonalGrove.id+':'+lod,bounds:seasonalBounds,
      loadRadius:lod==='low'?128:72,keepRadius:lod==='low'?176:128,
      lane:lod==='low'?'cherry-low':'cherry-detail',bias:-100,lods:[lod],continuousPresentation:true,
      assets:{directory:assetUrl('assets/north-entrance/'),shared:dependencies},
      hasDetail:()=>lod==='low'||lod===quality,
      async load(signal,frame){
        const module=await import('./environment-assets.js');
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
          const trees=getSeasonalTreePlacements();
          if(!trees.length)throw new Error('Nenhum plantio sazonal válido no grupo oeste.');
          const art=buildCherryArt(world,trees,models,lod,seasonalGrove.id);
          return {
            mount(){seasonalLayers.set(lod,art);scene.add(art.root);onSakuraArt(art,true);showSeasonalLod();},
            buildMs:performance.now()-start,assetPreparationMs,
            estimatedGeometryBytes:estimatedGeometry(art.root),
            dispose(){seasonalLayers.delete(lod);onSakuraArt(art,false);art.dispose();showSeasonalLod();release();},
          };
        }catch(error){release();throw error;}
        finally{signal.removeEventListener('abort',release);}
      },
    });
  }
  if(cherryEnabled)for(const lod of cherryHill.lods){
    const dependencies=cherryHill.models.map(model=>model+'-'+lod+'.glb');
    manifests.push({
      id:cherryHill.id+':'+lod,bounds:cherryHill.bounds,
      loadRadius:lod==='low'?128:78,keepRadius:lod==='low'?205:145,
      lane:lod==='low'?'cherry-low':'cherry-detail',bias:-90,lods:[lod],continuousPresentation:true,
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
  const pond=world.features.find(feature=>feature.osmId===pondId&&feature.kind==='water');
  let shore,shoreTick;
  if(pond)manifests.push({
    id:pondDetailId,bounds:pondBounds,loadRadius:110,keepRadius:225,lane:'geometry',
    lods:['high','balanced','low'],continuousPresentation:true,
    assets:{source:'Procedural, derived from OSM shoreline',shared:[]},
    async load(signal,frame){
      await frame();
      signal.throwIfAborted();
      const start=performance.now();
      const art=buildPondShore(world,pond,quality);
      return {mount(){shore=art;shoreTick=undefined;scene.add(art.root);},
        buildMs:performance.now()-start,estimatedGeometryBytes:estimatedGeometry(art.root),
        dispose(){shore=null;art.root.removeFromParent();disposeScene(art.root);}};
    },
  });
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
    update:(position,velocity,look,view)=>{
      renderer=view.renderer;
      stream.update(position,velocity,look,view);
      if(shore){
        const now=performance.now(),dt=Math.min(100,now-(shoreTick??now));
        shoreTick=now;
        const [x,z]=position,[west,north,east,south]=pondBounds;
        const near=Math.hypot(Math.max(west-x,0,x-east),Math.max(north-z,0,z-south));
        shore.coverage.value=THREE.MathUtils.clamp(shore.coverage.value+(near<150?1:-1)*dt/560,0,1);
        shore.root.visible=shore.coverage.value>0;
      }
      if(cherryEnabled){const now=performance.now();updateCherryCoverage(position,now);updateSeasonalCoverage(position,now);}
    },
    landmarkBounds:()=>gateBounds,
    landmarkState:()=>entranceArt?'detailed':fallback?'structure':'pending',
    setQuality(next){
      if(next===quality)return;
      quality=next;
      for(const sector of stream.sectors)
        if((sector.id.startsWith(cherryHill.id+':')||sector.id.startsWith((seasonalGrove?.id??'')+':'))&&!sector.hasDetail())stream.evict(sector);
      showCherryLod();showSeasonalLod();
    },
    async prime({cherry=false,pond=false}={}){
      await stream.prime(sector=>sector.id===pondDetailId?pond:
        !sector.id.startsWith('west-road-sakura:')&&cherry===sector.id.startsWith(cherryHill.id+':'));
      if(pond&&shore)shore.coverage.value=1;
      if(cherry){blend=Number(quality!=='low');lowCoverage=1;showCherryLod();}
    },
    dispose(){disposed=true;stream.dispose();fallback?.removeFromParent();gateLease?.release();},
    stats:()=>{
      const sectors=stream.stats();
      return {cherryHill:{futureMemoryPosition:memoryAnchor,lod:cherryLod(),detailCoverage:blend,lowCoverage,trees:trees?.length??0,assets:cherryStats(),
        estimatedTextureBytes:cherryLod()?estimatedTextures(cherryLayers.get(cherryLod()).root,{shadow:{}}):0},
        grenadierPond:{...sectors.find(sector=>sector.id===pondDetailId),
          shoreInstances:shore?.count??0,lod:shore?.quality??null,coverage:shore?.coverage.value??0,
          cache:'procedural; no external assets'},
        firstSakura:{id:seasonalGrove?.id??null,lod:seasonalLayers.has(quality)?quality:seasonalLayers.has('low')?'low':null,
          detailCoverage:seasonalBlend,lowCoverage:seasonalLowCoverage,trees:getSeasonalTreePlacements().length},
        landmarkState:entranceArt?'detailed':fallback?'structure':'pending',sectors,assets:assetStats(),
        firstPresentationCount:sectors.reduce((total,s)=>total+s.firstPresentationCount,0),
        lateActivationCount:sectors.reduce((total,s)=>total+s.lateActivationCount,0),
        visiblePopInCount:sectors.reduce((total,s)=>total+s.visiblePopInCount,0),
        estimatedTextureAndShadowBytes:entranceArt?estimatedTextures(entranceArt.root,sun):0};
    },
  };
}
