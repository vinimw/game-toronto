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

test('recenter timing is consistent across frame rates',()=>{
  const outcomes=[30,60,120].map(fps=>{
    let yaw=0;
    for(let i=0;i<fps;i++)yaw=advanceCameraYaw(yaw,2.6,1/fps,{rate:5,maxSpeed:Math.PI*2/3});
    return yaw;
  });
  close(outcomes[0],outcomes[1]);close(outcomes[1],outcomes[2]);
});

function automatic(speed=1,yaw=0,settings={}){
  const follow=new CameraRecentering('assisted-auto',settings);
  const player=new PlayerController();
  player.setMultiplier(speed);
  let position=[0,0],body=yaw;
  return {
    follow,
    get yaw(){return yaw;},
    drag(next){follow.manualInput();yaw=next;},
    step(right,forward,dt=1/60){
      const commandYaw=follow.movementYaw({right,forward,yaw});
      const move=player.move(position,{right,forward,yaw:commandYaw,dt,canWalk:()=>true});
      const delta=move.position.map((value,i)=>value-position[i]);
      position=move.position;
      yaw=follow.update({right,forward,heading:body,movementHeading:move.heading,yaw,dt})??yaw;
      if(move.heading!==null)body=advanceCameraYaw(body,move.heading,dt,{rate:9});
      return {delta,commandYaw,body};
    },
  };
}

for(const fps of [30,60,120]){
  test(`assisted-auto: four sustained inputs preserve lateral motion and bounded yaw for 10 s at ${fps} Hz`,()=>{
    for(const speed of [1,3])for(const [right,forward] of [[1,0],[1,1],joystickAxes(38,0),joystickAxes(27,-27)]){
      const sim=automatic(speed,.8), dt=1/fps;
      const scale=5.1*speed*dt/Math.max(1,Math.hypot(right,forward));
      for(let i=0;i<fps*10;i++){
        const {delta,commandYaw}=sim.step(right,forward,dt);
        close(commandYaw,.8);
        close(delta[0],scale*(right*Math.cos(.8)-forward*Math.sin(.8)));
        close(delta[1],scale*(-right*Math.sin(.8)-forward*Math.cos(.8)));
        assert.ok(Math.abs(angleDelta(.8,sim.yaw))<=Math.PI/12+1e-9);
        assert.ok((delta[0]*Math.cos(sim.yaw)-delta[1]*Math.sin(sim.yaw))/scale>.48);
      }
      close(angleDelta(.8,sim.yaw),-Math.PI/12);
    }
  });
}

test('releasing lateral input at idle delays and then completes the shortest automatic turn',()=>{
  const sim=automatic(1,-3);
  const stick=joystickAxes(-38,0);
  for(let i=0;i<60;i++)sim.step(...stick);
  const previous=sim.yaw;
  for(let i=0;i<24;i++){
    close(sim.step(0,0).delta[0],0);
    close(sim.yaw,previous);
  }
  let last=sim.yaw;
  for(let i=0;i<180;i++){
    sim.step(0,0);
    assert.ok(angleDelta(last,sim.yaw)>=-1e-9);
    last=sim.yaw;
  }
  close(angleDelta(sim.yaw,-3+Math.PI/2),0);
  assert.equal(sim.follow.rotation.outcome,'completed');
  const next=sim.step(0,1);
  close(next.commandYaw,sim.yaw);
  close(next.delta[0],-Math.sin(sim.yaw)*5.1/60);
  close(next.delta[1],-Math.cos(sim.yaw)*5.1/60);
});

test('W held through release and rapid W → W+D → W never inherits the automatic yaw',()=>{
  const sim=automatic(3);
  for(let i=0;i<140;i++){
    const lateral=i<65||i%8<2&&i<100?1:0;
    const step=sim.step(lateral,1);
    close(step.commandYaw,0);
    close(step.delta[0],lateral*15.3/60/(lateral?Math.SQRT2:1));
    close(step.delta[1],-15.3/60/(lateral?Math.SQRT2:1));
  }
  for(let i=0;i<120;i++)sim.step(0,1);
  close(sim.yaw,0);
});

test('manual drag interrupts automatic turning and defers it for 1.5 s after the last delta',()=>{
  const sim=automatic();
  for(let i=0;i<60;i++)sim.step(1,0);
  for(let i=0;i<35;i++)sim.step(0,0);
  assert.equal(sim.follow.rotation.kind,'automatic');
  sim.drag(.6);
  assert.equal(sim.follow.rotation.outcome,'interrupted');
  for(let i=0;i<60;i++)sim.step(0,0);
  sim.drag(.8);
  for(let i=0;i<90;i++){
    sim.step(0,0);
    close(sim.yaw,.8);
  }
  for(let i=0;i<200;i++)sim.step(0,0);
  close(sim.yaw,-Math.PI/2);
  assert.equal(sim.follow.rotation.outcome,'completed');
});

test('fallback and automatic-disabled settings leave angular control to the player',()=>{
  const sim=automatic(1,0,{autoRecenterEnabled:false});
  for(let i=0;i<60;i++)sim.step(1,0);
  for(let i=0;i<120;i++)sim.step(0,0);
  close(sim.yaw,0);
  sim.follow.setMode('stable');
  close(sim.step(1,0).commandYaw,0);
  sim.follow.request(0,1);
  sim.step(0,0);
  assert.ok(sim.yaw>0);
});
