import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeDemoWorld} from '../src/demo-world.js';
import {buildWorld} from '../src/world.js';
import {createCharacter} from '../src/character.js';
import {movementDelta, movePlayer, resolveCamera} from '../src/movement.js';

test('actual demo builds finite geometry and supports a walk to the existing memory',()=>{
  const scene=new THREE.Scene(),world=makeDemoWorld();
  const stats=buildWorld(scene,world),avatar=createCharacter(scene);
  assert.equal(stats.canWalk(...world.spawn),true);
  let position=[...world.spawn];
  // Existing demo memory: 42m east, 40m south. No new game content.
  for(const [right,forward,frames] of [[1,0,168],[0,-1,160]]){
    for(let i=0;i<frames;i++){
      const motion=movePlayer(position,movementDelta(right,forward,0,5,.05),stats.canWalk,.05);
      position=motion.position;avatar.update(.05,motion.speed);
      avatar.root.position.set(position[0],0,position[1]);
      if(motion.heading!==null)avatar.root.rotation.y=motion.heading;
    }
  }
  assert.ok(Math.hypot(position[0]-world.memory[0],position[1]-world.memory[1])<1e-8);
  assert.equal(stats.canWalk(70,110),false); // Actual demo cafe footprint.
  const camera=resolveCamera([60,1.48,110],[75,4,110],stats.cameraObstacles);
  assert.ok(camera[0]<63);
  scene.updateMatrixWorld(true);
  scene.traverse(object=>{
    assert.ok(object.matrixWorld.elements.every(Number.isFinite));
    if(object.geometry)for(const attribute of Object.values(object.geometry.attributes)){
      assert.ok(attribute.array.every(Number.isFinite));
    }
  });
});
