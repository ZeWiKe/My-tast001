import { compatibilityMode } from './product-content.js';
const fields=['dimensions','power','weight','battery','material','protection','accessory'];
export const LEGACY_KEY='tag-studio-details-v1';
const originalKey='tag-studio-legacy-original-v1',migratedKey='tag-studio-migrated-v2';
export function legacyMap(input){
  const result={};const entries=Array.isArray(input?.products)?input.products:Array.isArray(input)?input:Object.entries(input||{}).map(([id,p])=>({...p,id:p?.id||id}));
  for(const p of entries){if(!p||typeof p!=='object')continue;const id=String(p.id||p.name||'').replace(/^Tag/i,'');if(/^[A-Za-z0-9][A-Za-z0-9_-]{0,29}$/.test(id))result[id]=p;}return result;
}
export function mergeRecoveredProduct(current,stored){
  const p=structuredClone(current),changed=[];if(!stored)return {product:p,changed};const unpublished=!Number(current._revision);
  for(const key of fields)if(typeof stored[key]==='string'&&stored[key].trim()&&(unpublished||!String(current[key]||'').trim())){if(p[key]!==stored[key]){p[key]=stored[key].slice(0,160);changed.push(key);}}
  p.english={...p.english};for(const key of fields)if(typeof stored.english?.[key]==='string'&&stored.english[key].trim()&&(unpublished||!p.english[key])){if(p.english[key]!==stored.english[key]){p.english[key]=stored.english[key].slice(0,240);changed.push('english.'+key);}}
  const mode=compatibilityMode(stored);if(mode!=='unknown'&&(unpublished||compatibilityMode(current)==='unknown')&&mode!==compatibilityMode(current)){p.compatibility=mode;changed.push('compatibility');}
  if(unpublished&&stored.view){const view=['F1','13'].includes(p.id)&&current.hangingHoleUp&&!stored.hangingHoleUp?{...stored.view,yaw:0,pitch:0,roll:0}:stored.view;if(JSON.stringify(view)!==JSON.stringify(current.view)){p.view={...current.view,...view};changed.push('view');}}
  return {product:p,changed};
}
export function backupCatalog(storage,catalog){
  try{if(!catalog.products.some(p=>fields.some(key=>key!=='material'&&String(p[key]||'').trim())||p.specifications?.some(row=>!row.field&&String(row.value||'').trim())))return;
    const snapshots=JSON.parse(storage.getItem('tag-studio-data-backups-v1')||'[]'),content=JSON.stringify(catalog);
    if(snapshots[0]?.content===content)return;snapshots.unshift({at:new Date().toISOString(),content});storage.setItem('tag-studio-data-backups-v1',JSON.stringify(snapshots.slice(0,8)));
  }catch{/* A failed local backup does not block a durable website save. */}
}
export async function recoverLegacy(catalog,{storage=localStorage,request=fetch}={}){
  const report={recovered:0,synced:0,pending:0};let saved,markers,source;
  try{source=storage.getItem(LEGACY_KEY)||storage.getItem(originalKey);if(!source)return report;saved=legacyMap(JSON.parse(source));}catch{return report;}
  try{markers=JSON.parse(storage.getItem(migratedKey)||'{}');if(!markers||typeof markers!=='object')markers={};}catch{markers={};}
  try{if(!storage.getItem(originalKey))storage.setItem(originalKey,source);}catch{/* The original legacy key is retained even when backup storage is full. */}
  for(let i=0;i<catalog.products.length;i++){
    const current=catalog.products[i],stored=saved[current.id];if(!stored)continue;const fingerprint=JSON.stringify(stored);if(markers[current.id]===fingerprint)continue;
    let {product,changed}=mergeRecoveredProduct(current,stored);if(!changed.length){markers[current.id]=fingerprint;continue;}
    report.recovered++;
    try{
      let response=await request('/api/products/'+current.id,{method:'PUT',headers:{'Content-Type':'application/json','X-Studio-Request':'1'},body:JSON.stringify(product)});
      if(response.status===409){const live=await request('/api/catalog',{cache:'no-store'});if(!live.ok)throw new Error('reload failed');const latest=(await live.json()).products.find(p=>p.id===current.id);({product,changed}=mergeRecoveredProduct(latest,stored));if(!changed.length){catalog.products[i]=latest;markers[current.id]=fingerprint;continue;}response=await request('/api/products/'+current.id,{method:'PUT',headers:{'Content-Type':'application/json','X-Studio-Request':'1'},body:JSON.stringify(product)});}
      if(!response.ok)throw new Error('save failed');catalog.products[i]=await response.json();markers[current.id]=fingerprint;report.synced++;
    }catch{catalog.products[i]=product;report.pending++;}
  }
  try{storage.setItem(migratedKey,JSON.stringify(markers));}catch{}
  backupCatalog(storage,catalog);return report;
}
