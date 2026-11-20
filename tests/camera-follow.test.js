import assert from 'node:assert/strict';
import test from 'node:test';
import {advanceCameraYaw,allowsRecenter,angleDelta,CameraRecentering} from '../src/camera-follow.js';
import {joystickAxes} from '../src/controls.js';
import {PlayerController} from '../src/player-controller.js';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

// Independent projections onto the view plane. A straight world trajectory
// alone would miss the v2 failure, which occurred as the view turned.
function verify(axes,frameTimes,{manual=false,speed=1}={}){
  const player=new PlayerController();
  player.setMultiplier(speed);
  const norm=Math.max(1,Math.hypot(...axes));
  const [lateral,forward]=axes.map(axis=>axis/norm*5.1*speed);
  let time=0,position=[0,0],yaw=.8,heading=0,frame=0;
  while(time<10-1e-10){
    const dt=Math.min(10-time,frameTimes[frame++%frameTimes.length]);
    yaw=advanceCameraYaw(yaw,manual&&time>=4?-1.2:.8,dt,{rate:11});
    const motion=player.move(position,{right:axes[0],forward:axes[1],yaw,dt,canWalk:()=>true});
    const [dx,dz]=motion.position.map((value,i)=>(value-position[i])/dt);
    close(dx*Math.cos(yaw)-dz*Math.sin(yaw),lateral);
    close(-dx*Math.sin(yaw)-dz*Math.cos(yaw),forward);
    heading=advanceCameraYaw(heading,motion.heading,dt,{rate:9});
    position=motion.position;
    time+=dt;
  }
  if(!manual)close(yaw,.8);
  else close(yaw,-1.2);
  close(angleDelta(heading,yaw+Math.atan2(-axes[0],axes[1])),0);
}

for(const fps of [30,60,120]){
  test(`10 s: lateral keyboard and analog input stay lateral at ${fps} Hz`,()=>{
    for(const axes of [[1,0],[-1,0],[1,1],[-1,1],[0,-1],joystickAxes(38,0),joystickAxes(19,-19)])
      verify(axes,[1/fps]);
  });
}
test('manual drag keeps controls relative to the evolving view with uneven frames',()=>{
  for(const axes of [[1,0],[1,1],joystickAxes(18,-23)])
    verify(axes,[.008,.026,.013,.041],{manual:true,speed:3});
});

test('explicit recenter uses the short arc, caps each turn and is blocked by lateral input',()=>{
  const from=179*Math.PI/180,to=-from;
  const next=advanceCameraYaw(from,to,.08,{rate:5,maxSpeed:.1});
  close(angleDelta(from,next),.008);
  assert.equal(allowsRecenter(1),false);
  assert.equal(allowsRecenter(-.7),false);
  assert.equal(allowsRecenter(.01),true);
});


test('stable recenter is explicit, can be canceled and leaves held lateral input alone',()=>{
  const state=new CameraRecentering('stable');
  const stopped={right:0,forward:0,heading:1,yaw:0,dt:.05};
  assert.equal(state.update(stopped),null);
  state.request(1,1);
  assert.equal(state.update({...stopped,right:1}),null);
  state.request(0,1);
  assert.ok(state.update(stopped)>0);
  state.cancel();
  assert.equal(state.update(stopped),null);
  state.update({...stopped,right:1});
  for(let i=0;i<10;i++)assert.equal(state.update(stopped),null);
});

test('assisted waits for all movement to stop and recenters once after releasing the stick',()=>{
  const state=new CameraRecentering('stable');
  const stopped={right:0,forward:0,heading:1,yaw:0,dt:.05};
  state.setMode('assisted');
  assert.equal(state.update(stopped),null);
  state.update({...stopped,right:1,forward:1});
  for(let i=0;i<20;i++)assert.equal(state.update({...stopped,forward:1}),null);
  for(let i=0;i<4;i++)assert.equal(state.update(stopped),null);
  assert.ok(state.update(stopped)>0);
  let yaw=0;
  for(let i=0;i<100;i++)yaw=state.update({...stopped,yaw})??yaw;
  assert.ok(Math.abs(angleDelta(yaw,1))<.002);
  assert.equal(state.update({...stopped,yaw}),null);
  state.setMode('stable');
  state.update({...stopped,right:1});
  assert.equal(state.update(stopped),null);
});

test('recenter timing is consistent across frame rates',()=>{
  const outcomes=[30,60,120].map(fps=>{
    let yaw=0;
    for(let i=0;i<fps;i++)yaw=advanceCameraYaw(yaw,2.6,1/fps,{rate:5,maxSpeed:Math.PI*2/3});
    return yaw;
  });
  close(outcomes[0],outcomes[1]);close(outcomes[1],outcomes[2]);
});
