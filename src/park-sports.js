import {parkSurfaceFinish} from './park-surface-finish.js';
import * as THREE from 'three';


export const northernSports=[14344501,14344509,14344528,680982127,1116261446,1116261447,1116261448];

export function tennisNets(world){
  return world.features.filter(f=>northernSports.includes(f.osmId)&&f.tags.sport==='tennis'&&f.points.length===5).map(feature=>{
    const ring=feature.points;
    const length=i=>Math.hypot(ring[i][0]-ring[i+1][0],ring[i][1]-ring[i+1][1]);
    const side=length(0)>length(1)?0:1;
    const middle=i=>ring[i].map((x,k)=>(x+ring[(i+1)%4][k])/2);
    return {id:feature.osmId,a:middle(side),b:middle(side+2)};
  });
}

export function tennisBlocks(world){
  return tennisNets(world).map(({id,a,b})=>{
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const nx=(b[1]-a[1])/length*.08,nz=(a[0]-b[0])/length*.08;
    const y=Math.min(world.terrain.at(...a),world.terrain.at(...b));
    return {id:'tennis-net:'+id,kind:'building',minHeight:y,height:y+1.25,
      points:[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]]};
  });
}

export function buildNorthernSports(world){
  const root=new THREE.Group(),chalk=[],clay=[],tennis=[],courtEdges=[];
  root.name='high-park:northern-sports';
  function vertex(out,x,z,y=.065){out.push(x,world.terrain.at(x,z)+y,z);}
  function line(a,b,width=.115){
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length<.02)return;
    const nx=(b[1]-a[1])/length*width/2,nz=(a[0]-b[0])/length*width/2;
    const steps=Math.ceil(length/1.5);
    for(let i=0;i<steps;i++){
      const p=a.map((v,k)=>THREE.MathUtils.lerp(v,b[k],i/steps));
      const q=a.map((v,k)=>THREE.MathUtils.lerp(v,b[k],(i+1)/steps));
      for(const [u,side] of [[p,-1],[p,1],[q,1],[p,-1],[q,1],[q,-1]])
        vertex(chalk,u[0]+nx*side,u[1]+nz*side,.105);
    }
  }
  for(const feature of world.features.filter(f=>northernSports.includes(f.osmId))){
    const ring=feature.points.slice(0,-1);
    const sport=feature.tags.sport;
    if(sport==='baseball'){
      // Two mapped outlines have identifiable foul-line corners. Paint only
      // these infields, with decorative markings inside the surveyed boundary.
      const corners={14344509:[0,1,18],14344528:[14,12,0]}[feature.osmId];
      if(!corners)continue;
      const [home,left,right]=corners.map(i=>ring[i]);
      const direction=point=>{
        const dx=point[0]-home[0],dz=point[1]-home[1],length=Math.hypot(dx,dz);
        return [dx/length,dz/length];
      };
      const u=direction(left),v=direction(right);
      const at=(a,b)=>[home[0]+u[0]*(a+3)+v[0]*(b+3),home[1]+u[1]*(a+3)+v[1]*(b+3)];
      for(let i=0;i<14;i++)for(let j=0;j<14;j++)
        for(const [a,b] of [[0,0],[2,0],[2,2],[0,0],[2,2],[0,2]])
          vertex(clay,...at(i*2+a,j*2+b));
      line(at(0,0),at(48,0));line(at(0,0),at(0,48));
      for(const [a,b] of [[.2,.2],[26,.2],[26,26],[.2,26]]){
        line(at(a-.2,b),at(a+.2,b),.38);
      }
      continue;
    }
    if(ring.length!==4)continue;
    const c=ring.reduce(([x,z],p)=>[x+p[0]/4,z+p[1]/4],[0,0]);
    const inset=ring.map(([x,z])=>[THREE.MathUtils.lerp(x,c[0],.09),THREE.MathUtils.lerp(z,c[1],.09)]);
    const sides=inset.map(([x,z],i)=>Math.hypot(x-inset[(i+1)%4][0],z-inset[(i+1)%4][1]));
    const k=sides[0]>sides[1]?0:1;
    const point=(u,v)=>inset[k].map((_,i)=>THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(inset[k][i],inset[(k+1)%4][i],u),
      THREE.MathUtils.lerp(inset[(k+3)%4][i],inset[(k+2)%4][i],u),v));
    for(let i=0;i<4;i++)line(inset[i],inset[(i+1)%4]);
    line(point(.5,0),point(.5,1));
    if(sport==='tennis'){
      // A flush aggregate surround reads as an edge from the path without
      // inventing a fence, closing entrances or changing court collisions.
      for(let side=0;side<4;side++){
        const next=(side+1)%4;
        const sections=Math.ceil(sides[side]/1.4);
        for(let j=0;j<sections;j++){
          for(const [offset,inner] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){
            const points=inner?inset:ring;
            const p=points[side].map((n,k)=>THREE.MathUtils.lerp(n,points[next][k],(j+offset)/sections));
            vertex(courtEdges,...p,.052);
          }
        }
      }
      for(let u=0;u<10;u++)for(let v=0;v<5;v++)
        for(const [a,b] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]])
          vertex(tennis,...point((u+a)/10,(v+b)/5));
      for(const u of [.25,.75])line(point(u,.14),point(u,.86));
      for(const v of [.14,.86])line(point(0,v),point(1,v));
      line(point(.25,.5),point(.75,.5));
    }else{
      for(const u of [0,1]){
        const inside=u===0?.15:.85;
        line(point(u,.24),point(inside,.24));line(point(inside,.24),point(inside,.76));
        line(point(inside,.76),point(u,.76));
      }
      const anglePoint=i=>point(.5+Math.cos(i*Math.PI/20)*.085,.5+Math.sin(i*Math.PI/20)*.14);
      for(let i=0;i<40;i++)line(anglePoint(i),anglePoint(i+1));
    }
  }
  for(const [values,color] of [[chalk,0xe8e2c7],[clay,0x9b684a],[tennis,0x426d61],[courtEdges,0x83826d]]){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));
    geometry.computeVertexNormals();
    const material=new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide});
    root.add(new THREE.Mesh(geometry,values===chalk?material:parkSurfaceFinish(material,'path',true)));
  }
  const posts=new THREE.MeshStandardMaterial({color:0x42483b,roughness:.63});
  const band=new THREE.MeshStandardMaterial({color:0xe7dfc9,roughness:.84});
  const cord=new THREE.LineBasicMaterial({color:0x333b32,transparent:true,opacity:.72});
  const strings=[];
  const postGeo=new THREE.CylinderGeometry(.035,.042,1.12,7);
  for(const {a,b} of tennisNets(world)){
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const point=(t,h)=>new THREE.Vector3(
      THREE.MathUtils.lerp(a[0],b[0],t),
      THREE.MathUtils.lerp(world.terrain.at(...a),world.terrain.at(...b),t)+h,
      THREE.MathUtils.lerp(a[1],b[1],t));
    for(const t of [0,1]){
      const post=new THREE.Mesh(postGeo,posts);post.position.copy(point(t,.56));root.add(post);
    }
    const heights=t=>1.07-.13*Math.sin(Math.PI*t);
    const divisions=Math.ceil(length/.12);
    for(let i=0;i<=divisions;i++){
      const t=i/divisions;
      strings.push(...point(t,.04).toArray(),...point(t,heights(t)).toArray());
    }
    for(let i=1;i<=9;i++)for(let j=0;j<12;j++){
      for(const t of [j/12,(j+1)/12])strings.push(...point(t,heights(t)*i/10).toArray());
    }
    const rail=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([point(0,1.07),point(.5,.94),point(1,1.07)]),12,.018,4,false);
    root.add(new THREE.Mesh(rail,band));
  }
  const net=new THREE.BufferGeometry();
  net.setAttribute('position',new THREE.Float32BufferAttribute(strings,3));
  root.add(new THREE.LineSegments(net,cord));
  return root;
}
