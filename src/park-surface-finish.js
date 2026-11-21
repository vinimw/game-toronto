// Shared world-metre material variation. No textures or extra render passes.
export function parkSurfaceFinish(material,kind,expanded=false){
  material.customProgramCacheKey=()=>`park-surface-${kind}-${expanded}`;
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 parkSurfacePosition;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\nparkSurfacePosition=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=`
      varying vec3 parkSurfacePosition;
      float parkNoise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453);
        float b=fract(sin(dot(i+vec2(1.,0.),vec2(127.1,311.7)))*43758.5453);
        float c=fract(sin(dot(i+vec2(0.,1.),vec2(127.1,311.7)))*43758.5453);
        float d=fract(sin(dot(i+1.,vec2(127.1,311.7)))*43758.5453);
        return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
      }
    `+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 p=parkSurfacePosition.xz;
      float broad=parkNoise(p*.057)*.7+parkNoise(p*.42)*.3;
      float grain=(parkNoise(p*5.3)-.5)*(1.-smoothstep(.05,.28,length(fwidth(p))));
      diffuseColor.rgb*=.91+broad*.17+grain*.12;
      ${expanded?`
      float north=1.-smoothstep(95.,160.,abs(p.x+30.));
      north*=smoothstep(-140.,-115.,p.y)*(1.-smoothstep(250.,345.,p.y));
      float west=(1.-smoothstep(40.,112.,abs(p.x+145.)))
        *smoothstep(465.,545.,p.y)*(1.-smoothstep(785.,840.,p.y));
      float corridor=max(north,west);
      float mottling=parkNoise(p*.16)*.62+parkNoise(p*.78)*.38;
      ${kind==='ground'?`
        vec3 spring=mix(vec3(.73,.86,.66),vec3(1.09,1.12,.88),smoothstep(.22,.79,mottling));
        diffuseColor.rgb*=mix(vec3(1.),spring+grain*.26,corridor*.92);
      `:`
        float wear=parkNoise(p*1.9)-.5;
        vec3 aggregate=mix(vec3(.74,.77,.69),vec3(1.13,1.11,1.04),mottling);
        diffuseColor.rgb*=mix(vec3(1.),aggregate+(wear*.14+grain*.34),corridor);
      `}
      `:''}
      ${kind==='ground'?'diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.16,.86,.72),smoothstep(.66,.91,broad)*.53);':''}
    `);
  };
  return material;
}
