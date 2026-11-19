export const cameraSettings={
  distance:7, pitch:.23, minDistance:3.5, maxDistance:24, minPitch:.08, maxPitch:.82,
  yawSensitivity:.006, pitchSensitivity:.003, follow:10, orbit:11, clearanceRecovery:6,
};

export const qualityProfiles={
  low:{pixelRatio:1, details:.32, contact:false},
  balanced:{pixelRatio:1.2, details:.58, contact:true},
  high:{pixelRatio:1.65, details:1, contact:true},
};

export const parkStyle={
  sky:0xf6e4c8, fog:[72,340],
  hemisphere:{sky:0xfff0cc, ground:0x81947e, strength:1.46},
  sun:{color:0xffd1a0, strength:2.36, position:[-70,43,-34]},
  ground:0xaab784, meadow:0x9eb673, woodland:0x819963, water:0x78aaa4,
  trail:0xe4c99c, road:0xb9aaa0, rail:0x947e71, verge:0xbcab79,
  treeLimit:380, detailLimit:1080, treeSpacing:4.2, clusterRadius:19, pathMargin:.45, landmarkClearance:5,
  trees:[
    {shape:'round',height:5.8,width:1.78,depth:1.48,leaf:0x789550},
    {shape:'spire',height:7.4,width:1.25,depth:2.15,leaf:0x53765b},
    {shape:'column',height:7.1,width:1.22,depth:2.0,leaf:0xa0a65c},
    {shape:'spread',height:5.0,width:2.15,depth:1.22,leaf:0xb9a35d},
  ],
};

const widths={motorway:17,trunk:14,primary:12,secondary:10,tertiary:9,residential:7,living_street:5,service:4,pedestrian:5,footway:2.9,cycleway:2.4,path:2.3,track:3,steps:2};
export function pathWidth(feature){
  return feature.kind==='rail'?2.8:(widths[feature.tags?.highway]||3);
}
