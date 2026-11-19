import assert from 'node:assert/strict';
import {join} from 'node:path';
import {reviewProfiles} from './profiles.js';

const layouts=[
  {width:390,height:844,touch:true,safe:[38,0,28,0],shots:[14,15,16,17,18]},
  {width:375,height:667,touch:true,safe:[24,0,24,0],shots:[19]},
  {width:844,height:390,touch:true,safe:[0,43,20,43],shots:[20]},
  {width:1280,height:720,touch:false,shots:[21]},
];

export const gameplayCaptures=[
  {id:'14-toronto-mobile-hud',label:'Toronto · portal com HUD mobile',region:'toronto'},
  {id:'15-high-park-mobile-hud',label:'High Park · missão compacta e controles',region:'high-park'},
  {id:'16-high-park-mobile-mapa',label:'High Park · mapa local em portrait',region:'high-park'},
  {id:'17-high-park-mobile-missao-expandida',label:'High Park · missão expandida',region:'high-park'},
  {id:'18-high-park-mobile-velocidade-expandida',label:'High Park · velocidade expandida',region:'high-park'},
  {id:'19-high-park-mobile-375',label:'High Park · HUD em 375 × 667',region:'high-park'},
  {id:'20-high-park-mobile-landscape',label:'High Park · HUD em landscape',region:'high-park'},
  {id:'21-high-park-desktop-hud',label:'High Park · HUD no desktop',region:'high-park'},
];

const byShot=Object.fromEntries(gameplayCaptures.map(point=>[Number(point.id.slice(0,2)),point]));
const displacement=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const speedToggle='#speed-panel [data-toggle]';

async function verifyLayout(page,layout,insets=[0,0,0,0],map=false){
  const selectors=map?['#map-panel','#close-map']:
    ['.header-actions','.mission-card','#speed-panel','#action-btn',
      ...(layout.touch?['#joystick','#mobile-run']:[])];
  const boxes=await page.evaluate(selectors=>selectors.map(selector=>{
    const element=document.querySelector(selector),r=element.getBoundingClientRect();
    return {selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
  }),selectors);
  const [top,right,bottom,left]=insets;
  for(const box of boxes){
    assert.ok(box.width>0&&box.height>0,box.selector+' invisível');
    assert.ok(box.x>=left-.5&&box.y>=top-.5&&box.right<=layout.width-right+.5&&box.bottom<=layout.height-bottom+.5,
      box.selector+' fora da área segura em '+layout.width+' × '+layout.height);
  }
  if(map){
    assert.ok(boxes[1].width>=44&&boxes[1].height>=44,'Alvo insuficiente para fechar o mapa');
    return;
  }
  for(const [i,a] of boxes.entries())for(const b of boxes.slice(i+1)){
    assert.ok(a.right<=b.x+.5||b.right<=a.x+.5||a.bottom<=b.y+.5||b.bottom<=a.y+.5,
      'Sobreposição entre '+a.selector+' e '+b.selector+' em '+layout.width+' × '+layout.height);
  }
}

async function captureLayout(browser,url,dir,layout,safeMessage){
  const viewport={width:layout.width,height:layout.height};
  const {deviceScaleFactor}=reviewProfiles.mobile;
  const page=await browser.newPage({viewport,deviceScaleFactor,isMobile:layout.touch,hasTouch:layout.touch,
    reducedMotion:'reduce',locale:'pt-BR',timezoneId:'UTC',serviceWorkers:'block'});
  const captures=[],issues=[];
  const summary={viewport,touch:layout.touch,status:'passed'};
  let current='gameplay-'+layout.width+'x'+layout.height;
  const record=(type,message)=>issues.push({type,captureId:current,message:safeMessage(message)});
  page.on('pageerror',error=>record('javascript',error.message));
  page.on('console',message=>{
    if(message.type()==='error'&&!message.location().url.endsWith('/favicon.ico'))record('console.error',message.text());
  });
  page.on('response',response=>{
    if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))
      record('asset-http-error',response.status()+' '+response.url());
  });
  page.on('requestfailed',request=>record('asset-request-failed',request.url()+' '+request.failure()?.errorText));
  await page.route('**/*',route=>{
    const resource=new URL(route.request().url());
    if(resource.origin==='https://fonts.googleapis.com'&&route.request().resourceType()==='stylesheet')
      return route.fulfill({status:200,contentType:'text/css',body:''});
    return resource.origin===url.origin?route.continue():route.abort();
  });

  const click=selector=>layout.touch?page.locator(selector).tap():page.locator(selector).click();
  const waitAction=label=>page.waitForFunction(label=>{
    const button=document.querySelector('#action-wrap');
    return !button.classList.contains('hidden')&&button.textContent.includes(label);
  },label,{timeout:10000});
  const waitScene=region=>page.waitForFunction(region=>{
    const app=document.querySelector('#app');
    return app.dataset.region===region&&app.getAttribute('aria-busy')==='false';
  },region,{timeout:10000});
  const readPose=async()=>JSON.parse(await page.locator('#game canvas').getAttribute('data-review-pose'));
  async function take(shot){
    if(!layout.shots.includes(shot))return;
    const point=byShot[shot];
    current=point.id;
    await page.locator('#toast').waitFor({state:'hidden',timeout:5000});
    const pose=await readPose();
    assert.equal(pose.origin,point.region==='toronto'?'DEMO':'OSM REAL');
    const hud=await page.evaluate(()=>{
      const visible=selector=>document.querySelector(selector).getBoundingClientRect().width>0;
      return {joystick:visible('#joystick'),run:visible('#mobile-run'),interaction:visible('#action-btn'),
        localMap:visible('#map-panel'),speed:document.querySelector('[data-multiplier]').textContent,
        speedExpanded:visible('#speed-panel-body'),missionExpanded:visible('#mission-details')};
    });
    const file='screenshots/'+point.id+'.png';
    await page.screenshot({path:join(dir,file),animations:'disabled',timeout:10000});
    captures.push({...point,...pose,file,status:'captured',captureMode:'gameplay',
      hud:{...hud,layoutVersion:'1',fontSource:'system-fallback'},
      viewport,deviceScaleFactor,mobileViewportSimulation:layout.touch});
    console.log('[review] capturado '+point.id);
  }

  try{
    await page.goto(url.href,{waitUntil:'load',timeout:15000});
    await waitScene('toronto');
    await page.waitForFunction(()=>document.querySelector('#game canvas')?.dataset.reviewPose);
    const client=layout.touch?await page.context().newCDPSession(page):null;
    const dispatch=(type,touchPoints=[])=>client.send('Input.dispatchTouchEvent',{type,touchPoints});
    const joystickPoint=async(dx=0,dy=-31)=>{
      const joy=await page.locator('#joystick').boundingBox();
      assert.ok(joy,'Joystick ausente');
      return {id:1,x:joy.x+joy.width/2+dx,y:joy.y+joy.height/2+dy};
    };
    async function verifyDirectionChange(){
      const before=await readPose();
      if(layout.touch)await dispatch('touchStart',[await joystickPoint(31,0)]);
      else await page.keyboard.down('d');
      try{
        await page.waitForFunction(before=>{
          const pose=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
          const angle=(a,b)=>Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)));
          const [x,,z]=pose.position.local,[startX,,startZ]=before.position.local;
          return Math.hypot(x-startX,z-startZ)>1&&angle(before.orbit.yaw,pose.orbit.yaw)>.35&&
            angle(before.position.headingRadians,pose.position.headingRadians)>.7;
        },before,{timeout:1400});
        const after=await readPose();
        const [x,,z]=after.position.local,[startX,,startZ]=before.position.local;
        const drift=Math.abs((x-startX)*Math.sin(before.orbit.yaw)+(z-startZ)*Math.cos(before.orbit.yaw));
        assert.ok(drift<.08,'A rotação automática desviou a trajetória lateral');
        return {distanceMeters:displacement(before.position.local,after.position.local),crossTrackMeters:drift};
      }finally{
        if(layout.touch)await dispatch('touchEnd');
        else await page.keyboard.up('d');
      }
    }
    const start=(await readPose()).position.local;
    if(layout.touch)await dispatch('touchStart',[await joystickPoint()]);
    else await page.keyboard.down('w');
    try{await waitAction('Entrar no High Park');}
    finally{
      if(layout.touch)await dispatch('touchEnd');
      else await page.keyboard.up('w');
    }
    summary.walkMeters=displacement(start,(await readPose()).position.local);
    assert.ok(summary.walkMeters>1,'A personagem não caminhou até a entrada');

    await click('#action-btn');await waitScene('high-park');await waitAction('Voltar a Toronto');
    assert.equal(await page.locator('#mission-details').isVisible(),!layout.touch);
    assert.equal(await page.locator('#speed-panel-body').isVisible(),!layout.touch);
    await verifyLayout(page,layout);
    for(const shot of [15,19,20,21])await take(shot);
    if(layout.touch){
      await click('#mission-toggle');
      assert.ok(await page.locator('#mission-details').isVisible());
      await take(17);
      await click('#mission-toggle');
      assert.equal(await page.locator('#mission-details').isVisible(),false);
      await click(speedToggle);
      assert.ok(await page.locator('#speed-panel-body').isVisible());
      await take(18);
      await click('[data-plus]');
      assert.equal(await page.locator('[data-multiplier]').textContent(),'1,5×');
      await click('[data-normal]');
      assert.equal(await page.locator('[data-multiplier]').textContent(),'1×');

      await click('#mission-toggle');
      await page.evaluate(insets=>{
        const root=document.querySelector('#app');
        ['top','right','bottom','left'].forEach((side,i)=>root.style.setProperty('--hud-safe-'+side,insets[i]+'px'));
      },layout.safe);
      await verifyLayout(page,layout,layout.safe);
      await click('#btn-map');
      assert.ok(await page.locator('#map-canvas').isVisible());
      await verifyLayout(page,layout,layout.safe,true);
      await click('#close-map');
      await page.evaluate(()=>{
        const root=document.querySelector('#app');
        for(const side of ['top','right','bottom','left'])root.style.removeProperty('--hud-safe-'+side);
      });
      summary.simulatedSafeInsets=layout.safe;
      await click('#mission-toggle');
      await click(speedToggle);
      assert.equal(await page.locator('#speed-panel-body').isVisible(),false);
    }

    await click('#btn-map');
    await page.locator('#map-canvas').waitFor({state:'visible'});
    await verifyLayout(page,layout,[0,0,0,0],true);
    await take(16);
    const modalPose=await readPose();
    assert.ok(await page.locator('#game').evaluate(element=>element.inert));
    await page.keyboard.down('w');
    try{
      if(layout.touch){
        const surface=await page.locator('#map-canvas').boundingBox();
        const x=surface.x+surface.width/2,y=surface.y+surface.height/2;
        await dispatch('touchStart',[{id:2,x,y}]);
        await dispatch('touchMove',[{id:2,x:x+28,y}]);
      }
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const pose=await readPose();
      assert.equal(displacement(pose.position.local,modalPose.position.local),0,'O mapa permitiu deslocamento');
      assert.equal(pose.orbit.yaw,modalPose.orbit.yaw,'O mapa permitiu girar a câmera');
    }finally{
      if(layout.touch)await dispatch('touchEnd');
      await page.keyboard.up('w');
    }
    await click('#close-map');
    assert.equal(await page.locator('#map-panel').isVisible(),false);
    await click('#btn-help');
    assert.ok(await page.locator('#modal-layer').isVisible());
    assert.ok(await page.locator('#game').evaluate(element=>element.inert));
    await click('#modal-close');
    await waitAction('Voltar a Toronto');
    summary.cameraFollow={highPark:await verifyDirectionChange()};
    await click('#action-btn');await waitScene('toronto');await waitAction('Entrar no High Park');
    await take(14);
    summary.roundTrip=true;
    summary.cameraFollow.toronto=await verifyDirectionChange();

    if(layout.touch){
      const before=await readPose();
      const joy=await joystickPoint(),finger={id:2,x:Math.round(layout.width*.45),y:Math.round(layout.height*.46)};
      await dispatch('touchStart',[joy,finger]);
      try{
        await dispatch('touchMove',[joy,{...finger,x:finger.x+54,y:finger.y+14}]);
        await page.waitForFunction(before=>{
          const pose=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
          return Math.abs(pose.orbit.yaw-before.orbit.yaw)>.2&&
            Math.hypot(pose.position.local[0]-before.position.local[0],pose.position.local[2]-before.position.local[2])>.45;
        },before,{timeout:3500});
        const after=await readPose();
        summary.simultaneousTouch={distanceMeters:displacement(before.position.local,after.position.local),
          yawRadians:Math.abs(after.orbit.yaw-before.orbit.yaw)};
      }finally{await dispatch('touchEnd');}
      const gestures=await page.evaluate(()=>({scale:visualViewport.scale,x:scrollX,y:scrollY,text:getSelection().toString()}));
      assert.deepEqual(gestures,{scale:1,x:0,y:0,text:''});
    }
  }catch(error){
    const reason=safeMessage(error.message);
    Object.assign(summary,{status:'failed',reason});
    record('gameplay-validation-failed',reason);
    for(const shot of layout.shots)if(!captures.some(capture=>capture.id===byShot[shot].id))
      captures.push({...byShot[shot],status:'failed',reason});
  }finally{await page.close();}
  if(issues.length)summary.status='failed';
  return {captures,issues,summary};
}

export async function captureMobileGameplay(browser,target,dir,safeMessage){
  const captures=[],issues=[],viewports=[];
  for(const layout of layouts){
    const result=await captureLayout(browser,new URL('/?review=1',target),dir,layout,safeMessage);
    captures.push(...result.captures);issues.push(...result.issues);viewports.push(result.summary);
  }
  captures.sort((a,b)=>a.id.localeCompare(b.id));
  return {captures,issues,touch:{status:viewports.every(viewport=>viewport.status==='passed')?'passed':'failed',
    environment:'Chromium, com toque CDP e insets CSS simulados nos três viewports móveis.',viewports}};
}
