import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';

const tolerance=.03;
const closed=way=>way.nodes.length>=4&&way.nodes[0]===way.nodes.at(-1);
const area=kind=>['green','water','building'].includes(kind);

function classify(way){
  const tags=way.tags??{};
  if(tags.tunnel==='yes'||tags.tunnel==='building_passage'||tags.highway==='proposed')return null;
  if(tags.building&&tags.building!=='no')return {kind:'building',closed:closed(way)};
  if(tags.natural==='water'||tags.waterway==='riverbank')return {kind:'water',closed:closed(way)};
  if(['forest','grass','meadow','recreation_ground'].includes(tags.landuse)||
     ['park','garden','nature_reserve'].includes(tags.leisure)||tags.natural==='wood')
    return {kind:'green',closed:closed(way)};
  if(tags.highway)return {kind:'path'};
  if(['tram','subway','rail'].includes(tags.railway))return {kind:'rail'};
  return null;
}

function inBounds([x,z],[w,n,e,s],margin=0){
  return x>=w-margin&&x<=e+margin&&z>=n-margin&&z<=s+margin;
}

function withinBox(a,b,bounds){
  // Split at boundary crossings, then retain intervals whose midpoint lies in
  // the rectangle. This does not reuse the importer's clipping implementation.
  const delta=[b[0]-a[0],b[1]-a[1]];
  const at=t=>[a[0]+delta[0]*t,a[1]+delta[1]*t];
  const parameters=[0,1];
  for(const [axis,edge] of [[0,bounds[0]],[1,bounds[1]],[0,bounds[2]],[1,bounds[3]]]){
    const t=(edge-a[axis])/delta[axis];
    if(t>0&&t<1)parameters.push(t);
  }
  parameters.sort((x,y)=>x-y);
  const pieces=[];
  for(let i=1;i<parameters.length;i++){
    const start=parameters[i-1],end=parameters[i];
    if(end>start&&inBounds(at((start+end)/2),bounds))pieces.push([at(start),at(end)]);
  }
  return pieces;
}

function nearest(point,segments){
  let min=Infinity;
  for(const [a,b] of segments){
    const dx=b[0]-a[0],dz=b[1]-a[1],square=dx*dx+dz*dz;
    const t=square?Math.min(1,Math.max(0,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/square)):0;
    min=Math.min(min,Math.hypot(point[0]-(a[0]+dx*t),point[1]-(a[1]+dz*t)));
  }
  return min;
}

function selfCrosses(points){
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const last=points.length-2;
  for(let i=0;i<=last;i++)for(let j=i+2;j<=last;j++){
    if(i===0&&j===last)continue;
    const a=points[i],b=points[i+1],c=points[j],d=points[j+1];
    if(cross(a,b,c)*cross(a,b,d)<-1e-10&&cross(c,d,a)*cross(c,d,b)<-1e-10)return true;
  }
  return false;
}

export function compareGeometry(sourceBytes,parts,scene){
  const hash=createHash('sha256').update(sourceBytes).digest('hex');
  if(hash!==scene.sourceSha256)throw new Error('Hash da fonte arquivada difere do snapshot em execução.');
  const raw=JSON.parse(sourceBytes);
  const bboxWgs84=['minlat','minlon','maxlat','maxlon'].map(key=>raw.bounds[key]);
  if(JSON.stringify(bboxWgs84)!==JSON.stringify(scene.bboxWgs84))throw new Error('BBox da fonte diverge da cena.');
  const origin=scene.geographicOrigin;
  const project=(lat,lon)=>[(lon-origin.lon)*111320*Math.cos(origin.lat*Math.PI/180),(origin.lat-lat)*111320];
  const [south,west,north,east]=bboxWgs84;
  const nw=project(north,west),se=project(south,east),bounds=[...nw,...se];
  const nodes=new Map(raw.elements.filter(x=>x.type==='node').map(x=>[x.id,project(x.lat,x.lon)]));
  const reference=new Map(), junctions=new Map(), invalid=[], exclusions=[];
  for(const way of raw.elements.filter(x=>x.type==='way')){
    const type=classify(way);
    if(!type)continue;
    const points=way.nodes.map(id=>nodes.get(id));
    if(points.some(point=>!point)){
      invalid.push({id:way.id,side:'source',reason:'Nó de origem ausente.'});continue;
    }
    const segments=points.slice(1).flatMap((b,i)=>withinBox(points[i],b,bounds));
    if(area(type.kind)&&(!type.closed||selfCrosses(points))){
      invalid.push({id:way.id,side:'source',reason:type.closed?'Interseção própria do anel.':'Contorno aberto.'});
      if(!type.closed)continue;
    }
    if(!segments.length){
      exclusions.push({id:way.id,reason:'Contorno sem segmento visível na bbox. Uma área pode cobrir toda a caixa.'});
    }
    reference.set(way.id,{id:way.id,kind:type.kind,segments});
    if(type.kind==='path')for(const id of new Set(way.nodes)){
      if(!inBounds(nodes.get(id),bounds))continue;
      if(!junctions.has(id))junctions.set(id,[]);
      junctions.get(id).push(way.id);
    }
  }

  const rendered=new Map();
  for(const {id,kind,segments,invalidEdges} of parts){
    if(!rendered.has(id))rendered.set(id,{id,kind,segments:[]});
    if(!segments.length||invalidEdges)invalid.push({id,side:'three',reason:'Malha sem contorno ou com aresta não manifold.'});
    for(const segment of segments){
      if(segment.length!==2||!segment.every(p=>p.length===2&&p.every(Number.isFinite))){
        invalid.push({id,side:'three',reason:'Coordenada não finita.'});continue;
      }
      rendered.get(id).segments.push(segment);
    }
  }
  const missing=[],unexpected=[],differences=[];
  const borderEdge=([a,b])=>bounds.some((value,i)=>Math.abs(a[i%2]-value)<=tolerance&&Math.abs(b[i%2]-value)<=tolerance);
  let maxError=0,samples=0,clippedPolygonEdges=0;
  const measure=(from,to)=>{
    let max=0;
    for(const [a,b] of from){
      const count=Math.max(2,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));
      for(let i=0;i<=count;i++){
        const t=i/count,p=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
        max=Math.max(max,nearest(p,to));samples++;
      }
    }
    return max;
  };
  for(const source of reference.values()){
    const game=rendered.get(source.id);
    if(!game){
      if(source.segments.length)missing.push(source.id);
      continue;
    }
    const perimeter=area(game.kind)?game.segments.filter(segment=>{
      if(!borderEdge(segment))return true;
      clippedPolygonEdges++;
      return false;
    }):game.segments;
    const errors=[
      measure(source.segments,game.segments),
      measure(perimeter,source.segments),
    ];
    const max=Math.max(...errors);
    if(Number.isFinite(max))maxError=Math.max(maxError,max);
    if(max>tolerance||game.kind!==source.kind)
      differences.push({id:source.id,sourceKind:source.kind,renderedKind:game.kind,maxErrorMeters:Number.isFinite(max)?max:null});
  }
  for(const id of rendered.keys())if(!reference.has(id))unexpected.push(id);
  const junctionIssues=[], visibleJunctions=[];
  for(const [nodeId,ways] of junctions){
    if(ways.length<2)continue;
    const point=nodes.get(nodeId);
    const wayIds=ways.filter(id=>reference.get(id).segments.length);
    if(wayIds.length<2)continue;
    const absent=wayIds.filter(id=>nearest(point,rendered.get(id)?.segments??[])>tolerance);
    visibleJunctions.push({nodeId,point,divergent:absent.length>0});
    if(absent.length)junctionIssues.push({nodeId,wayIds,missingOrDisplaced:absent});
  }
  const byClass={};
  for(const kind of ['path','building','green','water','rail'])byClass[kind]={
    source:[...reference.values()].filter(x=>x.kind===kind&&x.segments.length).length,
    three:[...rendered.values()].filter(x=>x.kind===kind).length,
  };
  return {
    bounds,reference:[...reference.values()],rendered:[...rendered.values()],junctions:visibleJunctions,
    snapshot:gzipSync(sourceBytes),
    report:{
      renderedGeometrySha256:createHash('sha256').update(JSON.stringify(parts)).digest('hex'),
      status:missing.length||unexpected.length||differences.length||invalid.length||junctionIssues.length?'differences-found':'within-tolerance',
      snapshot:{file:'geography/high-park-north.osm-source.json.gz',sha256Uncompressed:hash,
        extractedAt:raw.extractedAt,osmApiVersion:raw.version},
      comparison:{toleranceMeters:tolerance,samples,maxSampledErrorMeters:maxError,
        method:'Amostras nos dois sentidos, com passo de até 2 m, por ID. Eixos derivados dos triângulos das vias e contornos das malhas Three.js.',
        byClass,junctionCount:visibleJunctions.length,clippedPolygonEdges},
      missing,unexpected,differences,invalid,junctionIssues,exclusions,
      intentional:[
        'Larguras de rua e trilha são estilizadas. Comparamos o eixo central.',
        'Arestas artificiais de corte de áreas sobre a bbox são contabilizadas separadamente.',
        'Vértices de runtime arredondados ao centímetro após o recorte. Geometria fora da bbox fica de fora.',
      ],
      limitations:[
        'Comparação amostral com o snapshot, sem levantamento independente de campo.',
        'Somente cruzamentos topológicos com nó compartilhado. Altimetria e passagens em níveis diferentes não são inferidas.',
        'Validação de anel detecta abertura e cruzamentos próprios estritos; não certifica multipolígonos ou validade topológica completa.',
      ],
    },
  };
}

export function cartographicSvg(data,overlay=false,route=[]){
  const [w,n,e,s]=data.bounds;
  const width=1280,height=720,scale=Math.min(1190/(e-w),572/(s-n));
  const left=(width-(e-w)*scale)/2,top=78;
  const xy=([x,z])=>[(left+(x-w)*scale).toFixed(2),(top+(z-n)*scale).toFixed(2)].join(',');
  const lines=segments=>segments.map(([a,b])=>'M'+xy(a)+'L'+xy(b)).join('');
  const projectedWidth=(e-w)*scale,projectedHeight=(s-n)*scale;
  const refs={path:'#286795',building:'#474254',green:'#33715a',water:'#187997',rail:'#67538a'};
  const redIds=new Set([...data.report.missing,...data.report.unexpected,...data.report.differences.map(x=>x.id),...data.report.invalid.map(x=>x.id)]);
  const draw=(features,game=false)=>features.map(feature=>{
    const bad=overlay&&redIds.has(feature.id);
    const stroke=bad?'#b91c35':game?'#da7905':refs[feature.kind]||'#444';
    return `<path d="${lines(feature.segments)}" fill="none" stroke="${stroke}" stroke-width="${bad?3:game?3:2}" opacity="${bad?1:game?.61:.83}"/>`;
  }).join('');
  const joints=data.junctions.map(({point,divergent})=>{
    const [x,y]=xy(point).split(',');
    return `<circle cx="${x}" cy="${y}" r="${divergent?4:1.55}" fill="${divergent?'#b91c35':'#2d526a'}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="1280" height="720" fill="#f5f2e9"/>
    <text x="32" y="40" font-family="sans-serif" font-size="25" fill="#233441">${overlay?'High Park norte · OSM × Three.js':'High Park norte · referência OSM'}</text>
    <text x="32" y="63" font-family="sans-serif" font-size="14" fill="#4c5253">Projeção local em metros · norte para cima · mesma bbox e escala</text>
    <rect x="${left}" y="${top}" width="${projectedWidth}" height="${projectedHeight}" fill="#faf9f4" stroke="#75848b"/>
    <clipPath id="area"><rect x="${left}" y="${top}" width="${projectedWidth}" height="${projectedHeight}"/></clipPath>
    <g clip-path="url(#area)">${draw(data.reference)}${overlay?draw(data.rendered,true):''}${joints}
      ${overlay&&route.length>1?`<path d="M${route.map(xy).join('L')}" fill="none" stroke="#3b238b" stroke-width="3" stroke-dasharray="5 4"/>`:''}</g>
    <text x="32" y="105" font-family="sans-serif" font-size="18" fill="#233441">↑ N</text>
    <path d="M32 138h${50*scale}" stroke="#233441" stroke-width="3"/>
    <text x="32" y="159" font-family="sans-serif" font-size="14" fill="#233441">50 m</text>
    <text x="32" y="690" font-family="sans-serif" font-size="14" fill="#233441">${overlay?'Azul e verde: OSM · Laranja: Three.js · Vermelho: divergência · Violeta: rota':'Azul: vias · Verde: áreas verdes · Cinza: edifícios · Pontos: nós compartilhados'}</text>
    <text x="1248" y="690" text-anchor="end" font-family="sans-serif" font-size="14" fill="#233441">© OpenStreetMap contributors · ODbL</text>
  </svg>`;
}
