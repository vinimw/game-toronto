import assert from 'node:assert/strict';
import {execFile,spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {setTimeout as delay} from 'node:timers/promises';

const require=createRequire(import.meta.url);
const fps=12;
const interval=1000/fps;

function ffmpegPath(){
  const root=dirname(require.resolve('playwright-core/package.json'));
  const {registry}=require(join(root,'lib/server/registry/index.js'));
  return process.env.REVIEW_FFMPEG??registry.findExecutable('ffmpeg').executablePath();
}

async function encode(frames,output){
  const ffmpeg=ffmpegPath();
  const encoders=spawnSync(ffmpeg,['-encoders'],{encoding:'utf8'});
  if(encoders.error||encoders.status!==0)throw new Error('FFmpeg do Playwright indisponível.',{cause:encoders.error});
  const codec=/\blibvpx-vp9\b/.test(encoders.stdout)?'libvpx-vp9':'libvpx';
  const child=spawn(ffmpeg,['-y','-loglevel','error','-f','image2pipe','-framerate',String(fps),
    '-c:v','mjpeg','-i','pipe:0','-an','-c:v',codec,'-pix_fmt','yuv420p',
    '-deadline','realtime','-cpu-used','5','-g','1','-crf','20','-b:v','0',output],{stdio:['pipe','ignore','pipe']});
  let stderr='';
  child.stderr.on('data',chunk=>{stderr+=chunk;});
  const [input,exit]=await Promise.allSettled([
    pipeline(Readable.from(frames),child.stdin),
    new Promise((resolve,reject)=>{
      child.once('error',reject);
      child.once('close',code=>code===0?resolve():reject(new Error('Falha na gravação WebM: '+stderr.trim())));
    }),
  ]);
  if(exit.status==='rejected')throw exit.reason;
  if(input.status==='rejected')throw input.reason;
}

async function validate(context,output,references,viewport,frameCount){
  const decoded=await mkdtemp(join(tmpdir(),'review-frames-'));
  let playback;
  try{
    // Sequential decoding gives each frame an exact index. Chromium's
    // asynchronous video seek can present a different frame during motion.
    await promisify(execFile)(ffmpegPath(),['-loglevel','error','-i',output,
      '-an','-vsync','0','-c:v','png',join(decoded,'%05d.png')]);
    assert.equal((await readdir(decoded)).length,frameCount);
    const pairs=await Promise.all(references.map(async ({index,jpeg})=>({
      index,jpeg,png:(await readFile(join(decoded,String(index+1).padStart(5,'0')+'.png'))).toString('base64'),
    })));
    playback=await context.newPage();
    const report=await playback.evaluate(async ({pairs,fps,durationSeconds})=>{
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const load=async (type,data)=>{
        const image=new Image();image.src='data:image/'+type+';base64,'+data;
        await image.decode();return image;
      };
      const samples=[];
      for(const {index,jpeg,png} of pairs){
        const [reference,frame]=await Promise.all([load('jpeg',jpeg),load('png',png)]);
        if(frame.width!==reference.width||frame.height!==reference.height)
          throw new Error('Dimensões do quadro diferentes da origem.');
        const width=canvas.width=frame.width,height=canvas.height=frame.height;
        const lower=Math.floor(height*.60);
        ctx.drawImage(reference,0,0);
        const before=ctx.getImageData(0,lower,width,height-lower).data;
        ctx.drawImage(frame,0,0);
        const after=ctx.getImageData(0,lower,width,height-lower).data;
        let total=0,large=0;
        for(let i=0;i<before.length;i+=4){
          const error=(Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])
            +Math.abs(before[i+2]-after[i+2]))/3;
          total+=error;
          if(error>20)large++;
        }
        samples.push({frameIndex:index,timeSeconds:index/fps,meanColorError:total/(before.length/4),
          largeErrorFraction:large/(before.length/4)});
      }
      return {width:canvas.width,height:canvas.height,durationSeconds,samples};
    },{pairs,fps,durationSeconds:frameCount/fps});
    assert.equal(report.width,viewport.width);
    assert.equal(report.height,viewport.height);
    for(const sample of report.samples){
      assert.ok(sample.meanColorError<9&&sample.largeErrorFraction<.14,
        'O quadro codificado diverge da metade inferior do viewport: '+JSON.stringify(sample));
    }
    return report;
  }finally{
    try{await playback?.close();}finally{await rm(decoded,{recursive:true,force:true});}
  }
}

export async function startViewportVideo(page,viewport){
  const geometry=await page.evaluate(()=>{
    const rect=selector=>{
      const {x,y,width,height}=document.querySelector(selector).getBoundingClientRect();
      return {x,y,width,height};
    };
    const canvas=document.querySelector('#game canvas');
    return {viewport:{width:innerWidth,height:innerHeight},
      visualViewport:{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale},
      canvas:{...rect('#game canvas'),pixelWidth:canvas.width,pixelHeight:canvas.height},
      controls:Object.fromEntries(['#joystick','#mobile-run','#btn-recenter','#speed-panel','.footer-bar'].map(key=>[key,rect(key)]))};
  });
  assert.deepEqual(geometry.viewport,viewport);
  assert.deepEqual(geometry.visualViewport,{...viewport,scale:1});
  assert.deepEqual(geometry.canvas,{x:0,y:0,...viewport,pixelWidth:viewport.width,pixelHeight:viewport.height});
  for(const [name,{x,y,width,height}] of Object.entries(geometry.controls))
    assert.ok(width>0&&height>0&&x>=0&&y>=0&&x+width<=viewport.width+.5&&y+height<=viewport.height+.5,name+' fora do quadro');

  const captures=[],start=performance.now();
  let recording=true,stoppedAt;
  const loop=(async()=>{
    while(recording){
      const at=performance.now()-start;
      const jpeg=await page.screenshot({type:'jpeg',quality:86,scale:'css',timeout:5000});
      captures.push({at,jpeg});
      if(recording)await delay(Math.max(0,at+interval-(performance.now()-start)));
    }
  })();
  // Attach a rejection handler immediately while gameplay proceeds.
  loop.catch(()=>{});
  return {
    async stop(output){
      recording=false;
      stoppedAt??=performance.now()-start;
      await loop;
      if(!output)return;
      assert.ok(captures.length>=20,'Poucos quadros capturados.');
      const frames=[];
      let index=0;
      for(let at=0;at<stoppedAt;at+=interval){
        while(index+1<captures.length&&captures[index+1].at<=at)index++;
        frames.push(captures[index].jpeg);
      }
      await encode(frames,output);
      const references=[.2,.55,.85].map(fraction=>{
        const index=Math.floor(frames.length*fraction);
        return {index,jpeg:frames[index].toString('base64')};
      });
      const playback=await validate(page.context(),output,references,viewport,frames.length);
      return {geometry,fps,sourceFrames:captures.length,encodedFrames:frames.length,playback};
    },
  };
}
