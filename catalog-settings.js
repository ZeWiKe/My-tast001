export const LIGHTING_PRESETS=[{value:.8,name:'自然光 · 柔和 80%'},{value:1,name:'自然光 · 标准 100%'},{value:1.2,name:'自然光 · 明亮 120%'}];
export function exposureValue(value){const n=Number(value);if(!Number.isFinite(n)||n<.6||n>1.4)throw new Error('曝光请输入 60%–140%。');return Math.round(n*100)/100;}
export function orderProducts(products,order=[]){
  const baseline=[...products].sort((a,b)=>{const rank=id=>/^F\d+$/i.test(id)?1:0;return rank(a.id)-rank(b.id)||a.id.localeCompare(b.id,'en',{numeric:true});});
  const byId=new Map(baseline.map(p=>[p.id,p])),result=[];for(const id of order)if(byId.has(id)){result.push(byId.get(id));byId.delete(id);}return [...result,...byId.values()];
}
