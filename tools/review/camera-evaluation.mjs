import assert from 'node:assert/strict';
import {join} from 'node:path';
import {angleDelta} from '../../src/camera-follow.js';

export async function evaluateCamera(browser,server,bundle,stage){
  const viewport={width:390,height:844};
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,
    reducedMotion:'reduce',recordVideo:{dir:stage,size:viewport}});
  const page=await context.newPage();
  const video=page.video(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
    await page.goto(new URL('/?review=1',server).href);
    await page.waitForSelector('#game canvas[data-review-pose]');
    const touch=await context.newCDPSession(page);
    const dispatch=(type,touchPoints=[])=>touch.send('Input.dispatchTouchEvent',{type,touchPoints});
    const joystick=await page.locator('#joystick').boundingBox();
    const stick=(dx,dy)=>({id:1,x:joystick.x+joystick.width/2+dx,y:joystick.y+joystick.height/2+dy});
    const direction=stick(0,-38);
    await dispatch('touchStart',[direction]);
    try{await page.locator('#action-btn').waitFor({timeout:6000});}
    finally{await dispatch('touchEnd');}
    await page.locator('#action-btn').tap();
    await page.waitForFunction(()=>document.querySelector('#app').dataset.region==='high-park'
      && document.querySelector('#app').getAttribute('aria-busy')==='false');
    assert.equal(await page.locator('[data-multiplier]').textContent(),'1×');

    await page.evaluate(()=>{
      const canvas=document.querySelector('#game canvas');
      const trace=window.cameraTrace={phase:'idle',samples:[],active:true};
      const start=performance.now();
      function sample(now){
        if(!trace.active)return;
        const {position,orbit,movement}=JSON.parse(canvas.dataset.reviewPose);
        trace.samples.push({ms:now-start,phase:trace.phase,position:position.local,
          characterHeading:position.headingRadians,cameraYaw:orbit.yaw,renderedCameraYaw:orbit.renderedYaw,...movement});
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    const phase=name=>page.evaluate(name=>{window.cameraTrace.phase=name;},name);
    const walk=async(name,dx,dy,ms)=>{
      await phase(name);
      await dispatch('touchStart',[stick(dx,dy)]);
      try{await page.waitForTimeout(ms);}
      finally{await dispatch('touchEnd');}
      await phase('idle');
      await page.waitForTimeout(250);
    };
    await walk('straight',0,-38,2600);
    await walk('lateral',38,0,2500);
    await walk('diagonal',-27,-27,1900);

    await phase('manual');
    const first=stick(38,0),second={id:2,x:196,y:345};
    await dispatch('touchStart',[first,second]);
    try{
      await page.waitForTimeout(200);
      await dispatch('touchMove',[first,{...second,x:second.x+85}]);
      await page.waitForTimeout(1100);
      await phase('resume');
      await page.waitForTimeout(1900);
    }finally{await dispatch('touchEnd');}
    await walk('reverse',0,38,1900);
    await page.waitForTimeout(550);
    const samples=await page.evaluate(()=>{
      window.cameraTrace.active=false;
      return window.cameraTrace.samples;
    });

    assert.deepEqual(errors,[]);
    const measurements={};
    for(const name of ['straight','lateral','diagonal','manual','resume','reverse']){
      const moving=samples.filter(sample=>sample.phase===name&&Math.hypot(...sample.direction)>.1);
      assert.ok(moving.length>5,'Movimento não detectado: '+name);
      const a=moving[0],b=moving.at(-1);
      const dx=b.position[0]-a.position[0],dz=b.position[2]-a.position[2];
      const [x,z]=a.direction;
      const drift=Math.abs(dx*z-dz*x)/Math.hypot(x,z);
      const turn=Math.abs(angleDelta(a.cameraYaw,b.cameraYaw));
      measurements[name]={distanceMeters:Math.hypot(dx,dz),crossTrackMeters:drift,cameraTurnRadians:turn};
      if(['straight','lateral','diagonal','reverse'].includes(name))assert.ok(drift<.15,'Desvio em '+name);
      if(name==='lateral'||name==='resume')assert.ok(turn>.25,'Giro ausente em '+name);
      if(name==='reverse')assert.ok(turn<.01,'Giro indevido na marcha à ré');
    }
    await context.close();
    await video.saveAs(join(bundle,'camera-evaluation.webm'));
    return {status:'passed',viewport,speedMultiplier:1,measurements,samples,video:'camera-evaluation.webm'};
  }finally{await context.close();}
}
