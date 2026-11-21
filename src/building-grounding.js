import * as THREE from 'three';
import {pointInPolygon} from './geo.js';

// Maxima of the piecewise-linear HRDEM surface clipped to a footprint occur
// at a footprint vertex, a terrain vertex, or an intersection of their edges.
export function buildingGrade(terrain,points){
  if(!terrain)return {low:0,high:0,legacy:0};
  const elevations=points.map(point=>terrain.at(...point));
  const legacy=Math.min(...elevations);
  if(terrain.width>1&&terrain.height>1){
    const x0=terrain.xAt(0),z0=terrain.zAt(0);
    const dx=terrain.xAt(1)-x0,dz=terrain.zAt(1)-z0;
    const grid=points.map(([x,z])=>[(x-x0)/dx,(z-z0)/dz]);
    for(let i=0;i<grid.length;i++){
      const [x,z]=grid[i],[u,v]=grid[(i+1)%grid.length];
      for(const [from,to] of [[x,u],[z,v],[x+z,u+v]]){
        if(from===to)continue;
        for(let line=Math.ceil(Math.min(from,to));line<=Math.floor(Math.max(from,to));line++){
          const t=(line-from)/(to-from);
          if(t>0&&t<1)elevations.push(terrain.at(x0+(x+(u-x)*t)*dx,z0+(z+(v-z)*t)*dz));
        }
      }
    }
    const xs=grid.map(p=>p[0]),zs=grid.map(p=>p[1]);
    for(let row=Math.max(0,Math.ceil(Math.min(...zs)));row<terrain.height&&row<=Math.max(...zs);row++)
      for(let col=Math.max(0,Math.ceil(Math.min(...xs)));col<terrain.width&&col<=Math.max(...xs);col++)
        if(pointInPolygon([terrain.xAt(col),terrain.zAt(row)],points))elevations.push(terrain.get(col,row));
  }
  return {low:Math.min(...elevations),high:Math.max(...elevations),legacy};
}

const foundationOverlap=.025;
export function buildingPlacement(world,feature){
  const grade=buildingGrade(world.terrain,feature.points);
  const floor=world.legacyGrounding?grade.legacy:grade.high;
  const foundation=Boolean(world.terrain&&!world.legacyGrounding&&grade.high-grade.low>.025);
  return {...grade,floor,bottom:foundation?grade.low-foundationOverlap:floor,foundation};
}

// Local Y is relative to the group's level floor. This mesh can be baked
// by the same spatial batching path as the building walls and roof.
export function addBuildingFoundation(group,points,placement){
  if(!placement.foundation)return;
  const vertices=[],depth=placement.bottom-placement.floor;
  for(let i=0;i<points.length;i++){
    const [x,z]=points[i],[u,v]=points[(i+1)%points.length];
    if(x===u&&z===v)continue;
    vertices.push(x,depth,z,u,depth,v,x,0,z,u,depth,v,u,0,v,x,0,z);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  const material=new THREE.MeshLambertMaterial({color:0x82776b,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='building-foundation';group.add(mesh);
}
