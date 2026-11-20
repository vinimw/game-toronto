export const cameraSettings={
  cameraFollowMode:'stable',
  distance:7, pitch:.23, minDistance:3.5, maxDistance:24, minPitch:.08, maxPitch:.82,
  yawSensitivity:.006, pitchSensitivity:.003, orbit:11, clearanceRecovery:6,
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

const realTrailWidths={footway:1.5,path:1.55,track:2.2,steps:1.6,cycleway:2.05,corridor:1.65};

function mappedWidth(value){
  if(typeof value!=='string'||!/^\s*\d+(?:\.\d+)?\s*m?\s*$/.test(value))return null;
  const metres=parseFloat(value);
  return metres>=.45&&metres<=30?metres:null;
}

// Presentation widths in metres. The importer and navigation retain their own data.
export function realPathAppearance(feature){
  const {highway,footway,surface,width,est_width:estimated}=feature.tags??{};
  const measured=mappedWidth(width)??mappedWidth(estimated);
  if(feature.kind==='rail')return {width:pathWidth(feature),surface:'rail'};
  if(highway==='footway'&&footway==='crossing')return {width:measured??1.45,surface:'paved',crossing:true};
  if(Object.hasOwn(realTrailWidths,highway)||highway==='pedestrian'){
    const hard=surface?['asphalt','concrete','paved','paving_stones'].includes(surface):footway==='sidewalk';
    const fallback=footway==='sidewalk'?1.6:(realTrailWidths[highway]??3.3);
    return {width:measured??fallback,surface:hard?'paved':'trail',shoulder:hard?.14:.32};
  }
  return {width:measured??(highway==='unclassified'?4.5:pathWidth(feature)),surface:'road'};
}

// Art direction for the OSM region. None of these values define map geometry.
export const realParkStyle={
  ...parkStyle,
  sky:0xf3e2c8, fog:[62,267],
  hemisphere:{sky:0xffefd8,ground:0x748470,strength:1.23},
  sun:{color:0xffd6ac,strength:2.45,position:[-65,40,-54]},
  ground:0x9baa7a, meadow:0x99ab6d, woodland:0x829266,
  trail:0xcdb389, paved:0xb9b3a6, road:0xa3a099,
  contactOpacity:{low:0,balanced:.36,high:.44},
  treeLimit:490, detailLimit:2120, treeSpacing:3.65,
  trees:[
    {shape:'round',height:6.3,width:2.16,depth:1.57,leaf:0x77934c},
    {shape:'spire',height:7.6,width:1.30,depth:1.98,leaf:0x506f53},
    {shape:'column',height:7.7,width:1.31,depth:1.91,leaf:0x95a059},
    {shape:'spread',height:6.6,width:2.31,depth:1.34,leaf:0x718c4d},
    {shape:'spread',height:3.65,width:1.49,depth:.95,leaf:0xb5a05d},
    {shape:'round',height:7.8,width:2.02,depth:1.93,leaf:0x657c4c},
  ],
};
export const realParkDetailRadius={low:28,balanced:48,high:82};
