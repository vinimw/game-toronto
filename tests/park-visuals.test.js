import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {avoidVegetation,recoverCameraArm,resolveGameplayCamera} from '../src/park-camera.js';
import {makeDemoWorld} from '../src/demo-world.js';
import {buildWorld} from '../src/world.js';
import {disposeScene} from '../src/scene-resources.js';
import {pathWidth,cameraSettings} from '../src/visual-settings.js';
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
  const trunk=stats.cameraVolumes.find(volume=>volume.kind==='tree').id;
  const originalTransforms=[new THREE.Matrix4(),new THREE.Matrix4()];
  originalTransforms.forEach((transform,i)=>trees.getMatrixAt(i,transform));
  stats.setCameraOccluders(new Set([trunk]));
  trees.getMatrixAt(0,matrix);
  assert.equal(point.setFromMatrixPosition(matrix).y,-10);
  trees.getMatrixAt(1,matrix);
  assert.ok(matrix.equals(originalTransforms[1]));
  stats.setCameraOccluders(new Set());
  trees.getMatrixAt(0,matrix);
  assert.ok(matrix.equals(originalTransforms[0]));
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

test('close procedural trunk is hidden without reducing the camera arm, then restored',()=>{
  const anchor=[0,1.48,0],view={yaw:0,pitch:.23,distance:7};
  const visible=[];
  const cameraVolumes=[
    {id:'tree:0',kind:'tree',center:[0,2.97,1.62],radii:[.29,3.45,.29]},
    {id:'tree:1',kind:'tree',center:[4,2.97,1.62],radii:[.29,3.45,.29]},
  ];
  const stats={cameraObstacles:[],cameraVolumes,setCameraOccluders:ids=>visible.push([...ids])};
  const first=resolveGameplayCamera(anchor,view,stats,null,1/60,cameraSettings);
  assert.equal(first.distance,7);
  assert.deepEqual(first.diagnostics.hiddenTrees,['tree:0']);
  assert.equal(first.diagnostics.excessiveProximity,false);
  const next=resolveGameplayCamera([2,1.48,0],view,stats,first,1/60,cameraSettings);
  assert.equal(next.distance,7);
  assert.deepEqual(visible,[['tree:0'],[]]);
});

test('camera lifts above a close solid wall and returns without entering the body volume',()=>{
  const anchor=[0,1.48,0],view={yaw:0,pitch:.23,distance:7};
  const wall={kind:'building',id:23,points:[[-4,1],[4,1],[4,3],[-4,3]],height:6.4};
  const stats={cameraObstacles:[wall],cameraVolumes:[]};
  const clear={cameraObstacles:[],cameraVolumes:[]};
  const settings=cameraSettings;
  const outcomes=[30,60,120].map(hz=>{
    const dt=1/hz;
    let result=resolveGameplayCamera(anchor,view,stats,null,dt,settings);
    assert.deepEqual(result.diagnostics.obstacle,{kind:'building',id:23});
    assert.equal(result.diagnostics.excessiveProximity,false);
    assert.ok(result.position[2]<.8);
    assert.ok(result.distance>=settings.minimumBodyDistance);
    for(let i=0;i<hz;i++){
      const next=resolveGameplayCamera(anchor,view,clear,result,dt,settings);
      assert.ok(next.distance>=result.distance && next.distance-result.distance<.65);
      assert.ok(next.pitch<=result.pitch);
      result=next;
    }
    return result;
  });
  for(const r of outcomes){
    assert.ok(r.distance>6.98);
    assert.ok(Math.abs(r.pitch-view.pitch)<.004);
  }
  assert.ok(Math.abs(outcomes[0].distance-outcomes[2].distance)<.001);
  assert.ok(Math.abs(outcomes[0].pitch-outcomes[2].pitch)<.001);
});
