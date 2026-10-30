import {renderGalleryEditor} from './gallery-studio.js';
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { normalizeAppearance,normalizeSurface,FINISHES,paletteColor,surfaceFor,surfaceColor,LIGHTING_PROFILES,availableColors,swatchColors,isAccentPart } from './appearance.js';
import { configureRenderer,studioLighting,studioEnvironment,cloneProduct,releaseProduct } from './material-engine.js';
import {normalizeView} from './view-settings.js';
import {LIGHTING_PRESETS,exposureValue} from './catalog-settings.js';
const $=s=>document.querySelector(s);
const el=(tag,props={},children=[])=>{const n=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='text')n.textContent=v;else if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else n.setAttribute(k,v);}n.append(...children);return n;};
const label=(text,input)=>el('label',{},[el('span',{text}),input]);
export class AppearanceStudio{
  constructor(loadModel){
    this.loadModel=loadModel;this.request=0;
    $('#appearanceSettings').addEventListener('toggle',()=>{if($('#appearanceSettings').open)this.prepare();});
    $('#galleryUpload').addEventListener('change',e=>this.upload(e.target.files));
    $('#editorDialog').addEventListener('close',()=>{if(this.group)this.highlight('');});
    $('#addColor').onclick=()=>{if(this.product.colors.length>=16)return;const id='color_'+Date.now().toString(36);this.product.colors.push(id);this.product.appearance.palette[id]={name:'新配色',en:'New color',hex:'#cccccc'};this.color=id;this.renderPalette();this.renderGallery();this.draw();};
  }
  load(product){
    this.request++;this.product=normalizeAppearance(structuredClone(product));this.color=availableColors(this.product).includes('blue')?'blue':availableColors(this.product)[0];this.part='';this.original=null;
    this.renderPalette();this.renderGallery();$('#studioMessage').textContent='';$('#lightingSyncStatus').textContent='';
    this.renderEcoControls();
    $('#studioEnvironment').replaceChildren(...LIGHTING_PRESETS.map(p=>el('option',{value:String(p.value),text:p.name})),el('option',{value:'custom',text:'自然光 · 自定义'}));this.updateExposureUI();$('#studioEnvironment').onchange=e=>{if(e.target.value!=='custom')this.setExposure(Number(e.target.value));};
    $('#studioBackground').value=this.product.appearance.lighting.background;
    $('#studioExposure').oninput=e=>this.setExposure(Number(e.target.value));
    $('#studioExposurePercent').oninput=e=>{if(e.target.value&&Number(e.target.value)>=60&&Number(e.target.value)<=140)this.setExposure(Number(e.target.value)/100);};$('#studioExposurePercent').onchange=()=>this.updateExposureUI();
    $('#studioBackground').oninput=e=>{this.product.appearance.lighting.background=e.target.value;this.draw();};
    if($('#appearanceSettings').open)this.prepare();
  }
  values(){return {colors:[...this.product.colors],appearance:structuredClone(this.product.appearance),gallery:structuredClone(this.product.gallery)};}
  updateExposureUI(){const exposure=this.product.appearance.lighting.exposure;$('#studioExposure').value=exposure;$('#studioExposure').setAttribute('aria-valuetext',Math.round(exposure*100)+'%');$('#studioExposurePercent').value=Math.round(exposure*100);$('#studioEnvironment').value=LIGHTING_PRESETS.some(p=>Math.abs(p.value-exposure)<.001)?String(exposure):'custom';}
  setExposure(value){this.product.appearance.lighting.exposure=exposureValue(value);this.updateExposureUI();this.draw();}
  renderEcoControls(){
    const p=this.product;$('#ecoEnabled').checked=p.appearance.eco.enabled;$('#ecoMode').value=p.appearance.materialMode;
    $('#ecoEnabled').onchange=e=>{p.appearance.eco.enabled=e.target.checked;if(!e.target.checked)p.appearance.materialMode='standard';this.renderEcoControls();this.renderPalette();this.draw();};
    $('#ecoMode').disabled=!p.appearance.eco.enabled;$('#ecoMode').onchange=e=>{p.appearance.materialMode=e.target.value;this.color=availableColors(p)[0];this.renderPalette();if(this.part)this.renderSurface();this.draw();};
    for(const [id,key]of [['ecoDensity','density'],['ecoScale','scale'],['ecoContrast','contrast']]){$('#'+id).value=p.appearance.eco[key];$('#'+id).disabled=!p.appearance.eco.enabled;$('#'+id).oninput=e=>{p.appearance.eco[key]=Number(e.target.value);this.draw();};}
  }
  renderPalette(){
    const root=$('#paletteEditor');root.replaceChildren();
    for(const id of this.product.colors){
      const c=this.product.appearance.palette[id];
      const picker=el('input',{type:'color',value:c.hex,'aria-label':c.name+' 颜色'}),hex=el('input',{type:'text',value:c.hex,maxlength:7,'aria-label':c.name+' HEX',pattern:'#[A-Fa-f0-9]{6}'});
      const name=el('input',{value:c.name,maxlength:40,'aria-label':id+' 中文配色名'}),english=el('input',{value:c.en,maxlength:60,'aria-label':id+' English color name'});
      const select=el('button',{type:'button',class:'palette-select',text:'◉','aria-label':'预览 '+c.name,'aria-pressed':String(this.color===id),onclick:()=>{this.color=id;if(paletteColor(this.product,id).edition==='eco'&&this.product.appearance.eco.enabled)this.product.appearance.materialMode='eco';this.renderEcoControls();this.renderPalette();if(this.part)this.renderSurface();this.draw();}});
      picker.oninput=()=>{c.hex=picker.value;hex.value=c.hex;this.draw();};
      hex.oninput=()=>{if(/^#[a-f\d]{6}$/i.test(hex.value)){c.hex=hex.value;picker.value=c.hex;hex.setCustomValidity('');this.draw();}else hex.setCustomValidity('请输入 # 加六位颜色值');};
      name.oninput=()=>c.name=name.value;english.oninput=()=>c.en=english.value;
      const remove=el('button',{type:'button',class:'studio-small',text:'×','aria-label':'删除 '+c.name,onclick:()=>{if(this.product.colors.length===1)return;this.product.colors=this.product.colors.filter(x=>x!==id);this.product.gallery.forEach(g=>{if(g.color===id)g.color='all';});delete this.product.appearance.palette[id];if(this.color===id)this.color=this.product.colors[0];this.renderPalette();this.renderGallery();this.draw();}});
      root.append(el('div',{class:'palette-row'},[select,picker,hex,name,english,remove]));
      const options=el('div',{class:'palette-options'});
      if(this.product.appearance.eco.enabled){const edition=el('select',{'aria-label':c.name+' 适用版本'},[el('option',{value:'all',text:'标准款配色'}),el('option',{value:'eco',text:'环保款配色'})]);edition.value=c.edition||'all';edition.onchange=()=>{c.edition=edition.value;this.draw();};options.append(edition);}
      if(this.product.parts?.some(p=>isAccentPart(this.product,p.key))){
        const tones=swatchColors(this.product,id),dual=el('input',{type:'checkbox','aria-label':c.name+' 双色'});dual.checked=tones.length===2;
        const accent=el('input',{type:'color',value:tones[1]||c.hex,'aria-label':c.name+' 装饰色'});accent.disabled=!dual.checked;
        dual.onchange=()=>{c.twoTone=dual.checked;c.secondaryHex=accent.value;accent.disabled=!dual.checked;this.draw();};accent.oninput=()=>{c.twoTone=true;c.secondaryHex=accent.value;this.draw();};
        options.append(label('双色',dual),label('装饰色',accent));
      }
      if(options.children.length)root.append(options);
    }
  }
  async prepare(){
    const request=++this.request;
    try{
      const original=await this.loadModel(this.product);if(request!==this.request)return;this.original=original;
      if(!this.renderer){
        this.renderer=new THREE.WebGLRenderer({canvas:$('#materialCanvas'),alpha:true,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.scene=new THREE.Scene();this.environments=Object.fromEntries(['neutral','legacy'].map(profile=>[profile,studioEnvironment(this.renderer,profile)]));studioLighting(this.scene);
        this.camera=new THREE.PerspectiveCamera(32,1,.1,50);this.camera.position.set(2,1,8.3);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enablePan=false;this.controls.minDistance=4.5;this.controls.maxDistance=12;this.controls.addEventListener('change',()=>this.render());
        new ResizeObserver(()=>this.render()).observe($('#materialPreview'));
        const canvas=this.renderer.domElement;let start;
        canvas.addEventListener('pointerdown',e=>start=[e.clientX,e.clientY]);
        canvas.addEventListener('pointerup',e=>{if(!start||Math.hypot(e.clientX-start[0],e.clientY-start[1])>5)return;const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);const hit=ray.intersectObject(this.group,true)[0];if(hit){this.part=hit.object.name;$('#surfacePart').value=this.part;this.renderSurface();this.highlight(this.part);}});
      }
      const parts=[];original.traverse(o=>{if(o.isMesh)parts.push(o.name);});
      const select=$('#surfacePart');select.replaceChildren();for(const [index,id] of parts.entries()){const label=this.product.parts?.find(p=>p.key===id)?.label||`外观部件 ${index+1}`;select.append(el('option',{value:id,text:this.product.appearance.surfaces[id]?.label||label}));}
      this.part=parts[0]||'';select.value=this.part;select.onchange=()=>{this.part=select.value;this.renderSurface();this.highlight($('#showPart').checked?this.part:'');};
      this.renderSurface();this.draw();
    }catch(error){console.error(error);$('#studioMessage').textContent='部件预览加载失败，请关闭后重试。';}
  }
  renderSurface(){
    const p=this.product;
    if(!p.appearance.surfaces[this.part])p.appearance.surfaces[this.part]=normalizeSurface({...surfaceFor(p,this.part),label:p.parts?.find(x=>x.key===this.part)?.label||''});
    const s=p.appearance.surfaces[this.part];
    $('#partName').value=s.label;$('#partName').oninput=e=>{s.label=e.target.value;$('#surfacePart').selectedOptions[0].textContent=s.label||this.part;};
    $('#surfacePreset').replaceChildren();for(const [id,config]of Object.entries(FINISHES))$('#surfacePreset').append(el('option',{value:id,text:config.name}));
    $('#surfacePreset').value=s.preset;$('#surfacePreset').onchange=e=>{Object.assign(s,FINISHES[e.target.value],{preset:e.target.value});this.renderSurface();this.draw();};
    for(const key of ['roughness','metalness','clearcoat','grain']){const input=$('#surface_'+key),digits=key==='grain'?3:2;input.value=s[key];input.nextElementSibling.textContent=Number(s[key]).toFixed(digits);input.oninput=()=>{s[key]=Number(input.value);input.nextElementSibling.textContent=s[key].toFixed(digits);this.draw();};}
    $('#surfaceLinked').checked=s.linked;$('#surfaceFixed').value=s.hex;$('#surfaceFixed').disabled=s.linked;
    $('#surfaceLinked').onchange=e=>{s.linked=e.target.checked;$('#surfaceFixed').disabled=s.linked;this.draw();};
    $('#surfaceFixed').oninput=e=>{s.hex=e.target.value;this.draw();};
    s.colorVariants||={};$('#surfaceVariant').checked=!!s.colorVariants[this.color];$('#surfaceVariantColor').value=surfaceColor(p,this.part,this.color);$('#surfaceVariantColor').disabled=!s.colorVariants[this.color];$('#variantColorLabel').textContent=paletteColor(p,this.color).name+' · 部件颜色';
    $('#surfaceVariant').onchange=e=>{if(e.target.checked)s.colorVariants[this.color]=$('#surfaceVariantColor').value;else delete s.colorVariants[this.color];$('#surfaceVariantColor').disabled=!e.target.checked;this.draw();};
    $('#surfaceVariantColor').oninput=e=>{s.colorVariants[this.color]=e.target.value;this.draw();};
    $('#showPart').onchange=()=>this.highlight($('#showPart').checked?this.part:'');
    $('#partMeshName').textContent=this.part;
    $('#applyAllSurfaces').onclick=()=>{const select=$('#surfacePart');for(const option of select.options){const old=p.appearance.surfaces[option.value];p.appearance.surfaces[option.value]={...structuredClone(s),label:old?.label||p.parts?.find(x=>x.key===option.value)?.label||''};}this.draw();$('#studioMessage').textContent='已统一各部件工艺，保存后同步到网站。';};
  }
  highlight(name){if(this.group)this.group.traverse(o=>{if(o.isMesh)o.material.emissive.set(o.name===name?'#365d4d':'#000000');});this.render();}
  draw(){
    if(!this.renderer||!this.original)return;
    if(this.group){this.scene.remove(this.group);releaseProduct(this.group);}
    this.group=cloneProduct(this.original,this.product,this.color);const pose=normalizeView(this.product.view);this.group.rotation.set(THREE.MathUtils.degToRad(pose.modelPitch),THREE.MathUtils.degToRad(pose.modelYaw),THREE.MathUtils.degToRad(pose.roll),'YXZ');this.scene.add(this.group);this.scene.environment=this.environments[this.product.appearance.lighting.environment].texture;configureRenderer(this.renderer,this.product.appearance.lighting.exposure,this.product.appearance.lighting.environment);$('#materialPreview').style.background=this.product.appearance.lighting.background;
    this.highlight($('#showPart').checked?this.part:'');
  }
  render(){
    if(!this.renderer||!$('#appearanceSettings').open||!$('#editorDialog').open)return;
    const r=$('#materialPreview').getBoundingClientRect();if(!r.width||!r.height)return;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();this.renderer.render(this.scene,this.camera);
  }
  renderGallery(){renderGalleryEditor(this);}
  async upload(files,replaceIndex=null){
    if(!files?.length)return;
    const product=this.product;this.busy=true;$('#galleryUpload').disabled=true;$('#saveProduct').disabled=true;$('#editorProduct').disabled=true;
    try{
      for(const file of files){
        if(replaceIndex===null&&product.gallery.length>=24)throw new Error('每个型号最多 24 张图片。');
        if(file.size>12*1024*1024)throw new Error('单张图片请控制在 12 MB 内。');
        if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('仅支持 JPG、PNG、WebP 图片。');
        $('#galleryStatus').textContent='正在上传 '+file.name+'…';
        const response=await fetch('/api/uploads/'+product.id,{method:'POST',headers:{'X-Studio-Request':'1','Content-Type':file.type},body:file});const result=await response.json();if(!response.ok)throw new Error(result.error||'上传失败。');
        const image={...result,color:'all',title:'',titleEn:'',fit:'cover',position:'center'};
        if(replaceIndex!==null){product.gallery[replaceIndex]={...product.gallery[replaceIndex],...result};break;}product.gallery.push(image);
      }
      this.renderGallery();$('#galleryStatus').textContent='上传完成，点击“保存到网站”后展示。';
    }catch(error){$('#galleryStatus').textContent=error.message;}
    finally{this.busy=false;$('#galleryUpload').disabled=false;$('#saveProduct').disabled=false;$('#editorProduct').disabled=false;$('#galleryUpload').value='';}
  }
}
