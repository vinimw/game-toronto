import {defineConfig} from 'vite';

// Local development stays at /. Pages can supply its actual base_path;
// standalone builds can use PAGES_REPOSITORY_NAME for a project site.
export default defineConfig(({command,isPreview})=>{
  const repository=process.env.PAGES_REPOSITORY_NAME;
  const base=process.env.PAGES_BASE_PATH??(repository?'/'+repository+'/':'/');
  if(!/^\/(?:[^?#\\]*\/)?$/.test(base)||base.includes('..'))
    throw new Error('PAGES_BASE_PATH must be / or an absolute directory path ending in /.');
  return {base:command==='serve'&&!isPreview?'/':base};
});
