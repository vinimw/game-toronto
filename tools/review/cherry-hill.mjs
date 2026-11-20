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
    await stage([-198,561],Math.PI);
    const position=()=>page.locator('#game canvas').evaluate(canvas=>JSON.parse(canvas.dataset.reviewPose).position.local);
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#game canvas').dataset.reviewPose).position.local[2]===561);
    assert.equal((await stats(page)).cherryHill.lod,null);
    await page.evaluate(()=>{
      const overlay=document.createElement('div');
      overlay.id='cherry-streaming-overlay';
      overlay.style='position:fixed;bottom:10%;left:10px;z-index:99;background:#21352bd9;color:white;padding:8px;font:12px monospace;pointer-events:none';
      document.body.append(overlay);
      window.cherryVideoStart=performance.now();
    });
    recording=await startViewportVideo(page,viewport,12,{touchControls:false});
    const legs=[];
    async function walk(label,yaw,destination,multiplier){
      const [x,,z]=await position();
      await stage([x,z],yaw);
      await page.locator('#speed-panel input').evaluate((slider,value)=>{
        slider.value=String(value);slider.dispatchEvent(new Event('input',{bubbles:true}));
      },multiplier);
      await page.keyboard.down('w');
      try{
        return await page.evaluate(({label,destination,yaw})=>new Promise(resolve=>{
          const canvas=document.querySelector('#game canvas'),start=performance.now();
          const overlay=document.querySelector('#cherry-streaming-overlay');
          let previous=start,last=0,previousCoverage=null;
          const intervals=[],samples=[],jumps=[],events=[];
          const known=new Map();
          function tick(now){
            intervals.push(now-previous);previous=now;
            const {cherryHill,renderer,sectors}=window.inspectWorldStreaming();
            const position=JSON.parse(canvas.dataset.reviewPose).position.local;
            const coverage=cherryHill.detailCoverage+(1-cherryHill.detailCoverage)*cherryHill.lowCoverage;
            const ms=now-window.cherryVideoStart;
            if(previousCoverage!==null&&Math.abs(previousCoverage-coverage)>.27)
              jumps.push({ms,from:previousCoverage,to:coverage,position});
            previousCoverage=coverage;
            for(const sector of sectors.filter(s=>s.id.startsWith('high-park:cherry-hill:'))){
              if(known.get(sector.id)!==sector.state){
                known.set(sector.id,sector.state);events.push({ms,id:sector.id,state:sector.state,coverage,position});
              }
            }
            if(now-last>150){
              samples.push({ms,position,lod:cherryHill.lod,coverage,renderer});
              overlay.textContent=`${(ms/1000).toFixed(1)} s · ${label} · ${cherryHill.lod??'base'} · cobertura ${Math.round(coverage*100)}%`;
              last=now;
            }
            if((yaw===0?position[2]<=destination:position[2]>=destination)||now-start>=28000)
              resolve({label,intervals:intervals.slice(1),samples,events,jumps,end:position});
            else requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        }),{label,destination,yaw});
      }finally{await page.keyboard.up('w');}
    }
    legs.push(await walk('Aproximação',Math.PI,733,3));
    legs.push(await walk('Sob as copas',Math.PI,784,1));
    const arrived=await stats(page);
    legs.push(await walk('Saída',0,489,5));
    await waitLod(page,null);
    const unloaded=await stats(page);
    legs.push(await walk('Retorno',Math.PI,750,5));
    const returned=await stats(page);
    assert.ok(legs.every((leg,i)=>Math.abs(leg.end[2]-[733,784,489,750][i])<3),'Trecho da rota ficou incompleto.');
    assert.ok(legs[0].samples.some(sample=>sample.lod==='low'),'LOD distante não observado.');
    assert.ok(legs[3].samples.some(sample=>sample.lod==='high'&&sample.coverage>.99),'Detalhe não recuperado no retorno.');
    assert.deepEqual(legs.flatMap(leg=>leg.jumps),[],'Uma camada de árvores surgiu ou desapareceu abruptamente.');
    assert.ok(arrived.cherryHill.trees>=10);
    assert.equal(unloaded.cherryHill.assets.decodedActive,0);
    assert.equal(returned.cherryHill.assets.downloads,arrived.cherryHill.assets.downloads);
    assert.deepEqual(errors,[]);
    const video='cherry-hill-approach.webm';
    const playback=await recording.stop(join(bundle,video));
    const intervals=legs.flatMap(leg=>leg.intervals);
    const route={...frameStatistics(intervals),maxMs:Math.max(...intervals),
      p99Ms:[...intervals].sort((a,b)=>a-b)[Math.ceil(intervals.length*.99)-1],
      longFrames:intervals.filter(ms=>ms>50).length,
      legs:legs.map(({intervals,...leg})=>({...leg,...frameStatistics(intervals)})),
    };
    const mobile=await verifyMobile(browser,target);
    return {status:'passed',video,playback,north,arrived,unloaded,returned,mobile,route};
  }catch(error){return {status:'failed',error:safeMessage(error.message)};}
  finally{try{await recording?.stop();}finally{await context.close();}}
}
