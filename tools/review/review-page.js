import * as THREE from 'three';
import {SceneManager} from '../../src/scene-manager.js';
import {regionManifest} from '../../src/regions.js';
import {loadRegion} from '../../src/scenes/load-region.js';
import {buildWorld} from '../../src/world.js';
import {createCharacter} from '../../src/character.js';
import {qualityProfiles} from '../../src/visual-settings.js';
import {latLonToLocal} from '../../src/geo.js';
import {collectRenderedGeometry} from './rendered-geometry.js';
import {validateNavigation} from './navigation.js';
import {points} from './points.js';
import {reviewPipelineVersion,reviewProfiles} from './profiles.js';
import {benchmarkMotion,frameStatistics} from './motion-benchmark.js';

if(!import.meta.env.DEV)throw new Error('Review mode requires the Vite development server.');

const avatar=createCharacter(new THREE.Group());
const profileId=new URLSearchParams(location.search).get('profile')==='mobile'?'mobile':'desktop';
const profile=reviewProfiles[profileId],quality=profile.quality;
const renderer=new THREE.WebGLRenderer({antialias:profile.antialias});
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.16;
renderer.setPixelRatio(profile.rendererPixelRatio);
renderer.setSize(innerWidth,innerHeight);
document.body.append(renderer.domElement);

const evidenceByScene=new WeakMap();
const manager=new SceneManager({manifest:regionManifest,loadRegion,avatar,buildScene(scene,world,portals){
  const evidence=world.mode==='osm'?collectRenderedGeometry():null;
  const stats=buildWorld(scene,world,portals,evidence);
  if(evidence)evidenceByScene.set(scene,evidence.parts);
  return stats;
}});
let camera, currentPoint, sceneLoadMs;
function render(){
  const scene=manager.active.scene, fog=scene.fog;
  if(camera.isOrthographicCamera)scene.fog=null;
  try { renderer.render(scene,camera); }
  finally { scene.fog=fog; }
}

function locate(point,active){
  if(point.location==='spawn')return active.spawn;
  if(point.location==='portal'){
    const portal=active.portals.find(candidate=>candidate.id===point.portal);
    return portal?.position.map((value,i)=>value+point.offset[i]);
  }
  return point.position;
}

function frameCamera(point,world,[x,z]){
  const aspect=innerWidth/innerHeight;
  if(point.projection==='orthographic'){
    const [west,north,east,south]=world.bbox;
    const halfHeight=Math.max(south-north,(east-west)/aspect)*.54;
    const view=new THREE.OrthographicCamera(-halfHeight*aspect,halfHeight*aspect,halfHeight,-halfHeight,.1,300);
    const centerX=(west+east)/2,centerZ=(north+south)/2;
    view.position.set(centerX,115,centerZ);
    view.up.set(0,0,-1);
    view.lookAt(centerX,0,centerZ);
    return view;
  }
  const view=new THREE.PerspectiveCamera(53,aspect,.1,1600);
  const [dx,y,dz]=point.eye,[lx,ly,lz]=point.look;
  view.position.set(x+dx,y,z+dz);
  view.lookAt(x+lx,ly,z+lz);
  return view;
}

function geographicPosition([x,z],origin){
  if(!origin)return null;
  return {lat:origin.lat-z/111320,lon:origin.lon+x/(111320*Math.cos(origin.lat*Math.PI/180))};
}

async function prepare(id){
  let point=points.find(p=>p.id===id);
  if(!point)throw new Error('Ponto de revisão desconhecido.');
  currentPoint=null;
  const missing=reason=>({status:'unavailable',reason});
  if(!regionManifest[point.region]?.entries[point.entry])return missing('Região ou entrada ausente no manifesto.');
  if(manager.active?.id!==point.region || manager.active.entryId!==point.entry){
    const start=performance.now();
    await manager.load(point.region,point.entry);
    sceneLoadMs=performance.now()-start;
  }
  const active=manager.active,world=active.world,origin=world.mode==='osm'?'OSM REAL':'DEMO';
  const [minX,minZ,maxX,maxZ]=world.bbox;
  const geographicBounds=origin==='OSM REAL'&&world.origin?{
    southwest:geographicPosition([minX,maxZ],world.origin),
    northeast:geographicPosition([maxX,minZ],world.origin),
    source:'Projeção inversa dos limites locais.',
  }:null;
  const sceneInfo={
    sceneId:active.scene.name,origin,
    boundsLocal:{format:'[minX,minZ,maxX,maxZ]',values:world.bbox},
    geographicBounds,
    geographicOrigin:world.origin??null,
    geographicReference:origin==='DEMO'?'Âncora ilustrativa.':'Origem do recorte importado.',
    attribution:world.source??null,
    license:world.license??null,
    bboxWgs84:world.bboxWgs84??null,
    bboxWgs84Order:'south,west,north,east',
    extractedAt:world.extractedAt??null,sourceUrl:world.sourceUrl??null,
    sourceSha256:world.sourceSha256??null,
    fallbackReason:world.fallbackReason??null,

  };
  if(world.mode==='osm'&&point.osm){
    const {geo,feature,...pose}=point.osm;
    if(feature&&!world.features.some(item=>item.osmId===feature))return {...missing('Feição OSM de referência ausente.'),...sceneInfo};
    point={...point,...pose,mode:'osm',visual:null,position:latLonToLocal(...geo,world.origin)};
  }
  if(point.mode && point.mode!==world.mode)
    return {...missing('Ponto DEMO sem posição equivalente cadastrada para OSM.'),...sceneInfo};
  if(point.visual && !world.features.some(feature=>feature.visual===point.visual))
    return {...missing('Local especial ausente nesta versão.'),...sceneInfo};
  const position=locate(point,active);
  if(!position||!active.stats.canWalk(...position))
    return {...missing('Posição cadastrada ausente ou obstruída.'),...sceneInfo};
  avatar.root.position.set(position[0],0,position[1]);
  avatar.root.rotation.y=point.heading;
  active.stats.setQuality(quality);
  active.stats.markerRoot?.userData.animate(0);
  camera=frameCamera(point,world,position);
  if(camera.isOrthographicCamera)active.stats.setDetailFocus?.();
  else active.stats.setDetailFocus?.(camera.position.x,camera.position.z);
  render();
  currentPoint=id;
  document.querySelector('#review-attribution')?.remove();
  if(origin==='OSM REAL'){
    const attribution=document.createElement('span');attribution.id='review-attribution';
    attribution.textContent=(camera.isOrthographicCamera?'↑ N · ':'')+point.label+' · OSM REAL · © OpenStreetMap contributors';
    document.body.append(attribution);
  }
  const direction=new THREE.Vector3();camera.getWorldDirection(direction);
  return {status:'captured',...sceneInfo,label:point.label,
    fileStem:origin==='OSM REAL'?point.osmFile??point.id:point.id,
    position:{local:avatar.root.position.toArray(),geographic:origin==='OSM REAL'?geographicPosition(position,world.origin):null,headingRadians:point.heading},
    camera:{projection:camera.type,position:camera.position.toArray(),direction:direction.toArray(),
      up:camera.up.toArray(),quaternion:camera.quaternion.toArray(),distanceToAvatar:camera.position.distanceTo(avatar.root.position),
      ...(camera.isPerspectiveCamera?{fovDegrees:camera.fov}:{halfHeight:camera.top,northUp:true,fog:false,
        visibleBoundsLocal:[camera.position.x+camera.left,camera.position.z-camera.top,camera.position.x+camera.right,camera.position.z-camera.bottom],
        visibleBoundsWgs84:{southwest:geographicPosition([camera.position.x+camera.left,camera.position.z-camera.bottom],world.origin),
          northeast:geographicPosition([camera.position.x+camera.right,camera.position.z-camera.top],world.origin)}})},
    graphics:{profile:quality,...qualityProfiles[quality],pixelRatio:renderer.getPixelRatio(),antialias:profile.antialias},
    ...(profile.mobileViewportSimulation?{deviceScaleFactor:devicePixelRatio,mobileViewportSimulation:true}:{}),
    viewport:{width:innerWidth,height:innerHeight},
    resolution:{width:renderer.domElement.width,height:renderer.domElement.height},
  };
}

async function measure(id){
  if(currentPoint!==id)throw new Error('Ponto de revisão ainda não preparado.');
  const intervals=[];
  let previous;
  // Warm up first, then sample raw rAF intervals. Simulation time is not used.
  for(let i=0;i<91;i++){
    const now=await new Promise(resolve=>requestAnimationFrame(resolve));
    render();
    if(i>=16)intervals.push(now-previous);
    previous=now;
  }
  const {calls,triangles}=renderer.info.render;
  const vegetation=manager.active.stats.vegetationMetrics?.();
  return {...frameStatistics(intervals),drawCalls:calls,triangles,rendererMemory:{...renderer.info.memory},
    ...(vegetation?{vegetation}:{}),
    sceneLoadMs,sceneLoadScope:'SceneManager.load: dados, construção e ativação; reutilizado nos pontos da mesma cena.'};
}

async function motion(){
  const pose=await prepare('03-high-park-trilha');
  if(pose.status!=='captured'||manager.active.world.mode!=='osm')
    return {status:'unavailable',reason:'Recorte OSM necessário para o percurso.'};
  const active=manager.active;
  const result=await benchmarkMotion({active,avatar,camera,render,renderInfo:renderer.info.render,
    route:validateNavigation(active)});
  return {...result,graphics:pose.graphics,viewport:pose.viewport,resolution:pose.resolution,
    sourceSha256:active.world.sourceSha256,deviceScaleFactor:devicePixelRatio};
}

function geography(){
  const active=manager.active;
  if(active?.id!=='high-park'||active.world.mode!=='osm')
    return {status:'unavailable',reason:'Nenhum recorte High Park OSM foi carregado.'};
  const world=active.world;
  const feature=(osmId)=>world.features.find(item=>item.osmId===osmId);
  return {
    status:'source-comparison',region:active.id,bboxWgs84:world.bboxWgs84,bboxOrder:'south,west,north,east',
    dataExtractionUtc:world.extractedAt,sourceUrl:world.sourceUrl,sourceSha256:world.sourceSha256,
    attribution:world.source,license:world.license,coverage:world.coverage,
    landmarks:active.stats.landmarks,
    comparisons:[
      [174188399,'Calçada de chegada ao sul de Bloor Street West'],
      [1366720320,'Colborne Lodge Drive'],
      [14344414,'Limite do High Park'],
      [43805272,'High Park Nature Centre'],
    ].map(([osmId,label])=>({label,osmId,present:Boolean(feature(osmId)),url:'https://www.openstreetmap.org/way/'+osmId})),
    navigation:validateNavigation(active),
    arrival:{local:active.spawn,geographic:geographicPosition(active.spawn,world.origin),walkable:active.stats.canWalk(...active.spawn)},
    limits:[
      'Correspondência com esta extração OSM; não é levantamento em campo.',
      'Linhas e anéis são recortados na bbox e projetados em metros com arredondamento de 1 cm.',
      'A caixa de dados é menor que a vista ortográfica devido ao enquadramento 16:9 e sua margem.',
      'Sem água no recorte publicado, sem avaliação das margens do lago.',
      'Sem relações multipoligonais, feições pontuais, barreiras, elevação ou níveis de circulação.',
      'Largura de trilhas e altura sem tag são estimativas; árvores decorativas não são inventário geográfico.',
      'Toronto e a entrada externa continuam DEMO; o Nature Centre substitui o café fictício na captura 05.',
    ],
  };
}
window.gameLoveReview={version:reviewPipelineVersion,prepare,measure,motion,geography,
  renderedGeometry:()=>evidenceByScene.get(manager.active?.scene)??[]};
