// Deterministic, tileable flecks: colored resin stays smooth; inclusions vary in shape.
export function specklePixels(hex,{density=.65,scale=1,contrast=.55}={},size=1024){
  const base=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),bytes=new Uint8Array(size*size*4);
  for(let i=0;i<bytes.length;i+=4){bytes[i]=base[0];bytes[i+1]=base[1];bytes[i+2]=base[2];bytes[i+3]=255;}
  let seed=71839;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const dark=(base[0]*.2126+base[1]*.7152+base[2]*.0722)<85;
  const target=dark?[160,164,157]:[Math.max(55,base[0]*.55),Math.max(45,base[1]*.51),Math.max(40,base[2]*.48)];
  for(let k=0;k<Math.round(2100*density);k++){
    const cx=random()*size,cy=random()*size,r=(1.2+random()*2.7)*scale,angle=random()*Math.PI*2,stretch=.45+random()*.9,alpha=(.25+random()*.55)*contrast;
    for(let y=-Math.ceil(r*1.6);y<=Math.ceil(r*1.6);y++)for(let x=-Math.ceil(r*1.6);x<=Math.ceil(r*1.6);x++){
      const u=(x*Math.cos(angle)-y*Math.sin(angle))/r,v=(x*Math.sin(angle)+y*Math.cos(angle))/(r*stretch),d=Math.hypot(u,v);
      const edge=.76+.15*Math.sin(Math.atan2(v,u)*5+k);if(d>edge)continue;
      const a=alpha*Math.min(1,(edge-d)*5)*(.5+random()*.5),px=(Math.floor(cx+x)+size)%size,py=(Math.floor(cy+y)+size)%size,i=(py*size+px)*4;
      for(let c=0;c<3;c++)bytes[i+c]=Math.round(base[c]*(1-a)+target[c]*a);
    }
  }
  return {bytes,width:size,height:size};
}
