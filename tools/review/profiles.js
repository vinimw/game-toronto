export const reviewPipelineVersion='3.6.0';

const mobile={
  viewport:{width:390,height:844},deviceScaleFactor:1,rendererPixelRatio:1,
  quality:'balanced',antialias:false,mobileViewportSimulation:true,
};

export const reviewProfiles={
  desktop:{
    viewport:{width:1280,height:720},deviceScaleFactor:1,rendererPixelRatio:1,
    quality:'high',antialias:true,mobileViewportSimulation:false,
  },
  mobile,
  mobileCompact:{...mobile,viewport:{width:375,height:667}},
};
