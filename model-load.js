// Coordinate model-viewer's property-based loading. Its src property does not
// reflect to the HTML attribute, and a cached src does not emit another load.
export class ModelLoad{
 constructor(element,baseURL=globalThis.location?.href||'http://localhost/'){this.element=element;this.baseURL=baseURL;this.pending=null;this.readyKey=element.loaded&&element.model?this.key(element.src):'';}
 key(src){return src?new URL(src,this.baseURL).href:'';}
 load(src){
  const key=this.key(src),e=this.element;
  if(this.pending?.key===key)return this.pending.promise;
  this.pending?.finish(false);
  if(e.loaded&&e.model&&(this.key(e.src)===key||this.readyKey===key)){e.src=key;this.readyKey=key;return Promise.resolve(true);}
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const clean=()=>{clearTimeout(timer);e.removeEventListener('load',done);e.removeEventListener('error',error);if(this.pending?.promise===promise)this.pending=null;};
  const done=event=>{if(event.detail?.url&&this.key(event.detail.url)!==key)return;clean();this.readyKey=key;resolve(true);};
  const error=()=>{clean();this.readyKey='';e.src=null;reject(new Error('Model could not load. Please retry.'));};
  const timer=setTimeout(error,90000);this.pending={key,promise,finish:value=>{clean();resolve(value);}};
  e.addEventListener('load',done);e.addEventListener('error',error);e.src=key;return promise;
 }
}
