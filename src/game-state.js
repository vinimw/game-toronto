export {MEMORY_ID} from './memories.js';
import {MEMORY_ID} from './memories.js';

const SAVE_KEY='game-love-progress-v1';
const SAVE_VERSION=2;
const cleanIds=value=>Array.isArray(value)?[...new Set(value.filter(item=>typeof item==='string'&&item))]:[];

export function createGameState(storage) {
  let saved,serialized;
  try {serialized=storage?.getItem(SAVE_KEY);saved=JSON.parse(serialized||'null');}catch{}
  const state={
    discoveredMemories:cleanIds(saved?.discoveredMemories),
    unlockedMemories:cleanIds(saved?.unlockedMemories),
    inventory:Array.isArray(saved?.inventory)?saved.inventory.filter(v=>typeof v==='string'):[],
    progress:saved?.progress && typeof saved.progress==='object' && !Array.isArray(saved.progress)?saved.progress:{},
  };
  try {
    if(storage?.getItem('game-love-memory-001')==='unlocked' && !state.unlockedMemories.includes(MEMORY_ID))
      state.unlockedMemories.push(MEMORY_ID);
  }catch{}
  state.discoveredMemories=cleanIds([...state.discoveredMemories,...state.unlockedMemories]);

  function save(){
    try{
      const next=JSON.stringify({version:SAVE_VERSION,...state});
      if(next!==serialized){storage?.setItem(SAVE_KEY,next);serialized=next;}
    }catch{}
  }
  function discoverMemory(id){
    if(state.discoveredMemories.includes(id))return false;
    state.discoveredMemories.push(id);
    save();
    return true;
  }
  function unlockMemory(id){
    if(state.unlockedMemories.includes(id)){save();return false;}
    if(!state.discoveredMemories.includes(id))state.discoveredMemories.push(id);
    state.unlockedMemories.push(id);
    save();
    return true;
  }
  return {state,save,discoverMemory,unlockMemory};
}
