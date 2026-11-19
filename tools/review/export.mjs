import {evaluateCamera} from './camera-evaluation.mjs';
import {spawn,spawnSync} from 'node:child_process';
import {access,mkdir,mkdtemp,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import {points} from './points.js';
import {compareGeometry,cartographicSvg} from './cartography.mjs';
import {reviewPipelineVersion,reviewProfiles} from './profiles.js';
import {motionDurationMs} from './motion-benchmark.js';
import {baselineIdentity,buildComparison,openReviewZip,writeComparisons} from './compare.mjs';
import {writeReport} from './report.mjs';
import {captureMobileGameplay,gameplayCaptures} from './mobile-gameplay.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const output=join(root,'artifacts/reviews');
const route='/tools/review/index.html';
const {viewport}=reviewProfiles.desktop;
const startedAt=new Date().toISOString();
const abort=new AbortController();
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>abort.abort(new Error('Exportação interrompida.')));
const version=command=>{
  const result=spawnSync('git',command,{cwd:root,encoding:'utf8'});
  return result.status===0?result.stdout.trim():null;
};

function run(command,args,{cwd=root,quiet=false,env=process.env}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,env,signal:abort.signal,stdio:quiet?'ignore':'inherit'});
    child.once('error',reject);
    child.once('close',(code,signal)=>resolve({code,signal}));
  });
}
async function check(script,buildDir){
  console.log('[review] npm run '+script);
  try {
    const args=['run',script,...(script==='build'?['--','--outDir',buildDir]:[])];
    const result=await run('npm',args,{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
    return {command:'npm run '+script,status:result.code===0?'passed':'failed',exitCode:result.code,signal:result.signal};
  }catch(error){
    abort.signal.throwIfAborted();
    return {command:'npm run '+script,status:'unavailable',reason:error.code??'Falha ao executar npm'};
  }
}
async function reviewUrl(origin){
  const url=new URL(origin);
  if(!['http:','https:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||
     url.username||url.password||url.pathname!=='/'||url.search||url.hash){
    throw new Error('REVIEW_URL deve ser uma origem HTTP local, por exemplo http://127.0.0.1:5177.');
  }
  const target=new URL(route,url);
  try{
    const response=await fetch(target,{redirect:'error',signal:AbortSignal.timeout(1200)});
    if(response.ok&&(await response.text()).includes('<title>Game Love · Revisão</title>'))return target.href;
  }catch{}
  return null;
}
async function findServer(){
  const requested=process.env.REVIEW_URL;
  if(requested){
    const target=await reviewUrl(requested);
    if(!target)throw new Error('Servidor informado não disponibiliza a página de revisão do Game Love.');
    return {target};
  }
  if(process.env.REVIEW_ISOLATED!=='1'){
    for(const port of [5173,5174,5175,5177]){
      const target=await reviewUrl('http://127.0.0.1:'+port);
      if(target)return {target};
    }
  }
  const server=await createServer({root,configFile:false,server:{
    host:'127.0.0.1',port:4178,hmr:false,watch:null,
  }});
  try {
    await server.listen();
    const {port}=server.httpServer.address();
    return {target:'http://127.0.0.1:'+port+route,server};
  }catch(error){await server.close();throw error;}
}
async function launch(){
  const executablePath=process.env.REVIEW_BROWSER_PATH;
  try {
    if(executablePath)return await chromium.launch({executablePath});
    try {await access(chromium.executablePath());}
    catch {return await chromium.launch({channel:'chrome'});}
    return await chromium.launch();
  }catch(error){
    if(executablePath)throw error;
    throw new Error('Não foi possível abrir Chromium ou Google Chrome. Instale com npx playwright-core install chromium ou informe REVIEW_BROWSER_PATH.',{cause:error});
  }
}
const safeMessage=message=>String(message)
  .replace(/https?:\/\/[^\s"'<>]+/g,value=>{
    try {const url=new URL(value);return url.origin+url.pathname;}catch{return '[URL]';}
  })
  .replace(/\/(?:Users|private\/var|var\/folders|home)\/[^\s)]+/g,'[local path]')
  .replace(/(bearer\s+|(?:token|password|secret|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi,'$1[redacted]')
  .slice(0,1200);

async function collectProfile(browser,target,dir,profileId){
  const profile=reviewProfiles[profileId];
  const page=await browser.newPage({viewport:profile.viewport,deviceScaleFactor:profile.deviceScaleFactor,
    isMobile:profile.mobileViewportSimulation,hasTouch:profile.mobileViewportSimulation,
    locale:'pt-BR',timezoneId:'UTC',serviceWorkers:'block'});
  const url=new URL(target);
  url.searchParams.set('profile',profileId);
  const origin=url.origin;
  const issues=[],captures=[],metrics=[];
  const selected=points.filter(point=>(point.profile??'desktop')===profileId);
  let geography={status:'unavailable'},motion=null;
  const geographicFiles=[];
  let current=null;
  const record=(type,details)=>issues.push({type,captureId:current,...details});
  await page.route('**/*',route=>{
    if(new URL(route.request().url()).origin!==origin)return route.abort('blockedbyclient');
    return route.continue();
  });
  await page.exposeBinding('reviewRejection',(_,message)=>record('unhandled-rejection',{message:safeMessage(message)}));
  await page.addInitScript(()=>{
    window.addEventListener('unhandledrejection',event=>window.reviewRejection(String(event.reason)).catch(()=>{}));
  });
  page.on('pageerror',error=>record('javascript',{message:safeMessage(error.message)}));
  page.on('console',message=>{
    if(message.type()==='error')record('console.error',{message:safeMessage(message.text())});
  });
  page.on('requestfailed',request=>record('asset-request-failed',{
    url:safeMessage(request.url()),reason:safeMessage(request.failure()?.errorText)}));
  page.on('response',response=>{
    if(response.status()>=400)record('asset-http-error',{url:safeMessage(response.url()),status:response.status()});
  });

  const evaluate=(method,id,timeout=25000)=>page.evaluate(async ({method,id,timeout})=>{
    let timer;
    try{
      return await Promise.race([
        window.gameLoveReview[method](id),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Tempo excedido em '+method)),timeout);}),
      ]);
    }finally{clearTimeout(timer);}
  },{method,id,timeout});

  try {
    await page.goto(url.href,{waitUntil:'load',timeout:20000});
    await page.waitForFunction(version=>window.gameLoveReview?.version===version,reviewPipelineVersion,{timeout:12000});
    for(const point of selected){
      abort.signal.throwIfAborted();
      current=point.id;
      const base={id:point.id,label:point.label,region:point.region};
      try {
        const result=await evaluate('prepare',point.id);
        if(result.status==='unavailable'){
          captures.push({...base,...result});
          console.log('[review] indisponível '+point.id+' · '+result.reason);
          continue;
        }
        const file='screenshots/'+result.fileStem+'.png';
        await page.screenshot({path:join(dir,file),animations:'disabled',timeout:10000});
        captures.push({...base,...result,file});
        try{
          const values=await evaluate('measure',point.id);
          metrics.push({captureId:point.id,...values});
        }catch(error){
          record('performance-failed',{message:safeMessage(error.message)});
          metrics.push({captureId:point.id,status:'unavailable'});
        }
        console.log('[review] capturado '+result.fileStem);
      }catch(error){
        const reason=safeMessage(error.message);
        captures.push({...base,status:'failed',reason});
        record('capture-failed',{message:reason});
        console.error('[review] falha em '+point.id+' · '+reason);
      }
    }
    if(profileId==='desktop'){
      current='motion-high-park';
      try{
        motion=await evaluate('motion',null,motionDurationMs+12000);
      }catch(error){
        const reason=safeMessage(error.message);
        motion={status:'failed',reason};
        record('motion-failed',{message:reason});
      }
      motion={...motion,errors:issues.filter(issue=>issue.captureId===current)};
      if(motion.errors.length&&motion.status==='passed')motion.status='failed';
      console.log('[review] Percurso: '+motion.status);
      current=null;
      geography=await page.evaluate(()=>window.gameLoveReview.geography());
    }
    if(geography.status==='source-comparison'){
      const scene=captures.find(capture=>capture.id==='06-high-park-ortografica'&&capture.origin==='OSM REAL');
      const source=await readFile(join(root,'tools/data/high-park-north.osm-source.json'));
      const parts=await page.evaluate(()=>window.gameLoveReview.renderedGeometry());
      const comparison=compareGeometry(source,parts,scene);
      geography.cartography=comparison.report;
      console.log('[review] Cartografia: '+comparison.report.status);
      await mkdir(join(dir,'geography'),{recursive:true});
      const snapshot=comparison.report.snapshot.file;
      await writeFile(join(dir,snapshot),comparison.snapshot);
      geographicFiles.push(snapshot);
      for(const [file,overlay] of [['07-high-park-referencia-osm',false],['08-high-park-sobreposicao',true]]){
        const path='screenshots/'+file+'.png';
        await page.setContent('<style>body{margin:0}</style>'+cartographicSvg(comparison,overlay,geography.navigation?.points));
        await page.screenshot({path:join(dir,path),timeout:10000});
        geographicFiles.push(path);
      }
    }
  }catch(error){
    record('review-page-failed',{message:safeMessage(error.message)});
    for(const point of selected)if(!captures.some(capture=>capture.id===point.id)){
      captures.push({id:point.id,label:point.label,region:point.region,status:'failed',reason:'Página de revisão indisponível.'});
    }
  }finally {await page.close();}
  const parkDemo=captures.some(capture=>capture.region==='high-park' && capture.origin==='DEMO');
  for(const issue of issues){
    if(parkDemo && issue.type==='asset-http-error' && issue.status===404 && issue.url.endsWith('/data/high-park.osm.json')){
      issue.expected=true;issue.reason='Recorte OSM opcional ausente; o jogo carregou o High Park DEMO.';
    }
  }
  return {captures,issues,metrics,geography,geographicFiles,motion};
}

async function publish(stage,bundle,archive){
  const latest=join(output,'latest'),backup=join(stage,'previous-latest');
  let previous=false,published=false;
  try{
    try{await rename(latest,backup);previous=true;}
    catch(error){if(error.code!=='ENOENT')throw error;}
    await rename(bundle,latest);published=true;
    await rename(archive,join(output,'game-love-review.zip'));
  }catch(error){
    if(published)await rm(latest,{recursive:true,force:true});
    if(previous)await rename(backup,latest);
    throw error;
  }
}

async function main(){
  const {values:{baseline,standalone,'baseline-sha256':expectedSha256,'camera-evaluation':cameraEvaluation}}=parseArgs({
    options:{baseline:{type:'string'},standalone:{type:'boolean'},'baseline-sha256':{type:'string'},'camera-evaluation':{type:'boolean'}},
  });
  if(baseline===''||(expectedSha256!==undefined&&!baseline))throw new Error('Informe o arquivo em --baseline.');
  await mkdir(output,{recursive:true});
  const lock=join(output,'.export-lock');
  try {await mkdir(lock);}catch(error){
    if(error.code==='EEXIST')throw new Error('Já existe uma exportação em andamento. Veja docs/REVIEW_EXPORT.md.');
    throw error;
  }
  let stage,server,browser,closeOnAbort;
  try {
    stage=await mkdtemp(join(output,'.stage-'));
    const bundle=join(stage,'report'),archive=join(stage,'game-love-review.zip');
    const prior=baseline?await openReviewZip(resolve(baseline),stage,{outputZip:join(output,'game-love-review.zip'),expectedSha256}):null;
    await mkdir(join(bundle,'screenshots'),{recursive:true});
    const git={commit:version(['rev-parse','HEAD']),dirty:null};
    const changes=version(['status','--porcelain']);
    if(changes!==null)git.dirty=Boolean(changes);
    const checks={}
    checks.build=await check('build',join(stage,'build'));
    checks.tests=await check('test');
    abort.signal.throwIfAborted();
    const started=await findServer();server=started.server;
    console.log('[review] '+(server?'Vite iniciado para as capturas.':'Reutilizando servidor Vite.'));
    browser=await launch();
    closeOnAbort=()=>{void browser.close().catch(()=>{});};
    abort.signal.addEventListener('abort',closeOnAbort,{once:true});
    abort.signal.throwIfAborted();
    const profiles=[];
    for(const id of Object.keys(reviewProfiles))profiles.push(await collectProfile(browser,started.target,bundle,id));
    const [desktop]=profiles;
    const gameplay=await captureMobileGameplay(browser,started.target,bundle,safeMessage);
    checks.touch=gameplay.touch;
    const {geography,geographicFiles,motion}=desktop;
    const captures=[...profiles.flatMap(result=>result.captures),...gameplay.captures]
      .sort((a,b)=>a.id.localeCompare(b.id));
    const issues=[...profiles.flatMap(result=>result.issues),...gameplay.issues];
    const metrics=profiles.flatMap(result=>result.metrics);
    let cameraTrace;
    if(cameraEvaluation){
      try{cameraTrace=await evaluateCamera(browser,started.target,bundle,stage);}
      catch(error){
        cameraTrace={status:'failed',reason:safeMessage(error.message)};
        issues.push({type:'camera-evaluation-failed',message:cameraTrace.reason});
      }
      checks.camera={status:cameraTrace.status,report:'camera-evaluation.json'};
      console.log('[review] Avaliação de câmera: '+cameraTrace.status);
    }
    abort.signal.throwIfAborted();
    geography.git=git;
    const browserInfo={engine:'chromium',version:browser.version(),headless:true};
    const runtime={browser:browserInfo,platform:process.platform,architecture:process.arch};
    const success=captures.filter(c=>c.status==='captured').length;
    const unavailable=captures.filter(c=>c.status==='unavailable').length;
    const failed=captures.length-success-unavailable;
    const partial=success!==points.length+gameplayCaptures.length||geographicFiles.length!==3||
      geography.cartography?.status!=='within-tolerance'||geography.navigation?.status!=='passed'||
      motion?.status!=='passed'||Object.values(checks).some(check=>check.status!=='passed')||
      issues.some(issue=>!issue.expected);
    const metadata={schemaVersion:2,pipelineVersion:reviewPipelineVersion,status:partial?'partial':'complete',
      exportedAt:startedAt,git,checks,browser:browserInfo,runtime,profiles:reviewProfiles,
      ...(prior?{baseline:baselineIdentity(prior)}:{}),
      reproducibility:{animationTimeSeconds:0,lighting:'Iluminação fixa da cena, sem relógio de dia.',
        proceduralSeedPolicy:'Sementes fixas definidas no gerador versionado pelo commit Git.'},
      viewport,resolution:viewport,captures,geographicEvidence:geographicFiles,video:{status:'not-generated',reason:'MP4 opcional por inclusão manual.'}};
    const performance={schemaVersion:2,runtime,environment:'Navegador automatizado. Os resultados não equivalem ao desempenho em dispositivos móveis reais.',
      method:'Intervalo bruto entre requestAnimationFrame. 15 intervalos de aquecimento e 75 amostras por vista estática.',
      captures:metrics,motion:motion?{...motion,runtime}:null};
    const json=(file,value)=>writeFile(join(bundle,file),JSON.stringify(value,null,2)+'\n');
    await Promise.all([json('metadata.json',metadata),json('performance.json',performance),json('console-errors.json',issues),json('geographic-correspondence.json',geography)]);

    if(cameraTrace)await json('camera-evaluation.json',cameraTrace);
    const cameraFiles=cameraTrace?['camera-evaluation.json',...(cameraTrace.video?[cameraTrace.video]:[])]:[];

    const imageFiles=[...geographicFiles.filter(file=>file.endsWith('.png')),...captures.flatMap(capture=>capture.file?[capture.file]:[])];
    const current={metadata,performance,readImage:file=>readFile(join(bundle,file))};
    const comparison=prior?await buildComparison(prior,current):null;
    const comparisonFiles=comparison?await writeComparisons(bundle,comparison):[];
    const reportData={metadata,performance,geography,issues,imageFiles,readImage:current.readImage,comparison};
    await writeReport(join(bundle,'report.html'),reportData);
    const standaloneFiles=standalone?['report-standalone.html']:[];
    if(standalone)await writeReport(join(bundle,standaloneFiles[0]),{...reportData,standalone:true});

    // Explicit allowlist. Nothing outside this staging directory can enter the archive.
    const files=['metadata.json','performance.json','console-errors.json','geographic-correspondence.json',
      'report.html',...cameraFiles,...standaloneFiles,...geographicFiles,...captures.flatMap(capture=>capture.file?[capture.file]:[]),...comparisonFiles];
    if((await run('zip',['-q','-X',archive,...files],{cwd:bundle})).code!==0)
      throw new Error('Falha ao criar o ZIP.');
    if((await run('unzip',['-tq',archive],{quiet:true})).code!==0)
      throw new Error('O ZIP não passou na verificação de integridade.');
    await publish(stage,bundle,archive);
    console.log('[review] '+(partial?'Pacote parcial':'Sucesso')+' · '+success+' capturas, '+unavailable+' indisponíveis, '+failed+' falharam.');
    console.log('[review] ZIP: '+join(output,'game-love-review.zip'));
    if(partial)process.exitCode=1;
  }finally{
    if(closeOnAbort)abort.signal.removeEventListener('abort',closeOnAbort);
    try {await Promise.allSettled([browser?.close(),server?.close()]);}
    finally {
      if(stage)await rm(stage,{recursive:true,force:true});
      await rm(lock,{recursive:true,force:true});
    }
  }
}

main().catch(error=>{
  console.error('[review] Falha: '+safeMessage(error.message));
  if(error.cause)console.error('[review] '+safeMessage(error.cause.message));
  process.exitCode=1;
});
