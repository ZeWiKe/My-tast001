import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {inspectModel,exportModel} from './model-import.js';
import {modelId} from './model-metadata.js';
import {FINISHES} from './appearance.js';
import {configureRenderer,studioEnvironment} from './material-engine.js';
const $=s=>document.querySelector(s);
export class ModelStudio{
  constructor(saved){
    this.saved=saved;this.sequence=0;this.busy=false;
    $('#modelFile').onchange=()=>this.inspect();$('#modelImportForm').onsubmit=e=>{e.preventDefault();this.save();};
    $('#modelImportDialog').addEventListener('close',()=>{this.sequence++;this.release();});
    $('#modelImportDialog').addEventListener('cancel',e=>{if(this.busy)e.preventDefault();});
    this.resize=new ResizeObserver(()=>this.render());this.resize.observe($('#importPreview'));
  }
  open(product=null){
    this.sequence++;this.release();this.product=product;$('#modelImportTitle').textContent=product?'替换 '+product.name+' 模型':'新增型号';
    $('#newModelName').value=product?.name||'';$('#newModelName').readOnly=!!product;$('#modelFile').value='';$('#modelParts').replaceChildren();$('#modelImportSave').disabled=true;
    $('#modelImportStatus').textContent=product?'替换会保留已保存的参数、配色和展示图片。':'选择模型后，勾选需要展示的外观部件。';$('#modelImportDialog').showModal();
  }
  release(){if(this.imported){this.imported.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});this.scene?.remove(this.imported.scene);this.imported=null;}if(this.renderer){this.renderer.clear();}}
  async inspect(){
    const file=$('#modelFile').files[0];if(!file)return;const sequence=++this.sequence;this.release();$('#modelImportSave').disabled=true;$('#modelParts').replaceChildren();
    try{
      if(!/\.(fbx|glb)$/i.test(file.name))throw new Error('请选择 FBX 或 GLB 文件。');
      if(file.size>40*1024*1024)throw new Error('源文件请控制在 40 MB 内。');
      $('#modelImportStatus').textContent='正在读取模型…';await new Promise(requestAnimationFrame);
      const result=await inspectModel(await file.arrayBuffer(),file.name);if(sequence!==this.sequence)return;
      if(!result.parts.length||result.parts.length>64)throw new Error('模型请控制在 1–64 个部件。');
      this.imported=result;this.source=file;this.preparePreview();
      for(const part of result.parts){
        const row=document.createElement('div');row.className='model-part-row';
        const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=part.defaultSelected!==false;toggle.setAttribute('aria-label','展示 '+part.label);
        const name=document.createElement('input');name.value=part.label;name.maxLength=70;name.setAttribute('aria-label','部件名称 '+part.label);name.oninput=()=>part.label=name.value;
        const finish=document.createElement('select');finish.setAttribute('aria-label',part.label+' 工艺');for(const [id,preset]of Object.entries(FINISHES)){const option=document.createElement('option');option.value=id;option.textContent=preset.name;finish.append(option);}finish.value=part.defaultFinish||'matte';
        part.selected=toggle.checked;toggle.onchange=()=>{part.selected=toggle.checked;this.updatePart(part);};finish.onchange=()=>{part.defaultFinish=finish.value;this.updatePart(part);};
        row.append(toggle,name,finish);$('#modelParts').append(row);this.updatePart(part);
      }
      $('#modelImportStatus').textContent=`${result.parts.length} 个部件 · 请仅勾选需要公开展示的外观部件。`;this.render();
    }catch(error){$('#modelImportStatus').textContent=error.message||'模型读取失败。';}
  }
  preparePreview(){
    if(!this.renderer){this.renderer=new THREE.WebGLRenderer({canvas:$('#importCanvas'),alpha:true,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));configureRenderer(this.renderer,1,'neutral');this.scene=new THREE.Scene();this.environment=studioEnvironment(this.renderer,'neutral');this.scene.environment=this.environment.texture;this.camera=new THREE.PerspectiveCamera(32,1,.05,50);this.camera.position.set(2,1,8.6);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enablePan=false;this.controls.addEventListener('change',()=>this.render());}
    this.scene.add(this.imported.scene);this.camera.position.set(2,1,8.6);this.controls.target.set(0,0,0);this.controls.update();this.render();
  }
  updatePart(part){
    this.imported.scene.traverse(o=>{if(o.isMesh&&o.name===part.key){o.visible=part.selected;Object.assign(o.material,{roughness:FINISHES[part.defaultFinish]?.roughness||.62,metalness:FINISHES[part.defaultFinish]?.metalness||0,clearcoat:Math.max(.000001,FINISHES[part.defaultFinish]?.clearcoat||0)});o.material.color.set(part.defaultColor||'#cacdce');}});
    $('#modelImportSave').disabled=!this.imported.parts.some(p=>p.selected);this.render();
  }
  render(){if(!this.renderer||!$('#modelImportDialog').open)return;const r=$('#importPreview').getBoundingClientRect();if(!r.width||!r.height)return;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();this.renderer.render(this.scene,this.camera);}
  async save(){
    if(this.busy||!this.imported)return;
    try{
      const id=modelId($('#newModelName').value),parts=this.imported.parts.filter(p=>p.selected);if(!parts.length)throw new Error('请至少选择一个外观部件。');
      this.busy=true;this.setBusy(true);$('#modelImportStatus').textContent='正在整理外观模型…';await new Promise(requestAnimationFrame);
      const bytes=await exportModel(this.imported.scene,parts.map(p=>p.key));if(bytes.byteLength>31*1024*1024)throw new Error('导出后的模型超过 31 MB，请先简化模型。');
      const body=new FormData();body.append('metadata',JSON.stringify({mode:this.product?'replace':'create',revision:this.product?._revision||0,sourceName:this.source.name,sourceFormat:this.source.name.split('.').at(-1).toLowerCase(),parts}));body.append('file',new Blob([bytes],{type:'model/gltf-binary'}),'exterior.glb');
      $('#modelImportStatus').textContent='正在保存模型…';const response=await fetch('/api/models/'+id,{method:'PUT',headers:{'X-Studio-Request':'1'},body});const text=await response.text();let result;try{result=JSON.parse(text);}catch{throw new Error(response.status===413?'模型文件过大，请简化模型后重试。':'模型保存失败，请稍后重试。');}if(!response.ok)throw new Error(result.error||'模型保存失败。');
      await this.saved(result);$('#modelImportDialog').close();
    }catch(error){$('#modelImportStatus').textContent=error.message||'模型保存失败，请重试。';}
    finally{this.busy=false;this.setBusy(false);}
  }
  setBusy(busy){$('#modelImportDialog').dataset.busy=String(busy);for(const el of $('#modelImportDialog').querySelectorAll('input,select,button'))el.disabled=busy;}
}
