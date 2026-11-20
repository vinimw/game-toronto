import {join} from 'node:path';
import {angleDelta} from '../../src/camera-follow.js';

const durationMs=10000;
const cameraError=(a,b)=>Math.abs(angleDelta(a,b));
const toleranceMetersPerSecond=.08;
const scenarios=[
  {id:'keyboard-right',keys:['d'],expected:[1,0]},
  {id:'keyboard-diagonal',keys:['w','d'],expected:[Math.SQRT1_2,Math.SQRT1_2]},
  {id:'joystick-right',stick:[38,0],expected:[1,0]},
  {id:'joystick-diagonal',stick:[27,-27],expected:[Math.SQRT1_2,Math.SQRT1_2]},
];

async function evaluateScenario(browser,server,bundle,stage,scenario,record){
  const mobile=Boolean(scenario.stick);
  const viewport=mobile?{width:390,height:844}:{width:1280,height:720};
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce',
    ...(record?{recordVideo:{dir:stage,size:viewport}}:{})});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const video=page.video();
  let samples=[],releasePassed=true;
  try{
    const url=new URL('/?review=1',server);
    if(record){
      url.searchParams.set('movement-debug','1');
      url.searchParams.set('movement-scenario',scenario.id==='joystick-right'?'Joystick à direita':'Joystick na diagonal');
    }
    await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
    await page.goto(url.href);
    await page.waitForSelector('#game canvas[data-review-pose]');
    const portal=page.locator('#action-btn');
    let dispatch,stick;
    if(mobile){
      const touch=await context.newCDPSession(page);
      dispatch=(type,touchPoints=[])=>touch.send('Input.dispatchTouchEvent',{type,touchPoints});
      const box=await page.locator('#joystick').boundingBox();
      stick=(dx,dy)=>({id:1,x:box.x+box.width/2+dx,y:box.y+box.height/2+dy});
      await dispatch('touchStart',[stick(0,-38)]);
      try{await portal.waitFor({timeout:6000});}
      finally{await dispatch('touchEnd');}
      await portal.tap();
    }else{
      await page.keyboard.down('w');
      try{await portal.waitFor({timeout:6000});}
      finally{await page.keyboard.up('w');}
      await portal.click();
    }
    await page.waitForFunction(()=>document.querySelector('#app').dataset.region==='high-park'
      && document.querySelector('#app').getAttribute('aria-busy')==='false');

    if(mobile)await dispatch('touchStart',[stick(...scenario.stick)]);
    else for(const key of scenario.keys)await page.keyboard.down(key);
    try{
      await page.waitForFunction(expected=>{
        const {movement}=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
        return movement.input.every((value,i)=>Math.abs(value-expected[i])<.02);
      },scenario.expected,{timeout:5000});
      samples=await page.evaluate(ms=>new Promise(resolve=>{
        const canvas=document.querySelector('#game canvas');
        const start=performance.now(),samples=[];
        function sample(now){
          const {movement,position}=JSON.parse(canvas.dataset.reviewPose);
          samples.push({ms:now-start,position:position.local,...movement});
          if(now-start>=ms)resolve(samples);
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      }),durationMs);
      if(scenario.id==='keyboard-diagonal'){
        await page.keyboard.up('d');
        await page.waitForFunction(()=>{
          const {movement:m}=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
          return m.input[0]===0&&m.input[1]===1;
        },null,{timeout:2000});
        const forward=await page.locator('#game canvas').evaluate(el=>JSON.parse(el.dataset.reviewPose).movement);
        releasePassed=Math.abs(forward.projected[0])<toleranceMetersPerSecond
          &&Math.abs(forward.projected[1]-forward.commandSpeed)<toleranceMetersPerSecond
          &&cameraError(forward.cameraYaw,samples[0].cameraYaw)<.005;
      }
    }finally{
      if(mobile)await dispatch('touchEnd');
      else for(const key of scenario.keys)await page.keyboard.up(key);
    }

    const first=samples[0];
    const maxError=Math.max(...samples.flatMap(s=>s.projected.map((value,i)=>
      Math.abs(value-scenario.expected[i]*s.commandSpeed))));
    const maxYawChange=Math.max(...samples.map(s=>Math.abs(angleDelta(first.cameraYaw,s.cameraYaw))));
    const valid=samples.every(s=>!s.angularFollow&&s.input.every((value,i)=>Math.abs(value-scenario.expected[i])<.02));
    const expectedBodyYaw=first.cameraYaw+Math.atan2(-scenario.expected[0],scenario.expected[1]);
    const bodyError=Math.abs(angleDelta(samples.at(-1).characterHeading,expectedBodyYaw));
    const pose=()=>page.locator('#game canvas').evaluate(el=>JSON.parse(el.dataset.reviewPose));
    await page.waitForFunction(()=>{
      const {movement:m}=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
      return m.input.every(value=>value===0)&&m.projected.every(value=>Math.abs(value)<.001);
    },null,{timeout:2000});
    const stopped=await pose();
    let recenterPassed=true,manualInterruptPassed=true;
    if(mobile||scenario.id==='keyboard-right'){
      const request=()=>mobile?page.locator('#btn-recenter').tap():page.keyboard.press('c');
      const waitRecentering=()=>page.waitForFunction(()=>{
        const {movement:m}=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
        return m.recentering;
      },null,{timeout:2000});
      await request();await waitRecentering();
      if(mobile){
        const finger={id:2,x:192,y:350};
        await dispatch('touchStart',[finger]);
        await dispatch('touchMove',[{...finger,x:248}]);
        await dispatch('touchEnd');
      }else{
        await page.mouse.move(630,340);
        await page.mouse.down();
        await page.mouse.move(690,340,{steps:4});
        await page.mouse.up();
      }
      try{
        await page.waitForFunction(()=>{
          const {movement:m}=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
          return !m.recentering;
        },null,{timeout:400});
      }catch{manualInterruptPassed=false;}
      await request();
      try{
        await page.waitForFunction(()=>{
          const {movement:m}=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
          const error=m.cameraYaw-m.characterHeading;
          return Math.abs(Math.atan2(Math.sin(error),Math.cos(error)))<.02;
        },null,{timeout:2500});
        const after=await pose();
        recenterPassed=after.position.local.every((value,i)=>Math.abs(value-stopped.position.local[i])<.001);
      }catch{recenterPassed=false;}
    }
    const status=valid&&maxError<=toleranceMetersPerSecond&&maxYawChange<.005
      &&bodyError<.02&&releasePassed&&manualInterruptPassed&&recenterPassed&&!errors.length?'passed':'failed';
    const videoFile=video?(scenario.id==='joystick-right'?'movement-diagnostics.webm':'movement-diagonal.webm'):null;
    await context.close();
    if(video)await video.saveAs(join(bundle,videoFile));
    return {...scenario,viewport,status,maxError,maxYawChange,bodyError,releasePassed,recenterPassed,manualInterruptPassed,video:videoFile,samples,errors};
  }finally{await context.close();}
}

export async function evaluateMovement(browser,server,bundle,stage,record=false){
  const results=[];
  for(const scenario of scenarios){
    try{
      const result=await evaluateScenario(browser,server,bundle,stage,scenario,record&&Boolean(scenario.stick));
      results.push(result);
      console.log('[review] Movimento '+scenario.id+': '+result.status);
    }catch(error){
      results.push({id:scenario.id,status:'failed',error:error.message});
    }
  }
  const status=results.every(s=>s.status==='passed')?'passed':'failed';
  return {status,durationMs,toleranceMetersPerSecond,scenarios:results,
    videos:results.flatMap(s=>s.video?[s.video]:[])};
}
