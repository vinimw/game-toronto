import * as THREE from 'three';
import {pointInPolygon} from './geo.js';
import {worldUVs} from './park-surfaces.js';

export function createTerrain(data,bbox,bboxWgs84){
  const {width,height,heightsCm,zeroMeters}=data??{};
  if(data?.version!==1||!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||
    width*height>100000||!Array.isArray(heightsCm)||heightsCm.length!==width*height||
    !heightsCm.every(v=>Number.isInteger(v)&&v>=0&&v<=40000)||!Number.isFinite(zeroMeters)||
    !/^[a-f0-9]{64}$/.test(data.sourceSha256??'')||JSON.stringify(data.bboxWgs84)!==JSON.stringify(bboxWgs84))
    throw new Error('Modelo de terreno incompleto ou incompatível com o recorte OSM.');
  const [west,north,east,south]=bbox;
  const dx=(east-west)/(width-1),dz=(south-north)/(height-1);
  const get=(col,row)=>heightsCm[row*width+col]/100-zeroMeters;
  const xAt=col=>west+col*dx,zAt=row=>north+row*dz;
  function at(x,z){
    const col=Math.min(width-1,Math.max(0,(x-west)/dx));
    const row=Math.min(height-1,Math.max(0,(z-north)/dz));
    const i=Math.min(width-2,Math.floor(col)),j=Math.min(height-2,Math.floor(row));
    const u=col-i,v=row-j;
    const a=get(i,j),b=get(i+1,j),c=get(i,j+1),d=get(i+1,j+1);
    return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  }
  function waterLevel(points){
    const xs=points.map(point=>point[0]),zs=points.map(point=>point[1]),values=[];
    const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
    for(let i=Math.max(0,Math.ceil((minX-west)/dx));i<width&&xAt(i)<=maxX;i++){
      for(let j=Math.max(0,Math.ceil((minZ-north)/dz));j<height&&zAt(j)<=maxZ;j++)
        if(pointInPolygon([xAt(i),zAt(j)],points))values.push(get(i,j));
    }
    values.sort((a,b)=>a-b);
    return (values[Math.floor(values.length/2)]??at(...points[0]))+.045;
  }
  return {at,get,xAt,zAt,width,height,waterLevel};
}

export function addTerrainChunks(scene,terrain,areas,style,texture){
  const material=new THREE.MeshLambertMaterial({map:texture,vertexColors:true});
  const base=new THREE.Color(style.ground),grass=new THREE.Color(style.meadow);
  const wood=new THREE.Color(style.woodland),sport=new THREE.Color(0x8a9d69);
  const regions=areas.filter(f=>f.kind==='sport'||['grass','forest','meadow'].includes(f.tags.landuse)||
    f.tags.natural==='wood'||f.tags.leisure==='garden').map(f=>{
    const xs=f.points.map(p=>p[0]),zs=f.points.map(p=>p[1]);
    return {points:f.points,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs),
      color:f.kind==='sport'?sport:f.tags.natural==='wood'||f.tags.landuse==='forest'?wood:grass};
  });
  const step=32;
  for(let row=0;row<terrain.height-1;row+=step)for(let col=0;col<terrain.width-1;col+=step){
    const rows=Math.min(step,terrain.height-1-row),cols=Math.min(step,terrain.width-1-col);
    const positions=[],colors=[],indices=[];
    const near=regions.filter(f=>f.minX<=terrain.xAt(col+cols)&&f.maxX>=terrain.xAt(col)&&
      f.minZ<=terrain.zAt(row+rows)&&f.maxZ>=terrain.zAt(row));
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const x=terrain.xAt(col+i),z=terrain.zAt(row+j);
      positions.push(x,terrain.get(col+i,row+j),z);
      const color=near.find(f=>x>=f.minX&&x<=f.maxX&&z>=f.minZ&&z<=f.maxZ&&pointInPolygon([x,z],f.points))?.color??base;
      colors.push(color.r,color.g,color.b);
      if(j<rows&&i<cols){
        const a=j*(cols+1)+i,c=a+cols+1;
        indices.push(a,c,a+1,a+1,c,c+1);
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();worldUVs(geometry,false,true);
    const mesh=new THREE.Mesh(geometry,material);mesh.name='terrain-chunk';scene.add(mesh);
  }
}

export function densify(points,maxLength=2){
  const output=[points[0]];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/maxLength);
    for(let j=1;j<=steps;j++)output.push(j===steps?b:[a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps]);
  }
  return output;
}
