import test from 'node:test';
import assert from 'node:assert/strict';
import {bindGameControls} from '../src/controls.js';
class Surface extends EventTarget {
  style={}; captured=new Set();
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);}
  getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}
  send(type,props={}){const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:1,button:0,clientX:50,clientY:50,...props});this.dispatchEvent(e);return e;}
}
function setup(){
  const canvas=new Surface(),joystick=new Surface(),stick=new Surface(),runButton=new Surface();
  const inputs={keys:new Set(),joystickX:0,joystickY:0,runTouch:false},camera={yaw:0,pitch:.25,distance:9};
  let active=true;
  const controls=bindGameControls({canvas,joystick,stick,runButton,inputs,camera,
    settings:{yawSensitivity:.006,pitchSensitivity:.003,minPitch:.05,maxPitch:.75,minDistance:5,maxDistance:20},enabled:()=>active});
  return {canvas,joystick,runButton,inputs,camera,controls,disable:()=>active=false};
}
test('joystick and camera accept different fingers simultaneously',()=>{
  const s=setup();s.joystick.send('pointerdown',{pointerId:10,clientY:12});
  s.canvas.send('pointerdown',{pointerId:20});s.canvas.send('pointermove',{pointerId:20,clientX:80});
  assert.equal(s.inputs.joystickY,1);assert.equal(s.camera.yaw,-.18);
  s.canvas.send('pointerup',{pointerId:10});s.canvas.send('pointermove',{pointerId:20,clientX:90});
  assert.equal(s.camera.yaw,-.24);
});
test('unrelated fingers cannot replace or end joystick and run ownership',()=>{
  const s=setup();s.joystick.send('pointerdown',{pointerId:1,clientX:88});
  s.joystick.send('pointerdown',{pointerId:2,clientX:12});s.joystick.send('pointerup',{pointerId:2});
  assert.equal(s.inputs.joystickX,1);
  s.runButton.send('pointerdown',{pointerId:3});s.runButton.send('pointerup',{pointerId:4});assert.equal(s.inputs.runTouch,true);
  s.runButton.send('pointercancel',{pointerId:3});assert.equal(s.inputs.runTouch,false);
});
test('cancel, capture loss and reset clear held input',()=>{
  const s=setup();s.joystick.send('pointerdown',{clientX:88});s.joystick.send('lostpointercapture');assert.equal(s.inputs.joystickX,0);
  s.joystick.send('pointerdown',{clientY:12});s.runButton.send('pointerdown');s.inputs.keys.add('w');s.controls.reset();
  assert.equal(s.inputs.keys.size,0);assert.equal(s.inputs.joystickY,0);assert.equal(s.inputs.runTouch,false);assert.equal(s.joystick.captured.size,0);
});
test('camera clamps pitch and zoom and ignores inactive or unrelated drags',()=>{
  const s=setup();s.canvas.send('pointerdown');s.canvas.send('pointermove',{pointerId:2,clientX:100});assert.equal(s.camera.yaw,0);
  s.canvas.send('pointermove',{clientY:5000});assert.equal(s.camera.pitch,.75);
  for(let i=0;i<30;i++)s.canvas.send('wheel',{deltaY:1});assert.equal(s.camera.distance,20);
  s.disable();s.canvas.send('pointermove',{clientX:100});assert.equal(s.camera.yaw,0);
});
