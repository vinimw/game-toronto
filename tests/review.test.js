import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildComparison} from '../tools/review/compare.mjs';
import {writeReport} from '../tools/review/report.mjs';
import {frameStatistics} from '../tools/review/motion-benchmark.js';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+kvYsAAAAASUVORK5CYII=','base64');
const browser={engine:'chromium',version:'1',headless:true};
const capture={id:'03-trail',origin:'OSM REAL',sceneId:'park',status:'captured',file:'screenshots/03-trail.png',
  position:{local:[0,0,0]},camera:{projection:'PerspectiveCamera',fovDegrees:53},
  graphics:{profile:'high'},viewport:{width:1280,height:720},resolution:{width:1280,height:720},sourceSha256:'abcd'};
const review=(captures,drawCalls)=>({metadata:{browser,captures},
  performance:{captures:[{captureId:capture.id,drawCalls,triangles:500}]},readImage:async ()=>png});

test('review comparison pairs legacy captures and excludes incompatible metric deltas',async()=>{
  const baseline=review([capture],10);
  const equal=await buildComparison(baseline,review([{...capture,position:{local:[-0,0,0]},deviceScaleFactor:1}],11));
  assert.equal(equal.environment,'incomplete');
  assert.equal(equal.captures[0].status,'comparable');
  assert.equal(equal.captures[0].metrics.drawCalls.delta,1);
  assert.match(equal.captures[0].images[0],/^data:image\/png;base64,/);
  const different=await buildComparison(baseline,review([
    {...capture,camera:{...capture.camera,fovDegrees:42},sourceSha256:'dcba'},
    {...capture,id:'12-trail-mobile',label:'<mobile>'},
  ],12));
  assert.deepEqual(different.captures.map(item=>item.status),['incompatible','unmatched']);
  assert.deepEqual(different.captures[0].reasons,['câmera','hash OSM']);
  assert.deepEqual(different.captures[0].metrics,{});
  const output=await mkdtemp(join(tmpdir(),'game-review-test-'));
  try{
    const file=join(output,'report.html');
    await writeReport(file,{...baseline,comparison:different,geography:{},issues:[],imageFiles:[capture.file]});
    const html=await readFile(file,'utf8');
    assert.match(html,/&lt;mobile&gt;/);
    assert.match(html,/data:image\/png;base64,/);
    assert.match(html,/ID ausente na referência/);
  }finally{await rm(output,{recursive:true,force:true});}
});

test('benchmark statistics use raw intervals and preserve the slow tail',()=>{
  const values=frameStatistics([100,20,10,20]);
  assert.equal(values.samples,4);
  assert.equal(values.frameTimeMeanMs,37.5);
  assert.equal(values.frameTimeP50Ms,20);
  assert.equal(values.frameTimeP95Ms,100);
});
