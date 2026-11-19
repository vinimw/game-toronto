export const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
const wrap=angle=>angleDelta(0,angle);

// Integrate exponential damping with a constant-speed approach outside the
// damping range. Both parts compose consistently across frame intervals.
function followStep(error,dt,smoothTime,maxSpeed){
  const distance=Math.abs(error),range=maxSpeed*smoothTime;
  const linearTime=Math.max(0,(distance-range)/maxSpeed);
  const linearStep=Math.min(dt,linearTime)*maxSpeed;
  const dampedStep=(distance-linearStep)*-Math.expm1(-Math.max(0,dt-linearTime)/smoothTime);
  return Math.sign(error)*(linearStep+dampedStep);
}

export class CameraFollow {
  constructor(settings){
    this.settings=settings;
    this.reset();
  }

  reset(){
    this.offset=0;
    this.movementReferenceYaw=null;
    this.manualUntil=-Infinity;
    this.heading=null;
    this.stableTime=0;
  }

  referenceYaw(right,forward,cameraYaw){
    if(!right&&!forward)this.movementReferenceYaw=null;
    else if(this.movementReferenceYaw===null)this.movementReferenceYaw=cameraYaw;
    return this.movementReferenceYaw??cameraYaw;
  }

  manualInput(now,yawDelta){
    this.manualUntil=now+this.settings.manualOverrideDelay*1000;
    if(this.movementReferenceYaw!==null)
      this.movementReferenceYaw=wrap(this.movementReferenceYaw+yawDelta);
  }

  update({now,dt,manualYaw,right,forward,heading}){
    const reversing=forward<0&&-forward>Math.abs(right);
    if(!this.settings.autoFollowEnabled||!Number.isFinite(heading)||reversing){
      this.heading=null;
      this.stableTime=0;
      return;
    }
    // Restart the short delay after a substantial change of direction.
    if(this.heading===null||Math.abs(angleDelta(this.heading,heading))>Math.PI/8){
      this.heading=heading;
      this.stableTime=0;
    }
    const {followDelay,followSmoothTime,maxFollowTurnSpeed}=this.settings;
    const before=this.stableTime;
    this.stableTime+=dt;
    const readyTime=Math.max(0,this.stableTime-Math.max(before,followDelay));
    const followTime=Math.min(readyTime,Math.max(0,(now-this.manualUntil)/1000));
    const error=angleDelta(manualYaw+this.offset,heading);
    const step=followStep(error,followTime,followSmoothTime,maxFollowTurnSpeed*Math.PI/180);
    this.offset=wrap(this.offset+step);
  }
}
