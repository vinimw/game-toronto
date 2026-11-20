const distance=([x,z],[west,north,east,south])=>Math.hypot(Math.max(west-x,0,x-east),Math.max(north-z,0,z-south));
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));

export class WorldStreaming {
  constructor(sectors,{now=()=>performance.now(),frame=nextFrame,graceMs=1400}={}){
    this.sectors=sectors.map(sector=>({...sector,state:'idle',lastUsed:null,priority:null,activationMs:null,
      buildMs:null,activations:0,failures:0,lateVisits:0,initialVisits:0,firstPresentationCount:0,lateActivationCount:0,visiblePopInCount:0,wasInside:null,result:null,retireAt:0}));
    Object.assign(this,{now,frame,graceMs});
    this.loading=new Set();
    this.disposed=false;
  }

  attach(sector){
    if(this.disposed||sector.state==='active')return Promise.resolve();
    if(sector.pending)return sector.pending;
    const controller=new AbortController(),start=this.now();
    sector.controller=controller;
    sector.state='loading';
    this.loading.add(sector);
    sector.pending=(async()=>{
      let result;
      try{
        await this.frame();
        controller.signal.throwIfAborted();
        result=await sector.load(controller.signal,this.frame);
        controller.signal.throwIfAborted();
        result.mount();
        sector.result=result;
        sector.state='active';
        sector.activations++;
        if(sector.pendingInitialPresentation)sector.firstPresentationCount++;
        else{
          if(sector.inside&&sector.wasLate)sector.lateActivationCount++;
          if(sector.inView)sector.visiblePopInCount++;
        }
        sector.pendingInitialPresentation=false;
        sector.wasLate=false;
        sector.lastEvent={at:this.now(),type:'mount',textureUploadMs:result.textureUploadMs??0,
          assetPreparationMs:result.assetPreparationMs??null};
        sector.activationMs=this.now()-start;
        sector.buildMs=result.buildMs??null;
      }catch(error){
        result?.dispose();
        const cancelled=controller.signal.aborted;
        sector.state=cancelled?'idle':'failed';
        if(!cancelled){
          sector.failures++;
          sector.error=error.message;
          sector.retryAt=this.now()+2500;
        }
      }finally{
        sector.pending=null;
        this.loading.delete(sector);
      }
    })();
    return sector.pending;
  }

  update(position,velocity=[0,0],look=[0,0],view={}){
    if(this.disposed||this.priming)return;
    const now=this.now();
    const queue=[];
    for(const sector of this.sectors){
      if(sector.hasDetail&&!sector.hasDetail())continue;
      const near=distance(position,sector.bounds);
      const lead=Math.min(3,Math.max(2,(sector.activationMs??500)/1000+.5));
      const predicted=[position[0]+velocity[0]*lead+look[0]*26,position[1]+velocity[1]*lead+look[1]*26];
      const ahead=distance(predicted,sector.bounds);
      const [west,north,east,south]=sector.bounds;
      const [x,z]=view.position??position;
      const dx=Math.max(west,Math.min(east,x))-x,dz=Math.max(north,Math.min(south,z))-z;
      const length=Math.hypot(dx,dz);
      const inView=length<95&&(length===0||(dx*look[0]+dz*look[1])/length>=(view.cosHalfFov??.6));
      const inside=near===0;
      const wanted=near<=sector.loadRadius||ahead<=sector.loadRadius*.64;
      sector.priority=wanted?Math.min(near,ahead+18)-(inView?35:0)+(sector.bias??0):null;
      if(inside&&sector.wasInside!==true&&sector.state!=='active'){
        if(sector.wasInside===null){sector.initialVisits++;sector.pendingInitialPresentation=true;}
        else sector.lateVisits++;
        sector.wasLate=true;
      }
      if(!inside&&sector.wasInside)sector.pendingInitialPresentation=false;
      sector.inView=inView;
      sector.inside=inside;
      sector.wasInside=inside;
      if(wanted){sector.lastUsed=now;sector.retireAt=0;}
      if(!wanted&&near>sector.keepRadius&&['active','loading'].includes(sector.state)){
        sector.retireAt ||= now+this.graceMs;
        if(now>=sector.retireAt)this.evict(sector);
      }else if(near<=sector.keepRadius)sector.retireAt=0;
      if(wanted&&(sector.state==='idle'||(sector.state==='failed'&&now>=sector.retryAt)))queue.push(sector);
    }
    queue.sort((a,b)=>a.priority-b.priority);
    // One procedural builder and one asset bundle may advance concurrently.
    for(const sector of queue)
      if(![...this.loading].some(work=>work.lane===sector.lane))void this.attach(sector);
  }

  evict(sector){
    if(sector.pending)sector.controller.abort();
    else if(sector.result){
      const start=this.now();
      sector.result.dispose();
      sector.lastEvent={at:this.now(),type:'dispose',durationMs:this.now()-start};
      sector.result=null;
      sector.state='idle';
    }
    sector.retireAt=0;
  }

  async prime(accept=()=>true){
    this.priming=true;
    try{
      // Only deterministic capture and the eager comparison use this path.
      const lanes=new Set(this.sectors.map(sector=>sector.lane));
      await Promise.all([...lanes].map(async lane=>{
        for(const sector of this.sectors.filter(sector=>accept(sector)&&sector.lane===lane&&(!sector.hasDetail||sector.hasDetail())))await this.attach(sector);
      }));
    }finally{this.priming=false;}
  }

  dispose(){
    this.disposed=true;
    for(const sector of this.sectors)this.evict(sector);
  }

  stats(){
    return this.sectors.map(({id,bounds,assets,lods,state,lastUsed,priority,activationMs,buildMs,
      activations,failures,lateVisits,initialVisits,firstPresentationCount,lateActivationCount,visiblePopInCount,lastEvent,error,result,hasDetail})=>({id,bounds,assets,lods,state:hasDetail&&!hasDetail()?'base':state,lastUsed,priority,activationMs,
      buildMs,activations,failures,lateVisits,initialVisits,firstPresentationCount,lateActivationCount,visiblePopInCount,lastEvent,error,estimatedGeometryBytes:result?.estimatedGeometryBytes??0}));
  }
}
