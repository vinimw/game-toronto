import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {buildWorld} from '../src/world.js';
import {prepareHighParkMap} from '../src/map-loader.js';
import {parkEnvironment} from '../src/park-environment.js';
import {nearSegment,nearestOnPath} from '../src/geo.js';
import {pathWidth} from '../src/visual-settings.js';
import {disposeScene} from '../src/scene-resources.js';

test('spring grove is confined to the real corridor and foliage leaves the mapped path free',async()=>{
  const raw=JSON.parse(await readFile(new URL('../public/data/high-park.osm.json',import.meta.url)));
  const world=prepareHighParkMap(raw),scene=new THREE.Scene();
  scene.name='region:high-park';
  const stats=buildWorld(scene,world);
  try{
    assert.equal(stats.environment,'high-park-sakura');
    const {seasonal}=stats.vegetationMetrics();
    assert.ok(seasonal.treePositions.length>=5&&seasonal.treePositions.length<=14);
    assert.ok(seasonal.petals>0&&seasonal.petals<=14*38);
    const sidewalk=raw.features.find(feature=>feature.osmId===174188399);
    assert.ok(nearestOnPath(seasonal.position,[sidewalk]).dist<.001);
    for(const point of seasonal.treePositions){
      assert.ok(stats.canWalk(...point,2));
      for(const path of raw.features.filter(feature=>feature.kind==='path'))
        for(let i=1;i<path.points.length;i++)
          assert.ok(nearSegment(point,path.points[i-1],path.points[i])>pathWidth(path)/2+2);
    }
    const petals=scene.getObjectByName('park:petal');
    assert.ok(petals.isInstancedMesh);
    stats.setDetailFocus(...seasonal.position);
    stats.setQuality('high');
    const desktop=petals.count;
    stats.setQuality('balanced');
    assert.ok(petals.count>0&&petals.count<desktop);
    assert.deepEqual(world.features,raw.features);
  }finally{disposeScene(scene);}
});

test('season is configurable and does not turn demo or Toronto into OSM',()=>{
  assert.equal(parkEnvironment({mode:'demo',dataset:'high-park-north'}).id,'demo');
  assert.equal(parkEnvironment({mode:'demo',environment:'toronto-default'}).id,'toronto-default');
  assert.equal(parkEnvironment({mode:'osm',dataset:'high-park-north',environment:'high-park-default'}).grove,undefined);
});
