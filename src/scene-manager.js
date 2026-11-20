import * as THREE from 'three';
import {latLonToLocal} from './geo.js';
import {createWalkTest, finitePoint} from './movement.js';
import {collectResources, disposeScene} from './scene-resources.js';

function localPoint(geo, origin) {
  if(!geo || !origin || ![geo.lat,geo.lon,origin.lat,origin.lon].every(Number.isFinite) ||
    Math.abs(geo.lat)>90 || Math.abs(geo.lon)>180 || Math.abs(origin.lat)>90 || Math.abs(origin.lon)>180) {
    throw new Error('Invalid geographic anchor');
  }
  return latLonToLocal(geo.lat,geo.lon,origin);
}

export class SceneManager {
  constructor({manifest,loadRegion,buildScene,avatar,sharedResources=[],onBusy=()=>{},onProgress=()=>{},fade=async()=>{},onActivate=()=>{}}) {
    Object.assign(this,{manifest,loadRegion,buildScene,avatar,onBusy,onProgress,fade,onActivate});
    this.sharedResources=new Set([...collectResources(avatar.root),...sharedResources]);
    this.active=null;this.loading=false;
    const ids=new Set();
    for(const [id,region] of Object.entries(manifest)){
      if(region.id!==id)throw new Error(`Region ID mismatch: ${id}`);
      for(const portal of region.portals){
        if(!portal.id || ids.has(portal.id))throw new Error(`Duplicate or missing portal ID: ${portal.id}`);
        ids.add(portal.id);
      }
    }
  }

  prepare(id,entryId,world) {
    const definition=this.manifest[id],entry=definition?.entries[entryId];
    if(!definition || !entry)throw new Error(`Unknown region entry: ${id}/${entryId}`);
    if(!Number.isFinite(entry.yaw??0))throw new Error('Invalid entry heading');
    const spawn=localPoint(entry.geo,world.origin);
    if(!finitePoint(world.bbox) || world.bbox.length!==4 || world.bbox[0]>=world.bbox[2] || world.bbox[1]>=world.bbox[3] || !Array.isArray(world.features))throw new Error('Invalid region data');
    const canWalk=createWalkTest(world.features,world.bbox);
    if(!canWalk(...spawn))throw new Error(`Obstructed region entry: ${id}/${entryId}`);
    const portals=definition.portals.map(portal=>{
      if(!this.manifest[portal.target.region]?.entries[portal.target.entry])throw new Error(`Invalid portal target: ${portal.id}`);
      const position=localPoint(portal.geo,world.origin);
      if(!canWalk(...position) || !Number.isFinite(portal.radius) || !(portal.radius>0))throw new Error(`Invalid portal: ${portal.id}`);
      return {...portal,position};
    });
    return {id,entryId,world,portals,spawn,yaw:entry.yaw??0};
  }

  create(prepared) {
    const scene=new THREE.Scene();
    scene.name=`region:${prepared.id}`;
    try {
      const stats=this.buildScene(scene,prepared.world,prepared.portals);
      return {...prepared,scene,stats};
    } catch(error) {
      disposeScene(scene,this.sharedResources);
      throw error;
    }
  }

  activate(instance,position=instance.spawn,yaw=instance.yaw) {
    instance.scene.add(this.avatar.root);
    this.avatar.root.position.set(position[0],0,position[1]);
    this.avatar.root.rotation.set(0,yaw,0);
    this.active=instance;
    this.onActivate(instance);
  }

  unload() {
    if(!this.active)return;
    this.avatar.root.removeFromParent();
    this.active.stats.streaming?.dispose();
    disposeScene(this.active.scene,this.sharedResources);
    this.active=null;
  }

  async load(id,entryId) {
    if(this.loading)return false; // No overlapping transitions or double taps.
    const definition=this.manifest[id];
    if(!definition?.entries[entryId])throw new Error(`Unknown region entry: ${id}/${entryId}`);
    this.loading=true;
    let previous=null;
    try {
      this.onBusy(true);
      await this.fade(true,definition.name);
      // Keep the old scene for recoverable data/validation errors. Only data,
      // never a second GPU scene, is prepared while it remains alive.
      this.onProgress('Dados geográficos');
      const prepared=this.prepare(id,entryId,await this.loadRegion(definition,this.onProgress));
      if(this.active)previous={prepared:this.active,position:[this.avatar.root.position.x,this.avatar.root.position.z],yaw:this.avatar.root.rotation.y};
      this.onProgress('Terreno e navegação');
      this.unload();
      let destination;
      try {
        destination=this.create(prepared);
        if(prepared.world.streamingEager)await destination.stats.streaming?.prime();
        this.activate(destination);
      } catch(error) {
        if(destination&&this.active!==destination){
          destination.stats.streaming?.dispose();
          disposeScene(destination.scene,this.sharedResources);
        }
        this.unload();
        // Rebuild the old scene only after partial destination disposal.
        if(previous)this.activate(this.create(previous.prepared),previous.position,previous.yaw);
        throw error;
      }
      return true;
    } finally {
      try {await this.fade(false,definition.name);}
      finally {this.loading=false;this.onBusy(false);}
    }
  }

  nearbyPortal(position) {
    if(this.loading || !finitePoint(position))return null;
    return this.active?.portals.find(p=>Math.hypot(position[0]-p.position[0],position[1]-p.position[1])<p.radius)??null;
  }

  travel(portalId) {
    const portal=this.nearbyPortal([this.avatar.root.position.x,this.avatar.root.position.z]);
    if(!portal || portal.id!==portalId)return Promise.resolve(false);
    return this.load(portal.target.region,portal.target.entry);
  }
}
