import {movePlayer, movementDelta, PLAYER_RADIUS, overlapsPolygon} from '../../src/movement.js';

/** Replay a route over connected OSM segments in actual game collision space. */
export function validateNavigation(active){
  const world=active.world, origin=active.spawn;
  const route=world.features.find(feature=>feature.osmId===174188399&&
    feature.points.some(([x,z])=>Math.hypot(x-origin[0],z-origin[1])<.02));
  if(!route)return {status:'unavailable',reason:'Calçada de referência sem o nó de chegada.'};
  const start=route.points.findIndex(([x,z])=>Math.hypot(x-origin[0],z-origin[1])<.02);
  const points=[origin,...route.points.slice(start+1)];
  const target=points.at(-1);
  const walk=active.stats.canWalk;
  const freeSpawn=walk(...origin)&&walk(...origin,PLAYER_RADIUS+.1)&&
    !active.scene.getObjectByName('memory-marker')&&
    !active.portals.some(portal=>active.scene.getObjectByName(portal.id))&&
    !active.stats.cameraVolumes.some(({center,radii})=>center[1]-radii[1]<2.2&&
      Math.hypot(center[0]-origin[0],center[2]-origin[1])<Math.max(radii[0],radii[2])+PLAYER_RADIUS);
  let position=origin,steps=0,length=0,stalled=false;
  for(const next of points.slice(1)){
    length+=Math.hypot(next[0]-position[0],next[1]-position[1]);
    for(let attempt=0;attempt<2000;attempt++){
      const dx=next[0]-position[0],dz=next[1]-position[1],distance=Math.hypot(dx,dz);
      if(distance<.004)break;
      const delta=movementDelta(dx/distance,-dz/distance,0,5.1,Math.min(.05,distance/5.1));
      const motion=movePlayer(position,delta,walk,.05);
      if(motion.speed===0||!walk(...motion.position)){stalled=true;break;}
      position=motion.position;steps++;
    }
    if(stalled)break;
  }
  const [west,north,east,south]=world.bbox;
  const edges=[
    {name:'west',axis:0,edge:west,direction:-1}, {name:'east',axis:0,edge:east,direction:1},
    {name:'north',axis:1,edge:north,direction:-1}, {name:'south',axis:1,edge:south,direction:1},
  ].map(({name,axis,edge,direction})=>{
    let sample=null;
    for(let i=1;i<20;i++){
      const [lo,hi]=axis===0?[north,south]:[west,east];
      const p=axis===0?[0,lo+(hi-lo)*i/20]:[lo+(hi-lo)*i/20,0];
      p[axis]=edge-direction*(PLAYER_RADIUS+.45);
      if(walk(...p)){sample=p;break;}
    }
    if(!sample)return {name,blocked:null,reason:'Sem ponto livre amostrado junto à borda.'};
    const delta=axis===0?[direction*2,0]:[0,direction*2];
    const moved=movePlayer(sample,delta,walk,.05).position;
    const clearance=(edge-moved[axis])*direction;
    return {name,blocked:clearance>=PLAYER_RADIUS,clearance};
  });
  const building=world.features.find(f=>f.osmId===43805272);
  const footprintProbe=[108,131];
  const obstacleCollision=!!building&&overlapsPolygon(footprintProbe,building.points,0)&&!walk(...footprintProbe);
  const reached=Math.hypot(position[0]-target[0],position[1]-target[1])<.01;
  return {
    status:freeSpawn&&reached&&!stalled&&edges.every(edge=>edge.blocked)&&obstacleCollision?'passed':'failed',
    routeWayId:route.osmId,origin,target,position,points,steps,lengthMeters:length,
    destination:'Extremidade interna da calçada OSM 174188399.',
    connected:points.length>1,spawnClear:freeSpawn,reached,edges,obstacleCollision,
    method:'Movimento e colisão do jogo a 1× sobre segmentos consecutivos do mesmo way OSM.',
  };
}
