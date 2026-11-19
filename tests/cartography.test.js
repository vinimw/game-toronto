import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import {buildWorld} from '../src/world.js';
import {disposeScene} from '../src/scene-resources.js';
import {prepareHighParkMap} from '../src/map-loader.js';
import {compareGeometry} from '../tools/review/cartography.mjs';
import {collectRenderedGeometry} from '../tools/review/rendered-geometry.js';
import {validateNavigation} from '../tools/review/navigation.js';

test('raw-source comparison detects a missing building and a shifted Three.js strip',async()=>{
  const source=await readFile(new URL('../tools/data/high-park-north.osm-source.json',import.meta.url));
  const data=JSON.parse(await readFile(new URL('../public/data/high-park.osm.json',import.meta.url)));
  const world=prepareHighParkMap(data);
  const scene=new THREE.Scene(),evidence=collectRenderedGeometry();
  const stats=buildWorld(scene,world,[],evidence);
  try {
    const inputs={geographicOrigin:world.origin,bboxWgs84:world.bboxWgs84,sourceSha256:world.sourceSha256};
    const baseline=compareGeometry(source,evidence.parts,inputs).report;
    assert.equal(baseline.status,'within-tolerance');
    assert.ok(baseline.comparison.junctionCount>0);
    assert.ok(!baseline.differences.some(item=>item.id===174188399));
    assert.ok(!baseline.missing.includes(43805272));
    const changed=evidence.parts.filter(part=>part.id!==43805272).map(part=>
      part.id===174188399?{...part,segments:part.segments.map(segment=>segment.map(([x,z])=>[x+1,z]))}:part);
    const review=compareGeometry(source,changed,inputs).report;
    assert.ok(review.missing.includes(43805272));
    assert.ok(review.differences.some(item=>item.id===174188399&&item.maxErrorMeters>.5));
    assert.throws(()=>compareGeometry(Buffer.concat([source,Buffer.from(' ')]),evidence.parts,inputs),/Hash/);
    const result=validateNavigation({scene,world,stats,spawn:world.spawn,portals:[]});
    assert.equal(result.status,'passed');
    assert.ok(result.lengthMeters>150);
    assert.ok(result.edges.every(edge=>edge.blocked));
  }finally{disposeScene(scene);}
});

test('OSM visual details respect path clearance and quality reduces nearby detail',async()=>{
  const {nearSegment,pointInPolygon}=await import('../src/geo.js');
  const {pathWidth,realPathAppearance}=await import('../src/visual-settings.js');
  const data=JSON.parse(await readFile(new URL('../public/data/high-park.osm.json',import.meta.url)));
  const world=prepareHighParkMap(data),scene=new THREE.Scene();
  const widths=[];
  const stats=buildWorld(scene,world,[],{
    polygon(){},
    strip(feature,mesh,start,end){
      if(feature.tags.highway!=='footway'||start===end)return;
      const vertices=mesh.geometry.getAttribute('position');
      widths.push({feature,width:Math.hypot(vertices.getX(start)-vertices.getX(start+1),
        vertices.getZ(start)-vertices.getZ(start+1))});
    },
  });
  try{
    const venue=scene.getObjectByName('high-park-nature-centre');
    assert.ok(venue?.children[1].geometry.index.count>0);
    assert.ok(!stats.canWalk(108,131));
    const vegetation=['trunk','shrub','grass','flower'].map(kind=>scene.getObjectByName('park:'+kind));
    const routes=world.features.filter(feature=>feature.kind==='path');
    const lawns=world.features.filter(feature=>feature.tags.landuse==='grass');
    const transform=new THREE.Matrix4();
    assert.ok(widths.length>0);
    for(const {feature,width} of widths){
      assert.ok(Math.abs(width-realPathAppearance(feature).width)<.001);
      assert.ok(width<pathWidth(feature));
    }
    for(const batch of vegetation){
      assert.ok(batch?.count>0);
      for(let i=0;i<batch.count;i++){
        batch.getMatrixAt(i,transform);
        const point=[transform.elements[12],transform.elements[14]];
        assert.ok(stats.canWalk(...point,0));
        for(const f of routes)for(let j=1;j<f.points.length;j++)
          assert.ok(nearSegment(point,f.points[j-1],f.points[j])>=Math.max(pathWidth(f),realPathAppearance(f).width)/2);
        if(batch===vegetation[0]){
          for(const {points} of lawns.filter(f=>pointInPolygon(point,f.points))){
            assert.ok(points.some((p,i)=>nearSegment(point,p,points[(i+1)%points.length])<8.001));
          }
        }
      }
    }
    const distribution=stats.vegetationMetrics();
    assert.equal(distribution.procedural,true);
    assert.equal(distribution.placed.trees,vegetation[0].count);
    assert.equal(distribution.grid.treeCounts.flat().reduce((a,b)=>a+b,0),vegetation[0].count);
    const grass=scene.getObjectByName('park:grass'),full=grass.count;
    stats.setQuality('low');
    stats.setDetailFocus(...world.spawn);
    assert.ok(grass.count<full*.32);
    assert.equal(stats.vegetationMetrics().detailInstancesEnabled.grass,grass.count);
    stats.setQuality('high');
    stats.setDetailFocus();
    assert.equal(grass.count,full);
  }finally{disposeScene(scene);}
});
