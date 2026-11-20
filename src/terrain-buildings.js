import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Generic context buildings share one draw call per visible spatial batch.
// Custom landmarks keep their original meshes and material controls.
export function terrainBuildingBatches(scene){
  const chunks=new Map();
  return {
    add(group,point){
      const key=point.map(value=>Math.floor(value/160)).join(':');
      const parts=chunks.get(key)??[];
      chunks.set(key,parts);
      group.updateMatrixWorld(true);
      for(const mesh of group.children){
        const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrixWorld);
        const colors=new Float32Array(geometry.attributes.position.count*3);
        const {r,g,b}=mesh.material.color;
        for(let i=0;i<colors.length;i+=3){colors[i]=r;colors[i+1]=g;colors[i+2]=b;}
        geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
        parts.push(geometry);
        mesh.geometry.dispose();mesh.material.dispose();
      }
    },
    dispose(){
      for(const parts of chunks.values())for(const part of parts)part.dispose();
      chunks.clear();
    },
    attach(){
      const material=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
      for(const parts of chunks.values()){
        const mesh=new THREE.Mesh(mergeGeometries(parts),material);
        mesh.name='terrain-buildings';
        scene.add(mesh);
        for(const part of parts)part.dispose();
      }
      if(!chunks.size)material.dispose();
      chunks.clear();
    },
  };
}
