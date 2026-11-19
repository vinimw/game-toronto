import {join} from 'node:path';
import {reviewProfiles} from './profiles.js';

const profile=reviewProfiles.mobile;
export const gameplayCaptures=[
  {id:'14-toronto-mobile-hud',label:'Toronto · portal com HUD mobile',region:'toronto'},
  {id:'15-high-park-mobile-hud',label:'High Park · entrada com HUD mobile',region:'high-park'},
  {id:'16-high-park-mobile-mapa',label:'High Park · mapa local e HUD mobile',region:'high-park'},
];

export async function captureMobileGameplay(browser,target,dir,safeMessage){
  const url=new URL('/?review=1',target);
  const page=await browser.newPage({viewport:profile.viewport,deviceScaleFactor:profile.deviceScaleFactor,
    isMobile:true,hasTouch:true,reducedMotion:'reduce',locale:'pt-BR',timezoneId:'UTC',serviceWorkers:'block'});
  const captures=[],issues=[];
  let touch={status:'unavailable'},current='mobile-touch';
  const record=(type,message)=>issues.push({type,captureId:current,message:safeMessage(message)});
  page.on('pageerror',error=>record('javascript',error.message));
  page.on('console',message=>{
    if(message.type()==='error'&&!message.location().url.endsWith('/favicon.ico'))record('console.error',message.text());
  });
  page.on('response',response=>{
    if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))
      record('asset-http-error',response.status()+' '+response.url());
  });
  page.on('requestfailed',request=>record('asset-request-failed',request.url()+' '+request.failure()?.errorText));
  await page.route('**/*',route=>{
    const resource=new URL(route.request().url());
    // Keep the existing CSS fallback fonts while making the export offline.
    if(resource.origin==='https://fonts.googleapis.com'&&route.request().resourceType()==='stylesheet')
      return route.fulfill({status:200,contentType:'text/css',body:''});
    return resource.origin===url.origin?route.continue():route.abort();
  });

  const action=page.locator('#action-btn');
  const waitAction=label=>page.waitForFunction(label=>{
    const button=document.querySelector('#action-wrap');
    return !button.classList.contains('hidden')&&button.textContent.includes(label);
  },label,{timeout:10000});
  const waitScene=region=>page.waitForFunction(region=>{
    const app=document.querySelector('#app');
    return app.dataset.region===region&&app.getAttribute('aria-busy')==='false';
  },region,{timeout:10000});
  const readPose=async()=>JSON.parse(await page.locator('#game canvas').getAttribute('data-review-pose'));
  async function take(point,mapOpen=false){
    current=point.id;
    for(const selector of ['#joystick','#mobile-run','#speed-panel','#btn-map',mapOpen?'#map-panel':'#action-btn'])
      await page.locator(selector).waitFor({state:'visible',timeout:5000});
    await page.locator('#toast').waitFor({state:'hidden',timeout:5000});
    const pose=await readPose();
    if(pose.origin!==(point.region==='toronto'?'DEMO':'OSM REAL'))throw new Error('Origem inesperada no gameplay.');
    const file='screenshots/'+point.id+'.png';
    await page.screenshot({path:join(dir,file),animations:'disabled',timeout:10000});
    captures.push({...point,...pose,file,status:'captured',captureMode:'gameplay',
      hud:{joystick:true,run:true,interaction:!mapOpen,localMap:mapOpen,speed:'1×',fontSource:'system-fallback'},
      viewport:profile.viewport,deviceScaleFactor:profile.deviceScaleFactor,mobileViewportSimulation:true});
    console.log('[review] capturado '+point.id);
  }

  try{
    await page.goto(url.href,{waitUntil:'load',timeout:15000});
    await waitScene('toronto');
    await page.waitForFunction(()=>document.querySelector('#game canvas')?.dataset.reviewPose);
    const start=(await readPose()).position.local;
    const joystick=await page.locator('#joystick').boundingBox();
    if(!joystick)throw new Error('Joystick real não encontrado.');
    const client=await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,
      x:joystick.x+joystick.width/2,y:joystick.y+joystick.height/2-32}]});
    try{await waitAction('Entrar no High Park');}
    finally{await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    const end=(await readPose()).position.local;
    const distanceMeters=Math.hypot(end[0]-start[0],end[2]-start[2]);
    if(distanceMeters<1)throw new Error('O toque no joystick não deslocou a personagem.');
    touch={status:'passed',distanceMeters,environment:'Chromium mobile emulado, eventos touch CDP sobre o joystick real.'};

    await action.tap();await waitScene('high-park');
    await waitAction('Voltar a Toronto');
    await take(gameplayCaptures[1]);
    await page.locator('#btn-map').tap();
    await take(gameplayCaptures[2],true);
    await page.locator('#close-map').tap();
    await waitAction('Voltar a Toronto');
    await action.tap();await waitScene('toronto');
    await waitAction('Entrar no High Park');
    await take(gameplayCaptures[0]);
  }catch(error){
    const reason=safeMessage(error.message);
    if(touch.status!=='passed')touch={status:'failed',reason};
    record('mobile-gameplay-failed',reason);
    for(const point of gameplayCaptures)if(!captures.some(capture=>capture.id===point.id))
      captures.push({...point,status:'failed',reason});
  }finally{await page.close();}
  captures.sort((a,b)=>a.id.localeCompare(b.id));
  return {captures,issues,touch};
}
