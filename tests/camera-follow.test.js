import assert from 'node:assert/strict';
import test from 'node:test';
import {advanceCameraYaw,allowsRecenter,angleDelta} from '../src/camera-follow.js';
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
