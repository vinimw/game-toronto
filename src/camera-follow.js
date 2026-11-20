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

export class CameraRecentering {
  constructor(mode){
    this.setMode(mode);
  }
  setMode(mode){
    this.mode=mode;
    this.reset();
  }
  reset(){
    this.wasLateral=false;
    this.cancel();
  }
  cancel(){
    this.target=null;
    this.armed=false;
    this.idleSeconds=0;
  }
  request(right,heading){
    if(!allowsRecenter(right))return;
    this.cancel();
    this.target=heading;
  }
  update({right,forward,heading,yaw,dt}){
    if(!allowsRecenter(right)){
      if(!this.wasLateral){
        this.cancel();
        this.armed=this.mode==='assisted';
      }
      this.wasLateral=true;
      return null;
    }
    this.wasLateral=false;
    if(this.armed){
      // Keep W (and any other held input) stable after releasing D.
      this.idleSeconds=Math.hypot(right,forward)<.01?this.idleSeconds+dt:0;
      if(this.idleSeconds>=.25){
        this.request(right,heading);
      }
    }
    if(this.target===null)return null;
    const next=advanceCameraYaw(yaw,this.target,dt,{rate:5,maxSpeed:Math.PI*2/3});
    if(Math.abs(angleDelta(next,this.target))<.002)this.target=null;
    return next;
  }
}
