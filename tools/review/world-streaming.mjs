import assert from 'node:assert/strict';
import {join} from 'node:path';
import {enterHighPark,sampleMovement} from './camera-evaluation.mjs';
import {startViewportVideo} from './full-viewport-video.mjs';
import {frameStatistics} from './motion-benchmark.js';

const entrance='high-park:north-entrance';
const application=page=>page.locator('#app');
const pose=page=>page.locator('#game canvas').evaluate(canvas=>JSON.parse(canvas.dataset.reviewPose));
const capture=page=>page.evaluate(()=>window.inspectWorldStreaming());
const stage=(page,point,yaw)=>page.evaluate(([point,yaw])=>window.stageCameraReview(point,yaw),[point,yaw]);
const waitEntrance=(page,state='active')=>page.waitForFunction(([id,state])=>
  window.inspectWorldStreaming?.().sectors?.find(sector=>sector.id===id)?.state===state,[entrance,state],{timeout:10000});
const mapReady=(page,region)=>page.waitForFunction(region=>
  document.querySelector('#app').dataset.region===region&&document.querySelector('#app').getAttribute('aria-busy')==='false',region);

async function timings(page){
  return page.evaluate(()=>{
    const timing=window.inspectWorldStreaming();
    const resources=performance.getEntriesByType('resource').filter(entry=>{
      const url=new URL(entry.name);
      return url.origin===location.origin&&/^\/(assets\/north-entrance\/|data\/)/.test(url.pathname);
    });
    const totals=entries=>({requests:entries.length,transferBytes:entries.reduce((sum,item)=>sum+item.transferSize,0),
      encodedBodyBytes:entries.reduce((sum,item)=>sum+item.encodedBodySize,0)});
    return {firstImageMs:timing.firstImageMs,movementReadyMs:timing.movementReadyMs,
      firstLandmarkVisibleMs:timing.firstLandmarkVisibleMs,firstLandmarkDetailedMs:timing.firstLandmarkDetailedMs,
      sceneActivationMs:timing.sceneActivationMs,base:totals(resources.filter(item=>new URL(item.name).pathname.startsWith('/data/'))),
      detail:totals(resources.filter(item=>new URL(item.name).pathname.startsWith('/assets/'))),
      sectorsActive:timing.sectors.filter(item=>item.state==='active').length};
  });
}

async function open(browser,target,mobile,eager=false,blockEntrance=false){
  const viewport=mobile?{width:390,height:844}:{width:1280,height:720};
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],failures=[];
  try{
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    page.on('requestfailed',request=>{
      const url=new URL(request.url());
      if(url.origin===new URL(target).origin&&url.pathname.startsWith('/assets/north-entrance/'))
        failures.push({file:url.pathname.split('/').at(-1),code:request.failure()?.errorText});
    });
    await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
    if(blockEntrance)await page.route('**/grass_medium_01-arm.jpg',route=>route.abort('failed'));
    await page.goto(new URL('/?review=1&park=expanded'+(eager?'&streaming=eager':''),target).href);
    await page.waitForSelector('#game canvas[data-review-pose]');
    await mapReady(page,'toronto');
    return {page,context,errors,failures,viewport};
  }catch(error){await context.close();throw error;}
}

async function hold(page,controls,task){
  if(controls.dispatch)await controls.dispatch('touchStart',[controls.stick(0,-38)]);
  else await page.keyboard.down('w');
  try{return await task();}
  finally{
    if(controls.dispatch)await controls.dispatch('touchEnd');
    else await page.keyboard.up('w');
  }
}

async function travelLeg(page,controls,south){
  const initial=(await pose(page)).position.local;
  await stage(page,[initial[0],initial[2]],south?Math.PI:0);
  const result=await hold(page,controls,()=>page.evaluate(south=>new Promise(resolve=>{
    const canvas=document.querySelector('#game canvas');
    const start=performance.now(),finish=south?310:-105;
    let previous=start,last=0;
    const intervals=[],samples=[],stalls=[];
    function tick(now){
      const [x,y,z]=JSON.parse(canvas.dataset.reviewPose).position.local;
      const dt=now-previous;
      intervals.push(dt);previous=now;
      if(dt>50){
        const diagnostic=window.inspectWorldStreaming();
        stalls.push({ms:now-start,dt,lastRenderMs:diagnostic.lastRenderMs,
          sectorEvents:diagnostic.sectors.filter(sector=>sector.lastEvent&&now-sector.lastEvent.at<250)
            .map(({id,lastEvent,buildMs})=>({id,buildMs,...lastEvent}))});
      }
      if(now-last>=250){
        const {sectors,landmarkState,renderer,estimatedTextureAndShadowBytes}=window.inspectWorldStreaming();
        const label=document.querySelector('#streaming-video-overlay');
        if(label)label.textContent=`${((now-Number(label.dataset.start))/1000).toFixed(2)} s · ${landmarkState} · ${sectors.find(s=>s.id==='high-park:north-entrance').state} · ${sectors.filter(s=>s.state==='active').map(s=>s.id.replace('high-park:','')).join(', ')}`;
        samples.push({ms:now-start,videoMs:label?now-Number(label.dataset.start):null,landmarkState,position:[x,y,z],sectors:sectors.filter(item=>item.state==='active').map(item=>item.id),
          drawCalls:renderer.calls,triangles:renderer.triangles,textures:renderer.textures,geometries:renderer.geometries,
          estimatedTextureAndShadowBytes});
        last=now;
      }
      if((south?z>=finish:z<=finish)||now-start>23000)resolve({intervals,samples,stalls,end:[x,y,z]});
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }),south));
  assert.ok(south?result.end[2]>=310:result.end[2]<=-105,'Percurso entre setores ficou incompleto: '+result.end);
  const stops=result.intervals.slice(1),stats=frameStatistics(stops);
  const sorted=[...stops].sort((a,b)=>a-b);
  return {start:initial,end:result.end,...stats,frameTimeMaxMs:sorted.at(-1),frameTimeP99Ms:sorted[Math.ceil(sorted.length*.99)-1],
    stalls:result.stalls,longFrames:stops.filter(ms=>ms>50).length,samples:result.samples};
}

async function exploration(browser,target,mobile,bundle){
  const {page,context,errors,failures,viewport}=await open(browser,target,mobile);
  let recording,video;
  try{
    const controls=await enterHighPark(page,context,mobile);
    await page.waitForFunction(()=>Number.isFinite(window.inspectWorldStreaming?.().firstImageMs));
    const coldStart=await timings(page);
    const arrival=(await pose(page)).position.local;
    await stage(page,[arrival[0],arrival[2]],0);
    await waitEntrance(page);
    await page.waitForFunction(()=>Number.isFinite(window.inspectWorldStreaming().firstLandmarkDetailedMs));
    const coldDetail=await timings(page);
    assert.ok(coldStart.base.transferBytes>0);
    const before=await capture(page);
    assert.ok(before.assets?.downloads>0);

    await stage(page,[-8,-104],Math.PI);
    await page.waitForFunction(()=>Math.abs(JSON.parse(document.querySelector('#game canvas').dataset.reviewPose).position.local[0]+8)<.001);
    await stage(page,[-8,-104],Math.PI);
    await page.locator('#speed-panel input').evaluate(slider=>{
      slider.value='5';
      slider.dispatchEvent(new Event('input',{bubbles:true}));
    });
    const cycles=[];
    for(let i=0;i<(mobile?1:2);i++){
      if(i===0){
        await stage(page,[-8,-104],0);
        await page.evaluate(()=>{
          const label=document.createElement('div');
          label.id='streaming-video-overlay';
          label.dataset.start=performance.now();
          label.textContent='Entrada norte · detailed · active';
          label.style='position:fixed;z-index:99;left:8px;bottom:28%;pointer-events:none;background:#16271dea;color:white;padding:6px;font:11px monospace;max-width:92vw';
          document.body.append(label);
        });
        recording=await startViewportVideo(page,viewport,12,{touchControls:mobile});
        await page.waitForTimeout(600);
      }
      const outward=await travelLeg(page,controls,true);
      await waitEntrance(page,'idle');
      const distant=await capture(page);
      assert.equal(distant.assets.decodedActive,1);
      assert.ok(distant.renderer.textures<before.renderer.textures,'Texturas da entrada continuam no renderer.');
      const traversed=before.sectors.filter(({id,bounds:[x,z,east,south]})=>
        id!==entrance&&x<=-8&&east>-8&&z<outward.end[2]&&south>outward.start[2]).map(sector=>sector.id);
      assert.ok(traversed.length>=3,'O percurso precisa cruzar pelo menos três setores do piloto.');
      const inbound=await travelLeg(page,controls,false);
      await waitEntrance(page);
      const returned=await capture(page);
      assert.equal(returned.assets.downloads,before.assets.downloads,'Assets baixados novamente ao retornar.');
      assert.ok(returned.assets.cacheHits>before.assets.cacheHits);
      cycles.push({traversed,outward,distant,inbound,returned});
      if(i===0){
        const file=mobile?'world-streaming-roundtrip-mobile.webm':'world-streaming-roundtrip-desktop.webm';
        video={file,viewport,validation:await recording.stop(join(bundle,file)),cycle:0,
          timeline:'cycles[0].outward.samples / inbound.samples, videoMs relative to overlay'};
        await page.locator('#streaming-video-overlay').evaluate(label=>label.remove());
      }
    }
    const returned=cycles.at(-1).returned;
    const baseline=cycles[0].returned;
    assert.equal(returned.assets.cacheEntries,baseline.assets.cacheEntries);
    assert.equal(returned.assets.decodedActive,baseline.assets.decodedActive);
    assert.equal(returned.renderer.textures,baseline.renderer.textures);
    assert.ok(returned.renderer.geometries<=baseline.renderer.geometries+5,'A contagem de geometrias cresceu após a volta.');

    // Review-only repositioning validates the same streaming path as a distant
    // arrival. The game has no fast-travel UI.
    const far=[-182,759];
    await stage(page,far,Math.PI/2);
    await page.waitForFunction(far=>{
      const {position}=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
      return Math.hypot(position.local[0]-far[0],position.local[2]-far[1])<.001;
    },far);
    await waitEntrance(page,'idle');
    const distantLanding=await capture(page);
    assert.equal(distantLanding.assets.decodedActive,1);
    assert.equal(await application(page).getAttribute('aria-busy'),'false');

    const detail=await pose(page);
    const memory=detail.memoryPoints[0];
    assert.ok(memory,'A memória precisa estar disponível sem os assets da entrada.');
    await stage(page,memory.position,Math.PI);
    const action=page.locator('#action-btn'),modalClose=page.locator('#modal-close');
    await page.getByText('Pausa no parque',{exact:true}).waitFor({timeout:6000});
    if(mobile)await action.tap();
    else await action.click();
    await page.locator('[data-memory-id]').waitFor();
    if(mobile)await modalClose.tap();
    else await modalClose.click();
    await page.locator('#modal-layer').waitFor({state:'hidden'});
    const gate=detail.portals[0].position;
    await stage(page,gate,Math.PI);
    await page.getByText('Voltar a Toronto',{exact:true}).waitFor();
    if(mobile)await page.locator('#action-btn').tap();
    else await page.locator('#action-btn').click();
    await mapReady(page,'toronto');
    const toronto=await capture(page);
    await page.evaluate(()=>performance.clearResourceTimings());
    await page.getByText('Entrar no High Park',{exact:true}).waitFor();
    if(mobile)await page.locator('#action-btn').tap();
    else await page.locator('#action-btn').click();
    await mapReady(page,'high-park');
    await waitEntrance(page);
    const warm=await timings(page);
    const reentry=await capture(page);
    assert.equal(reentry.assets.downloads,before.assets.downloads);
    assert.equal(warm.detail.requests,0,'A reentrada realizou requisições de arte.');
    assert.ok(toronto.renderer.textures<reentry.renderer.textures);
    // A reload clears JS leases and RAM cache. The browser HTTP cache can persist.
    await page.reload();
    await page.waitForSelector('#game canvas[data-review-pose]');
    await mapReady(page,'toronto');
    const restart=await capture(page);
    assert.equal(await page.locator('#album-count').textContent(),'1/1');
    assert.equal(restart.sectors,undefined);
    assert.deepEqual(errors,[]);
    assert.deepEqual(failures,[]);
    return {status:'passed',mobile,viewport,coldStart,coldDetail,before,cycles,distantLanding,toronto,warm,reentry,restart,
      ...(video?{video}:{})};
  }finally{try{await recording?.stop();}finally{await context.close();}}
}

async function eagerComparison(browser,target,mobile){
  const {page,context,errors,failures}=await open(browser,target,mobile,true);
  try{
    await enterHighPark(page,context,mobile);
    await page.waitForFunction(()=>Number.isFinite(window.inspectWorldStreaming?.().firstImageMs));
    assert.equal((await capture(page)).sectors.find(item=>item.id===entrance).state,'active');
    assert.deepEqual(errors,[]);
    assert.deepEqual(failures,[]);
    return await timings(page);
  }finally{await context.close();}
}

async function networkRecovery(browser,target){
  const {page,context,errors,failures}=await open(browser,target,false,false,true);
  try{
    let releaseMap;
    const mapAvailable=new Promise(resolve=>{releaseMap=resolve;});
    await page.route('**/high-park-expanded.osm.json',async route=>{await mapAvailable;await route.continue();});
    const [controls]=await Promise.all([enterHighPark(page,context,false),(async()=>{
      try{
        await page.getByText('Dados geográficos',{exact:true}).waitFor({timeout:10000});
        assert.equal(await page.locator('#transition-retry').isVisible(),false);
        assert.equal(await application(page).getAttribute('aria-busy'),'true');
      }finally{releaseMap();}
    })()]);
    await waitEntrance(page,'failed');
    await stage(page,[-8,-104],Math.PI);
    const walk=await hold(page,controls,()=>sampleMovement(page,750));
    assert.ok(walk.at(-1).position[2]-walk[0].position[2]>2,'A falha bloqueou os controles.');
    const failed=await capture(page);
    await page.unroute('**/grass_medium_01-arm.jpg');
    await waitEntrance(page);
    const recovered=await capture(page);
    assert.equal(recovered.sectors.find(item=>item.id===entrance).failures>=1,true);
    assert.equal(failures.some(item=>item.file==='grass_medium_01-arm.jpg'&&item.code==='net::ERR_FAILED'),true);
    assert.ok(errors.every(message=>/net::ERR_(FAILED|ABORTED)/.test(message)),errors.join('\n'));
    return {status:'passed',failed,recovered,expectedNetworkFailures:failures,expectedConsoleErrors:errors};
  }finally{await context.close();}
}

export async function evaluateWorldStreaming(browser,target,bundle,safeMessage){
  const cases=[];
  for(const mobile of [false,true]){
    try{
      const eager=await eagerComparison(browser,target,mobile);
      const streaming=await exploration(browser,target,mobile,bundle);
      cases.push({status:'passed',mobile,eager,streaming});
    }catch(error){cases.push({status:'failed',mobile,error:safeMessage(error.message)});}
    console.log('[review] Streaming '+(mobile?'mobile':'desktop')+': '+cases.at(-1).status+(cases.at(-1).error?' · '+cases.at(-1).error:''));
  }
  let network;
  try{network=await networkRecovery(browser,target);}
  catch(error){network={status:'failed',error:safeMessage(error.message)};}
  console.log('[review] Streaming recuperação: '+network.status+(network.error?' · '+network.error:''));
  return {status:network.status==='passed'&&cases.every(item=>item.status==='passed')?'passed':'failed',
    method:'Chromium no mesmo executável e mapa. Controle eager pré-carrega os mesmos setores antes de permitir movimento. Mobile emulado. transferBytes vem de Resource Timing e inclui os cabeçalhos; cache binário tem métricas próprias.',
    cases,network,videos:cases.flatMap(item=>item.streaming?.video?[item.streaming.video.file]:[])};
}
