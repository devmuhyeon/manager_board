(function(root){
 'use strict';
 const Avatars=typeof module!=='undefined'?require('./avatar-catalog.js'):root.BoardAvatars;
 function render({rows,selected,C,N,Board,members,esc,button,orderNames}){
  const visible=selected?rows.filter(p=>p.id===selected):rows;
  return '<section class="card project-report"><div class="sectionhead"><h2>'+esc(selected?visible[0]?.title||'과업을 찾을 수 없습니다':'전체 과업')+'</h2><div class="actions">'+(selected?button('allProjects','전체 과업')+(visible[0]&&!visible[0].readOnlySample?button('edit','과업 편집','','data-id="'+esc(selected)+'"'):''):'')+'</div></div>'+(selected&&visible[0]?.description?'<p class="project-report-description">'+esc(visible[0].description)+'</p>':'')+'<div class="table-wrap project-spreadsheet" tabindex="0" aria-label="과업별 스프레드시트"><table><caption class="sr-only">과업별 담당 업무·일정·진행률</caption><thead><tr>'+['과업명','고객','담당 업무','담당자','시작일','마감일','상태','진행률','수정 진행률','편집'].map(t=>'<th scope="col">'+t+'</th>').join('')+'</tr></thead><tbody>'+visible.map(p=>{const tasks=Board.orderedTasks(p.tasks?.length?p.tasks:[{...p,role:'과업'}],members,orderNames);return tasks.map((t,i)=>'<tr>'+(i===0?'<td rowspan="'+tasks.length+'">'+button('boardDetail',esc(p.title),'project-button','data-id="'+esc(p.id)+'"')+'</td><td rowspan="'+tasks.length+'">'+esc(p.customer||p.requester||'—')+'</td>':'')+'<td>'+esc(N.teamLabel(t.role))+'</td><td>'+esc(orderNames(t.assignees||[]).join(', ')||'미배정')+'</td><td>'+esc(t.started||'—')+'</td><td>'+esc(t.due||'—')+'</td><td>'+esc(t.status)+'</td><td>'+Board.progress(t)+'%<progress max="100" value="'+Board.progress(t)+'" aria-label="진행률"></progress></td><td>'+(t.status==='완료 후 수정'?(t.revisionRequired?(t.revisionProgress||0)+'%<progress class="revision-progress" max="100" value="'+(t.revisionProgress||0)+'" aria-label="수정 진행률"></progress>':'수정 미선택'):'—')+'</td><td>'+(p.readOnlySample?'—':button('editBoardTask','편집','','data-id="'+esc(p.id)+'" data-task-id="'+esc(t.id||'')+'"'))+'</td></tr>').join('');}).join('')+(!visible.length?'<tr><td colspan="10" class="empty">표시할 과업이 없습니다.</td></tr>':'')+'</tbody></table></div>'+(selected&&visible[0]?sourceTimeline(visible[0],esc,Board,members):'')+'</section>';
 }
 function sourceValue(value){
  if(value===undefined)return '항목 없음';
  if(value==='')return '빈 값';
  return typeof value==='string'?value:JSON.stringify(value);
 }
 const describeChanges=changes=>changes.map(change=>change.field.join(' / ')+'\n이전: '+sourceValue(change.before)+'\n변경: '+sourceValue(change.after)).join('\n\n');
 function history(project){
  const sourceEvents=(project.sourceHistory||[]).map((entry,index)=>({
   id:'source:'+index,source:true,index,at:entry.at,kind:entry.kind,
   content:entry.changes.length?describeChanges(entry.changes):entry.kind
  }));
  return sourceEvents.map(event=>{
   const text=String(event.at||'');
   const timestamp=typeof event.at==='number'?event.at:Date.parse(text.length===10?text+'T00:00:00+09:00':text);
   const date=Number.isFinite(timestamp)?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(timestamp):'';
   return {...event,timestamp,date};
  }).filter(event=>event.date).sort((a,b)=>b.timestamp-a.timestamp||(b.index??-1)-(a.index??-1)||a.id.localeCompare(b.id));
 }
 function weeklyTable({rows,filters,Board,esc,button,orderNames}){
  const entries=rows.map(project=>({project,nextDue:project.requestedDue||project.due||'',raw:Board.sourceDetails(project)}))
   .filter(({nextDue})=>(!filters.from||nextDue>=filters.from)&&(!filters.to||nextDue&&nextDue<=filters.to))
   .sort((a,b)=>a.nextDue.localeCompare(b.nextDue)||a.raw.title.localeCompare(b.raw.title,'ko'));
  const headers=['과업명','고객','완료요청일','상태','기획','디자인','퍼블','원본 변경 횟수'];
  return '<div class="weekly-projects">'+Board.weekGroups(entries).map(week=>
   '<section class="weekly-project"><h3 class="weekly-table-title">'+esc(week.label)+' <span>'+week.entries.length+'건</span></h3><div class="table-wrap" tabindex="0"><table><caption class="sr-only">'+esc(week.label)+' 과업 목록</caption><thead><tr>'+headers.map(header=>'<th scope="col">'+header+'</th>').join('')+'</tr></thead><tbody>'+
   week.entries.map(({project,raw,nextDue})=>'<tr><td>'+button('workflowDetail',esc(raw.title),'project-button','data-id="'+esc(project.id)+'"')+'</td>'+[raw.customer,raw.requestedDue||nextDue,project.sourceRemoved?'원본 목록 제외':raw.status,...['기획','디자인','퍼블'].map(role=>Board.sourceAssignees(project,role,orderNames)),project.sourceHistory?.length||0].map(value=>'<td>'+esc(value??'—').replace(/^$/,'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section>'
  ).join('')+(!entries.length?'<p class="empty">표시할 고객 원본 과업이 없습니다.</p>':'')+'</div>';
 }
 function statistics({rows,C,Board,esc,group}){
  const roles=['기획','디자인','퍼블'];
  const statusCounts=new Map(),customerCounts=new Map(),roleCounts=new Map(roles.map(role=>[role,0]));
  let completed=0,overdue=0,unassigned=0;
  const today=C.today();
  for(const project of rows){
   const original=Board.sourceDetails(project);
   const status=String(original.status||'').replace(/\s+/g,'');
   const complete=C.isComplete(status)||C.isComplete(project.status);
   const due=project.requestedDue||project.due;
   const customer=String(project.customer||original.customer||'고객 미지정');
   if(complete)completed++;
   else if(due&&due<today)overdue++;
   const assigned=roles.filter(role=>String(Board.sourceDetails(project,role).assignees||'').trim());
   if(!assigned.length)unassigned++;
   for(const role of assigned)roleCounts.set(role,roleCounts.get(role)+1);
   const label=String(original.status||'미기재');
   statusCounts.set(label,(statusCounts.get(label)||0)+1);
   customerCounts.set(customer,(customerCounts.get(customer)||0)+1);
  }
  const sorted=map=>[...map].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko'));
  const summary=[['전체 과업',rows.length],['완료',completed],['미완료',rows.length-completed],['마감일 경과',overdue]];
  const breakdown=(heading,items,help='')=>'<section class="card stats-breakdown"><h3>'+heading+'</h3>'+(help?'<p class="muted">'+help+'</p>':'')+'<ul>'+items.map(([label,count])=>'<li><span>'+esc(label)+'</span><strong>'+count+'건</strong><progress aria-label="'+esc(label)+'" max="'+Math.max(1,rows.length)+'" value="'+count+'"></progress></li>').join('')+'</ul></section>';
  const panels=[['상태별',sorted(statusCounts)],['담당 파트별',[...roleCounts,['미배정',unassigned]],'여러 파트에 배정된 과업은 각 파트에 한 건씩 집계합니다.'],['고객별',sorted(customerCounts)]];
  const breakdowns=panels.filter(([label])=>!group||label===group).map(panel=>breakdown(...panel)).join('');
  return '<section class="card project-statistics"><div class="stats-metrics">'+summary.map(([label,count])=>'<div><span>'+label+'</span><strong>'+count+'</strong></div>').join('')+'</div>'+
   (rows.length?'<div class="stats-breakdowns">'+breakdowns+'</div>':'<p class="empty">집계할 과업이 없습니다.</p>')+'</section>';
 }
 function restoreBefore(snapshot,change){
  const path=change.field.slice(0,-1);
  let parent=snapshot;
  for(const key of path){
   if(!Object.hasOwn(parent,key)||!parent[key]||typeof parent[key]!=='object')return;
   parent=parent[key];
  }
  const key=change.field.at(-1);
  if(change.before===undefined)delete parent[key];
  else Object.defineProperty(parent,key,{value:structuredClone(change.before),writable:true,enumerable:true,configurable:true});
 }
 const cleanKey=key=>key.replace(/[\s_-]/g,'');
 const authorNames=value=>[...new Set((Array.isArray(value)?value:[value]).filter(name=>typeof name==='string').flatMap(name=>name.split(/[,;|/\n]/)).map(name=>name.trim()).filter(Boolean))];
 const singleAuthor=value=>value.length===1?value[0]:'';
 function changedAuthorLine(change){
  if(typeof change.after!=='string')return '';
  const before=new Set(String(change.before??'').split(/\r?\n/).map(line=>line.trim()));
  const names=change.after.split(/\r?\n/).map(line=>line.trim()).filter(line=>!before.has(line)).map(line=>line.match(/^(?:수정자|작성자|작업자)\s*[:：]\s*(.+)$/)?.[1]);
  return singleAuthor(authorNames(names));
 }
 function groupChanges(changes,snapshot,Board){
  const groups=new Map();
  const explicitFields=changes.filter(change=>/^(?:최종수정자|수정자|변경자|작성자|updatedBy|modifiedBy)$/i.test(cleanKey(change.field.at(-1))));
  const editor=singleAuthor(authorNames(explicitFields.flatMap(change=>authorNames(change.after))));
  for(const change of changes){
   const field=cleanKey(change.field.at(-1));
   const role=field.match(/^(?:작업내용(기획|디자인|퍼블)|(기획|디자인|퍼블)작업내용)$/);
   const explicit=explicitFields.includes(change)?singleAuthor(authorNames(change.after)):changedAuthorLine(change);
   const assignee=role?singleAuthor(authorNames(Board.sourceDetails({raw:snapshot},role[1]||role[2]).assignees)):'';
   const author=explicit||editor||assignee;
   const inferred=Boolean(author&&!explicit&&!editor);
   const key=author+'\0'+inferred;
   if(!groups.has(key))groups.set(key,{author,inferred,changes:[]});
   groups.get(key).changes.push(change);
  }
  return [...groups.values()];
 }
 function sourceTimeline(project,esc,Board,members=[]){
  const snapshot=structuredClone(project.raw||{});
  const entries=(project.sourceHistory||[]);
  const authors=new Map();
  for(let i=entries.length-1;i>=0;i--){
   authors.set(i,groupChanges(entries[i].changes,snapshot,Board));
   for(const change of entries[i].changes)restoreBefore(snapshot,change);
  }
  const identity=(author,inferred=false)=>{
   const member=members.find(person=>person.name===author);
   const avatar=member?.avatar||(project.sampleFixture?root.BoardPreviewData?.sampleAvatar(author):'')||(member?'yongyong':'');
   const character=avatar&&Avatars.characters.find(([key])=>key===avatar);
   const icon=character?'<img class="source-history-avatar" alt="" src="'+esc(Avatars.src(character[2]))+'">':'<span class="source-history-avatar fallback" aria-hidden="true">'+esc(author?.[0]||'—')+'</span>';
   return '<div class="weekly-history-meta source-history-author">'+icon+'<strong>'+esc(author||'작성자 확인 안 됨')+'</strong>'+(inferred?'<span>담당 기준 추정</span>':'')+'</div>';
  };
  const item=(date,author,kind,content,inferred=false,registered=false)=>'<li><div class="source-history-date">'+(date?'<time datetime="'+esc(date)+'">'+esc(date)+'</time>':'<span>날짜 미기재</span>')+(registered?'<small>최초 등록일</small>':'')+'</div><div class="source-history-entry">'+identity(author,inferred)+(kind?'<small class="source-history-kind">'+esc(kind)+'</small>':'')+'<p>'+esc(content)+'</p></div></li>';
  const timeline=history(project).map(event=>{
   const groups=authors.get(event.index);
   return groups.length?groups.map(group=>item(event.date,group.author,event.kind,describeChanges(group.changes),group.inferred)).join(''):item(event.date,'',event.kind,event.content);
  }).join('');
  const fields={...snapshot,...(snapshot.처리결과||snapshot.처리정보||{})};
  const registered=String(fields.최초등록일||fields.등록일||fields.등록일자||fields.작성일||fields.요청일||fields.요청일자||fields.requested||(!project.raw?project.requested:'')||'').match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})/)?.slice(1).join('-');
  const creator=singleAuthor(authorNames(fields.등록자||fields.작성자||fields.요청자||fields.requester));
  const initial=fields.요청내용||fields.요청사항||(project.raw?Board.sourceDetails({raw:snapshot}).notes:project.description)||'최초 내용이 원본에 기재되지 않았습니다.';
  return '<section class="workflow-source-history"><h3>고객 원본 변경 이력</h3><p class="muted">변경 날짜는 최신 JSON에서 확인한 날짜입니다.</p><ol class="weekly-history">'+timeline+item(registered,creator,'',String(initial),false,true)+'</ol></section>';
 }
 const api={render,history,weeklyTable,sourceTimeline,statistics};if(typeof module!=='undefined')module.exports=api;else root.BoardProjectReport=api;
})(typeof window!=='undefined'?window:globalThis);
