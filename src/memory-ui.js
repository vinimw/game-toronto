import {assetUrl} from './asset-url.js';
import {regionManifest} from './regions.js';

const text=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
})[char]);
const regionName=memory=>text(regionManifest[memory.regionId]?.name??memory.regionId);

// Published images use paths under public/. Reject external and special URLs.
function imagePath(memory){
  const path=memory.image?.src;
  return typeof path==='string'&&/^\/(?!\/)[\p{L}\p{N}._/ -]+$/u.test(path)&&
    !path.split('/').some(part=>part==='..'||part==='.')?text(assetUrl(path)):null;
}
const landscape=()=>'<div class="memory-art" aria-hidden="true"><div class="memory-sun">✦</div><div class="memory-hill"></div></div>';

export function memoryMarkup(memory,firstOpening){
  const src=imagePath(memory);
  const art=src?'<div class="memory-photo"><img src="'+src+'" alt="'+text(memory.image.alt)+'">'+landscape()+'</div>':landscape();
  return `<article data-memory-id="${text(memory.id)}"${firstOpening?' class="memory-reveal"':''}>
    <p class="eyebrow">${memory.demo?'Memória fictícia de demonstração':'Memória'}</p>
    <h2 id="modal-title" class="memory-title">${text(memory.title)}</h2>
    <p class="memory-sub">${regionName(memory)}</p>
    ${art}
    <p class="memory-copy memory-narrative">${text(memory.narrative)}</p>
  </article>`;
}

export function albumMarkup(memories,state){
  const rows=memories.map(memory=>{
    const unlocked=state.unlockedMemories.includes(memory.id);
    const discovered=state.discoveredMemories.includes(memory.id);
    const title=discovered?memory.title:'Lembrança por descobrir';
    const status=unlocked?'Desbloqueada':discovered?'Descoberta · bloqueada':'Bloqueada';
    const src=unlocked?imagePath(memory):null;
    const thumbnail=src?`<img class="album-entry-image" src="${src}" alt="">`:'';
    const body=`<span class="album-entry-icon" aria-hidden="true">${thumbnail}${unlocked?'✦':'◇'}</span>
      <span><b>${text(title)}</b><small>${regionName(memory)} · ${status}</small>
      ${unlocked&&memory.description?`<small>${text(memory.description)}</small>`:''}</span>`;
    return unlocked?`<button type="button" class="album-entry" data-open-memory="${text(memory.id)}">${body}<span aria-hidden="true">›</span></button>`:
      `<div class="album-entry album-locked" data-locked-memory="${text(memory.id)}">${body}</div>`;
  });
  return `<h2 id="modal-title" class="memory-title">Álbum de memórias</h2><ul class="memory-album">${rows.map(row=>'<li>'+row+'</li>').join('')}</ul>`;
}

export function showPhotoFallbacks(root){
  for(const image of root.querySelectorAll('.memory-photo img, .album-entry-image')){
    const hide=()=>{image.hidden=true;};
    image.addEventListener('error',hide,{once:true});
    if(image.complete&&!image.naturalWidth)hide();
  }
}
