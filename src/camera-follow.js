export const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));

export function advanceCameraYaw(yaw,target,dt,{rate,maxSpeed=Infinity}){
  const error=angleDelta(yaw,target);
  const step=Math.min(Math.abs(error)*-Math.expm1(-rate*dt),maxSpeed*dt);
  return angleDelta(0,yaw+Math.sign(error)*step);
}

export function allowsRecenter(right){
  return Math.abs(right)<.08;
}
