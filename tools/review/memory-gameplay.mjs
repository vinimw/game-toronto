import assert from 'node:assert/strict';
import {join} from 'node:path';
import {enterHighPark} from './camera-evaluation.mjs';
import {MEMORY_ID,memories} from '../../src/memories.js';
import {latLonToLocal} from '../../src/geo.js';

const markers=['approach','interaction','open','album','reentry'];
export const memoryCaptureCount=markers.length*2;
const labels=['Aproximação e brilho','Ação de descoberta','Memória aberta','Álbum desbloqueado','Reentrada no High Park'];

async function exercise(browser,server,bundle,mobile,safeMessage){
  const id=mobile?'mobile':'desktop';
  const viewport=mobile?{width:390,height:844}:{width:1280,height:720};
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await context.newPage(),captures=[],errors=[],checks={};
  page.on('pageerror',error=>errors.push(safeMessage(error.message)));
  page.on('console',message=>{if(message.type()==='error')errors.push(safeMessage(message.text()));});
  page.on('requestfailed',request=>errors.push(safeMessage(request.url()+' '+request.failure()?.errorText)));
  page.on('response',response=>{if(response.status()>=400)errors.push(safeMessage(response.url()+' HTTP '+response.status()));});
  const locate=selector=>page.locator(selector);
  const click=selector=>mobile?locate(selector).tap():locate(selector).click();
  const pose=()=>locate('#game canvas').evaluate(el=>JSON.parse(el.dataset.reviewPose));
  const waitRegion=region=>page.waitForFunction(region=>{
    const app=document.querySelector('#app'),pose=document.querySelector('canvas[data-review-pose]');
    return app.dataset.region===region&&app.getAttribute('aria-busy')==='false'&&
      JSON.parse(pose?.dataset.reviewPose??'null')?.sceneId==='region:'+region;
  },region,{timeout:10000});
  const waitPoint=(position,yaw)=>page.waitForFunction(({position,yaw})=>{
    const {position:{local},movement}=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
    return Math.hypot(local[0]-position[0],local[2]-position[1])<.001&&
      Math.abs(Math.atan2(Math.sin(movement.cameraYaw-yaw),Math.cos(movement.cameraYaw-yaw)))<.001;
  },{position,yaw});
  const stage=async(position,yaw)=>{
    await page.evaluate(([position,yaw])=>window.stageCameraReview(position,yaw),[position,yaw]);
    await waitPoint(position,yaw);
  };
  const action=(visible)=>locate('#action-wrap').waitFor({state:visible?'visible':'hidden',timeout:5000});
  const modal=(visible)=>locate('#modal-layer').waitFor({state:visible?'visible':'hidden',timeout:4000});
  const definition=memories.find(memory=>memory.id===MEMORY_ID);
  const article='[data-memory-id="'+MEMORY_ID+'"]';
  const locked='[data-locked-memory="'+MEMORY_ID+'"]';
  const unlocked='[data-open-memory="'+MEMORY_ID+'"]';
  let point,dispatch,stick;

  async function take(index){
    const number=23+(mobile?markers.length:0)+index;
    const captureId=number+'-memory-'+id+'-'+markers[index];
    const file='screenshots/'+captureId+'.png';
    await locate('#toast').waitFor({state:'hidden',timeout:5000});
    await page.screenshot({path:join(bundle,file),animations:'disabled'});
    const state=await pose();
    captures.push({id:captureId,label:'Memória · '+labels[index]+' · '+id,region:'high-park',file,
      ...state,status:'captured',captureMode:'gameplay',viewport,deviceScaleFactor:1,mobileViewportSimulation:mobile});
  }

  async function drive(forward,until){
    const key=forward?'w':'s';
    if(mobile)await dispatch('touchStart',[stick(0,forward?-38:38)]);
    else await page.keyboard.down(key);
    try{await until();}
    finally{
      if(mobile)await dispatch('touchEnd');
      else await page.keyboard.up(key);
    }
  }

  async function showLocked(){
    await click('#btn-album');
    await locate(locked).waitFor();
    assert.equal(await locate(unlocked).count(),0);
    const content=await locate('#modal-content').textContent();
    assert.ok(!content.includes(definition.narrative)&&!content.includes(definition.description));
    await click('#modal-close');
    await modal(false);
  }

  async function showUnlocked(){
    await click('#btn-album');
    await locate(unlocked).waitFor();
    assert.equal(await locate(unlocked).count(),1);
    assert.equal(await locate(locked).count(),0);
    assert.match(await locate(unlocked).textContent(),/High Park.*Desbloqueada/s);
    assert.equal(await locate('#album-count').textContent(),'1/1');
  }

  try{
    await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
    await page.goto(new URL('/?review=1',server).href);
    await waitRegion('toronto');
    await showLocked();
    ({dispatch,stick}=await enterHighPark(page,context,mobile));
    const entry=await pose(),[portal]=entry.portals;
    assert.equal(entry.origin,'OSM REAL');
    point=entry.memoryPoints.find(memory=>memory.id===MEMORY_ID);
    assert.ok(point);
    const [x,z]=point.position;
    assert.deepEqual(point.marker,[x,0,z]);
    const expected=latLonToLocal(definition.anchor.lat,definition.anchor.lon,entry.geographicOrigin);
    assert.ok(Math.hypot(x-expected[0],z-expected[1])<.01);
    checks.placement={position:point.position,anchor:point.anchor,radius:point.radius};

    await stage([x-point.radius-2,z+2],-Math.PI/2);
    await action(false);
    if(!mobile)await page.keyboard.press('e');
    await modal(false);
    assert.equal((await pose()).memoryPoints[0].discovered,false);
    await take(0);
    await drive(true,()=>action(true));
    await page.getByText(definition.shortTitle,{exact:true}).waitFor();
    assert.equal((await pose()).memoryPoints[0].discovered,true);
    assert.equal((await pose()).memoryPoints[0].unlocked,false);
    await showLocked();
    await drive(false,()=>action(false));
    assert.equal((await pose()).memoryPoints[0].unlocked,false);
    checks.radius=true;
    await drive(true,async()=>{
      await action(true);
      await page.waitForTimeout(170);
    });
    await take(1);
    if(mobile)await click('#action-btn');
    else await page.keyboard.press('e');
    await locate(article).waitFor();
    assert.equal(await locate('#modal-title').textContent(),definition.title);
    assert.match(await locate(article).textContent(),/Memória fictícia de demonstração/);
    await locate(article+' .memory-art').waitFor({state:'visible'});
    await page.waitForFunction(()=>JSON.parse(document.querySelector('canvas[data-review-pose]').dataset.reviewPose).memoryPoints[0]?.unlocked);
    checks.explicitUnlock=true;
    const before=await pose();
    await page.keyboard.down('w');
    await page.keyboard.press('e');
    if(mobile){
      const box=await locate(article).boundingBox();
      const finger={id:2,x:box.x+box.width/2,y:box.y+box.height/2};
      await dispatch('touchStart',[finger]);
      await dispatch('touchMove',[{...finger,x:finger.x+25}]);
      await dispatch('touchEnd');
    }
    await page.waitForTimeout(220);
    await page.keyboard.up('w');
    assert.equal(await locate(article).count(),1);
    const during=await pose();
    assert.deepEqual(during.position,before.position);
    assert.deepEqual(during.camera,before.camera);
    assert.equal(await locate('#game').evaluate(el=>el.inert),true);
    checks.modalLocksGameplay=true;
    await take(2);
    if(mobile)await click('#modal-close');
    else await page.keyboard.press('Escape');
    await modal(false);
    await drive(false,()=>page.waitForTimeout(275));
    const moved=await pose();
    assert.ok(Math.hypot(moved.position.local[0]-during.position.local[0],moved.position.local[2]-during.position.local[2])>.5);
    checks.movementRestored=true;

    await showUnlocked();
    await take(3);
    await click(unlocked);
    await locate(article).waitFor();
    await click('#modal-close');
    await modal(false);
    checks.albumReplay=true;

    await stage(portal.position,Math.PI);
    await page.getByText('Voltar a Toronto',{exact:true}).waitFor();
    await click('#action-btn');
    await waitRegion('toronto');
    await showUnlocked();
    await click('#modal-close');
    await click('#action-btn');
    await waitRegion('high-park');
    assert.equal((await pose()).memoryPoints[0].unlocked,true);
    await stage([x-point.radius+1,z+2],-Math.PI/2);
    await action(true);
    await showUnlocked();
    await click('#modal-close');
    await modal(false);
    await take(4);
    checks.regionRoundTrip=true;

    await page.reload();
    await waitRegion('toronto');
    await showUnlocked();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('game-love-progress-v1')));
    assert.deepEqual(saved.discoveredMemories,[MEMORY_ID]);
    assert.deepEqual(saved.unlockedMemories,[MEMORY_ID]);
    assert.equal(saved.version,2);
    checks.reload=true;
    const reopened=await context.newPage();
    await reopened.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
    await page.close();
    await reopened.goto(new URL('/?review=1',server).href);
    await reopened.waitForFunction(()=>document.querySelector('#app').getAttribute('aria-busy')==='false'&&document.querySelector('canvas[data-review-pose]'));
    if(mobile)await reopened.locator('#btn-album').tap();
    else await reopened.locator('#btn-album').click();
    await reopened.locator(unlocked).waitFor();
    checks.reopening=true;
    assert.deepEqual(errors,[]);
    return {id,status:'passed',viewport,checks,captures,errors};
  }catch(error){
    return {id,status:'failed',viewport,checks,captures,errors,error:safeMessage(error.message)};
  }finally{await context.close();}
}

export async function evaluateMemoryGameplay(browser,server,bundle,safeMessage){
  const scenarios=[];
  for(const mobile of [false,true]){
    const scenario=await exercise(browser,server,bundle,mobile,safeMessage);
    console.log('[review] Memórias '+scenario.id+': '+(scenario.error??scenario.status));
    scenarios.push(scenario);
  }
  return {status:scenarios.every(s=>s.status==='passed')?'passed':'failed',scenarios};
}
