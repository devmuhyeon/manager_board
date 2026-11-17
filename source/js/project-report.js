(function(root){
 'use strict';
 function render({rows,selected,C,N,Board,members,esc,button,orderNames}){
  const visible=selected?rows.filter(p=>p.id===selected):rows;
  return '<section class="card project-report"><div class="sectionhead"><h2>'+esc(selected?visible[0]?.title||'과업을 찾을 수 없습니다':'전체 과업')+'</h2><div class="actions">'+(selected?button('allProjects','전체 과업')+button('edit','과업 편집','','data-id="'+esc(selected)+'"'):'')+'</div></div>'+(selected&&visible[0]?.description?'<p class="project-report-description">'+esc(visible[0].description)+'</p>':'')+'<div class="table-wrap project-spreadsheet" tabindex="0" aria-label="과업별 스프레드시트"><table><caption class="sr-only">과업별 담당 업무·일정·진행률</caption><thead><tr>'+['과업명','고객','담당 업무','담당자','시작일','마감일','상태','진행률','수정 진행률','편집'].map(t=>'<th scope="col">'+t+'</th>').join('')+'</tr></thead><tbody>'+visible.map(p=>{const tasks=Board.orderedTasks(p.tasks?.length?p.tasks:[{...p,role:'과업'}],members,orderNames);return tasks.map((t,i)=>'<tr>'+(i===0?'<td rowspan="'+tasks.length+'">'+button('boardDetail',esc(p.title),'project-button','data-id="'+esc(p.id)+'"')+'</td><td rowspan="'+tasks.length+'">'+esc(p.customer||p.requester||'—')+'</td>':'')+'<td>'+esc(N.teamLabel(t.role))+'</td><td>'+esc(orderNames(t.assignees||[]).join(', ')||'미배정')+'</td><td>'+esc(t.started||'—')+'</td><td>'+esc(t.due||'—')+'</td><td>'+esc(t.status)+'</td><td>'+Board.progress(t)+'%<progress max="100" value="'+Board.progress(t)+'" aria-label="진행률"></progress></td><td>'+(t.status==='완료 후 수정'?(t.revisionRequired?(t.revisionProgress||0)+'%<progress class="revision-progress" max="100" value="'+(t.revisionProgress||0)+'" aria-label="수정 진행률"></progress>':'수정 미선택'):'—')+'</td><td>'+button('editBoardTask','편집','','data-id="'+esc(p.id)+'" data-task-id="'+esc(t.id||'')+'"')+'</td></tr>').join('');}).join('')+(!visible.length?'<tr><td colspan="10" class="empty">표시할 과업이 없습니다.</td></tr>':'')+'</tbody></table></div></section>';
 }
 function history(project,requests=[]){
  const events=(project.logs||[]).map((log,i)=>({...log,id:'log:'+ (log.id||i),kind:log.kind||'작업 기록',at:log.at||log.date}));
  for(const [role,people] of Object.entries(project.sourceAssignments||{}))for(const person of people)if(person.started)events.push({id:'assignment:'+role+':'+person.name,at:person.started,author:person.name,kind:'담당자 추가 확인',content:role+' 담당자로 추가된 것을 확인했습니다.'});
  for(const [taskId,stages] of Object.entries(project.workflowRelease||{}))for(const [stage,record] of Object.entries(stages))if(record.at){const task=project.tasks?.find(t=>t.id===taskId);events.push({id:'release:'+taskId+':'+stage,at:record.at,author:record.by,kind:stage==='production'?'운영 반영':'개발 반영',content:(task?.role||'담당 업무')+' 반영을 기록했습니다.'});}
  for(const request of requests)if(request.projectId===project.id)events.push({id:'request:'+request.id,at:request.createdAt,author:request.from,kind:request.type||'업무요청',content:request.title+'\n'+request.body,recipients:request.to});
  return events.map(event=>{
   const text=String(event.at||'');
   const timestamp=typeof event.at==='number'?event.at:Date.parse(text.length===10?text+'T00:00:00+09:00':text);
   const date=Number.isFinite(timestamp)?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(timestamp):'';
   return {...event,timestamp,date};
  }).filter(event=>event.date).sort((a,b)=>b.timestamp-a.timestamp||a.id.localeCompare(b.id));
 }
 function weeklyGroups({projects,C,filters={},requests=[],members=[]}){
  const team=name=>members.find(m=>m.name===name)?.team;
  const personAllowed=name=>(filters.scope!=='personal'||name===filters.user)&&(filters.scope!=='team'||team(name)===filters.team)&&(!filters.teamFilter||team(name)===filters.teamFilter);
  const inPeriod=date=>(!filters.from||date>=filters.from)&&(!filters.to||date<=filters.to);
  return C.filterProjects(projects,{...filters,from:'',to:''}).map(project=>{
   const events=history(project,requests).filter(event=>personAllowed(event.author));
   const weekly=events.filter(event=>inPeriod(event.date));
   const active=(project.tasks||[]).some(task=>task.assignees.some(personAllowed)&&task.started&&(!filters.to||task.started<=filters.to)&&(!filters.from||(task.completedOn||(['완료','운영반영완료'].includes(task.status)?task.due:'9999-12-31')||'9999-12-31')>=filters.from));
   return {project,events,weekly,active};
  }).filter(group=>group.weekly.length||group.active||!filters.from&&!filters.to)
    .sort((a,b)=>(b.weekly[0]?.timestamp||0)-(a.weekly[0]?.timestamp||0)||a.project.title.localeCompare(b.project.title,'ko'));
 }
 function renderWeekly({groups,esc,button,Board,allHistory=false,oldest=false,collapsed=[],expanded=[]}){
  return '<div class="weekly-projects">'+groups.map(({project:p,events,weekly})=>{
   const closed=collapsed.includes(p.id),list=[...(allHistory?events:weekly)];if(oldest)list.reverse();const more=expanded.includes(p.id),shown=more?list:list.slice(0,3);
   return '<article class="weekly-project"><header class="weekly-project-head"><div>'+button('boardDetail',esc(p.title),'project-button','data-id="'+esc(p.id)+'"')+'<p>'+esc(p.customer||'고객 미지정')+' · '+esc(p.status)+' · 기간 내 기록 '+weekly.length+'건</p></div>'+button('reportFold',closed?'⌄':'⌃','weekly-fold','data-id="'+esc(p.id)+'" aria-label="과업 히스토리 '+(closed?'펼치기':'접기')+'" aria-expanded="'+!closed+'"')+'</header>'
    +'<div class="weekly-project-body"'+(closed?' hidden':'')+'><div class="weekly-task-summary" aria-label="현재 담당 업무">'+(p.tasks||[]).map(task=>'<div><strong>'+esc(task.role)+'</strong><span>'+esc(task.assignees.join(', ')||'미배정')+'</span><span>'+esc(task.status)+' · '+Board.progress(task)+'%</span><small>'+esc(task.started||'시작일 미정')+' ~ '+esc(task.due||'마감일 미정')+'</small></div>').join('')+'</div>'
    +'<ol class="weekly-history" aria-label="'+esc(p.title)+' 작업 히스토리">'+shown.map(event=>'<li><time datetime="'+esc(event.date)+'">'+esc(event.date)+'</time><div><div class="weekly-history-meta"><span>'+esc(event.kind)+'</span><strong>'+esc(event.author||'작성자 미기재')+'</strong>'+(event.recipients?'<span>→ '+esc(event.recipients.join(', '))+'</span>':'')+'</div><p>'+esc(event.content||'내용 없음')+'</p></div></li>').join('')+'</ol>'+(list.length>3?'<div class="weekly-more">'+button('reportMore',more?'기록 접기 ⌃':(list.length-3)+'개 기록 더 보기 ⌄','','data-id="'+esc(p.id)+'" aria-expanded="'+more+'"')+'</div>':'')+(!list.length?'<p class="weekly-empty">'+(allHistory?'등록된 작업 히스토리가 없습니다.':'선택 기간에 등록된 기록이 없습니다. 담당 업무는 진행 중입니다.')+'</p>':'')+'</div></article>';
  }).join('')+(!groups.length?'<p class="empty">선택 기간에 진행한 과업이나 작업 기록이 없습니다.</p>':'')+'</div>';
 }
 const api={render,history,weeklyGroups,renderWeekly};if(typeof module!=='undefined')module.exports=api;else root.BoardProjectReport=api;
})(typeof window!=='undefined'?window:globalThis);
