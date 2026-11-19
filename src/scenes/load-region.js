// Data and code loaders are lazy; no scene instance is cached here.
export async function loadRegion(definition) {
  if(definition.loader==='toronto-demo') {
    const {makeTorontoWorld}=await import('./toronto.js');
    return makeTorontoWorld(definition);
  }
  if(definition.loader==='high-park') {
    const {loadWorld}=await import('../map-loader.js');
    const world=await loadWorld();
    // The existing demo has arbitrary local geometry. Anchor its entrance at
    // local zero while retaining every path, memory and building unchanged.
    return world.mode==='demo' ? {...world,origin:{...definition.demoOrigin}} : world;
  }
  throw new Error(`Unknown region loader: ${definition.loader}`);
}
