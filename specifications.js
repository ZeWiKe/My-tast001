import {measurement,translatedField,englishSuggestion,displayName} from './product-content.js';
export const SPEC_FIELDS={name:{label:'产品型号',labelEn:'Model'},weight:{label:'产品重量',labelEn:'Weight'},platform:{label:'支持平台',labelEn:'Compatibility'},battery:{label:'电池规格',labelEn:'Battery'},dimensions:{label:'产品尺寸',labelEn:'Dimensions'},material:{label:'外壳材质',labelEn:'Material'},power:{label:'供电方式',labelEn:'Power source'},protection:{label:'防护等级',labelEn:'Protection'},accessory:{label:'可选配件',labelEn:'Accessories'}};
export const DEFAULT_SPEC_FIELDS=['name','weight','platform','battery','dimensions','material','power','protection'];
const trim=(value,length)=>String(value??'').trim().slice(0,length);
export function normalizeSpecifications(input){
  if(!Array.isArray(input))return DEFAULT_SPEC_FIELDS.map(field=>({id:field,field,...SPEC_FIELDS[field],enabled:true}));
  const result=[],keys=new Set(),fields=new Set();
  for(const [index,raw]of input.slice(0,48).entries()){
    if(!raw||typeof raw!=='object')continue;
    const field=Object.hasOwn(SPEC_FIELDS,raw.field)?raw.field:null;
    if(field&&fields.has(field))continue;
    const id=field||(/^[A-Za-z0-9_-]{1,70}$/.test(raw.id||'')?raw.id:'custom_'+index);if(keys.has(id))continue;
    const fallback=field?SPEC_FIELDS[field]:{label:'',labelEn:''};
    result.push({id,...(field?{field}:{}),label:trim(raw.label??fallback.label,70),labelEn:trim(raw.labelEn??fallback.labelEn,100),enabled:raw.enabled!==false,...(!field?{type:['dimensions','weight'].includes(raw.type)?raw.type:'text',value:trim(raw.value,360),valueEn:trim(raw.valueEn,480)}:{})});keys.add(id);if(field)fields.add(field);
  }
  return result;
}
export function normalizeProductSpecifications(product){product.specifications=normalizeSpecifications(product.specifications);return product;}
export function specificationLabel(row,language='zh'){if(language==='zh')return row.label;return row.labelEn||englishSuggestion(row.label)||(row.label?'Translation pending':'');}
export function specificationValue(product,row,language='zh'){
  if(row.field==='name')return displayName(product);
  if(row.field)return translatedField(product,row.field,language);
  if(language==='zh'||row.type!=='text')return row.value;
  return row.valueEn||englishSuggestion(row.value)||(row.value?'Translation pending':'');
}
export function specificationErrors(rows){return normalizeSpecifications(rows).filter(row=>!row.field&&['dimensions','weight'].includes(row.type)&&!measurement(row.value,row.type).valid).map(row=>row.label||'未命名参数');}
export function missingSpecificationEnglish(rows){return normalizeSpecifications(rows).filter(row=>row.enabled&&row.label&&((specificationLabel(row,'en')==='Translation pending')||!row.field&&row.type==='text'&&specificationValue({},row,'en')==='Translation pending'));}
