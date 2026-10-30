import {applyGalleryLayout} from './gallery-layout.js';
import * as THREE from 'three';
import { NeutralStage } from './neutral-stage.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.module.js';
import { displayName, normalizeProduct, compatibilityMode, platformList, platformModes,systemOptions,measurement, translatedField, englishSuggestion, missingEnglish } from './product-content.js';
import {normalizeSpecifications,specificationLabel,specificationValue,missingSpecificationEnglish} from './specifications.js';
import {SpecificationStudio} from './spec-studio.js';
import { DEFAULT_VIEW, normalizeView, cameraPositionForView } from './view-settings.js';
import { DEFAULT_PALETTE,normalizeAppearance,paletteColor,galleryFor,availableColors,swatchColors } from './appearance.js';
import { configureRenderer,studioLighting,studioEnvironment,cloneProduct,releaseProduct } from './material-engine.js';
import { AppearanceStudio } from './studio.js';
import { ModelStudio } from './model-studio.js';
import {CatalogStudio} from './catalog-studio.js';
import {orderProducts} from './catalog-settings.js';
import { recoverLegacy,backupCatalog,legacyMap } from './data-recovery.js';

const $ = (selector) => document.querySelector(selector);
const assetURL=src=>new URL(src.replace(/^\/+/,''),document.baseURI).href;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const colors = {
  white: { name: '云白', en: 'Cloud White', hex: '#efefea' },
  black: { name: '曜黑', en: 'Graphite Black', hex: '#282a2c' },
  blue: { name: '浅蓝', en: 'Powder Blue', hex: '#b9e0e9' },
  pink: { name: '柔粉', en: 'Soft Pink', hex: '#f1cbd2' },
  yellow: { name: '明黄', en: 'Lemon Yellow', hex: '#f0e45f' },
};
const dictionary = {
  exterior:['三维外观','3D EXTERIOR'], drag:['拖动探索外观','Drag to explore'], dimensions:['产品尺寸','Dimensions'], power:['供电方式','Power source'], finish:['细磨砂塑料','Fine matte plastic'], accessories:['可选配件','Accessories'], details:['产品详情','Product details'], collection:['探索系列','THE COLLECTION'], specs:['产品参数','Specifications'], pending:['更多产品参数待补充。','Further specifications to be confirmed.'], gallery:['外观细节','A closer look'], exteriorOnly:['完整外观 · 细磨砂质感','Exterior · Fine matte finish'], form:['纯粹的形态','Considered in every curve'], profile:['轻巧轮廓','A compact silhouette'], surface:['细腻触感','A softer touch'], edit:['资料编辑','Edit details'], allModels:['选择型号','Explore the collection'],
};
const platformSvg = {
  apple:`<svg class="platform-logo" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#31ad55"/><circle cx="16" cy="16" r="10.4" fill="none" stroke="#83d16b" stroke-width="1.4"/><path d="M16 16 8.5 3a15 15 0 0 1 15 0Z" fill="#448acc" opacity=".65"/><circle cx="16" cy="16" r="4.9" fill="white"/><circle cx="16" cy="16" r="3.5" fill="#2d74bd"/></svg>`,
  google:`<svg class="platform-logo" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="10" fill="#7696c5"/><path fill="#4eae6a" d="M6 16h20a10 10 0 0 1-20 0Z"/><path fill="#228b45" d="M6 16h10v10A10 10 0 0 1 6 16Z"/><path fill="#2d5d97" d="M16 6a10 10 0 0 1 10 10H16Z"/><path fill="#e33b26" d="M16 1a15 15 0 0 1 15 15h-5A10 10 0 0 0 16 6Z"/><path fill="#f4c119" d="M1 16h5a10 10 0 0 0 10 10v5A15 15 0 0 1 1 16Z"/><circle cx="16" cy="16" r="5.1" fill="white"/></svg>`,
};
const platformName = { apple: 'Apple Find My', google: 'Google Find Hub' };
const MODEL_CACHE = new Map();
const productColors = new Map();
const productVersions = new Map();
let unitSystem='metric',canEdit=false;
let data, products, current, language = 'zh', stage;
let modelRequest = 0, galleryRequest = 0;
let snapshotRenderer, snapshotEnvironments, toastTimer;
let anglePreviewRequest=0,appearanceStudio,modelStudio,specificationStudio;
let historyRequest=0,historyVersions=[];
let selectedColor = 'blue';
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const viewer = $('#viewer');

function tr(key) { return dictionary[key]?.[language === 'zh' ? 0 : 1] || key; }
function colorName(id,p=current) { return paletteColor(p,id)[language === 'zh' ? 'name' : 'en']; }
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2600); }
function safeStoredData(base) {
  try {
    const saved = JSON.parse(localStorage.getItem('tag-studio-details-v1') || '{}');
    for (const p of base.products) {
      const stored = saved[p.id];
      if (!stored || typeof stored !== 'object') continue;
      for (const key of ['dimensions','power','weight','battery','material','protection','accessory']) if (typeof stored[key] === 'string') p[key] = stored[key].slice(0, 160);
      if (Array.isArray(stored.platforms)) p.platforms = stored.platforms.filter(x => x === 'apple' || x === 'google');
      if (platformModes.includes(stored.compatibility))p.compatibility=stored.compatibility;
      else if(stored.platforms)p.compatibility=stored.platforms.length===2?'versions':stored.platforms[0]||'unknown';
      if(stored.english&&typeof stored.english==='object')for(const key of ['power','battery','material','protection','accessory'])if(typeof stored.english[key]==='string')p.english={...p.english,[key]:stored.english[key].slice(0,240)};
      if(stored.view&&typeof stored.view==='object')p.view=normalizeView({...p.view,...stored.view});
      if(stored.appearance)p.appearance=stored.appearance;
      // Legacy local edits are offered for import, never silently overwrite cloud edits.
    }
  } catch { /* A corrupt or disabled local cache must not prevent viewing products. */ }
  base.products.forEach(p=>{normalizeProduct(p);normalizeAppearance(p);p.view=normalizeView(p.view);});return base;
}

function setupScene() {stage=new NeutralStage($('#productCanvas'));}

async function loadModel(p) {
  const key=p.model+'?v='+(p.modelVersion||'exterior-5');
  if (!MODEL_CACHE.has(key)) {
    const promise = loader.loadAsync(key).then(gltf => gltf.scene).catch(error => { MODEL_CACHE.delete(key); throw error; });
    MODEL_CACHE.set(key,promise);
  }
  return MODEL_CACHE.get(key);
}
function cloneModel(original, hex,product=current,color=selectedColor) {return cloneProduct(original,product,color);}
function disposeMaterials(group) { group.traverse(object => { if(object.isMesh) object.material.dispose(); }); }
function showLoadError(message) {
  $('#loadingState').classList.remove('loaded'); $('#loadingText').textContent=message; $('#retryLoad').hidden=false; $('.loading-orbit').style.display='none';
}

async function selectProduct(id, initial=false,force=false) {
  const p=products.find(p=>p.id===id); if(!p) return;
  if(!force&&current?.id===id&&stage?.isActive(p))return;
  current=p;
  selectedColor = productColors.get(id+'|'+p.appearance.materialMode) || (id==='F2' ? 'blue':'white');
  if(!availableColors(p).includes(selectedColor)) selectedColor=availableColors(p)[0];
  viewer.style.setProperty('--studio-background',p.appearance.lighting.background);
  updateProductUI();
  revealSelectedModel();
  const request=++modelRequest;
  $('#loadingState').classList.remove('loaded'); $('#loadingText').textContent=language==='zh'?'正在准备三维外观':'Preparing 3D exterior'; $('#retryLoad').hidden=true; $('.loading-orbit').style.display='';
  try {
    const ready=await stage.show(p,selectedColor);
    if(!ready||request!==modelRequest)return;
    $('#rotateButton').setAttribute('aria-pressed','false');$('#rotateButton').setAttribute('aria-label','开启自动旋转');
    $('#loadingState').classList.add('loaded');
    stage.setCover(false,true);updateCoverButton();
    if(!initial && !reducedMotion.matches) $('.info-top').animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:450,easing:'cubic-bezier(.22,1,.36,1)'});
    updateGallery();
  }catch(error){console.error('Model load failed',error);if(request===modelRequest)showLoadError(language==='zh'?'模型暂时无法加载，请重试。':'Unable to load model. Please retry.');}
}
function appendMeasurement(target,value,kind){
  const result=measurement(value,kind,unitSystem);target.replaceChildren();target.classList.add('measurement-values');
  const primary=document.createElement('span');primary.textContent=result.primary;target.append(primary);
  if(result.secondary){const secondary=document.createElement('small');secondary.textContent=result.secondary;target.append(secondary);}
}
function renderCompatibility(target,compact=false){
  target.replaceChildren();const mode=compatibilityMode(current);
  if(mode==='unknown'){const note=document.createElement('span');note.className='platform-pending';note.textContent=language==='zh'?'平台资料待补充':'Compatibility to be confirmed';target.append(note);return;}
  const group=document.createElement('div');group.className=`system-group system-${mode}${compact?' system-compact':''}`;
  const options=systemOptions(current),remembered=productVersions.get(current.id),active=options.includes(remembered)?remembered:options[0];
  if(options.length>1)group.classList.add('system-options');
  for(const option of options){const dual=option==='dual',button=document.createElement('button');button.type='button';button.className=dual?'system-combined':'system-badge';const title=dual?(language==='zh'?'双系统款：Apple Find My 与 Google Find Hub':'Dual-system version: Apple Find My and Google Find Hub'):platformName[option]+(options.length>1?(language==='zh'?' 独立款':' standalone version'):'');button.setAttribute('aria-label',title);button.title=title;button.innerHTML=dual?platformSvg.apple+platformSvg.google:platformSvg[option];
    if(options.length>1){button.setAttribute('aria-pressed',String(option===active));button.onclick=()=>{productVersions.set(current.id,option);updateProductUI();};}else button.onclick=()=>toast(title);group.append(button);}
  const label=document.createElement('span');label.className='system-caption';
  label.textContent=active==='dual'?(language==='zh'?'双系统款':'Dual-system version'):options.length>1?(language==='zh'?(active==='apple'?'苹果独立款':'谷歌独立款'):(active==='apple'?'Apple standalone':'Google standalone')):platformName[active];
  target.append(group,label);
}
function updateProductUI() {
  $('.viewer-symbol').setAttribute('aria-label',tr('exterior'));$('.viewer-symbol').title=tr('exterior');
  $('#productName').textContent=displayName(current); $('#specModel').textContent=displayName(current);
  const n=String(products.indexOf(current)+1).padStart(2,'0'),count=String(products.length).padStart(2,'0'); $('#productIndex').textContent=`${n} — ${count}`;$('#railCount').textContent=`${n} / ${count}`;
  appendMeasurement($('#quickDimensions'),current.dimensions,'dimensions');$('#quickPower').textContent=translatedField(current,'power',language)||'—';
  $('#productCanvas').setAttribute('alt',`${displayName(current)} ${language==='zh'?'三维模型，可拖动旋转，滚轮缩放':'3D model. Drag to rotate, scroll to zoom'}`);
  renderCompatibility($('#platforms'));
  $('#swatches').replaceChildren();
  for(const color of availableColors(current)){const b=document.createElement('button'),tones=swatchColors(current,color);b.className='swatch'+(current.appearance.materialMode==='eco'?' eco-swatch':'');b.style.setProperty('--swatch',tones.length===2?`linear-gradient(135deg,${tones[0]} 0 50%,${tones[1]} 50% 100%)`:tones[0]);b.dataset.color=color;b.dataset.tones=tones.length;b.setAttribute('aria-label',colorName(color));b.title=colorName(color);b.setAttribute('aria-pressed',String(color===selectedColor));b.onclick=()=>selectColor(color);$('#swatches').append(b);}
  $('#materialVariants').hidden=!current.appearance.eco.enabled;for(const b of $('#materialVariants').children){b.setAttribute('aria-pressed',String(b.dataset.finish===current.appearance.materialMode));b.textContent=b.dataset.finish==='eco'?(language==='zh'?'环保纹理款':'Eco texture'):(language==='zh'?'标准款':'Standard');}
  $('#colorName').textContent=colorName(selectedColor);$('#viewerColorMark').textContent=`${displayName(current)} / ${colorName(selectedColor)}`;
  updateCoverButton();
  $('#accessoryButton').hidden=!current.accessory;$('#accessoryName').textContent=translatedField(current,'accessory',language);
  $('#unitMode').textContent=unitSystem==='metric'?'mm · g':'in · oz';$('#unitMode').setAttribute('aria-label',language==='zh'?'切换公制与英制单位':'Switch metric and imperial units');
  for(const b of document.querySelectorAll('.model-button')){const selected=b.dataset.id===current.id;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;}
  for(const b of document.querySelectorAll('.catalog-card'))b.setAttribute('aria-pressed',String(b.dataset.id===current.id));
  updateRailPagination();
  renderSpecs();
}
function renderSpecs() {
  $('#specGrid').replaceChildren();
  for(const item of normalizeSpecifications(current.specifications)){
    if(!item.enabled||!item.label||!item.field&&!item.value&&!item.valueEn)continue;
    const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd'),kind=item.field||item.type;dt.textContent=specificationLabel(item,language);
    if(kind==='platform'){dd.className='spec-platforms';renderCompatibility(dd,true);}else if(kind==='dimensions'||kind==='weight')appendMeasurement(dd,item.field?current[item.field]:item.value,kind);else dd.textContent=specificationValue(current,item,language)||'—';row.append(dt,dd);$('#specGrid').append(row);
  }
}
function selectColor(id) {
  if(!current.colors.includes(id)) return;
  selectedColor=id;productColors.set(current.id+'|'+current.appearance.materialMode,id);
  stage.setColor(id,reducedMotion.matches);
  for(const b of $('#swatches').children)b.setAttribute('aria-pressed',String(b.dataset.color===id));
  $('#colorName').textContent=colorName(id);$('#viewerColorMark').textContent=`${displayName(current)} / ${colorName(id)}`;
  updateGallery();
}
function resetView() {stage.reset(current.view,reducedMotion.matches);$('#rotateButton').setAttribute('aria-pressed','false');$('#rotateButton').setAttribute('aria-label','开启自动旋转');}

function snapshot(original,{width=400,height=330,hex=colors.white.hex,angle=0,bg=null,view=null,product=current,color=selectedColor,thumbnail=false}={}) {
  if(!snapshotRenderer){snapshotRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});snapshotEnvironments=Object.fromEntries(['neutral','legacy'].map(profile=>[profile,studioEnvironment(snapshotRenderer,profile).texture]));}
  configureRenderer(snapshotRenderer,product.appearance.lighting.exposure,product.appearance.lighting.environment);
  snapshotRenderer.setSize(width,height,false);snapshotRenderer.setClearColor(bg||0x000000,bg?1:0);
  const s=new THREE.Scene();s.environment=snapshotEnvironments[product.appearance.lighting.environment];
  const sourceProduct=thumbnail?{...product,appearance:{...product.appearance,materialMode:'standard'}}:product;
  const group=cloneModel(original,hex,sourceProduct,color);if(thumbnail)group.traverse(o=>{if(o.isMesh)o.material.color.set('#242525');});const pose=normalizeView(thumbnail?product.view:view||product.view);group.rotation.set(THREE.MathUtils.degToRad(pose.modelPitch),THREE.MathUtils.degToRad(pose.modelYaw),THREE.MathUtils.degToRad(pose.roll),'YXZ');s.add(group);
  studioLighting(s);
  const cam=new THREE.PerspectiveCamera(30,width/height,.1,50);
  if(view){const p=cameraPositionForView(view);cam.position.set(p.x,p.y,p.z);}
  else if(angle===1){cam.position.set(5.3,1.8,5.8);group.scale.setScalar(1.12);}
  else if(angle===2){cam.position.set(-2.3,1.3,-7.6);group.scale.setScalar(1.02);}
  else cam.position.set(2.6,1.3,7.8);
  cam.lookAt(0,0,0);snapshotRenderer.render(s,cam);
  const src=snapshotRenderer.domElement.toDataURL('image/webp',.92);disposeMaterials(group);return src;
}
async function updateGallery() {
  const request=++galleryRequest; const p=current,color=selectedColor;
  const grid=$('.gallery-grid');grid.replaceChildren();
  function addCard(src,title,fit='contain',position='center',image=null){
    const button=document.createElement('button');button.className='gallery-card'+(!grid.children.length?' gallery-wide':'');button.setAttribute('aria-label',title||`${displayName(p)} ${language==='zh'?'外观图片':'Product image'}`);
    const img=document.createElement('img');img.src=src;img.alt=title||displayName(p);img.style.objectFit=fit;img.style.objectPosition=position;img.loading='lazy';button.append(img);if(image)applyGalleryLayout(button,img,image,grid.children.length);
    if(title){const caption=document.createElement('span');caption.className='gallery-caption';caption.textContent=title;button.append(caption);}
    button.onclick=()=>{$('#lightboxImage').src=src;$('#lightboxImage').alt=img.alt;$('#lightbox').showModal();};grid.append(button);
  }
  const images=galleryFor(p,color);
  if(images.length){for(const image of images)addCard(assetURL(image.src),language==='zh'?image.title:image.titleEn,image.fit,image.position,image);return;}
  try {
    const original=await loadModel(p);if(request!==galleryRequest)return;
    await new Promise(requestAnimationFrame);if(request!==galleryRequest)return;
    for(const index of [0,1,2]) {
      if(request!==galleryRequest)return;
      const wide=index===0;
      addCard(snapshot(original,{width:wide?1600:900,height:wide?760:730,product:p,color,angle:index}),[tr('form'),tr('profile'),tr('surface')][index]);
      await new Promise(requestAnimationFrame);
    }
  }catch(error){console.error('Gallery rendering failed',error);}
}
async function createModelButtons() {
  $('#modelList').replaceChildren();$('#catalogGrid').replaceChildren();$('.category-active>span').textContent=String(products.length).padStart(2,'0');
  for(const p of products){
    const b=document.createElement('button');b.className='model-button';b.dataset.id=p.id;b.setAttribute('role','tab');b.setAttribute('aria-label',`${displayName(p)} Smart Tag`);b.setAttribute('aria-selected',String(p.id===current.id));b.tabIndex=p.id===current.id?0:-1;
    const img=document.createElement('img');img.alt=`${displayName(p)} 外观缩略图`;img.width=78;img.height=66;
    const text=document.createElement('span');text.textContent=displayName(p);b.append(img,text);b.onclick=()=>selectProduct(p.id);$('#modelList').append(b);
    b.onkeydown=event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();stepModel(event.key==='ArrowLeft'?-1:1);const next=$(`.model-button[data-id="${current.id}"]`);next.focus();}};
    const card=document.createElement('button');card.className='catalog-card';card.dataset.id=p.id;card.setAttribute('aria-pressed',String(p.id===current.id));const cardImg=img.cloneNode();const cardTitle=document.createElement('span');cardTitle.textContent=displayName(p);const small=document.createElement('small');small.textContent=`${p.colors.length} ${language==='zh'?'款配色':'colors'}`;card.append(cardImg,cardTitle,small);card.onclick=()=>{selectProduct(p.id);$('#catalogDialog').close();window.scrollTo({top:0,behavior:reducedMotion.matches?'instant':'smooth'});};$('#catalogGrid').append(card);
    loadModel(p).then(original=>{const src=snapshot(original,{width:330,height:270,product:p,color:p.colors[0],view:DEFAULT_VIEW,thumbnail:true});img.src=cardImg.src=src;}).catch(()=>{img.alt=displayName(p);});
  }
  updateRailPagination();
}
function updateRailPagination(){
  const pager=$('#railPagination'),count=products.length;
  pager.hidden=false;
  if(pager.querySelectorAll('.rail-page').length!==count){
    const indicator=document.createElement('span');indicator.className='rail-indicator';indicator.setAttribute('aria-hidden','true');
    pager.replaceChildren(indicator);
    for(let i=0;i<count;i++){
      const button=document.createElement('button');button.type='button';button.className='rail-page';
      button.append(document.createElement('span'));
      button.onclick=()=>selectProduct(products[i].id);
      pager.append(button);
    }
  }
  pager.style.setProperty('--rail-count',count);
  pager.style.setProperty('--rail-active',Math.max(0,products.indexOf(current)));
  [...pager.querySelectorAll('.rail-page')].forEach((button,i)=>{button.setAttribute('aria-label',language==='zh'?`切换至 ${displayName(products[i])}`:`Show ${displayName(products[i])}`);button.setAttribute('aria-current',String(products[i].id===current.id));});
}
function revealSelectedModel(){
  const list=$('#modelList'),button=list.querySelector(`[data-id="${current.id}"]`);if(!button)return;
  const parent=list.getBoundingClientRect(),item=button.getBoundingClientRect();
  const delta=item.left<parent.left?item.left-parent.left:item.right>parent.right?item.right-parent.right:0;
  if(delta)list.scrollTo({left:list.scrollLeft+delta,behavior:reducedMotion.matches?'instant':'smooth'});
}
function stepModel(direction){const n=products.indexOf(current);selectProduct(products[(n+direction+products.length)%products.length].id);}
function setLanguage(){language=language==='zh'?'en':'zh';unitSystem=language==='zh'?'metric':'imperial';document.documentElement.lang=language==='zh'?'zh-CN':'en';$('#languageButton').textContent=language==='zh'?'EN':'中';$('#languageButton').setAttribute('aria-label',language==='zh'?'Switch to English':'切换中文');document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=tr(el.dataset.i18n));updateProductUI();updateGallery();for(const card of document.querySelectorAll('.catalog-card')){const p=products.find(p=>p.id===card.dataset.id);card.querySelector('small').textContent=`${p.colors.length} ${language==='zh'?'款配色':'colors'}`;}}
function editorView(){const f=$('#editorForm');return normalizeView({yaw:f.elements.viewYaw.value,pitch:f.elements.viewPitch.value,roll:f.elements.viewRoll.value,distance:f.elements.viewDistance.value,modelYaw:f.elements.viewModelYaw.value,modelPitch:f.elements.viewModelPitch.value});}
function fillEditorView(view){const f=$('#editorForm'),v=normalizeView(view);for(const key of ['yaw','pitch','roll','distance','modelYaw','modelPitch'])f.elements['view'+key[0].toUpperCase()+key.slice(1)].value=Number(v[key].toFixed(2));}
async function updateAnglePreview(){
  if(!$('#angleSettings').open)return;
  const request=++anglePreviewRequest,p=products.find(p=>p.id===$('#editorProduct').value),v=editorView();appearanceStudio.product.view=v;appearanceStudio.draw();
  try{const original=await loadModel(p);if(request!==anglePreviewRequest)return;$('#anglePreview').src=snapshot(original,{width:700,height:400,product:appearanceStudio.product,color:p.id===current.id&&appearanceStudio.product.colors.includes(selectedColor)?selectedColor:appearanceStudio.color,view:v});$('#anglePreview').alt=`${displayName(p)} 展示角度预览`;}catch{$('#anglePreview').alt='角度预览暂时不可用';}
}
async function refreshThumbnail(p){
  try{const original=await loadModel(p);const src=snapshot(original,{width:330,height:270,product:p,color:p.colors[0],view:DEFAULT_VIEW,thumbnail:true});for(const img of document.querySelectorAll(`.model-button[data-id="${p.id}"] img,.catalog-card[data-id="${p.id}"] img`))img.src=src;}catch{/* A failed thumbnail must not prevent saving product details. */}
}
function editorDerived(){
  const form=$('#editorForm');const d=measurement(form.elements.dimensions.value,'dimensions','imperial'),w=measurement(form.elements.weight.value,'weight','imperial');
  $('#dimensionPreview').textContent=d.primary==='—'?'输入尺寸后自动换算为 inch':d.valid?`英制：${d.primary}`:'请输入数字与单位，例如 35 × 35 × 7.5 mm';
  $('#weightPreview').textContent=w.primary==='—'?'输入重量后自动换算为 oz':w.valid?`英制：${w.primary}`:'请输入数字与单位，例如 10 g';
  for(const key of ['power','battery','material','protection','accessory']){
    const input=form.elements[key+'En'];const suggestion=englishSuggestion(form.elements[key].value);input.placeholder=suggestion||'填写英文；留空时显示待翻译';
  }
}
function fillEditorDraft(p){p={...p,view:{...products.find(x=>x.id===p.id)?.view,...p.view}};const f=$('#editorForm');for(const key of ['dimensions','power','weight','battery','material','protection','accessory'])f.elements[key].value=p[key]||'';for(const key of ['power','battery','material','protection','accessory'])f.elements[key+'En'].value=p.english?.[key]||'';f.elements.platform.value=compatibilityMode(p);fillEditorView(p.view);appearanceStudio.load(p);specificationStudio.load(p);editorDerived();updateAnglePreview();}
function editorLoad(id){const p=products.find(p=>p.id===id);fillEditorDraft(p);$('#editorStatus').textContent='';if($('#historySettings').open)loadHistory();}
async function loadHistory(){
  const id=$('#editorProduct').value,request=++historyRequest;$('#historyMessage').textContent='正在读取保存记录…';
  try{const response=await fetch('/api/products/'+id+'/history',{cache:'no-store'});if(!response.ok)throw new Error();const result=await response.json();if(request!==historyRequest||$('#editorProduct').value!==id)return;historyVersions=result.versions;$('#historyVersion').replaceChildren();for(const v of historyVersions){const option=document.createElement('option');option.value=v.revision;option.textContent=`版本 ${v.revision} · ${new Date(v.createdAt).toLocaleString('zh-CN')}`;$('#historyVersion').append(option);}$('#loadHistory').disabled=!historyVersions.length;$('#historyMessage').textContent=historyVersions.length?'载入后可先检查，点击“保存到网站”才会更新当前资料。':'尚无历史记录，下一次保存会自动保留版本。';}
  catch{$('#historyMessage').textContent='暂时无法读取记录，请稍后重试。';}
}
async function saveEditor(event){
  event.preventDefault();if(appearanceStudio.busy)return;const form=event.currentTarget;
  const specErrors=specificationStudio.errors();if(specErrors.length){$('#editorStatus').textContent='请检查这些自定义参数的尺寸／重量格式：'+specErrors.join('、');return;}
  for(const kind of ['dimensions','weight'])if(!measurement(form.elements[kind].value,kind).valid){$('#editorStatus').textContent=kind==='dimensions'?'尺寸格式无法识别，请输入如 35 × 35 × 7.5 mm。':'重量格式无法识别，请输入如 10 g。';form.elements[kind].focus();return;}
  const p=products.find(p=>p.id===form.elements.product.value),draft={...structuredClone(p),...appearanceStudio.values(),_revision:appearanceStudio.product._revision??p._revision};
  for(const key of ['dimensions','power','weight','battery','material','protection','accessory'])draft[key]=form.elements[key].value.trim().slice(0,160);
  draft.english={};for(const key of ['power','battery','material','protection','accessory'])draft.english[key]=form.elements[key+'En'].value.trim().slice(0,240);
  draft.compatibility=form.elements.platform.value;draft.view=editorView();draft.specifications=specificationStudio.values();normalizeProduct(draft);normalizeAppearance(draft);
  $('#saveProduct').disabled=true;$('#editorProduct').disabled=true;$('#editorStatus').textContent='正在保存到网站…';
  try{
    const response=await fetch('/api/products/'+p.id,{method:'PUT',headers:{'Content-Type':'application/json','X-Studio-Request':'1'},body:JSON.stringify(draft)}),result=await response.json();if(!response.ok)throw new Error(result.error||'保存失败。');
    Object.assign(p,result);appearanceStudio.product._revision=p._revision;
    try{backupCatalog(localStorage,data);}catch{}
    const pending=missingEnglish(p).length+missingSpecificationEnglish(p.specifications).length;$('#editorStatus').textContent='已保存到网站，换设备也可读取。'+(pending?`另有 ${pending} 项内容待填写英文。`:'');
    if(p.id===current.id)await selectProduct(p.id,false,true);refreshThumbnail(p);
    for(const card of document.querySelectorAll('.catalog-card')){const product=products.find(p=>p.id===card.dataset.id);card.querySelector('small').textContent=`${product.colors.length} ${language==='zh'?'款配色':'colors'}`;}
    if($('#historySettings').open)loadHistory();
  }catch(error){$('#editorStatus').textContent=error.message||'保存失败，请重试。';}
  finally{$('#saveProduct').disabled=false;$('#editorProduct').disabled=false;}
}
function setupEvents(){
  $('#copyShareLink').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/');$('#shareStatus').textContent='展示链接已复制，任何拿到链接的人都可只读浏览。';}catch{$('#shareStatus').textContent=location.origin+'/';}};
  $('#viewExternal').href=location.origin+'/';
  const catalogStudio=new CatalogStudio(async result=>{adoptCatalog(result);$('#editorStatus').textContent='型号顺序已保存到网站。';toast('型号顺序已更新');});
  $('#manageOrder').onclick=()=>catalogStudio.open();
  $('#applyLightingAll').onclick=applyLightingAll;
  for(const button of $('#materialVariants').children)button.onclick=()=>{if(button.dataset.finish===current.appearance.materialMode)return;productColors.set(current.id+'|'+current.appearance.materialMode,selectedColor);current.appearance.materialMode=button.dataset.finish;selectProduct(current.id,false,true);};
  $('#coverToggle').onclick=()=>{stage.setCover(!stage.coverOpen,reducedMotion.matches);$('#rotateButton').setAttribute('aria-pressed','false');$('#rotateButton').setAttribute('aria-label','开启自动旋转');updateCoverButton();};
  modelStudio=new ModelStudio(async result=>{
    normalizeProduct(result);normalizeAppearance(result);const existing=products.find(p=>p.id===result.id);if(existing)Object.assign(existing,result);else products.push(result);
    if(!data.orderRevision)products.splice(0,products.length,...orderProducts(products));
    try{backupCatalog(localStorage,data);}catch{}
    refreshEditorProducts();createModelButtons();$('#editorProduct').value=result.id;editorLoad(result.id);await selectProduct(result.id,false,true);$('#editorStatus').textContent='模型已保存，参数、配色与展示图片可继续编辑。';
  });
  $('#addModel').onclick=()=>modelStudio.open();$('#replaceModel').onclick=()=>modelStudio.open(products.find(p=>p.id===$('#editorProduct').value));
  $('#previousModel').onclick=()=>stepModel(-1);$('#nextModel').onclick=()=>stepModel(1);
  $('#catalogButton').onclick=()=>$('#catalogDialog').showModal();
  $('#categoryButton').onclick=()=>{const next=$('#categoryMenu').hidden;$('#categoryMenu').hidden=!next;$('#categoryButton').setAttribute('aria-expanded',String(next));};
  $('.category-active').onclick=()=>{$('#categoryMenu').hidden=true;$('#categoryButton').setAttribute('aria-expanded','false');};
  document.addEventListener('click',e=>{if(!e.target.closest('.category-menu,.category-button')){$('#categoryMenu').hidden=true;$('#categoryButton').setAttribute('aria-expanded','false');}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#categoryMenu').hidden=true;$('#categoryButton').setAttribute('aria-expanded','false');}});
  $('#resetButton').onclick=resetView;
  $('#rotateButton').onclick=()=>{stage.autoRotate=!stage.autoRotate;$('#rotateButton').setAttribute('aria-pressed',String(stage.autoRotate));$('#rotateButton').setAttribute('aria-label',stage.autoRotate?'暂停自动旋转':'开启自动旋转');};
  $('#fullscreenButton').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await viewer.requestFullscreen();}catch{toast(language==='zh'?'当前环境不支持全屏':'Fullscreen is unavailable.');}};
  $('#retryLoad').onclick=()=>selectProduct(current.id);
  $('#languageButton').onclick=setLanguage;
  $('#unitMode').onclick=()=>{unitSystem=unitSystem==='metric'?'imperial':'metric';updateProductUI();};
  document.querySelectorAll('dialog').forEach(dialog=>{dialog.querySelector('.dialog-close').onclick=()=>{if(dialog.dataset.busy!=='true')dialog.close();};dialog.addEventListener('click',e=>{if(e.target===dialog&&dialog.dataset.busy!=='true'){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});});
  document.querySelectorAll('.gallery-card').forEach((b,i)=>b.onclick=()=>{const img=b.querySelector('img');if(!img.src)return;$('#lightboxImage').src=img.src;$('#lightboxImage').alt=img.alt;$('#lightbox').showModal();});
  $('#accessoryButton').onclick=()=>toast(`${displayName(current)} · ${translatedField(current,'accessory',language)}${language==='zh'?'，展示资料待补充':' · images to be added'}`);
  $('#editButton').onclick=()=>{if(!canEdit)return;$('#editorProduct').value=current.id;editorLoad(current.id);$('#editorDialog').showModal();};
  refreshEditorProducts();
  $('#editorProduct').onchange=e=>editorLoad(e.target.value);
  $('#historySettings').addEventListener('toggle',()=>{if($('#historySettings').open)loadHistory();});
  $('#loadHistory').onclick=()=>{const version=historyVersions.find(v=>String(v.revision)===$('#historyVersion').value),current=products.find(p=>p.id===$('#editorProduct').value);if(!version)return;fillEditorDraft({...current,...version.product,model:current.model,parts:current.parts,_revision:current._revision});$('#editorStatus').textContent=`已载入版本 ${version.revision}，请检查后保存。`;};
  $('#importJson').onchange=async event=>{try{const file=event.target.files?.[0];if(!file)return;if(file.size>2*1024*1024)throw new Error('资料文件请控制在 2 MB 内。');const saved=legacyMap(JSON.parse(await file.text())),id=$('#editorProduct').value,old=saved[id],p=products.find(p=>p.id===id);if(!old)throw new Error('备份中没有当前型号，请先切换对应型号。');fillEditorDraft({...p,...old,model:p.model,parts:p.parts,_revision:p._revision});$('#editorStatus').textContent='已载入当前型号的备份，检查后点击保存到网站。';}catch(error){$('#editorStatus').textContent=error.message||'无法读取备份文件。';}finally{event.target.value='';}};
  $('#dismissRecovery').onclick=()=>$('#recoveryNotice').hidden=true;
  $('#editorForm').addEventListener('input',event=>{editorDerived();if(event.target.name?.startsWith('view'))updateAnglePreview();});
  $('#angleSettings').addEventListener('toggle',()=>{if($('#angleSettings').open)updateAnglePreview();});
  for(const button of document.querySelectorAll('[data-view-preset]'))button.onclick=()=>{const presets={front:{yaw:0,pitch:0,distance:9.35},quarter:{yaw:25,pitch:12,distance:9.35},back:{yaw:180,pitch:0,distance:9.35}};fillEditorView({...editorView(),...presets[button.dataset.viewPreset]});updateAnglePreview();};
  $('#flipModel').onclick=()=>{const view=editorView();fillEditorView({...view,modelYaw:((view.modelYaw+180)%360)>180?((view.modelYaw+180)%360)-360:(view.modelYaw+180)%360});updateAnglePreview();};
  $('#resetModelRotation').onclick=()=>{fillEditorView({...editorView(),modelYaw:0,modelPitch:0,roll:0});updateAnglePreview();};
  $('#captureView').onclick=()=>{fillEditorView(stage.getView());updateAnglePreview();};
  $('#fillEnglish').onclick=()=>{const f=$('#editorForm');let count=0;for(const key of ['power','battery','material','protection','accessory']){const input=f.elements[key+'En'];if(!input.value.trim()){const text=englishSuggestion(f.elements[key].value);if(text){input.value=text;count++;}}}$('#editorStatus').textContent=count?`已补全 ${count} 项常用术语的英文。`:'没有可自动补全的术语，请填写对应英文。';};
  $('#editorForm').onsubmit=saveEditor;
  try{$('#importLegacy').hidden=!localStorage.getItem('tag-studio-details-v1');}catch{}
  $('#importLegacy').onclick=()=>{const imported=safeStoredData(structuredClone(data)),p=imported.products.find(p=>p.id===$('#editorProduct').value);fillEditorDraft(p);$('#editorStatus').textContent='已导入当前型号的旧预览，检查后点击保存到网站。';};
  $('#exportData').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='products.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#editorStatus').textContent='已导出产品资料。';};
  new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)entry.target.classList.add('in-view');}),{threshold:.08}).observe($('#specifications'));
  new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)entry.target.classList.add('in-view');}),{threshold:.03}).observe($('#gallerySection'));
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches&&stage){stage.autoRotate=false;$('#rotateButton').setAttribute('aria-pressed','false');$('#rotateButton').setAttribute('aria-label','开启自动旋转');}});
}
function adoptCatalog(result,{lightingSync=false}={}){
  const selected=$('#editorProduct').value,currentId=current.id,previous=new Map(products.map(p=>[p.id,p])),modes=new Map(products.map(p=>[p.id,p.appearance.materialMode]));
  products=result.products.map(fresh=>{const p=previous.get(fresh.id)||{};Object.assign(p,fresh);normalizeProduct(p);normalizeAppearance(p);if(modes.get(p.id)==='eco'&&p.appearance.eco.enabled)p.appearance.materialMode='eco';return p;});
  data={...result,products};current=products.find(p=>p.id===currentId)||products[0];
  refreshEditorProducts();if(products.some(p=>p.id===selected))$('#editorProduct').value=selected;
  const edited=products.find(p=>p.id===appearanceStudio.product?.id);if(edited&&lightingSync&&edited._revision===(appearanceStudio.product._revision||0)+1)appearanceStudio.product._revision=edited._revision;
  createModelButtons();updateProductUI();revealSelectedModel();try{backupCatalog(localStorage,data);}catch{}
}
async function applyLightingAll(){
  if(appearanceStudio.busy)return;const exposure=appearanceStudio.product.appearance.lighting.exposure,fields=['applyLightingAll','studioEnvironment','studioExposure','studioExposurePercent','saveProduct','editorProduct','galleryUpload','manageOrder','addModel','replaceModel'],disabled=new Map();
  for(const id of fields){const el=$('#'+id);disabled.set(id,el.disabled);el.disabled=true;}appearanceStudio.busy=true;$('#lightingSyncStatus').textContent='正在同步光照…';
  try{const response=await fetch('/api/catalog/lighting',{method:'PUT',headers:{'X-Studio-Request':'1','Content-Type':'application/json'},body:JSON.stringify({exposure})}),result=await response.json();if(!response.ok)throw new Error(result.error||'光照同步失败。');adoptCatalog(result,{lightingSync:true});await selectProduct(current.id,false,true);$('#lightingSyncStatus').textContent=`已将 ${Math.round(exposure*100)}% 曝光同步到 ${result.updatedCount} 个型号。`;if($('#historySettings').open)loadHistory();}
  catch(error){$('#lightingSyncStatus').textContent=error.message||'光照同步失败，请重试。';}
  finally{appearanceStudio.busy=false;for(const id of fields)$('#'+id).disabled=disabled.get(id);}
}
function updateCoverButton(){const button=$('#coverToggle');button.hidden=current?.id!=='16'||!stage?.canOpenCover;button.setAttribute('aria-pressed',String(!!stage?.coverOpen));button.textContent=stage?.coverOpen?(language==='zh'?'关闭防尘盖':'Close cover'):(language==='zh'?'打开防尘盖':'Open cover');}
function refreshEditorProducts(){const select=$('#editorProduct'),id=select.value;select.replaceChildren();for(const p of products){const option=document.createElement('option');option.value=p.id;option.textContent=displayName(p);select.append(option);}if(products.some(p=>p.id===id))select.value=id;}

async function init(){
  try{
    const response=await fetch(new URL('./catalog.json',document.baseURI),{cache:'no-store'});if(!response.ok)throw new Error(`Product data ${response.status}`);
    data=await response.json();const session={canEdit:false};canEdit=false;$('#editButton').hidden=!canEdit;$('#adminEntry').hidden=canEdit;$('#adminTools').hidden=!canEdit;
    let recovery={synced:0,pending:0};if(canEdit)try{recovery=await recoverLegacy(data);backupCatalog(localStorage,data);}catch{}
    if(recovery.synced||recovery.pending){$('#recoveryNotice').hidden=false;$('#recoveryText').textContent=recovery.pending?`已恢复旧版资料；${recovery.pending} 款尚未同步，请在资料编辑中保存。`:`已自动恢复 ${recovery.synced} 款旧版资料，并保存到网站。`;}
    data.products.forEach(p=>{p.model=assetURL(p.model);normalizeProduct(p);normalizeAppearance(p);p.view=normalizeView(p.view);});products=data.products;current=products[0];
    appearanceStudio=new AppearanceStudio(loadModel);specificationStudio=new SpecificationStudio($('#editorForm'),editorDerived);setupScene();setupEvents();
    await selectProduct(current.id,true);
    createModelButtons();
  }catch(error){console.error('Showroom initialization failed',error);showLoadError('暂时无法显示三维产品，请重新加载。');}
}
init();
