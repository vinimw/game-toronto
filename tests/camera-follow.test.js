import assert from 'node:assert/strict';
import test from 'node:test';
import {CameraFollow,angleDelta} from '../src/camera-follow.js';
import {joystickAxes} from '../src/controls.js';
import {PlayerController} from '../src/player-controller.js';
import {cameraSettings} from '../src/visual-settings.js';

const close=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);

function simulate(fps,speed,sequence){
  const controller=new PlayerController(),camera=new CameraFollow(cameraSettings);
  controller.setMultiplier(speed);
  let point=[0,0],manualYaw=0,now=0,characterHeading=0;
  const dt=1/fps;
  const samples=[];
  for(const {seconds,axes:[right,forward],drag} of sequence){
    const start=point;
    let expected=[0,0];
    const samplesBefore=samples.length;
    for(let frame=0;frame<Math.round(seconds*fps);frame++){
      now+=dt*1000;
      if(drag&&frame===0){camera.manualInput(now,drag);manualYaw+=drag;}
      const previous=camera.offset;
      const movementReferenceYaw=camera.referenceYaw(right,forward,manualYaw+previous);
      const movementDirection=[right*Math.cos(movementReferenceYaw)-forward*Math.sin(movementReferenceYaw),
        -right*Math.sin(movementReferenceYaw)-forward*Math.cos(movementReferenceYaw)];
      const scale=controller.configuredSpeed()*dt/Math.max(1,Math.hypot(right,forward));
      const motion=controller.move(point,{right,forward,yaw:movementReferenceYaw,dt,canWalk:()=>true});
      expected=expected.map((value,i)=>value+movementDirection[i]*scale);
      point=motion.position;
      if(motion.heading!==null)characterHeading+=angleDelta(characterHeading,motion.heading)*-Math.expm1(-dt*9);
      camera.update({now,dt,manualYaw,right,forward,heading:motion.heading});
      assert.ok(Math.abs(angleDelta(previous,camera.offset))<=120*Math.PI/180*dt+1e-8);
      samples.push({offset:camera.offset,reference:movementReferenceYaw,characterHeading});
    }
    for(let axis=0;axis<2;axis++)close(point[axis]-start[axis],expected[axis]);
    if(right||forward){
      const gesture=samples.slice(samplesBefore);
      for(const frame of gesture)close(angleDelta(gesture[0].reference,frame.reference),0);
    }
  }
  return {samples,point};
}

for(const speed of [1,3])test(`steady and alternating movement at ${speed}×, 30/60/144 Hz`,()=>{
  for(const fps of [30,60,144]){
    for(const [axes,seconds] of [[[0,1],10],[[-1,0],5],[[1,1],5],[[0,-1],1]]){
      const {point,samples}=simulate(fps,speed,[{seconds,axes}]);
      const distance=5.1*speed*seconds,scale=distance/Math.hypot(...axes);
      close(point[0],axes[0]*scale);
      close(point[1],-axes[1]*scale);
      close(samples[Math.floor(.25*fps)].offset,0);
      if(!axes[0])close(samples.at(-1).offset,0);
      else assert.ok(Math.abs(samples.at(-1).offset)>.7);
    }
    const {point}=simulate(fps,speed,[{seconds:1,axes:[-1,1]},{seconds:1,axes:[1,1]}]);
    close(point[0],0);close(point[1],-2*5.1*speed/Math.SQRT2);
  }
});

test('manual priority steers held reference, resumes after inactivity and stays still when stopped',()=>{
  const {samples}=simulate(60,1,[{seconds:1,axes:[-1,0]},{seconds:2,axes:[-1,0],drag:.6},
    {seconds:2,axes:[0,0]},{seconds:.25,axes:[0,1]}]);
  close(angleDelta(samples[59].reference,samples[60].reference),.6);
  close(samples[60].offset,samples[147].offset);
  assert.ok(Math.abs(angleDelta(samples[147].offset,samples[179].offset))>.1);
  close(samples[179].offset,samples[299].offset);
  close(angleDelta(samples[300].reference,.6+samples[299].offset),0);
});

test('angular follow uses the short arc and composes across frame rates',()=>{
  const rates=[30,60,144].map(fps=>{
    const c=new CameraFollow(cameraSettings);
    const start=179*Math.PI/180;
    for(let i=0;i<fps;i++)c.update({heading:-start,manualYaw:start,dt:1/fps,now:i,forward:1,right:0});
    assert.ok(c.offset>0&&c.offset<Math.PI/45);
    return c.offset;
  });
  close(rates[0],rates[1]);close(rates[1],rates[2]);
  const limited=[30,144].map(fps=>simulate(fps,1,[{seconds:1,axes:[-1,0]}]).samples.at(-1).offset);
  close(limited[0],limited[1]);
});

test('analog dead zone and diagonal magnitude remain stable while the camera turns',()=>{
  assert.deepEqual(joystickAxes(2,2),[0,0]);
  const full=joystickAxes(38,0);
  close(full[0],1);close(full[1],0);
  const axes=joystickAxes(15,-20),seconds=5;
  for(const speed of [1,3]){
    const {point,samples}=simulate(60,speed,[{seconds,axes}]);
    close(point[0],axes[0]*5.1*speed*seconds);
    close(point[1],-axes[1]*5.1*speed*seconds);
    assert.ok(samples.at(-1).offset<-.5);
  }
});
