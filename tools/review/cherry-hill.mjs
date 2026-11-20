import assert from 'node:assert/strict';
import {join} from 'node:path';
import {enterHighPark} from './camera-evaluation.mjs';
import {frameStatistics} from './motion-benchmark.js';
import {startViewportVideo} from './full-viewport-video.mjs';

const waitLod=(page,lod)=>page.waitForFunction(lod=>window.inspectWorldStreaming().cherryHill.lod===lod,lod,{timeout:12000});
const stats=page=>page.evaluate(()=>window.inspectWorldStreaming());

async function verifyMobile(browser,target){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  try{
    const page=await context.newPage();
    await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
    await page.goto(new URL('/?review=1&park=expanded',target).href);
    await page.waitForSelector('#game canvas[data-review-pose]');
    const {dispatch,stick}=await enterHighPark(page,context,true);
    assert.equal((await stats(page)).cherryHill.assets,null);
    await page.evaluate(()=>window.stageCameraReview([-201,773],Math.PI));
    await waitLod(page,'balanced');
    const arrived=await stats(page);
    const start=await page.evaluate(()=>JSON.parse(document.querySelector('#game canvas').dataset.reviewPose).position.local);
    await dispatch('touchStart',[stick(0,-38)]);
    try{await page.waitForTimeout(650);}finally{await dispatch('touchEnd');}
    const end=await page.evaluate(()=>JSON.parse(document.querySelector('#game canvas').dataset.reviewPose).position.local);
    assert.ok(end[2]-start[2]>2);
    await page.evaluate(()=>window.stageCameraReview([-22,-105],Math.PI));
    await waitLod(page,null);
    assert.equal((await stats(page)).cherryHill.assets.decodedActive,0);
    return {arrived,start,end};
  }finally{await context.close();}
}

export async function evaluateCherryHill(browser,target,bundle,safeMessage){
  const viewport={width:1280,height:720};
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  let recording;
  try{
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(safeMessage(error.message)));
    page.on('console',message=>{if(message.type()==='error')errors.push(safeMessage(message.text()));});
    await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
    await page.goto(new URL('/?review=1&park=expanded',target).href);
    await page.waitForSelector('#game canvas[data-review-pose]');
    await enterHighPark(page,context,false);
    const stage=(point,yaw)=>page.evaluate(([point,yaw])=>window.stageCameraReview(point,yaw),[point,yaw]);
    const north=await stats(page);
    assert.equal(north.cherryHill.assets,null);
    assert.ok(north.cherryHill.futureMemoryPosition);
    await stage([-198,611],Math.PI);
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#game canvas').dataset.reviewPose).position.local[2]===611);
    assert.equal((await stats(page)).cherryHill.lod,null);
    recording=await startViewportVideo(page,viewport,12,{touchControls:false});
    await page.keyboard.down('w');
    let route;
    try{
      route=await page.evaluate(()=>new Promise(resolve=>{
        const canvas=document.querySelector('#game canvas'),start=performance.now();
        let previous=start,last=0;
        const intervals=[],samples=[];
        function tick(now){
          intervals.push(now-previous);previous=now;
          if(now-last>150){
            const {cherryHill,renderer}=window.inspectWorldStreaming();
            samples.push({ms:now-start,position:JSON.parse(canvas.dataset.reviewPose).position.local,
              lod:cherryHill.lod,renderer});
            last=now;
          }
          if(now-start>=26000)resolve({intervals:intervals.slice(1),samples});
          else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }));
    }finally{await page.keyboard.up('w');}
    assert.ok(route.samples.some(sample=>sample.lod==='low'),'LOD distante não observado.');
    assert.ok(route.samples.some(sample=>sample.lod==='high'&&sample.position[2]>=727),'A caminhada não chegou ao detalhe.');
    const video='cherry-hill-approach.webm';
    const playback=await recording.stop(join(bundle,video));
    const arrived=await stats(page);
    assert.ok(arrived.cherryHill.trees>=10);
    await stage([-22,-105],Math.PI);
    await waitLod(page,null);
    const unloaded=await stats(page);
    assert.equal(unloaded.cherryHill.assets.decodedActive,0);
    await stage([-201,773],Math.PI);
    await waitLod(page,'high');
    const returned=await stats(page);
    assert.equal(returned.cherryHill.assets.downloads,arrived.cherryHill.assets.downloads);
    assert.deepEqual(errors,[]);
    const mobile=await verifyMobile(browser,target);
    return {status:'passed',video,playback,north,arrived,unloaded,returned,mobile,route:{
      ...frameStatistics(route.intervals),samples:route.samples,
      maxMs:Math.max(...route.intervals),longFrames:route.intervals.filter(ms=>ms>50).length,
    }};
  }catch(error){return {status:'failed',error:safeMessage(error.message)};}
  finally{try{await recording?.stop();}finally{await context.close();}}
}
