import * as THREE from 'three';
import {PlayerController} from '../../src/player-controller.js';
import {frameTiming,resolveCamera} from '../../src/movement.js';
import {avoidVegetation,recoverCameraArm} from '../../src/park-camera.js';
import {cameraSettings} from '../../src/visual-settings.js';

export const motionDurationMs=20000;

export function frameStatistics(intervals){
  const sorted=[...intervals].sort((a,b)=>a-b);
  const mean=intervals.reduce((sum,ms)=>sum+ms,0)/intervals.length;
  const percentile=p=>sorted[Math.ceil(sorted.length*p)-1]??null;
  return {fps:mean>0?1000/mean:null,frameTimeMeanMs:mean,frameTimeP50Ms:percentile(.5),
    frameTimeP95Ms:percentile(.95),samples:intervals.length};
}

function summarize(values){
  return {mean:values.reduce((total,value)=>total+value,0)/values.length,min:Math.min(...values),max:Math.max(...values)};
}

export async function benchmarkMotion({active,avatar,camera,render,renderInfo,route}){
  if(route?.status!=='passed')throw new Error('Rota OSM indisponível para o benchmark.');
  const {spawn,stats}=active;
  const controller=new PlayerController();
  const start=[...spawn];
  const points=route.points;
  let position=start,waypoint=1,distanceMeters=0,blockedFrames=0;
  let yaw=Math.PI,arm=1,elapsed=0;
  const focus=new THREE.Vector3(),orbit=new THREE.Vector3(),offset=new THREE.Vector3();
  const intervals=[],calls=[],triangles=[];
  avatar.root.position.set(start[0],0,start[1]);
  avatar.root.rotation.y=yaw;
  const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  let previous=await frame();
  while(elapsed<motionDurationMs){
    const now=await frame();
    const {real,simulation:dt}=frameTiming(now,previous);
    previous=now;
    if(real<=0)continue;
    elapsed+=real*1000;
    const target=points[waypoint];
    if(target){
      const dx=target[0]-position[0],dz=target[1]-position[1],remaining=Math.hypot(dx,dz);
      if(remaining<.015)waypoint++;
      else{
        yaw=Math.atan2(-dx,-dz);
        const motion=controller.move(position,{right:0,forward:1,yaw,running:false,
          dt:Math.min(dt,remaining/controller.configuredSpeed()),canWalk:stats.canWalk});
        const advanced=Math.hypot(motion.position[0]-position[0],motion.position[1]-position[1]);
        position=motion.position;
        distanceMeters+=advanced;
        if(advanced===0)blockedFrames++;
        if(!stats.canWalk(...position))throw new Error('Posição inválida durante o percurso.');
        avatar.root.position.set(position[0],0,position[1]);
        if(motion.heading!==null)avatar.root.rotation.y+=Math.atan2(
          Math.sin(motion.heading-avatar.root.rotation.y),Math.cos(motion.heading-avatar.root.rotation.y))*(1-Math.exp(-dt*9));
        avatar.update(dt,motion.animationSpeed);
      }
    }
    focus.set(position[0],1.48,position[1]);
    const horizontal=cameraSettings.distance*Math.cos(cameraSettings.pitch);
    offset.set(Math.sin(yaw)*horizontal,cameraSettings.distance*Math.sin(cameraSettings.pitch),Math.cos(yaw)*horizontal);
    orbit.copy(focus).add(offset);
    const anchor=focus.toArray();
    const clear=resolveCamera(anchor,orbit.toArray(),stats.cameraObstacles);
    const safe=avoidVegetation(anchor,clear,stats.cameraVolumes);
    const limit=Math.min(1,Math.hypot(...safe.map((value,i)=>value-anchor[i]))/cameraSettings.distance);
    arm=recoverCameraArm(arm,limit,dt,cameraSettings.clearanceRecovery);
    camera.position.copy(focus).addScaledVector(offset,arm);
    camera.lookAt(focus);
    stats.setDetailFocus?.(camera.position.x,camera.position.z);
    render();
    intervals.push(real*1000);calls.push(renderInfo.calls);triangles.push(renderInfo.triangles);
  }
  return {status:blockedFrames||distanceMeters<30||waypoint>=points.length?'failed':'passed',
    routeWayId:route.routeWayId,start,end:position,requestedDurationMs:motionDurationMs,durationMs:elapsed,
    speedMultiplier:controller.multiplier,distanceMeters,blockedFrames,...frameStatistics(intervals),
    drawCalls:summarize(calls),triangles:summarize(triangles),
    method:'Percurso OSM seguido pelo PlayerController com colisões, animação e renderização a cada frame. Intervalos brutos de requestAnimationFrame.'};
}
