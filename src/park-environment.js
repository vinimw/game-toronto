import {latLonToLocal,nearestOnPath} from './geo.js';
import {parkStyle,realParkStyle} from './visual-settings.js';

// The offsets are scenic composition in metres from a verified sidewalk
// anchor. They are intentionally distinct from surveyed tree locations.
export const westRoadSakura={
  id:'west-road-sakura',
  anchor:{lat:43.65200405,lon:-79.46581113,pathId:174188399},
  trees:[
    [-9,-18,1.04],[-16,-12,.81],[-7,-5,1.16],[-14,2,.97],
    [-9,9,1.04],[-23,11,.91],[-16,18,1.11],[-24,24,.85],[-29,32,1],
    [18,-14,.87],[14,-4,1.13],[9,8,.94],[17,10,.78],[6,18,.89],
  ],
};

export const environmentPresets={
  'toronto-default':{style:parkStyle},
  'high-park-default':{style:realParkStyle},
  'high-park-sakura':{
    grove:westRoadSakura,
    style:{
      ...realParkStyle,
      sky:0xeee8db,
      hemisphere:{sky:0xfff5e8,ground:0x849276,strength:1.31},
      sun:{...realParkStyle.sun,color:0xffe0be,strength:2.36},
      ground:0xa0b47f,meadow:0x9db77b,woodland:0x879c70,
      trail:0xcfb78d,paved:0xbab6ac,
    },
  },
};
const demo={id:'demo',style:parkStyle};

export function parkEnvironment(world){
  const id=world.environment??(world.dataset==='high-park-north'?'high-park-sakura':
    world.mode==='osm'?'high-park-default':null);
  const preset=environmentPresets[id];
  if(!preset||world.mode!=='osm'&&id!=='toronto-default')return demo;
  return {id,...preset};
}

export function grovePosition(world,{anchor}){
  const projected=latLonToLocal(anchor.lat,anchor.lon,world.origin);
  const match=nearestOnPath(projected,world.features,feature=>feature.kind==='path'&&feature.osmId===anchor.pathId);
  return match.dist<=2?match.point:null;
}
