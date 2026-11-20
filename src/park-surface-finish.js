// Shared world-metre material variation. No textures or extra render passes.
export function parkSurfaceFinish(material,kind){
  material.customProgramCacheKey=()=>`park-surface-${kind}`;
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
      ${kind==='ground'?'diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.16,.86,.72),smoothstep(.66,.91,broad)*.53);':''}
    `);
  };
  return material;
}
