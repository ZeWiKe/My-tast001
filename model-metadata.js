import {FINISHES,validHex} from './appearance.js';
export function modelId(value){
  let id=String(value||'').trim().replace(/^tag/i,'').toUpperCase();
  if(/^\d{1,2}$/.test(id))id=id.padStart(2,'0');
  if(!/^[A-Z0-9][A-Z0-9_-]{0,29}$/.test(id))throw new Error('型号请使用字母、数字、短横线或下划线。');
  return id;
}
export function cleanParts(input){
  if(!Array.isArray(input)||!input.length||input.length>64)throw new Error('请选择 1–64 个外观部件。');
  const keys=new Set();return input.map(p=>{
    if(!/^[A-Za-z0-9_.-]{1,100}$/.test(p.key)||keys.has(p.key))throw new Error('部件标识重复或无效。');keys.add(p.key);
    return {key:p.key,label:String(p.label||p.key).slice(0,70),defaultFinish:FINISHES[p.defaultFinish]?p.defaultFinish:'matte',...(validHex(p.defaultColor)?{defaultColor:p.defaultColor}:{}),colorLinked:p.colorLinked!==false};
  });
}
export function checkGlb(buffer,parts){
  const bytes=new Uint8Array(buffer),v=new DataView(buffer);
  if(bytes.length<28||v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==bytes.length)throw new Error('模型文件无效，请重新导入。');
  const n=v.getUint32(12,true);if(n>2*1024*1024||20+n>bytes.length||v.getUint32(16,true)!==0x4e4f534a)throw new Error('模型结构无法识别。');
  const doc=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+n)));
  if(!doc.scenes?.length||!doc.meshes?.length||!doc.buffers?.length)throw new Error('模型没有可展示的外观。');
  if(doc.buffers.some(b=>b.uri)||(doc.images||[]).some(i=>i.uri&&!/^data:image\//.test(i.uri)))throw new Error('模型必须包含所有素材，不能引用外部文件。');
  const materialKeys=new Set((doc.materials||[]).map(m=>m.name));
  if(parts.some(p=>!materialKeys.has(p.key))||materialKeys.size!==parts.length)throw new Error('模型部件与材质分区不匹配。');
  for(const m of doc.meshes)for(const primitive of m.primitives||[])if(!parts.some(p=>p.key===doc.materials?.[primitive.material]?.name))throw new Error('模型含有未选中的部件。');
  return doc;
}
