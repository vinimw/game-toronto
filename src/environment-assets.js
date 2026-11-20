import {assetUrl} from './asset-url.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {collectResources,disposeScene} from './scene-resources.js';
import {AssetManager} from './asset-manager.js';

import {entranceMaterialFiles,entranceModels,entranceDependencies} from './north-entrance-asset-manifest.js';

const directory=assetUrl('assets/north-entrance/');
const gltf=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const assets=new AssetManager({
  async fetchBytes(key,signal){
    const response=await fetch(directory+key,{signal});
    if(!response.ok)throw new Error('Asset da entrada indisponível: '+key);
    return response.arrayBuffer();
  },
  async decode(key,data){
    if(key.endsWith('.glb')){
      const {scene}=await gltf.parseAsync(data,directory);
      scene.updateMatrixWorld(true);
      return scene;
    }
    const url=URL.createObjectURL(new Blob([data],{type:'image/jpeg'}));
    try{
      const texture=await new THREE.TextureLoader().loadAsync(url);
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.anisotropy=4;
      if(key.includes('Diffuse'))texture.colorSpace=THREE.SRGBColorSpace;
      return texture;
    }finally{URL.revokeObjectURL(url);}
  },
  dispose(value){
    if(value.isTexture)value.dispose();
    else{
      // GLTFLoader may decode embedded PNGs into ImageBitmaps.
      const images=new Set([...collectResources(value)].filter(item=>item.isTexture).map(item=>item.image));
      disposeScene(value);
      for(const image of images)image?.close?.();
    }
  },
});

export const entranceAssetStats=()=>assets.stats();

export async function loadEntranceAssets(signal){
  const leases=entranceDependencies.map(key=>[key,assets.acquire(key)]);
  const release=()=>{
    signal?.removeEventListener('abort',release);
    for(const [,lease] of leases)lease.release();
  };
  signal?.addEventListener('abort',release,{once:true});
  if(signal?.aborted)release();
  try{
    const loaded=new Map(await Promise.all(leases.map(async ([key,lease])=>[key,await lease.ready])));
    signal?.throwIfAborted();
    const shared=new Set();
    const models=Object.fromEntries(entranceModels.map(name=>{
      const source=loaded.get(name+'.glb');
      for(const resource of collectResources(source))shared.add(resource);
      return [name,source];
    }));
    const surfaces=Object.fromEntries(Object.entries(entranceMaterialFiles).map(([key,asset])=>{
      const [map,normalMap,arm]=['Diffuse','nor_gl','arm'].map(kind=>loaded.get(asset+'-'+kind+'.jpg'));
      for(const texture of [map,normalMap,arm])shared.add(texture);
      return [key,{map,normalMap,roughnessMap:arm,aoMap:arm}];
    }));
    return {models,surfaces,shared,release};
  }catch(error){release();throw error;}
}
