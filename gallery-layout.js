export const GALLERY_RATIOS={auto:'自动比例',original:'原图比例',square:'1:1 方形',landscape:'4:3 横图',wide:'16:9 横幅',portrait:'3:4 竖图'};
const clamp=v=>Number.isFinite(Number(v))?Math.max(0,Math.min(100,Number(v))):50;
const anchors={center:[50,50],top:[50,0],bottom:[50,100],left:[0,50],right:[100,50]};
export function normalizeGalleryLayout(image){
  const point=anchors[image.position]||anchors.center;
  return {ratio:Object.hasOwn(GALLERY_RATIOS,image.ratio)?image.ratio:'auto',span:['full','half'].includes(image.span)?image.span:'auto',crop:{x:clamp(image.crop?.x??point[0]),y:clamp(image.crop?.y??point[1])}};
}
export function cropPosition(image){const {crop}=normalizeGalleryLayout(image);return `${crop.x}% ${crop.y}%`;}
export function galleryLayout(image,index=0){
  const g=normalizeGalleryLayout(image),full=g.span==='full'||g.span==='auto'&&index===0;
  return {full,ratio:({auto:full?'2.3':'1.32',original:null,square:'1',landscape:'4 / 3',wide:'16 / 9',portrait:'3 / 4'})[g.ratio]};
}
export function applyGalleryLayout(frame,img,image,index=0){
  const {full,ratio}=galleryLayout(image,index);frame.classList.add('gallery-custom');frame.classList.toggle('gallery-wide',full);frame.style.gridColumn=full?'1 / -1':'auto';
  const updateRatio=()=>{frame.style.aspectRatio=ratio||(img.naturalWidth&&img.naturalHeight?`${img.naturalWidth} / ${img.naturalHeight}`:'1');};
  img.onload=updateRatio;updateRatio();img.style.objectFit=image.fit;img.style.objectPosition=cropPosition(image);
}
// Cover crops move opposite to object-position percentages. Account for the
// rendered overflow so the visible image follows the pointer precisely.
export function draggedCrop(start,dx,dy,overflowX,overflowY){
  return {x:clamp(start.x-(overflowX>1?dx/overflowX*100:0)),y:clamp(start.y-(overflowY>1?dy/overflowY*100:0))};
}
