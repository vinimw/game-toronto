import * as THREE from 'three';
import {nearSegment,pointInPolygon,seeded} from './geo.js';
import {realPathAppearance} from './visual-settings.js';

export const pondId=174225267;
export const pondDetailId='high-park:grenadier-pond';
export const pondBounds=[-376,752,-222,994];

export function pondWater(base){
  const time={value:0},detail={value:1};
  const material=new THREE.MeshStandardMaterial({color:base.color,side:base.side,roughness:.36});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{pondTime:time,pondDetail:detail});
    shader.vertexShader='varying vec3 vPond;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvPond=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=`uniform float pondTime, pondDetail; varying vec3 vPond;
      float pondHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float pondNoise(vec2 p){
        vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(pondHash(i),pondHash(i+vec2(1,0)),f.x),
          mix(pondHash(i+vec2(0,1)),pondHash(i+1.),f.x),f.y)-.5;
      }\n`+shader.fragmentShader
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec2 p=vPond.xz;
        vec2 drift=vec2(pondTime*.09,pondTime*.054);
        float attenuation=1.-smoothstep(.12,1.2,length(fwidth(p)));
        float a=pondNoise(p*.84+drift);
        float b=pondNoise(p.yx*.67-drift+vec2(23.,8.));
        float small=pondDetail>.5?pondNoise(p*1.94-drift*.7):0.;
        vec3 ripple=mat3(viewMatrix)*vec3(a*.036+small*.012,0.,b*.035)*attenuation;
        normal=normalize(normal+ripple);
      `)
      .replace('#include <opaque_fragment>',`
        vec3 viewDir=normalize(vViewPosition);
        float fresnel=pow(1.-abs(dot(normal,viewDir)),3.);
        float bank=pondNoise(vPond.xz*.037)+.5;
        vec3 reflected=mix(vec3(.15,.24,.17),vec3(.51,.67,.79),smoothstep(.05,.85,fresnel+bank*.26));
        outgoingLight=mix(vec3(.082,.17,.135)*(1.+(a+b)*.025*attenuation),reflected,.19+.58*fresnel);
        #include <opaque_fragment>
      `);
  };
  return {material,update(clock){time.value=clock;},setQuality(profile){detail.value=profile==='high'?1:.32;}};
}

export function buildPondShore(world,pond,quality){
  const root=new THREE.Group(),random=seeded(174225267);
  root.name=pondDetailId;
  const paths=world.features.filter(feature=>feature.kind==='path'||feature.kind==='rail');
  const [west,north,east,south]=pondBounds;
  const segments=paths.flatMap(feature=>feature.points.slice(1).flatMap((b,i)=>{
    const a=feature.points[i];
    return Math.max(a[0],b[0])<west-12||Math.min(a[0],b[0])>east+12||
      Math.max(a[1],b[1])<north-12||Math.min(a[1],b[1])>south+12?[]:[[a,b,realPathAppearance(feature).width/2]];
  }));
  const waterLevel=world.terrain.waterLevel(pond.points);
  const items=[[],[],[]];
  const patches=[],patchColors=[],patchColor=new THREE.Color();
  const clear=point=>!pointInPolygon(point,pond.points)&&
    !segments.some(([start,end,width])=>nearSegment(point,start,end)<width+1.6);
  const terrain=world.terrain;
  function patch([x,z],radius,tint){
    const center=[x,terrain.at(x,z)+.045,z];
    const rim=new THREE.Color(0x859253);
    for(let i=0;i<7;i++){
      const edge=angle=>{
        const outline=radius*(1+.19*Math.sin(angle*3+x+z));
        return [x+Math.cos(angle)*outline,z+Math.sin(angle)*outline*.7];
      };
      const a=edge(i/7*Math.PI*2),b=edge((i+1)/7*Math.PI*2);
      if(!clear(a)||!clear(b))continue;
      patches.push(...center,a[0],terrain.at(...a)+.042,a[1],b[0],terrain.at(...b)+.042,b[1]);
      patchColor.setHex(tint).multiplyScalar(.88+random()*.18);
      patchColors.push(...patchColor.toArray(),...rim.toArray(),...rim.toArray());
    }
  }
  for(const [i,b] of pond.points.entries()){
    const a=pond.points[(i+pond.points.length-1)%pond.points.length];
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length<.1)continue;
    for(let t=0;t<1;t+=(quality==='high'?1.3:2.1)/length){
      const x=THREE.MathUtils.lerp(a[0],b[0],t),z=THREE.MathUtils.lerp(a[1],b[1],t);
      if(x<west||x>east||z<north||z>south||Math.sin(z*.113)+Math.sin(z*.041)<-.25)continue;
      const side=.65+random()**1.65*10,dx=(b[1]-a[1])/length*side,dz=(a[0]-b[0])/length*side;
      const point=[x+dx,z+dz];
      if(pointInPolygon(point,pond.points)){point[0]=x-dx;point[1]=z-dz;}
      if(!clear(point))continue;
      const y=world.terrain.at(...point);
      if(y<waterLevel-.1||y>waterLevel+9)continue;
      const scale=.55+random()*.8;
      const kind=random()<.23?1:side>4&&random()<.23?2:0;
      items[kind].push([point[0],y,point[1],scale,random()*Math.PI*2]);
      if(side<5)patch(point,.85+random()*1.55,side<2?0x665545:0x74734b);
      if(kind===0&&side<6){
        const cluster=[point[0]+(random()-.5)*1.6,point[1]+(random()-.5)*1.6];
        if(clear(cluster))items[0].push([cluster[0],terrain.at(...cluster),cluster[1],scale*.8,random()*Math.PI*2]);
      }
      if(kind===2)patch(point,1.1*scale,0x5f653d);
    }
  }
  const blades=[];
  for(let i=0;i<7;i++){
    const angle=i*2.399,x=Math.cos(angle),z=Math.sin(angle);
    blades.push(x*.08-z*.035,0,z*.08+x*.035,x*.08+z*.035,0,z*.08-x*.035,x*.31,.48+i*.057,z*.31);
  }
  const reeds=new THREE.BufferGeometry();
  reeds.setAttribute('position',new THREE.Float32BufferAttribute(blades,3));
  reeds.computeVertexNormals();
  const dummy=new THREE.Object3D(),color=new THREE.Color(),coverage={value:0};
  function shoreMaterial(vertexColors=false){
    const material=new THREE.MeshStandardMaterial({roughness:.94,side:THREE.DoubleSide,vertexColors,polygonOffset:vertexColors,polygonOffsetFactor:-2});
    material.onBeforeCompile=shader=>{
      shader.uniforms.shoreCoverage=coverage;
      shader.fragmentShader='uniform float shoreCoverage;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>',
        '#include <alphatest_fragment>\nif(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))>=shoreCoverage)discard;');
    };
    return material;
  }
  const soil=new THREE.BufferGeometry();
  soil.setAttribute('position',new THREE.Float32BufferAttribute(patches,3));
  soil.setAttribute('color',new THREE.Float32BufferAttribute(patchColors,3));
  soil.computeVertexNormals();
  root.add(new THREE.Mesh(soil,shoreMaterial(true)));
  const shrub=new THREE.IcosahedronGeometry(1,1);
  const positions=shrub.getAttribute('position');
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const taper=1+.18*Math.sin(x*7+z*9+y*4);
    positions.setXYZ(i,x*taper,(y+.7)*taper,z*taper);
  }
  shrub.computeVertexNormals();
  for(const [i,geometry] of [reeds,new THREE.IcosahedronGeometry(1,0),shrub].entries()){
    const batch=new THREE.InstancedMesh(geometry,shoreMaterial(),items[i].length);
    items[i].forEach(([x,y,z,scale,yaw],index)=>{
      dummy.position.set(x,y,z);
      dummy.scale.set(i===1?scale*.37:scale,i===1?scale*.18:i===2?scale*.72:scale,i===1?scale*.28:scale);
      dummy.rotation.y=yaw;dummy.updateMatrix();
      batch.setMatrixAt(index,dummy.matrix);
      batch.setColorAt(index,color.setHex(i===1?0x81786a:i===2?0x607647:[0x677747,0x858b51,0x777144][index%3]));
    });
    root.add(batch);
  }
  return {root,coverage,count:items.reduce((total,batch)=>total+batch.length,0),quality};
}
