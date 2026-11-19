import * as THREE from 'three';

// Evidence tap used only by the review scene. Recover centrelines from emitted
// strip triangles and area borders from the actual triangulated meshes.
export function collectRenderedGeometry(){
  const parts=[];
  return {parts,
    strip(feature,mesh,start,end){
      if(!feature.osmId)return;
      mesh.updateWorldMatrix(true,false);
      const vertices=mesh.geometry.getAttribute('position'),a=new THREE.Vector3(),b=new THREE.Vector3();
      const midpoint=(i,j)=>{
        a.fromBufferAttribute(vertices,i);
        b.fromBufferAttribute(vertices,j);
        a.add(b).multiplyScalar(.5).applyMatrix4(mesh.matrixWorld);
        return [a.x,a.z];
      };
      const segments=[];
      for(let i=start;i+5<end;i+=6){
        segments.push([midpoint(i,i+1),midpoint(i+2,i+4)]);
      }
      parts.push({id:feature.osmId,kind:feature.kind,segments});
    },
    polygon(feature,mesh){
      if(!feature.osmId)return;
      mesh.updateWorldMatrix(true,false);
      const {geometry}=mesh,index=geometry.getIndex(),position=geometry.getAttribute('position');
      const edges=new Map(),point=new THREE.Vector3();
      const vertex=i=>index?index.getX(i):i;
      const project=i=>{
        point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
        return [point.x,point.z];
      };
      for(let i=0;i<(index?.count??position.count);i+=3){
        const vertices=[vertex(i),vertex(i+1),vertex(i+2)];
        for(let j=0;j<3;j++){
          const a=vertices[j], b=vertices[(j+1)%3], key=a<b?`${a}:${b}`:`${b}:${a}`;
          if(edges.has(key))edges.get(key).uses++;
          else edges.set(key,{uses:1,a,b});
        }
      }
      const segments=[...edges.values()].filter(edge=>edge.uses===1).map(({a,b})=>[project(a),project(b)]);
      parts.push({id:feature.osmId,kind:feature.kind,segments,
        invalidEdges:[...edges.values()].filter(edge=>edge.uses>2).length});
    },
  };
}
