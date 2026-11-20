import assert from 'node:assert/strict';
import {enterHighPark,sampleMovement} from './camera-evaluation.mjs';

export async function evaluateTerrainGameplay(browser,target,safeMessage){
  const scenarios=[];
  for(const mobile of [false,true]){
    const viewport=mobile?{width:390,height:844}:{width:1280,height:720};
    const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
    const errors=[];
    try{
      const page=await context.newPage();
      page.on('pageerror',error=>errors.push(safeMessage(error.message)));
      page.on('console',message=>{if(message.type()==='error')errors.push(safeMessage(message.text()));});
      await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
      await page.goto(new URL('/?review=1&park=expanded',target).href);
      await page.waitForSelector('#game canvas[data-review-pose]');
      const {dispatch,stick}=await enterHighPark(page,context,mobile);
      const pose=()=>page.locator('#game canvas').evaluate(el=>JSON.parse(el.dataset.reviewPose));
      assert.equal((await pose()).dataset,'high-park-expanded');
      await page.evaluate(()=>window.stageCameraReview([-182,759],Math.PI/2));
      await page.waitForFunction(()=>{
        const pose=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
        return Math.abs(pose.position.local[0]+182)<.001&&pose.position.local[1]<-5;
      });
      const start=(await pose()).position.local;
      if(mobile)await dispatch('touchStart',[stick(0,-38)]);
      else await page.keyboard.down('w');
      let samples;
      try{samples=await sampleMovement(page,1200);}
      finally{
        if(mobile)await dispatch('touchEnd');
        else await page.keyboard.up('w');
      }
      const final=samples.at(-1).position;
      assert.ok(start[0]-final[0]>3&&start[1]-final[1]>.25);
      assert.ok(samples.every(sample=>sample.position.every(Number.isFinite)&&
        sample.cameraPosition.every(Number.isFinite)&&!sample.obstruction.excessiveProximity));
      await clickPortal();
      assert.deepEqual(errors,[]);
      const intervals=samples.slice(1).map((sample,i)=>sample.ms-samples[i].ms).filter(ms=>ms>0);
      const sum=intervals.reduce((a,b)=>a+b,0),sorted=[...intervals].sort((a,b)=>a-b);
      scenarios.push({mobile,viewport,status:'passed',start,final,errors,
        fps:intervals.length*1000/sum,p95Ms:sorted[Math.ceil(sorted.length*.95)-1]});

      async function clickPortal(){
        const gate=(await pose()).portals[0].position;
        await page.evaluate(gate=>window.stageCameraReview(gate,Math.PI),gate);
        await page.getByText('Voltar a Toronto',{exact:true}).waitFor();
        if(mobile)await page.locator('#action-btn').tap();
        else await page.locator('#action-btn').click();
        await page.waitForFunction(()=>document.querySelector('#app').dataset.region==='toronto'&&
          document.querySelector('#app').getAttribute('aria-busy')==='false');
      }
    }catch(error){
      scenarios.push({mobile,viewport,status:'failed',message:safeMessage(error.message),errors});
    }finally{await context.close();}
  }
  return {status:scenarios.every(scenario=>scenario.status==='passed')?'passed':'failed',scenarios};
}
