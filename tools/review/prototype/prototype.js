import * as THREE from 'three';
import {createCharacter} from '../../../src/character.js';
import {bindGameControls,movementInput} from '../../../src/controls.js';
import {frameTiming} from '../../../src/movement.js';
import {PlayerController} from '../../../src/player-controller.js';
import {resolveGameplayCamera} from '../../../src/park-camera.js';
import {cameraSettings} from '../../../src/visual-settings.js';
import {ThirdPersonRig} from '../../../src/third-person-rig.js';

const byId=id=>document.getElementById(id);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0xd9dec7);
scene.add(new THREE.HemisphereLight(0xffffff,0x89734e,2));
scene.add(new THREE.GridHelper(300,120,0x847d57,0xa9a27a));
const camera=new THREE.PerspectiveCamera(53,1,.1,500);
const renderer=new THREE.WebGLRenderer({antialias:true});
byId('game').append(renderer.domElement);
const resize=()=>{
  renderer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
};
resize();window.addEventListener('resize',resize);
const avatar=createCharacter(scene),player=new PlayerController(),rig=new ThirdPersonRig();
const current={yaw:0,pitch:cameraSettings.pitch,distance:cameraSettings.distance};
const view={...current},target=new THREE.Vector3();
const inputs={keys:new Set(),joystickX:0,joystickY:0,runTouch:false};
const controls=bindGameControls({canvas:renderer.domElement,joystick:byId('joystick'),stick:byId('stick'),
  runButton:byId('mobile-run'),inputs,camera:current,settings:cameraSettings,enabled:()=>true,
  onCameraInput:()=>rig.orbitManually()});
window.addEventListener('keydown',event=>{
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(event.key.toLowerCase()))event.preventDefault();
  inputs.keys.add(event.key.toLowerCase());
});
window.addEventListener('keyup',event=>inputs.keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',controls.reset);

const stats={cameraObstacles:[],cameraVolumes:[]};
let last=performance.now(),clearance=null,frame=0;
renderer.setAnimationLoop(now=>{
  const {simulation:dt}=frameTiming(now,last);last=now;
  const [right,forward]=movementInput(inputs);
  const next=rig.step({right,forward,dt,yaw:view.yaw,manualYaw:current.yaw,dragging:controls.isCameraDragging()});
  const motion=player.move([avatar.root.position.x,avatar.root.position.z],
    {...next.move,dt,running:inputs.runTouch,canWalk:()=>true});
  avatar.root.position.set(motion.position[0],0,motion.position[1]);
  avatar.root.rotation.y=next.locomotionHeading;
  avatar.update(dt,motion.animationSpeed);
  view.yaw=next.cameraYaw;
  if(!next.manual)current.yaw=view.yaw;
  view.pitch=current.pitch;view.distance=current.distance;
  target.copy(avatar.root.position);target.y=1.48;
  clearance=resolveGameplayCamera(target.toArray(),view,stats,clearance,dt,cameraSettings);
  camera.position.fromArray(clearance.position);camera.lookAt(target);
  const degrees=value=>(value*180/Math.PI).toFixed(1)+'°';
  byId('telemetry').textContent=`Protótipo de giro simultâneo
WASD · joystick · arrastar para olhar
Locomoção  ${degrees(next.locomotionHeading)}
Alvo câmera ${degrees(next.targetYaw)}
Yaw câmera  ${degrees(next.cameraYaw)}`;
  renderer.render(scene,camera);
  renderer.domElement.dataset.reviewPose=JSON.stringify({
    position:{local:avatar.root.position.toArray()},
    movement:{frame:++frame,input:[right,forward],cameraYaw:next.cameraYaw,cameraTargetYaw:next.targetYaw,
      locomotionHeading:next.locomotionHeading,characterHeading:avatar.root.rotation.y,manual:next.manual,dt,
      speed:motion.speed,commandYaw:next.move.yaw},
  });
});
