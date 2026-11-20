// Decoded resources are owned by leases. Binary data can outlive a scene,
// within a bounded in-memory cache, without holding on to GPU allocations.
export class AssetManager {
  constructor({fetchBytes,decode,dispose,byteLimit=8*1024*1024,concurrency=2}){
    Object.assign(this,{fetchBytes,decode,dispose,byteLimit,concurrency});
    this.live=new Map();
    this.binary=new Map();
    this.downloaded=new Map();
    this.hitsByKey=new Map();
    this.queue=[];
    this.running=0;
    this.transfers=0;
    this.downloads=0;
    this.hits=0;
    this.cachedBytes=0;
  }

  async bytes(key,signal){
    if(this.binary.has(key)){
      const data=this.binary.get(key);
      this.binary.delete(key);
      this.binary.set(key,data);
      this.hits++;
      this.hitsByKey.set(key,(this.hitsByKey.get(key)??0)+1);
      return data;
    }
    const data=await this.fetchBytes(key,signal);
    this.downloads++;
    const prior=this.downloaded.get(key)??{downloads:0,bytes:0};
    this.downloaded.set(key,{downloads:prior.downloads+1,bytes:prior.bytes+data.byteLength});
    this.transfers+=data.byteLength;
    signal.throwIfAborted();
    if(data.byteLength<=this.byteLimit){
      this.binary.set(key,data);
      this.cachedBytes+=data.byteLength;
      while(this.cachedBytes>this.byteLimit){
        const [oldest,value]=this.binary.entries().next().value;
        this.binary.delete(oldest);
        this.cachedBytes-=value.byteLength;
      }
    }
    return data;
  }

  pump(){
    while(this.queue.length&&this.running<this.concurrency){
      const job=this.queue.shift();
      if(job.controller.signal.aborted){job.reject(job.controller.signal.reason);continue;}
      this.running++;
      this.bytes(job.key,job.controller.signal).then(buffer=>{
        job.controller.signal.throwIfAborted();
        return this.decode(job.key,buffer);
      }).then(value=>{
        if(job.refs===0){
          this.dispose(value);
          throw job.controller.signal.reason;
        }
        job.value=value;
        job.resolve(value);
      }).catch(error=>{
        if(this.live.get(job.key)===job)this.live.delete(job.key);
        job.reject(error);
      }).finally(()=>{this.running--;this.pump();});
    }
  }

  acquire(key){
    let job=this.live.get(key);
    if(!job){
      job={key,refs:0,controller:new AbortController()};
      job.ready=new Promise((resolve,reject)=>Object.assign(job,{resolve,reject}));
      this.live.set(key,job);
      this.queue.push(job);
    }
    job.refs++;
    this.pump();
    let released=false;
    return {ready:job.ready,release:()=>{
      if(released)return;
      released=true;
      if(--job.refs!==0)return;
      if(this.live.get(key)===job)this.live.delete(key);
      job.controller.abort();
      if(job.value)this.dispose(job.value);
    }};
  }

  stats(accept){
    if(accept){
      const live=[...this.live].filter(([key])=>accept(key)).map(([,job])=>job);
      const binary=[...this.binary].filter(([key])=>accept(key));
      const transferred=[...this.downloaded].filter(([key])=>accept(key)).map(([,data])=>data);
      return {downloads:transferred.reduce((sum,data)=>sum+data.downloads,0),
        decodedActive:live.filter(job=>job.value).length,pending:live.filter(job=>!job.value).length,
        queued:this.queue.filter(job=>accept(job.key)).length,
        cacheHits:[...this.hitsByKey].reduce((sum,[key,count])=>sum+(accept(key)?count:0),0),
        cacheEntries:binary.length,cachedBytes:binary.reduce((sum,[,data])=>sum+data.byteLength,0),
        downloadedPayloadBytes:transferred.reduce((sum,data)=>sum+data.bytes,0)};
    }
    return {downloads:this.downloads,decodedActive:[...this.live.values()].filter(job=>job.value).length,
      pending:this.running,queued:this.queue.length,cacheHits:this.hits,cacheEntries:this.binary.size,
      cachedBytes:this.cachedBytes,downloadedPayloadBytes:this.transfers};
  }
}
