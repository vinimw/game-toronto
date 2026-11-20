import assert from 'node:assert/strict';
import {startViewportVideo} from './full-viewport-video.mjs';
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

async function evaluateScenario(browser,server,bundle,scenario,record){
  const mobile=Boolean(scenario.stick);
  const viewport=mobile?{width:390,height:844}:{width:1280,height:720};
  const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let recording;
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

    const label=text=>page.evaluate(text=>{document.documentElement.dataset.movementStage=text;},text);
    if(record){
      await label(scenario.id==='joystick-right'?'1 · Caminhar para a direita':'Caminhar na diagonal');
      recording=await startViewportVideo(page,viewport);
    }
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
      await page.evaluate(()=>{
        const canvas=document.querySelector('#game canvas');
        const timeline=window.recenterTimeline={inputReleasedMs:null,requests:[],frames:[],recording:true};
        function sample(){
          if(!timeline.recording)return;
          const {movement:m}=JSON.parse(canvas.dataset.reviewPose);
          timeline.frames.push({ms:performance.now(),yaw:m.cameraYaw,active:m.recentering,
            moving:m.input.some(Boolean)});
          requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
    }finally{
      await page.evaluate(()=>{if(window.recenterTimeline)window.recenterTimeline.inputReleasedMs=performance.now();});
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
      const request=async kind=>{
        await page.evaluate(({kind,mobile})=>{
          const record=()=>{
            const {movement:m}=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
            window.recenterTimeline.requests.push({kind,ms:performance.now(),initialYaw:m.cameraYaw,targetYaw:m.characterHeading});
          };
          if(mobile)document.querySelector('#btn-recenter').addEventListener('click',record,{once:true,capture:true});
          else window.addEventListener('keydown',record,{once:true,capture:true});
        },{kind,mobile});
        if(mobile)await page.locator('#btn-recenter').tap();
        else await page.keyboard.press('c');
      };
      if(record){await label('2 · Soltar o joystick');await page.waitForTimeout(700);}
      if(record)await label('3 · Acionar a recentralização');
      await request('complete');
      try{
        await page.waitForFunction(()=>{
          const {movement:m}=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
          const error=m.cameraYaw-m.characterHeading;
          return !m.recentering&&Math.abs(Math.atan2(Math.sin(error),Math.cos(error)))<.003;
        },null,{timeout:3500});
        const after=await pose();
        recenterPassed=after.position.local.every((value,i)=>Math.abs(value-stopped.position.local[i])<.001);
      }catch{recenterPassed=false;}

      // Orbit away while idle, then request again and interrupt on the first drag.
      const drag=async(offset,markInterruption=false)=>{
        if(markInterruption)await page.evaluate(()=>{
          document.querySelector('#game canvas').addEventListener('pointermove',()=>{
            window.recenterTimeline.interruptedMs=performance.now();
          },{once:true,capture:true});
        });
        if(mobile){
          const finger={id:2,x:192,y:350};
          await dispatch('touchStart',[finger]);
          await dispatch('touchMove',[{...finger,x:finger.x+offset}]);
          await dispatch('touchEnd');
        }else{
          await page.mouse.move(630,340);
          await page.mouse.down();
          await page.mouse.move(630+offset,340);
          await page.mouse.up();
        }
      };
      if(record&&scenario.id==='joystick-right'){
        await label('4 · Caminhar na diagonal');
        const diagonal=stick(27,-27);
        await dispatch('touchStart',[diagonal]);
        try{
          await page.waitForTimeout(2200);
          await label('5 · Girar a câmera com o segundo dedo');
          const finger={id:2,x:192,y:350};
          await dispatch('touchStart',[diagonal,finger]);
          await dispatch('touchMove',[diagonal,{...finger,x:248}]);
          await page.waitForTimeout(380);
          await label('6 · A diagonal acompanha a nova visão');
          const after=await pose();
          assert.ok(after.movement.projected.every(speed=>
            Math.abs(speed-after.movement.commandSpeed*Math.SQRT1_2)<toleranceMetersPerSecond));
          await page.waitForTimeout(2000);
        }finally{await dispatch('touchEnd');}
      }
      if(record)await label('Teste · Interromper com um arrasto');
      await drag(115);
      await page.waitForTimeout(450);
      await request('interrupt');
      await page.waitForFunction(()=>{
        return JSON.parse(document.querySelector('#game canvas').dataset.reviewPose).movement.recentering;
      },null,{timeout:2000});
      await drag(-50,true);
      try{
        await page.waitForFunction(()=>{
          return !JSON.parse(document.querySelector('#game canvas').dataset.reviewPose).movement.recentering;
        },null,{timeout:400});
      }catch{manualInterruptPassed=false;}
      if(record)await page.waitForTimeout(450);
    }

    const timeline=await page.evaluate(()=>{
      window.recenterTimeline.recording=false;
      return window.recenterTimeline;
    });
    const recenterTrace=summarizeRecentering(timeline);
    if(timeline.requests.length){
      recenterPassed&&=recenterTrace.movementEndedMs!==null
        &&recenterTrace.attempts.some(attempt=>attempt.outcome==='completed')
        &&recenterTrace.attempts.every(attempt=>attempt.shortestArc);
      manualInterruptPassed&&=recenterTrace.attempts.some(attempt=>attempt.outcome==='interrupted');
    }
    const status=valid&&maxError<=toleranceMetersPerSecond&&maxYawChange<.005
      &&bodyError<.02&&releasePassed&&manualInterruptPassed&&recenterPassed&&!errors.length?'passed':'failed';
    const videoFile=recording?(scenario.id==='joystick-right'?'movement-diagnostics.webm':'movement-diagonal.webm'):null;
    const videoValidation=recording?await recording.stop(join(bundle,videoFile)):null;
    return {...scenario,viewport,status,maxError,maxYawChange,bodyError,releasePassed,recenterPassed,manualInterruptPassed,video:videoFile,videoValidation,recenterTrace,samples,errors};
  }finally{try{await recording?.stop();}finally{await context.close();}}
}

export async function evaluateMovement(browser,server,bundle,record=false){
  const results=[];
  for(const scenario of scenarios){
    try{
      const result=await evaluateScenario(browser,server,bundle,scenario,record&&Boolean(scenario.stick));
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

export function summarizeRecentering(timeline){
  const movementEndedMs=timeline.frames.find(frame=>frame.ms>=timeline.inputReleasedMs&&!frame.moving)?.ms??null;
  const attempts=timeline.requests.map((request,i)=>{
    const cutoff=timeline.requests[i+1]?.ms??Infinity;
    const frames=timeline.frames.filter(frame=>frame.ms>=request.ms&&frame.ms<cutoff);
    const start=frames.findIndex(frame=>frame.active);
    const end=start<0?-1:frames.findIndex((frame,i)=>i>start&&!frame.active);
    const stopped=frames[end];
    const interrupted=request.kind==='interrupt'&&stopped&&Number.isFinite(timeline.interruptedMs)
      &&stopped.ms>=timeline.interruptedMs&&stopped.ms-timeline.interruptedMs<=400;
    const completed=request.kind==='complete'&&stopped&&cameraError(stopped.yaw,request.targetYaw)<.003;
    const interpolation=start<0?[]:frames.slice(start,interrupted?end:end<0?undefined:end+1);
    const direction=Math.sign(angleDelta(request.initialYaw,request.targetYaw));
    let previous={ms:request.ms,yaw:request.initialYaw};
    const shortestArc=interpolation.length>0&&interpolation.every(frame=>{
      const step=angleDelta(previous.yaw,frame.yaw);
      const elapsed=Math.min(.05,(frame.ms-previous.ms)/1000);
      previous=frame;
      return step*direction>=-.002&&Math.abs(step)<=elapsed*Math.PI*2/3+.038
        &&cameraError(frame.yaw,request.targetYaw)<=cameraError(request.initialYaw,request.targetYaw)+.002;
    });
    return {...request,interpolation,shortestArc,
      outcome:completed?'completed':interrupted?'interrupted':'failed',
      completedMs:completed?stopped.ms:null,interruptedMs:interrupted?timeline.interruptedMs:null,
      stoppedMs:stopped?.ms??null};
  });
  return {clock:'performance.now() em ms na página',inputReleasedMs:timeline.inputReleasedMs,movementEndedMs,attempts};
}
