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

const parkPoint=(id,label,reference,eye,look,profile='desktop')=>({
  id,label,region:'high-park',entry:'toronto-gate',mode:'osm',heading:reference.heading,profile,
  osm:{...reference.osm,label,eye,look},
});

points.push(
  parkPoint('09-high-park-vegetacao-detalhe','High Park · detalhe da vegetação',points[3],
    [-8.5,1.45,-.05],[-10.7,.5,5]),
  parkPoint('10-high-park-trilha-detalhe','High Park · borda da trilha',points[3],
    [2.5,1.15,0],[-.6,.05,3.8]),
  parkPoint('11-high-park-nature-centre-detalhe','High Park · detalhe do Nature Centre',points[4],
    [1,2.9,-1.7],[14,2.2,-1]),
  parkPoint('12-high-park-trilha-mobile','High Park · trilha em viewport mobile',points[2],
    points[2].osm.eye,points[2].osm.look,'mobile'),
  parkPoint('13-high-park-nature-centre-mobile','High Park · Nature Centre em viewport mobile',points[4],
    [-10,4,-2],[12,2.3,0],'mobile'),
  parkPoint('22-high-park-nature-centre-mobile-375','High Park · Nature Centre em 375 × 667',points[4],
    [-10,4,-2],[12,2.3,0],'mobileCompact'),
);

const sakuraView=(id,label,local,eye,look,profile='desktop')=>{
  // Measured in the source snapshot's projected metres. Store the review pose
  // in WGS84 so it remains stable even if a later snapshot shifts the origin.
  const origin=[43.65235,-79.465];
  const geo=[origin[0]-local[1]/111320,origin[1]+local[0]/(111320*Math.cos(origin[0]*Math.PI/180))];
  return {id,label,region:'high-park',entry:'toronto-gate',mode:'osm',profile,
    osm:{geo,feature:174188399,eye,look,heading:2.55}};
};
points.push(
  sakuraView('33-high-park-west-road-sakura','West Road · aproximação pela calçada',[-61.5,32],
    [3.8,3.25,-6.5],[-13,2.8,14]),
  sakuraView('34-high-park-sakura-petalas','West Road · copa, ramos e pétalas',[-68.5,34],
    [5.6,2.05,-4.4],[-6.5,2.55,1.6]),
  sakuraView('35-high-park-sakura-mobile','West Road · floração em viewport mobile',[-67,31.5],
    [10.3,3.35,-6.4],[-5.3,2.85,4],'mobile'),
);

function terrainView(id,label,[x,z],feature,eye,look,profile='desktop'){
  const lat=43.65235,lon=-79.465;
  return {id,label,region:'high-park',entry:'toronto-gate',profile,expanded:true,
    osm:{geo:[lat-z/111320,lon+x/(111320*Math.cos(lat*Math.PI/180))],feature,eye,look,heading:Math.PI}};
}
points.push(
  terrainView('36-expanded-north-entry','Prévia geográfica · entrada norte',[-22,-105],174188399,[0,3.8,-8],[0,1.5,11]),
  terrainView('37-expanded-sports','Prévia geográfica · área esportiva',[-92,345],14344509,[19,31,-29],[-44,0,15]),
  terrainView('38-expanded-tennis','Prévia geográfica · área das quadras', [60,176],1116261446,[-8,15,-17],[9,0,16]),
  terrainView('39-expanded-west-road','Prévia geográfica · West Road',[-65.33,38.51],14344426,[2,5,-10],[-12,1.8,20]),
  terrainView('40-expanded-cherry-hill','Prévia geográfica · Cherry Hill',[-167.65,729.83],871510614,[9,6,-13],[-36,0,43]),
  terrainView('41-expanded-pond','Prévia geográfica · Grenadier Pond',[-173,1050],174225267,[1,6,-12],[-88,0,8]),
  terrainView('42-expanded-hillside','Prévia geográfica · Hillside Gardens e Maple Leaf',[-123,1017],251569209,[22,23,-18],[-24,0,9]),
  {...terrainView('43-expanded-overview','Prévia geográfica · parque ampliado ↑ N',[-22,-105],14344414,[0,0,0],[0,0,0]),projection:'orthographic'},
  terrainView('44-expanded-pond-mobile','Prévia geográfica · Grenadier Pond mobile',[-173,1050],174225267,[1,5,-9],[-52,0,10],'mobile'),
  terrainView('45-expanded-north-mobile','Prévia geográfica · entrada norte mobile',[-22,-105],174188399,[0,3.8,-8],[0,1.5,11],'mobile'),
);

const entranceView=(id,label,local,eye,look,profile='desktop')=>terrainView(id,label,local,23661349,eye,look,profile);
const gateFront=entranceView('47-north-entrance-after','Entrada norte · arco e pilares',[-15,-114],[-5,2.85,-24],[-1.7,3.0,-4.6]);
points.push(
  {...gateFront,id:'46-north-entrance-before',label:'Entrada norte · referência anterior',legacyEntrance:true},
  gateFront,
  entranceView('48-north-entrance-from-park','Entrada norte · vista de dentro do parque',[-15,-114],[0,2.85,17],[-2.0,3.2,-5.0]),
  entranceView('49-north-pbr-detail','Entrada norte · cantaria, concreto e junta',[-29,-110],[1.4,1.42,1.9],[5.6,1.52,-6.7]),
  entranceView('50-north-path-edge','Entrada norte · trilha e borda',[-20,-105],[-3.9,2.05,2],[-1.8,1.3,-8]),
  entranceView('51-north-entrance-mobile','Entrada norte · composição mobile',[-15,-114],[-5,2.95,-31],[-1.7,3.0,-4.6],'mobile'),
  entranceView('52-north-area-aerial','Entrada norte · visão aérea oblíqua',[-16,-115],[-5,37,-35],[-2,0,14]),
  {...entranceView('54-north-tree-before','Entrada norte · árvores anteriores',[-23,-100],[-8,2.7,-16],[-12,7,1]),legacyEntrance:true},
  entranceView('55-north-tree-after','Entrada norte · árvores novas',[-23,-100],[-8,2.7,-16],[-12,7,1]),
);
points.push({...points.find(point=>point.id==='51-north-entrance-mobile'),
  id:'53-north-entrance-mobile-before',label:'Entrada norte · mobile anterior',legacyEntrance:true});

const cherryView=(id,label,local,eye,look,profile='desktop')=>({
  ...terrainView(id,label,local,871510614,eye,look,profile),cherry:true,
});
const cherryArrival=cherryView('56-cherry-arrival','Hatchling Hill · chegada pela trilha',
  [-192,746],[14,3.6,-15],[-7,2,25]);
points.push(
  cherryArrival,
  cherryView('57-cherry-under-canopy','Hatchling Hill · sob as copas',[-201,773],[1,2.7,-7],[0,2.4,12]),
  cherryView('58-cherry-branches','Hatchling Hill · ramos e flores',[-202,809],[-1,3.1,-4],[-6,5,4]),
  cherryView('59-cherry-light','Hatchling Hill · luz entre as copas',[-200,796],[-9,4,1],[11,5,3]),
  cherryView('60-cherry-petals','Hatchling Hill · pétalas junto à trilha',[-201,763],[-2,1.2,-4],[0,.2,8]),
  cherryView('61-cherry-slope','Hatchling Hill · encosta voltada ao lago',[-198,770],[43,32,-29],[-59,0,49]),
  cherryView('62-cherry-mobile','Hatchling Hill · Balanced mobile',[-201,784],[0,2.9,-8],[-1,3,12],'mobile'),
  {...cherryArrival,id:'63-cherry-before',label:'Hatchling Hill · chegada antes do landmark',legacyCherry:true},
);

for(const [id,label,local,eye,look,profile] of [
  ['64','perspectiva pedestre',[-205,828],[-48,4,4],[-110,0,50]],
  ['65','panorama',[-205,828],[-38,16,4],[-150,-9,60]],
  ['66','margem naturalizada',[-205,828],[-69,2.4,21],[-82,-.15,5]],
  ['67','ondulação e reflexos',[-205,828],[-73,4.8,48],[-109,-.3,64]],
  ['68','transição da trilha à margem',[-205,828],[-5,4,-6],[-111,-8,36]],
  ['69','encosta',[-201,774],[30,22,-14],[-122,-9,75]],
  ['70','vista pelas cerejeiras',[-201,796],[16,3,-5],[-116,-8,57]],
  ['71','vista aérea',[-205,828],[-178,332,-160],[-190,-10,150]],
  ['72','Balanced mobile',[-205,828],[-58,7,14],[-130,-8,48],'mobile'],
]){
  points.push({...cherryView(id+'-grenadier-pond','Grenadier Pond · '+label,local,eye,look,profile),pond:true,...(id==='71'?{projection:'orthographic'}:{})});
}

const pondReference=points.find(point=>point.id==='71-grenadier-pond');
pondReference.osmFile='grenadier-pond-geographic-reference';
points.push({...pondReference,id:'73-grenadier-pond-aerial-3d',osmFile:'grenadier-pond-aerial-3d',
  label:'Grenadier Pond · vista 3D oblíqua',pondOblique:true});

for(const [n,label,eye,look,profile] of [
  [74,'referência geográfica',[0,55,0],[-9,0,-4]],
  [75,'vista 3D oblíqua',[17,28,-15],[-9,0,-4]],
  [76,'chegada pela trilha',[4,2.5,2],[-9,.9,-4]],
  [77,'folha vista da encosta',[24,14,-3],[-9,0,-4]],
  [78,'canteiro e folhagem',[-5,2.2,1],[-10,.4,-4]],
  [79,'caminhos junto ao canteiro',[5,5,9],[-7,0,0]],
  [80,'encosta em direção ao lago',[31,15,2],[-84,-2,-12]],
  [81,'Balanced mobile',[9,7,-3],[-10,0,-5],'mobile'],
]){
  points.push({...terrainView(n+'-maple-garden','Maple Leaf Garden · '+label,[-127.43,1025.98],125699405,eye,look,profile),
    maple:true,...(n===74?{projection:'orthographic',mapleTop:true}:{})});
}

const mapleSpringViews=[
  [82,'vista da encosta a leste',[-44,1008],[0,1.65,0],[-95,.1,14],125699405],
  [83,'tulipas no início da floração',[-145,1011],[0,1.15,4],[7,.24,8],125699385],
  [84,'círculo à altura do jogador',[-127.43,1025.98],[0,1.65,0],[-11,.3,-4],125699405],
  [85,'piso claro, gramado e cerca viva',[-127.43,1025.98],[18,47,-12],[-13,0,-5],125699405],
  [86,'Balanced com setor ativo',[-127.43,1025.98],[3,3,0],[-11,.3,-4],125699405,'mobile'],
];
for(const [n,label,local,eye,look,way,profile] of mapleSpringViews)
  points.push({...terrainView(n+'-maple-spring','Maple Leaf Garden · '+label,local,way,eye,look,profile),maple:true});

for(const [id,label,local,way,eye,look,profile] of [
  ['87-tennis-player','Tênis · rede na altura do jogador',[61,188],1116261446,[-3,2.1,-2],[13,1,2]],
  ['88-tennis-mobile','Tênis · quadras em Balanced',[61,188],1116261446,[-3,2.1,-2],[13,1,2],'mobile'],
  ['89-trackless-train','Trackless Train · parada junto ao café',[-87,799],1389554894,[-4,2.1,4],[2,1,-6]],
  ['90-grenadier-cafe','Grenadier Café · fachada de West Road',[-82,784],125699284,[-3,2.15,3],[0,2,-18]],
  ['91-grenadier-cafe-aerial','Grenadier Café · aérea 3D',[-82,784],125699284,[49,47,22],[-4,0,-18]],
  ['92-grenadier-cafe-mobile','Grenadier Café · vista mobile',[-82,784],125699284,[-3,2.15,3],[0,2,-18],'mobile'],
]){
  points.push(terrainView(id,label,local,way,eye,look,profile));
}

for(const [id,label,local,way,eye,look] of [
  ['93-north-connected','Corredor norte · acesso esportivo',[28.69,184.12],806985059,[-4,2.6,-5],[12,1,8]],
  ['94-west-connected','Cherry Hill · corredor em direção ao café',[-201.27,774.02],871510614,[2,2.7,-6],[0,1.4,13]],
  ['95-hillside-connected','Hillside Gardens · acesso à margem',[-198.74,928.59],871510614,[4,2.8,-5],[-12,1,5]],
]){
  const view=terrainView(id,label,local,way,eye,look);
  points.push({...view,cherry:id==='94-west-connected',pond:id==='95-hillside-connected'});
}

const groundingViews=[
  ['96-grounding-hud','Implantação · posição indicada no HUD',[122,85],[-4,2.8,-5],[-12,0,41]],
  ['97-grounding-side','Implantação · fachada lateral',[122,85],[25,2.8,34],[-14,0,38]],
  ['98-grounding-aerial','Implantação · vista elevada',[122,85],[36,50,3],[-10,0,41]],
];
for(const [id,label,local,eye,look] of groundingViews){
  const point=terrainView(id,label,local,43805272,eye,look);
  points.push(point,{...point,id:id.replace(/^9[678]/,String(Number(id.slice(0,2))-70))+'-before',label:label+' · antes',legacyGrounding:true});
}
points.push(
  {...terrainView('99-grounding-debug','Implantação · laranja: piso; azul: terreno',[122,85],43805272,[25,4,28],[-14,0,38]),groundingDebug:true},
  terrainView('29-grounding-mobile','Implantação · revisão mobile',[122,85],43805272,[-3,2.8,-6],[-10,1,40],'mobile'),
);

for(const [id,label,local,way,eye,look,profile] of [
  ['96-v2-hud','HUD',[122,85],43805272,[-4,2.8,-5],[-12,0,41]],
  ['97-v2-flat','Terreno quase plano',[-56,263],287897795,[0,2,-4],[-3.5,1,13.4]],
  ['98-v2-moderate','Embasamento moderado',[122,85],43805272,[26,2.8,43],[-4,1,41]],
  ['99-v2-steep','Casa em encosta',[-461,695],663017725,[3,3,4],[-13,3,-14]],
  ['99-v2-maximum','Maior desnível',[-444,45],70364374,[5,5,6],[0,5,-27]],
  ['90-v2-access','Grenadier Café',[-82,784],125699284,[-3,2.15,3],[0,2,-18]],
  ['92-v2-balanced','Embasamento em Balanced',[122,85],43805272,[26,2.8,43],[-4,1,41],'mobile'],
]){
  const view=terrainView(id,'Implantação V2 · '+label,local,way,eye,look,profile);
  points.push(view,{...view,id:id+'-baseline',label:'Implantação V1 · '+label,foundationV1:true});
}

points.push(
  terrainView('93-milestone-sports-balanced','Percurso norte · chegada às quadras em Balanced',[28.69,184.12],806985059,[-4,2.6,-5],[12,1,8],'mobile'),
  terrainView('94-milestone-west-road','West Road · entrada no corredor',[-164,530],174188399,[4,2.8,-5],[-2,1.3,14]),
  terrainView('90-milestone-cafe-access','Grenadier Café · aproximação à soleira exterior',[-74.5,779],125699284,[2,1.8,3],[.55,1,-3.15]),
);
