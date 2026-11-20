// This is NOT a real map. Geographic geometry becomes real after `npm run map:import`.
// We deliberately keep the demonstration scenery distinct from OSM data.
const pts = (...v) => v.map(([x, z]) => [x, z]);
const path = (name, highway, points) => ({kind:'path', name, tags:{highway}, points:pts(...points)});
const building = (name, points, levels=2) => ({kind:'building', name, tags:{'building:levels': String(levels)}, points:pts(...points)});
export function makeDemoWorld() {
  const features = [
    {kind:'green',name:'Bosque demonstrativo',tags:{leisure:'park'},points:pts([-180,-180],[170,-180],[170,155],[-180,155],[-180,-180])},
    {kind:'water',name:'Lago ilustrativo',tags:{natural:'water'},points:pts([-145,-15],[-131,-46],[-117,-72],[-90,-94],[-61,-100],[-36,-83],[-20,-57],[-20,-31],[-36,-8],[-60,4],[-93,15],[-127,7],[-145,-15])},
    path('Bloor Street West (ilustrativa)','primary',[[-220,-170],[-130,-164],[-40,-166],[65,-166],[215,-164]]),
    path('Parkside Drive (ilustrativa)','secondary',[[175,-190],[170,-100],[170,0],[174,110],[177,200]]),
    path('High Park Boulevard (ilustrativa)','residential',[[-215,165],[-100,164],[10,159],[135,159],[210,158]]),
    path('Trilha do lago (ilustrativa)','footway',[[20,-25],[-10,-5],[-27,18],[-51,28],[-90,39],[-127,33],[-156,5],[-167,-38],[-145,-94],[-103,-118],[-56,-112],[-20,-97],[18,-69],[25,-27]]),
    path('Colborne Lodge Drive (ilustrativa)','residential',[[34,-170],[30,-111],[21,-60],[16,-15],[13,48],[-2,104],[-12,176]]),
    path('Caminho das flores (ilustrativa)','footway',[[15,30],[46,37],[79,53],[112,78],[145,88]]),
    path('Trilha das árvores (ilustrativa)','path',[[13,47],[-22,56],[-65,70],[-105,101],[-130,153]]),
    path('Caminho do jardim (ilustrativa)','footway',[[-115,-150],[-94,-127],[-63,-113],[-30,-101],[0,-122],[35,-140]]),
    path('Entrada do parque (ilustrativa)','footway',[[34,-170],[35,-132],[17,-95],[12,-42],[0,0]]),
    building('Casa ilustrativa 01',pts([80,-195],[110,-195],[110,-171],[80,-171],[80,-195]),3),
    building('Casa ilustrativa 02',pts([117,-195],[146,-195],[146,-172],[117,-172],[117,-195]),2),
    {...building('Café demonstrativo',pts([63,104],[87,104],[87,125],[63,125],[63,104]),1),visual:'park-cafe'},
    building('Casa ilustrativa 03',pts([-197,180],[-169,180],[-169,202],[-197,202],[-197,180]),2),
    building('Casa ilustrativa 04',pts([-161,180],[-131,180],[-131,201],[-161,201],[-161,180]),3),
    building('Casa ilustrativa 05',pts([-121,180],[-95,180],[-95,201],[-121,201],[-121,180]),2),
    building('Casa ilustrativa 06',pts([108,178],[138,178],[138,199],[108,199],[108,178]),2),
    building('Casa ilustrativa 07',pts([145,178],[172,178],[172,202],[145,202],[145,178]),3),
  ];
  return {mode:'demo', origin:{lat:43.6482,lon:-79.4674}, bbox:[-220,-200,220,215], features, spawn:[0,0], memory:[42,40], label:'Cenário ilustrativo: proporções e traçados NÃO correspondem ao mapa real'};
}
