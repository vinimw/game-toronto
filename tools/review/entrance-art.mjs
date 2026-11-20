import assert from 'node:assert/strict';
import {join} from 'node:path';
import {enterHighPark,sampleMovement} from './camera-evaluation.mjs';
import {startViewportVideo} from './full-viewport-video.mjs';

export async function recordEntranceWalk(browser,target,bundle,safeMessage){
  const viewport={width:1280,height:720};
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  const errors=[];
  let recording;
  try{
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(safeMessage(error.message)));
    page.on('console',message=>{if(message.type()==='error')errors.push(safeMessage(message.text()));});
    await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
    await page.goto(new URL('/?review=1&park=expanded',target).href);
    await page.waitForSelector('#game canvas[data-review-pose]');
    await enterHighPark(page,context,false);
    const initial=[-22,-133],yaw=-Math.PI+.24;
    await page.evaluate(([initial,yaw])=>window.stageCameraReview(initial,yaw),[initial,yaw]);
    await page.waitForFunction(initial=>{
      const data=JSON.parse(document.querySelector('#game canvas').dataset.reviewPose);
      return data.entranceArt?.gate?.pillars===4&&Math.hypot(data.position.local[0]-initial[0],
        data.position.local[2]-initial[1])<.01;
    },initial);
    recording=await startViewportVideo(page,viewport,24,{touchControls:false});
    await page.waitForTimeout(500);
    await page.keyboard.down('w');
    let samples;
    try{samples=await sampleMovement(page,7000);}
    finally{await page.keyboard.up('w');}
    const start=samples[0].position,end=samples.at(-1).position;
    assert.ok(end[2]-start[2]>26,'Percurso insuficiente pela entrada.');
    assert.ok(samples.every(s=>s.position.every(Number.isFinite)&&!s.obstruction.excessiveProximity));
    assert.deepEqual(errors,[]);
    const file='north-entrance-walk.webm';
    const video=await recording.stop(join(bundle,file));
    const intervals=samples.slice(1).map((s,i)=>s.ms-samples[i].ms).sort((a,b)=>a-b);
    return {status:'passed',file,viewport,start,end,video,errors,
      fps:intervals.length*1000/(samples.at(-1).ms-samples[0].ms),p95Ms:intervals[Math.ceil(intervals.length*.95)-1]};
  }catch(error){
    return {status:'failed',reason:safeMessage(error.message),errors};
  }finally{
    try{await recording?.stop();}finally{await context.close();}
  }
}

export function entranceComparison(captures){
  const records=new Map(captures.map(capture=>[capture.id.slice(0,2),capture]));
  const matches=[['46','47','Arco, lanterna e pilares'],['54','55','Troncos ramificados e folhagem'],['53','51','Comparação mobile']].map(([a,b,label])=>{
    const before=records.get(a),after=records.get(b);
    const matched=before?.status==='captured'&&after?.status==='captured'&&
      JSON.stringify(before.camera)===JSON.stringify(after.camera)&&JSON.stringify(before.viewport)===JSON.stringify(after.viewport);
    return {label,matched,before:before?.file,after:after?.file};
  });
  return matches;
}

export function entranceComparisonHtml(matches,video){
  const cards=matches.map(({label,before,after,matched})=>`<section><h2>${label}</h2>
    <p>${matched?'Mesma posição, projeção e viewport.':'Enquadramento indisponível.'}</p>
    <div class="pair"><figure><img src="${before}" alt="Antes"><figcaption>Antes</figcaption></figure>
    <figure><img src="${after}" alt="Depois"><figcaption>Depois</figcaption></figure></div></section>`).join('');
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
  <title>Entrada norte do High Park</title>
  <style>body{margin:24px auto;max-width:1170px;padding:0 14px;background:#f1eee4;color:#252d24;font:16px system-ui}img,video{width:100%;display:block}figure{margin:0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figcaption{margin:.5em 0}section{margin:2em 0}@media(max-width:620px){.pair{grid-template-columns:1fr}}</style>
  <main><h1>Entrada norte do High Park</h1><a href="report.html">Voltar ao relatório</a>
  <section><h2>Referência arquitetônica</h2><div class="pair">
  <figure><img src="reference/high-park-gates-sookie.jpg" alt="Foto do arco de ferro e da lanterna da entrada"><figcaption>“High park gates.jpg” por sookie · original sem alterações · <a href="https://commons.wikimedia.org/wiki/File:High_park_gates.jpg">Wikimedia Commons</a> · <a href="https://creativecommons.org/licenses/by/2.0/">CC BY 2.0</a></figcaption></figure>
  <figure><img src="screenshots/48-north-entrance-from-park.png" alt="Arco de ferro e lanterna modelados em 3D"><figcaption>Vista 3D de dentro do parque. Elementos correspondentes: nervuras e volutas de ferro, lanterna central e capitéis.</figcaption></figure></div>
  <p><a href="https://www.toronto.ca/wp-content/uploads/2026/04/95bc-Presentation-1HPMS-Road-Redesign-Phase-2-Public-MeetingAODA033026.pdf#page=12">Referência municipal do conjunto, cercas e placa</a></p></section>
  ${cards}${video.status==='passed'?'<section><h2>Percurso a pé</h2><video controls src="'+video.file+'"></video></section>':''}</main></html>`;
}
