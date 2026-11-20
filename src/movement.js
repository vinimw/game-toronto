import {nearSegment, pointInPolygon} from './geo.js';

export const PLAYER_RADIUS = .35;
export const finitePoint = point => Array.isArray(point) && point.length >= 2 && point.every(Number.isFinite);

// X is east, Z is south. The horizontal camera basis stays orthonormal.
export function cameraBasis(yaw){
  const sin=Math.sin(yaw),cos=Math.cos(yaw);
  return {cameraRight:[cos,-sin],cameraForward:[-sin,-cos]};
}

export function normalizeMoveInput(right,forward){
  const magnitude=Math.max(1,Math.hypot(right,forward));
  return [right/magnitude,forward/magnitude];
}

export function projectCameraMovement([x,z],yaw){
  const {cameraRight,cameraForward}=cameraBasis(yaw);
  return [x*cameraRight[0]+z*cameraRight[1],x*cameraForward[0]+z*cameraForward[1]];
}

export function movementDelta(right,forward,yaw,speed,dt) {
  if (![right,forward,yaw,speed,dt].every(Number.isFinite) || dt <= 0 || speed <= 0 || (!right && !forward)) return [0, 0];
  const [x,y]=normalizeMoveInput(right,forward);
  const {cameraRight,cameraForward}=cameraBasis(yaw);
  const distance=speed*Math.min(dt,.05);
  const result=cameraRight.map((value,i)=>(x*value+y*cameraForward[i])*distance);
  return finitePoint(result) ? result : [0,0];
}

export function overlapsPolygon(point, polygon, radius) {
  if (pointInPolygon(point, polygon)) return true;
  return polygon.some((a, i) => nearSegment(point, a, polygon[(i + 1) % polygon.length]) <= radius);
}

export function createWalkTest(features, bbox) {
  const obstacles = features.filter(f => ['water', 'building'].includes(f.kind));
  return (x, z, radius = PLAYER_RADIUS) => Number.isFinite(x) && Number.isFinite(z) && Number.isFinite(radius) && radius >= 0 &&
    x > bbox[0] + radius && x < bbox[2] - radius && z > bbox[1] + radius && z < bbox[3] - radius &&
    !obstacles.some(f => overlapsPolygon([x, z], f.points, radius));
}

// Small steps prevent tunnelling; independent axes allow sliding along walls.
export function movePlayer(position, delta, canWalk, dt) {
  if (!finitePoint(position)) throw new RangeError('Invalid player position');
  if (!finitePoint(delta) || !Number.isFinite(dt) || dt <= 0) return {position: [...position], speed: 0, heading: null};
  const distance = Math.hypot(...delta);
  // Maximum supported running speed: 9 units/s × 5, at a capped 50 ms step.
  // Substep size stays radius/2 regardless of speed (at most 13 steps).
  if (!Number.isFinite(distance) || distance > 2.25 + 1e-9) return {position: [...position], speed: 0, heading: null};
  let [x, z] = position;
  const steps = Math.max(1, Math.ceil(distance / (PLAYER_RADIUS / 2)));
  for (let i = 0; i < steps; i++) {
    if (canWalk(x + delta[0] / steps, z)) x += delta[0] / steps;
    if (canWalk(x, z + delta[1] / steps)) z += delta[1] / steps;
  }
  const dx = x - position[0], dz = z - position[1];
  const executed = Math.hypot(dx, dz);
  return {position: [x, z], speed: executed / dt, heading: executed > 1e-6 ? Math.atan2(-dx, -dz) : null};
}

export function buildingHeight(tags = {}) {
  const height = Number.parseFloat(tags.height);
  const levels = Number.parseFloat(tags['building:levels']);
  return Math.min(42, height > 0 ? height : Math.max(3, (levels > 0 ? levels : 2) * 3.2));
}

const cameraBounds=new WeakMap();
function cameraBoundsOf(obstacle){
  let bounds=cameraBounds.get(obstacle);
  if(!bounds){
    const xs=obstacle.points.map(point=>point[0]),zs=obstacle.points.map(point=>point[1]);
    bounds=[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)];
    cameraBounds.set(obstacle,bounds);
  }
  return bounds;
}

// Sweep a small camera volume from the player toward the smoothed camera.
// Water is intentionally excluded: only raised buildings obstruct the view.
export function resolveCamera(anchor, desired, buildings, radius = .22, trace) {
  if (trace) trace.obstacle = null;
  if (![...anchor, ...desired].every(Number.isFinite)) return [...anchor];
  const delta = desired.map((v, i) => v - anchor[i]);
  const steps = Math.max(1, Math.ceil(Math.hypot(...delta) / .1));
  const candidates=buildings.filter(f=>{
    const [minX,minZ,maxX,maxZ]=cameraBoundsOf(f);
    return minX-radius<=Math.max(anchor[0],desired[0])&&maxX+radius>=Math.min(anchor[0],desired[0])&&
      minZ-radius<=Math.max(anchor[2],desired[2])&&maxZ+radius>=Math.min(anchor[2],desired[2]);
  });
  if(!candidates.length&&Math.min(anchor[1],desired[1])>=radius)return desired;
  let safe = [...anchor];
  for (let i = 1; i <= steps; i++) {
    const point = anchor.map((v, axis) => v + delta[axis] * i / steps);
    const obstacle = candidates.find(f => point[1] <= f.height + radius && point[1] >= (f.minHeight??0)-radius &&
      overlapsPolygon([point[0], point[2]], f.points, radius));
    if (point[1] < radius || obstacle) {
      if (trace) trace.obstacle = obstacle ?? {kind:'ground'};
      break;
    }
    safe = point;
  }
  return safe;
}

export function frameTiming(now, previous) {
  const elapsed = (now - previous) / 1000;
  const real = Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 0;
  return {real, simulation: Math.min(.05, real)};
}

export function frameMetrics(frames, seconds) {
  return seconds > 0 && frames > 0 ? {fps: frames / seconds, milliseconds: seconds * 1000 / frames} : {fps: 0, milliseconds: 0};
}
