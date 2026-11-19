import {execFileSync} from 'node:child_process';
import {copyFile,mkdir,readFile,realpath,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {imageData} from './report.mjs';

const imagePath=/^screenshots\/[a-z0-9][a-z0-9-]*\.png$/;
const zipOptions={maxBuffer:24*1024*1024,timeout:15000,stdio:['ignore','pipe','ignore']};

export async function openReviewZip(source,stage,{outputZip}={}){
  const input=await realpath(source);
  const destination=outputZip?await realpath(outputZip).catch(error=>{
    if(error.code!=='ENOENT')throw error;
    return outputZip;
  }):null;
  if(input===destination)throw new Error('O baseline é o ZIP de saída. Copie-o para outro caminho antes de exportar.');
  const zip=join(stage,'baseline.zip');
  await copyFile(input,zip);
  const archiveSha256=createHash('sha256').update(await readFile(zip)).digest('hex');
  const files=execFileSync('unzip',['-Z','-1',zip],zipOptions).toString().trimEnd().split('\n');
  const read=file=>{
    if(files.filter(name=>name===file).length!==1)throw new Error('Entrada ausente ou duplicada no ZIP: '+file);
    return execFileSync('unzip',['-p',zip,file],zipOptions);
  };
  const metadata=JSON.parse(read('metadata.json'));
  if(!Array.isArray(metadata.captures)||!Object.hasOwn(metadata.git??{},'commit')||
    typeof metadata.exportedAt!=='string'||!Number.isFinite(Date.parse(metadata.exportedAt)))
    throw new Error('metadata.json do baseline sem identificação válida do export.');
  evidenceCaptures(metadata);
  return {
    archiveSha256,
    metadata,
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
  ['captureMode','modo de captura'],['hud','estado do HUD'],['sourceSha256','hash OSM'],['bboxWgs84','bbox OSM'],['geographicOrigin','origem cartográfica'],
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
  const byId=new Map();
  for(const capture of [...metadata.captures,...evidence]){
    if(typeof capture.id!=='string'||!/^\d{2}-[a-z0-9-]+$/.test(capture.id)||byId.has(capture.id))
      throw new Error('Identificador de captura inválido ou duplicado: '+String(capture.id));
    byId.set(capture.id,capture);
  }
  return byId;
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
      const [baselineImage,currentImage]=await Promise.all([before.readImage(a.file),after.readImage(b.file)]);
      imageData(baselineImage,{validateOnly:true});imageData(currentImage,{validateOnly:true});
      images={baseline:'comparisons/'+id+'.png',current:b.file};
      base.baselineImage=baselineImage;
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
  return {baseline:{git:before.metadata.git,exportedAt:before.metadata.exportedAt??null,
      archiveSha256:before.archiveSha256??null,pipelineVersion:before.metadata.pipelineVersion??null},
    current:{git:after.metadata.git,pipelineVersion:after.metadata.pipelineVersion??null},environment,
    motion:{reasons:motionReasons,metrics:motionReasons.length?{}:deltas(flatMotion(first),flatMotion(second),motionFields)},
    captures};
}

export async function writeComparisons(dir,comparison){
  const files=['comparison.json'];
  await mkdir(join(dir,'comparisons'),{recursive:true});
  const captures=[];
  for(const {baselineImage,...capture} of comparison.captures){
    if(baselineImage){
      await writeFile(join(dir,capture.images.baseline),baselineImage);
      files.push(capture.images.baseline);
    }
    captures.push(capture);
  }
  await writeFile(join(dir,'comparison.json'),JSON.stringify({...comparison,captures},null,2)+'\n');
  return files;
}
