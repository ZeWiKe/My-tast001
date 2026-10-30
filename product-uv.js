// Triangle projections avoid stretching around the side wall and hanging hole.
export function productUVs(position,normal,count){
  const uv=new Float32Array(count*2);
  for(let i=0;i<count;i+=3){
    const n=[0,0,0];for(let j=0;j<3;j++){const v=normal(i+j);for(let k=0;k<3;k++)n[k]+=v[k];}
    const axis=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
    for(let j=0;j<3;j++){const p=position(i+j);const a=axis===0?2:0,b=axis===1?2:1;uv[(i+j)*2]=(p[a]+1.5)/3;uv[(i+j)*2+1]=(p[b]+1.5)/3;}
  }
  return uv;
}
