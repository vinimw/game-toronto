import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {createTerrain,addTerrainChunks} from '../src/high-park-terrain.js';
import {prepareHighParkMap} from '../src/map-loader.js';
import {createWalkTest,resolveCamera} from '../src/movement.js';
import {resolveMemoryPoints} from '../src/memories.js';

const read=path=>readFile(new URL('../'+path,import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('expanded data retains the original coordinate origin and verified sources',async()=>{
  const [raw,terrainData,north,osmArchive,raster]=await Promise.all([
    read('public/data/high-park-expanded.osm.json').then(JSON.parse),
    read('public/data/high-park-terrain.json').then(JSON.parse),
    read('public/data/high-park.osm.json').then(JSON.parse),
    read('tools/data/high-park-expanded.osm-source.json.gz'),read('tools/data/high-park-hrdem.tif'),
  ]);
  assert.equal(raw.sourceSha256,hash(gunzipSync(osmArchive)));
  assert.equal(terrainData.sourceSha256,hash(raster));
  assert.deepEqual(raw.origin,north.origin);
  const world=prepareHighParkMap(raw),terrain=createTerrain(terrainData,raw.bbox,raw.bboxWgs84);
  const walk=createWalkTest(raw.features,raw.bbox);
  assert.ok(walk(...world.spawn));
  assert.ok(raw.features.some(f=>f.kind==='water'&&f.osmId===174225267));
  assert.ok(raw.features.some(f=>f.kind==='sport'&&f.osmId===14344509));
  const [memory]=resolveMemoryPoints('high-park',world,walk);
  assert.deepEqual(memory.position,resolveMemoryPoints('high-park',north,createWalkTest(north.features,north.bbox))[0].position);
  assert.ok(terrain.at(...world.spawn)>terrain.at(-173,1050)+25);
  const pond=raw.features.find(f=>f.osmId===174225267);
  assert.ok(pond.points.every(point=>!walk(...point)));
  assert.throws(()=>createTerrain({...terrainData,heightsCm:[]},raw.bbox,raw.bboxWgs84),/incompatível/);
});

test('terrain mesh and camera ground collision use the same triangulated elevations',()=>{
  const bounds=[0,0,2,2],bboxWgs84=[1,2,3,4];
  const terrain=createTerrain({version:1,width:2,height:2,heightsCm:[100,140,160,240],
    zeroMeters:2,bboxWgs84,sourceSha256:'a'.repeat(64)},bounds,bboxWgs84);
  assert.equal(terrain.at(0,0),-1);
  assert.equal(terrain.at(2,2),.3999999999999999);
  assert.ok(Math.abs(terrain.at(.5,.5)+.75)<1e-8);
  const scene=new THREE.Scene();
  addTerrainChunks(scene,terrain,[],{ground:0xffaa99,meadow:0xffaa99,woodland:0xffaa99},null);
  const mesh=scene.children[0],positions=mesh.geometry.attributes.position;
  for(let i=0;i<positions.count;i++)
    assert.ok(Math.abs(positions.getY(i)-terrain.at(positions.getX(i),positions.getZ(i)))<1e-6);
  const result=resolveCamera([0,.5,0],[2,-.9,2],[],.22,null,terrain);
  assert.ok(result[0]>0&&result[0]<2&&result[1]>=terrain.at(result[0],result[2])+.22);
});
