import {seeded} from './geo.js';

// Local compositions in metres. Each sector keeps lawns and circulation open
// by putting planting on selected banks rather than filling its bounding box.
export const corridorPlantings=[
  {id:'arrival-planting',bounds:[-75,-84,49,40],trees:[[-26,-64],[-34,-72],[-46,-77],[35,-35],[44,-22],[47,5],[-20,14],[-31,24]],
    beds:[[-21,-69],[-28,-46],[32,-37],[36,-8],[-18,14],[-25,29]]},
  {id:'sports-path-planting',bounds:[-33,36,70,175],trees:[[-11,54],[-17,68],[-8,95],[-15,111],[55,118],[60,132],[58,158]],
    beds:[[-4,63],[16,95],[47,101],[43,133],[60,154],[18,165]]},
  {id:'courts-bank-planting',bounds:[14,147,126,249],trees:[[73,166],[84,162],[96,171],[103,177],[112,197],[107,219],[95,226],[72,228],[62,235]],
    beds:[[42,171],[56,172],[71,170],[82,183],[82,205],[47,213],[65,212],[80,219],[94,219],[16,195]]},
  {id:'west-bank-planting',bounds:[-235,513,-125,663],trees:[[-192,527],[-204,535],[-146,552],[-151,578],[-206,600],[-220,615],[-211,636]],
    beds:[[-179,526],[-156,551],[-190,572],[-204,601],[-162,608],[-183,652]]},
  {id:'cherry-trail-planting',bounds:[-251,625,-140,789],trees:[[-225,657],[-228,674],[-156,678],[-149,694],[-244,724],[-238,745]],
    beds:[[-209,656],[-184,668],[-208,695],[-219,711],[-171,719],[-215,740],[-222,758],[-164,771]],spring:true},
  {id:'cafe-lawn-planting',bounds:[-151,728,-65,819],trees:[[-124,735],[-117,744],[-137,754],[-134,810],[-102,812]],
    beds:[[-123,758],[-131,775],[-119,794],[-103,799],[-85,803],[-74,786]],spring:true},
];

export function plantedPatches(centers,clear,quality){
  return centers.flatMap(([x,z])=>{
    const random=seeded(Math.abs(Math.round(x*97+z*43)));
    const count=quality==='high'?18:11;
    return Array.from({length:count},()=>{
      const angle=random()*Math.PI*2, radius=Math.sqrt(random())*4.8;
      return {x:x+radius*Math.cos(angle),z:z+radius*Math.sin(angle),
        angle,scale:.57+random()*.64,tone:random()};
    }).filter(p=>clear([p.x,p.z],.72));
  });
}
