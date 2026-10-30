const $=s=>document.querySelector(s);
export class CatalogStudio{
  constructor(saved){this.saved=saved;this.busy=false;this.request=0;$('#orderForm').onsubmit=e=>{e.preventDefault();this.save();};$('#orderDialog').addEventListener('close',()=>this.request++);$('#orderDialog').addEventListener('cancel',e=>{if(this.busy)e.preventDefault();});}
  async open(){
    const request=++this.request;$('#orderDialog').showModal();$('#orderList').replaceChildren();$('#orderStatus').textContent='正在读取当前顺序…';$('#saveOrder').disabled=true;
    try{const response=await fetch('/api/catalog',{cache:'no-store'});if(!response.ok)throw new Error('无法读取型号列表。');const data=await response.json();if(request!==this.request)return;this.products=data.products;this.revision=data.orderRevision;this.render();$('#orderStatus').textContent='';$('#saveOrder').disabled=false;}catch(error){$('#orderStatus').textContent=error.message;}
  }
  move(from,to){if(this.busy||from<0||from>=this.products.length||to<0||to>=this.products.length||from===to)return;const [p]=this.products.splice(from,1);this.products.splice(to,0,p);this.render();}
  render(){
    const list=$('#orderList');list.replaceChildren();
    this.products.forEach((p,i)=>{
      const row=document.createElement('li');row.className='order-row';row.draggable=!this.busy;
      const handle=document.createElement('span');handle.className='order-grip';handle.textContent='⠿';handle.setAttribute('aria-hidden','true');
      const number=document.createElement('span');number.className='order-number';number.textContent=String(i+1).padStart(2,'0');
      const name=document.createElement('span');name.className='order-name';name.textContent=p.name;
      row.append(handle,number,name);
      for(const [text,direction,label]of [['↑',-1,'上移'],['↓',1,'下移']]){const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',p.name+' '+label);b.disabled=this.busy||i+direction<0||i+direction>=this.products.length;b.onclick=()=>{this.move(i,i+direction);list.querySelectorAll('.order-row')[i+direction]?.querySelector(`button[aria-label$="${label}"]`)?.focus();};row.append(b);}
      row.ondragstart=e=>{this.dragged=p.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',p.id);row.classList.add('dragging');};
      row.ondragover=e=>{if(!this.busy){e.preventDefault();e.dataTransfer.dropEffect='move';row.classList.add('drop-target');}};
      row.ondragleave=()=>row.classList.remove('drop-target');row.ondragend=()=>{this.dragged=null;for(const el of list.children)el.classList.remove('dragging','drop-target');};
      row.ondrop=e=>{e.preventDefault();this.move(this.products.findIndex(x=>x.id===this.dragged),i);};list.append(row);
    });
  }
  async save(){
    if(this.busy||!this.products)return;this.busy=true;$('#orderDialog').dataset.busy='true';$('#saveOrder').disabled=true;this.render();$('#orderStatus').textContent='正在保存顺序…';
    try{const response=await fetch('/api/catalog/order',{method:'PUT',headers:{'X-Studio-Request':'1','Content-Type':'application/json'},body:JSON.stringify({revision:this.revision,ids:this.products.map(p=>p.id)})});const result=await response.json();if(!response.ok)throw new Error(result.error||'保存失败。');await this.saved(result);$('#orderDialog').close();}
    catch(error){$('#orderStatus').textContent=error.message;}
    finally{this.busy=false;$('#orderDialog').dataset.busy='false';$('#saveOrder').disabled=false;this.render();}
  }
}
