(function(root){
 'use strict';
 const Workflow=typeof module!=='undefined'?require('../uiux/model.js'):root.BoardUIUXModel;
 function pathOf(p){const saved=p.workflow?.publication?.path;if(saved)return saved.slice();const raw={...p.raw,...(p.raw?.처리결과||p.raw?.처리정보||{})};return [1,2,3].map(n=>String(raw[n+'뎁스']??raw['메뉴'+n]??raw['depth'+n]??''));}
 function rawFields(p){return {...p.raw,...(p.raw?.처리결과||p.raw?.처리정보||{})};}
 function deployed(p){const raw=rawFields(p);return p.status==='운영반영완료'||!p.workflow.suppressSourceRelease&&/운영(?:반영|배포)완료/.test(String(raw.진행상태||raw.상태||'').replace(/\s/g,''));}
 function development(p){const raw=p.workflow.suppressSourceRelease?{}:rawFields(p);for(const value of [p.release.development?.url,raw.개발반영URL,raw.개발배포URL,raw.개발반영,raw.개발배포]){const url=Workflow.safeUrl(typeof value==='object'?value?.url:value);if(url)return url;}return '';}
 function records(rows,C,Board){return rows.map(original=>Workflow.read(original,C,Board)).filter(p=>!deployed(p)).map(p=>({...p,publication:p.workflow.publication,path:pathOf(p),development:development(p),links:p.links.length?p.links:(p.workflow.publication?.links||[])}));}
 function choices(rows,path,level,catalog=[]){const paths=[...rows.map(pathOf),...catalog];return [...new Set(paths.filter(p=>p.slice(0,level).every((v,i)=>v===(path[i]||''))).map(p=>p[level]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));}
 function save(original,input,C,Board,actor){
  if(!actor)throw Error('로그인이 필요합니다.');const p=Workflow.read(original,C,Board);
  if(deployed(p))throw Error('운영배포완료 과업은 등록 대상에서 제외됩니다.');
  if(!Array.isArray(input.path)||input.path.length!==3||input.path.some(v=>typeof v!=='string'||v.length>100||v==='__choose__'||v==='__new__'))throw Error('1뎁스부터 메뉴를 선택하거나 입력해 주세요.');
  const path=input.path.map(v=>v.trim()==='메뉴없음'?'':v.trim());
  if((!path[0]&&(path[1]||path[2]))||(!path[1]&&path[2]))throw Error('상위 메뉴를 먼저 선택해 주세요.');
  const links=(input.links||[]).map(l=>({name:String(l.name||'').trim(),url:Workflow.safeUrl(l.url)}));
  if(links.length>30||links.some(l=>!l.name||l.name.length>100||!l.url))throw Error('링크 이름과 주소를 확인해 주세요.');
  const publication={path,links,registeredAt:p.workflow.publication?.registeredAt||new Date().toISOString(),updatedAt:new Date().toISOString(),author:actor};
  return Workflow.write(original,{workflow:{...p.workflow,publication}},p.workflow.publication?'산출물 수정':'산출물 등록',C,actor);
 }
 function validate(value){if(value===undefined)return;if(!value||!Array.isArray(value.path)||value.path.length!==3||value.path.some(v=>typeof v!=='string'||v.length>100)||!Array.isArray(value.links)||value.links.some(l=>typeof l.name!=='string'||!l.name||!Workflow.safeUrl(l.url))||typeof value.author!=='string'||!Number.isFinite(Date.parse(value.registeredAt))||!Number.isFinite(Date.parse(value.updatedAt)))throw Error('퍼블리싱 산출물 저장 형식이 올바르지 않습니다.');}
 function allRows(rows){return rows.filter(p=>p.publication).slice().sort((a,b)=>{for(let i=0;i<3;i++){const x=a.path[i],y=b.path[i];if(x!==y)return !x?1:!y?-1:x.localeCompare(y,'ko');}return a.title.localeCompare(b.title,'ko');});}
 const api={pathOf,records,choices,save,validate,allRows,development,deployed,safeUrl:Workflow.safeUrl};if(typeof module!=='undefined')module.exports=api;else root.BoardPublishingModel=api;
})(typeof window!=='undefined'?window:globalThis);
