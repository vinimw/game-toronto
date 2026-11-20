import {cameraSettings} from './visual-settings.js';

export const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));

export function advanceCameraYaw(yaw,target,dt,{rate,maxSpeed=Infinity}){
  const error=angleDelta(yaw,target),distance=Math.abs(error);
  const linearTime=Number.isFinite(maxSpeed)?Math.max(0,(distance-maxSpeed/rate)/maxSpeed):0;
  const linearStep=linearTime?Math.min(dt,linearTime)*maxSpeed:0;
  const dampedStep=(distance-linearStep)*-Math.expm1(-rate*Math.max(0,dt-linearTime));
  return angleDelta(0,yaw+Math.sign(error)*(linearStep+dampedStep));
}

export function allowsRecenter(right){
  return Math.abs(right)<.08;
}

const alignmentTolerance=.002;

export class CameraRecentering {
  constructor(mode,settings={}){
    this.settings={...cameraSettings,...settings};
    this.setMode(mode);
  }
  setMode(mode){
    this.mode=mode;
    this.reset();
  }
  reset(){
    this.commandReference=null;
    this.lateralOrigin=null;
    this.heading=null;
    this.readyAt=0;
    this.manualUntil=0;
    this.clock=0;
    this.rotation=null;
    this.sequence=0;
    this.target=null;
    this.phase=this.mode==='stable'?'stable':'aligned';
  }
  finish(outcome){
    if(this.target!==null&&this.rotation){
      this.rotation={...this.rotation,outcome,endedAtSeconds:this.clock};
    }
    this.target=null;
  }
  cancel(){
    this.finish('interrupted');
  }
  manualInput(){
    this.cancel();
    this.manualUntil=this.clock+this.settings.manualOverrideDelay;
    this.phase='manual-override';
  }
  request(right,heading){
    if(!allowsRecenter(right))return;
    this.cancel();
    this.target=heading;
    this.rotation={id:++this.sequence,kind:'shortcut',startedAtSeconds:this.clock,targetYaw:heading,
      outcome:'active',endedAtSeconds:null};
  }
  movementYaw({right,forward,yaw}){
    if(this.mode!=='assisted-auto')return yaw;
    if(Math.hypot(right,forward)<.01){
      this.commandReference=null;
      return yaw;
    }
    // A whole steering gesture keeps its world-space basis. Deliberate
    // mouse/touch orbit updates the basis; automatic orbit never feeds it.
    if(this.commandReference===null||this.clock<this.manualUntil)this.commandReference=yaw;
    return this.commandReference;
  }
  turn(yaw,target,kind,dt){
    if(this.target===null&&Math.abs(angleDelta(yaw,target))<alignmentTolerance){
      this.phase=kind==='lateral'?'lateral-limited':'aligned';
      return null;
    }
    if(this.target!==null&&this.rotation.kind!==kind)this.finish('interrupted');
    if(this.target===null){
      this.rotation={id:++this.sequence,kind,startedAtSeconds:this.clock,targetYaw:target,
        outcome:'active',endedAtSeconds:null};
    }else if(this.target!==target)this.rotation={...this.rotation,targetYaw:target};
    this.target=target;
    this.phase=kind==='lateral'?'lateral-limited':kind==='shortcut'?'shortcut':'recentering';
    const next=advanceCameraYaw(yaw,target,dt,{rate:1/this.settings.followSmoothTime,
      maxSpeed:this.settings.maxAngularSpeed});
    if(Math.abs(angleDelta(next,target))<alignmentTolerance){
      this.finish('completed');
      return target;
    }
    return next;
  }
  update({right,forward=0,heading,movementHeading=null,yaw,dt,elapsed=dt}){
    const manual=this.clock<this.manualUntil;
    this.clock+=elapsed;
    this.heading=movementHeading??this.heading??heading;
    const lateral=!allowsRecenter(right);
    if(this.mode==='stable'){
      if(lateral)this.cancel();
      if(this.target!==null)return this.turn(yaw,this.target,'shortcut',dt);
      this.phase=manual?'manual-override':'stable';
      return null;
    }
    if(lateral){
      if(this.lateralOrigin===null||manual)this.lateralOrigin=yaw;
    }else if(this.lateralOrigin!==null){
      this.lateralOrigin=null;
      this.readyAt=this.clock+this.settings.autoRecenterDelay;
      if(this.rotation?.kind==='lateral')this.finish('interrupted');
    }
    if(this.target!==null&&this.rotation?.kind==='shortcut'){
      if(!lateral)return this.turn(yaw,this.target,'shortcut',dt);
      this.cancel();
    }
    if(manual){this.phase='manual-override';return null;}
    if(!this.settings.autoRecenterEnabled){
      this.phase='disabled';
      return null;
    }
    if(lateral){
      const max=this.settings.lateralFollowMaxAngle;
      const offset=angleDelta(this.lateralOrigin,this.heading);
      return this.turn(yaw,this.lateralOrigin+Math.max(-max,Math.min(max,offset)),'lateral',dt);
    }
    if(this.clock<this.readyAt){this.phase='release-delay';return null;}
    // A hold of S should feel like stepping back, without an automatic 180°.
    if(forward<0){this.cancel();this.phase='backward';return null;}
    return this.turn(yaw,this.heading,'automatic',dt);
  }
}
