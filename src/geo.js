export function latLonToLocal(lat, lon, origin) {
  const metersPerLon = 111320 * Math.cos(origin.lat * Math.PI / 180);
  return [(lon - origin.lon) * metersPerLon, -(lat - origin.lat) * 111320];
}
export function pointInPolygon(point, polygon) {
  const [x,z] = point;
  let inside = false;
  for(let i=0,j=polygon.length-1; i<polygon.length; j=i++) {
    const a=polygon[i], b=polygon[j];
    if((a[1]>z)!==(b[1]>z) && x < (b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) inside = !inside;
  }
  return inside;
}
export function nearSegment(p,a,b) {
  const vx=b[0]-a[0], vz=b[1]-a[1]; const n=vx*vx+vz*vz;
  if(n<0.001) return Math.hypot(p[0]-a[0],p[1]-a[1]);
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vz)/n));
  return Math.hypot(p[0]-(a[0]+vx*t),p[1]-(a[1]+vz*t));
}
export function nearestOnPath(point, features, accept = f => f.kind==='path') {
  let best=null, dist=Infinity;
  for(const f of features){
    if(!accept(f)) continue;
    for(let i=1;i<f.points.length;i++) {
      const [a,b]=[f.points[i-1],f.points[i]];
      const dx=b[0]-a[0],dz=b[1]-a[1],n=dx*dx+dz*dz;
      const t=n?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/n)):0;
      const p=[a[0]+t*dx,a[1]+t*dz]; const d=Math.hypot(p[0]-point[0],p[1]-point[1]);
      if(d<dist){dist=d;best=p;}
    }
  }
  return {point:best ?? point,dist};
}
export function seeded(seed=12345) {
  let s=seed>>>0; return () => ((s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296);
}
