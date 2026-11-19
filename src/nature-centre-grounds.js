import * as THREE from 'three';
import {nearSegment,seeded} from './geo.js';
import {pathWidth,realPathAppearance} from './visual-settings.js';

export function buildNatureCentreGrounds(at,length,{canWalk,paths}){
  const group=new THREE.Group();
  group.name='nature-centre-grounds';
  const rand=seeded(43805272);
  const segments=paths.flatMap(feature=>{
    const margin=Math.max(pathWidth(feature),realPathAppearance(feature).width)/2;
    return feature.points.slice(1).map((b,i)=>({a:feature.points[i],b,margin}));
  });
  const free=([x,,z],radius)=>canWalk(x,z,radius)&&
    segments.every(({a,b,margin})=>nearSegment([x,z],a,b)>margin+radius+.25);

  // The apron is a color layer below the road meshes. It follows the facade
  // and stops before the reserved path margins.
  const positions=[],colors=[];
  const apronVertex=(point,alpha)=>{
    positions.push(...point);colors.push(1,1,1,alpha);
  };
  for(let i=0;i<12;i++){
    const a=i/12,b=(i+1)/12;
    const depth=u=>1.5+.45*Math.cos((u-.58)*Math.PI*2)+.18*Math.sin(u*17);
    const innerA=at(a,.004,.10),innerB=at(b,.004,.10);
    const outerA=at(a,.004,depth(a)),outerB=at(b,.004,depth(b));
    if(![innerA,innerB,outerA,outerB].every(p=>free(p,.03)))continue;
    apronVertex(innerA,.49);apronVertex(outerA,0);apronVertex(innerB,.49);
    apronVertex(outerA,0);apronVertex(outerB,0);apronVertex(innerB,.49);
  }
  if(positions.length){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
    const apron=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xb6a382,vertexColors:true,
      transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true}));
    apron.name='nature-centre-apron';
    group.add(apron);
  }

  const foliage=[],stones=[];
  for(const edge of [-1,1]){
    for(let i=0;i<20;i++){
      const u=(edge<0?.20:.80)+edge*rand()*3.2/length;
      const depth=.5+rand()*3.7;
      if(depth<1.6&&u>.03&&u<.97)continue;
      const point=at(u,0,depth);
      const size=.12+rand()*.25;
      if(!free(point,size+.12))continue;
      const details={point,size,turn:rand()*Math.PI*2};
      if(i%5===0)stones.push(details);
      else foliage.push(details);
    }
  }
  function scatter(items,color,name,isPlant){
    if(!items.length)return null;
    const mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),
      new THREE.MeshLambertMaterial({color,flatShading:true}),items.length);
    mesh.name=name;
    const dummy=new THREE.Object3D(),tint=new THREE.Color();
    items.forEach(({point,size,turn},i)=>{
      dummy.position.set(point[0],size*(isPlant?.43:.17),point[2]);
      dummy.scale.set(size,size*(isPlant?.60:.36),size*.76);
      dummy.rotation.y=turn;dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);
      mesh.setColorAt(i,tint.setScalar(.78+rand()*.24));
    });
    group.add(mesh);
    return mesh;
  }
  scatter(foliage,0x718855,'nature-centre-perennials',true);
  const gravel=scatter(stones,0xa6947b,'nature-centre-stones',false);
  return {group,gravel};
}
