import {normalizeGalleryLayout} from './gallery-layout.js';
export const LIGHTING_PROFILES={neutral:{name:'自然光 · 中性环境',exposure:.8}};
export const DEFAULT_PALETTE = {
  white:{name:'云白',en:'Cloud White',hex:'#f8f8f6'},black:{name:'曜黑',en:'Graphite Black',hex:'#242525'},
  blue:{name:'浅蓝',en:'Powder Blue',hex:'#b8dce4'},pink:{name:'柔粉',en:'Soft Pink',hex:'#ecc7cf'},yellow:{name:'明黄',en:'Lemon Yellow',hex:'#eddf68'}
};
export const FINISHES = {
  matte:{name:'细磨砂塑料',en:'Fine matte plastic',roughness:.62,metalness:0,clearcoat:.02,grain:.045},
  satin:{name:'半哑光塑料',en:'Satin plastic',roughness:.36,metalness:0,clearcoat:.15,grain:.018},
  gloss:{name:'亮面塑料',en:'Gloss plastic',roughness:.16,metalness:0,clearcoat:.8,grain:0},
  metal:{name:'金属',en:'Metal',roughness:.3,metalness:1,clearcoat:.05,grain:.012},
  silicone:{name:'硅胶',en:'Silicone',roughness:.84,metalness:0,clearcoat:0,grain:.035}
};
const clamp=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
export const validHex=value=>/^#[a-f\d]{6}$/i.test(String(value||''));
export function normalizeSurface(input={}){
  const preset=FINISHES[input.preset]?input.preset:'matte',base=FINISHES[preset];
  const colorVariants={};for(const [id,hex] of Object.entries(input.colorVariants||{}).slice(0,16))if(/^[a-z\d_-]{1,30}$/i.test(id)&&validHex(hex))colorVariants[id]=hex;
  return {label:String(input.label||'').slice(0,70),preset,roughness:clamp(input.roughness,0.05,1,base.roughness),metalness:clamp(input.metalness,0,1,base.metalness),clearcoat:clamp(input.clearcoat,0,1,base.clearcoat),grain:clamp(input.grain,0,.1,base.grain),linked:input.linked!==false,hex:validHex(input.hex)?input.hex:'#b8babe',colorVariants};
}
export function normalizeAppearance(product){
  product.colors=Array.isArray(product.colors)?[...new Set(product.colors.filter(x=>/^[a-z\d_-]{1,30}$/i.test(x)))].slice(0,16):['white'];
  if(!product.colors.length)product.colors=['white'];
  const raw=product.appearance||{},palette={},ecoEnabled=typeof raw.eco?.enabled==='boolean'?raw.eco.enabled:['03','13'].includes(product.id);
  if(ecoEnabled&&!raw.eco?.initialized){
    const options={eco_black:{name:'环保黑',en:'Eco Black',hex:'#292a29'},eco_pink:{name:'环保粉',en:'Eco Pink',hex:'#e3adc0'},eco_green:{name:'环保绿',en:'Eco Green',hex:'#91c995'}};
    raw.palette={...raw.palette};for(const [id,c]of Object.entries(options)){if(!product.colors.includes(id)){if(product.colors.length>=16)continue;product.colors.push(id);}raw.palette[id]||={...c,edition:'eco'};}
  }
  for(const id of product.colors){const c=raw.palette?.[id]||DEFAULT_PALETTE[id]||{name:id,en:id,hex:'#cccccc'};palette[id]={name:String(c.name||id).slice(0,40),en:String(c.en||id).slice(0,60),hex:validHex(c.hex)?c.hex:'#cccccc',edition:c.edition==='eco'?'eco':'all',...(typeof c.twoTone==='boolean'?{twoTone:c.twoTone}:{}),...(validHex(c.secondaryHex)?{secondaryHex:c.secondaryHex}:{})};}
  for(const id of ['white','preview'])if(palette[id]?.hex.toLowerCase()==='#eeefeb')palette[id].hex=DEFAULT_PALETTE.white.hex;
  const surfaces={};for(const [id,s] of Object.entries(raw.surfaces||{}).slice(0,64)){if(id==='__proto__'||id==='constructor')continue;surfaces[id]=normalizeSurface(s);}
  const background=raw.lighting?.background;
  product.appearance={palette,surfaces,materialMode:ecoEnabled&&raw.materialMode==='eco'?'eco':'standard',eco:{enabled:ecoEnabled,initialized:true,density:clamp(raw.eco?.density,.1,1.5,.65),scale:clamp(raw.eco?.scale,.5,2,1),contrast:clamp(raw.eco?.contrast,.1,1,.55)},lighting:{environment:'neutral',exposure:clamp(raw.lighting?.exposure,.6,1.4,1),background:validHex(background)&&background.toLowerCase()!=='#e5e7e5'?background:'#f5f5f7'}};
  product.gallery=Array.isArray(product.gallery)?product.gallery.slice(0,24).filter(g=>/^\/media\/[a-f\d-]{36}\.(jpg|png|webp)$/.test(g.src||'')).map(g=>({id:String(g.id||'').slice(0,50),src:g.src,color:product.colors.includes(g.color)?g.color:'all',title:String(g.title||'').slice(0,80),titleEn:String(g.titleEn||'').slice(0,100),fit:g.fit==='contain'?'contain':'cover',position:['center','top','bottom','left','right'].includes(g.position)?g.position:'center',...normalizeGalleryLayout(g)})):[];
  return product;
}
export function paletteColor(product,id){return product.appearance?.palette?.[id]||DEFAULT_PALETTE[id]||{name:id,en:id,hex:'#cccccc'};}
export function surfaceFor(product,part){
  const stored=product.appearance?.surfaces?.[part];if(stored)return normalizeSurface(stored);
  const info=product.parts?.find(p=>p.key===part);return normalizeSurface({preset:info?.defaultFinish||'matte',hex:info?.defaultColor,linked:info?.colorLinked});
}
export function isAccentPart(product,part){return product.parts?.find(p=>p.key===part)?.colorRole==='accent'||product.id==='16'&&['loop-inner','button-cap','silicone-cover'].includes(part);}
export function surfaceColor(product,part,color){const s=surfaceFor(product,part),c=paletteColor(product,color);if(isAccentPart(product,part)&&typeof c.twoTone==='boolean')return c.twoTone?(c.secondaryHex||s.colorVariants?.[color]||s.hex):c.hex;return s.colorVariants?.[color]||(s.linked?c.hex:s.hex);}
export function swatchColors(product,color){const base=paletteColor(product,color).hex,part=product.parts?.find(p=>isAccentPart(product,p.key));const secondary=part?surfaceColor(product,part.key,color):base;return base.toLowerCase()!==secondary.toLowerCase()?[base,secondary]:[base];}
export function availableColors(product){const eco=product.appearance?.materialMode==='eco',ids=product.colors.filter(id=>(paletteColor(product,id).edition==='eco')===eco);return ids.length?ids:product.colors;}
export function ecoSurface(product,part){return product.appearance?.materialMode==='eco'&&product.appearance?.eco?.enabled&&['matte','satin'].includes(surfaceFor(product,part).preset);}
export function galleryFor(product,color){return (product.gallery||[]).filter(g=>g.color==='all'||g.color===color);}
