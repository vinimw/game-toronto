export function makeTorontoWorld(definition) {
  return {
    mode:'demo', vegetation:false, origin:{...definition.origin}, bbox:[-45,-35,45,45], memory:null,
    label:'Toronto · área demonstrativa de transição, sem fidelidade geográfica',
    features:[
      {kind:'path',tags:{highway:'pedestrian'},points:[[-40,8],[0,8],[40,8]]},
      {kind:'path',tags:{highway:'footway'},points:[[0,35],[0,8],[0,0],[0,-24]]},
      {kind:'green',tags:{leisure:'garden'},points:[[-40,-30],[40,-30],[40,-4],[-40,-4],[-40,-30]]},
      {kind:'building',tags:{'building:levels':'2'},points:[[-33,17],[-20,17],[-20,30],[-33,30],[-33,17]]},
      {kind:'building',tags:{'building:levels':'3'},points:[[21,17],[34,17],[34,30],[21,30],[21,17]]},
    ],
  };
}
