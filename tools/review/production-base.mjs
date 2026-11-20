import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const prefix=process.argv[2]??'/game-love/';
assert.match(prefix,/^\/(?:[\w.-]+\/)*$/);
const root=resolve('dist');
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(!url.pathname.startsWith(prefix)){res.writeHead(404).end();return;}
    const filename=decodeURIComponent(url.pathname.slice(prefix.length))||'index.html';
    const file=resolve(root,filename);
    if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
    const bytes=await readFile(file);
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.jpg':'image/jpeg'};
    res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');
    res.end(bytes);
  }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({channel:'chrome'});
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],assets=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{
    if(r.url().startsWith(origin+'/')){
      if(r.status()>=400)errors.push(r.status()+' '+r.url());
      if(r.url().includes('/assets/north-entrance/'))assets.push(r.url());
    }
  });
  await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
  await page.goto(origin+prefix+'?park=expanded');
  await page.waitForFunction(()=>document.querySelector('#app').getAttribute('aria-busy')==='false');
  let cdp;
  if(mobile){
    cdp=await context.newCDPSession(page);
    const b=await page.locator('#joystick').boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:b.x+b.width/2,y:b.y+b.height/2-38}]});
    try{await page.getByText('Entrar no High Park',{exact:true}).waitFor();}
    finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    await page.locator('#action-btn').tap();
  }else{
    await page.keyboard.down('w');
    try{await page.getByText('Entrar no High Park',{exact:true}).waitFor();}
    finally{await page.keyboard.up('w');}
    await page.locator('#action-btn').click();
  }
  await page.waitForFunction(()=>document.querySelector('#app').dataset.region==='high-park'&&document.querySelector('#app').getAttribute('aria-busy')==='false');
  await page.waitForFunction(()=>performance.getEntriesByType('resource').some(entry=>entry.name.endsWith('grass_medium_01-arm.jpg')));
  await page.waitForTimeout(1200);
  assert.ok(assets.some(u=>u.endsWith('north-gate.glb')));
  assert.equal(await page.locator('#data-status').textContent(),'OSM · PRÉVIA');
  await page.locator('#btn-map').click();
  await page.locator('#map-panel').waitFor({state:'visible'});
  await page.locator('#close-map').click();
  await page.locator('#btn-album').click();
  await page.locator('[data-locked-memory]').waitFor();
  await page.locator('#modal-close').click();
  await page.getByText('Voltar a Toronto',{exact:true}).waitFor();
  await page.locator('#action-btn').click();
  await page.waitForFunction(()=>document.querySelector('#app').dataset.region==='toronto'&&document.querySelector('#app').getAttribute('aria-busy')==='false');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({mobile,status:'passed',assetResponses:assets.length,base:prefix,map:true,album:true,roundTrip:true,errors}));
  await context.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
