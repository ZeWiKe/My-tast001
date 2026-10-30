export const platformModes = ['unknown','apple','google','versions','dual','dual_apple','dual_google','dual_versions'];
export function displayName(product){return product.name || `Tag${product.id}`;}
export function compatibilityMode(product){
  if(platformModes.includes(product.compatibility))return product.compatibility;
  return product.platforms?.length===2?'dual':product.platforms?.[0]||'unknown';
}
export function platformList(product){const mode=compatibilityMode(product);return mode==='apple'||mode==='google'?[mode]:mode==='versions'||mode.startsWith('dual')?['apple','google']:[];}
export function systemOptions(product){const mode=compatibilityMode(product);return {unknown:[],apple:['apple'],google:['google'],versions:['apple','google'],dual:['dual'],dual_apple:['dual','apple'],dual_google:['dual','google'],dual_versions:['dual','apple','google']}[mode];}
export function normalizeProduct(product){
  product.name=displayName(product);product.compatibility=compatibilityMode(product);
  product.platforms=platformList(product);product.english=product.english&&typeof product.english==='object'?product.english:{};
  return product;
}
const unitMap = {mm:1,毫米:1,cm:10,厘米:10,in:25.4,inch:25.4,inches:25.4,'"':25.4,'″':25.4,英寸:25.4};
const massMap = {g:1,克:1,kg:1000,千克:1000,公斤:1000,oz:28.349523125,盎司:28.349523125,lb:453.59237,lbs:453.59237,磅:453.59237};
function clean(value){return String(value??'').trim().replace(/[０-９]/g,c=>String(c.charCodeAt(0)-0xff10)).replace(/．/g,'.');}
const numeric='(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
export function parseDimensions(value){
  const raw=clean(value);if(!raw)return null;
  const parts=raw.split(/\s*[xX×*＊]\s*/);if(parts.length>3)return null;
  const re=new RegExp(`^([ØøΦφ⌀]?)\\s*(${numeric})\\s*(mm|cm|inches|inch|in|毫米|厘米|英寸|"|″)?$`,'i');
  const entries=parts.map(part=>part.match(re));if(entries.some(x=>!x))return null;
  const inherited=entries.at(-1)[3]?.toLowerCase()||'mm';
  const values=entries.map(m=>Number(m[2])*(unitMap[(m[3]||inherited).toLowerCase()]||1));
  if(values.some(v=>!Number.isFinite(v)||v<=0))return null;
  return {values,prefixes:entries.map(m=>m[1]?'Ø':'')};
}
export function parseWeight(value){
  const raw=clean(value);if(!raw)return null;
  const m=raw.match(new RegExp(`^(${numeric})\\s*(kg|g|oz|lbs?|千克|公斤|克|盎司|磅)?$`,'i'));
  if(!m)return null;const grams=Number(m[1])*(massMap[(m[2]||'g').toLowerCase()]||1);
  return grams>0&&Number.isFinite(grams)?grams:null;
}
function number(value,digits=2){return Number(value.toFixed(digits)).toString();}
export function measurement(value,kind,system='metric'){
  if(!clean(value))return {primary:'—',secondary:'',valid:true};
  if(kind==='dimensions'){
    const parsed=parseDimensions(value);if(!parsed)return {primary:String(value),secondary:'',valid:false};
    const metric=parsed.values.map((n,i)=>parsed.prefixes[i]+number(n,3)).join(' × ')+' mm';
    const imperial=parsed.values.map((n,i)=>parsed.prefixes[i]+number(n/25.4,3)).join(' × ')+' in';
    return {primary:system==='metric'?metric:imperial,secondary:system==='metric'?imperial:metric,valid:true};
  }
  const grams=parseWeight(value);if(!grams)return {primary:String(value),secondary:'',valid:false};
  const metric=number(grams,3)+' g',imperial=number(grams/28.349523125,3)+' oz';
  return {primary:system==='metric'?metric:imperial,secondary:system==='metric'?imperial:metric,valid:true};
}
const glossary = {
  '细磨砂塑料':'Fine matte plastic','细磨砂塑料外壳':'Fine matte plastic shell','磨砂塑料':'Matte plastic','塑料':'Plastic','硅胶':'Silicone','硅胶套':'Silicone case','硅胶保护套':'Silicone protective case',
  '可更换电池':'Replaceable battery','可替换电池':'Replaceable battery','更换电池':'Replaceable battery','纽扣电池':'Coin cell battery','可更换纽扣电池':'Replaceable coin cell battery','内置电池':'Built-in battery','内置可充电电池':'Built-in rechargeable battery','可充电电池':'Rechargeable battery','不可充电':'Non-rechargeable',
  '磁吸充电':'Magnetic charging','无线充电':'Wireless charging','充电底座':'Charging dock','usb-c充电':'USB-C charging','type-c充电':'USB-C charging','usb充电':'USB charging','锂电池':'Lithium battery','锂离子电池':'Lithium-ion battery','防水':'Water resistant','无':'None',
};
export function englishSuggestion(value){
  const source=String(value??'').trim();if(!source)return '';
  const key=source.replace(/\s+/g,'').toLowerCase();
  if(glossary[key])return glossary[key];
  if(!/[\u3400-\u9fff]/.test(source))return source;
  const battery=source.match(/^(?:可更换|可替换)?\s*(CR\d{3,5})\s*(?:纽扣)?电池$/i);
  if(battery)return `${/^(可更换|可替换)/.test(source)?'Replaceable ':''}${battery[1].toUpperCase()} coin cell battery`;
  return '';
}
export function translatedField(product,key,language='zh'){
  if(language==='zh')return product[key]||'';
  const manual=product.english?.[key]?.trim();if(manual)return manual;
  return englishSuggestion(product[key]) || (product[key]?'Translation pending':'');
}
export function missingEnglish(product){return ['power','battery','material','protection','accessory'].filter(key=>product[key]&&!product.english?.[key]?.trim()&&!englishSuggestion(product[key]));}
