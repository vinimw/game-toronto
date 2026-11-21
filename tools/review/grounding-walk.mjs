import {join} from 'node:path';
import {enterHighPark} from './camera-evaluation.mjs';
import {startViewportVideo} from './full-viewport-video.mjs';

export async function evaluateGroundingWalk(browser,target,bundle){
  const viewport={width:1280,height:720},context=await browser.newContext({viewport,reducedMotion:'reduce'});
  let recording;
  try{
    const page=await context.newPage();
    await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
    await page.goto(new URL('/?review=1&park=expanded',target).href);
    await page.waitForSelector('#game canvas[data-review-pose]');
    await enterHighPark(page,context,false);
    await page.evaluate(()=>window.stageCameraReview([122,85],Math.PI));
    recording=await startViewportVideo(page,viewport,12,{touchControls:false});
    const legs=[];
    for(const [multiplier,yaw,milliseconds] of [[1,Math.PI,5400],[15,0,710],[15,Math.PI,1000]]){
      await page.evaluate(([speed,heading])=>{
        window.aimExplorationReview(heading);
        const slider=document.querySelector('#speed-slider');slider.value=String(speed);
        slider.dispatchEvent(new Event('input',{bubbles:true}));
      },[multiplier,yaw]);
      await page.keyboard.down('w');
      try{
        legs.push(await page.evaluate(({milliseconds,multiplier})=>new Promise(resolve=>{
          const samples=[],canvas=document.querySelector('#game canvas'),start=performance.now();
          function step(now){
            const [x,y,z]=JSON.parse(canvas.dataset.reviewPose).position.local;
            samples.push({ms:now-start,position:[x,y,z],error:y-window.groundingReviewHeight(x,z)});
            if(now-start>=milliseconds){resolve({multiplier,samples,maxError:Math.max(...samples.map(s=>Math.abs(s.error)))});return;}
            requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        }),{milliseconds,multiplier}));
      }finally{await page.keyboard.up('w');}
    }
    const video='building-grounding-walk.webm',playback=await recording.stop(join(bundle,video));
    const status=legs.every(leg=>leg.maxError<.01&&leg.samples.length>1)?'passed':'failed';
    return {status,video,playback,legs};
  }catch(error){return {status:'failed',error:error.message};}
  finally{try{await recording?.stop();}finally{await context.close();}}
}
