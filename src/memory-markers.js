import * as THREE from 'three';

export function addMemoryMarkers(scene,points){
  const markers=[];
  for(const {memory,position:[x,z]} of points){
    if(memory.visual!=='glow')continue;
    const marker=new THREE.Group();
    marker.name='memory:'+memory.id;
    marker.position.set(x,0,z);
    const core=new THREE.Mesh(new THREE.OctahedronGeometry(.16),
      new THREE.MeshBasicMaterial({color:0xffeda6}));
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.68,.027,6,28),
      new THREE.MeshBasicMaterial({color:0xffe09b,transparent:true,opacity:.65,depthWrite:false}));
    core.position.y=.95;
    ring.rotation.x=-Math.PI/2;ring.position.y=.045;
    marker.add(ring,core);
    scene.add(marker);
    markers.push({core,ring});
  }
  return time=>{
    for(const {core,ring} of markers){
      core.position.y=.95+Math.sin(time*1.7)*.09;
      core.rotation.y=time*.65;
      ring.material.opacity=.53+Math.sin(time*1.7)*.12;
    }
  };
}
