import {buildNatureCentre} from './nature-centre.js';

const natureCentre={
  id:'high-park:nature-centre',
  label:'High Park Nature Centre',
  region:'high-park',
  dataset:'high-park-north',
  osm:{type:'way',id:43805272},
  geographicAnchor:{lat:43.65126304,lon:-79.46370879},
  detail:{low:'structure',balanced:'facade',high:'grounds'},
  build:buildNatureCentre,
};

// Geographic anchors identify destinations for future interactions. The model
// itself receives the imported feature, so it cannot drift from the footprint.
const landmarks=[natureCentre];

export function findLandmark(world,feature){
  if(world.mode!=='osm'||feature.kind!=='building')return null;
  return landmarks.find(landmark=>landmark.dataset===world.dataset&&
    landmark.osm.type===feature.osmType&&landmark.osm.id===feature.osmId)??null;
}
