// Intersect the view segment with the same ellipsoids used to approximate tree
// crowns and trunks. Only volumes near the view can shorten the camera arm.
export function avoidVegetation(anchor,desired,volumes){
  let fraction=1;
  const direction=desired.map((value,i)=>value-anchor[i]);
  const distance=Math.hypot(...direction);
  if(distance===0)return desired;
  const min=anchor.map((value,i)=>Math.min(value,desired[i])-.2);
  const max=anchor.map((value,i)=>Math.max(value,desired[i])+.2);
  for(const {center,radii} of volumes){
    if(center[0]<min[0]-radii[0]||center[0]>max[0]+radii[0]||
       center[2]<min[2]-radii[2]||center[2]>max[2]+radii[2]||
       center[1]<min[1]-radii[1]||center[1]>max[1]+radii[1])continue;
    let a=0,b=0,c=-1;
    for(let i=0;i<3;i++){
      const radius=radii[i]+.2,offset=(anchor[i]-center[i])/radius,step=direction[i]/radius;
      a+=step*step;b+=offset*step;c+=offset*offset;
    }
    // A decorative canopy can overlap the player's free movement space.
    // Ignore a volume containing the anchor so the camera never collapses to it.
    if(c<=0 || b>=0)continue;
    const discriminant=b*b-a*c;
    if(discriminant<0)continue;
    const hit=(-b-Math.sqrt(discriminant))/a;
    if(hit>0 && hit<fraction)fraction=Math.max(hit*.5,hit-.15/distance);
  }
  return fraction===1?desired:anchor.map((value,i)=>value+direction[i]*fraction);
}

// Keep the nearer safety limit immediately, then ease back toward the framing
// selected by the player when the obstruction clears.
export function recoverCameraArm(previous,limit,dt,rate){
  return Math.min(limit,previous+(limit-previous)*(1-Math.exp(-rate*dt)));
}
