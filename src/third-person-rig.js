import {advanceCameraYaw,angleDelta} from './camera-follow.js';
import {normalizeMoveInput} from './movement.js';
import {cameraSettings} from './visual-settings.js';

export const coupledRigSettings={turnRate:Math.PI*2/3,cameraHalfLife:.12};

// Right is a steering rate. Stick magnitude is throttle, including a pure
// sideways command; only negative forward input reverses the drive.
export class ThirdPersonRig {
  constructor(heading=0,{turnRate,cameraHalfLife}=coupledRigSettings){
    this.turnRate=turnRate;
    this.cameraRate=Math.LN2/cameraHalfLife;
    this.reset(heading);
  }
  reset(heading){
    this.heading=heading;
    this.manual=false;
    this.pendingManual=false;
  }
  orbitManually(){
    this.manual=true;
    this.pendingManual=true;
  }
  align(){
    this.manual=false;
    this.pendingManual=false;
  }

  step({right,forward,dt,yaw,manualYaw,dragging=false}){
    const [steer,drive]=normalizeMoveInput(right,forward);
    const throttle=Math.hypot(steer,drive);
    const turn=-steer*this.turnRate*dt;
    const midHeading=this.heading+turn/2;
    this.heading=angleDelta(0,this.heading+turn);
    // Midpoint direction with the average speed of the arc's chord makes
    // held steering produce the same world path across simulation rates.
    const chordScale=turn===0?1:Math.sin(turn/2)/(turn/2);
    const move={right:0,forward:(drive<0?-1:1)*Math.min(1,throttle)*chordScale,yaw:midHeading};
    const manual=dragging||this.pendingManual||this.manual&&throttle===0;
    this.pendingManual=false;
    if(!manual)this.align();
    const targetYaw=manual?manualYaw:this.heading;
    const cameraYaw=advanceCameraYaw(yaw,targetYaw,dt,{rate:manual?cameraSettings.orbit:this.cameraRate});
    return {move,cameraYaw,targetYaw,locomotionHeading:this.heading,manual};
  }
}
