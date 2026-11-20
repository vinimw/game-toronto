import {latLonToLocal,nearestOnPath} from './geo.js';

export const MEMORY_ID='memory-001';

export const memories=[{
  id:MEMORY_ID,
  regionId:'high-park',
  anchor:{lat:43.65142833,lon:-79.46384251,pathId:225583279},
  title:'Uma pausa no parque',
  shortTitle:'Pausa no parque',
  description:'Uma tarde tranquila perto do Nature Centre.',
  narrative:'O vento mexia nas folhas perto do caminho. A personagem parou por um instante, deixando que o som dos passos desse lugar ao silêncio do parque. Quando seguiu adiante, levou consigo a vontade de voltar e caminhar mais devagar.',
  image:null, // Optional {src:'/memories/filename.jpg', alt:'Description'}
  radius:5,
  visual:'glow',
  demo:true,
  useDemoAnchor:true,
}];

export function resolveMemoryPoints(regionId,world,canWalk,definitions=memories){
  const points=[];
  for(const memory of definitions){
    if(memory.regionId!==regionId)continue;
    let position;
    if(world.mode==='osm'&&world.origin&&memory.anchor){
      const {lat,lon,pathId}=memory.anchor;
      const projected=latLonToLocal(lat,lon,world.origin);
      if(pathId){
        const match=nearestOnPath(projected,world.features,f=>f.kind==='path'&&f.osmId===pathId);
        if(match.dist>3)continue; // The geographic anchor no longer matches the expected path.
        position=match.point;
      }else position=projected;
    }else if(world.mode==='demo'&&memory.useDemoAnchor)position=world.memory;
    if(position&&canWalk(...position))points.push({memory,position});
  }
  return points;
}

export function nearbyMemory(points,[x,z]){
  let nearest=null,distance=Infinity;
  for(const point of points){
    const gap=Math.hypot(point.position[0]-x,point.position[1]-z);
    if(gap<=point.memory.radius&&gap<distance){nearest=point;distance=gap;}
  }
  return nearest;
}
