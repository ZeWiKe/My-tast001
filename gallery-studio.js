import {GALLERY_RATIOS,applyGalleryLayout,normalizeGalleryLayout,cropPosition,draggedCrop} from './gallery-layout.js';
const el=(tag,props={},children=[])=>{const n=document.createElement(tag);for(const [k,v]of Object.entries(props)){if(k==='text')n.textContent=v;else n.setAttribute(k,v);}n.append(...children);return n;};
const label=(text,input)=>el('label',{},[el('span',{text}),input]);
export function renderGalleryEditor(studio){
  const root=document.querySelector('#galleryEditor');root.replaceChildren();
  const overview=el('div',{class:'gallery-layout-preview','aria-label':'外观细节排版预览'});
  const overviewItems=[];
  if(studio.product.gallery.length)root.append(el('div',{class:'gallery-layout-header',text:'整体排版预览'}),overview);
  const refreshOverview=()=>overviewItems.forEach(({frame,img,image,index})=>applyGalleryLayout(frame,img,image,index));
  for(const [index,image]of studio.product.gallery.entries()){
    Object.assign(image,normalizeGalleryLayout(image));
    const thumb=el('img',{src:image.src,alt:''}),tile=el('div',{class:'gallery-layout-tile'},[thumb]);overview.append(tile);overviewItems.push({frame:tile,img:thumb,image,index});
    const frame=el('div',{class:'gallery-crop-preview',tabindex:'0',role:'group','aria-label':`图片 ${index+1} 展示位置，拖动或用方向键调整`}),preview=el('img',{src:image.src,alt:`图片 ${index+1}`,draggable:'false'});frame.append(preview);
    const positionReadout=el('small',{class:'gallery-position-readout'});
    const refresh=()=>{applyGalleryLayout(frame,preview,image,index);frame.classList.toggle('can-drag',image.fit==='cover');positionReadout.textContent=image.fit==='cover'?`拖动调整位置 · ${Math.round(image.crop.x)}% / ${Math.round(image.crop.y)}%`:'完整显示 · 无裁切';refreshOverview();};
    const select=(name,choices,value,change)=>{const input=el('select',{'aria-label':`图片 ${index+1} ${name}`},choices.map(([value,text])=>el('option',{value,text})));input.value=value;input.onchange=()=>{change(input.value);refresh();};return label(name,input);};
    const color=select('适用配色',[['all','全部配色'],...studio.product.colors.map(id=>[id,studio.product.appearance.palette[id].name])],image.color,v=>image.color=v);
    const fit=select('填充方式',[['cover','铺满裁切'],['contain','完整显示']],image.fit,v=>image.fit=v);
    const ratio=select('展示比例',Object.entries(GALLERY_RATIOS),image.ratio,v=>image.ratio=v);
    const span=select('占用宽度',[['auto','自动排列'],['full','整行'],['half','半行 · 双列']],image.span,v=>image.span=v);
    const title=el('input',{value:image.title,maxlength:80,placeholder:'中文说明（可留空）','aria-label':`图片 ${index+1} 中文说明`});title.oninput=()=>image.title=title.value;
    const english=el('input',{value:image.titleEn,maxlength:100,placeholder:'English caption (optional)','aria-label':`Image ${index+1} English caption`});english.oninput=()=>image.titleEn=english.value;
    const controls=el('div',{class:'gallery-row-actions'});
    const center=el('button',{type:'button',text:'位置居中','aria-label':`图片 ${index+1} 位置居中`});center.onclick=()=>{image.crop={x:50,y:50};refresh();};controls.append(center);
    for(const [text,direction]of [['前移',-1],['后移',1]]){const b=el('button',{type:'button',text,'aria-label':`图片 ${index+1} ${text}`});b.disabled=index+direction<0||index+direction>=studio.product.gallery.length;b.onclick=()=>{const to=index+direction;[studio.product.gallery[index],studio.product.gallery[to]]=[studio.product.gallery[to],studio.product.gallery[index]];renderGalleryEditor(studio);};controls.append(b);}
    const replace=el('input',{type:'file',accept:'image/jpeg,image/png,image/webp','aria-label':`替换图片 ${index+1}`});replace.onchange=()=>studio.upload(replace.files,index);
    const remove=el('button',{type:'button',text:'移除','aria-label':`移除图片 ${index+1}`});remove.onclick=()=>{studio.product.gallery.splice(index,1);renderGalleryEditor(studio);};controls.append(label('替换',replace),remove);
    const fields=el('div',{class:'gallery-row-fields'},[el('small',{text:`图片 ${String(index+1).padStart(2,'0')}`}),title,english,el('div',{class:'gallery-layout-options'},[ratio,span,fit,color]),controls]);
    root.append(el('div',{class:'gallery-editor-row'},[el('div',{class:'gallery-crop-column'},[frame,positionReadout]),fields]));
    let drag;
    frame.onpointerdown=e=>{if(image.fit!=='cover'||e.button!==0)return;e.preventDefault();const r=frame.getBoundingClientRect(),scale=Math.max(r.width/preview.naturalWidth,r.height/preview.naturalHeight);if(!Number.isFinite(scale))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,start:{...image.crop},overflowX:preview.naturalWidth*scale-r.width,overflowY:preview.naturalHeight*scale-r.height};frame.setPointerCapture(e.pointerId);frame.classList.add('dragging');};
    frame.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;image.crop=draggedCrop(drag.start,e.clientX-drag.x,e.clientY-drag.y,drag.overflowX,drag.overflowY);preview.style.objectPosition=cropPosition(image);positionReadout.textContent=`拖动调整位置 · ${Math.round(image.crop.x)}% / ${Math.round(image.crop.y)}%`;refreshOverview();};
    const end=e=>{if(drag?.id!==e.pointerId)return;drag=null;frame.classList.remove('dragging');if(frame.hasPointerCapture(e.pointerId))frame.releasePointerCapture(e.pointerId);};frame.onpointerup=end;frame.onpointercancel=end;frame.onlostpointercapture=()=>{drag=null;frame.classList.remove('dragging');};
    frame.onkeydown=e=>{if(image.fit!=='cover'||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const delta=e.shiftKey?10:2,x=image.crop.x+({'ArrowLeft':2,'ArrowRight':-2}[e.key]||0)*delta/2,y=image.crop.y+({'ArrowUp':2,'ArrowDown':-2}[e.key]||0)*delta/2;image.crop=normalizeGalleryLayout({crop:{x,y}}).crop;refresh();};
    refresh();
  }
  document.querySelector('#galleryEmpty').hidden=!!studio.product.gallery.length;
}
