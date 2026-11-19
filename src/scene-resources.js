// Resources outside the scene lifetime must be registered as shared explicitly.
export function collectResources(root) {
  const resources=new Set();
  const seen=new Set();
  const texture=value=>{
    if(value?.isTexture)resources.add(value);
    else if(value && typeof value==='object' && !seen.has(value) && (Array.isArray(value)||Object.getPrototypeOf(value)===Object.prototype)){
      seen.add(value);Object.values(value).forEach(texture);
    }
  };
  texture(root.background);texture(root.environment);
  root.traverse(object=>{
    if(object.geometry)resources.add(object.geometry);
    if(object.isInstancedMesh)resources.add(object); // Releases instance GPU buffers.
    const materials=Array.isArray(object.material)?object.material:[object.material];
    for(const material of materials)if(material) {
      resources.add(material);
      Object.values(material).forEach(texture);
      for(const uniform of Object.values(material.uniforms||{}))texture(uniform.value);
    }
  });
  return resources;
}

export function disposeScene(scene, sharedResources=new Set()) {
  for(const resource of collectResources(scene))if(!sharedResources.has(resource))resource.dispose();
  scene.clear();scene.background=null;scene.environment=null;scene.fog=null;
}
