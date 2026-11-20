import assert from 'node:assert/strict';
import {join} from 'node:path';
import {angleDelta} from '../../src/camera-follow.js';
import {cameraSettings} from '../../src/visual-settings.js';
import {enterHighPark,sampleMovement} from './camera-evaluation.mjs';
import {startViewportVideo} from './full-viewport-video.mjs';

const start=[-45,-100],startYaw=Math.PI;
const diagonal=[Math.SQRT1_2,Math.SQRT1_2];
const angleError=(a,b)=>Math.abs(angleDelta(a,b));

async function evaluate(browser,server,bundle,mobile,record,fps){
  const id=mobile?'mobile':'desktop';
  const viewport=mobile?{width:390,height:844}:{width:1280,height:720};
  const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],stages=[];
  page.on('pageerror',error=>errors.push(error.message));
  let recording;
  try{
    await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
    await page.goto(new URL('/?review=1&movement-debug=1',server).href);
    await page.waitForSelector('#game canvas[data-review-pose]');
    const {dispatch,stick}=await enterHighPark(page,context,mobile);
    const data=()=>page.locator('#game canvas').evaluate(el=>JSON.parse(el.dataset.reviewPose).movement);
    const waitForInput=axes=>page.waitForFunction(expected=>{
      const {movement}=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
      return movement.input.every((value,i)=>Math.abs(value-expected[i])<.015);
    },axes,{timeout:3000});
    const waitForAutomaticTurn=()=>page.waitForFunction(()=>{
      const {movement}=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
      return movement.rotation?.kind==='automatic'&&movement.rotation.outcome==='active';
    },null,{timeout:4500});
    const label=text=>page.evaluate(value=>{document.documentElement.dataset.movementStage=value;},
      'Automatic Camera Follow · '+(mobile?'Mobile':'Desktop')+'\n'+text);
    const stagePose=async()=>{
      await page.evaluate(([start,yaw])=>window.stageCameraReview(start,yaw),[start,startYaw]);
      await page.waitForFunction(([x,z])=>{
        const {position,movement}=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
        return Math.abs(position.local[0]-x)<.001&&Math.abs(position.local[2]-z)<.001&&movement.input.every(v=>v===0);
      },start);
    };
    await stagePose();
    assert.equal((await data()).cameraFollowMode,'assisted-auto');
    let held=[],fingerDown=false;
    const steer=async(right,forward)=>{
      if(mobile){
        const point=forward&&right?stick(27,-27):right?stick(38,0):forward?stick(0,-38):null;
        if(point)await dispatch(fingerDown?'touchMove':'touchStart',[point]);
        else if(fingerDown)await dispatch('touchEnd');
        fingerDown=Boolean(point);
      }else{
        const keys=[...(forward?['w']:[]),...(right?['d']:[])];
        // Press new keys first so W+D → W stays part of the same gesture.
        for(const key of keys)if(!held.includes(key))await page.keyboard.down(key);
        for(const key of held)if(!keys.includes(key))await page.keyboard.up(key);
        held=keys;
      }
      await waitForInput(right&&forward?diagonal:[right,forward]);
    };
    const drag=async(offset)=>{
      if(mobile){
        const finger={id:2,x:192,y:450};
        await dispatch('touchStart',[finger]);
        await dispatch('touchMove',[{...finger,x:finger.x+offset}]);
        await dispatch('touchEnd');
      }else{
        await page.mouse.move(620,400);
        await page.mouse.down();
        await page.mouse.move(620+offset,400);
        await page.mouse.up();
      }
    };
    const collect=async(name,duration)=>{
      const samples=await sampleMovement(page,duration);
      const maxVelocityError=Math.max(...samples.map(s=>Math.hypot(...s.projected.map((value,i)=>
        value-s.input[i]*s.commandSpeed))));
      const first=samples[0],last=samples.at(-1);
      assert.ok(maxVelocityError<.085,name+' · desvio '+maxVelocityError);
      const phase={name,durationMs:duration,maxVelocityError,samples};
      stages.push(phase);
      return {samples,first,last};
    };
    const motion=async(name,right,forward,duration,speed=1)=>{
      await label(name);
      const initial=await data();
      await steer(right,forward);
      const result=await collect(name,duration);
      const {samples,first,last}=result;
      assert.ok(samples.every(s=>angleError(s.commandYaw,first.commandYaw)<1e-6),name+' · base de comando mudou');
      assert.ok(samples.every(s=>Math.abs(s.commandSpeed-5.1*speed)<.001),name+' · multiplicador incorreto');
      if(right){
        const sustained=initial.input[0]>.08;
        const maxTurn=Math.max(...samples.map(s=>angleError(initial.cameraYaw,s.cameraYaw)));
        assert.ok(sustained?maxTurn<.015:maxTurn>.12&&maxTurn<=cameraSettings.lateralFollowMaxAngle+.015,name+' · giro '+maxTurn);
        assert.ok(samples.every(s=>s.screenVelocity[0]>s.commandSpeed*.45),name+' · componente lateral sumiu');
        assert.equal(last.followState,'lateral-limited');
      }
      return result;
    };
    const automaticIdle=async(name,duration)=>{
      await label(name);
      const before=await data();
      await steer(0,0);
      const result=await collect(name,duration);
      const {samples,last}=result;
      const timeline=samples.filter(s=>s.rotation?.kind==='automatic'&&s.rotation.id!==before.rotation?.id);
      assert.ok(samples.some(s=>s.followState==='release-delay'),name+' · sem intervalo de liberação');
      const firstTurn=timeline.find(s=>s.rotation.outcome==='active');
      assert.ok(firstTurn,name+' · sem rotação automática');
      const wait=firstTurn.rotation.startedAtSeconds-before.followTimeSeconds;
      assert.ok(wait>=.38&&wait<.65,name+' · atraso inesperado '+wait);
      assert.equal(last.rotation?.outcome,'completed');
      assert.equal(last.rotation?.kind,'automatic');
      assert.ok(angleError(last.cameraYaw,last.characterHeading)<.005);
      let previous=before.cameraYaw;
      const sign=Math.sign(angleDelta(before.cameraYaw,last.cameraYaw));
      for(const s of samples){
        assert.ok(angleDelta(previous,s.cameraYaw)*sign>=-.001,name+' · oscilação detectada');
        previous=s.cameraYaw;
      }
      return result;
    };
    const interrupt=async()=>{
      await label(mobile?'Interromper com gesto':'Interromper com mouse');
      const active=await data();
      assert.equal(active.rotation?.outcome,'active');
      await drag(-65);
      const {samples,last}=await collect('Interrupção manual',750);
      assert.ok(samples.every(s=>s.followState==='manual-override'&&!s.angularFollow));
      assert.equal(last.rotation?.outcome,'interrupted');
      assert.equal(last.rotation?.id,active.rotation.id);
      await label('A câmera retorna após a pausa manual');
      const restored=await collect('Retorno após controle manual',2550);
      const resumed=restored.samples.find(s=>s.rotation?.kind==='automatic'&&s.rotation.id!==active.rotation.id&&s.angularFollow);
      assert.ok(resumed);
      const wait=resumed.rotation.startedAtSeconds-last.rotation.endedAtSeconds;
      assert.ok(wait>=1.48&&wait<1.8,'A câmera retomou após '+wait+' s');
      assert.equal(restored.last.rotation?.outcome,'completed');
      assert.ok(angleError(restored.last.cameraYaw,restored.last.characterHeading)<.005);
    };

    await label('Início · velocidade 1×');
    if(record)recording=await startViewportVideo(page,viewport,fps,{touchControls:mobile});
    const front=await motion('1 · Caminhar para a frente',0,1,mobile?2500:3000);
    await motion('2 · Manter a diagonal',1,1,mobile?3500:4000);
    if(mobile){
      await motion('3 · Manter o joystick à direita',1,0,3500);
      await automaticIdle('4 · Soltar joystick e observar alinhamento',3200);
    }else{
      const forward=await motion('3 · Soltar D e manter W',0,1,3000);
      assert.ok(forward.samples.every(s=>angleError(s.commandYaw,front.first.commandYaw)<1e-6));
      assert.ok(forward.samples.some(s=>s.followState==='release-delay'));
      assert.ok(forward.samples.some(s=>s.rotation?.kind==='automatic'&&s.angularFollow));
      assert.ok(angleError(forward.last.cameraYaw,forward.first.commandYaw)<.005);
      await steer(0,0);
      await label('4 · Parar após o alinhamento');
      await collect('Parado após W',650);
      await label('5 · Girar manualmente');
      await drag(105);
      await waitForAutomaticTurn();
      await interrupt();
    }

    const video=recording?'automatic-camera-follow-'+id+'.webm':null;
    const videoValidation=recording?await recording.stop(join(bundle,video)):null;
    const aligned=await data();
    const restart=await motion('Retomar caminhada após alinhar',0,1,350);
    assert.ok(angleError(restart.first.commandYaw,aligned.cameraYaw)<.005);
    await steer(0,0);
    if(mobile){
      await drag(110);
      await waitForAutomaticTurn();
      await interrupt();
    }else{
      for(const [right,forward] of [[1,0],[1,1]]){
        await stagePose();
        await motion('Regressão sustentada de 10 s · '+(forward?'W+D':'D'),right,forward,10000);
        await steer(0,0);
      }
      await stagePose();
      await page.locator('#speed-slider').fill('3');
      await page.locator('#speed-slider').blur();
      const changes=[[0,1],[1,1],[0,1],[1,1],[0,1]];
      for(const [right,forward] of changes){
        await steer(right,forward);
        const {samples}=await collect('Alternância rápida a 3×',100);
        assert.ok(samples.every(s=>angleError(s.commandYaw,startYaw)<.005&&Math.abs(s.commandSpeed-15.3)<.001));
      }
      await steer(0,0);
    }
    assert.deepEqual(errors,[]);
    return {id,status:'passed',viewport,video,videoValidation,stages};
  }catch(error){
    return {id,status:'failed',viewport,error:error.message,stages,errors};
  }finally{
    try{await recording?.stop();}finally{await context.close();}
  }
}

export async function evaluateAutomaticCamera(browser,server,bundle,record,fps){
  const scenarios=[];
  for(const mobile of [false,true]){
    const result=await evaluate(browser,server,bundle,mobile,record,fps);
    console.log('[review] Câmera automática '+result.id+': '+(result.error??result.status));
    scenarios.push(result);
  }
  return {status:scenarios.every(s=>s.status==='passed')?'passed':'failed',
    settings:{mode:cameraSettings.cameraFollowMode,autoRecenterDelay:cameraSettings.autoRecenterDelay,
      manualOverrideDelay:cameraSettings.manualOverrideDelay,lateralLimitDegrees:cameraSettings.lateralFollowMaxAngle*180/Math.PI},
    scenarios,videos:scenarios.flatMap(s=>s.video?[s.video]:[])};
}
