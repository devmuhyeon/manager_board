(function(root){
 'use strict';
 const roles=['기획','디자인','퍼블'];
 function date(value){const m=String(value||'').match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})$/);if(!m)return '';const iso=m[1]+'-'+m[2]+'-'+m[3],d=new Date(iso+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:'';}
 const done=t=>['완료','운영반영완료'].includes(t.status);
 const safeUrl=value=>{const v=String(value||'').trim();if(/^https?:\/\/[^\s]+$/i.test(v)||/^file:\/\/[^\r\n]+$/i.test(v))return v;if(/^[a-z]:[\\/]/i.test(v))return 'file:///'+v.replace(/\\/g,'/');if(/^\\\\/.test(v))return 'file:'+v.replace(/\\/g,'/');return '';};
 function read(original,C,Board){
  const p=C.effective(original),w=p.workflow||{},raw=p.raw?{...p.raw,...(p.raw.처리결과||p.raw.처리정보||{})}:{},detail=Board.sourceDetails(p);
  const current=p.raw&&w.taskStates&&!w.localTasks?C.normalize(p.raw).tasks:p.tasks;
  const tasks=roles.flatMap(role=>{
   const list=(current||[]).filter(t=>t.role===role||t.id==='source-task:'+role);
   return list.map(t=>{const d=Board.sourceDetails(p,role),local=w.taskStates?w.taskStates[t.id]:original.overrides?.tasks?.find(x=>x.id===t.id);return {...t,...local,role,status:local?.status||C.STATUSES.find(s=>s.replace(/\s/g,'')===String(raw['상태_'+role]||raw['진행상태_'+role]||t.status||'진행중').replace(/\s/g,''))||t.status||'진행중',started:w.starts?.[t.id]||t.started||d.start||(p.sourceAssignments?.[role]||[]).map(x=>x.started).filter(Boolean).sort()[0]||'',notes:local?.notes??t.notes??d.notes??''};});
  });
  const requestedRoles=[...new Set([...(w.roles||String(raw.요청구분||'').split(/[,/·\s]+/).filter(r=>roles.includes(r))),...tasks.map(t=>t.role)])];
  const release=w.release||{};
  const complete=requestedRoles.length?requestedRoles.every(role=>tasks.some(t=>t.role===role)&&tasks.filter(t=>t.role===role).every(done)):done(p);
  const status=release.production||p.status==='운영반영완료'?'운영반영완료':release.development?'개발반영':complete?'완료':tasks.some(t=>t.status==='반려')||!tasks.length&&p.status==='반려'?'반려':tasks.some(t=>t.status==='보류')||!tasks.length&&p.status==='보류'?'보류':'진행중';
  return {...p,workflow:w,tasks,requestedRoles,release,complete,status,title:p.title||detail.title,requester:p.requester||raw.요청자||detail.customer,customer:p.customer||raw.요청팀||detail.customer,requested:p.requested||raw.요청일자||raw.요청일||'',requestedDue:p.requestedDue||detail.requestedDue||'',background:w.background??raw.요청배경??'',requirements:w.requirements??raw.요청사항??raw.요청내용??p.description??'',folder:w.folder??raw.산출물결과폴더??raw.산출물폴더??'',handoff:w.handoff??raw.작성기연동링크??'',links:w.links||[p.link,raw.퍼블링크,raw.작업링크].filter(Boolean).map(url=>({name:'작업 링크',url})),readOnlySample:original.readOnlySample};
 }
 function write(original,values,event,C,actor){
  if(original.readOnlySample)throw Error('연결 전 샘플은 보기 전용입니다. 샘플 검토 모드에서 확인해 주세요.');
  const log={id:C.uid(),date:C.today(),at:new Date().toISOString(),author:actor,kind:event,content:event};
  return original.raw?{...original,overrides:{...original.overrides,...values},logs:[...(original.logs||[]),log]}:{...original,...values,logs:[...(original.logs||[]),log]};
 }
 function own(task,actor){if(!task?.assignees?.includes(actor))throw Error('본인 담당 업무만 변경할 수 있습니다.');}
 function toggle(original,taskId,C,Board,actor){
  const p=read(original,C,Board),target=p.tasks.find(t=>t.id===taskId);own(target,actor);
  const tasks=p.tasks.map(t=>t.id!==taskId?t:{...t,status:done(t)?'완료 후 수정':'완료',progress:100,completedOn:done(t)?t.completedOn:C.today()});
  const updated=tasks.find(t=>t.id===taskId),taskStates={...(p.workflow.taskStates||Object.fromEntries((original.overrides?.tasks||[]).map(t=>[t.id,{status:t.status,progress:t.progress,completedOn:t.completedOn}]))),[taskId]:{status:updated.status,progress:updated.progress,completedOn:updated.completedOn}};
  return write(original,{tasks,workflow:{...p.workflow,taskStates,...(done(target)?{release:{}}:{})}},target.role+' '+(done(target)?'수정 처리':'완료 처리'),C,actor);
 }
 function release(original,stage,url,C,Board,actor){
  const p=read(original,C,Board);if(!p.tasks.some(t=>t.assignees.includes(actor)))throw Error('본인 참여 과업만 반영할 수 있습니다.');
  if(!p.complete)throw Error('요청된 담당 업무가 모두 완료된 후 반영할 수 있습니다.');
  if(!['development','production'].includes(stage)||!safeUrl(url))throw Error('올바른 반영 주소를 입력해 주세요.');
  if(stage==='production'&&!p.release.development)throw Error('개발 반영 후 운영 반영해 주세요.');
  const workflow={...p.workflow,release:{...p.release,[stage]:{url:safeUrl(url),by:actor,at:new Date().toISOString()}}};
  return write(original,{workflow},(stage==='development'?'개발 반영':'운영 반영 완료')+' · '+safeUrl(url),C,actor);
 }
 function save(original,input,C,Board,actor,members){
  const title=String(input.title||'').trim();if(!title)throw Error('요청명을 입력해 주세요.');
  const selected=[...new Set(input.roles||[])];if(!selected.length||selected.some(r=>![...roles,'기타'].includes(r)))throw Error('요청구분을 선택해 주세요.');
  if(!(input.platforms||[]).length||input.platforms.some(x=>!['PC','MO'].includes(x)))throw Error('사용대상을 선택해 주세요.');
  if(!date(input.requested)||!date(input.requestedDue)||input.requested>input.requestedDue)throw Error('요청일과 완료요청일을 확인해 주세요.');
  const p=original?read(original,C,Board):{workflow:{},tasks:[]};
  const requested=selected.filter(r=>roles.includes(r)),starts={...(p.workflow.starts||{})};
  const tasks=requested.map(role=>{
   const previous=p.tasks.find(t=>t.role===role),names=[...new Set(input.assignees?.[role]||[])];
   if(names.some(n=>!members.some(m=>m.name===n)&&!previous?.assignees.includes(n)))throw Error('등록된 작업자를 선택해 주세요.');
   const id=previous?.id||(original?.raw?'source-task:'+role:C.uid());
   if(names.some(n=>!previous?.assignees.includes(n)))starts[id]=C.today();
   const status=input.statuses?.[role]||previous?.status||'진행중';
   if(!C.STATUSES.includes(status))throw Error('진행상태를 확인해 주세요.');
   if(previous&&status!==previous.status)own(previous,actor);
   if(!previous&&status!=='진행중'&&!names.includes(actor))throw Error('본인 담당 업무만 변경할 수 있습니다.');
   return {...previous,id,role,assignees:names,status,progress:done({status})?100:previous?.progress||0,completedOn:done({status})?(previous?.completedOn||C.today()):previous?.completedOn,due:input.requestedDue,notes:String(input.notes?.[role]||''),started:starts[id]||previous?.started||''};
  });
  // Reassignment never grants permission to change another person's existing progress.
  const workflow={...p.workflow,localTasks:true,roles:requested,etc:selected.includes('기타'),platforms:input.platforms,services:input.services||[],background:String(input.background||''),requirements:String(input.requirements||''),folder:String(input.folder||''),handoff:String(input.handoff||''),starts,links:input.links||[],attachments:input.attachments||p.workflow.attachments||[]};
  // Explicit assignment edits are local; progress-only actions continue reading fresh customer assignments.
  delete workflow.taskStates;
  const values={title,requester:String(input.requester||actor),customer:String(input.customer||''),requested:input.requested,requestedDue:input.requestedDue,tasks,workflow,description:workflow.requirements,taskCategory:'UI',platform:input.platforms.length===2?'PC&MO':input.platforms[0],assignees:tasks.flatMap(t=>t.assignees),status:'진행중'};
  if(!original)return {...values,id:C.uid(),source:'manual',logs:[{id:C.uid(),date:C.today(),at:new Date().toISOString(),author:actor,kind:'자체 등록',content:'자체 등록'}]};
  return write(original,values,'과업 정보 수정',C,actor);
 }
 function comment(original,input,C,Board,actor){
  const p=read(original,C,Board),comments=[...(p.workflow.comments||[])],index=comments.findIndex(c=>c.id===input.commentId);
  if(input.commentId){if(index<0||comments[index].author!==actor)throw Error('본인 댓글만 수정·삭제할 수 있습니다.');if(input.remove)comments.splice(index,1);else comments[index]={...comments[index],content:String(input.content||'').trim(),editedAt:new Date().toISOString()};}
  else comments.push({id:C.uid(),author:actor,at:new Date().toISOString(),content:String(input.content||'').trim()});
  if(comments.some(c=>!c.content||c.content.length>5000))throw Error('댓글은 1~5000자로 입력해 주세요.');
  return write(original,{workflow:{...p.workflow,comments}},input.remove?'댓글 삭제':input.commentId?'댓글 수정':'댓글 등록',C,actor);
 }
 function match(status,filter){return filter==='all'||filter==='진행중'&&!['운영반영완료','보류','반려'].includes(status)||status===filter;}
 function period(mode,today){const start=new Date(today+'T00:00:00Z'),end=new Date(start);if(mode==='month'){start.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+1,0);}else{start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));end.setTime(start.getTime());end.setUTCDate(end.getUTCDate()+6);}return {from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10)};}
 function validate(w){
  if(w===undefined)return;
  if(!w||typeof w!=='object'||Array.isArray(w))throw Error('UI·UX 저장 자료를 확인해 주세요.');
  for(const key of ['roles','platforms','services','links','comments','attachments'])if(w[key]!==undefined&&!Array.isArray(w[key]))throw Error('UI·UX 목록 형식이 올바르지 않습니다.');
  for(const key of ['starts','release','taskStates'])if(w[key]!==undefined&&(!w[key]||typeof w[key]!=='object'||Array.isArray(w[key])))throw Error('UI·UX 상태 형식이 올바르지 않습니다.');
  if(Object.values(w.starts||{}).some(v=>!date(v))||Object.values(w.taskStates||{}).some(t=>!t||!['접수','진행중','완료','완료 후 수정','운영반영완료','보류','예정','대기','검토중','반려'].includes(t.status)))throw Error('작업 시작일 또는 상태가 올바르지 않습니다.');
  if(w.roles?.some(r=>!roles.includes(r))||w.links?.some(l=>typeof l.name!=='string'||!safeUrl(l.url))||w.comments?.some(c=>typeof c.id!=='string'||typeof c.author!=='string'||typeof c.content!=='string'||!c.content.trim()||!Number.isFinite(Date.parse(c.at))))throw Error('UI·UX 과업 자료가 올바르지 않습니다.');
  for(const stage of ['development','production'])if(w.release?.[stage]&&(!safeUrl(w.release[stage].url)||typeof w.release[stage].by!=='string'||!Number.isFinite(Date.parse(w.release[stage].at))))throw Error('반영 이력이 올바르지 않습니다.');
 }
 const api={roles,date,done,safeUrl,read,write,toggle,release,save,comment,match,period,validate};
 if(typeof module!=='undefined')module.exports=api;else root.BoardUIUXModel=api;
})(typeof window!=='undefined'?window:globalThis);
