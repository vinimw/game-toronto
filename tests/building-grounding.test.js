import {terrainBuildingBatches} from '../src/terrain-buildings.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildingGrade,buildingPlacement,addBuildingFoundation} from '../src/building-grounding.js';

test('footprint edge and interior terrain peaks are sampled between corners',()=>{
  const terrain={width:3,height:3,xAt:i=>i,zAt:i=>i,get:(x,z)=>x===1&&z===1?5:0};
  // Use an explicit triangle interpolation matching the terrain mesh.
  terrain.at=(x,z)=>{
    const i=Math.min(1,Math.floor(x)),j=Math.min(1,Math.floor(z)),u=x-i,v=z-j;
    const a=terrain.get(i,j),b=terrain.get(i+1,j),c=terrain.get(i,j+1),d=terrain.get(i+1,j+1);
    return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  };
  const points=[[0,.5],[2,.5],[2,1.5],[0,1.5],[0,.5]];
  assert.deepEqual(buildingGrade(terrain,points),{low:0,high:5,legacy:0});
  const edge=buildingGrade(terrain,[[0,.5],[2,.5],[2,.8],[0,.8]]);
  assert.ok(edge.high>=4-.001);
});

test('sloped foundation extends below grade while the wall stays level',()=>{
  const feature={points:[[0,0],[4,0],[4,4],[0,4],[0,0]]};
  const world={terrain:{at:(x,z)=>-9+x*.5+z*.3}};
  const old=buildingPlacement({...world,legacyGrounding:true},feature);
  const placement=buildingPlacement(world,feature);
  assert.ok(old.high-old.floor>3);
  assert.equal(placement.floor,placement.high);
  const group=new THREE.Group();
  group.position.y=placement.floor;
  addBuildingFoundation(group,feature.points,placement);
  const box=new THREE.Box3().setFromObject(group);
  assert.ok(Math.abs(box.min.y-placement.bottom)<1e-6);
  assert.ok(Math.abs(box.max.y-placement.floor)<1e-6);
  assert.ok(box.min.y<placement.low);
  assert.deepEqual(buildingPlacement({},feature),{low:0,high:0,legacy:0,floor:0,bottom:0,foundation:false});
});

test('foundations share the same batch as textured-layout wall geometry',()=>{
  const scene=new THREE.Scene(),group=new THREE.Group();
  const points=[[0,0],[4,0],[4,4],[0,4],[0,0]];
  group.add(new THREE.Mesh(new THREE.BoxGeometry(4,3,4),new THREE.MeshLambertMaterial()));
  addBuildingFoundation(group,points,{foundation:true,floor:2,bottom:-3});
  const batch=terrainBuildingBatches(scene);
  batch.add(group,points[0]);batch.attach();
  assert.equal(scene.children.length,1);
  assert.ok(scene.children[0].geometry.attributes.position.count>36);
});
