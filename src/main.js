import * as THREE from 'three';
import './styles.css';
import './mobile-hud.css';
import {SceneManager} from './scene-manager.js';
import {regionManifest} from './regions.js';
import {loadRegion} from './scenes/load-region.js';
import {createGameState, MEMORY_ID} from './game-state.js';
import {cameraSettings,qualityProfiles} from './visual-settings.js';
import {avoidVegetation,recoverCameraArm} from './park-camera.js';
import {buildWorld} from './world.js';
import {createCharacter} from './character.js';
import {finitePoint, resolveCamera, frameTiming, frameMetrics, movementDelta} from './movement.js';
import {bindGameControls} from './controls.js';
import {CameraFollow,angleDelta} from './camera-follow.js';
import {PlayerController} from './player-controller.js';
import {bindSpeedPanel} from './speed-panel.js';
import {drawLocalMap} from './local-map.js';
const $=id=>document.getElementById(id);
const reviewCapture=import.meta.env.DEV&&new URLSearchParams(location.search).get('review')==='1';
const mobile=matchMedia('(pointer: coarse)').matches;
const touchHud=matchMedia('(max-width: 600px), (pointer: coarse) and (max-width: 1024px)');
const missionToggle=$('mission-toggle');
function setMissionExpanded(value){
  missionToggle.setAttribute('aria-expanded',String(value));
  $('mission-details').hidden=!value;
}
setMissionExpanded(!touchHud.matches);
missionToggle.addEventListener('click',()=>setMissionExpanded($('mission-details').hidden));
touchHud.addEventListener('change',event=>{
  setMissionExpanded(!event.matches);
  speedPanel.setCollapsed(event.matches);
});
let world,stats,note;
const camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.1,1600);
const renderer=new THREE.WebGLRenderer({antialias:!mobile,alpha:false,powerPreference:'high-performance'});
let quality=mobile?'balanced':'high';
function applyQuality(){
  renderer.setPixelRatio(Math.min(devicePixelRatio,qualityProfiles[quality].pixelRatio,mobile?1.25:1.65));
  stats?.setQuality(quality);
}
applyQuality();
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.16;
$('game').appendChild(renderer.domElement);
const avatar=createCharacter(new THREE.Group());
const player=new PlayerController();
let storage;try{storage=localStorage;}catch{}
const gameState=createGameState(storage);
let albumUnlocked=gameState.state.unlockedMemories.includes(MEMORY_ID);
const inputs={keys:new Set(),joystickX:0,joystickY:0,runTouch:false};
const current={yaw:Math.PI*.55,pitch:cameraSettings.pitch,distance:cameraSettings.distance};
const cameraTarget=new THREE.Vector3();
const cameraFollow=new CameraFollow(cameraSettings);
let modalOpen=false,mapOpen=false,nearMemory=false,nearPortal=null,frameCounter=0,accum=0;
let clock=0;
const transition=$('scene-transition');
const manager=new SceneManager({manifest:regionManifest,loadRegion,buildScene:buildWorld,avatar,
  onBusy(busy){
    controls.reset();
    if(busy){gameState.save();hideToast();closeModal();toggleMap(false);nearPortal=null;nearMemory=false;$('action-wrap').classList.add('hidden');}
    $('app').setAttribute('aria-busy',String(busy));
  },
  async fade(opaque,name){
    transition.classList.remove('hidden');
    $('transition-label').textContent=`Carregando ${name}…`;
    const animation=transition.animate([{opacity:opaque?0:1},{opacity:opaque?1:0}],
      {duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:220,fill:'forwards'});
    try{await animation.finished;}finally{transition.style.opacity=opaque?'1':'0';animation.cancel();}
    if(!opaque)transition.classList.add('hidden');
  },
  onActivate(active){
    world=active.world;stats=active.stats;stats.setQuality(quality);
    current.yaw=active.yaw;cameraFollow.reset();cameraTarget.set(avatar.root.position.x,1.48,avatar.root.position.z);cameraInitialized=false;
    note=world.mode==='osm'?'Geometria de OpenStreetMap (© colaboradores OSM)':(world.fallbackReason?'Cenário ilustrativo · '+world.fallbackReason:'Cenário demonstrativo ilustrativo · não representa a geografia real');
    const source=$('data-status');
    source.dataset.origin=world.mode==='osm'?'osm':'demo';
    source.textContent=world.mode==='osm'?'OSM REAL':'DEMO';
    $('osm-attribution').classList.toggle('hidden',world.mode!=='osm');
    source.title=note;$('map-note').textContent=`${regionManifest[active.id].name} · ${note}`;
    $('place-name').textContent=regionManifest[active.id].name;
    $('brand-region').textContent=active.id==='toronto'?'TORONTO · DEMONSTRAÇÃO':'TORONTO · HIGH PARK';
    $('map-title').textContent=regionManifest[active.id].name;
    $('game').setAttribute('aria-label',`Cenário tridimensional de ${regionManifest[active.id].name}`);
    $('app').dataset.region=active.id;document.title=`Game Love · ${regionManifest[active.id].name}`;
    $('position-text').textContent=`${Math.round(avatar.root.position.x)}m E · ${Math.round(-avatar.root.position.z)}m N`;
    $('mission-card').classList.toggle('hidden',active.id!=='high-park');
    if(mapOpen)drawMiniMap();
  },
});
$('album-count').textContent=albumUnlocked?'1/1':'0/1';
if(albumUnlocked)completeMission();
function completeMission(){
  $('mission-short').textContent='Memória encontrada';
  $('mission-progress').textContent='1/1';
  $('mission-progress').setAttribute('aria-label','1 de 1 memórias');
  $('mission-title').textContent='Memória encontrada ♡';
  $('mission-desc').textContent='Uma lembrança especial já faz parte do seu álbum. Você pode revisitá-la quando quiser.';
  $('mission-state').textContent='✓ CONCLUÍDA'; $('mission-state').classList.add('completed');
}
let modalTrigger=null;
function updateOverlay(){
  const active=mapOpen?'map-panel':modalOpen?'modal-layer':null;
  for(const child of $('app').children)child.inert=Boolean(active&&child.id!==active&&child.id!=='map-backdrop');
}
function showModal(html){
  if(manager.loading||mapOpen)return;
  if(!modalOpen)modalTrigger=document.activeElement;
  modalOpen=true;$('modal-content').innerHTML=html;$('modal-layer').classList.remove('hidden');
  controls.reset();updateOverlay();$('modal-close').focus({preventScroll:true});
}
function closeModal(){
  if(!modalOpen)return;
  modalOpen=false;$('modal-layer').classList.add('hidden');updateOverlay();
  if(!manager.loading)modalTrigger?.focus({preventScroll:true});
  modalTrigger=null;
}
function showMemory(){
  if(manager.loading)return;
  if(!albumUnlocked){albumUnlocked=true;gameState.unlockMemory(MEMORY_ID);
    $('album-count').textContent='1/1';completeMission();showToast('Nova memória adicionada ao álbum ♡');}
  showModal(`<p class="eyebrow">MEMÓRIA 01 / 01 · DESBLOQUEADA</p>
  <div class="memory-art"><div class="memory-sun">✦</div><div class="memory-hill"></div><span>UMA TARDE ESPECIAL</span></div>
  <h2 id="modal-title" class="memory-title">A primeira lembrança</h2>
  <p class="memory-sub">HIGH PARK · TORONTO</p>
  <p class="memory-copy">Esta é uma memória de exemplo. Aqui você poderá contar uma história real, incluir uma carta romântica e adicionar até três fotografias. A lembrança ficará guardada neste álbum após ser desbloqueada.</p>
  <div class="photo-placeholders"><div>+ Foto 1</div><div>+ Foto 2</div><div>+ Foto 3</div></div>
  <div class="memory-signoff">Com carinho, <span>♡</span></div>`);
}
function showAlbum(){if(manager.loading)return;showModal(`<p class="eyebrow">SEU INVENTÁRIO</p><h2 id="modal-title" class="memory-title">Álbum de memórias</h2><p class="memory-copy">Cada lugar guarda uma história. Explore o mapa para desbloquear lembranças especiais.</p><button id="album-memory" class="album-entry ${albumUnlocked?'':'album-locked'}"><span class="album-entry-icon">${albumUnlocked?'♡':'♧'}</span><span><b>${albumUnlocked?'A primeira lembrança':'Memória ainda não descoberta'}</b><small>High Park · ${albumUnlocked?'Toque para reviver':'Explore o parque para desbloquear'}</small></span><span>›</span></button>`);const b=$('album-memory');b.addEventListener('click',()=>{if(albumUnlocked)showMemory();else showToast('Primeiro descubra esta memória pelo parque.');});}
function showHelp(){
  if(manager.loading)return;
  showModal(`<p class="eyebrow">COMO JOGAR</p><h2 id="modal-title" class="memory-title">Um passeio por Toronto</h2><p class="memory-copy">Este protótipo valida a câmera, a movimentação, a importação de ruas e o sistema de memórias.</p><div class="help-rows"><p><strong>W A S D</strong><span>Caminhar</span></p><p><strong>Mouse / gesto</strong><span>Girar câmera</span></p><p><strong>Shift / ↟</strong><span>Correr</span></p><p><strong>E / tocar</strong><span>Interagir perto da memória</span></p><p><strong>M / I</strong><span>Mapa / Álbum</span></p><p><strong>Scroll</strong><span>Zoom da câmera</span></p></div><fieldset class="visual-settings"><legend>Câmera e gráficos</legend>
    <label>Distância da câmera<input id="camera-distance" type="range" min="${cameraSettings.minDistance}" max="${cameraSettings.maxDistance}" step="0.1" value="${current.distance}"></label>
    <label>Inclinação da câmera<input id="camera-pitch" type="range" min="${cameraSettings.minPitch}" max="${cameraSettings.maxPitch}" step="0.01" value="${current.pitch}"></label>
    <label>Qualidade gráfica<select id="visual-quality"><option value="low">Baixa</option><option value="balanced">Equilibrada</option><option value="high">Alta</option></select></label>
  </fieldset><p class="map-note">${note}.</p>`);
  $('camera-distance').oninput=e=>current.distance=e.target.valueAsNumber;
  $('camera-pitch').oninput=e=>current.pitch=e.target.valueAsNumber;
  const select=$('visual-quality');select.value=quality;
  select.onchange=()=>{quality=select.value;applyQuality();};
}
function hideToast(){clearTimeout(showToast.timer);$('toast').classList.add('hidden');}
function showToast(msg){
  hideToast();const el=$('toast');el.textContent=msg;el.classList.remove('hidden');
  showToast.timer=setTimeout(hideToast,3000);
}
$('modal-close').addEventListener('click',closeModal);$('modal-backdrop').addEventListener('click',closeModal);
$('btn-album').addEventListener('click',showAlbum);$('btn-help').addEventListener('click',showHelp);
function toggleMap(force){
  if((manager.loading||modalOpen)&&force!==false)return;
  const open=typeof force==='boolean'?force:!mapOpen;
  if(open===mapOpen)return;
  mapOpen=open;
  controls.reset();
  $('map-panel').classList.toggle('hidden',!open);
  $('map-backdrop').classList.toggle('hidden',!open);
  $('btn-map').setAttribute('aria-expanded',String(open));
  updateOverlay();
  if(open){hideToast();drawMiniMap();$('close-map').focus({preventScroll:true});}
  else if(!manager.loading)$('btn-map').focus({preventScroll:true});
}
$('btn-map').addEventListener('click',()=>toggleMap());
$('close-map').addEventListener('click',()=>toggleMap(false));
$('map-backdrop').addEventListener('click',()=>toggleMap(false));
new ResizeObserver(()=>{if(mapOpen)drawMiniMap();}).observe($('map-canvas'));
async function interact(){
  if(manager.loading||modalOpen||mapOpen)return;
  if(nearPortal){
    try{await manager.travel(nearPortal.id);}catch(error){console.error('Scene transition failed:',error);showToast('Não foi possível carregar o local. Tente novamente.');}
  }else if(nearMemory)showMemory();
}
$('action-btn').addEventListener('click',interact);
window.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();
  if(key==='escape'){closeModal();toggleMap(false);return;}
  const editing=e.target.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]');
  if(editing)return;
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
  if(manager.loading||modalOpen)return;
  if(mapOpen){if(key==='m'&&!e.repeat)toggleMap(false);return;}
  if(speedPanel.shortcut(e))return;
  if(key==='i'){showAlbum();return;}if(key==='m'){toggleMap();return;}
  if(key==='e'){if(!e.repeat)void interact();return;}
  inputs.keys.add(key);
});
window.addEventListener('keyup',e=>inputs.keys.delete(e.key.toLowerCase()));
const controls=bindGameControls({canvas:renderer.domElement,joystick:$('joystick'),stick:$('stick'),
  runButton:$('mobile-run'),inputs,camera:current,settings:cameraSettings,enabled:()=>!manager.loading&&!modalOpen&&!mapOpen,
  onCameraInput:delta=>cameraFollow.manualInput(performance.now(),delta)});
const speedPanel=bindSpeedPanel($('speed-panel'),player,{minimized:touchHud.matches});
function resetTiming(){controls.reset();previous=performance.now();accum=frameCounter=0;}
window.addEventListener('blur',resetTiming);
document.addEventListener('visibilitychange',resetTiming);
function drawMiniMap(){
  drawLocalMap($('map-canvas'),world,manager.active.portals,[avatar.root.position.x,avatar.root.position.z]);
}
let cameraInitialized=false, cameraArm=1;
const cameraOrbit=new THREE.Vector3();
let previous=performance.now();
function animate(now){
  const timing=frameTiming(now,previous);const dt=timing.simulation;previous=now;clock+=dt;
  if(!manager.active)return;
  let x=(inputs.keys.has('d')||inputs.keys.has('arrowright')?1:0)-(inputs.keys.has('a')||inputs.keys.has('arrowleft')?1:0)+inputs.joystickX;
  let z=(inputs.keys.has('w')||inputs.keys.has('arrowup')?1:0)-(inputs.keys.has('s')||inputs.keys.has('arrowdown')?1:0)+inputs.joystickY;
  if(manager.loading||modalOpen||mapOpen){x=z=0;}
  const running=inputs.keys.has('shift')||inputs.runTouch;
  const movementReferenceYaw=cameraFollow.referenceYaw(x,z,angleDelta(0,current.yaw+cameraFollow.offset));
  const motion=player.move([avatar.root.position.x,avatar.root.position.z],{right:x,forward:z,yaw:movementReferenceYaw,running,dt,canWalk:stats.canWalk});
  if(finitePoint(motion.position))avatar.root.position.set(motion.position[0],0,motion.position[1]);
  if(motion.heading!==null) {
    const diff=Math.atan2(Math.sin(motion.heading-avatar.root.rotation.y),Math.cos(motion.heading-avatar.root.rotation.y));
    avatar.root.rotation.y+=diff*(1-Math.exp(-dt*9));
  }
  cameraFollow.update({now,dt,manualYaw:current.yaw,right:x,forward:z,heading:motion.heading});
  const cameraYaw=angleDelta(0,current.yaw+cameraFollow.offset);
  avatar.update(dt,motion.animationSpeed);
  speedPanel.update(motion.speed);
  stats.markerRoot?.userData.animate(clock);
  const target=new THREE.Vector3(avatar.root.position.x,1.48,avatar.root.position.z);
  cameraTarget.lerp(target,1-Math.exp(-dt*cameraSettings.follow));
  const horiz=current.distance*Math.cos(current.pitch);
  const desired=new THREE.Vector3(cameraTarget.x+Math.sin(current.yaw)*horiz,cameraTarget.y+current.distance*Math.sin(current.pitch),cameraTarget.z+Math.cos(current.yaw)*horiz);
  if(!cameraInitialized){cameraOrbit.copy(desired);cameraArm=1;cameraInitialized=true;}
  else cameraOrbit.lerp(desired,1-Math.exp(-dt*cameraSettings.orbit));
  // Resolve after smoothing, so interpolation cannot carry the camera through a wall.
  const anchor=[avatar.root.position.x,1.48,avatar.root.position.z];
  const orbitDelta=cameraOrbit.clone().sub(target);
  if(cameraFollow.offset!==0){
    const c=Math.cos(cameraFollow.offset),s=Math.sin(cameraFollow.offset);
    const {x:offsetX,z:offsetZ}=orbitDelta;
    orbitDelta.x=c*offsetX+s*offsetZ;
    orbitDelta.z=c*offsetZ-s*offsetX;
  }
  const clearOrbit=resolveCamera(anchor,cameraFollow.offset===0
    ?cameraOrbit.toArray():[target.x+orbitDelta.x,target.y+orbitDelta.y,target.z+orbitDelta.z],stats.cameraObstacles);
  const safeCamera=avoidVegetation(anchor,clearOrbit,stats.cameraVolumes);
  const safeDistance=Math.hypot(safeCamera[0]-anchor[0],safeCamera[1]-anchor[1],safeCamera[2]-anchor[2]);
  const limit=Math.min(1,safeDistance/Math.max(.001,orbitDelta.length()));
  cameraArm=recoverCameraArm(cameraArm,limit,dt,cameraSettings.clearanceRecovery);
  camera.position.copy(target).addScaledVector(orbitDelta,cameraArm);
  // Keep the avatar in view during sudden turns or accelerated traversal.
  camera.lookAt(cameraTarget.distanceToSquared(target)>1.5?target:cameraTarget);
  nearMemory=!!world.memory && Math.hypot(avatar.root.position.x-world.memory[0],avatar.root.position.z-world.memory[1])<5.3;
  nearPortal=manager.nearbyPortal([avatar.root.position.x,avatar.root.position.z]);
  $('action-wrap').classList.toggle('hidden',(!nearMemory&&!nearPortal)||manager.loading||modalOpen||mapOpen);
  $('action-label').textContent=nearPortal?nearPortal.label:albumUnlocked?'Revisitar lembrança':'Descobrir memória';
  $('compass').textContent=(((cameraYaw%(Math.PI*2)+Math.PI*2)%(Math.PI*2))<Math.PI/4||((cameraYaw%(Math.PI*2)+Math.PI*2)%(Math.PI*2))>Math.PI*1.75)?'N':Math.sin(cameraYaw)>0?'O':'L';
  accum+=timing.real;frameCounter++;
  if(accum>.45){const metrics=frameMetrics(frameCounter,accum);frameCounter=0;accum=0;
    $('performance').textContent=`${Math.round(metrics.fps)} FPS · ${metrics.milliseconds.toFixed(1)} ms`;
    $('position-text').textContent=`${Math.round(avatar.root.position.x)}m E · ${Math.round(-avatar.root.position.z)}m N`;
  }
  stats.setDetailFocus?.(camera.position.x,camera.position.z);
  renderer.render(manager.active.scene,camera);
  // Development-only DOM diagnostics for repeated-transition GPU resource checks.
  if(import.meta.env.DEV)renderer.domElement.dataset.resources=JSON.stringify({...renderer.info.memory,
    region:manager.active.id,objects:manager.active.scene.children.length,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,avatars:manager.active.scene.children.filter(o=>o===avatar.root).length});
  if(reviewCapture)renderer.domElement.dataset.reviewPose=JSON.stringify({
    sceneId:manager.active.scene.name,origin:world.mode==='osm'?'OSM REAL':'DEMO',
    sourceSha256:world.sourceSha256??null,bboxWgs84:world.bboxWgs84??null,geographicOrigin:world.origin??null,
    position:{local:avatar.root.position.toArray(),headingRadians:avatar.root.rotation.y},
    orbit:{yaw:cameraYaw,pitch:current.pitch,renderedYaw:Math.atan2(camera.position.x-target.x,camera.position.z-target.z)},
    movement:{referenceYaw:movementReferenceYaw,direction:movementDelta(x,z,movementReferenceYaw,1,.05).map(value=>value/.05)},
    camera:{projection:camera.type,position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),
      fovDegrees:camera.fov},
    graphics:{profile:quality,...qualityProfiles[quality],pixelRatio:renderer.getPixelRatio(),antialias:!mobile},
    resolution:{width:renderer.domElement.width,height:renderer.domElement.height},
  });
}
renderer.setAnimationLoop(animate);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
try{await manager.load('toronto','start');showToast('Toronto demonstrativa · aproxime-se do portal para entrar no High Park.');}
catch(error){console.error('Initial region failed:',error);showToast('Não foi possível iniciar a região. Recarregue para tentar novamente.');}
