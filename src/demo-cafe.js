import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const palette={
  plaster:0xe5cba0, trim:0x704b3a, roof:0x8e5142, teal:0x55786f, glass:0x405e60,
  cream:0xf3deab, terrace:0xbb997b, pottery:0xaf664d, leaf:0x6d874d,
};

function addSign(group){
  if(typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#3f6357';ctx.fillRect(0,0,512,128);
  ctx.strokeStyle='#e2bf8b';ctx.lineWidth=3;ctx.strokeRect(9,9,494,110);
  ctx.fillStyle='#fff2d4';ctx.font='bold 49px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('CAFÉ DO PARQUE',256,66);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(5.7,1.02),new THREE.MeshBasicMaterial({map}));
  mesh.rotation.y=-Math.PI/2;mesh.position.set(-.46,3.56,0);
  group.add(mesh);
}

export function buildDemoCafe(feature){
  const [west,north]=feature.points[0], [east,south]=feature.points[2];
  const length=east-west, width=south-north, group=new THREE.Group();
  const center=(north+south)/2;
  group.name='demo:park-cafe';group.position.set(west,0,center);
  const parts=[], obstacles=[];
  const wallHeight=3.3, ridge=5.25;
  function add(geometry,x,y,z,tint){
    if(geometry.index){const source=geometry;geometry=source.toNonIndexed();source.dispose();}
    geometry.translate(x,y,z);
    const colors=[],color=new THREE.Color(tint);
    for(let i=0;i<geometry.getAttribute('position').count;i++)colors.push(color.r,color.g,color.b);
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    parts.push(geometry);
  }
  const box=(x,y,z,w,h,d,tint)=>add(new THREE.BoxGeometry(w,h,d),x,y,z,tint);
  const cylinder=(x,y,z,top,bottom,height,tint)=>add(new THREE.CylinderGeometry(top,bottom,height,8),x,y,z,tint);
  box(length/2,wallHeight/2,0,length,wallHeight,width,palette.plaster);
  box(length/2,.19,0,length+.12,.38,width+.12,palette.trim);
  const gable=new THREE.Shape();
  gable.moveTo(-width/2-.32,0);gable.lineTo(0,ridge-wallHeight);gable.lineTo(width/2+.32,0);gable.closePath();
  const roof=new THREE.ExtrudeGeometry(gable,{depth:length+.64,bevelEnabled:false});
  roof.rotateY(Math.PI/2);add(roof,-.32,wallHeight,0,palette.roof);
  box(length/2,wallHeight,0,length+.7,.19,width+.72,palette.trim);

  box(-.09,1.22,0,.18,2.44,1.72,palette.trim);
  box(-.20,1.17,0,.06,2.28,1.46,palette.teal);
  box(-.24,1.6,0,.035,1.1,.97,palette.glass);
  box(-.274,1.03,.49,.055,.07,.18,palette.cream);
  for(const z of [-7.4,-4.2,4.2,7.4]){
    box(-.10,1.74,z,.17,1.85,2.34,palette.trim);
    box(-.20,1.74,z,.05,1.57,2.05,palette.glass);
    box(-.24,1.74,z,.04,1.59,.09,palette.cream);
    box(-.24,1.74,z,.04,.085,2.07,palette.cream);
    box(-.33,.79,z,.38,.13,2.53,palette.trim);
    for(let i=0;i<8;i++)box(-.59,2.79,z-1.12+i*.32,1.19,.13,.322,i%2===0?palette.teal:palette.cream);
  }
  box(-2.15,.045,0,4.28,.09,20,palette.terrace);
  box(-.37,.13,0,.75,.18,2,palette.cream);
  for(const z of [-6.2,6.2]){
    cylinder(-2.9,.66,z,.65,.65,.11,palette.trim);
    cylinder(-2.9,.32,z,.075,.18,.59,palette.teal);
    for(const offset of [-1.12,1.12]){
      const chairZ=z+offset;
      box(-2.9,.38,chairZ,.54,.1,.51,palette.teal);
      box(-2.9,.67,chairZ+Math.sign(offset)*.19,.51,.56,.08,palette.teal);
      for(const x of [-3.07,-2.73])box(x,.18,chairZ,.06,.36,.35,palette.trim);
    }
    cylinder(-.61,.38,z*.37,.31,.23,.65,palette.pottery);
    add(new THREE.IcosahedronGeometry(.43,0),-.61,.83,z*.37,palette.leaf);
    obstacles.push({x:west-2.9,z:center+z,halfX:.68,halfZ:1.42,height:1.02},
      {x:west-.61,z:center+z*.37,halfX:.37,halfZ:.37,height:1.24});
  }
  const geometry=mergeGeometries(parts);
  for(const part of parts)part.dispose();
  group.add(new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true})));
  addSign(group);
  return {group,ridge,obstacles:obstacles.map(({x,z,halfX,halfZ,height})=>({
    kind:'building',height,points:[[x-halfX,z-halfZ],[x+halfX,z-halfZ],[x+halfX,z+halfZ],[x-halfX,z+halfZ]],
  }))};
}
