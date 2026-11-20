import * as THREE from 'three';

// The mask is expressed in the same local metres as the HRDEM meshes.
const localSurface=`
  varying vec3 vHillWorld;
  float hashHill(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float hillNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hashHill(i),hashHill(i+vec2(1,0)),f.x),
               mix(hashHill(i+vec2(0,1)),hashHill(i+1.),f.x),f.y);
  }
  float hillMask(vec2 p){
    return smoothstep(-273.,-234.,p.x)*(1.-smoothstep(-169.,-142.,p.x))*
      smoothstep(700.,736.,p.y)*(1.-smoothstep(850.,890.,p.y));
  }
`;

export function hillSurface(base,kind){
  const material=new THREE.MeshStandardMaterial({side:base.side,map:base.map,
    vertexColors:base.vertexColors,color:base.color,roughness:kind==='water'?.62:.91});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vHillWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvHillWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=localSurface+shader.fragmentShader;
    const paint={
      ground:`
        float broad=hillNoise(p*.32)*.66+hillNoise(p*1.6)*.34;
        float soil=smoothstep(.61,.79,broad+hillNoise(p*4.)*.13);
        vec3 grass=mix(vec3(.20,.29,.096),vec3(.35,.43,.16),broad);
        vec3 earth=vec3(.31,.235,.15);
        vec3 tint=mix(grass,earth,soil)*mix(.84,1.19,hillNoise(p*13.));
        diffuseColor.rgb=mix(diffuseColor.rgb,tint,mask*.86);
      `,
      path:`
        vec3 paving=mix(vec3(.20,.195,.176),vec3(.34,.315,.265),hillNoise(p*.95));
        paving*=mix(.84,1.1,hillNoise(p*16.));
        diffuseColor.rgb=mix(diffuseColor.rgb,paving,mask);
      `,
      water:`
        float wave=sin(p.y*.73+sin(p.x*.19)*1.5)+sin(p.y*1.9+p.x*.31)*.28;
        float ripple=hillNoise(p*vec2(.19,.95));
        float reflection=pow(max(0.,wave*.44+.39),5.);
        float shore=smoothstep(-332.,-276.,p.x);
        vec3 water=mix(vec3(.105,.237,.258),vec3(.17,.31,.248),shore);
        water+=vec3(.055,.08,.10)*reflection*ripple;
        diffuseColor.rgb=mix(diffuseColor.rgb,water,
          smoothstep(-390.,-310.,p.x)*smoothstep(690.,795.,p.y)*(1.-smoothstep(920.,1030.,p.y)));
      `,
    }[kind];
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\nvec2 p=vHillWorld.xz;float mask=hillMask(p);\n'+paint);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+mask*(hillNoise(p*3.2)-.5)*.16,.45,1.);');
  };
  material.customProgramCacheKey=()=> 'cherry-hill-surface-'+kind;
  return material;
}

export function cherrySky(){
  const pixels=new Uint8Array(2*64*4);
  const horizon=new THREE.Color(0xf2e6d7),zenith=new THREE.Color(0x8ab9df);
  for(let y=0;y<64;y++){
    const sky=horizon.clone().lerp(zenith,Math.pow(Math.max(0,(y-29)/34),.56));
    sky.getRGB(sky,THREE.SRGBColorSpace);
    for(let x=0;x<2;x++)pixels.set([sky.r*255,sky.g*255,sky.b*255,255],(y*2+x)*4);
  }
  const texture=new THREE.DataTexture(pixels,2,64);
  texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return texture;
}
