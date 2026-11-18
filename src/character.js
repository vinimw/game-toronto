import * as THREE from 'three';
const standard = (c,r=.96) => new THREE.MeshStandardMaterial({color:c,roughness:r});
function mesh(geo,mat,parent,x,y,z,sx=1,sy=1,sz=1){ const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true; parent.add(m);return m; }
export function createCharacter(scene) {
  const root=new THREE.Group(); scene.add(root);
  const skin=standard(0xf4c6a9), hair=standard(0x24232d), coat=standard(0xf2eee2), red=standard(0xa45056), shoes=standard(0x383544);
  const body=new THREE.Group(); root.add(body);
  mesh(new THREE.CylinderGeometry(.32,.23,.9,8),coat,body,0,1.23,0);
  mesh(new THREE.CylinderGeometry(.26,.42,.44,9),red,body,0,.75,0);
  mesh(new THREE.SphereGeometry(.24,12,10),skin,body,0,2.05,0);
  mesh(new THREE.SphereGeometry(.249,12,10,0,Math.PI*2,0,Math.PI*.57),hair,body,0,2.13,0);
  mesh(new THREE.SphereGeometry(.19,10,8),hair,body,0,1.93,.18,1.22,1.52,.7);
  const leftArm=new THREE.Group();leftArm.position.set(-.36,1.57,0);body.add(leftArm);
  const rightArm=new THREE.Group();rightArm.position.set(.36,1.57,0);body.add(rightArm);
  mesh(new THREE.CylinderGeometry(.105,.085,.7,7),coat,leftArm,0,-.35,0);
  mesh(new THREE.CylinderGeometry(.105,.085,.7,7),coat,rightArm,0,-.35,0);
  const leftLeg=new THREE.Group();leftLeg.position.set(-.15,.59,0);body.add(leftLeg);
  const rightLeg=new THREE.Group();rightLeg.position.set(.15,.59,0);body.add(rightLeg);
  mesh(new THREE.CylinderGeometry(.105,.09,.56,7),skin,leftLeg,0,-.27,0);
  mesh(new THREE.CylinderGeometry(.105,.09,.56,7),skin,rightLeg,0,-.27,0);
  mesh(new THREE.BoxGeometry(.19,.12,.29),shoes,leftLeg,0,-.57,-.06);
  mesh(new THREE.BoxGeometry(.19,.12,.29),shoes,rightLeg,0,-.57,-.06);
  // Stylized shadow base (simple geometry, independent of renderer shadows).
  const disc=new THREE.Mesh(new THREE.CircleGeometry(.55,20),new THREE.MeshBasicMaterial({color:0x354c43,transparent:true,opacity:.18,depthWrite:false}));
  disc.rotation.x=-Math.PI/2;disc.position.y=.019;root.add(disc);
  let clock=0;
  return {
    root,
    update(dt,speed){clock+=dt*(speed>.1?(speed>6?11:8):2); const swing=speed>.1?Math.min(.55,speed*.085):.025;
      leftLeg.rotation.x=Math.sin(clock)*swing;rightLeg.rotation.x=-Math.sin(clock)*swing;
      leftArm.rotation.x=-Math.sin(clock)*swing*.7;rightArm.rotation.x=Math.sin(clock)*swing*.7;
      body.position.y=speed>.1?Math.abs(Math.sin(clock))*.055:Math.sin(clock)*.02;
    }
  };
}
