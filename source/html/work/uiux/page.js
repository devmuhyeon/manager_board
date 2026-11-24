(function(root){
 'use strict';
 const M=typeof module!=='undefined'?require('./model.js'):root.BoardUIUXModel;
 function rows(c){
  return c.relatedRows().map(p=>M.read(c.state.projects.find(x=>x.id===p.id)||p,c.C,c.BoardTaskBoard));
 }
 const data=(p,esc,more='')=>'data-id="'+esc(p.id)+'" '+more;
 function select(name,values,value,esc,attrs=''){return '<select name="'+name+'" '+attrs+'>'+values.map(v=>{const [key,label]=Array.isArray(v)?v:[v,v];return '<option value="'+esc(key)+'"'+(key===value?' selected':'')+'>'+esc(label)+'</option>';}).join('')+'</select>';}
 const statusOptions=[['진행중','진행중'],['all','전체 표시'],['완료','완료'],['개발반영','개발반영'],['운영반영완료','운영반영완료'],['보류','보류'],['반려','반려']];
 function badges(p,status,esc){const raw={...p.raw,...(p.raw?.처리결과||p.raw?.처리정보||{})},review=[raw.담당자검토완료,raw.담당자_검토완료,raw.검토완료,raw.검토상태,raw.담당자검토상태].some(v=>v===true||v===1||['true','Y','완료','담당자 검토 완료'].includes(v));return '<div class="ux-badges">'+(!p.raw?'<span class="ux-self">자체등록</span>':'')+'<span class="ux-status">'+esc(status)+'</span>'+p.requestedRoles.map(r=>'<span>'+r+'</span>').join('')+(p.workflow.etc?'<span class="ux-self">기타</span>':'')+(review?'<span>담당자 검토 완료</span>':'')+'</div>';}
 function links(p,esc){return '<div class="ux-links">'+p.links.filter(l=>M.safeUrl(l.url)).map((l,i)=>'<a href="'+esc(M.safeUrl(l.url))+'" target="_blank" rel="noopener">'+esc(l.name||'링크 '+(i+1))+'</a>').join('')+'</div>';}
 function card(p,t,c){
  const {esc,button,user,C}=c,status=p.status,visual=t&&M.done(t)&&status!=='운영반영완료'?'완료':status;
  const attrs=data(p,esc,t?'data-task-id="'+esc(t.id)+'" data-role="'+t.role+'"':''),own=!p.readOnlySample&&t?.assignees.includes(user.name);
  const deadline=M.date(p.requestedDue)||p.requestedDue;
  const person=(t?c.P.orderNames(c.state,t.assignees):[]).map(name=>'<span class="ux-worker">'+esc(name)+'</span>').join('');
  return '<article class="ux-card '+(visual==='운영반영완료'?'ux-released':visual==='완료'?'ux-completed':'')+'" data-card-id="'+esc(p.id)+'">'+badges(p,status,esc)
   +button('workflowDetail','<strong>'+esc(p.title)+'</strong>',t?'ux-title':'workflow-dashboard-row',attrs)
   +(t?'<p class="ux-dates">'+esc(p.requester||p.customer||'—')+' | 완료요청: ':'<p class="ux-customer">'+esc(p.requester||p.customer||'—')+' · '+esc(p.customer||'—')+'</p><p class="ux-dates">요청: '+esc(displayDate(p.requested))+' | 완료요청: ')+'<time class="'+(deadline&&deadline<C.today()&&visual!=='완료'&&visual!=='운영반영완료'?'ux-overdue':'')+'">'+esc(displayDate(p.requestedDue))+'</time></p>'
   +(t?links(p,esc)+'<div class="ux-card-bottom">'+button('uiuxToggle',M.done(t)?'수정':'완료','ux-complete',attrs+(own?'':' disabled'))+'<div class="ux-workers" title="'+esc(c.BoardTaskBoard.sourceAssignees(p,t.role,names=>c.P.orderNames(c.state,names)))+'">'+(person||'<span>미배정</span>')+'</div></div>':'')
   +releaseFooter(p,t,c,attrs)+'</article>';
 }
 function releaseFooter(p,t,c,attrs){
  const {esc,button,user}=c;if(t){const release=p.release.production||p.release.development;return release?'<a class="ux-release-link" target="_blank" rel="noopener" href="'+esc(M.safeUrl(release.url))+'">'+(p.release.production?'운영 반영':'개발 반영')+'</a>':'';}
  if(!p.readyToRelease||p.status==='운영반영완료')return '';
  return '<div class="ux-release-actions">'+['development','production'].map(stage=>button('uiuxRelease',stage==='development'?'개발 반영':'운영 반영','',attrs+' data-stage="'+stage+'"'+(!p.readOnlySample&&p.tasks.some(t=>t.assignees.includes(user.name))&&(stage==='development'||p.release.development)?'':' disabled'))).join('')+'</div>';
 }
 function render(c){
  const {esc,button,uiuxUi={},boardName,filters}=c,entries=rows(c).filter(p=>(!boardName||[p.title,...p.tasks.flatMap(t=>t.assignees)].some(s=>s.includes(boardName)))&&(!filters.from||p.requestedDue>=filters.from)&&(!filters.to||p.requestedDue<=filters.to));
  const panels=['dashboard',...M.roles].map(lane=>{
   const setting=uiuxUi[lane]||{},status=setting.status||'진행중',worker=setting.worker||'';
   const items=lane==='dashboard'?entries.filter(p=>M.match(p.status,status)).sort((a,b)=>Number(b.status==='운영반영완료')-Number(a.status==='운영반영완료')).map(p=>({p})):entries.flatMap(p=>p.tasks.filter(t=>t.role===lane&&t.assignees.length&&(!worker||t.assignees.includes(worker))&&M.match(p.release.production?'운영반영완료':p.release.development?'개발반영':t.status,status)).map(t=>({p,t})));
   const people=c.P.orderNames(c.state,[...new Set(entries.flatMap(p=>p.tasks.filter(t=>t.role===lane).flatMap(t=>t.assignees)))]);
   return '<section class="workflow-column ux-column"><header class="ux-column-head"><h3>'+({dashboard:'요청관리 대시보드'}[lane]||lane)+' <small>'+items.length+'</small></h3><div>'+select('status',statusOptions,status,esc,'data-uiux-filter="status" data-lane="'+lane+'" aria-label="'+lane+' 상태"')+(lane==='dashboard'?'':select('worker',[['','작업자 전체'],...people],worker,esc,'data-uiux-filter="worker" data-lane="'+lane+'" aria-label="'+lane+' 작업자"'))+'</div></header><div class="workflow-scroll ux-scroll">'+(items.map(({p,t})=>card(p,t,c)).join('')||'<p class="ux-empty">표시할 '+(lane==='dashboard'?'과업':'작업')+'이 없습니다.</p>')+'</div>'+(lane==='dashboard'?button('new','신규 등록','ux-new'):'')+'</section>';
  });
  return '<div class="workflow-board ux-board">'+panels.join('')+'</div>';
 }
 function scheduleControls(c){const {button,uiuxUi={}}=c;
  return '<div class="ux-schedule-tabs">'+button('uiuxSchedule','주간 일정',uiuxUi.period==='week'?'active':'','data-period="week" aria-pressed="'+(uiuxUi.period==='week')+'"')+button('uiuxSchedule','월간 일정',uiuxUi.period==='month'?'active':'','data-period="month" aria-pressed="'+(uiuxUi.period==='month')+'"')+'</div>';
 }
 function field(label,name,value,esc,type='text',extra=''){return '<label class="ux-field">'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(value||'')+'" '+extra+'></label>';}
 function textarea(label,name,value,esc){return '<label class="ux-field ux-full">'+label+'<textarea name="'+name+'" rows="3">'+esc(value||'')+'</textarea></label>';}
 function checks(label,name,values,chosen,esc){return '<fieldset class="ux-choice"><legend>'+label+'</legend>'+values.map(v=>'<label><input type="checkbox" name="'+name+'" value="'+esc(v)+'"'+(chosen.includes(v)?' checked':'')+'><span>'+esc(v)+'</span></label>').join('')+'</fieldset>';}
 function editor(original,c){
  if(original)return assignmentEditor(original,c);
  const {esc,button,user,C,P,state}=c,p=original?M.read(original,C,c.BoardTaskBoard):{title:'',workflow:{},tasks:[],requestedRoles:[],requested:C.today(),requestedDue:C.today(),requester:user.name,customer:''},w=p.workflow;
  const members=P.orderedMembers(state).filter(m=>m.active!==false),partTeams={기획:'기획',디자인:'디자인',퍼블:'퍼블'};
  return '<form id="uiuxProjectForm" class="ux-dialog" data-id="'+esc(original?.id||'')+'"><div class="modal-head"><h2>'+esc(original?'과업 정보 수정':'신규 등록')+'</h2>'+button('close','닫기')+'</div><div class="modal-body ux-form"><div class="ux-form-grid">'
   +checks('요청구분 *','roles',[...M.roles,'기타'],[...p.requestedRoles,...(w.etc?['기타']:[])],esc)+checks('사용대상 *','platforms',['PC','MO'],w.platforms||['PC','MO'],esc)
   +checks('적용서비스','services',['CM(MW)','WK','EI','HR','UA','EP','GS','FS'],w.services||[],esc)
   +'<label class="ux-field">요청팀 *'+select('customer',[...new Set([p.customer,...state.projects.map(x=>C.effective(x).customer),'고용24대민포털','고용24업무포털'].filter(Boolean))],p.customer,esc,'required')+'</select></label>'+field('요청자 *','requester',p.requester,esc,'text','required')
   +field('요청일 *','requested',p.requested,esc,'date','required')+field('완료요청일 *','requestedDue',p.requestedDue,esc,'date','required')+'<div class="ux-full">'+field('요청명 *','title',p.title,esc,'text','required maxlength="300"')+'</div>'
   +textarea('요청배경','background',p.background,esc)+textarea('요청사항','requirements',p.requirements,esc)
   +'<section class="ux-assignments ux-full"><h3>작업자 및 작업 내용</h3>'+M.roles.map(role=>{const t=p.tasks.find(t=>t.role===role);const names=[...new Set([...members.filter(m=>m.team===partTeams[role]).map(m=>m.name),...(t?.assignees||[])])];return '<details open><summary>'+role+'</summary>'+checks('작업자','assignees_'+role,names,t?.assignees||[],esc)+'<label class="ux-field">진행상태'+select('status_'+role,c.C.STATUSES,t?.status||'진행중',esc,t&&!t.assignees.includes(user.name)?'disabled':'')+'</label>'+textarea(role+' 작업 내용','notes_'+role,t?.notes||'',esc)+'</details>';}).join('')+'</section>'
   +field('산출물 결과 폴더','folder',p.folder,esc)+field('작성기 연동 링크 (전달용)','handoff',p.handoff,esc)
   +'<section class="ux-full"><h3>작업 링크</h3><div id="uiuxLinks">'+(p.links?.length?p.links:[{name:'',url:''}]).map(l=>linkRow(l,esc,button)).join('')+'</div>'+button('uiuxAddLink','링크 추가')+'</section>'
   +'<label class="ux-upload ux-full">첨부파일 · 이미지, 동영상, ZIP, 문서<input name="attachments" type="file" multiple><span>파일을 놓거나 클릭해서 선택 (파일당 20MB, 전체 40MB)</span></label>'+(typeof BoardAttachments!=='undefined'?BoardAttachments.render(w.attachments,esc):'')
   +'</div><p class="ux-error" id="uiuxError" role="alert"></p></div><div class="modal-foot">'+button('close','취소')+'<button class="primary" type="submit">'+(original?'저장':'등록')+'</button></div></form>';
 }
 function linkRow(l,esc,button){return '<div class="ux-link-row"><input name="linkName" aria-label="링크 이름" placeholder="링크 이름" value="'+esc(l.name||'')+'"><input name="linkUrl" aria-label="링크 주소" placeholder="https:// 또는 파일 경로" value="'+esc(l.url||'')+'">'+button('uiuxRemoveLink','삭제')+'</div>';}
 function assignmentEditor(original,c){
  const {esc,button,C,P,state,user}=c,p=M.read(original,C,c.BoardTaskBoard),w=p.workflow,all=[...M.roles,'기타'];
  const hidden=(name,value)=>'<input type="hidden" name="'+name+'" value="'+esc(value||'')+'">';
  const preserve=['title','requester','customer','requested','requestedDue','background','requirements','folder','handoff'].map(key=>hidden(key,p[key])).join('')+(w.platforms||['PC','MO']).map(v=>hidden('platforms',v)).join('')+(w.services||[]).map(v=>hidden('services',v)).join('')+p.links.map(l=>hidden('linkName',l.name)+hidden('linkUrl',l.url)).join('');
  return '<form id="uiuxProjectForm" class="ux-dialog ux-assignment-dialog" data-id="'+esc(p.id)+'">'+preserve+'<input type="file" name="attachments" hidden><div class="modal-head"><h2>'+esc(p.title)+'</h2>'+button('close','닫기')+'</div><div class="modal-body"><div class="ux-role-add"><span>상태: '+esc(p.requestedRoles.join(', '))+(w.etc?', 기타':'')+'</span><label>상태 추가: '+select('additionalRole',all,'기타',esc,'aria-label="추가할 상태"')+'</label>'+button('uiuxAddRole','추가')+'</div>'
   +all.map(role=>{const selected=role==='기타'?w.etc:p.requestedRoles.includes(role),t=p.tasks.find(t=>t.role===role),members=P.orderedMembers(state).filter(m=>m.active!==false&&m.team===role),names=[...new Set([...members.map(m=>m.name),...(t?.assignees||[])])];
    return '<section class="ux-assignment-part" data-uiux-assignment-part="'+role+'"'+(selected?'':' hidden')+'><input type="hidden" name="roles" value="'+role+'"'+(selected?'':' disabled')+'>'+(role==='기타'?'<p>기타</p>':'<div class="ux-assignment-head"><h3>'+role+'</h3><details class="ux-assignee-select"><summary><span data-uiux-assignee-label>'+esc(t?.assignees.join(', ')||'작업자')+'</span>'+c.Icons.arrow('down')+'</summary><div>'+checks('작업자','assignees_'+role,names,t?.assignees||[],esc)+'</div></details><label>상태 '+select('status_'+role,C.STATUSES,t?.status||'진행중',esc,t&&!t.assignees.includes(user.name)?'disabled':'')+'</label></div>'+textarea(role+' 작업 내용','notes_'+role,t?.notes||'',esc))+'</section>';
   }).join('')+'<p class="ux-error" id="uiuxError" role="alert"></p></div><div class="modal-foot"><button class="primary" type="submit">등록</button>'+button('close','닫기')+'</div></form>';
 }
 function startDates(p,c){const {esc,button,user}=c,own=p.tasks.some(t=>t.assignees.includes(user.name))&&!p.readOnlySample;return '<form class="ux-detail-dates" data-uiux-form="starts" data-id="'+esc(p.id)+'"><div class="ux-start-fields"><span>작업 시작일:</span>'+p.tasks.map(t=>'<label>'+t.role+'<input type="date" name="started_'+esc(t.id)+'" value="'+esc(t.started)+'"'+(!p.readOnlySample&&t.assignees.includes(user.name)?'':' disabled')+'></label>').join('')+'</div>'+button('uiuxSubmitStarts','수정','',own?'':'disabled')+'<div class="ux-completion-dates"><span>완료일:</span>'+p.tasks.map(t=>'<p>'+t.role+' <time>'+esc(t.completedOn||c.BoardTaskBoard.sourceDetails(p,t.role).end||'—')+'</time></p>').join('')+'</div></form>';}
 function detail(original,c){
  const {C,BoardTaskBoard:Board,esc,button,user,D,member,displayProfile}=c,p=M.read(original,C,Board),disabled=p.readOnlySample?' disabled':'';
  const events=(original.logs||[]).slice().sort((a,b)=>String(b.at||b.date).localeCompare(a.at||a.date));
  return '<div class="ux-dialog ux-detail-dialog"><div class="modal-head"><h2>'+esc(p.title)+'</h2>'+button('close','닫기')+'</div><div class="modal-body ux-detail-layout"><main>'+startDates(p,c)+'<p class="ux-request-meta">요청자: '+esc(p.requester||'—')+' / 요청팀: '+esc(p.customer||'—')+' / 요청구분: '+esc(p.requestedRoles.join(', '))+'<br>요청일자: '+esc(p.requested||'—')+' / 완료요청일자: '+esc(p.requestedDue||'—')+'</p>'
   +'<section class="ux-work-notes">'+p.tasks.map(t=>'<section><h4>'+t.role+'</h4><pre>'+esc(t.notes||'기재된 작업 내용이 없습니다.')+'</pre></section>').join('')+'</section>'
   +'<section class="ux-description"><h3>요청배경</h3><p>'+esc(p.background||'—')+'</p><h3>요청사항</h3><p>'+esc(p.requirements||'—')+'</p><h3>산출물 결과 폴더</h3><p>'+path(p.folder,esc)+'</p><h3>작성기 연동 링크 (전달용)</h3><p>'+path(p.handoff,esc)+'</p>'+links(p,esc)+(typeof BoardAttachments!=='undefined'?BoardAttachments.render(p.workflow.attachments,esc):'')+'</section>'
   +'<section class="ux-comments"><h3>댓글</h3><form data-uiux-form="comment" data-id="'+esc(p.id)+'"><span>'+esc(user.name)+'</span><input name="content" required maxlength="5000" placeholder="댓글을 작성해 주세요" aria-label="댓글 내용"'+disabled+'><button type="submit"'+disabled+'>입력</button></form>'+(p.workflow.comments||[]).map(item=>'<article><header><strong>'+esc(item.author)+'</strong> <time>'+esc(formatTime(item.at))+'</time>'+(item.author===user.name?button('uiuxEditComment','수정','',data(p,esc,'data-comment-id="'+esc(item.id)+'"'))+button('uiuxDeleteComment','삭제','',data(p,esc,'data-comment-id="'+esc(item.id)+'"')):'')+'</header><p>'+esc(item.content)+'</p></article>').join('')+'</section><section class="ux-timeline"><h3>타임라인</h3>'+events.map(e=>'<article><header>'+D.avatar(displayProfile(member(e.author)))+'<strong>'+esc(e.author)+'</strong><time>'+esc(formatTime(e.at||e.date))+'</time></header><p>'+esc(e.content)+'</p></article>').join('')+(original.raw?c.BoardProjectReport.sourceTimeline(original,esc,Board,c.state.members):'')+'</section></main></div><div class="modal-foot">'+button('close','닫기','primary')+'</div><p id="uiuxError" role="alert"></p></div>';
 }
 function path(value,esc){const url=M.safeUrl(value);return url?'<a target="_blank" rel="noopener" href="'+esc(url)+'">'+esc(value)+'</a>':esc(value||'—');}
 function formatTime(value){const date=new Date(value);return Number.isNaN(date.getTime())?value:date.toLocaleString('sv-SE',{timeZone:'Asia/Seoul'}).slice(2,16).replace(/-/g,'.');}
 function displayDate(value){return value?String(value).replace(/-/g,'.'):'—';}
 const api={M,rows,render,scheduleControls,editor,detail,linkRow};if(typeof module!=='undefined')module.exports=api;else root.BoardUIUX=api;
})(typeof window!=='undefined'?window:globalThis);
