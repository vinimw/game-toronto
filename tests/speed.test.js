import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerController} from '../src/player-controller.js';
import {createWalkTest} from '../src/movement.js';
import {speedShortcut,bindSpeedPanel} from '../src/speed-panel.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const open=()=>true;
function move(player,running=false,canWalk=open,position=[-4,-4],right=1,forward=0){
  return player.move(position,{right,forward,yaw:0,running,dt:.05,canWalk});
}
for(const multiplier of [1,2,3,5])test(`${multiplier}x scales walk/run but preserves cadence and heading`,()=>{
  const player=new PlayerController();player.setMultiplier(multiplier);
  const walk=move(player),run=move(player,true);
  close(walk.speed,5.1*multiplier);close(run.speed,9*multiplier);
  close(walk.animationSpeed,5.1);close(run.animationSpeed,9);
  close(walk.heading,-Math.PI/2);assert.ok(run.position.every(Number.isFinite));
});
test('half steps, clamping, immediate reset and fresh-session default',()=>{
  const player=new PlayerController();
  for(let i=1;i<=5;i+=.5)assert.equal(player.setMultiplier(i),i);
  assert.equal(player.setMultiplier(Infinity),5);assert.equal(player.setMultiplier(NaN),5);
  assert.equal(player.setMultiplier(-2),1);assert.equal(player.setMultiplier(20),5);
  player.setMultiplier(1);close(move(player,true).speed,9);
  player.setMultiplier(5);assert.equal(new PlayerController().multiplier,1);
});
test('5x diagonal substeps stop at thin obstacles, water and bounds',()=>{
  const player=new PlayerController();player.setMultiplier(5);
  for(const kind of ['building','water']){
    const canWalk=createWalkTest([{kind,points:[[0,-10],[.01,-10],[.01,10],[0,10]]}],[-10,-10,10,10]);
    const result=move(player,true,canWalk,[-1,0]);
    assert.ok(result.position[0]<-.35);assert.ok(result.position[0]>-1);
    const diagonal=move(player,true,canWalk,[-1,0],1,1);assert.ok(diagonal.position[0]<-.35);assert.ok(diagonal.position[1]<0);
    const stopped=move(player,true,canWalk,[-.36,0]);assert.equal(stopped.speed,0);assert.equal(stopped.animationSpeed,0);
  }
  const bounded=move(player,true,createWalkTest([],[-5,-5,5,5]),[4,0]);assert.ok(bounded.position[0]<4.65);
});
test('shortcuts do not hijack browser zoom or text/slider editing',()=>{
  assert.equal(speedShortcut({key:'+'}),1);assert.equal(speedShortcut({key:'='}),1);assert.equal(speedShortcut({key:'-'}),-1);
  for(const modifier of ['ctrlKey','metaKey','altKey'])assert.equal(speedShortcut({key:'+',[modifier]:true}),0);
  assert.equal(speedShortcut({key:'-',target:{closest:()=>true}}),0);
  assert.equal(speedShortcut({key:'w'}),0);
});
class Element extends EventTarget {
  attributes={};dataset={};hidden=false;value='';textContent='';disabled=false;
  setAttribute(key,value){this.attributes[key]=value;}
}
test('slider, buttons, minimize and output stay synchronized without persistence',()=>{
  const selectors=['input','[data-multiplier]','[data-configured]','[data-actual]','[data-toggle]','[data-chevron]','[data-body]','[data-minus]','[data-plus]','[data-normal]'];
  const nodes=Object.fromEntries(selectors.map(s=>[s,new Element()]));
  const root=new Element();root.querySelector=s=>nodes[s];
  const player=new PlayerController(),panel=bindSpeedPanel(root,player,{minimized:true});
  assert.equal(nodes['[data-body]'].hidden,true);assert.equal(root.dataset.collapsed,'true');
  nodes['[data-toggle]'].dispatchEvent(new Event('click'));assert.equal(nodes['[data-body]'].hidden,false);
  nodes.input.value='3.5';nodes.input.dispatchEvent(new Event('input'));assert.equal(player.multiplier,3.5);
  nodes['[data-plus]'].dispatchEvent(new Event('click'));assert.equal(player.multiplier,4);
  nodes['[data-minus]'].dispatchEvent(new Event('click'));assert.equal(player.multiplier,3.5);
  panel.update(17.85);assert.equal(nodes['[data-actual]'].textContent,'Atual: 17,9 un/s');
  nodes['[data-normal]'].dispatchEvent(new Event('click'));assert.equal(player.multiplier,1);assert.equal(nodes.input.value,'1');
  assert.equal(nodes['[data-minus]'].disabled,true);assert.match(nodes['[data-configured]'].textContent,/5,1.*9,0/);
});
