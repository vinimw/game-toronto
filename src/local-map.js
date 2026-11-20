export function drawLocalMap(canvas,world,portals,position,memories=[]){
  const {width,height}=canvas.getBoundingClientRect();
  if(!width||!height)return;
  const ratio=Math.min(devicePixelRatio,2);
  canvas.width=Math.round(width*ratio);
  canvas.height=Math.round(height*ratio);
  const ctx=canvas.getContext('2d');
  ctx.scale(canvas.width/width,canvas.height/height);

  const [west,north,east,south]=world.bbox;
  const padding=17;
  const scale=Math.max(.01,Math.min((width-2*padding)/(east-west),(height-2*padding)/(south-north)));
  const xy=([x,z])=>[width/2+(x-(west+east)/2)*scale,height/2+(z-(north+south)/2)*scale];
  ctx.fillStyle='#e8ebd9';ctx.fillRect(0,0,width,height);
  const [left,top]=xy([west,north]),[right,bottom]=xy([east,south]);
  ctx.fillStyle='#dce2cd';ctx.fillRect(left,top,right-left,bottom-top);
  ctx.save();
  ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
  const fills={green:'#b7cb9b',water:'#9dc9c7',building:'#baaa97'};
  for(const kind of ['green','water','building','path','rail']){
    for(const feature of world.features){
      if(feature.kind!==kind||!feature.points.length)continue;
      ctx.beginPath();
      feature.points.forEach((point,i)=>{
        const [x,y]=xy(point);
        if(i)ctx.lineTo(x,y);
        else ctx.moveTo(x,y);
      });
      if(fills[kind]){
        ctx.closePath();ctx.fillStyle=fills[kind];ctx.fill();
      }else{
        ctx.lineJoin='round';ctx.lineCap='round';
        ctx.strokeStyle=kind==='rail'?'#a18b78':'#fcf7e6';
        ctx.lineWidth=['primary','secondary','residential'].includes(feature.tags?.highway)?3:1.4;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
  ctx.strokeStyle='#9faa90';ctx.lineWidth=1;ctx.strokeRect(left,top,right-left,bottom-top);

  function marker(point,{color,radius,square=false,offset=0}){
    const [x,y]=xy(point),at=Math.max(radius+2,Math.min(width-radius-2,x+offset));
    const row=Math.max(radius+2,Math.min(height-radius-2,y));
    if(offset){
      ctx.strokeStyle=color;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(at,row);ctx.stroke();
    }
    ctx.beginPath();
    if(square)ctx.rect(at-radius,row-radius,2*radius,2*radius);
    else ctx.arc(at,row,radius,0,Math.PI*2);
    ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#fffaf0';ctx.lineWidth=2;ctx.stroke();
  }
  const close=(a,b,pixels)=>Math.hypot(a[0]-b[0],a[1]-b[1])*scale<pixels;
  for(const portal of portals)marker(portal.position,{color:'#9b6b2f',radius:5,square:true,
    offset:close(portal.position,position,18)?17:0});
  for(const point of memories)marker(point,{color:'#b95164',radius:5,
    offset:close(point,position,18)||portals.some(portal=>close(portal.position,point,14))?-17:0});
  marker(position,{color:'#274c40',radius:7});
  ctx.fillStyle='#354639';ctx.font='700 12px system-ui';ctx.textAlign='right';ctx.fillText('↑ N',width-8,15);
}
