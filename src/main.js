import * as THREE from 'three';
import './styles.css';
import {loadWorld} from './map-loader.js';
import {buildWorld} from './world.js';
import {createCharacter} from './character.js';
const $=id=>document.getElementById(id);
const mobile=matchMedia('(pointer: coarse)').matches;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.1,1600);
const renderer=new THREE.WebGLRenderer({antialias:!mobile,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.65));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.16;
$('game').appendChild(renderer.domElement);
const world=await loadWorld();
const stats=buildWorld(scene,world);
const avatar=createCharacter(scene);
avatar.root.position.set(world.spawn[0],0,world.spawn[1]);
let albumUnlocked=false;
try{albumUnlocked=localStorage.getItem('game-love-memory-001')==='unlocked';}catch{}
const inputs={keys:new Set(),joystickX:0,joystickY:0,runTouch:false};
const current={yaw:Math.PI*.55,pitch:.25,distance:9.4};
const cameraTarget=new THREE.Vector3(world.spawn[0],1.5,world.spawn[1]);
let modalOpen=false,mapOpen=false,lastFps=0,nearMemory=false,frameCounter=0,accum=0;
let clock=0;
const note=world.mode==='osm'?'Geometria de OpenStreetMap (© colaboradores OSM)':'Cenário ilustrativo · execute npm run map:import para obter vias reais';
$('data-status').textContent=world.mode==='osm'?'● MAPA OSM IMPORTADO':'◌ MODO DEMONSTRAÇÃO';
$('data-status').title=note;
$('map-note').textContent=world.mode==='osm'?`OpenStreetMap · ${world.features.length} elementos · © colaboradores OSM`:'Mapa ilustrativo: não representa os traçados reais de Toronto';
$('album-count').textContent=albumUnlocked?'1/1':'0/1';
if(albumUnlocked)completeMission();
function completeMission(){
  $('mission-title').textContent='Memória encontrada ♡';
  $('mission-desc').textContent='Uma lembrança especial já faz parte do seu álbum. Você pode revisitá-la quando quiser.';
  $('mission-state').textContent='✓ CONCLUÍDA'; $('mission-state').classList.add('completed');
}
function showModal(html){modalOpen=true;$('modal-content').innerHTML=html;$('modal-layer').classList.remove('hidden');inputs.keys.clear();}
function closeModal(){modalOpen=false;$('modal-layer').classList.add('hidden');}
function showMemory(){
  if(!albumUnlocked){albumUnlocked=true;try{localStorage.setItem('game-love-memory-001','unlocked');}catch{}
    $('album-count').textContent='1/1';completeMission();showToast('Nova memória adicionada ao álbum ♡');}
  showModal(`<p class="eyebrow">MEMÓRIA 01 / 01 · DESBLOQUEADA</p>
  <div class="memory-art"><div class="memory-sun">✦</div><div class="memory-hill"></div><span>UMA TARDE ESPECIAL</span></div>
  <h2 id="modal-title" class="memory-title">A primeira lembrança</h2>
  <p class="memory-sub">HIGH PARK · TORONTO</p>
  <p class="memory-copy">Esta é uma memória de exemplo. Aqui você poderá contar uma história real, incluir uma carta romântica e adicionar até três fotografias. A lembrança ficará guardada neste álbum após ser desbloqueada.</p>
  <div class="photo-placeholders"><div>+ Foto 1</div><div>+ Foto 2</div><div>+ Foto 3</div></div>
  <div class="memory-signoff">Com carinho, <span>♡</span></div>`);
}
function showAlbum(){showModal(`<p class="eyebrow">SEU INVENTÁRIO</p><h2 id="modal-title" class="memory-title">Álbum de memórias</h2><p class="memory-copy">Cada lugar guarda uma história. Explore o mapa para desbloquear lembranças especiais.</p><button id="album-memory" class="album-entry ${albumUnlocked?'':'album-locked'}"><span class="album-entry-icon">${albumUnlocked?'♡':'♧'}</span><span><b>${albumUnlocked?'A primeira lembrança':'Memória ainda não descoberta'}</b><small>High Park · ${albumUnlocked?'Toque para reviver':'Explore o parque para desbloquear'}</small></span><span>›</span></button>`);const b=$('album-memory');b.addEventListener('click',()=>{if(albumUnlocked)showMemory();else showToast('Primeiro descubra esta memória pelo parque.');});}
function showHelp(){showModal(`<p class="eyebrow">COMO JOGAR</p><h2 id="modal-title" class="memory-title">Um passeio por Toronto</h2><p class="memory-copy">Este protótipo valida a câmera, a movimentação, a importação de ruas e o sistema de memórias.</p><div class="help-rows"><p><strong>W A S D</strong><span>Caminhar</span></p><p><strong>Mouse / gesto</strong><span>Girar câmera</span></p><p><strong>Shift / ↟</strong><span>Correr</span></p><p><strong>E / tocar</strong><span>Interagir perto da memória</span></p><p><strong>M / I</strong><span>Mapa / Álbum</span></p><p><strong>Scroll</strong><span>Zoom da câmera</span></p></div><p class="map-note">${note}. O metrô e o streetcar ainda não estão implementados.</p>`);}
function showToast(msg){const el=$('toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.classList.add('hidden'),3000);}
$('modal-close').addEventListener('click',closeModal);$('modal-backdrop').addEventListener('click',closeModal);
$('btn-album').addEventListener('click',showAlbum);$('btn-help').addEventListener('click',showHelp);
function toggleMap(force){mapOpen=typeof force==='boolean'?force:!mapOpen;$('map-panel').classList.toggle('hidden',!mapOpen);if(mapOpen)drawMiniMap();}
$('btn-map').addEventListener('click',()=>toggleMap());$('close-map').addEventListener('click',()=>toggleMap(false));
$('action-btn').addEventListener('click',()=>{if(nearMemory)showMemory();});
window.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
  if(key==='escape'){closeModal();toggleMap(false);return;}
  if(modalOpen)return;
  if(key==='i'){showAlbum();return;}if(key==='m'){toggleMap();return;}
  if(key==='e'&&nearMemory){showMemory();return;}
  inputs.keys.add(key);
});
window.addEventListener('keyup',e=>inputs.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>inputs.keys.clear());
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();current.distance=Math.min(20,Math.max(5,current.distance+Math.sign(e.deltaY)*1.0));},{passive:false});
let dragging=false,prevX=0,prevY=0;
renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;prevX=e.clientX;prevY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!dragging)return;current.yaw-=(e.clientX-prevX)*.006;current.pitch=Math.min(.75,Math.max(.05,current.pitch+(e.clientY-prevY)*.003));prevX=e.clientX;prevY=e.clientY;});
renderer.domElement.addEventListener('pointerup',()=>dragging=false);renderer.domElement.addEventListener('pointercancel',()=>dragging=false);
// Mobile analog controls — no external joystick library.
const joystick=$('joystick'),stick=$('stick');let joystickPointer=null;
function joystickMove(e){const r=joystick.getBoundingClientRect();const dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),mag=Math.max(1,Math.hypot(dx,dy));const f=Math.min(1,mag/38);inputs.joystickX=dx/mag*f;inputs.joystickY=-dy/mag*f;stick.style.transform=`translate(${inputs.joystickX*38}px,${-inputs.joystickY*38}px)`;}
joystick.addEventListener('pointerdown',e=>{joystickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);joystickMove(e);});
joystick.addEventListener('pointermove',e=>{if(joystickPointer===e.pointerId)joystickMove(e);});
function endJoystick(e){if(joystickPointer!==e.pointerId)return;joystickPointer=null;inputs.joystickX=inputs.joystickY=0;stick.style.transform='translate(0px,0px)';}
joystick.addEventListener('pointerup',endJoystick);joystick.addEventListener('pointercancel',endJoystick);
$('mobile-run').addEventListener('pointerdown',e=>{inputs.runTouch=true;e.currentTarget.setPointerCapture(e.pointerId);});
$('mobile-run').addEventListener('pointerup',()=>inputs.runTouch=false);$('mobile-run').addEventListener('pointercancel',()=>inputs.runTouch=false);
function drawMiniMap(){
  const cnv=$('map-canvas'),ctx=cnv.getContext('2d'),w=cnv.width,h=cnv.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#e5e8d3';ctx.fillRect(0,0,w,h);
  const px=avatar.root.position.x,pz=avatar.root.position.z,scale=.6;
  const xy=([x,z])=>[w/2+(x-px)*scale,h/2+(z-pz)*scale];
  for(const f of world.features){const pts=f.points;if(!pts.length)continue;
    ctx.beginPath();pts.forEach((p,i)=>{const [x,y]=xy(p);if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y)});
    if(['green','water','building'].includes(f.kind)){ctx.closePath();ctx.fillStyle=f.kind==='water'?'#9dc9c7':f.kind==='building'?'#cfbcae':'#b2cd98';ctx.fill();}
    else{ctx.strokeStyle=f.kind==='rail'?'#a18b78':'#f5f0d7';ctx.lineWidth=['primary','secondary','residential'].includes(f.tags?.highway)?5:2;ctx.stroke();}
  }
  const [mx,my]=xy(world.memory);ctx.beginPath();ctx.arc(mx,my,7,0,Math.PI*2);ctx.fillStyle='#b95164';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();
  ctx.beginPath();ctx.arc(w/2,h/2,8,0,Math.PI*2);ctx.fillStyle='#334a43';ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=3;ctx.stroke();
}
let previous=performance.now();
function animate(now){
  const dt=Math.min(.05,(now-previous)/1000||0);previous=now;clock+=dt;
  let x=(inputs.keys.has('d')||inputs.keys.has('arrowright')?1:0)-(inputs.keys.has('a')||inputs.keys.has('arrowleft')?1:0)+inputs.joystickX;
  let z=(inputs.keys.has('w')||inputs.keys.has('arrowup')?1:0)-(inputs.keys.has('s')||inputs.keys.has('arrowdown')?1:0)+inputs.joystickY;
  if(modalOpen||mapOpen){x=z=0;}
  const strength=Math.min(1,Math.hypot(x,z));if(strength>0){x/=Math.hypot(x,z);z/=Math.hypot(x,z);}
  const running=inputs.keys.has('shift')||inputs.runTouch;
  const speed=(running?9:5.1)*strength;
  const dx=(x*Math.cos(current.yaw)-z*Math.sin(current.y))*speed*dt;
  const dz=(-x*Math.sin(current.yaw)-z*Math.cos(current.y))*speed*dt;
  const nx=avatar.root.position.x+dx,nz=avatar.root.position.z+dz;
  if(stats.canWalk(nx,avatar.root.position.z))avatar.root.position.x=nx;
  if(stats.canWalk(avatar.root.position.x,nz))avatar.root.position.z=nz;
  if(speed>.01) {
    const targetRotation=Math.atan2(-dx,-dz);let diff=(targetRotation-avatar.root.rotation.y+Math.PI*3)%(Math.PI*2)-Math.PI;
    avatar.root.rotation.y+=diff*Math.min(1,dt*9);
  }
  avatar.update(dt,speed);
  stats.markerRoot.userData.animate(clock);
  const target=new THREE.Vector3(avatar.root.position.x,1.48,avatar.root.position.z);
  cameraTarget.lerp(target,Math.min(1,dt*7));
  const horiz=current.distance*Math.cos(current.pitch);
  const desired=new THREE.Vector3(cameraTarget.x+Math.sin(current.yaw)*horiz,cameraTarget.y+2.3+current.distance*Math.sin(current.pitch),cameraTarget.z+Math.cos(current.yaw)*horiz);
  camera.position.lerp(desired,Math.min(1,dt*8)); camera.lookAt(cameraTarget);
  nearMemory=Math.hypot(avatar.root.position.x-world.memory[0],avatar.root.position.z-world.memory[1])<5.3;
  $('action-wrap').classList.toggle('hidden',!nearMemory||modalOpen||mapOpen);
  $('action-label').textContent=albumUnlocked?'Revisitar lembrança':'Descobrir memória';
  $('compass').textContent=(((current.yaw%(Math.PI*2)+Math.PI*2)%(Math.PI*2))<Math.PI/4||((current.yaw%(Math.PI*2)+Math.PI*2)%(Math.PI*2))>Math.PI*1.75)?'N':Math.sin(current.yaw)>0?'O':'L';
  accum+=dt;frameCounter++;
  if(accum>.45){lastFps=Math.round(frameCounter/accum);frameCounter=0;accum=0;
    $('performance').textContent=`${lastFps} FPS`;
    $('position-text').textContent=`${Math.round(avatar.root.position.x)}m E · ${Math.round(-avatar.root.position.z)}m N`;
    if(mapOpen)drawMiniMap();
  }
  renderer.render(scene,camera);
}
renderer.setAnimationLoop(animate);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
showToast(world.mode==='osm'?'Mapa de Toronto carregado!':'Demonstração visual carregada. Importe o mapa real com npm run map:import');
