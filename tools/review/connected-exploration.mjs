import {join} from 'node:path';
import {enterHighPark} from './camera-evaluation.mjs';
import {startViewportVideo} from './full-viewport-video.mjs';
import {frameStatistics} from './motion-benchmark.js';
import {explorationConnections} from '../../src/park-connections.js';

export async function evaluateConnectedExploration(browser,target,bundle){
  const results=[];
  for(const {id} of explorationConnections)for(const mobile of [false,true]){
    const viewport=mobile?{width:390,height:844}:{width:1280,height:720};
    const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
    let recording;
    try{
      const page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
      await page.goto(new URL('/?review=1&park=expanded',target).href);
      await page.waitForSelector('#game canvas[data-review-pose]');
      await enterHighPark(page,context,mobile);
      const plan=await page.evaluate(id=>window.planExplorationReview(id),id);
      if(plan.status!=='planned'){results.push({id,mobile,status:'unavailable',plan});continue;}
      await page.evaluate(({segments})=>{
        const [x,z]=segments[0].from,[u,v]=segments[0].to;
        window.stageCameraReview([x,z],Math.atan2(x-u,z-v));
        const slider=document.querySelector('#speed-slider');
        slider.value='3.5';slider.dispatchEvent(new Event('input',{bubbles:true}));
        const label=document.createElement('div');label.id='connection-video-overlay';
        label.style='position:fixed;top:16%;left:8px;background:#17291edc;color:white;padding:7px;font:12px monospace;z-index:90;pointer-events:none';
        document.body.append(label);
      },plan);
      if(!mobile)recording=await startViewportVideo(page,viewport,12,{touchControls:false});
      await page.keyboard.down('w');
      let run;
      try{
        run=await page.evaluate(({segments,id})=>new Promise(resolve=>{
          const canvas=document.querySelector('#game canvas');
          const overlay=document.querySelector('#connection-video-overlay');
          const start=performance.now(),intervals=[],samples=[];
          let previous=start,last,meters=0,next=0,switched=true,lastSample=0,best=Infinity,lastProgress=start;
          const finish=(status,now,position)=>resolve({status,durationMs:now-start,distanceMeters:meters,
            position,waypointsReached:next,intervals,samples});
          function step(now){
            const p=JSON.parse(canvas.dataset.reviewPose).position.local;
            const [x,,z]=p;
            if(last){meters+=Math.hypot(x-last[0],z-last[2]);intervals.push(now-previous);}
            previous=now;last=p;
            const [u,v]=segments[next].to,remaining=Math.hypot(x-u,z-v);
            if(remaining<best-.055){best=remaining;lastProgress=now;}
            if(remaining<.39){
              next++;switched=true;best=Infinity;lastProgress=now;
              if(next>=segments.length){finish('passed',now,p);return;}
            }
            if(switched||remaining>best+.24){
              const [tx,tz]=segments[next].to;
              window.aimExplorationReview(Math.atan2(x-tx,z-tz));switched=false;
            }
            if(now-lastSample>=220){
              const snapshot=window.inspectWorldStreaming();
              samples.push({ms:now-start,position:p,meters,next,renderer:snapshot.renderer,
                sectors:snapshot.sectors.filter(s=>s.state==='active'||s.state==='loading').map(s=>({
                  id:s.id,state:s.state,activationMs:s.activationMs,visiblePopInCount:s.visiblePopInCount,
                }))});
              overlay.textContent=id+' · '+meters.toFixed(0)+' m · '+snapshot.sectors.filter(s=>s.state==='active').length+' setores';
              lastSample=now;
            }
            if(now-start>120000||now-lastProgress>4000){finish('blocked',now,p);return;}
            requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        }),{segments:plan.segments,id});
      }finally{await page.keyboard.up('w');}
      const file=recording?id+'-connected.webm':null;
      const video=file?{file,validation:await recording.stop(join(bundle,file))}:null;
      const {intervals,...detail}=run;
      const ordered=[...intervals].sort((a,b)=>a-b);
      results.push({id,mobile,plan,...detail,video,errors,status:errors.length?'failed':run.status,
        ...frameStatistics(intervals),p99Ms:ordered[Math.ceil(ordered.length*.99)-1]??null,
        maxMs:ordered.at(-1)??null,longFrames:intervals.filter(ms=>ms>50).length});
    }catch(error){results.push({id,mobile,status:'failed',error:error.message});}
    finally{try{await recording?.stop();}finally{await context.close();}}
  }
  return {status:results.every(r=>r.status==='passed')?'passed':'partial',results,
    videos:results.flatMap(r=>r.video?[r.video.file]:[])};
}
