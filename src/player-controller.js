import {movementDelta,movePlayer} from './movement.js';

import {WALK_SPEED,RUN_SPEED,MAX_MULTIPLIER,SPEED_STEP} from './player-speed-settings.js';

export {WALK_SPEED,RUN_SPEED,MAX_MULTIPLIER,SPEED_STEP} from './player-speed-settings.js';

// One controller for the persistent avatar, independent of region and saved progress.
export class PlayerController {
  constructor(){this.multiplier=1;}
  setMultiplier(value){
    if(Number.isFinite(value))this.multiplier=Math.max(1,Math.min(MAX_MULTIPLIER,Math.round(value/SPEED_STEP)*SPEED_STEP));
    return this.multiplier;
  }
  configuredSpeed(running=false){return (running?RUN_SPEED:WALK_SPEED)*this.multiplier;}
  move(position,{right,forward,yaw,running,dt,canWalk}){
    const delta=movementDelta(right,forward,yaw,this.configuredSpeed(running),dt);
    const motion=movePlayer(position,delta,canWalk,dt);
    // Preserve normal walk/run cadence while still stopping animation at walls.
    return {...motion,animationSpeed:motion.speed/this.multiplier};
  }
}
