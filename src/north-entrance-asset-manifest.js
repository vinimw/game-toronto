export const entranceMaterialFiles={asphalt:'asphalt_track',pavement:'concrete_pavement',masonry:'stone_wall',grass:'grass_medium_01'};
export const entranceTreeVariants=['maple-43','maple-79','oak-31','oak-67'];
export const entranceModels=['north-gate',...entranceTreeVariants.flatMap(variant=>['high','balanced'].map(lod=>variant+'-'+lod))];
const surfaceFiles=Object.values(entranceMaterialFiles).flatMap(name=>['Diffuse','nor_gl','arm'].map(kind=>name+'-'+kind+'.jpg'));
export const entranceDependencies=[...entranceModels.map(name=>name+'.glb'),...surfaceFiles];

