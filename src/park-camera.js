import {resolveCamera} from './movement.js';

function ellipsoidHit(anchor,direction,center,radii,margin,includeAnchor=false){
  let a=0,b=0,c=-1;
  for(let i=0;i<3;i++){
    const radius=radii[i]+margin,offset=(anchor[i]-center[i])/radius,step=direction[i]/radius;
    a+=step*step;b+=offset*step;c+=offset*offset;
  }
  if(c<=0)return includeAnchor?0:Infinity;
  if(b>=0||a===0)return Infinity;
  const discriminant=b*b-a*c;
  return discriminant<0?Infinity:(-b-Math.sqrt(discriminant))/a;
}

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
    const hit=ellipsoidHit(anchor,direction,center,radii,.2);
    if(hit>0 && hit<fraction)fraction=Math.max(hit*.5,hit-.15/distance);
  }
  return fraction===1?desired:anchor.map((value,i)=>value+direction[i]*fraction);
}

// Keep the nearer safety limit immediately, then ease back toward the framing
// selected by the player when the obstruction clears.
export function recoverCameraArm(previous,limit,dt,rate){
  return Math.min(limit,previous+(limit-previous)*(1-Math.exp(-rate*dt)));
}

// Keep yaw independent of obstruction handling. When a wall leaves too little
// room for the body, raise the orbit on the same bearing instead of zooming in.
export function resolveGameplayCamera(anchor,view,stats,previous,dt,settings){
  const {yaw,pitch,distance}=view;
  const {minimumBodyDistance:minimum,clearanceRecovery:rate}=settings;
  const blend=-Math.expm1(-rate*dt);
  const sinYaw=Math.sin(yaw),cosYaw=Math.cos(yaw);
  const at=(angle,length=distance)=>{
    const horizontal=length*Math.cos(angle);
    return [anchor[0]+sinYaw*horizontal,anchor[1]+length*Math.sin(angle),anchor[2]+cosYaw*horizontal];
  };
  const feet=[anchor[0],stats.terrain?anchor[1]-1.33:.15,anchor[2]];
  const lowerTrace={};
  const length=(from,to)=>Math.hypot(to[0]-from[0],to[1]-from[1],to[2]-from[2]);
  const sweep=(angle,radius=.22,trace={})=>{
    const desired=at(angle);
    const safe=resolveCamera(anchor,desired,stats.cameraObstacles,radius,trace,stats.terrain);
    const arm=trace.obstacle?length(anchor,safe):distance;
    // In steep views, the pivot may see above a roof while the legs are
    // still blocked. Shorten the boom conservatively along that lower ray.
    const lowerSafe=resolveCamera(feet,desired,stats.cameraObstacles,.08,lowerTrace,stats.terrain);
    if(!lowerTrace.obstacle)return arm;
    if(!trace.obstacle)trace.obstacle=lowerTrace.obstacle;
    return Math.min(arm,distance*length(feet,lowerSafe)/length(feet,desired));
  };
  const trace={};
  const normal=sweep(pitch,.22,trace);
  const solid=trace.obstacle;
  const framing=Math.min(minimum,distance);
  const overhead=Math.PI/2-.015;
  const firstSafePitch=(low,radius,required)=>{
    if(sweep(overhead,radius)<required)return overhead;
    let high=overhead;
    for(let i=0;i<11;i++){
      const mid=(low+high)*.5;
      if(sweep(mid,radius)>=required)high=mid;
      else low=mid;
    }
    return high;
  };
  // A wider probe leaves room to interpolate before the hard limit. The
  // player's anchor is outside that radius even when standing against a wall.
  const soft=sweep(pitch,.33);
  const reserve=Math.min(framing+.45,distance);
  const goalPitch=soft+1e-6>=reserve?pitch:firstSafePitch(pitch,.33,reserve);
  const defaultPitch=previous?.pitch??pitch;
  let resolvedPitch=Math.max(pitch,defaultPitch+(goalPitch-defaultPitch)*blend);
  let limit=resolvedPitch===pitch?normal:sweep(resolvedPitch);
  if(limit+1e-6<framing){
    resolvedPitch=firstSafePitch(resolvedPitch,.22,framing);
    limit=sweep(resolvedPitch);
  }
  const goalDistance=Math.min(limit,Math.max(framing,soft));
  const lastDistance=previous?.distance??distance;
  const realDistance=Math.min(limit,Math.max(framing,lastDistance+(goalDistance-lastDistance)*blend));
  const position=at(resolvedPitch,realDistance);

  const direction=position.map((value,i)=>value-anchor[i]),hidden=new Set();
  const lowerRay=[direction[0],position[1]-feet[1],direction[2]];
  const minX=Math.min(anchor[0],position[0]),maxX=Math.max(anchor[0],position[0]);
  const minZ=Math.min(anchor[2],position[2]),maxZ=Math.max(anchor[2],position[2]);
  for(const {id,kind,center,radii} of stats.cameraVolumes){
    if(center[0]+radii[0]+.32<minX||center[0]-radii[0]-.32>maxX||
      center[2]+radii[2]+.32<minZ||center[2]-radii[2]-.32>maxZ)continue;
    if(kind!=='tree'||hidden.has(id))continue;
    const margin=previous?.hidden.has(id) ? .32 : .18;
    // Include the path to the lower body so trunks do not hide the legs.
    if(ellipsoidHit(anchor,direction,center,radii,margin,true)<=1||
      ellipsoidHit(feet,lowerRay,center,radii,margin,true)<=1)hidden.add(id);
  }
  stats.setCameraOccluders?.(hidden);

  return {position,pitch:resolvedPitch,distance:realDistance,hidden,diagnostics:{
    desiredDistance:distance,actualDistance:realDistance,
    obstacle:solid?{kind:solid.kind??'furniture',id:solid.id??null}:null,
    hiddenTrees:[...hidden],state:solid?'solid-limited':hidden.size?'vegetation-hidden':
      (Math.abs(realDistance-distance)>.01||Math.abs(resolvedPitch-pitch)>.01)?'recovering':'clear',
    distanceDelta:realDistance-lastDistance,excessiveProximity:realDistance+1e-6<framing,
  }};
}
