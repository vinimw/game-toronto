import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=name=>readFile(new URL('../public/assets/north-entrance/'+name,import.meta.url));
async function model(name){
  const bytes=await read(name+'.glb');
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.ok(doc.accessors.filter(x=>x.min).every(x=>x.min.every(Number.isFinite)));
  assert.ok(doc.buffers.every(x=>!x.uri));
  return {doc,bytes};
}
const triangles=doc=>doc.meshes.flatMap(mesh=>mesh.primitives)
  .reduce((sum,part)=>sum+(doc.accessors[part.indices??part.attributes.POSITION].count/3),0);

test('authored gate is a local GLB with separate stone, iron and lantern materials',async()=>{
  const {doc,bytes}=await model('north-gate');
  assert.ok(bytes.length<1024*1024);
  for(const key of ['Masonry_PBR','Weathered wrought iron','Lantern cream glass'])
    assert.ok(doc.materials.some(material=>material.name===key));
});

test('six authored tree variants contain a leaf image and have a lighter geometry LOD',async()=>{
  for(const species of ['maple-43','maple-79','oak-31','oak-67','sakura-19','sakura-61']){
    const high=(await model(species+'-high')).doc;
    const balanced=(await model(species+'-balanced')).doc;
    assert.equal(high.meshes.length,2);
    assert.equal(balanced.meshes.length,2);
    assert.equal(high.images.length,1);
    assert.equal(balanced.images.length,1);
    assert.ok(triangles(balanced)<triangles(high)*.6);
  }
});

test('all four material sets ship their three local PBR channels',async()=>{
  for(const id of ['asphalt_track','concrete_pavement','stone_wall','grass_medium_01']){
    for(const map of ['Diffuse','nor_gl','arm']){
      const bytes=await read(id+'-'+map+'.jpg');
      assert.equal(bytes.readUInt16BE(),0xffd8);
      assert.ok(bytes.length>4096&&bytes.length<275000);
    }
  }
});
