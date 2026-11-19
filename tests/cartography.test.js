import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import {buildWorld} from '../src/world.js';
import {disposeScene} from '../src/scene-resources.js';
import {prepareHighParkMap} from '../src/map-loader.js';
import {compareGeometry} from '../tools/review/cartography.mjs';
import {collectRenderedGeometry} from '../tools/review/rendered-geometry.js';
import {validateNavigation} from '../tools/review/navigation.js';

test('raw-source comparison detects a missing building and a shifted Three.js strip',async()=>{
  const source=await readFile(new URL('../tools/data/high-park-north.osm-source.json',import.meta.url));
  const data=JSON.parse(await readFile(new URL('../public/data/high-park.osm.json',import.meta.url)));
  const world=prepareHighParkMap(data);
  const scene=new THREE.Scene(),evidence=collectRenderedGeometry();
  const stats=buildWorld(scene,world,[],evidence);
  try {
    const inputs={geographicOrigin:world.origin,bboxWgs84:world.bboxWgs84,sourceSha256:world.sourceSha256};
    const baseline=compareGeometry(source,evidence.parts,inputs).report;
    assert.equal(baseline.status,'within-tolerance');
    assert.ok(baseline.comparison.junctionCount>0);
    assert.ok(!baseline.differences.some(item=>item.id===174188399));
    assert.ok(!baseline.missing.includes(43805272));
    const changed=evidence.parts.filter(part=>part.id!==43805272).map(part=>
      part.id===174188399?{...part,segments:part.segments.map(segment=>segment.map(([x,z])=>[x+1,z]))}:part);
    const review=compareGeometry(source,changed,inputs).report;
    assert.ok(review.missing.includes(43805272));
    assert.ok(review.differences.some(item=>item.id===174188399&&item.maxErrorMeters>.5));
    assert.throws(()=>compareGeometry(Buffer.concat([source,Buffer.from(' ')]),evidence.parts,inputs),/Hash/);
    const result=validateNavigation({scene,world,stats,spawn:world.spawn,portals:[]});
    assert.equal(result.status,'passed');
    assert.ok(result.lengthMeters>150);
    assert.ok(result.edges.every(edge=>edge.blocked));
  }finally{disposeScene(scene);}
});
