import {writeFile} from 'node:fs/promises';

export const escapeHtml=value=>String(value??'—').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
})[char]);

export function imageData(buffer,{validateOnly=false}={}){
  if(buffer.length<24||buffer.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
    throw new Error('Captura PNG inválida.');
  if(!validateOnly)return 'data:image/png;base64,'+buffer.toString('base64');
}

const h=escapeHtml;
const number=value=>Number.isFinite(value)?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(value):'—';
const labels={drawCalls:'Draw calls',triangles:'Triângulos',frameTimeMeanMs:'Tempo médio (ms)',frameTimeP50Ms:'p50 (ms)',
  frameTimeP95Ms:'p95 (ms)',sceneLoadMs:'Carregamento (ms)',fps:'FPS médio',durationMs:'Duração (ms)',distanceMeters:'Distância (m)',
  drawCallsMean:'Draw calls médios',trianglesMean:'Triângulos médios'};
const details=(label,data)=>'<details><summary>'+h(label)+'</summary><pre>'+h(JSON.stringify(data,null,2))+'</pre></details>';
const metricDeltas=metrics=>Object.entries(metrics).map(([key,{baseline,current,delta}])=>
  '<tr><th>'+h(labels[key]??key)+'</th><td>'+number(baseline)+'</td><td>'+number(current)+'</td><td>'+number(delta)+'</td></tr>').join('');
const deltaTable=(metrics={})=>Object.keys(metrics).length?
  '<table><thead><tr><th>Métrica</th><th>Referência</th><th>Atual</th><th>Variação</th></tr></thead><tbody>'+
  metricDeltas(metrics)+'</tbody></table>':'';
const image=(src,caption)=>'<figure><img loading="lazy" src="'+h(src)+'" alt="'+h(caption)+'"><figcaption>'+h(caption)+'</figcaption></figure>';

function compareSection(comparison,source){
  if(!comparison)return '<p>Export gerado sem referência. Execute review:compare ou informe --baseline no export.</p>';
  const {captures,environment,motion}=comparison;
  const meaning={
    'equivalent-recorded':'Navegador, SO e arquitetura registrados coincidem. GPU e carga do sistema podem variar.',
    incomplete:'A referência tem metadados de ambiente incompletos. Compare medidas de tempo com cautela.',
    different:'O ambiente de execução mudou. Tempos são descritivos e não sustentam comparação direta.',
  };
  const counts=captures.filter(capture=>capture.status==='comparable').length;
  return '<p>'+counts+' pares equivalentes de '+captures.length+' vistas encontradas.</p>'+
    '<p>Referência '+h(comparison.baseline.git?.commit)+' · Atual '+h(comparison.current.git?.commit)+'</p>'+
    '<p>Arquivo <code>'+h(comparison.baseline.archiveFile)+'</code> · '+h(comparison.baseline.exportedAt)+'</p>'+
    '<p>SHA-256 <code>'+h(comparison.baseline.archiveSha256)+'</code>'+
    (comparison.baseline.sha256Verified?' · conferido com o valor fornecido':' · conferência com hash de referência pendente')+'</p>'+
    '<p>'+h(meaning[environment])+'</p><h3>Percurso</h3>'+
    (motion.reasons.length?'<p>'+h(motion.reasons.join(' '))+'</p>':deltaTable(motion.metrics))+
    captures.map(capture=>'<section><h3>'+h(capture.id+' · '+capture.label)+'</h3>'+
      (capture.reasons.length?'<p>'+h(capture.reasons.join(' · '))+'</p>':'')+
      (capture.images?'<div class="pair">'+image(source(capture.images.baseline),'Referência')+image(source(capture.images.current),'Atual')+'</div>':'')+
      deltaTable(capture.metrics)+'</section>').join('');
}

export async function writeReport(file,{metadata,performance,geography,issues,imageFiles,readImage,comparison,standalone=false}){
  const embedded=new Map();
  if(standalone){
    const paths=[...imageFiles,...(comparison?.captures??[]).flatMap(item=>Object.values(item.images??{}))];
    for(const path of new Set(paths))embedded.set(path,imageData(await readImage(path)));
  }
  const source=path=>standalone?embedded.get(path):path;
  const checkedImages=[];
  for(const path of [...imageFiles].sort()){
    const capture=metadata.captures.find(item=>item.file===path);
    const label=capture?.label??(path.includes('07-')?'Referência OSM':'Sobreposição cartográfica');
    checkedImages.push(image(source(path),label));
  }
  const missing=metadata.captures.filter(capture=>capture.status!=='captured');
  const metricKeys=['fps','frameTimeMeanMs','frameTimeP95Ms','drawCalls','triangles','sceneLoadMs'];
  const table='<table><thead><tr><th>Captura</th>'+metricKeys.map(key=>'<th>'+h(labels[key])+'</th>').join('')+
    '</tr></thead><tbody>'+performance.captures.map(metric=>'<tr><th>'+h(metric.captureId)+'</th>'+
      metricKeys.map(key=>'<td>'+number(metric[key])+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  const motion=performance.motion;
  const motionTable=motion?.status==='passed'?'<p>'+number(motion.distanceMeters)+' m em '+number(motion.durationMs/1000)+
    ' s · '+number(motion.fps)+' FPS · média '+number(motion.frameTimeMeanMs)+' ms · p50 '+number(motion.frameTimeP50Ms)+
    ' ms · p95 '+number(motion.frameTimeP95Ms)+' ms.</p>':'<p>'+h(motion?.reason??motion?.status??'Medição indisponível')+'</p>';
  const geo=geography.cartography;
  const html='<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src \'self\' file: data:; style-src \'unsafe-inline\'">'+
    '<title>Game Love · Revisão</title><style>body{margin:0 auto;padding:1.5rem;max-width:1120px;font:16px/1.55 system-ui,sans-serif;color:#26372d;background:#f9f6eb}'+
    'h1,h2,h3{line-height:1.2}h2{margin-top:2.5rem}figure{margin:0}img{width:100%;height:auto;display:block;background:#e5dfcc}'+
    'figcaption{padding:.45rem 0}.gallery,.pair{display:grid;gap:1rem}.gallery{grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr))}'+
    '.pair{grid-template-columns:repeat(2,minmax(0,1fr))}table{border-collapse:collapse;display:block;overflow:auto}td,th{text-align:left;padding:.35rem .6rem;border-bottom:1px solid #d6d6c8}'+
    'pre{overflow:auto}details{margin:.75rem 0}summary{cursor:pointer}</style><main>'+
    '<h1>Game Love · Revisão</h1><p>'+h(metadata.exportedAt)+' · pipeline '+h(metadata.pipelineVersion??'legado')+
    ' · '+h(metadata.status==='partial'?'Pacote parcial':'Capturas concluídas')+'</p>'+
    '<p>Commit <code>'+h(metadata.git?.commit)+'</code>'+ (metadata.git?.dirty?' · alterações locais':'')+
    ' · Chromium '+h(metadata.browser?.version)+'</p>'+details('Build e testes',metadata.checks)+
    details('Perfis e parâmetros por captura',{profiles:metadata.profiles, reproducibility:metadata.reproducibility,
      captures:metadata.captures})+
    (metadata.entranceComparison?'<p><a href="north-entrance-comparison.html">Entrada norte · comparação com a foto e percurso</a> · <a href="world-streaming.json">Streaming de setores</a> · <a href="cherry-hill.json">Hatchling Hill</a></p>':'')+
    '<h2>High Park World Progress</h2><ul>'+
    '<li>Entrada norte · landmark detalhado, setor de entrada existente.</li>'+
    '<li>Instalações esportivas do norte · OSM/HRDEM, linhas e superfícies carregadas por setor. Equipamentos e percurso integrado pendentes.</li>'+
    '<li>Cherry Hill, Grenadier Pond e Maple Leaf Garden · landmarks detalhados, com diagnósticos próprios.</li>'+
    '<li>Grenadier Café, zoológico e Jamie Bell · base geográfica. Modelagem específica pendente.</li>'+
    '<li>Trackless Train · serviço documentado. Modelo e rota ainda pendentes.</li></ul>'+
    '<h2>Galeria</h2><div class="gallery">'+checkedImages.join('')+'</div>'+
    (missing.length?details('Capturas ausentes',missing):'')+'<h2>Desempenho estático</h2>'+table+
    details('Métricas por captura',performance.captures)+'<h2>Desempenho em movimento</h2>'+motionTable+
    details('Configuração, amostras e erros do percurso',motion)+'<h2>Geografia</h2>'+
    '<p>Cartografia '+h(geo?.status??geography.status)+' · desvio amostral '+number(geo?.comparison?.maxSampledErrorMeters*1000)+
    ' mm · rota '+h(geography.navigation?.status)+'</p>'+details('Origem, hash, bbox e validação',geography)+
    '<h2>Comparações</h2>'+compareSection(comparison,source)+'<h2>Erros</h2>'+
    (issues.length?details(issues.length+' ocorrências registradas',issues):'<p>Nenhuma ocorrência registrada.</p>')+
    '<h2>Limitações</h2><p>As imagens mobile simulam viewport vertical no Chromium. As medições em navegador automatizado não equivalem a desempenho em celular físico. '+
    'O percurso usa a movimentação, colisão e animação do jogo com direção automatizada no modo de revisão. '+
    'A correspondência OSM é amostral e depende da extração versionada. A vegetação é procedural.</p></main>';
  await writeFile(file,html);
}
