// OSM sidewalk at the north entrance, just south of Bloor Street West.
// Toronto and High Park DEMO use it only as an illustrative scene anchor.
export const HIGH_PARK_GATE = {lat:43.6533238, lon:-79.4652439};
export const regionManifest = {
  toronto: {
    id:'toronto', name:'Toronto', loader:'toronto-demo',
    origin:{...HIGH_PARK_GATE},
    entries:{
      start:{geo:{lat:HIGH_PARK_GATE.lat - 8 / 111320, lon:HIGH_PARK_GATE.lon}, yaw:0},
      'high-park-gate':{geo:{...HIGH_PARK_GATE}, yaw:Math.PI},
    },
    portals:[{id:'toronto:high-park-gate', geo:{...HIGH_PARK_GATE}, radius:5.3,
      label:'Entrar no High Park', target:{region:'high-park', entry:'toronto-gate'}}],
  },
  'high-park': {
    id:'high-park', name:'High Park', loader:'high-park',
    demoOrigin:{...HIGH_PARK_GATE},
    entries:{'toronto-gate':{geo:{...HIGH_PARK_GATE}, yaw:Math.PI}},
    portals:[{id:'high-park:toronto-gate', geo:{...HIGH_PARK_GATE}, radius:5.3,
      label:'Voltar a Toronto', target:{region:'toronto', entry:'high-park-gate'}}],
  },
};
