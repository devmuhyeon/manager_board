(function(root){
 'use strict';
 function render({rows,selected,C,N,Board,members,esc,button,orderNames}){
  const visible=selected?rows.filter(p=>p.id===selected):rows;
  return '<section class="card project-report"><div class="sectionhead"><h2>'+esc(selected?visible[0]?.title||'과업을 찾을 수 없습니다':'전체 과업')+'</h2><div class="actions">'+(selected?button('allProjects','전체 과업')+button('edit','과업 편집','','data-id="'+esc(selected)+'"'):'')+'</div></div>'+(selected&&visible[0]?.description?'<p class="project-report-description">'+esc(visible[0].description)+'</p>':'')+'<div class="table-wrap project-spreadsheet" tabindex="0" aria-label="과업별 스프레드시트"><table><caption class="sr-only">과업별 담당 업무·일정·진행률</caption><thead><tr>'+['과업명','고객','담당 업무','담당자','시작일','마감일','상태','진행률','수정 진행률','편집'].map(t=>'<th scope="col">'+t+'</th>').join('')+'</tr></thead><tbody>'+visible.map(p=>{const tasks=Board.orderedTasks(p.tasks?.length?p.tasks:[{...p,role:'과업'}],members,orderNames);return tasks.map((t,i)=>'<tr>'+(i===0?'<td rowspan="'+tasks.length+'">'+button('boardDetail',esc(p.title),'project-button','data-id="'+esc(p.id)+'"')+'</td><td rowspan="'+tasks.length+'">'+esc(p.customer||p.requester||'—')+'</td>':'')+'<td>'+esc(N.teamLabel(t.role))+'</td><td>'+esc(orderNames(t.assignees||[]).join(', ')||'미배정')+'</td><td>'+esc(t.started||'—')+'</td><td>'+esc(t.due||'—')+'</td><td>'+esc(t.status)+'</td><td>'+Board.progress(t)+'%<progress max="100" value="'+Board.progress(t)+'" aria-label="진행률"></progress></td><td>'+(t.status==='완료 후 수정'?(t.revisionRequired?(t.revisionProgress||0)+'%<progress class="revision-progress" max="100" value="'+(t.revisionProgress||0)+'" aria-label="수정 진행률"></progress>':'수정 미선택'):'—')+'</td><td>'+button('editBoardTask','편집','','data-id="'+esc(p.id)+'" data-task-id="'+esc(t.id||'')+'"')+'</td></tr>').join('');}).join('')+(!visible.length?'<tr><td colspan="10" class="empty">표시할 과업이 없습니다.</td></tr>':'')+'</tbody></table></div>'+(selected&&visible[0]?sourceTimeline(visible[0],esc):'')+'</section>';
 }
 function sourceValue(value){
  if(value===undefined)return '항목 없음';
  if(value==='')return '빈 값';
  return typeof value==='string'?value:JSON.stringify(value);
 }
 function history(project){
  const sourceEvents=(project.sourceHistory||[]).map((entry,index)=>({
   id:'source:'+index,source:true,index,at:entry.at,kind:entry.kind,
   content:entry.changes.length?entry.changes.map(change=>change.field.join(' › ')+'\n이전: '+sourceValue(change.before)+'\n변경: '+sourceValue(change.after)).join('\n\n'):entry.kind
  }));
  return sourceEvents.map(event=>{
   const text=String(event.at||'');
   const timestamp=typeof event.at==='number'?event.at:Date.parse(text.length===10?text+'T00:00:00+09:00':text);
   const date=Number.isFinite(timestamp)?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(timestamp):'';
   return {...event,timestamp,date};
  }).filter(event=>event.date).sort((a,b)=>b.timestamp-a.timestamp||(b.index??-1)-(a.index??-1)||a.id.localeCompare(b.id));
 }
 function weeklyTable({rows,filters,Board,esc,button}){
  const entries=rows.map(project=>({project,nextDue:project.requestedDue||project.due||'',raw:Board.sourceDetails(project)}))
   .filter(({nextDue})=>(!filters.from||nextDue>=filters.from)&&(!filters.to||nextDue&&nextDue<=filters.to))
   .sort((a,b)=>a.nextDue.localeCompare(b.nextDue)||a.raw.title.localeCompare(b.raw.title,'ko'));
  const headers=['과업명','고객','완료요청일','상태','기획','디자인','퍼블','원본 이력'];
  return '<div class="weekly-projects">'+Board.weekGroups(entries).map(week=>
   '<section class="weekly-project"><h3 class="weekly-table-title">'+esc(week.label)+' <span>'+week.entries.length+'건</span></h3><div class="table-wrap" tabindex="0"><table><caption class="sr-only">'+esc(week.label)+' 과업 목록</caption><thead><tr>'+headers.map(header=>'<th scope="col">'+header+'</th>').join('')+'</tr></thead><tbody>'+
   week.entries.map(({project,raw,nextDue})=>'<tr><td>'+button('workflowDetail',esc(raw.title),'project-button','data-id="'+esc(project.id)+'"')+'</td>'+[raw.customer,raw.requestedDue||nextDue,project.sourceRemoved?'원본 목록 제외':raw.status,...['기획','디자인','퍼블'].map(role=>Board.sourceDetails(project,role).assignees),project.sourceHistory?.length||0].map(value=>'<td>'+esc(value??'—').replace(/^$/,'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section>'
  ).join('')+(!entries.length?'<p class="empty">표시할 고객 원본 과업이 없습니다.</p>':'')+'</div>';
 }
 function sourceTimeline(project,esc){
  const events=history(project).filter(event=>event.source);
  return '<section class="workflow-source-history"><h3>고객 원본 변경 이력</h3><p class="muted">최신 JSON을 읽어 변경을 확인한 날짜입니다.</p>'+
   (events.length?'<ol class="weekly-history">'+events.map(event=>'<li><time datetime="'+esc(event.date)+'">'+esc(event.date)+'</time><div><div class="weekly-history-meta"><span>'+esc(event.kind)+'</span></div><p>'+esc(event.content)+'</p></div></li>').join('')+'</ol>':'<p class="weekly-empty">비교 이후 확인된 원본 변경이 없습니다.</p>')+'</section>';
 }
 const api={render,history,weeklyTable,sourceTimeline};if(typeof module!=='undefined')module.exports=api;else root.BoardProjectReport=api;
})(typeof window!=='undefined'?window:globalThis);
