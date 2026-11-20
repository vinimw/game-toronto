import assert from 'node:assert/strict';
import test from 'node:test';
import {ThirdPersonRig,coupledRigSettings} from '../src/third-person-rig.js';
import {angleDelta} from '../src/camera-follow.js';
import {joystickAxes} from '../src/controls.js';
import {PlayerController} from '../src/player-controller.js';

const close=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function sim(fps,heading=0){
  const rig=new ThirdPersonRig(heading),player=new PlayerController();
  let yaw=heading,position=[0,0];
  return (right,forward,extra={})=>{
    const dt=1/fps;
    const result=rig.step({right,forward,dt,yaw,manualYaw:yaw,...extra});
    yaw=result.cameraYaw;
    const motion=player.move(position,{...result.move,dt,canWalk:()=>true});
    position=motion.position;
    return {...result,position,speed:motion.speed};
  };
}

for(const fps of [30,60,120]){
  test(`coupled steering starts body and camera on the same frame at ${fps} Hz`,()=>{
    for(const axes of [[1,1],[-1,1],joystickAxes(18,-24),joystickAxes(38,0)]){
      const step=sim(fps);
      const straight=step(0,1);
      close(straight.locomotionHeading,0);close(straight.cameraYaw,0);
      const curve=step(...axes);
      const sign=-Math.sign(axes[0]);
      assert.ok(sign*curve.locomotionHeading>0&&sign*curve.cameraYaw>0);
      assert.equal(curve.targetYaw,curve.locomotionHeading);
      assert.ok(curve.speed>0);
      let last=curve,turned=curve.locomotionHeading;
      for(let i=1;i<fps*4;i++){
        const next=step(...axes);
        const turn=angleDelta(last.locomotionHeading,next.locomotionHeading);
        assert.ok(sign*turn>0);
        assert.equal(next.targetYaw,next.locomotionHeading);
        assert.ok(sign*angleDelta(last.cameraYaw,next.cameraYaw)>0);
        assert.ok(Math.abs(angleDelta(next.cameraYaw,next.locomotionHeading))<.4);
        assert.equal(next.move.right,0);
        last=next;turned+=turn;
      }
      assert.ok(sign*turned>Math.PI/2);
      const resumed=step(0,1);
      close(resumed.locomotionHeading,last.locomotionHeading);
      assert.equal(resumed.targetYaw,last.targetYaw);
      assert.ok(Math.abs(angleDelta(resumed.cameraYaw,resumed.targetYaw))<Math.abs(angleDelta(last.cameraYaw,last.targetYaw)));
    }
  });

  test(`manual orbit leaves the driven path unchanged at ${fps} Hz`,()=>{
    const manual=sim(fps,3.12), automatic=sim(fps,3.12);
    for(let i=0;i<fps;i++){
      const a=automatic(-1,1),b=manual(-1,1,{dragging:true,manualYaw:-1});
      assert.deepEqual(b.position,a.position);
      close(b.locomotionHeading,a.locomotionHeading);
      assert.equal(b.manual,true);
      assert.equal(b.targetYaw,-1);
    }
    const resumed=manual(0,1);
    assert.equal(resumed.manual,false);
    assert.equal(resumed.targetYaw,resumed.locomotionHeading);
  });
}

test('driven arc and analog speed are independent of render yaw and frame rate',()=>{
  const paths=[30,60,120].map(fps=>{
    const step=sim(fps),input=joystickAxes(18,-24);
    let result;
    for(let i=0;i<fps*2;i++)result=step(...input);
    assert.ok(result.speed>0&&result.speed<5.1);
    return result;
  });
  for(const result of paths.slice(1)){
    close(result.position[0],paths[0].position[0]);
    close(result.position[1],paths[0].position[1]);
    close(angleDelta(result.locomotionHeading,paths[0].locomotionHeading),0);
    close(angleDelta(result.cameraYaw,paths[0].cameraYaw),0,.017);
  }
  close(coupledRigSettings.turnRate,Math.PI*2/3);
});


test('a short orbit gesture holds the view at rest until travel resumes',()=>{
  const rig=new ThirdPersonRig();
  rig.orbitManually();
  const step=(forward,yaw)=>rig.step({right:0,forward,dt:1/60,yaw,manualYaw:1});
  const drag=step(1,0);
  assert.equal(drag.manual,true);
  assert.ok(drag.cameraYaw>0);
  const idle=step(0,drag.cameraYaw);
  assert.equal(idle.targetYaw,1);
  const resumed=step(1,idle.cameraYaw);
  assert.equal(resumed.targetYaw,0);
  assert.equal(resumed.manual,false);
  assert.ok(resumed.cameraYaw<idle.cameraYaw);
});
