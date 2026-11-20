import {readdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

// Every public file must be explicitly approved before deployment. Vite copies
// public/ verbatim, so reject unexpected files instead of silently publishing.
const approved=new Set([
  'data/high-park.osm.json','data/high-park-expanded.osm.json','data/high-park-terrain.json',
  ...['asphalt_track','concrete_pavement','stone_wall','grass_medium_01']
    .flatMap(name=>['Diffuse','nor_gl','arm'].map(kind=>'assets/north-entrance/'+name+'-'+kind+'.jpg')),
  'assets/north-entrance/north-gate.glb',
  'assets/north-entrance/sakura-19-low.glb','assets/north-entrance/sakura-61-low.glb',
  ...['maple-43','maple-79','oak-31','oak-67','sakura-19','sakura-61']
    .flatMap(name=>['high','balanced'].map(lod=>'assets/north-entrance/'+name+'-'+lod+'.glb')),
]);
async function files(directory){
  const entries=await readdir(directory,{withFileTypes:true});
  return (await Promise.all(entries.map(async entry=>{
    assert.ok(entry.isFile()||entry.isDirectory(),'Unexpected link or special file: '+entry.name);
    return entry.isDirectory()?(await files(directory+'/'+entry.name)).map(file=>entry.name+'/'+file):[entry.name];
  }))).flat();
}
for(const file of await files('public'))assert.ok(approved.has(file),'Unapproved public file: '+file);
for(const file of await files('dist')){
  const bundle=/^assets\/[\w.-]+\.(?:js|css)$/.test(file);
  assert.ok(file==='index.html'||approved.has(file)||bundle,'Unapproved deployment file: '+file);
}
assert.ok((await readFile('dist/index.html','utf8')).includes('type="module"'));
console.log('Pages artifact verified. Only app bundles and approved public assets are present.');
