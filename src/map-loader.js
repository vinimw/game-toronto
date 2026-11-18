import {makeDemoWorld} from './demo-world.js';
import {latLonToLocal,nearestOnPath} from './geo.js';
export async function loadWorld(){
  try {
    const r=await fetch('/data/high-park.osm.json',{cache:'no-store'});
    if(!r.ok) throw new Error('Arquivo geográfico ainda não importado');
    const data=await r.json();
    if(!Array.isArray(data.features) || data.features.length<20) throw new Error('Dados geográficos incompletos');
    // Approximate north-central park entry. Find nearest mapped walking route.
    const nearEntrance=latLonToLocal(43.6508,-79.4651,data.origin);
    const spawn=nearestOnPath(nearEntrance,data.features,f=>f.kind==='path' && !['motorway','trunk'].includes(f.tags?.highway)).point;
    const nearMemory=latLonToLocal(43.6488,-79.4638,data.origin);
    let memory=nearestOnPath(nearMemory,data.features,f=>f.kind==='path' && ['footway','path','pedestrian','cycleway','residential','living_street'].includes(f.tags?.highway)).point;
    if(Math.hypot(memory[0]-spawn[0],memory[1]-spawn[1])>230){
      const alternate=nearestOnPath([spawn[0]+42,spawn[1]+30],data.features,f=>f.kind==='path' && ['footway','path','pedestrian'].includes(f.tags?.highway));
      memory=alternate.point;
    }
    return {...data,mode:'osm',spawn,memory,label:`Traçados de OpenStreetMap · ${data.features.length} elementos`};
  } catch (e) {
    console.info('Game Love: modo de demonstração. Execute npm run map:import para obter OpenStreetMap.',e.message);
    return makeDemoWorld();
  }
}
