import {SPEC_FIELDS,normalizeSpecifications,specificationErrors} from './specifications.js';
import {measurement} from './product-content.js';
const $=s=>document.querySelector(s);
const el=(tag,props={})=>{const n=document.createElement(tag);for(const [key,value]of Object.entries(props)){if(key==='text')n.textContent=value;else n.setAttribute(key,value);}return n;};
export class SpecificationStudio{
  constructor(form,changed){
    this.form=form;this.changed=changed;$('#addSpecification').onclick=()=>{if(this.rows.length>=48)return;const row={id:'spec_'+crypto.randomUUID(),label:'',labelEn:'',value:'',valueEn:'',type:'text',enabled:true};this.rows.push(row);this.render();const card=$('#specEditor').lastElementChild;card?.querySelector('.spec-editor-names input')?.focus();card?.scrollIntoView({block:'nearest',behavior:'smooth'});};
    $('#addBuiltinSpecification').onchange=e=>{const field=e.target.value;if(!field||this.rows.some(r=>r.field===field))return;this.rows.push({id:field,field,...SPEC_FIELDS[field],enabled:true});this.render();};
    form.addEventListener('input',e=>{if(!e.target.closest('#specEditor'))this.syncValues();});form.addEventListener('change',e=>{if(e.target.name==='platform')this.syncValues();});
  }
  load(product){this.product=product;this.rows=normalizeSpecifications(product.specifications);this.render();}
  values(){return normalizeSpecifications(this.rows);}
  errors(){return specificationErrors(this.rows);}
  value(key){if(key==='name')return this.product.name;if(key==='platform')return this.form.elements.platform.selectedOptions[0]?.textContent||'';return this.form.elements[key]?.value||'';}
  syncValues(){for(const input of $('#specEditor').querySelectorAll('[data-core-field]'))input.value=this.value(input.dataset.coreField);for(const update of this.refreshHints||[])update();}
  move(index,delta){const to=index+delta;if(to<0||to>=this.rows.length)return;[this.rows[index],this.rows[to]]=[this.rows[to],this.rows[index]];this.render();}
  render(){
    const root=$('#specEditor');root.replaceChildren();this.refreshHints=[];$('#specCount').textContent=this.rows.length+' 项 · 可新增';$('#addSpecification').disabled=this.rows.length>=48;
    const add=$('#addBuiltinSpecification');add.replaceChildren(el('option',{value:'',text:'添加常用参数'}));for(const [field,config]of Object.entries(SPEC_FIELDS))if(!this.rows.some(r=>r.field===field))add.append(el('option',{value:field,text:config.label}));add.disabled=this.rows.length>=48;
    this.rows.forEach((row,index)=>{
      const card=el('div',{class:'spec-editor-row'+(!row.enabled?' spec-row-hidden':'')});
      const head=el('div',{class:'spec-editor-head'}),show=el('input',{type:'checkbox','aria-label':'显示 '+(row.label||'参数 '+(index+1))});show.checked=row.enabled;show.onchange=()=>{row.enabled=show.checked;card.classList.toggle('spec-row-hidden',!row.enabled);};
      head.append(show,el('span',{class:'spec-editor-index',text:String(index+1).padStart(2,'0')}));
      if(row.field)head.append(el('small',{text:'常用参数'}));else{const type=el('select',{'aria-label':'参数 '+(index+1)+' 内容类型'});for(const [value,text]of [['text','文字'],['dimensions','尺寸 · 自动换算'],['weight','重量 · 自动换算']])type.append(el('option',{value,text}));type.value=row.type;type.onchange=()=>{row.type=type.value;previewValue();};head.append(type);}
      const actions=el('div',{class:'spec-editor-actions'});for(const [text,delta,title]of [['↑',-1,'上移'],['↓',1,'下移']]){const button=el('button',{type:'button',text,'aria-label':'参数 '+(index+1)+' '+title});button.disabled=index+delta<0||index+delta>=this.rows.length;button.onclick=()=>this.move(index,delta);actions.append(button);}const remove=el('button',{type:'button',text:'×','aria-label':'删除参数 '+(index+1)});remove.onclick=()=>{this.rows.splice(index,1);this.render();};actions.append(remove);head.append(actions);
      const names=el('div',{class:'spec-editor-names'}),name=el('input',{value:row.label,maxlength:70,placeholder:'参数名称','aria-label':'参数 '+(index+1)+' 名称'}),nameEn=el('input',{value:row.labelEn,maxlength:100,placeholder:'English name','aria-label':'参数 '+(index+1)+' 英文名称',lang:'en'});name.oninput=()=>row.label=name.value;nameEn.oninput=()=>row.labelEn=nameEn.value;names.append(name,nameEn);
      const values=el('div',{class:'spec-editor-values'}),value=el('textarea',{rows:1,maxlength:row.field?160:360,placeholder:'参数内容','aria-label':'参数 '+(index+1)+' 内容'}),valueEn=el('textarea',{rows:1,maxlength:row.field?240:480,placeholder:'English value','aria-label':'参数 '+(index+1)+' 英文内容',lang:'en'}),hint=el('small',{class:'spec-editor-hint'});
      const readOnly=row.field==='name'||row.field==='platform';
      const previewValue=()=>{const kind=row.field||row.type;if(kind==='dimensions'||kind==='weight'){const result=measurement(value.value,kind);hint.textContent=result.valid&&result.secondary?result.primary+' / '+result.secondary:result.valid?'填写后自动换算英制单位':'格式示例：'+(kind==='dimensions'?'35 × 35 × 8 mm':'12 g');valueEn.disabled=true;}else{hint.textContent=readOnly?'由上方型号／系统配置自动关联':'';valueEn.disabled=readOnly;}};
      if(row.field){value.dataset.coreField=row.field;value.value=this.value(row.field);value.readOnly=readOnly;const englishField=row.field+'En';if(this.form.elements[englishField]){valueEn.dataset.coreField=englishField;valueEn.value=this.value(englishField);}else valueEn.value=row.field==='name'?value.value:'';value.oninput=()=>{const input=this.form.elements[row.field];if(input)input.value=value.value;this.changed();previewValue();};valueEn.oninput=()=>{const input=this.form.elements[englishField];if(input)input.value=valueEn.value;};}
      else{value.value=row.value;valueEn.value=row.valueEn;value.oninput=()=>{row.value=value.value;previewValue();};valueEn.oninput=()=>row.valueEn=valueEn.value;}
      values.append(value,valueEn);card.append(head,names,values,hint);root.append(card);this.refreshHints.push(previewValue);previewValue();
    });
  }
}
