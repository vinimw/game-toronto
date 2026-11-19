export const MEMORY_ID='memory-001';
const SAVE_KEY='game-love-progress-v1';

export function createGameState(storage) {
  let saved;
  try {saved=JSON.parse(storage?.getItem(SAVE_KEY)||'null');}catch{}
  const state={
    unlockedMemories:Array.isArray(saved?.unlockedMemories)?saved.unlockedMemories.filter(v=>typeof v==='string'):[],
    inventory:Array.isArray(saved?.inventory)?saved.inventory.filter(v=>typeof v==='string'):[],
    progress:saved?.progress && typeof saved.progress==='object' && !Array.isArray(saved.progress)?saved.progress:{},
  };
  try {
    if(storage?.getItem('game-love-memory-001')==='unlocked' && !state.unlockedMemories.includes(MEMORY_ID))state.unlockedMemories.push(MEMORY_ID);
  }catch{}
  return {
    state,
    save(){
      try {
        storage?.setItem(SAVE_KEY,JSON.stringify(state));
        if(state.unlockedMemories.includes(MEMORY_ID))storage?.setItem('game-love-memory-001','unlocked');
      }catch{} // Progress remains available in this session when storage is disabled.
    },
    unlockMemory(id){if(!state.unlockedMemories.includes(id))state.unlockedMemories.push(id);this.save();},
  };
}
