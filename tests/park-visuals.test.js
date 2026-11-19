import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {avoidVegetation,recoverCameraArm} from '../src/park-camera.js';
import {makeDemoWorld} from '../src/demo-world.js';
import {buildWorld} from '../src/world.js';
import {disposeScene} from '../src/scene-resources.js';
import {pathWidth} from '../src/visual-settings.js';
import {nearSegment} from '../src/geo.js';

test('camera retracts before the closest tree and clears when it moves out of view',()=>{
  const anchor=[0,1.48,0], desired=[0,3,7];
  const farther={center:[0,2.5,5],radii:[1,2,1]};
  const nearer={center:[0,2,2],radii:[1,2,1]};
  const limited=avoidVegetation(anchor,desired,[farther,nearer]);
  assert.ok(limited[2]>0&&limited[2]<1);
  assert.deepEqual(avoidVegetation(anchor,desired,[{...nearer,center:[4,2,2]}]),desired);
  assert.deepEqual(avoidVegetation(anchor,desired,[{...nearer,center:anchor}]),desired);
});

test('park detail stays outside path widths and changing quality preserves tree placement',()=>{
  const scene=new THREE.Scene(), world=makeDemoWorld(), original=structuredClone(world.features);
  const stats=buildWorld(scene,world,[{id:'gate',position:[0,0]}]);
  const paths=world.features.filter(f=>f.kind==='path');
  for(const name of ['round','column','spread','spire'])assert.ok(scene.getObjectByName('park:'+name)?.count>0);
  const matrix=new THREE.Matrix4(), point=new THREE.Vector3();
  for(const name of ['trunk','shrub','grass','stone']){
    const mesh=scene.getObjectByName('park:'+name);
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);
      for(const path of paths)for(let j=1;j<path.points.length;j++){
        assert.ok(nearSegment([point.x,point.z],path.points[j-1],path.points[j])>=pathWidth(path)/2);
      }
    }
  }
  const trees=scene.getObjectByName('park:trunk'), grass=scene.getObjectByName('park:grass');
  const treeCount=trees.count, grassCount=grass.count;
  stats.setQuality('low');
  assert.equal(trees.count,treeCount);
  assert.ok(grass.count<grassCount);
  assert.equal(scene.getObjectByName('park:contact').visible,false);
  stats.setQuality('high');
  assert.equal(grass.count,grassCount);
  assert.deepEqual(world.features,original);
  disposeScene(scene);
});

test('camera respects the obstruction immediately and eases back after it clears',()=>{
  assert.equal(recoverCameraArm(1,.36,.016,6),.36);
  const recovering=recoverCameraArm(.36,1,.016,6);
  assert.ok(recovering>.36&&recovering<1);
});

test('cafe furniture blocks collisions without closing the approach to the door',()=>{
  const world=makeDemoWorld(),original=structuredClone(world.features);
  const scene=new THREE.Scene(),stats=buildWorld(scene,world);
  assert.ok(scene.getObjectByName('demo:park-cafe'));
  assert.equal(stats.canWalk(60.1,108.3),false);
  assert.equal(stats.canWalk(60.1,114.5),true);
  assert.equal(stats.canWalk(64,114.5),false);
  assert.deepEqual(world.features,original);
  disposeScene(scene);
});
