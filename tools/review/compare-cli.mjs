import {copyFile,mkdir,mkdtemp,readFile,rename,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {buildComparison,openReviewZip,writeComparisons} from './compare.mjs';
import {writeReport} from './report.mjs';

async function main(){
  const {values:{baseline,standalone}}=parseArgs({options:{baseline:{type:'string'},standalone:{type:'boolean'}}});
  if(!baseline)throw new Error('Uso: npm run review:compare -- --baseline <ZIP anterior>');
  const root=fileURLToPath(new URL('../../artifacts/reviews/',import.meta.url));
  const latest=join(root,'latest');
  const stage=await mkdtemp(join(root,'.compare-'));
  try{
    const previous=await openReviewZip(resolve(baseline),stage);
    const read=async file=>JSON.parse(await readFile(join(latest,file),'utf8'));
    const [metadata,performance,geography,issues]=await Promise.all(
      ['metadata.json','performance.json','geographic-correspondence.json','console-errors.json'].map(read));
    const imageFiles=[...metadata.captures.flatMap(capture=>capture.file?[capture.file]:[]),
      ...metadata.geographicEvidence.filter(file=>file.endsWith('.png'))];
    const report=join(stage,'report');
    await mkdir(join(report,'screenshots'),{recursive:true});
    for(const file of imageFiles)await copyFile(join(latest,file),join(report,file));
    const readImage=file=>readFile(join(report,file));
    const comparison=await buildComparison(previous,{metadata,performance,readImage});
    await writeComparisons(report,comparison);
    const data={metadata,performance,geography,issues,imageFiles,readImage,comparison};
    await writeReport(join(report,'report.html'),data);
    if(standalone)await writeReport(join(report,'report-standalone.html'),{...data,standalone:true});
    const output=join(root,'comparison');
    await rm(output,{recursive:true,force:true});
    await rename(report,output);
    console.log('[review] '+comparison.captures.filter(capture=>capture.status==='comparable').length+
      ' pares equivalentes · '+join(output,'report.html'));
  }finally{await rm(stage,{recursive:true,force:true});}
}

main().catch(error=>{console.error('[review] '+error.message);process.exitCode=1;});
