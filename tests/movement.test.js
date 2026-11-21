import test from 'node:test';
import assert from 'node:assert/strict';
import {movementDelta, finitePoint, createWalkTest, movePlayer, resolveCamera, buildingHeight, frameTiming, frameMetrics} from '../src/movement.js';
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
const square = [[0,0],[2,0],[2,2],[0,2],[0,0]];
const building = {kind:'building',points:square};
const walk = createWalkTest([building],[-10,-10,10,10]);

for(const [name,right,forward,expected] of [
  ['forward',0,1,[0,-.255]],['backward',0,-1,[0,.255]],['left',-1,0,[-.255,0]],['right',1,0,[.255,0]],
]) test(`movement ${name}`,()=>movementDelta(right,forward,0,5.1,.05).forEach((v,i)=>close(v,expected[i])));

test('camera yaw rotates forward into west and right into north',()=>{
  const forward=movementDelta(0,1,Math.PI/2,5,.05), right=movementDelta(1,0,Math.PI/2,5,.05);
  close(forward[0],-.25);close(forward[1],0);close(right[0],0);close(right[1],-.25);
});
test('diagonals are normalized, joystick magnitude remains analog',()=>{
  close(Math.hypot(...movementDelta(1,1,1,5,.05)),.25);
  close(Math.hypot(...movementDelta(0,.5,1,5,.05)),.125);
});
test('invalid input never creates invalid displacement',()=>{
  for(const value of [NaN,Infinity,-Infinity]) for(let i=0;i<5;i++){
    const args=[1,1,0,5,.05];args[i]=value;
    assert.deepEqual(movementDelta(...args),[0,0]);
  }
  assert.deepEqual(movementDelta(0,0,0,5,.05),[0,0]);
  assert.equal(finitePoint([0,Infinity]),false);
  assert.equal(finitePoint([NaN,0]),false);
});
test('simulation caps long frames without corrupting timing measurements',()=>{
  assert.deepEqual(frameTiming(100,0),{real:.1,simulation:.05});
  assert.deepEqual(frameMetrics(10,1),{fps:10,milliseconds:100});
  assert.deepEqual(frameTiming(0,100),{real:0,simulation:0});
});
test('body radius blocks wall edges, corners, interior and bbox',()=>{
  assert.equal(walk(-.2,1),false);assert.equal(walk(-.4,1),true);
  assert.equal(walk(-.2,-.2),false);assert.equal(walk(1,1),false);
  assert.equal(walk(9.8,0),false);assert.equal(walk(NaN,0),false);assert.equal(walk(0,Infinity),false);
});
test('water is a body obstacle',()=>{
  const canWalk=createWalkTest([{kind:'water',points:square}],[-10,-10,10,10]);
  assert.equal(canWalk(1,1),false);
});
test('thin walls cannot be crossed in a frame',()=>{
  const thin=createWalkTest([{kind:'building',points:[[0,-2],[.01,-2],[.01,2],[0,2]]}],[-10,-10,10,10]);
  const motion=movePlayer([-.4,0],[.9,0],thin,.05);
  assert.ok(motion.position[0]<-.35);assert.equal(motion.speed,0);
});
test('wall sliding uses executed velocity and heading',()=>{
  const motion=movePlayer([-.4,1],[.3,.3],walk,.05);
  assert.ok(motion.position[0]<0);assert.ok(motion.position[1]>1);
  close(motion.speed,Math.hypot(motion.position[0]+.4,motion.position[1]-1)/.05);
  assert.ok(Number.isFinite(motion.heading));
  const stopped=movePlayer([-.36,1],[.1,0],walk,.05);
  assert.equal(stopped.speed,0);assert.equal(stopped.heading,null);
});
test('forward heading faces negative z and idle does not rotate',()=>{
  const moving=movePlayer([-2,-2],[0,-.2],walk,.05);close(moving.heading,0);
  assert.equal(movePlayer([-2,-2],[0,0],walk,.05).heading,null);
});
test('invalid displacement is rejected and invalid starting position fails explicitly',()=>{
  for(const delta of [[NaN,0],[Infinity,0],[7,0]]) assert.deepEqual(movePlayer([-2,-2],delta,walk,.05).position,[-2,-2]);
  assert.throws(()=>movePlayer([NaN,0],[0,0],walk,.05),RangeError);
});
test('camera sweep stops before a building and respects height',()=>{
  const buildings=[{points:square,height:4}];
  const stopped=resolveCamera([-1,1,1],[4,1,1],buildings);
  assert.ok(stopped[0]<-.22);assert.ok(stopped.every(Number.isFinite));
  assert.deepEqual(resolveCamera([-1,6,1],[4,6,1],buildings),[4,6,1]);
});
test('camera sweep handles corners, free orbit and invalid endpoint',()=>{
  const anchor=[-1,1,-1];
  assert.ok(resolveCamera(anchor,[1,1,1],[{points:square,height:4}])[0]<0);
  assert.deepEqual(resolveCamera(anchor,[-2,2,-3],[]),[-2,2,-3]);
  assert.deepEqual(resolveCamera(anchor,[NaN,2,0],[]),anchor);
});
test('building height is shared by rendered geometry and camera volumes',()=>{
  close(buildingHeight({height:'10'}),10);close(buildingHeight({'building:levels':'3'}),9.6);
  close(buildingHeight({height:'invalid','building:levels':'invalid'}),6.4);
  close(buildingHeight({height:'100'}),42);
});
