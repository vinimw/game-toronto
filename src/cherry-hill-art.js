import * as THREE from 'three';
import {nearestOnPath,seeded} from './geo.js';
import {createWalkTest} from './movement.js';
import {realPathAppearance} from './visual-settings.js';
import {collectResources,disposeScene} from './scene-resources.js';
import {cherryHill} from './cherry-hill-manifest.js';

export function cherryPlacements(world){
  const trail=world.features.find(feature=>feature.osmId===cherryHill.trailId);
  if(!trail)return [];
  const [west,north,east,south]=cherryHill.bounds;
  const paths=world.features.filter(f=>f.kind==='path'&&
    f.points.some(([x,z])=>x>west-70&&x<east+70&&z>north-70&&z<south+70));
  const canWalk=createWalkTest(world.features,world.bbox);
  const random=seeded(19590401),trees=[];
  const clear=(point,margin)=>canWalk(...point,margin)&&paths.every(path=>
    nearestOnPath(point,[path]).dist>realPathAppearance(path).width/2+margin);
  for(let z=735;z<851;z+=8){
    const center=nearestOnPath([-200,z],[trail]).point;
    for(const side of [-1,1]){
      const x=center[0]+side*(4.5+random()*8.5),y=center[1]+(random()-.5)*5;
      const scale=.84+random()*.47;
      if(x<west||x>east||!clear([x,y],1.15)||trees.some(tree=>Math.hypot(tree.x-x,tree.z-y)<4))continue;
      trees.push({x,z:y,scale,yaw:random()*Math.PI*2,variant:Math.floor(random()*2)});
    }
  }
  return trees;
}

function contactTexture(){
  const size=32,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const radius=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1);
    pixels.set([72,57,62,Math.round(162*Math.max(0,1-radius)**.78*(.6+.4*Math.cos(x*1.48+y*.87)**2))],(y*size+x)*4);
  }
  const texture=new THREE.DataTexture(pixels,size,size);
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return texture;
}

// Screen-door coverage keeps both LODs in the opaque depth pass.
function treeFinish(material,progress,invert,bark){
  const uniform={value:progress};
  material.onBeforeCompile=shader=>{
    shader.uniforms.hillCoverage=uniform;
    shader.vertexShader='varying vec3 vHillBark;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvHillBark=position;');
    shader.fragmentShader='uniform float hillCoverage;varying vec3 vHillBark;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',
      '#include <alphatest_fragment>\n'+
      'float grain=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));\n'+
      (invert?'if(grain<1.-hillCoverage)discard;':'if(grain>=hillCoverage)discard;')+
      (bark?`vec3 p=vHillBark;
        float ridge=sin(p.x*98.+sin(p.y*3.)*2.+p.z*60.);
        float band=sin(p.y*24.+sin(p.x*7.)*2.)*.07;
        diffuseColor.rgb*=.94+ridge*.13+band;`:''));
  };
  material.customProgramCacheKey=()=>`cherry-tree-${invert}-${bark}`;
  return uniform;
}

export function buildCherryArt(world,trees,models,lod){
  const root=new THREE.Group(),shared=new Set(),dummy=new THREE.Object3D();
  root.name=cherryHill.id+':'+lod;
  let blossomMap;
  const coverage=[];
  for(const [variant,model] of models.entries()){
    const selected=trees.filter(tree=>tree.variant===variant);
    for(const resource of collectResources(model))shared.add(resource);
    model.traverse(part=>{
      if(!part.isMesh)return;
      const flowers=part.material.name.startsWith('LeafCards');
      const material=part.material.clone();
      if(flowers){
        blossomMap??=material.map;
        material.map=blossomMap;
        material.color.setHex(variant?0xffdce7:0xfff9f5);
        material.emissiveMap=blossomMap;
        material.emissive.setHex(variant?0xf3b0c6:0xffeae7);
        material.emissiveIntensity=variant?.24:.35;
        material.side=THREE.DoubleSide;material.alphaTest=.43;
        material.transparent=false;material.depthWrite=true;
      }
      coverage.push(treeFinish(material,1,lod==='low',!flowers));
      const geometry=part.geometry.clone().applyMatrix4(part.matrixWorld);
      const batch=new THREE.InstancedMesh(geometry,material,selected.length);
      selected.forEach(({x,z,scale,yaw},index)=>{
        dummy.position.set(x,world.terrain.at(x,z)-.07,z);
        dummy.rotation.set(Math.sin(yaw)*.09,yaw,Math.cos(yaw)*.055);
        const spread=.91+Math.sin(yaw*2)*.16;
        dummy.scale.set(scale*spread,scale,scale*(1.86-spread));dummy.updateMatrix();
        batch.setMatrixAt(index,dummy.matrix);
      });
      batch.computeBoundingSphere();root.add(batch);
    });
  }
  if(lod!=='low')dressGround(root,world,trees,lod);
  return {root,setCoverage(value){for(const uniform of coverage)uniform.value=value;},dispose(){root.removeFromParent();disposeScene(root,shared);}};
}

function dressGround(root,world,trees,lod){
  const random=seeded(2604);
  const petalShape=new THREE.Shape();
  petalShape.moveTo(0,-.85);
  petalShape.bezierCurveTo(-.38,-.5,-.91,.37,-.58,.71);
  petalShape.bezierCurveTo(-.38,1,.0,.67,.09,.72);
  petalShape.bezierCurveTo(.53,1,.75,.62,.62,.32);
  petalShape.quadraticCurveTo(.46,-.31,0,-.85);
  const petal=new THREE.ShapeGeometry(petalShape,3).rotateX(-Math.PI/2);
  const blades=[],bladeRandom=seeded(803);
  for(let k=0;k<7;k++){
    const angle=k*2.399,dx=Math.cos(angle),dz=Math.sin(angle),height=.12+bladeRandom()*.26;
    let previous=[];
    for(let i=0;i<=3;i++){
      const t=i/3,width=.017*(1-t)**.65,lean=.18*t*t;
      const x=dx*(.04+lean),z=dz*(.04+lean);
      const left=[x-dz*width,height*t,z+dx*width],right=[x+dz*width,height*t,z-dx*width];
      if(i)blades.push(...previous[0],...previous[1],...left,...left,...previous[1],...right);
      previous=[left,right];
    }
  }
  const grass=new THREE.BufferGeometry();
  grass.setAttribute('position',new THREE.Float32BufferAttribute(blades,3));
  grass.computeVertexNormals();
  const count=lod==='high'?34:18;
  const petals=new THREE.InstancedMesh(petal,new THREE.MeshLambertMaterial({side:THREE.DoubleSide}),trees.length*count);
  const grasses=new THREE.InstancedMesh(grass,new THREE.MeshLambertMaterial({side:THREE.DoubleSide}),trees.length*count);
  const material=new THREE.MeshBasicMaterial({
    map:contactTexture(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,
  });
  // Contact patches follow HRDEM.
  const positions=[],uv=[],indices=[],dummy=new THREE.Object3D(),color=new THREE.Color();
  const paths=world.features.filter(f=>f.kind==='path'&&f.points.some(([x,z])=>x>-270&&x<-120&&z>690&&z<910));
  trees.forEach(({x,z,scale},tree)=>{
    const width=9.3*scale,depth=6.2*scale,offset=positions.length/3;
    for(let j=0;j<=6;j++)for(let i=0;i<=6;i++){
      const px=x+1.5+(i/6-.5)*width,pz=z+1.3+(j/6-.5)*depth;
      positions.push(px,world.terrain.at(px,pz)+.028,pz);uv.push(i/6,j/6);
      if(i<6&&j<6){const a=offset+j*7+i;indices.push(a,a+7,a+1,a+1,a+7,a+8);}
    }
    for(let i=0;i<count;i++){
      const angle=random()*Math.PI*2,radius=Math.sqrt(random())*4.7*scale;
      const px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius;
      dummy.position.set(px,world.terrain.at(px,pz)+.042,pz);
      dummy.rotation.y=random()*Math.PI*2;
      dummy.scale.setScalar(.044+random()*.05);dummy.updateMatrix();
      petals.setMatrixAt(tree*count+i,dummy.matrix);
      petals.setColorAt(tree*count+i,color.setHex(i%4?0xffe7e6:0xeeb9cb));
      const onPath=paths.some(path=>nearestOnPath([px,pz],[path]).dist<realPathAppearance(path).width/2+.23);
      const slope=Math.abs(world.terrain.at(px+.5,pz)-world.terrain.at(px-.5,pz));
      const density=Math.sin(px*.57+pz*.25)*.5+.5;
      const height=.38+random()*.53;
      dummy.scale.setScalar(onPath||slope>.48||density<.19?.0001:height);dummy.updateMatrix();
      grasses.setMatrixAt(tree*count+i,dummy.matrix);
      grasses.setColorAt(tree*count+i,color.setHex([0x879852,0x768546,0x9bab66][i%3]));
    }
  });
  const contact=new THREE.BufferGeometry();
  contact.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  contact.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));contact.setIndex(indices);
  root.add(new THREE.Mesh(contact,material),petals,grasses);
}
