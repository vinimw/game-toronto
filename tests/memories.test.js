import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createGameState} from '../src/game-state.js';
import {memories,nearbyMemory,resolveMemoryPoints,MEMORY_ID} from '../src/memories.js';
import {albumMarkup,memoryMarkup} from '../src/memory-ui.js';
import {nearestOnPath} from '../src/geo.js';
import {prepareHighParkMap} from '../src/map-loader.js';
import {buildWorld} from '../src/world.js';

test('location uses the OSM footway by the Nature Centre and matches its scene marker',async()=>{
  const data=JSON.parse(await readFile(new URL('../public/data/high-park.osm.json',import.meta.url)));
  const world=prepareHighParkMap(data);
  const scene=new THREE.Scene();scene.name='region:high-park';
  const stats=buildWorld(scene,world);
  assert.equal(stats.memoryPoints.length,1);
  const [point]=stats.memoryPoints,[x,z]=point.position;
  assert.ok(stats.canWalk(x,z));
  assert.ok(Math.hypot(x-93.23,z-102.6)<.01);
  assert.equal(nearestOnPath(point.position,world.features,f=>f.osmId===point.memory.anchor.pathId).dist,0);
  assert.deepEqual(scene.getObjectByName('memory:'+MEMORY_ID).position.toArray(),[x,0,z]);
  assert.equal(nearbyMemory(stats.memoryPoints,[x+point.memory.radius+.01,z]),null);
  assert.equal(nearbyMemory(stats.memoryPoints,[x+point.memory.radius-.01,z]),point);
  assert.deepEqual(resolveMemoryPoints('toronto',world,stats.canWalk),[]);
  assert.deepEqual(resolveMemoryPoints('high-park',{...world,features:[]},stats.canWalk),[]);
});

test('migration, discovery and explicit unlock persist once without duplicating entries',()=>{
  const key='game-love-progress-v1';
  let writes=0;
  const values=new Map([[key,JSON.stringify({unlockedMemories:['older','older',null],inventory:['item'],progress:{task:1}})]]);
  const storage={getItem:key=>values.get(key),setItem:(key,value)=>{writes++;values.set(key,value);}};
  const game=createGameState(storage);
  assert.deepEqual(game.state.discoveredMemories,['older']);
  assert.equal(game.discoverMemory(MEMORY_ID),true);
  assert.equal(game.discoverMemory(MEMORY_ID),false);
  assert.ok(!game.state.unlockedMemories.includes(MEMORY_ID));
  assert.deepEqual(createGameState(storage).state,game.state);
  assert.equal(game.unlockMemory(MEMORY_ID),true);
  assert.equal(game.unlockMemory(MEMORY_ID),false);
  game.save();
  assert.equal(writes,2);
  assert.equal(JSON.parse(values.get(key)).version,2);
  assert.deepEqual(createGameState(storage).state,game.state);
  assert.deepEqual(game.state.inventory,['item']);
  assert.deepEqual(game.state.progress,{task:1});
});

test('album hides locked content and supports configured images and illustration fallback',()=>{
  const [definition]=memories;
  const memory={...definition,narrative:'Trecho <privado>',description:'Resumo fictício',image:{src:'/memories/demo.jpg',alt:'Uma árvore'}};
  const locked=albumMarkup([memory],{discoveredMemories:[memory.id],unlockedMemories:[]});
  assert.match(locked,/High Park.*Descoberta/);
  for(const value of ['Trecho','Resumo','demo.jpg','data-open-memory'])assert.ok(!locked.includes(value));
  const unlocked=albumMarkup([memory],{discoveredMemories:[memory.id],unlockedMemories:[memory.id]});
  assert.match(unlocked,/data-open-memory/);
  assert.match(unlocked,/demo\.jpg/);
  assert.match(memoryMarkup(memory,true),/Trecho &lt;privado&gt;/);
  assert.match(memoryMarkup(memory,true),/alt="Uma árvore"/);
  assert.match(memoryMarkup({...memory,image:null},false),/memory-art/);
  assert.doesNotMatch(memoryMarkup({...memory,image:{src:'//external.invalid/photo.jpg'}},false),/<img/);
});
