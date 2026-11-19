import assert from 'node:assert/strict';
import test from 'node:test';
import {CameraFollow,angularDelta,dampAngle} from '../src/camera-follow.js';
import {cameraSettings} from '../src/visual-settings.js';
import {PlayerController} from '../src/player-controller.js';

const radians=degrees=>degrees*Math.PI/180;
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
const walking={right:1,forward:0,movementHeading:-Math.PI/2,bodyYaw:-Math.PI/2,now:3000,dt:1/60};

test('angular damping crosses the wrap by the shortest arc and is frame-rate independent',()=>{
  const start=radians(179),end=radians(-179);
  near(angularDelta(start,end),radians(2));
  near(angularDelta(end,start),radians(-2));
  const at=hz=>{
    let yaw=start;
    for(let frame=0;frame<hz;frame++)yaw=dampAngle(yaw,end,4.2,1/hz);
    return yaw;
  };
  assert.ok(angularDelta(start,at(30))>0);
  near(at(30),at(144));
  near(at(60),dampAngle(start,end,4.2,1));
});

test('held lateral and diagonal input keeps its bearing at 1× and 5× as the orbit turns',()=>{
  for(const speed of [1,5])for(const [right,forward] of [[-1,0],[1,0],[1,1]]){
    const camera=new CameraFollow(cameraSettings),player=new PlayerController();
    player.setMultiplier(speed);
    let position=[0,0],body=0,yaw=0,dt=1/60;
    for(let frame=0;frame<=60;frame++){
      const motion=player.move(position,{right,forward,yaw:camera.movementYaw(right,forward,yaw),dt,canWalk:()=>true});
      position=motion.position;
      body=dampAngle(body,motion.heading,cameraSettings.rotationSmoothness,dt);
      yaw=camera.updateYaw(yaw,{right,forward,movementHeading:motion.heading,bodyYaw:body,now:frame*1000*dt,dt});
    }
    assert.ok(Math.abs(yaw)>.55);
    const distance=player.configuredSpeed()*dt*61/Math.hypot(right,forward);
    near(position[0],right*distance);
    near(position[1],-forward*distance);
    // The next gesture samples the updated perspective.
    camera.movementYaw(0,0,yaw);
    near(camera.movementYaw(0,1,yaw),yaw);
  }
});

test('manual steering rotates the held basis and delays follow from the most recent gesture',()=>{
  const camera=new CameraFollow(cameraSettings);
  camera.movementYaw(1,0,radians(179));
  camera.noteManual(1000,radians(4));
  near(camera.movementYaw(1,0,2),radians(-177));
  camera.noteManual(1200,0);
  const manualYaw=radians(-177);
  near(camera.updateYaw(manualYaw,{...walking,now:2699}),manualYaw);
  const resumed=camera.updateYaw(manualYaw,{...walking,now:2700});
  assert.ok(angularDelta(manualYaw,resumed)>0);
  assert.ok(angularDelta(manualYaw,resumed)<radians(8));
  near(camera.updateYaw(manualYaw,{...walking,now:3000,movementHeading:null}),manualYaw);
  camera.reset();
  assert.equal(camera.isManual(1300),false);
  near(camera.movementYaw(0,1,0.8),0.8);
});

test('backpedaling, blocked movement and disabled follow keep the view bearing',()=>{
  const camera=new CameraFollow(cameraSettings);
  const reverse={...walking,right:0,forward:-1,movementHeading:Math.PI,bodyYaw:Math.PI};
  near(camera.updateYaw(0,reverse),0);
  near(camera.updateYaw(0,{...walking,movementHeading:null}),0);
  near(new CameraFollow({...cameraSettings,autoFollowEnabled:false}).updateYaw(0,walking),0);
});

test('follow aims behind the actual direction of a collision slide',()=>{
  const camera=new CameraFollow(cameraSettings),player=new PlayerController();
  const motion=player.move([0,0],{right:1,forward:1,yaw:0,dt:1/60,canWalk:x=>x<=0});
  near(motion.position[0],0);
  near(motion.heading,0);
  const yaw=camera.updateYaw(.5,{right:1,forward:1,movementHeading:motion.heading,bodyYaw:motion.heading,now:0,dt:1/60});
  assert.ok(yaw>0&&yaw<.5);
});
