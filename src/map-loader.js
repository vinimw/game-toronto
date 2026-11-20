import {makeDemoWorld} from './demo-world.js';
import {latLonToLocal,nearestOnPath} from './geo.js';
import {createWalkTest} from './movement.js';
import {createTerrain} from './high-park-terrain.js';
import {HIGH_PARK_GATE} from './regions.js';

const snapshotUrl='/data/high-park.osm.json';

export function pedestrianPath(feature){
  const tags=feature.tags??{};
  return feature.kind==='path'&&['footway','path','pedestrian'].includes(tags.highway)&&
    tags.footway!=='crossing'&&tags.foot!=='no'&&!['private','no'].includes(tags.access);
}

export function prepareHighParkMap(data){
  const {origin,bbox,bboxWgs84,features}=data;
  if(data.version!==2||data.mode!=='osm'||!['high-park-north','high-park-expanded'].includes(data.dataset)||
    !data.sourceUrl?.startsWith('https://api.openstreetmap.org/api/0.6/map.json?')||
    !/^[0-9a-f]{64}$/.test(data.sourceSha256)||!Number.isFinite(Date.parse(data.extractedAt))||
    ![origin?.lat,origin?.lon].every(Number.isFinite)||bbox?.length!==4||!bbox.every(Number.isFinite)||
    bboxWgs84?.length!==4||!bboxWgs84.every(Number.isFinite)||
    !Array.isArray(features)||features.length===0||
    !features.every(f=>f.osmType==='way'&&Number.isSafeInteger(f.osmId)&&f.points?.length>=2&&
      f.points.every(p=>p.length===2&&p.every(Number.isFinite)))){
    throw new Error('Snapshot OSM ausente, inválido ou sem proveniência.');
  }
  const spawn=latLonToLocal(HIGH_PARK_GATE.lat,HIGH_PARK_GATE.lon,origin);
  const canWalk=createWalkTest(features,bbox);
  if(!canWalk(...spawn)||nearestOnPath(spawn,features,pedestrianPath).dist>.10)
    throw new Error('A chegada não coincide com uma calçada caminhável do recorte.');
  // Keep the legacy vegetation clearance anchor so procedural planting stays fixed.
  const memoryAnchor=latLonToLocal(43.652846,-79.4653253,origin);
  const marker=nearestOnPath(memoryAnchor,features,f=>pedestrianPath(f)&&f.osmId===174188399);
  const memory=marker.dist<5&&canWalk(...marker.point)?marker.point:spawn;
  return {...data,spawn,memory,label:'High Park norte · © OpenStreetMap contributors'};
}

export async function loadWorld(){
  if(globalThis.location && new URLSearchParams(location.search).get('map')==='demo')
    return {...makeDemoWorld(),fallbackReason:'DEMO solicitado por URL.'};
  const expanded=globalThis.location&&new URLSearchParams(location.search).get('park')==='expanded';
  if(expanded){
    const [mapResponse,terrainResponse]=await Promise.all([
      fetch('/data/high-park-expanded.osm.json'),fetch('/data/high-park-terrain.json'),
    ]);
    if(!mapResponse.ok||!terrainResponse.ok)throw new Error('Prévia ampliada de High Park indisponível.');
    const world=prepareHighParkMap(await mapResponse.json());
    if(world.dataset!=='high-park-expanded')throw new Error('Recorte ampliado inválido.');
    const terrainData=await terrainResponse.json();
    return {...world,terrain:createTerrain(terrainData,world.bbox,world.bboxWgs84),terrainData,
      label:'High Park ampliado · prévia geográfica'};
  }
  try {
    const response=await fetch(snapshotUrl,{cache:'no-store',headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('Recorte OSM indisponível.');
    return prepareHighParkMap(await response.json());
  }catch(error){
    console.info('Game Love: High Park DEMO foi carregado como fallback.',error.message);
    return {...makeDemoWorld(),fallbackReason:error.message};
  }
}
