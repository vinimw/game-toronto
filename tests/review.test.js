import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildComparison,openReviewZip} from '../tools/review/compare.mjs';
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
  assert.equal(equal.captures[0].images.baseline,'comparisons/03-trail.png');
  const different=await buildComparison(baseline,review([
    {...capture,camera:{...capture.camera,fovDegrees:42},sourceSha256:'dcba',origin:'DEMO'},
    {...capture,id:'12-trail-mobile',label:'<mobile>'},
  ],12));
  assert.deepEqual(different.captures.map(item=>item.status),['incompatible','unmatched']);
  assert.deepEqual(different.captures[0].reasons,['origem','câmera','hash OSM']);
  assert.deepEqual(different.captures[0].metrics,{});
  const output=await mkdtemp(join(tmpdir(),'game-review-test-'));
  try{
    const file=join(output,'report.html');
    await writeReport(file,{...baseline,comparison:different,geography:{},issues:[],imageFiles:[capture.file]});
    const html=await readFile(file,'utf8');
    assert.match(html,/&lt;mobile&gt;/);
    assert.match(html,/src="screenshots\/03-trail.png"/);
    assert.doesNotMatch(html,/data:image\/png;base64,/);
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


test('baseline identity comes from the exact archived metadata and duplicate IDs are rejected',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'review-zip-test-'));
  try{
    const previous=review([],10);
    const metadata={...previous.metadata,git:{commit:'archive-commit',dirty:false},exportedAt:'2026-11-18T22:00:00Z'};
    const entries={'metadata.json':metadata,'performance.json':previous.performance,'comparison.json':{
      baseline:{git:{commit:'older-comparison'}}}};
    for(const [file,value] of Object.entries(entries))await writeFile(join(dir,file),JSON.stringify(value));
    const source=join(dir,'source.zip');
    execFileSync('zip',['-q',source,...Object.keys(entries)],{cwd:dir});
    const sha=createHash('sha256').update(await readFile(source)).digest('hex');
    const opened=await openReviewZip(source,dir,{expectedSha256:sha.toUpperCase()});
    const result=await buildComparison(opened,previous);
    assert.deepEqual(result.baseline,{git:metadata.git,exportedAt:metadata.exportedAt,archiveFile:'source.zip',archiveSha256:sha,sha256Verified:true,pipelineVersion:null});
    await assert.rejects(openReviewZip(source,dir,{outputZip:source}),/ZIP de saída/);
    await assert.rejects(openReviewZip(source,dir,{expectedSha256:'f'.repeat(64)}),/não confere/);
    await assert.rejects(openReviewZip(source,dir,{expectedSha256:''}),/64 dígitos/);
    await assert.rejects(openReviewZip(join(dir,'outro.zip'),dir),/Baseline solicitado indisponível: outro.zip/);
    await assert.rejects(buildComparison(review([capture,capture],10),previous),/duplicado/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
