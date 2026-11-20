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

export async function sampleMovement(page,duration){
  return page.evaluate(ms=>new Promise(resolve=>{
    const canvas=document.querySelector('#game canvas');
    const start=performance.now(),samples=[];
    function sample(now){
      const {movement,position,camera}=JSON.parse(canvas.dataset.reviewPose);
      samples.push({ms:now-start,position:position.local,cameraPosition:camera.position,...movement});
      if(now-start>=ms)resolve(samples);
      else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }),duration);
}

function summarizeObstruction(samples){
  const frames=samples.map(({ms,position,cameraPosition,obstruction},i)=>{
    const previous=samples[i-1];
    const relative=position.map((value,axis)=>cameraPosition[axis]-value);
    return {ms,...obstruction,relativeDisplacement:previous?Math.hypot(...relative.map((v,axis)=>
      v-(previous.cameraPosition[axis]-previous.position[axis]))):0};
  });
  const maximum=key=>Math.max(...frames.map(key));
  return {
    frames,minimumDistance:Math.min(...frames.map(f=>f.actualDistance)),
    maximumDistanceDelta:maximum(f=>Math.abs(f.distanceDelta)),
    maximumRelativeStep:maximum(f=>f.relativeDisplacement),
    excessiveProximityFrames:frames.filter(f=>f.excessiveProximity).length,
    croppedOrBlockedFrames:frames.filter(f=>!f.body.inFrame||!f.body.lineOfSight).length,
    treeFrames:frames.filter(f=>f.hiddenTrees.length>0).length,
    buildingFrames:frames.filter(f=>f.obstacle?.kind==='building').length,
  };
}

async function exerciseObstruction(page,drive,label){
  // The lane alongside the OSM Chess House also passes a procedural tree.
  const start=[-99,-42.65],durationMs=4700;
  const expectedBuilding=203862365;
  await label('Passagem lateral · árvores e Chess House');
  const initial=await page.evaluate(([position,yaw])=>{
    // Cover the discontinuity when staging the separate route in a video.
    document.querySelector('#game canvas').animate([{opacity:0},{opacity:1}],{duration:220});
    window.stageCameraReview(position,yaw);
    return position;
  },[start,Math.PI]);
  await page.waitForFunction(([x,z])=>{
    const {position}=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
    return Math.abs(position.local[0]-x)<.001&&Math.abs(position.local[2]-z)<.001;
  },initial);
  const samples=await drive(()=>sampleMovement(page,durationMs));
  const summary=summarizeObstruction(samples);
  const framesWithExpectedBuilding=summary.frames.filter(f=>f.obstacle?.id===expectedBuilding);
  const recovered=summary.frames.at(-1).actualDistance>=6.95&&summary.frames.at(-1).hiddenTrees.length===0;
  const travelled=Math.abs(samples.at(-1).position[0]-samples[0].position[0]);
  const stable=samples.every(s=>cameraError(s.cameraYaw,Math.PI)<.005&&Math.abs(s.position[2]-start[1])<.001);
  const passed=summary.treeFrames>0&&framesWithExpectedBuilding.length>0&&
    summary.minimumDistance<6.9&&summary.excessiveProximityFrames===0&&summary.croppedOrBlockedFrames===0&&
    summary.maximumRelativeStep<.55&&summary.maximumDistanceDelta<.55&&recovered&&stable&&travelled>20;
  return {status:passed?'passed':'failed',start,durationMs,expectedBuilding,recovered,stable,travelled,...summary};
}

export async function enterHighPark(page,context,mobile){
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

  return {dispatch,stick};
}

async function evaluateScenario(browser,server,bundle,scenario,record,fps){
  const mobile=Boolean(scenario.stick);
  const viewport=mobile?{width:390,height:844}:{width:1280,height:720};
  const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let recording;
  let samples=[],releasePassed=true;
  try{
    const url=new URL('/?review=1&camera-follow=stable',server);
    if(record){
      url.searchParams.set('movement-debug','1');
      url.searchParams.set('movement-scenario',scenario.id==='joystick-right'?'Joystick à direita':'Joystick na diagonal');
    }
    await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
    await page.goto(url.href);
    await page.waitForSelector('#game canvas[data-review-pose]');
    const {dispatch,stick}=await enterHighPark(page,context,mobile);

    const label=text=>page.evaluate(text=>{document.documentElement.dataset.movementStage=text;},text);
    if(record){
      await label(scenario.id==='joystick-right'?'1 · Caminhar para a direita':'Caminhar na diagonal');
      recording=await startViewportVideo(page,viewport,fps);
    }
    if(mobile)await dispatch('touchStart',[stick(...scenario.stick)]);
    else for(const key of scenario.keys)await page.keyboard.down(key);
    try{
      await page.waitForFunction(expected=>{
        const {movement}=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
        return movement.input.every((value,i)=>Math.abs(value-expected[i])<.02);
      },scenario.expected,{timeout:5000});
      samples=await sampleMovement(page,durationMs);
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
        const canvas=document.querySelector('#game canvas');
        const record=event=>{
          if(!event.buttons&&event.pointerType!=='touch')return;
          window.recenterTimeline.interruptedMs=performance.now();
          canvas.removeEventListener('pointermove',record,true);
        };
        canvas.addEventListener('pointermove',record,true);
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

    const timeline=await page.evaluate(()=>{
      window.recenterTimeline.recording=false;
      return window.recenterTimeline;
    });
    const recenterTrace=summarizeRecentering(timeline);
    recenterPassed&&=recenterTrace.movementEndedMs!==null
      &&recenterTrace.attempts.some(attempt=>attempt.outcome==='completed')
      &&recenterTrace.attempts.every(attempt=>attempt.shortestArc);
    manualInterruptPassed&&=recenterTrace.attempts.some(attempt=>attempt.outcome==='interrupted');
    const obstructionRoute=(scenario.id==='keyboard-right'||mobile)?await exerciseObstruction(page,async run=>{
      if(mobile)await dispatch('touchStart',[stick(38,0)]);
      else await page.keyboard.down('d');
      try{return await run();}
      finally{
        if(mobile)await dispatch('touchEnd');
        else await page.keyboard.up('d');
      }
    },label):null;
    const {frames:_,...obstruction}=summarizeObstruction(samples);
    const status=valid&&maxError<=toleranceMetersPerSecond&&maxYawChange<.005
      &&bodyError<.02&&releasePassed&&manualInterruptPassed&&recenterPassed&&!errors.length
      &&obstruction.excessiveProximityFrames===0&&(!obstructionRoute||obstructionRoute.status==='passed')?'passed':'failed';
    const videoFile=recording?(scenario.id==='joystick-right'?'movement-diagnostics.webm':'movement-diagonal.webm'):null;
    const videoValidation=recording?await recording.stop(join(bundle,videoFile)):null;
    return {...scenario,viewport,status,maxError,maxYawChange,bodyError,releasePassed,recenterPassed,manualInterruptPassed,video:videoFile,videoValidation,recenterTrace,obstruction,obstructionRoute,samples,errors};
  }finally{try{await recording?.stop();}finally{await context.close();}}
}

export async function evaluateMovement(browser,server,bundle,record=false,fps=24){
  const results=[];
  for(const scenario of scenarios){
    try{
      const result=await evaluateScenario(browser,server,bundle,scenario,record&&Boolean(scenario.stick),fps);
      results.push(result);
      console.log('[review] Movimento '+scenario.id+': '+result.status);
    }catch(error){
      results.push({id:scenario.id,status:'failed',error:error.message});
      console.warn('[review] Movimento '+scenario.id+': '+error.message);
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
