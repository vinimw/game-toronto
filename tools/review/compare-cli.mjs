import {mkdir,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {buildComparison,openReviewZip,writeComparisons} from './compare.mjs';
import {writeReport} from './report.mjs';

async function main(){
  const {values:{baseline}}=parseArgs({options:{baseline:{type:'string'}}});
  if(!baseline)throw new Error('Uso: npm run review:compare -- --baseline <ZIP anterior>');
  const root=fileURLToPath(new URL('../../artifacts/reviews/',import.meta.url));
  const latest=join(root,'latest');
  const read=async file=>JSON.parse(await readFile(join(latest,file),'utf8'));
  const [metadata,performance,geography,issues]=await Promise.all(
    ['metadata.json','performance.json','geographic-correspondence.json','console-errors.json'].map(read));
  const readImage=file=>readFile(join(latest,file));
  const comparison=await buildComparison(openReviewZip(resolve(baseline)),{metadata,performance,readImage});
  const output=join(root,'comparison');
  await mkdir(output,{recursive:true});
  await writeComparisons(output,comparison);
  const imageFiles=[...metadata.captures.flatMap(capture=>capture.file?[capture.file]:[]),
    ...metadata.geographicEvidence.filter(file=>file.endsWith('.png'))];
  await writeReport(join(output,'report.html'),{metadata,performance,geography,issues,imageFiles,readImage,comparison});
  console.log('[review] '+comparison.captures.filter(capture=>capture.status==='comparable').length+
    ' pares equivalentes · '+join(output,'report.html'));
}

main().catch(error=>{console.error('[review] '+error.message);process.exitCode=1;});
