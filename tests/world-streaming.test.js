import test from 'node:test';
import assert from 'node:assert/strict';
import {AssetManager} from '../src/asset-manager.js';
import {WorldStreaming} from '../src/world-streaming.js';

const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('simultaneous leases share fetch and decode until the last release; binary cache enables return',async()=>{
  let downloads=0,decodes=0,disposals=0;
  const manager=new AssetManager({fetchBytes:async()=>{downloads++;return new ArrayBuffer(4);},
    decode:async()=>({id:++decodes}),dispose:()=>disposals++});
  const a=manager.acquire('tree'),b=manager.acquire('tree');
  assert.equal(await a.ready,await b.ready);
  a.release();
  assert.equal(disposals,0);
  b.release();
  assert.equal(disposals,1);
  const again=manager.acquire('tree');
  assert.equal((await again.ready).id,2);
  again.release();
  assert.deepEqual([downloads,disposals,manager.stats().cacheHits],[1,2,1]);
});

test('failed and cancelled assets can be requested again without leaking decoded objects',async()=>{
  let attempt=0,finish,disposals=0;
  const manager=new AssetManager({
    fetchBytes:async()=>{if(++attempt===1)throw new Error('offline');return new ArrayBuffer(4);},
    decode:async()=>new Promise(resolve=>{finish=resolve;}),
    dispose:()=>disposals++,
  });
  const failed=manager.acquire('gate');
  await assert.rejects(failed.ready,/offline/);
  failed.release();
  const cancelled=manager.acquire('gate');
  const rejection=assert.rejects(cancelled.ready,{name:'AbortError'});
  await settle();
  cancelled.release();
  finish({});
  await rejection;
  assert.equal(disposals,1);
  const retry=manager.acquire('gate');
  await settle();
  finish({});
  await retry.ready;
  retry.release();
  assert.deepEqual([attempt,disposals],[2,2]);
});

test('streamer anticipates movement, tolerates the boundary, evicts, and retries failed sectors',async()=>{
  let now=100,mounted=0,disposed=0,attempt=0;
  const stream=new WorldStreaming([{
    id:'north',bounds:[100,0,200,100],loadRadius:40,keepRadius:70,lane:'geometry',
    async load(){
      if(++attempt===1)throw new Error('offline');
      return {mount:()=>mounted++,dispose:()=>disposed++,estimatedGeometryBytes:5};
    },
  }],{now:()=>now,frame:()=>Promise.resolve(),graceMs:100});
  stream.update([15,10],[35,0],[1,0]);
  await settle();
  assert.equal(stream.stats()[0].state,'failed');
  now+=2500;
  stream.update([15,10],[35,0],[1,0]);
  await settle();
  assert.equal(stream.stats()[0].state,'active');
  now+=10;
  stream.update([30,10]);
  now+=1000;
  stream.update([29,10]);
  stream.update([32,10]);
  assert.equal(disposed,0);
  now+=20;
  stream.update([0,10]);
  now+=100;
  stream.update([0,10]);
  assert.equal(disposed,1);
  stream.update([100,10]);
  await settle();
  assert.equal(stream.stats()[0].activations,2);
  stream.dispose();
  assert.deepEqual([mounted,disposed],[2,2]);
});

test('obsoleted sector never mounts a completed result after unload',async()=>{
  let finish,disposed=0;
  const stream=new WorldStreaming([{
    id:'north',bounds:[0,0,100,100],loadRadius:40,keepRadius:70,lane:'assets',
    load:()=>new Promise(resolve=>{finish=resolve;}),
  }],{frame:()=>Promise.resolve()});
  stream.update([0,0]);
  await settle();
  stream.dispose();
  finish({mount:()=>assert.fail('mounted an obsolete sector'),dispose:()=>disposed++});
  await settle();
  assert.equal(disposed,1);
});
