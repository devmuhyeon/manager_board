(function(root){
 'use strict';
 const Icons=typeof module!=='undefined'?require('./arrow-icons.js'):root.BoardArrowIcons;
 const lanes=[
  {id:'queue',label:'접수',statuses:['접수','예정','대기']},
  {id:'doing',label:'진행중',statuses:['진행중','검토중']},
  {id:'done',label:'완료',statuses:['완료']},
  {id:'revision',label:'완료 후 수정',statuses:['완료 후 수정']},
  {id:'released',label:'운영반영완료',statuses:['운영반영완료']},
  {id:'hold',label:'보류',statuses:['보류']}
 ];
 const isDone=status=>status==='완료'||status==='운영반영완료';
 function items(project){
  return project.tasks?.length ? project.tasks : [{
   id:'',role:'과업',assignees:project.assignees,due:project.due,started:project.started,
   revisionRequired:project.revisionRequired,revisionProgress:project.revisionProgress,progress:project.progress,progressBeforeCompletion:project.progressBeforeCompletion,status:project.status,completedOn:project.completedOn,notes:project.description,
   statusBeforeCompletion:project.statusBeforeCompletion
  }];
 }
 function cards(rows,name,showDone,C,period={}){
  const query=name.trim().toLocaleLowerCase('ko');
  return rows.flatMap(project=>{
   const tasks=items(project).filter(task=>(!query||project.title.toLocaleLowerCase('ko').includes(query)||task.assignees.some(person=>person.toLocaleLowerCase('ko').includes(query)))&&(!period.from||task.due&&task.due>=period.from)&&(!period.to||task.due&&task.due<=period.to));
   if(!tasks.length)return [];
   const open=tasks.filter(task=>!isDone(task.status));
   if(!open.length&&!showDone)return [];
   const status=C.effective({...project,overrides:{},tasks}).status;
   const nextDue=open.map(task=>task.due).filter(Boolean).sort()[0]||project.due||project.requestedDue||'';
   const completedOn=!open.length&&tasks.every(task=>task.completedOn)
    ? tasks.map(task=>task.completedOn).sort().at(-1) : '';
   return [{project,tasks,status,nextDue,completedOn,remaining:open.length}];
  }).sort((a,b)=>(a.nextDue||'9999').localeCompare(b.nextDue||'9999')||a.project.title.localeCompare(b.project.title,'ko'));
 }
 function canProgress(task,actor){return Boolean(actor)&&task.assignees?.includes(actor);}
 function requireOwner(task,actor){if(!canProgress(task,actor))throw new Error('본인이 담당하는 업무의 진행률만 변경할 수 있습니다.');}
 function guardEdit(previous,task,actor){
  if(previous&&(!canProgress(previous,actor)||!canProgress(task,actor))){
   if(Boolean(previous.revisionRequired)!==Boolean(task.revisionRequired)||previous.status!==task.status||progress(previous)!==progress(task)||(previous.revisionProgress||0)!==(task.revisionProgress||0))throw new Error('다른 담당자의 진행률과 완료 상태는 변경할 수 없습니다.');
   return {...task,revisionRequired:previous.revisionRequired,status:previous.status,progress:previous.progress,revisionProgress:previous.revisionProgress,completedOn:previous.completedOn,statusBeforeCompletion:previous.statusBeforeCompletion,progressBeforeCompletion:previous.progressBeforeCompletion};
  }
  if(previous&&task.status==='완료 후 수정'&&!task.revisionRequired&&(previous.revisionProgress||0)!==(task.revisionProgress||0))throw new Error('수정 필요를 먼저 체크해 주세요.');
  if(!previous&&!canProgress(task,actor)&&(progress(task)!==0||isDone(task.status)))throw new Error('다른 담당자의 새 업무는 진행률 0%로 등록해 주세요.');
  return task;
 }
 function progress(task){
  return isDone(task.status)?100:Math.min(task.status==='완료 후 수정'?100:99,Math.max(0,Number.isFinite(task.progress)?task.progress:0));
 }
 function average(tasks){return Math.floor(tasks.reduce((sum,task)=>sum+progress(task),0)/Math.max(1,tasks.length));}
 function setRevisionRequired(raw,taskId,value,C,actor){
  const project=C.effective(raw),task=items(project).find(item=>item.id===taskId);
  if(!task)throw new Error('담당 업무를 찾을 수 없습니다.');requireOwner(task,actor);
  if(!items(project).some(item=>item.status==='완료 후 수정'))throw new Error('완료 후 수정 카드에서만 선택할 수 있습니다.');
  const update={...(value?{status:'완료 후 수정',...completion(task,'완료 후 수정',C.today())}:{}),revisionRequired:Boolean(value)};
  const changes=project.tasks?.length?{tasks:project.tasks.map(item=>item.id===taskId?{...item,...update}:item)}:update;
  return {...raw,...(raw.source==='import'?{overrides:{...raw.overrides,...changes}}:changes),updatedAt:new Date().toISOString()};
 }
 function setRevisionProgress(raw,taskId,value,C,actor){
  if(!Number.isInteger(value)||value<0||value>100)throw new Error('수정 진행률은 0~100 사이로 입력해 주세요.');
  const project=C.effective(raw),task=items(project).find(item=>item.id===taskId);
  if(!task)throw new Error('담당 업무를 찾을 수 없습니다.');requireOwner(task,actor);
  if(task.status!=='완료 후 수정')throw new Error('완료 후 수정 상태에서만 수정 진행률을 바꿀 수 있습니다.');
  if(!task.revisionRequired)throw new Error('수정 필요를 먼저 체크해 주세요.');
  const changes=project.tasks?.length?{tasks:project.tasks.map(item=>item.id===taskId?{...item,revisionProgress:value}:item)}:{revisionProgress:value};
  return {...raw,...(raw.source==='import'?{overrides:{...raw.overrides,...changes}}:changes),updatedAt:new Date().toISOString()};
 }
 function setProgress(raw,taskId,value,C,actor){
  if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>100)throw new Error('진행률은 0~100 사이의 정수로 입력해 주세요.');
  const project=C.effective(raw),task=items(project).find(item=>item.id===taskId);
  if(!task)throw new Error('담당 업무를 찾을 수 없습니다.');
  requireOwner(task,actor);
  const status=value===100?'완료':value===0?'접수':'진행중';
  const update={...completion(task,status,C.today()),status,progress:value};
  const changes=project.tasks?.length?{tasks:project.tasks.map(item=>item.id===taskId?{...item,...update}:item)}:update;
  return {...raw,...(raw.source==='import'?{overrides:{...raw.overrides,...changes}}:changes),updatedAt:new Date().toISOString()};
 }
 function completion(previous,status,today){
  if(status==='완료 후 수정')return {progress:progress(previous||{}),completedOn:previous?.completedOn||'',statusBeforeCompletion:previous?.statusBeforeCompletion||'',progressBeforeCompletion:previous?.progressBeforeCompletion||0,revisionProgress:previous?.revisionProgress||0};
  if(isDone(status))return {
   progress:100,progressBeforeCompletion:isDone(previous?.status)?previous.progressBeforeCompletion||0:progress(previous||{}),
   completedOn:isDone(previous?.status)?previous.completedOn||'':today,
   statusBeforeCompletion:isDone(previous?.status)?previous.statusBeforeCompletion||'':previous?.status||''
  };
  return {completedOn:'',statusBeforeCompletion:'',progress:isDone(previous?.status)?previous.progressBeforeCompletion||0:progress(previous||{}),progressBeforeCompletion:0};
 }
 function toggle(raw,taskId,C,actor){
  const project=C.effective(raw);
  const task=items(project).find(item=>item.id===taskId);
  if(!task)throw new Error('담당 업무를 찾을 수 없습니다.');
  requireOwner(task,actor);
  const prior=task.statusBeforeCompletion;
  const status=isDone(task.status)
   ? C.STATUSES.find(value=>value===prior&&!isDone(value))||'진행중'
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
 function move(raw,laneId,name,C,actor){
  const lane=lanes.find(item=>item.id===laneId);
  if(!lane)throw new Error('목록을 찾을 수 없습니다.');
  const project=C.effective(raw),query=name.trim().toLocaleLowerCase('ko'),status=lane.statuses[0];
  if(!items(project).some(task=>canProgress(task,actor)&&(!query||project.title.toLocaleLowerCase('ko').includes(query)||task.assignees.some(person=>person.toLocaleLowerCase('ko').includes(query)))))throw new Error('이 카드에 이동할 수 있는 본인 업무가 없습니다.');
  const update=task=>(canProgress(task,actor)&&(!query||project.title.toLocaleLowerCase('ko').includes(query)||task.assignees.some(person=>person.toLocaleLowerCase('ko').includes(query))))
   ? (status==='완료 후 수정'?{...task,status,revisionRequired:task.status==='완료 후 수정'&&Boolean(task.revisionRequired),revisionProgress:task.revisionProgress||0}:{...task,status,...completion(task,status,C.today())}):task;
  const changes=project.tasks?.length?{tasks:project.tasks.map(update)}:update(project);
  return {...raw,...(raw.source==='import'?{overrides:{...raw.overrides,...changes}}:changes),updatedAt:new Date().toISOString()};
 }
 function groups(list,mode,members,C,actor='',rankOrder){
  if(mode==='status')return lanes.map(lane=>({...lane,entries:list.filter(card=>lane.statuses.includes(card.status)).sort((a,b)=>String(b.project.updatedAt||b.project.createdAt||b.project.requested||b.nextDue||'').localeCompare(String(a.project.updatedAt||a.project.createdAt||a.project.requested||a.nextDue||'')))}));
  if(mode==='project')return list.map(card=>({id:card.project.id,label:card.project.title,entries:[card]}));
  const keys=task=>mode==='person'?(task.assignees.length?task.assignees:['담당자 미지정']):(task.assignees.length?[...new Set(task.assignees.map(name=>members.find(m=>m.name===name)?.team||'팀 미지정'))]:['팀 미지정']);
  const labels=[...new Set(list.flatMap(card=>card.tasks.flatMap(keys)))];
  if(mode==='team'){const order=['기획','디자인','퍼블','콘텐츠'];labels.sort((a,b)=>(order.includes(a)?order.indexOf(a):99)-(order.includes(b)?order.indexOf(b):99));}
  if(mode==='person'){
   const me=members.find(member=>member.name===actor),ranks=rankOrder||['대표','사장','부사장','전무','상무','이사','부장','차장','과장','대리','주임','사원','인턴'];
   const teamIndex=member=>member?.team===me?.team&&me?-1:(C.TEAMS.indexOf(member?.team)<0?C.TEAMS.length:C.TEAMS.indexOf(member?.team));
   const rank=member=>ranks.indexOf(member?.rank)<0?ranks.length:ranks.indexOf(member.rank);
   labels.sort((a,b)=>{const ma=members.find(member=>member.name===a),mb=members.find(member=>member.name===b);return teamIndex(ma)-teamIndex(mb)||Number(b===actor)-Number(a===actor)||rank(ma)-rank(mb)||a.localeCompare(b,'ko');});
  }
  return labels.map(label=>({id:label,label,team:mode==='person'?members.find(member=>member.name===label)?.team:'',entries:list.flatMap(card=>{
   const tasks=card.tasks.filter(task=>keys(task).includes(label));
   return tasks.length?cards([{...card.project,overrides:{},tasks}],'',true,C):[];
  })}));
 }
 function orderedTasks(tasks,members,orderNames){
  const roles=['기획','콘텐츠 기획','디자인','콘텐츠 디자인','퍼블','퍼블리싱'];
  const people=orderNames([...new Set(tasks.flatMap(task=>task.assignees))]);
  return tasks.slice().sort((a,b)=>{
   const role=task=>{const index=roles.indexOf(task.role);return index<0?roles.length:index;};
   const person=task=>Math.min(...task.assignees.map(name=>people.indexOf(name)),people.length);
   return role(a)-role(b)||person(a)-person(b);
  });
 }
 function weekGroups(list){
  const groups=new Map();
  for(const card of list){
   const value=card.nextDue||card.project.requestedDue||'';
   const date=/^\d{4}-\d{2}-\d{2}$/.test(value)?new Date(value+'T00:00:00Z'):null;
   let key='undated',label='마감일 미정';
   if(date&&!Number.isNaN(date.getTime())){
    const year=date.getUTCFullYear(),month=date.getUTCMonth(),day=date.getUTCDate();
    const offset=(new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7;
    const week=Math.floor((day-1+offset)/7)+1;
    const first=Math.max(1,1-offset+(week-1)*7),last=Math.min(new Date(Date.UTC(year,month+1,0)).getUTCDate(),7-offset+(week-1)*7);
    key=year+'-'+String(month+1).padStart(2,'0')+'-'+String(week);
    label=year+'년 '+(month+1)+'월 '+week+'주차 ('+(month+1)+'/'+first+'~'+(month+1)+'/'+last+')';
   }
   if(!groups.has(key))groups.set(key,{key,label,entries:[]});groups.get(key).entries.push(card);
  }
  return [...groups.values()].sort((a,b)=>a.key==='undated'?1:b.key==='undated'?-1:b.key.localeCompare(a.key));
 }
 function render({rows,name,showDone,C,N,esc,button,dday,orderNames,mode='status',members=[],rankOrder,actor='',layout='cards',period={},closedWeeks=[],closedLanes=[],expandedCards=[],weekGrouping='all'}){
  const list=cards(rows,name,showDone,C,period);
  const remaining=list.reduce((total,card)=>total+card.remaining,0);
  const today=C.today();
  function renderCard({project,tasks,status,nextDue,completedOn,remaining}){
   tasks=orderedTasks(tasks,members,orderNames);
   const expanded=expandedCards.includes(project.id);
   const complete=tasks.length-remaining;
   const revisionTasks=tasks.filter(task=>task.status==='완료 후 수정'&&task.revisionRequired),revisionPercent=revisionTasks.length?Math.floor(revisionTasks.reduce((sum,task)=>sum+(task.revisionProgress||0),0)/revisionTasks.length):0;
   const dueLabel=completedOn?'완료 '+completedOn
    : !remaining?'완료 · 날짜 기록 없음'
    : nextDue?'마감 '+nextDue+' · '+dday(nextDue,today):'마감일 미정';
   const people=orderNames([...new Set(tasks.flatMap(task=>task.assignees))]);
   return '<article class="task-board-card'+(expanded?' is-expanded':'')+'" draggable="'+(mode==='status'&&tasks.some(task=>canProgress(task,actor)))+'" title="'+(mode==='status'?'카드를 잡아 다른 진행 목록으로 이동':'')+'" data-card-id="'+esc(project.id)+'">'
    +'<span class="board-card-label">'+esc(project.customer||project.taskCategory||'팀 과업')+'</span>'
    +'<div class="board-card-actions">'+button('edit','편집','board-edit','data-id="'+esc(project.id)+'" aria-label="'+esc(project.title)+' 카드 편집"')+button('toggleCardDetails',Icons.arrow(expanded?'up':'down'),'board-card-fold','data-id="'+esc(project.id)+'" aria-expanded="'+expanded+'" aria-label="'+esc(project.title)+' 담당 업무 상세 접기 또는 펼치기"')+'</div>'
    +button('boardDetail',esc(project.title),'task-board-title','data-id="'+esc(project.id)+'"')
    +'<p class="task-board-assignees">'+esc(people.join(', ')||'담당자 미지정')+'</p>'
    +'<span class="task-board-due'+(remaining&&nextDue&&nextDue<today?' is-overdue':'')+'">'+esc(dueLabel)+'</span>'
    +'<div class="task-board-progress"><span>진행률 · '+complete+'/'+tasks.length+' 완료</span><strong data-card-percent>'+average(tasks)+'%</strong></div>'
    +'<progress value="'+average(tasks)+'" max="100" aria-label="'+esc(project.title)+' 완료한 담당 업무"></progress>'
    +(tasks.some(task=>task.status==='완료 후 수정')?'<div class="card-revision-summary"><div class="task-board-progress"><span>전체 수정 진행률'+(revisionTasks.length?' · '+revisionTasks.filter(task=>(task.revisionProgress||0)===100).length+'/'+revisionTasks.length+' 완료':' · 수정 업무 선택 전')+'</span><strong>'+revisionPercent+'%</strong></div><progress class="revision-progress" value="'+revisionPercent+'" max="100" aria-label="'+esc(project.title)+' 수정 진행률"></progress></div>':'')
    +'<div class="board-card-details"'+(expanded?'':' inert')+' aria-hidden="'+!expanded+'"><div class="board-card-details-inner"><ul class="task-board-checklist">'+tasks.map(task=>{
     const checked=isDone(task.status),locked=!canProgress(task,actor);
     const baseLock=locked?' disabled title="담당자 본인만 진행률을 변경할 수 있습니다"':task.status==='완료 후 수정'?' disabled title="수정 진행률은 아래 수정 게이지에서 변경하세요"':'';
     const lock=locked?' disabled title="담당자 본인만 진행률을 변경할 수 있습니다"':'';
     const content=task.assignees.length&&task.assignees.every(name=>members.find(m=>m.name===name)?.team==='콘텐츠');
     const label=content&&['기획','디자인'].includes(task.role)?'콘텐츠 '+task.role:N.teamLabel(task.role)||'담당 업무';
     const names=orderNames(task.assignees).join(', ');
     return '<li class="task-work-section" data-task-section="'+esc(task.id)+'" aria-label="'+esc(label+' · '+names)+'"><div class="task-work-heading">'+button('toggleBoardTask',
      '<span class="task-check-mark" aria-hidden="true">'+(checked?'✓':'')+'</span><span>'+esc(label)
       +(names?'<small>'+esc(names)+'</small>':'')+'<small>'+esc(checked?(task.completedOn?'완료 '+task.completedOn:'완료'):(task.due?'마감 '+task.due:'마감일 미정'))+'</small></span>',
      'task-check',baseLock+' data-id="'+esc(project.id)+'" data-task-id="'+esc(task.id)+'" aria-pressed="'+checked
       +'" aria-label="'+esc(project.title+' · '+label+(names?' · '+names:''))+'"')+button('editBoardTask','수정','board-task-edit','data-id="'+esc(project.id)+'" data-task-id="'+esc(task.id)+'" aria-label="'+esc(project.title+' · '+label)+' 수정"')+'</div><div class="task-progress-control"><input '+baseLock+' type="range" min="0" max="100" step="1" value="'+progress(task)+'" data-progress-id="'+esc(project.id)+'" data-progress-task="'+esc(task.id)+'" aria-label="'+esc(label+' · '+names)+' 진행률 조절"><input '+baseLock+' type="number" min="0" max="100" step="1" value="'+progress(task)+'" data-progress-id="'+esc(project.id)+'" data-progress-task="'+esc(task.id)+'" aria-label="'+esc(label+' · '+names)+' 진행률 숫자"><span>%</span></div>'+(tasks.some(item=>item.status==='완료 후 수정')?'<div class="task-revision-section" aria-label="'+esc(label)+' 수정 관리"><label class="revision-required"><input type="checkbox" '+lock+(task.revisionRequired?' checked':'')+' data-revision-required="'+esc(project.id)+'" data-task-id="'+esc(task.id)+'">'+esc(label)+' 수정 필요</label>':'')+(task.status==='완료 후 수정'&&task.revisionRequired?'<div class="task-progress-control revision-control"><strong>'+esc(label)+' 수정 진행률</strong><input '+lock+' type="range" min="0" max="100" step="1" value="'+(task.revisionProgress||0)+'" data-progress-id="'+esc(project.id)+'" data-progress-task="'+esc(task.id)+'" data-progress-kind="revision" aria-label="'+esc(label+' · '+names)+' 수정 진행률"><input '+lock+' type="number" min="0" max="100" step="1" value="'+(task.revisionProgress||0)+'" data-progress-id="'+esc(project.id)+'" data-progress-task="'+esc(task.id)+'" data-progress-kind="revision" aria-label="'+esc(label+' · '+names)+' 수정 진행률 숫자"><span>%</span></div>':'')+(tasks.some(item=>item.status==='완료 후 수정')?'</div>':'')+'</li>';
    }).join('')+'</ul><label '+(mode!=='status'?'hidden ':'')+'class="board-move-label">목록 이동<select '+(tasks.some(task=>canProgress(task,actor))?'':'disabled')+' data-board-move="'+esc(project.id)+'" aria-label="'+esc(project.title)+' 목록 이동">'+lanes.map(lane=>'<option value="'+lane.id+'"'+(lane.statuses.includes(status)?' selected':'')+'>'+lane.label+'</option>').join('')+'</select></label></div></div></article>';
  }
  if(layout==='table'){
   const sections=mode==='project'?weekGroups(list).flatMap(week=>weekGrouping==='all'?[week]:groups(week.entries,weekGrouping,members,C,actor,rankOrder).map(group=>({...group,key:week.key+':'+group.id,label:week.label+' · '+N.teamLabel(group.label)}))):groups(list,mode,members,C,actor,rankOrder);
   const closed=section=>mode==='project'?closedWeeks.includes(section.key):mode==='status'&&closedLanes.includes(section.id);
   return '<div class="board-table-view">'+sections.map(section=>'<section class="board-table-section"><h3>'+(['project','status'].includes(mode)?button(mode==='project'?'toggleWeek':'toggleLane',Icons.arrow(closed(section)?'down':'up'),'lane-toggle','data-key="'+esc(section.key||section.id)+'" aria-label="'+esc(section.label)+' 접기 또는 펼치기" aria-expanded="'+!closed(section)+'"'):'')+esc(N.teamLabel(section.label))+(section.team?' · '+esc(N.teamLabel(section.team))+'팀':'')+' <span class="count">'+section.entries.length+'</span></h3><div class="table-wrap"'+(closed(section)?' hidden':'')+'><table><caption class="sr-only">'+esc(section.label)+' 과업 도표</caption><thead><tr><th>과업</th><th>담당 업무</th><th>담당자</th><th>진행상태</th><th>진행률</th><th>마감일</th><th>수정</th></tr></thead><tbody>'+section.entries.flatMap(card=>orderedTasks(card.tasks,members,orderNames).map(task=>'<tr><td>'+button('boardDetail',esc(card.project.title),'project-button','data-id="'+esc(card.project.id)+'"')+'</td><td>'+esc(N.teamLabel(task.role))+'</td><td>'+esc(orderNames(task.assignees).join(', '))+'</td><td>'+esc(lanes.find(lane=>lane.statuses.includes(task.status))?.label||task.status)+'</td><td><span class="table-percent">'+progress(task)+'%</span><progress max="100" value="'+progress(task)+'" aria-label="진행률"></progress>'+(task.status==='완료 후 수정'&&task.revisionRequired?'<small>수정 진행률 '+(task.revisionProgress||0)+'%</small><progress class="revision-progress" max="100" value="'+(task.revisionProgress||0)+'" aria-label="수정 진행률"></progress>':'')+'</td><td>'+esc(task.due||'미정')+'</td><td>'+button('editBoardTask','수정','','data-id="'+esc(card.project.id)+'" data-task-id="'+esc(task.id)+'"')+'</td></tr>')).join('')+'</tbody></table></div></section>').join('')+(!list.length?'<p class="empty">조건에 맞는 과업이 없습니다.</p>':'')+'</div>';
  }
  if(mode==='project')return '<div class="task-board-wrap weekly-board">'+weekGroups(list).map(week=>'<section class="board-week"><h3>'+button('toggleWeek','<span>'+esc(week.label)+' <span class="count">'+week.entries.length+'</span></span><span aria-hidden="true">'+Icons.arrow(closedWeeks.includes(week.key)?'down':'up')+'</span>','board-collapse','data-key="'+esc(week.key)+'" aria-expanded="'+!closedWeeks.includes(week.key)+'"')+'</h3><div class="board-week-cards"'+(closedWeeks.includes(week.key)?' hidden':'')+'>'+(weekGrouping==='all'?week.entries.map(renderCard).join(''):groups(week.entries,weekGrouping,members,C,actor,rankOrder).map(group=>'<section class="week-subgroup"><h4>'+esc(N.teamLabel(group.label))+(group.team?' · '+esc(N.teamLabel(group.team)):'')+' <span class="count">'+group.entries.length+'</span></h4><div class="week-subgroup-cards">'+group.entries.map(renderCard).join('')+'</div></section>').join(''))+'</div></section>').join('')+(!list.length?'<p class="empty">조건에 맞는 과업이 없습니다.</p>':'')+'</div>';
  return '<div class="task-board-wrap">'
   +'<p class="task-board-total" role="status"><strong>남은 과업 '+list.filter(card=>card.remaining).length+'개</strong>'
   +(mode==='status'?'<span class="board-drag-hint">카드를 잡아 다른 목록으로 옮기세요</span>':'')
   +'<span>미완료 담당 업무 '+remaining+'개</span></p>'
   +'<div class="task-board '+(mode==='status'?'status-board':'')+'" tabindex="0" role="region" aria-label="상태별 과업 보드">'
   +(!list.length&&mode!=='status'?'<p class="task-board-empty">조건에 맞는 과업이 없습니다. 담당자 검색을 바꾸거나 새 과업을 등록해 주세요.</p>':'')
   +groups(list,mode,members,C,actor,rankOrder).map(lane=>{
    const entries=lane.entries,closed=mode==='status'&&closedLanes.includes(lane.id);
    return '<section class="task-board-lane '+(closed?'is-collapsed':'')+'" '+(mode==='status'?'data-lane="'+lane.id+'"':'')+'><h3>'+(mode==='status'?button('toggleLane',Icons.arrow(closed?'down':'up'),'lane-toggle','data-key="'+lane.id+'" aria-label="'+lane.label+' 접기 또는 펼치기" aria-expanded="'+!closed+'"'):'')+'<span>'+esc(N.teamLabel(lane.label))+(lane.team?'<small class="person-team-label">'+esc(N.teamLabel(lane.team))+'팀</small>':'')+'</span><span class="count">'+entries.length+'</span></h3>'
     +'<div class="lane-content"'+(closed?' hidden':'')+'>'+(entries.map(renderCard).join('')||'<p class="task-board-empty">'+(lane.id==='done'&&!showDone?'완료 포함을 켜면 완료 카드가 표시됩니다.':'카드를 이곳으로 옮겨 보세요.')+'</p>')+(mode==='status'?button('boardAdd','＋ 카드 추가','board-add','data-lane="'+lane.id+'"'):'')+'</div></section>';
   }).join('')+'</div></div>';
 }

 const workflowRoles=['기획','디자인','퍼블'];
 function sourceDetails(project,role=''){
  const raw=project.raw;
  if(!raw)return {title:project.title,customer:project.customer||project.requester,requestedDue:project.requestedDue,status:project.status,assignees:role?items(project).filter(task=>task.role===role).flatMap(task=>task.assignees||[]).join(', '):project.assignees?.join(', '),notes:project.description};
  const nested=raw.처리결과||raw.처리정보;
  const fields={...raw,...(nested&&typeof nested==='object'?nested:{})};
  const value=(...keys)=>keys.map(key=>fields[key]).find(x=>x!==undefined&&x!==null&&x!=='')??'';
  const notes=value('작업내용_'+role,role+'작업내용','작업내용','작업 내용','description','요청사항','요청내용');
  const lines=String(notes).split(/\r?\n/);
  const start=lines[0].match(/^\uFEFF?작업시작일자\s*[:：]\s*(\d{4}-\d{2}-\d{2})\s*$/)?.[1];
  const end=lines.map(line=>line.match(/^작업종료일자\s*[:：]\s*(\d{4}-\d{2}-\d{2})\s*$/)?.[1]).find(Boolean);
  return {
   title:value('프로젝트명','과업명','요청제목','제목','요청명','사업명','title','name'),
   customer:value('고객명','요청자','requester','요청팀','고객팀','customer'),
   requestedDue:value('요청완료일','완료요청일','완료요청일자','requestedDue'),
   status:value('상태_'+role,'진행상태_'+role,'상태','진행상태','처리상태','status'),
   assignees:role?value('담당자_'+role):value('담당자','작업자','assignees'),
   notes,start,end
  };
 }
 function renderWorkflow({rows,name,C,esc,button,actor,period,sourceIds,demo,includeSamples=true,internalRows=rows}){
  const available=rows.filter(project=>demo||includeSamples&&project.sampleFixture||(project.source==='import'&&(!sourceIds||sourceIds.includes(project.id))));
  const entries=cards(available,name,true,C,period);
  const internal=new Map(internalRows.map(project=>[project.id,project]));
  const panels=workflowRoles.map(role=>{
   const tasks=entries.flatMap(({project,tasks})=>tasks.filter(task=>project.raw?task.id==='source-task:'+role:task.role===role||task.role==='과업'&&project.taskCategory===role).map(task=>({project,task})));
   return '<section class="workflow-column"><h3>'+role+' <span>'+tasks.length+'</span></h3><div class="workflow-scroll">'+(tasks.map(({project,task})=>{
    const raw=sourceDetails(project,role),data='data-id="'+esc(project.id)+'" data-task-id="'+esc(task.id)+'" data-role="'+role+'"';
    const saved=internal.get(project.id),actionTask=saved?.tasks?.find(item=>item.id===task.id)||task;
    const own=!project.readOnlySample&&canProgress(actionTask,actor),done=isDone(actionTask.status),release=saved?.workflowRelease?.[task.id];
    const status=project.raw?raw.status:task.status;
    const started=(project.sourceAssignments?.[role]||[]).map(item=>item.started).filter(Boolean).sort()[0];
    return '<article class="workflow-card" data-card-id="'+esc(project.id)+'">'
     +button('workflowDetail','<small>'+esc(status||'상태 미기재')+' / '+role+'</small><strong>'+esc(raw.title)+'</strong><span>'+esc(raw.customer||'—')+' | 완료요청일: '+esc(raw.requestedDue||'—')+'</span>'+(started?'<span>작업시작일자: '+esc(started)+'</span>':''),'workflow-card-summary',data)
     +'<div class="workflow-card-actions">'+button('toggleBoardTask',done?'완료 취소':'완료','',data+(own?'':' disabled'))
     +(project.readOnlySample?'':button('editBoardTask','수정','',data))+'<span>'+esc(raw.assignees||(!project.raw?task.assignees.join(', '):'')||'미배정')+'</span></div>'
     +'<div class="workflow-card-release">'+button('workflowRelease',release?.development?'개발 반영됨':'개발 반영','',data+' data-stage="development"'+(own&&!release?.development?'':' disabled'))
     +button('workflowRelease',release?.production?'운영 반영됨':'운영 반영','',data+' data-stage="production"'+(own&&!release?.production?'':' disabled'))+'</div></article>';
   }).join('')||'<p class="workflow-empty">표시할 작업이 없습니다.</p>')+'</div></section>';
  }).join('');
  const list=entries.map(({project})=>{
   const raw=sourceDetails(project);
   return button('workflowDetail','<strong>'+esc(raw.title)+'</strong><span>'+esc(raw.status||'—')+' · '+esc(raw.customer||'—')+'</span>','workflow-dashboard-row','data-id="'+esc(project.id)+'"');
  }).join('');
  return '<div class="workflow-board"><section class="workflow-column"><h3>대시보드 <span>'+entries.length+'</span></h3><div class="workflow-scroll">'+(list||'<p class="workflow-empty">표시할 과업이 없습니다.</p>')+'</div></section>'+panels+'</div>';
 }
 function recordRelease(raw,taskId,stage,C,actor){
  const project=C.effective(raw),task=items(project).find(item=>item.id===taskId);
  if(!task||!['development','production'].includes(stage))throw new Error('반영할 담당 업무를 확인해 주세요.');
  requireOwner(task,actor);
  const previous=project.workflowRelease?.[taskId]||{};
  if(previous[stage])return raw;
  const workflowRelease={...project.workflowRelease,[taskId]:{...previous,[stage]:{by:actor,at:new Date().toISOString()}}};
  return raw.source==='import'?{...raw,overrides:{...raw.overrides,workflowRelease}}:{...raw,workflowRelease};
 }
 function withHistory(change){return (...args)=>{
  const raw=args[0],C=args.at(-2),actor=args.at(-1),next=change(...args);
  const before=items(C.effective(raw)),after=items(C.effective(next)),at=new Date().toISOString();
  const logs=after.flatMap(task=>{
   const previous=before.find(t=>t.id===task.id);if(!previous)return [];
   const changes=[];
   if(previous.status!==task.status)changes.push(previous.status+'에서 '+task.status+'로 변경');
   if(progress(previous)!==progress(task))changes.push('진행률 '+progress(previous)+'%에서 '+progress(task)+'%로 변경');
   if(Boolean(previous.revisionRequired)!==Boolean(task.revisionRequired))changes.push(task.revisionRequired?'수정 필요 선택':'수정 필요 해제');
   if((previous.revisionProgress||0)!==(task.revisionProgress||0))changes.push('수정 진행률 '+(previous.revisionProgress||0)+'%에서 '+(task.revisionProgress||0)+'%로 변경');
   return changes.length?[{id:C.uid(),date:C.today(),at,author:actor,kind:'진행 변경',content:(task.role||'담당 업무')+' · '+changes.join(' · ')}]:[];
  });
  return logs.length?{...next,logs:[...(next.logs||[]),...logs]}:next;
 };}
 const api={sourceDetails,renderWorkflow,recordRelease,cards,toggle:withHistory(toggle),completion,render,move:withHistory(move),lanes,groups,progress,average,setProgress:withHistory(setProgress),setRevisionProgress:withHistory(setRevisionProgress),setRevisionRequired:withHistory(setRevisionRequired),canProgress,guardEdit,orderedTasks,weekGroups};
 if(typeof module!=='undefined')module.exports=api;else root.BoardTaskBoard=api;
})(typeof window!=='undefined'?window:globalThis);
