import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SceneManager} from '../src/scene-manager.js';
import {collectResources,disposeScene} from '../src/scene-resources.js';
import {regionManifest,HIGH_PARK_GATE} from '../src/regions.js';
import {makeTorontoWorld} from '../src/scenes/toronto.js';
import {makeDemoWorld} from '../src/demo-world.js';
import {buildWorld} from '../src/world.js';
import {createCharacter} from '../src/character.js';
import {createGameState,MEMORY_ID} from '../src/game-state.js';
import {latLonToLocal} from '../src/geo.js';

const loadDemo=async definition=>definition.id==='toronto'?makeTorontoWorld(definition):{...makeDemoWorld(),origin:{...definition.demoOrigin}};
function makeManager(options={}) {
  const avatar=createCharacter(new THREE.Group());
  return new SceneManager({manifest:regionManifest,loadRegion:loadDemo,buildScene:buildWorld,avatar,...options});
}
const counts=scene=>{
  const counts={geometry:0,material:0,texture:0,instance:0};
  for(const resource of collectResources(scene)){
    if(resource.isBufferGeometry)counts.geometry++;
    else if(resource.isMaterial)counts.material++;
    else if(resource.isTexture)counts.texture++;
    else if(resource.isInstancedMesh)counts.instance++;
  }
  return counts;
};
function geographicPosition(manager){
  const {origin}=manager.active.world,{x,z}=manager.avatar.root.position;
  return {lat:origin.lat-z/111320,lon:origin.lon+x/(111320*Math.cos(origin.lat*Math.PI/180))};
}

test('round trips use stable geographic entries and keep exactly one avatar and region',async()=>{
  const manager=makeManager();
  await manager.load('toronto','start');
  assert.equal(manager.nearbyPortal([0,8]),null);
  manager.avatar.root.position.set(0,0,0);
  for(let i=0;i<6;i++){
    assert.equal(await manager.travel('toronto:high-park-gate'),true);
    assert.equal(manager.active.id,'high-park');
    assert.deepEqual(geographicPosition(manager),HIGH_PARK_GATE);
    assert.equal(manager.active.scene.children.filter(o=>o===manager.avatar.root).length,1);
    assert.ok(manager.active.world.memory);
    assert.equal(await manager.travel('high-park:toronto-gate'),true);
    assert.equal(manager.active.id,'toronto');
    assert.deepEqual(geographicPosition(manager),HIGH_PARK_GATE);
    assert.deepEqual(manager.active.stats.memoryPoints,[]);
    assert.equal(manager.active.scene.children.filter(o=>o===manager.avatar.root).length,1);
  }
  manager.unload();assert.equal(manager.avatar.root.parent,null);
});

test('exclusive allocations are all disposed and live resource counts remain bounded over 20 round trips',async()=>{
  let allocated=0,disposed=0;
  const live=new Set(),sharedDisposed=[];
  const manager=makeManager({buildScene(scene,world,portals){
    const stats=buildWorld(scene,world,portals);
    for(const resource of collectResources(scene)){
      allocated++;live.add(resource);
      resource.addEventListener('dispose',()=>{disposed++;assert.equal(live.delete(resource),true,'resource disposed more than once');});
    }
    return stats;
  }});
  for(const resource of manager.sharedResources)resource.addEventListener('dispose',()=>sharedDisposed.push(resource));
  const baselines={};
  for(let i=0;i<40;i++){
    const id=i%2?'high-park':'toronto',entry=i%2?'toronto-gate':'high-park-gate';
    await manager.load(id,entry);
    assert.equal(allocated-disposed,live.size);
    const current=counts(manager.active.scene);
    if(baselines[id])assert.deepEqual(current,baselines[id]);else baselines[id]=current;
  }
  manager.unload();assert.equal(live.size,0);assert.equal(allocated,disposed);assert.deepEqual(sharedDisposed,[]);
});

test('shared resources and nested uniform textures survive exclusive scene disposal',()=>{
  const scene=new THREE.Scene(),texture=new THREE.Texture(),shared=new THREE.Texture();
  const geometry=new THREE.BoxGeometry(),material=new THREE.ShaderMaterial({uniforms:{textures:{value:{nested:[texture,shared]}}}});
  const mesh=new THREE.Mesh(geometry,material);scene.add(mesh,new THREE.Mesh(geometry,material));scene.background=texture;
  const disposed=new Map();
  for(const resource of [texture,shared,geometry,material])resource.addEventListener('dispose',()=>disposed.set(resource,(disposed.get(resource)||0)+1));
  disposeScene(scene,new Set([shared]));
  assert.equal(disposed.get(texture),1);assert.equal(disposed.get(material),1);assert.equal(disposed.get(geometry),1);assert.equal(disposed.has(shared),false);
  assert.equal(scene.children.length,0);
});

test('loading is exclusive and input reset hooks stay locked through both fades',async()=>{
  let release;const pending=new Promise(resolve=>release=resolve),events=[];
  const manager=makeManager({loadRegion:async definition=>{await pending;return loadDemo(definition);},
    onBusy:busy=>events.push(busy),fade:async()=>{assert.equal(manager.loading,true);}});
  const first=manager.load('toronto','start');
  assert.equal(manager.loading,true);assert.equal(manager.nearbyPortal([0,0]),null);
  assert.equal(await manager.load('high-park','toronto-gate'),false);
  release();assert.equal(await first,true);assert.deepEqual(events,[true,false]);assert.equal(manager.loading,false);
  manager.unload();
});

test('bad destination data preserves current scene, position and control availability',async()=>{
  const manager=makeManager();await manager.load('toronto','start');
  const previous=manager.active,position=manager.avatar.root.position.clone();
  manager.loadRegion=async()=>{throw new Error('offline');};
  await assert.rejects(manager.load('high-park','toronto-gate'),/offline/);
  assert.equal(manager.active,previous);assert.ok(manager.avatar.root.position.equals(position));assert.equal(manager.loading,false);
  manager.unload();
});

test('partial construction failure disposes its resources and reconstructs previous scene',async()=>{
  let partialDisposed=0,oldDisposed=0;
  const manager=makeManager();await manager.load('toronto','start');
  for(const resource of collectResources(manager.active.scene))if(!manager.sharedResources.has(resource))resource.addEventListener('dispose',()=>oldDisposed++);
  const position=manager.avatar.root.position.clone(),original=manager.buildScene;
  manager.buildScene=(scene,world,portals)=>{
    if(world.memory){
      const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();
      geometry.addEventListener('dispose',()=>partialDisposed++);material.addEventListener('dispose',()=>partialDisposed++);
      scene.add(new THREE.Mesh(geometry,material));throw new Error('construction failed');
    }
    return original(scene,world,portals);
  };
  await assert.rejects(manager.load('high-park','toronto-gate'),/construction failed/);
  assert.equal(partialDisposed,2);assert.ok(oldDisposed>0);assert.equal(manager.active.id,'toronto');
  assert.ok(manager.avatar.root.position.equals(position));assert.equal(manager.loading,false);manager.unload();
});

test('projection uses destination origin instead of copying source local coordinates',async()=>{
  const manager=makeManager({loadRegion:async definition=>{
    const world=await loadDemo(definition);
    if(definition.id==='high-park'){
      const origin={lat:HIGH_PARK_GATE.lat+.00001,lon:HIGH_PARK_GATE.lon+.00001};
      const offset=latLonToLocal(HIGH_PARK_GATE.lat,HIGH_PARK_GATE.lon,origin);
      return {...world,origin,features:[],bbox:[-100,-100,100,100],memory:null,expected:offset};
    }
    return world;
  }});
  await manager.load('high-park','toronto-gate');
  assert.notEqual(manager.avatar.root.position.x,0);
  assert.deepEqual([manager.avatar.root.position.x,manager.avatar.root.position.z],manager.active.world.expected);
  assert.deepEqual(geographicPosition(manager),HIGH_PARK_GATE);manager.unload();
});

test('out of range interaction, invalid coordinates and blocked entry cannot change scenes',async()=>{
  const manager=makeManager();await manager.load('toronto','start');
  assert.equal(await manager.travel('toronto:high-park-gate'),false);
  assert.equal(manager.nearbyPortal([NaN,0]),null);
  manager.loadRegion=async definition=>({...makeTorontoWorld(regionManifest.toronto),features:[{kind:'water',points:[[-10,-10],[10,-10],[10,10],[-10,10]]}]});
  await assert.rejects(manager.load('high-park','toronto-gate'),/Obstructed/);
  assert.equal(manager.active.id,'toronto');manager.unload();
});

test('inventory, memory and progress survive scene lifetimes and storage reload',async()=>{
  const values=new Map([['game-love-memory-001','unlocked']]);
  const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const game=createGameState(storage),state=game.state;
  state.inventory.push('existing-item');state.progress.existing=1;game.unlockMemory(MEMORY_ID);
  const manager=makeManager();
  for(let i=0;i<4;i++){await manager.load('toronto','start');await manager.load('high-park','toronto-gate');}
  assert.equal(game.state,state);assert.deepEqual(createGameState(storage).state,state);
  assert.deepEqual(state.unlockedMemories,[MEMORY_ID]);assert.deepEqual(state.inventory,['existing-item']);
  assert.equal(state.progress.existing,1);manager.unload();
});

test('disabled or corrupt storage does not block in-session progress',()=>{
  const game=createGameState({getItem(){throw new Error('disabled');},setItem(){throw new Error('disabled');}});
  game.unlockMemory(MEMORY_ID);assert.deepEqual(game.state.unlockedMemories,[MEMORY_ID]);
  assert.deepEqual(createGameState({getItem:()=>'{bad json'}).state,{discoveredMemories:[],unlockedMemories:[],inventory:[],progress:{}});
});

test('manifest IDs are unique and invalid geographic references never activate',async()=>{
  const duplicate=structuredClone(regionManifest);
  duplicate['high-park'].portals[0].id=duplicate.toronto.portals[0].id;
  assert.throws(()=>makeManager({manifest:duplicate}),/Duplicate/);
  const invalid=structuredClone(regionManifest);invalid.toronto.entries.start.geo.lat=Infinity;
  const manager=makeManager({manifest:invalid});
  await assert.rejects(manager.load('toronto','start'),/geographic/);
  assert.equal(manager.active,null);assert.equal(manager.loading,false);
});
