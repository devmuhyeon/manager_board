(function(root){
 'use strict';
 const lanes=[
  {id:'queue',label:'할 일',statuses:['예정','대기']},
  {id:'doing',label:'진행 중',statuses:['진행중']},
  {id:'review',label:'검토 · 보류',statuses:['검토중','보류']},
  {id:'done',label:'완료',statuses:['완료']}
 ];
 function items(project){
  return project.tasks?.length ? project.tasks : [{
   id:'',role:'과업',assignees:project.assignees,due:project.due,started:project.started,
   status:project.status,completedOn:project.completedOn,notes:project.description,
   statusBeforeCompletion:project.statusBeforeCompletion
  }];
 }
 function cards(rows,name,showDone,C){
  const query=name.trim().toLocaleLowerCase('ko');
  return rows.flatMap(project=>{
   const tasks=items(project).filter(task=>!query||task.assignees.some(person=>person.toLocaleLowerCase('ko').includes(query)));
   if(!tasks.length)return [];
   const open=tasks.filter(task=>task.status!=='완료');
   if(!open.length&&!showDone)return [];
   const status=C.effective({...project,overrides:{},tasks}).status;
   const nextDue=open.map(task=>task.due).filter(Boolean).sort()[0]||project.due||project.requestedDue||'';
   const completedOn=!open.length&&tasks.every(task=>task.completedOn)
    ? tasks.map(task=>task.completedOn).sort().at(-1) : '';
   return [{project,tasks,status,nextDue,completedOn,remaining:open.length}];
  }).sort((a,b)=>(a.nextDue||'9999').localeCompare(b.nextDue||'9999')||a.project.title.localeCompare(b.project.title,'ko'));
 }
 function completion(previous,status,today){
  if(status==='완료')return {
   completedOn:previous?.status==='완료'?previous.completedOn||'':today,
   statusBeforeCompletion:previous?.status==='완료'?previous.statusBeforeCompletion||'':previous?.status||''
  };
  return {completedOn:'',statusBeforeCompletion:''};
 }
 function toggle(raw,taskId,C){
  const project=C.effective(raw);
  const task=items(project).find(item=>item.id===taskId);
  if(!task)throw new Error('담당 업무를 찾을 수 없습니다.');
  const prior=task.statusBeforeCompletion;
  const status=task.status==='완료'
   ? C.STATUSES.find(value=>value===prior&&value!=='완료')||'진행중'
   : '완료';
  const update={status,...completion({...task,statusBeforeCompletion:prior},status,C.today())};
  const changes=project.tasks?.length
   ? {tasks:project.tasks.map(item=>item.id===taskId?{...item,...update}:item)}
   : update;
  const next=raw.source==='import'
   ? {...raw,overrides:{...raw.overrides,...changes}}
   : {...raw,...changes};
  return {...next,updatedAt:new Date().toISOString()};
 }
 function move(raw,laneId,name,C){
  const lane=lanes.find(item=>item.id===laneId);
  if(!lane)throw new Error('목록을 찾을 수 없습니다.');
  const project=C.effective(raw),query=name.trim().toLocaleLowerCase('ko'),status=lane.statuses[0];
  const update=task=>(!query||task.assignees.some(person=>person.toLocaleLowerCase('ko').includes(query)))
   ? {...task,status,...completion(task,status,C.today())}:task;
  const changes=project.tasks?.length?{tasks:project.tasks.map(update)}:update(project);
  return {...raw,...(raw.source==='import'?{overrides:{...raw.overrides,...changes}}:changes),updatedAt:new Date().toISOString()};
 }
 function groups(list,mode,members,C){
  if(mode==='status')return lanes.map(lane=>({...lane,entries:list.filter(card=>lane.statuses.includes(card.status))}));
  if(mode==='project')return list.map(card=>({id:card.project.id,label:card.project.title,entries:[card]}));
  const keys=task=>mode==='person'?(task.assignees.length?task.assignees:['담당자 미지정']):(task.assignees.length?[...new Set(task.assignees.map(name=>members.find(m=>m.name===name)?.team||'팀 미지정'))]:['팀 미지정']);
  const labels=[...new Set(list.flatMap(card=>card.tasks.flatMap(keys)))];
  return labels.map(label=>({id:label,label,entries:list.flatMap(card=>{
   const tasks=card.tasks.filter(task=>keys(task).includes(label));
   return tasks.length?cards([{...card.project,overrides:{},tasks}],'',true,C):[];
  })}));
 }
 function render({rows,name,showDone,C,N,esc,button,dday,orderNames,mode='status',members=[]}){
  const list=cards(rows,name,showDone,C);
  const remaining=list.reduce((total,card)=>total+card.remaining,0);
  const today=C.today();
  function renderCard({project,tasks,status,nextDue,completedOn,remaining}){
   const complete=tasks.length-remaining;
   const dueLabel=completedOn?'완료 '+completedOn
    : !remaining?'완료 · 날짜 기록 없음'
    : nextDue?'마감 '+nextDue+' · '+dday(nextDue,today):'마감일 미정';
   const people=orderNames([...new Set(tasks.flatMap(task=>task.assignees))]);
   return '<article class="task-board-card" draggable="'+(mode==='status')+'" data-card-id="'+esc(project.id)+'">'
    +'<span class="board-card-label">'+esc(project.customer||project.taskCategory||'팀 과업')+'</span>'
    +button('edit','편집','board-edit','data-id="'+esc(project.id)+'" aria-label="'+esc(project.title)+' 카드 편집"')
    +button('boardDetail',esc(project.title),'task-board-title','data-id="'+esc(project.id)+'"')
    +'<p class="task-board-assignees">'+esc(people.join(', ')||'담당자 미지정')+'</p>'
    +'<span class="task-board-due'+(remaining&&nextDue&&nextDue<today?' is-overdue':'')+'">'+esc(dueLabel)+'</span>'
    +'<div class="task-board-progress"><span>담당 업무 완료</span><strong>'+complete+'/'+tasks.length+'</strong></div>'
    +'<progress value="'+complete+'" max="'+tasks.length+'" aria-label="'+esc(project.title)+' 완료한 담당 업무"></progress>'
    +'<ul class="task-board-checklist">'+tasks.map(task=>{
     const checked=task.status==='완료';
     const label=N.teamLabel(task.role)||'담당 업무';
     const names=orderNames(task.assignees).join(', ');
     return '<li>'+button('toggleBoardTask',
      '<span class="task-check-mark" aria-hidden="true">'+(checked?'✓':'')+'</span><span>'+esc(label)
       +(names?'<small>'+esc(names)+'</small>':'')+'<small>'+esc(checked?(task.completedOn?'완료 '+task.completedOn:'완료'):(task.due?'마감 '+task.due:'마감일 미정'))+'</small></span>',
      'task-check','data-id="'+esc(project.id)+'" data-task-id="'+esc(task.id)+'" aria-pressed="'+checked
       +'" aria-label="'+esc(project.title+' · '+label+(names?' · '+names:''))+'"')+button('editBoardTask','수정','board-task-edit','data-id="'+esc(project.id)+'" data-task-id="'+esc(task.id)+'" aria-label="'+esc(project.title+' · '+label)+' 수정"')+'</li>';
    }).join('')+'</ul><label '+(mode!=='status'?'hidden ':'')+'class="board-move-label">목록 이동<select data-board-move="'+esc(project.id)+'" aria-label="'+esc(project.title)+' 목록 이동">'+lanes.map(lane=>'<option value="'+lane.id+'"'+(lane.statuses.includes(status)?' selected':'')+'>'+lane.label+'</option>').join('')+'</select></label></article>';
  }
  return '<div class="task-board-wrap">'
   +'<p class="task-board-total" role="status"><strong>남은 과업 '+list.filter(card=>card.remaining).length+'개</strong>'
   +'<span>미완료 담당 업무 '+remaining+'개 · 마감일 가까운 순</span></p>'
   +'<div class="task-board" tabindex="0" role="region" aria-label="상태별 과업 보드">'
   +(!list.length&&mode!=='status'?'<p class="task-board-empty">조건에 맞는 과업이 없습니다. 담당자 검색을 바꾸거나 새 과업을 등록해 주세요.</p>':'')
   +groups(list,mode,members,C).map(lane=>{
    const entries=lane.entries;
    return '<section class="task-board-lane" '+(mode==='status'?'data-lane="'+lane.id+'"':'')+'><h3><span>'+esc(N.teamLabel(lane.label))+'</span><span class="count">'+entries.length+'</span></h3>'
     +(entries.map(renderCard).join('')||'<p class="task-board-empty">'+(lane.id==='done'&&!showDone?'완료 포함을 켜면 완료 카드가 표시됩니다.':'카드를 이곳으로 옮겨 보세요.')+'</p>')+(mode==='status'?button('boardAdd','＋ 카드 추가','board-add','data-lane="'+lane.id+'"'):'')+'</section>';
   }).join('')+'</div></div>';
 }
 const api={cards,toggle,completion,render,move,lanes,groups};
 if(typeof module!=='undefined')module.exports=api;else root.BoardTaskBoard=api;
})(typeof window!=='undefined'?window:globalThis);
