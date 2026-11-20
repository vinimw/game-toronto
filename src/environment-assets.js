import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {disposeScene} from './scene-resources.js';

const directory='/assets/north-entrance/';
const buffers=new Map();
const materials={asphalt:'asphalt_track',pavement:'concrete_pavement',masonry:'stone_wall',grass:'grass_medium_01'};
export const entranceTreeVariants=['maple-43','maple-79','oak-31','oak-67'];

function bytes(name){
  if(!buffers.has(name))buffers.set(name,fetch(directory+name).then(response=>{
    if(!response.ok)throw new Error('Asset da entrada indisponível: '+name);
    return response.arrayBuffer();
  }).catch(error=>{buffers.delete(name);throw error;}));
  return buffers.get(name);
}

export async function loadEntranceAssets(){
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const textures=new THREE.TextureLoader(),created=new Set(),ownedScenes=[];
  const jobs=[];
  const loadTexture=name=>textures.loadAsync(directory+name).then(texture=>{
    created.add(texture);
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.anisotropy=4;
    if(name.includes('Diffuse'))texture.colorSpace=THREE.SRGBColorSpace;
    return texture;
  });
  async function model(name){
    const gltf=await loader.parseAsync(await bytes(name+'.glb'),directory);
    ownedScenes.push(gltf.scene);
    gltf.scene.updateMatrixWorld(true);
    return gltf.scene;
  }
  const models={},surfaces={};
  for(const [key,asset] of Object.entries(materials)){
    const maps=Promise.allSettled(['Diffuse','nor_gl','arm'].map(kind=>loadTexture(asset+'-'+kind+'.jpg')));
    jobs.push(maps.then(results=>{
      const failure=results.find(result=>result.status==='rejected');
      if(failure)throw failure.reason;
      const [map,normalMap,arm]=results.map(result=>result.value);
      surfaces[key]={map,normalMap,roughnessMap:arm,aoMap:arm};
    }));
  }
  const names=['north-gate',...entranceTreeVariants.flatMap(variant=>['high','balanced'].map(lod=>variant+'-'+lod))];
  for(const name of names)jobs.push(model(name).then(root=>models[name]=root));
  const result=await Promise.allSettled(jobs);
  const failure=result.find(job=>job.status==='rejected');
  if(failure){
    for(const root of ownedScenes)disposeScene(root);
    for(const texture of created)texture.dispose();
    throw failure.reason;
  }
  return {models,surfaces};
}
