import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {escapeHtml,imageData} from './report.mjs';

const imagePath=/^screenshots\/[a-z0-9][a-z0-9-]*\.png$/;
const zipOptions={maxBuffer:24*1024*1024,timeout:15000,stdio:['ignore','pipe','ignore']};

export function openReviewZip(zip){
  const files=execFileSync('unzip',['-Z','-1',zip],zipOptions).toString().trimEnd().split('\n');
  const read=file=>{
    if(files.filter(name=>name===file).length!==1)throw new Error('Entrada ausente ou duplicada no ZIP: '+file);
    return execFileSync('unzip',['-p',zip,file],zipOptions);
  };
  return {
    metadata:JSON.parse(read('metadata.json')),
    performance:JSON.parse(read('performance.json')),
    readImage(file){
      if(!imagePath.test(file))throw new Error('Nome de imagem inválido.');
      return read(file);
    },
  };
}

const comparableFields=[
  ['origin','origem'],['sceneId','cena'],['position','posição ou orientação da personagem'],
  ['camera','câmera'],['graphics','configuração gráfica'],['viewport','viewport'],['resolution','resolução'],
  ['sourceSha256','hash OSM'],['bboxWgs84','bbox OSM'],['geographicOrigin','origem cartográfica'],
];
const measureFields=['drawCalls','triangles','frameTimeMeanMs','frameTimeP50Ms','frameTimeP95Ms','sceneLoadMs'];
// Normalize the live pose as JSON would, so that -0 from a matrix matches a pose read from a ZIP.
const serialized=value=>value==null?value:JSON.parse(JSON.stringify(value));
export function incompatibilities(before,after){
  const mismatches=comparableFields.filter(([key])=>
    !isDeepStrictEqual(serialized(before[key]),serialized(after[key]))).map(([,label])=>label);
  if((before.deviceScaleFactor??1)!==(after.deviceScaleFactor??1))mismatches.push('device scale factor');
  if(Boolean(before.mobileViewportSimulation)!==Boolean(after.mobileViewportSimulation))mismatches.push('modo de emulação');
  if(comparableFields.slice(0,7).some(([key])=>before[key]==null||after[key]==null))mismatches.push('metadados incompletos');
  return mismatches;
}

function deltas(before,after,fields){
  return Object.fromEntries(fields.filter(key=>Number.isFinite(before?.[key])&&Number.isFinite(after?.[key])).map(key=>
    [key,{baseline:before[key],current:after[key],delta:after[key]-before[key]}]));
}

function evidenceCaptures(metadata){
  const pose=metadata.captures.find(item=>item.id==='06-high-park-ortografica');
  const evidence=(metadata.geographicEvidence??[]).filter(file=>imagePath.test(file)).map(file=>{
    const id=file.slice('screenshots/'.length,-4);
    return {...pose,id,label:id.startsWith('07')?'Referência OSM':'Sobreposição cartográfica',file,
      evidenceType:'cartography',status:'captured'};
  });
  return new Map([...metadata.captures,...evidence].map(capture=>[capture.id,capture]));
}

export async function buildComparison(before,after){
  const old=evidenceCaptures(before.metadata),next=evidenceCaptures(after.metadata);
  const oldMetrics=new Map(before.performance.captures.map(metric=>[metric.captureId,metric]));
  const nextMetrics=new Map(after.performance.captures.map(metric=>[metric.captureId,metric]));
  const oldRuntime=before.performance.runtime,newRuntime=after.performance.runtime;
  const sameBrowser=isDeepStrictEqual(before.metadata.browser,after.metadata.browser);
  const environment=sameBrowser&&oldRuntime&&newRuntime&&isDeepStrictEqual(oldRuntime,newRuntime)?'equivalent-recorded':
    sameBrowser&&(!oldRuntime||!newRuntime)?'incomplete':'different';
  const captures=[];
  for(const id of new Set([...old.keys(),...next.keys()])){
    const a=old.get(id),b=next.get(id);
    const base={id,label:b?.label??a?.label??id};
    if(a?.status!=='captured'||b?.status!=='captured'){
      captures.push({...base,status:'unmatched',reasons:[!a?'ID ausente na referência':a.status!=='captured'?'Captura indisponível na referência':
        !b?'ID ausente no export atual':'Captura indisponível no export atual']});
      continue;
    }
    const reasons=incompatibilities(a,b);
    let images;
    try{
      if(!imagePath.test(a.file)||!imagePath.test(b.file))throw new Error('Imagem inválida.');
      images=await Promise.all([before.readImage(a.file),after.readImage(b.file)]).then(items=>items.map(imageData));
    }catch{
      reasons.push('Arquivo de imagem ausente ou inválido');
    }
    const status=reasons.length?'incompatible':'comparable';
    const metrics=status==='comparable'?deltas(oldMetrics.get(id),nextMetrics.get(id),measureFields):{};
    captures.push({...base,status,reasons,metrics,images});
  }
  const first=before.performance.motion,second=after.performance.motion;
  const motionReasons=[];
  if(first?.status!=='passed'||second?.status!=='passed')motionReasons.push('Percurso medido ausente em uma das versões.');
  else for(const key of ['routeWayId','start','requestedDurationMs','speedMultiplier','graphics','viewport','resolution','sourceSha256','deviceScaleFactor']){
    if(!isDeepStrictEqual(first[key],second[key]))motionReasons.push('Configuração do percurso alterada · '+key);
  }
  const motionFields=['fps','durationMs','distanceMeters','frameTimeMeanMs','frameTimeP50Ms','frameTimeP95Ms','drawCallsMean','trianglesMean'];
  const flatMotion=m=>({...m,drawCallsMean:m?.drawCalls?.mean,trianglesMean:m?.triangles?.mean});
  return {baseline:{git:before.metadata.git,pipelineVersion:before.metadata.pipelineVersion??null},
    current:{git:after.metadata.git,pipelineVersion:after.metadata.pipelineVersion??null},environment,
    motion:{reasons:motionReasons,metrics:motionReasons.length?{}:deltas(flatMotion(first),flatMotion(second),motionFields)},
    captures};
}

export async function writeComparisons(dir,comparison){
  const folder='comparisons',files=[];
  await mkdir(join(dir,folder),{recursive:true});
  const summarized=comparison.captures.map(({images,...capture})=>{
    if(!images||!/^\d{2}-[a-z0-9-]+$/.test(capture.id))return capture;
    const file=folder+'/'+capture.id+'.svg';
    files.push(file);
    return {...capture,file};
  });
  const getDimensions=data=>{
    const bytes=Buffer.from(data.slice(data.indexOf(',')+1),'base64');
    return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
  };
  for(const [index,capture] of summarized.entries()){
    if(!capture.file)continue;
    const images=comparison.captures[index].images;
    const [a,b]=images.map(getDimensions);
    const width=a[0]+b[0],height=Math.max(a[1],b[1])+30;
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'">'+
      '<rect width="100%" height="100%" fill="#f1eee4"/>'+
      '<text x="12" y="21" font-family="sans-serif">Referência</text>'+
      '<text x="'+(a[0]+12)+'" y="21" font-family="sans-serif">'+
      escapeHtml(capture.status==='comparable'?'Atual':'Atual · configuração diferente')+'</text>'+
      '<image y="30" width="'+a[0]+'" height="'+a[1]+'" href="'+images[0]+'"/>'+
      '<image x="'+a[0]+'" y="30" width="'+b[0]+'" height="'+b[1]+'" href="'+images[1]+'"/></svg>';
    await writeFile(join(dir,capture.file),svg);
  }
  const summary='comparison.json';
  await writeFile(join(dir,summary),JSON.stringify({...comparison,captures:summarized},null,2)+'\n');
  return [summary,...files];
}
