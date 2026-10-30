import './vendor/model-viewer.min.js';
import * as THREE from 'three';
import {surfaceColor,surfaceFor,ecoSurface,LIGHTING_PROFILES} from './appearance.js';
import {specklePixels} from './finish-texture.js';
import {normalizeView} from './view-settings.js';
import {ModelLoad} from './model-load.js';
const Element=customElements.get('model-viewer');
Element.meshoptDecoderLocation=new URL('./vendor/model-viewer-meshopt.js',import.meta.url).href;
export class NeutralStage{
 constructor(element){this.element=element;this.loader=new ModelLoad(element);this.state='idle';this.sequence=0;this.colorFrame=0;this.textures=new Map();this.baseTextures=new WeakMap();element.addEventListener('camera-change',event=>{if(event.detail.source==='user-interaction')document.querySelector('.viewer-hint').style.opacity='0';});}
 isActive(product){return this.product?.id===product.id&&['loading','applying','ready'].includes(this.state);}
 async show(product,color){
  const sequence=++this.sequence;cancelAnimationFrame(this.colorFrame);cancelAnimationFrame(this.coverFrame);this.coverOpen=false;this.coverView=null;this.product=product;this.color=color;this.state='loading';
  const e=this.element,src=product.model+'?v='+(product.modelVersion||'neutral-9'),profile=product.appearance.lighting.environment;
  e.environmentImage=profile==='neutral'?'':profile;e.exposure=product.appearance.lighting.exposure*LIGHTING_PROFILES[profile].exposure;this.reset(product.view,true);
  try{const loaded=await this.loader.load(src);if(!loaded||sequence!==this.sequence)return false;
   this.state='applying';await this.applyMaterials(sequence);if(sequence!==this.sequence)return false;
   await this.setColor(this.color,true);if(sequence!==this.sequence)return false;this.reset(product.view,true);this.state='ready';return true;
  }catch(error){if(sequence===this.sequence)this.state='error';throw error;}
 }
 async finishTexture(product,part,color){
  const hex=surfaceColor(product,part,color),options=product.appearance.eco,key='eco:'+hex+JSON.stringify(options);
  if(!this.textures.has(key))this.textures.set(key,(async()=>{const pixels=specklePixels(hex,options),canvas=document.createElement('canvas');canvas.width=pixels.width;canvas.height=pixels.height;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.bytes),pixels.width,pixels.height),0,0);return this.element.createTexture(canvas.toDataURL('image/png'));})());
  return this.textures.get(key);
 }
 async roughnessTexture(surface){
  const key=surface.roughness.toFixed(4)+':'+surface.grain.toFixed(4);
  if(!this.textures.has(key))this.textures.set(key,(async()=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),image=ctx.createImageData(128,128);
   let seed=173;for(let i=0;i<image.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;image.data[i]=255;image.data[i+1]=Math.round(255*Math.max(.05,Math.min(1,surface.roughness+(seed/4294967296-.5)*surface.grain)));image.data[i+2]=255;image.data[i+3]=255;}
   ctx.putImageData(image,0,0);return this.element.createTexture(canvas.toDataURL('image/png'));
  })());return this.textures.get(key);
 }
 async applyMaterials(sequence){
  const product=this.product,color=this.color,e=this.element;if(!e.model)return;
  for(const material of e.model.materials){
   const s=surfaceFor(product,material.name),pbr=material.pbrMetallicRoughness;
   if(!this.baseTextures.has(material))this.baseTextures.set(material,pbr.baseColorTexture.texture||null);
   pbr.setBaseColorFactor(surfaceColor(product,material.name,color));pbr.setMetallicFactor(s.metalness);pbr.setRoughnessFactor(s.roughness);material.setClearcoatFactor(s.clearcoat);material.setClearcoatRoughnessFactor(.22);
   if(ecoSurface(product,material.name)){const texture=await this.finishTexture(product,material.name,color);if(sequence!==this.sequence)return;pbr.baseColorTexture.setTexture(texture);pbr.setBaseColorFactor('#ffffff');}else pbr.baseColorTexture.setTexture(this.baseTextures.get(material));
   if(s.grain){const texture=await this.roughnessTexture(s);if(sequence!==this.sequence)return;pbr.metallicRoughnessTexture.setTexture(texture);pbr.setRoughnessFactor(1);}else pbr.metallicRoughnessTexture.setTexture(null);
  }
 }
 async setColor(color,immediate=false){
  this.color=color;const colorSequence=this.colorSequence=(this.colorSequence||0)+1;cancelAnimationFrame(this.colorFrame);const e=this.element,product=this.product,modelSequence=this.sequence;if(!e.model||!product)return;
  for(const material of e.model.materials)if(ecoSurface(product,material.name)){const texture=await this.finishTexture(product,material.name,color);if(colorSequence!==this.colorSequence||modelSequence!==this.sequence)return;material.pbrMetallicRoughness.baseColorTexture.setTexture(texture);material.pbrMetallicRoughness.setBaseColorFactor('#ffffff');}
  const transitions=e.model.materials.filter(m=>!ecoSurface(product,m.name)).map(material=>({material,from:new THREE.Color().fromArray(material.pbrMetallicRoughness.baseColorFactor),to:new THREE.Color(surfaceColor(product,material.name,color))}));
  const start=performance.now(),sequence=this.sequence;
  const draw=now=>{if(sequence!==this.sequence)return;const t=immediate?1:Math.min(1,(now-start)/360),ease=1-(1-t)**3;for(const {material,from,to}of transitions){const c=new THREE.Color().lerpColors(from,to,ease);material.pbrMetallicRoughness.setBaseColorFactor([c.r,c.g,c.b,1]);}if(t<1)this.colorFrame=requestAnimationFrame(draw);};draw(start);
 }
 async refreshFinish(){const sequence=++this.sequence;cancelAnimationFrame(this.colorFrame);await this.applyMaterials(sequence);if(sequence===this.sequence)await this.setColor(this.color,true);}
 get canOpenCover(){return this.product?.id==='16'&&this.element.availableAnimations?.includes('CoverOpen');}
 setCover(open,immediate=false){
  cancelAnimationFrame(this.coverFrame);const wasOpen=this.coverOpen;this.coverOpen=!!open;if(!this.canOpenCover)return;
  const e=this.element,orbit=e.getCameraOrbit();
  if(open&&!wasOpen){this.coverView=`${orbit.theta}rad ${orbit.phi}rad ${orbit.radius}m`;e.autoRotate=false;e.cameraOrbit=`-55deg 65deg ${orbit.radius}m`;}else if(!open&&wasOpen&&this.coverView)e.cameraOrbit=this.coverView;
  const from=Number(e.currentTime)||0;e.animationName='CoverOpen';e.animationCrossfadeDuration=0;e.play({repetitions:1});e.pause();
  const to=open?1-1e-5:0,start=performance.now(),sequence=this.sequence;
  const draw=now=>{if(sequence!==this.sequence)return;const t=immediate?1:Math.min(1,(now-start)/650),v=from+(to-from)*(t*t*(3-2*t));e.currentTime=v;if(t<1)this.coverFrame=requestAnimationFrame(draw);};draw(start);
 }
 reset(input,immediate=false){const v=normalizeView(input),e=this.element;this.roll=v.roll;this.modelYaw=v.modelYaw;this.modelPitch=v.modelPitch;e.autoRotate=false;e.resetTurntableRotation();e.orientation=`${v.roll}deg ${v.modelPitch}deg ${v.modelYaw}deg`;e.cameraTarget='0m 0m 0m';e.cameraOrbit=`${v.yaw}deg ${90-v.pitch}deg ${v.distance}m`;if(immediate)e.jumpCameraToGoal();}
 getView(){const p=this.element.getCameraOrbit();return normalizeView({yaw:((p.theta-this.element.turntableRotation)*180/Math.PI+540)%360-180,pitch:90-p.phi*180/Math.PI,roll:this.roll,modelYaw:this.modelYaw,modelPitch:this.modelPitch,distance:p.radius});}
 get autoRotate(){return this.element.autoRotate;}set autoRotate(value){this.element.autoRotate=value;}
}
