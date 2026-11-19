// Yaw is the azimuth from the avatar to the camera. At this azimuth the
// camera sits behind an avatar facing along the same yaw.
export function angularDelta(from,to){
  return Math.atan2(Math.sin(to-from),Math.cos(to-from));
}

export function dampAngle(from,to,rate,dt){
  const next=from+angularDelta(from,to)*-Math.expm1(-rate*dt);
  return angularDelta(0,next);
}

export class CameraFollow {
  constructor(settings){
    this.settings=settings;
    this.reset();
  }

  reset(){
    this.moveBasis=null;
    this.lastManualMs=-Infinity;
  }

  movementYaw(right,forward,viewYaw){
    if(right===0&&forward===0)this.moveBasis=null;
    else if(this.moveBasis===null)this.moveBasis=viewYaw;
    return this.moveBasis??viewYaw;
  }

  noteManual(now,yawDelta){
    this.lastManualMs=now;
    // A held input keeps its world bearing through automatic orbit changes.
    // A deliberate manual yaw change is the only way to steer that basis.
    if(this.moveBasis!==null)this.moveBasis=angularDelta(0,this.moveBasis+yawDelta);
  }

  isManual(now){
    return now-this.lastManualMs<this.settings.manualOverrideDelay*1000;
  }

  updateYaw(viewYaw,{right,forward,movementHeading,bodyYaw,now,dt}){
    const backingUp=forward<0&&-forward>Math.abs(right);
    if(!this.settings.autoFollowEnabled||this.isManual(now)||backingUp||
      !Number.isFinite(movementHeading))return viewYaw;
    return dampAngle(viewYaw,bodyYaw,this.settings.followSmoothness,dt);
  }
}
