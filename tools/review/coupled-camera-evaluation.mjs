import assert from 'node:assert/strict';
import {join} from 'node:path';
import {angleDelta} from '../../src/camera-follow.js';
import {enterHighPark} from './camera-evaluation.mjs';
import {startViewportVideo} from './full-viewport-video.mjs';

const degrees=radians=>radians*180/Math.PI;
const change=(a,b,key)=>angleDelta(a[key],b[key]);
const still=frame=>Math.hypot(...frame.input)<.01;

function turnEvidence(frames,sign){
  const start=frames.findIndex(frame=>sign*frame.input[0]<-.1);
  assert.ok(start>0,'A coleta precisa incluir um frame de referência antes da curva.');
  const reference=frames[start-1];
  const began=key=>frames.findIndex((frame,i)=>i>=start&&sign*change(reference,frame,key)>1e-6);
  const onset={input:frames[start].frame};
  for(const key of ['locomotionHeading','characterHeading','cameraTargetYaw','cameraYaw']){
    const i=began(key);
    assert.ok(i>=0,'Sem resposta angular em '+key);
    onset[key]=frames[i].frame;
    assert.equal(onset[key],onset.input,key+' iniciou em outro frame');
  }
  const turning=frames.slice(start).filter(frame=>sign*frame.input[0]<-.1);
  assert.ok(turning.length>20);
  const total=key=>turning.reduce((sum,frame,i)=>sum+change(i?turning[i-1]:reference,frame,key),0);
  const characterTurn=degrees(total('characterHeading'));
  const cameraTurn=degrees(total('cameraYaw'));
  assert.ok(sign*characterTurn>20&&sign*cameraTurn>15,'Curva sustentada insuficiente.');
  assert.ok(turning.every(frame=>frame.speed>1&&Math.abs(change(frame,{...frame,cameraTargetYaw:frame.locomotionHeading},'cameraTargetYaw'))<1e-6));
  assert.ok(turning.slice(-10).every(frame=>sign*frame.characterDegreesPerSecond>20&&sign*frame.cameraDegreesPerSecond>20));
  return {onset,delayFrames:0,delayMs:0,characterTurnDegrees:characterTurn,cameraTurnDegrees:cameraTurn};
}

async function scenario(browser,server,bundle,mobile,{prototype=false,video=false,fps=24}={}){
  const id=mobile?'mobile':'desktop',viewport=mobile?{width:390,height:844}:{width:1280,height:720};
  const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  const page=await context.newPage(),stages=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let recording;
  try{
    const path=prototype?'/tools/review/prototype/':'/?review=1&movement-debug=1';
    await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
    await page.goto(new URL(path,server).href);
    await page.waitForSelector('#game canvas[data-review-pose]');
    let dispatch,stick;
    if(!prototype){
      ({dispatch,stick}=await enterHighPark(page,context,mobile));
      await page.evaluate(()=>window.stageCameraReview([-45,-85],Math.PI));
      await page.waitForFunction(()=>JSON.parse(document.querySelector('#game canvas').dataset.reviewPose).movement.cameraFollowMode==='third-person-coupled');
    }else if(mobile){
      const touch=await context.newCDPSession(page);
      dispatch=(type,touchPoints=[])=>touch.send('Input.dispatchTouchEvent',{type,touchPoints});
      const box=await page.locator('#joystick').boundingBox();
      stick=(dx,dy)=>({id:1,x:box.x+box.width/2+dx,y:box.y+box.height/2+dy});
    }
    let held=[],joystickHeld=false;
    async function steer(right=0,forward=0){
      if(mobile){
        const travel=right&&forward?27:38;
        if(right||forward)await dispatch(joystickHeld?'touchMove':'touchStart',[stick(right*travel,-forward*travel)]);
        else if(joystickHeld)await dispatch('touchEnd');
        joystickHeld=Boolean(right||forward);
      }else{
        const keys=[...(forward?['w']:[]),...(right?[right>0?'d':'a']:[])];
        for(const key of keys)if(!held.includes(key))await page.keyboard.down(key);
        for(const key of held)if(!keys.includes(key))await page.keyboard.up(key);
        held=keys;
      }
    }
    async function observe(name,duration,act){
      await page.evaluate(name=>{
        document.documentElement.dataset.movementStage=name;
        const canvas=document.querySelector('#game canvas');
        const measurement=window.coupledReview={active:true,frames:[]};
        const capture=()=>{
          if(!measurement.active)return;
          const {movement,position}=JSON.parse(canvas.dataset.reviewPose);
          if(measurement.frames.at(-1)?.frame!==movement.frame)
            measurement.frames.push({observedMs:performance.now(),position:position.local,...movement});
          requestAnimationFrame(capture);
        };
        capture();
      },name);
      await act?.();
      await page.waitForTimeout(duration);
      const frames=await page.evaluate(()=>{
        window.coupledReview.active=false;
        return window.coupledReview.frames;
      });
      let previous=frames[0];
      for(const frame of frames){
        frame.characterDegreesPerSecond=frame.dt?degrees(change(previous,frame,'characterHeading')/frame.dt):0;
        frame.cameraDegreesPerSecond=frame.dt?degrees(change(previous,frame,'cameraYaw')/frame.dt):0;
        frame.cameraCharacterErrorDegrees=degrees(change(frame,{...frame,cameraYaw:frame.characterHeading},'cameraYaw'));
        previous=frame;
      }
      const stage={name,frames};
      stages.push(stage);
      return stage;
    }
    const drag=async()=>{
      const x=viewport.width*.45,y=viewport.height*.55;
      if(mobile){
        const joy=stick(0,-38),finger={id:2,x,y};
        await dispatch('touchStart',[joy,finger]);
        await dispatch('touchMove',[joy,{...finger,x:x+95}]);
      }else{
        await page.mouse.move(x,y);
        await page.mouse.down();
        await page.mouse.move(x+95,y);
      }
    };
    const releaseDrag=async()=>{
      if(mobile){
        await dispatch('touchEnd');
        joystickHeld=false;
        await steer(0,1);
      }else await page.mouse.up();
    };

    await page.evaluate(()=>{document.documentElement.dataset.movementStage='Rig em terceira pessoa · '+(innerWidth<600?'Mobile':'Desktop');});
    if(video)recording=await startViewportVideo(page,viewport,fps,{touchControls:mobile});
    const straight=await observe('1 · Frente',1200,()=>steer(0,1));
    assert.ok(straight.frames.slice(-10).every(f=>f.speed>4&&Math.abs(f.cameraCharacterErrorDegrees)<.05));
    const right=await observe('2 · Diagonal direita · personagem e câmera juntas',1700,()=>steer(1,1));
    right.turn=turnEvidence(right.frames,-1);
    const forward=await observe('3 · Soltar a direção lateral e seguir em frente',1000,()=>steer(0,1));
    const settled=forward.frames.filter(f=>Math.abs(f.input[0])<.01&&f.input[1]>.9);
    assert.ok(settled.length>20);
    assert.ok(settled.every(f=>Math.abs(change(settled[0],f,'cameraTargetYaw'))<1e-6));
    assert.ok(Math.abs(settled.at(-1).cameraCharacterErrorDegrees)<1);
    const left=await observe('4 · Diagonal esquerda',1700,()=>steer(-1,1));
    left.turn=turnEvidence(left.frames,1);
    await observe('5 · Voltar à frente',750,()=>steer(0,1));
    const lateral=await observe('6 · Lateral isolada · curva caminhando',1250,()=>steer(1,0));
    lateral.turn=turnEvidence(lateral.frames,-1);
    await observe('7 · Seguir em frente',800,()=>steer(0,1));
    const manual=await observe(mobile?'8 · Girar com segundo toque':'8 · Girar com mouse',650,drag);
    const moved=manual.frames.filter(f=>f.manual);
    assert.ok(moved.length>10&&Math.abs(change(moved[0],moved.at(-1),'cameraYaw'))>.2);
    assert.ok(moved.every(f=>f.speed>4&&Math.abs(change(moved[0],f,'locomotionHeading'))<1e-6));
    const resumed=await observe('9 · Soltar a câmera e continuar caminhando',1200,releaseDrag);
    assert.ok(resumed.frames.slice(-10).every(f=>!f.manual&&!still(f)&&Math.abs(f.cameraCharacterErrorDegrees)<.5));
    await steer();
    await page.waitForTimeout(200);
    assert.deepEqual(errors,[]);
    const file=recording?'coupled-camera-'+id+'.webm':null;
    const videoValidation=recording?await recording.stop(join(bundle,file)):null;
    return {id,status:'passed',viewport,stages,video:file,videoValidation};
  }catch(error){
    return {id,status:'failed',viewport,stages,errors,error:error.message};
  }finally{
    try{await recording?.stop();}finally{await context.close();}
  }
}

export async function evaluateCoupledCamera(browser,server,bundle,options={}){
  const scenarios=[];
  for(const mobile of [false,true]){
    const result=await scenario(browser,server,bundle,mobile,options);
    scenarios.push(result);
    console.log('[review] Rig '+result.id+': '+(result.error??result.status));
  }
  return {status:scenarios.every(s=>s.status==='passed')?'passed':'failed',
    scenarios,videos:scenarios.flatMap(s=>s.video?[s.video]:[])};
}
