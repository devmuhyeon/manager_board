(function(root){
 'use strict';
 const Workflow=typeof module!=='undefined'?require('../uiux/model.js'):root.BoardUIUXModel;
 const Attachments=typeof module!=='undefined'?require('../../organization/board/attachments.js'):root.BoardAttachments;
 function pathOf(p){const saved=p.workflow?.publication?.path;if(saved)return saved.slice();const raw={...p.raw,...(p.raw?.처리결과||p.raw?.처리정보||{})};return [1,2,3].map(n=>String(raw[n+'뎁스']??raw['메뉴'+n]??raw['depth'+n]??''));}
 function rawFields(p){return {...p.raw,...(p.raw?.처리결과||p.raw?.처리정보||{})};}
 function deployed(p){const raw=rawFields(p);return p.status==='운영반영완료'||!p.workflow.suppressSourceRelease&&/운영(?:반영|배포)완료/.test(String(raw.진행상태||raw.상태||'').replace(/\s/g,''));}
 function development(p){const raw=p.workflow.suppressSourceRelease?{}:rawFields(p);for(const value of [p.release.development?.url,raw.개발반영URL,raw.개발배포URL,raw.개발반영,raw.개발배포]){const url=Workflow.safeUrl(typeof value==='object'?value?.url:value);if(url)return url;}return '';}
 function records(rows,C,Board){return rows.map(original=>Workflow.read(original,C,Board)).filter(p=>!deployed(p)).map(p=>{const publication=p.workflow.publication,developmentLinks=publication?.developmentLinks??(development(p)?[{name:'LINK',url:development(p)}]:[]);return {...p,publication,path:pathOf(p),development:developmentLinks[0]?.url||'',developmentLinks,outputRegistered:Boolean(publication&&publication.outputRegistered!==false),links:publication?.linksEdited?publication.links:p.links.length?p.links:(publication?.links||[])};});}
 function choices(rows,path,level,catalog=[]){const paths=[...rows.map(pathOf),...catalog];return [...new Set(paths.filter(p=>p.slice(0,level).every((v,i)=>v===(path[i]||''))).map(p=>p[level]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));}
 function cleanLinks(items,label){if(!Array.isArray(items)||items.length>30)throw Error(label+'은 30개까지 등록할 수 있습니다.');const result=items.map(l=>({name:String(l.name||'').trim(),url:Workflow.safeUrl(l.url)}));if(result.some(l=>!l.name||l.name.length>100||!l.url))throw Error(label+' 이름과 주소를 확인해 주세요.');return result;}
 function save(original,input,C,Board,actor){
  if(!actor)throw Error('로그인이 필요합니다.');const p=Workflow.read(original,C,Board);
  if(deployed(p))throw Error('운영배포완료 과업은 등록 대상에서 제외됩니다.');
  const old=p.workflow.publication,section=input.section||'outputs',publication={path:['','',''],links:[],outputRegistered:false,...old,registeredAt:old?.registeredAt||new Date().toISOString(),updatedAt:new Date().toISOString(),author:actor};
  if(old&&old.outputRegistered===undefined)publication.outputRegistered=true;
  if(section==='links'){publication.links=cleanLinks(input.links||[],'일반 링크');publication.linksEdited=true;}
  else if(section==='development')publication.developmentLinks=cleanLinks(input.developmentLinks||[],'개발배포 링크');
  else if(section==='outputs'){
   const artifacts=cleanLinks(input.artifacts||[],'산출물'),attachments=input.attachments??old?.attachments??[];Attachments.validate(attachments);
   const chosen=Array.isArray(input.path)&&input.path[0]==='__choose__'&&(artifacts.length||attachments.length)?['','','']:input.path;
   if(!Array.isArray(chosen)||chosen.length!==3||chosen.some(v=>typeof v!=='string'||v.length>100||v==='__choose__'||v==='__new__'))throw Error('1뎁스부터 메뉴를 선택하거나 입력해 주세요.');
   const path=chosen.map(v=>v.trim()==='메뉴없음'?'':v.trim());if((!path[0]&&(path[1]||path[2]))||(!path[1]&&path[2]))throw Error('상위 메뉴를 먼저 선택해 주세요.');
   Object.assign(publication,{path,artifacts,attachments,outputRegistered:true});
   if(!input.section)publication.links=cleanLinks(input.links||[],'링크');
  }else throw Error('등록 항목을 확인해 주세요.');
  return Workflow.write(original,{workflow:{...p.workflow,publication},...(original.publishingDocument?{updatedAt:publication.updatedAt,updatedBy:actor}:{})},({outputs:'산출물 등록',development:'개발배포 링크 등록',links:'일반 링크 등록'})[section],C,actor);
 }
 function validate(value){if(value===undefined)return;if(!value||!Array.isArray(value.path)||value.path.length!==3||value.path.some(v=>typeof v!=='string'||v.length>100)||!Array.isArray(value.links)||typeof value.author!=='string'||!Number.isFinite(Date.parse(value.registeredAt))||!Number.isFinite(Date.parse(value.updatedAt))||value.outputRegistered!==undefined&&typeof value.outputRegistered!=='boolean')throw Error('퍼블리싱 산출물 저장 형식이 올바르지 않습니다.');cleanLinks(value.links,'링크');for(const key of ['developmentLinks','artifacts'])if(value[key]!==undefined)cleanLinks(value[key],key==='artifacts'?'산출물':'개발배포 링크');Attachments.validate(value.attachments);}
 function allRows(rows){return rows.filter(p=>p.publication&&p.publication.outputRegistered!==false).slice().sort((a,b)=>{for(let i=0;i<3;i++){const x=a.path[i],y=b.path[i];if(x!==y)return !x?1:!y?-1:x.localeCompare(y,'ko');}return a.title.localeCompare(b.title,'ko');});}
 function saveDocument(original,input,C,actor,members){
  if(original&&(original.source!=='manual'||!original.publishingDocument||original.raw))throw Error('직접 등록한 퍼블리싱 문서만 수정할 수 있습니다.');
  if(!members.some(m=>m.name===actor&&m.active!==false))throw Error('로그인한 재직자만 등록할 수 있습니다.');
  const title=String(input.title||'').trim(),due=String(input.due||'');if(!title||title.length>300)throw Error('과업명을 1~300자로 입력해 주세요.');if(due&&!Workflow.date(due))throw Error('마감일을 확인해 주세요.');
  const tasks=['디자인','퍼블'].flatMap(role=>{const names=[...new Set(input[role]||[])];if(role==='퍼블'&&!names.length)throw Error('퍼블리셔를 선택해 주세요.');if(names.some(n=>!members.some(m=>m.name===n&&m.active!==false&&m.team===role)&&!original?.tasks?.some(t=>t.role===role&&t.assignees.includes(n))))throw Error('담당자를 확인해 주세요.');return names.length?[{id:original?.tasks?.find(t=>t.role===role)?.id||C.uid(),role,assignees:names,status:'진행중',progress:0,notes:'',due}]:[];});
  const at=new Date().toISOString(),log={id:C.uid(),date:C.today(),at,author:actor,kind:'퍼블리싱 문서',content:original?'퍼블리싱 문서 수정':'퍼블리싱 문서 등록'};
  return {...original,id:original?.id||'publishing:'+C.uid(),source:'manual',publishingDocument:true,title,requestedDue:due,due,requested:original?.requested||C.today(),requester:original?.requester||actor,createdBy:original?.createdBy||actor,createdAt:original?.createdAt||at,updatedBy:actor,updatedAt:at,status:original?.status||'진행중',assignees:[...new Set(tasks.flatMap(t=>t.assignees))],tasks,workflow:original?.workflow||{},logs:[...(original?.logs||[]),log]};
 }
 const api={pathOf,records,choices,save,saveDocument,validate,allRows,development,deployed,safeUrl:Workflow.safeUrl};if(typeof module!=='undefined')module.exports=api;else root.BoardPublishingModel=api;
})(typeof window!=='undefined'?window:globalThis);
