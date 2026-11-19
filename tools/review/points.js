// All positions are in scene-local metres (X east, Z south). The curated demo
// viewpoints are specific to that geometry and are never reused in OSM mode.
export const points=[
  {id:'01-toronto-inicial',region:'toronto',entry:'start',label:'Toronto · visão inicial',
    location:'spawn',eye:[0,3.075,6.816],look:[0,1.48,0],heading:0},
  {id:'02-entrada-externa',region:'toronto',entry:'start',label:'Entrada externa do High Park',
    location:'portal',portal:'toronto:high-park-gate',offset:[1,5.8],eye:[3,2.9,6],look:[-.6,1.65,-3.7],heading:.17},
  {id:'03-high-park-trilha',region:'high-park',entry:'toronto-gate',label:'High Park · caminho principal',
    mode:'demo',osm:{geo:[43.6528460,-79.4653253],feature:174188399,eye:[0,3.075,-6.816],look:[0,1.48,3],heading:Math.PI},position:[26,32.5],eye:[-6.2,3.55,-2.1],look:[2,1.48,.5],heading:-1.85},
  {id:'04-high-park-vegetacao',region:'high-park',entry:'toronto-gate',label:'High Park · vegetação e iluminação',
    mode:'demo',osm:{geo:[43.6520004,-79.4658145],eye:[4.5,3.8,-5.3],look:[-4,1.4,4],heading:2.6},position:[76,51.55],eye:[-6,4.4,-2.5],look:[5,1.25,3],heading:-2.1},
  {id:'05-high-park-cafe',osmFile:'05-high-park-nature-centre',region:'high-park',entry:'toronto-gate',label:'High Park · Café do Parque',
    mode:'demo',osm:{label:'High Park · Nature Centre',geo:[43.65121535,-79.46405093],feature:43805272,eye:[-7,3.8,-1.8],look:[12,2.4,1],heading:-Math.PI/2},visual:'park-cafe',position:[56,113],eye:[-7.3,4.4,-3.2],look:[6,2.15,1.5],heading:-Math.PI/2},
  {id:'06-high-park-ortografica',region:'high-park',entry:'toronto-gate',label:'High Park · ortográfica norte para cima',
    location:'spawn',projection:'orthographic',heading:0},
];
