import test from 'node:test';
import assert from 'node:assert/strict';
import {planParkConnection} from '../src/park-connections.js';

const path=(osmId,points,extra={})=>({kind:'path',osmId,points,tags:{highway:'footway',...extra}});
const world=features=>({features,bbox:[-50,-50,50,50]});
test('joins shared OSM vertices in order and reports way IDs',()=>{
  const map=world([path(9,[[0,0],[4,0]]),path(10,[[4,0],[4,4]])]);
  const result=planParkConnection(map,[[0,0],[4,4]]);
  assert.equal(result.status,'planned');
  assert.equal(result.distanceMeters,8);
  assert.deepEqual(result.segments.map(s=>s.osmId),[9,10]);
});
test('does not bridge nearby disconnected paths or use access=no',()=>{
  const map=world([path(9,[[0,0],[4,0]]),path(10,[[4.1,0],[4.1,4]]),
    path(11,[[4,0],[4.1,0]],{access:'no'})]);
  assert.equal(planParkConnection(map,[[0,0],[4.1,4]]).reason,'disconnected');
});
test('rejects an OSM segment when the collision probe finds an obstruction',()=>{
  const map=world([path(9,[[0,0],[4,0],[8,0]]),path(10,[[0,0],[-1,0]]),path(11,[[8,0],[9,0]])]);
  const result=planParkConnection(map,[[0,0],[8,0]],x=>x<1||x>2);
  assert.equal(result.reason,'disconnected');
  assert.equal(result.blocked[0].osmId,9);
});

test('checks an exterior landmark approach without attributing it to OSM',()=>{
  const map=world([path(9,[[0,0],[4,0]])]);
  const exterior=[[4,1],[5,1]];
  const result=planParkConnection(map,[[0,0],[4,0]],()=>true,exterior);
  assert.equal(result.status,'planned');
  assert.deepEqual(result.segments.map(s=>s.osmId),[9,null,null]);
  assert.deepEqual(result.segments.at(-1).to,[5,1]);
  assert.equal(planParkConnection(map,[[0,0],[4,0]],(_,z)=>z<.6,exterior).reason,
    'exterior-approach-obstructed');
});
