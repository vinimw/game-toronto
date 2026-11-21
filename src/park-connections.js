import {createWalkTest} from './movement.js';

const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const explorationConnections=[
  {id:'north-sports',anchors:[[-19,-108],[28.69,184.12]]},
  {id:'west-cherry-cafe',anchors:[[-164,530],[-201,774],[-125,777]],
    exterior:[[-115.15,782.85],[-105.49,787.26],[-96,790.63],[-74.5,779],[-74.25,776.5]]},
  {id:'pond-hillside-garden',anchors:[[-270,851],[-198,926],[-127,1026]]},
];

export function planParkConnection(world,anchors,canWalk=createWalkTest(world.features,world.bbox),exterior=[]){
  const vertices=new Map(),blocked=[];
  function node(point){
    const key=point.join(',');
    if(!vertices.has(key))vertices.set(key,{point,edges:[]});
    return vertices.get(key);
  }
  for(const way of world.features){
    if(way.kind!=='path'||!way.tags?.highway||way.tags.foot==='no'||
      ['private','no'].includes(way.tags.access)||['motorway','trunk','proposed','construction'].includes(way.tags.highway))continue;
    for(let i=1;i<way.points.length;i++){
      const a=way.points[i-1],b=way.points[i],length=distance(a,b);
      if(length<=.001)continue;
      const steps=Math.ceil(length/.7);
      let obstruction;
      for(let j=0;j<=steps;j++){
        const x=a[0]+(b[0]-a[0])*j/steps,z=a[1]+(b[1]-a[1])*j/steps;
        if(!canWalk(x,z,.5)){obstruction=[x,z];break;}
      }
      if(obstruction){blocked.push({osmId:way.osmId,position:obstruction});continue;}
      const first=node(a),second=node(b);
      first.edges.push({to:second,length,osmId:way.osmId});
      second.edges.push({to:first,length,osmId:way.osmId});
    }
  }
  const stops=anchors.map(anchor=>{
    let match=null,offset=Infinity;
    for(const vertex of vertices.values()){
      const d=distance(anchor,vertex.point);
      if(d<offset){match=vertex;offset=d;}
    }
    return {anchor,match,offset};
  });
  const snapped=stops.map(({anchor,match,offset})=>({anchor,point:match?.point??null,offset:Number.isFinite(offset)?offset:null}));
  if(stops.some(stop=>stop.offset>25))return {status:'unavailable',reason:'anchor-too-far',snapped,blocked};
  function shortest(start,goal){
    const best=new Map([[start,0]]),previous=new Map(),queue=[{vertex:start,cost:0}];
    while(queue.length){
      queue.sort((a,b)=>b.cost-a.cost);
      const {vertex,cost}=queue.pop();
      if(cost!==best.get(vertex))continue;
      if(vertex===goal){
        const segments=[];
        let end=goal;
        while(end!==start){
          const {from,edge}=previous.get(end);
          segments.unshift({from:from.point,to:end.point,osmId:edge.osmId,length:edge.length});end=from;
        }
        return segments;
      }
      for(const edge of vertex.edges){
        const next=cost+edge.length;
        if(next>=(best.get(edge.to)??Infinity))continue;
        best.set(edge.to,next);previous.set(edge.to,{from:vertex,edge});queue.push({vertex:edge.to,cost:next});
      }
    }
    return null;
  }
  const segments=[];
  for(let i=1;i<stops.length;i++){
    const leg=shortest(stops[i-1].match,stops[i].match);
    if(!leg)return {status:'unavailable',reason:'disconnected',leg:i,snapped,blocked};
    segments.push(...leg);
  }
  for(const to of exterior){
    const from=segments.at(-1)?.to??stops.at(-1).match.point,length=distance(from,to);
    if(length<=.001)continue;
    const steps=Math.ceil(length/.25);
    for(let step=0;step<=steps;step++){
      const t=step/steps;
      if(!canWalk(from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t,.4))
        return {status:'unavailable',reason:'exterior-approach-obstructed',from,to};
    }
    segments.push({from,to,length,osmId:null,source:'review-exterior-approach'});
  }
  return {status:'planned',snapped,segments,distanceMeters:segments.reduce((n,s)=>n+s.length,0)};
}
