import * as THREE from 'three';
const standard = (c,r=.96) => new THREE.MeshStandardMaterial({color:c,roughness:r});
function mesh(geo,mat,parent,x,y,z,sx=1,sy=1,sz=1){ const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true; parent.add(m);return m; }
export function createCharacter(scene) {
  const root=new THREE.Group(); scene.add(root);
  const skin=standard(0xf4c6a9), hair=standard(0x232129), coat=standard(0xf2eee2), red=standard(0xa45056), shoes=standard(0x383544);
  const body=new THREE.Group(); root.add(body);
  mesh(new THREE.CylinderGeometry(.30,.24,.84,9),coat,body,0,1.26,0);
  mesh(new THREE.CylinderGeometry(.26,.39,.47,10),red,body,0,.75,0);
  mesh(new THREE.SphereGeometry(.24,12,10),skin,body,0,2.05,0);
  mesh(new THREE.SphereGeometry(.249,12,10,0,Math.PI*2,0,Math.PI*.57),hair,body,0,2.13,0);
  mesh(new THREE.SphereGeometry(.19,10,8),hair,body,0,1.95,.19,1.15,1.36,.78);
  mesh(new THREE.SphereGeometry(.146,8,6),hair,body,0,1.86,.28,.82,1.36,.7);
  const leftArm=new THREE.Group();leftArm.position.set(-.325,1.56,0);body.add(leftArm);
  const rightArm=new THREE.Group();rightArm.position.set(.325,1.56,0);body.add(rightArm);
  const sleeve=new THREE.CylinderGeometry(.093,.071,.54,7);
  const hand=new THREE.SphereGeometry(.076,7,5);
  for(const arm of [leftArm,rightArm]){
    mesh(sleeve,coat,arm,0,-.25,0);
    mesh(hand,skin,arm,0,-.55,0,.86,1.22,.78);
  }
  const leftLeg=new THREE.Group(),rightLeg=new THREE.Group();
  leftLeg.position.set(-.13,.61,0);rightLeg.position.set(.13,.61,0);body.add(leftLeg,rightLeg);
  const shin=new THREE.CylinderGeometry(.097,.074,.55,7);
  const shoe=new THREE.BoxGeometry(.17,.11,.27);
  for(const leg of [leftLeg,rightLeg]){
    mesh(shin,skin,leg,0,-.26,0);
    mesh(shoe,shoes,leg,0,-.545,-.06);
  }
  // Stylized shadow base (simple geometry, independent of renderer shadows).
  const disc=new THREE.Mesh(new THREE.CircleGeometry(.55,20),new THREE.MeshBasicMaterial({color:0x354c43,transparent:true,opacity:.18,depthWrite:false}));
  disc.rotation.x=-Math.PI/2;disc.position.y=.043;root.add(disc);
  let clock=0,stride=0,cadence=2;
  return {
    root,
    update(dt,speed){
      const blend=1-Math.exp(-12*dt);
      const targetCadence=speed>.1?(speed>6?11:8):2;
      cadence+=(targetCadence-cadence)*blend;
      stride+=(Math.min(.55,speed*.085)-stride)*blend;
      clock+=dt*cadence;
      const swing=Math.sin(clock)*stride;
      leftLeg.rotation.x=swing;rightLeg.rotation.x=-swing;
      leftArm.rotation.x=-swing*.68;rightArm.rotation.x=swing*.68;
      body.position.y=Math.abs(swing)*.095;
      body.rotation.y=swing*.12;

    }
  };
}
