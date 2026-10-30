/* Local, offline dashboard. Source handles are read-only; the only writable filename is BOARD_FILE. */
(() => {
  'use strict';
  const N=BoardNavigation,B=BoardTeamPosts;
  const C=BoardCore, P=BoardPeople, W=BoardWorkspace, V=BoardVault, $=s=>document.querySelector(s), BOARD_FILE='통합관리 대시보드.json', CACHE='manager-board-v1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state,cacheError='';
  const emptyState=()=>({...C.sampleState(),projects:[],demo:false});
  try{const raw=localStorage.getItem(CACHE);state=raw?C.validateState(JSON.parse(raw)):emptyState();}catch(e){state=emptyState();cacheError='저장된 임시 데이터를 읽지 못했습니다. 원래 임시 데이터는 덮어쓰지 않습니다. JSON 백업을 불러와 주세요.';}
  let user=null,demoSession=false,page='dashboard',scope='all',customerMode='team',view='category',sourceHandle=null,targetHandle=null,diskText=null,dirty=false,saving=false;
  try{dirty=localStorage.getItem(CACHE+'-dirty')==='true';}catch{}
  let filters={search:'',status:'',teamFilter:'',customer:'',requester:'',dateField:'due',from:'',to:''};
  let selectedTeam='퍼블',editing=null,taskDraft=[];
  let boardTeam='',userWork='';
  let leaveYear=C.today().slice(0,4),leaveOwner='';
  let sourceDir=null,targetDir=null,pendingSource=null,pendingTeams=null,setupDone=false,deferredConnection=false,health={source:false,target:false},dialogOpener=null;
  P.upgrade(state);C.setMembers(P.orderedMembers(state));
  if(state.demo){state.projects=state.projects.filter(p=>p.source!=='sample');state.demo=false;}
  const styles=BoardDisplayStyles.create({storage:localStorage,element:document.documentElement});
  window.addEventListener('storage',e=>{if(e.key===BoardDisplayStyles.KEY||e.key==='workplace-theme'||e.key===null){styles.restore();render();}});
  const member=n=>state.members.find(m=>m.name===n);
  const options=(arr,value,empty)=>`${empty!==undefined?`<option value="">${esc(empty)}</option>`:''}${arr.map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(N.teamLabel(v))}</option>`).join('')}`;
  const button=(action,label,cls='',extra='')=>{
    if(action==='save'){
      label='<span class="tossface button-icon" aria-hidden="true">💾</span><span>내용 저장</span>';
      extra+=' aria-label="내용 저장'+(dirty?' · 저장 전 변경사항 있음':'')+'" title="'+(dirty?'저장 전 변경사항 있음':'내용 저장')+'"';
    }else if(action==='preferences')label='<span class="tossface button-icon" aria-hidden="true">⚙️</span><span>설정</span>';
    return '<button type="button" data-action="'+action+'" class="'+cls+'" '+extra+'>'+label+'</button>';
  };
  const D=BoardDetailViews.create({C,P,W,B,N,esc,button,options,member,weekBlocks});
  function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',4500);}
  function persist(){if(cacheError){toast(cacheError);return false;}try{localStorage.setItem(CACHE,JSON.stringify(state));localStorage.setItem(CACHE+'-dirty',String(dirty));return true;}catch(e){toast('브라우저 임시 저장에 실패했습니다. JSON 백업으로 보관해 주세요.');return false;}}
  function changed(){dirty=true;persist();}
  function f(){return {...filters,scope,user:user?.name,team:selectedTeam,taskMode:page!=='report'&&view==='sheet'};}
  function projects(){return C.filterProjects(state.projects,f());}
  function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const badge=s=>`<span class="badge ${esc(s)}">${esc(s)}</span>`;
  const T=BoardWorkTables.create({C,N,esc,button,badge,orderNames:names=>P.orderNames(state,names)});
  const sourceLabel=p=>p.source==='sample'?'예시 데이터':p.source==='import'?'요청관리에서 가져옴':'직접 등록';
  async function passwordHash(password,salt){
    if(!crypto.subtle)throw new Error('비밀번호 설정은 Edge/Chrome의 로컬 파일 또는 localhost에서 실행해 주세요.');
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/../g).map(x=>parseInt(x,16))),iterations:150000,hash:'SHA-256'},key,256);
    return Array.from(new Uint8Array(bits),x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function signIn(form){
    const data=new FormData(form),name=data.get('name'),password=data.get('password');$('#loginSubmit').disabled=true;
    try{
      if(!setupDone||(!deferredConnection&&!await checkConnections()))throw new Error('폴더 연결을 확인한 뒤 로그인해 주세요.');
      if(!member(name)||member(name).active===false)throw new Error('재직 중인 이름을 선택해 주세요.');
      if(!deferredConnection&&targetHandle&&health.target&&diskText!==null){const current=await (await targetHandle.getFile()).text();if(current!==diskText)throw new Error('공용 파일이 변경됐습니다. 통합관리 폴더를 다시 연결해 주세요.');}
      const account=state.accounts[name];
      if(account){if(await passwordHash(password,account.salt)!==account.hash)throw new Error('비밀번호가 맞지 않습니다.');}
      else{if(password.length<6)throw new Error('비밀번호는 6자 이상으로 설정해 주세요.');if(password!==data.get('confirm'))throw new Error('비밀번호 확인이 일치하지 않습니다.');
        const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');state.accounts[name]={salt,hash:await passwordHash(password,salt),iterations:150000};changed();
        if(!deferredConnection&&targetHandle&&health.target){try{await saveDisk();}catch(e){delete state.accounts[name];persist();throw e;}}
      }
      user=member(name);demoSession=false;selectedTeam=user.team;scope='all';
      try{if(data.get('remember'))await V.remember({name,team:user.team,password});else await V.forget();}catch{toast('이 브라우저에서 로그인 정보를 기억하지 못했습니다. 로그인은 계속 진행합니다.');}
      render();
    }catch(e){$('#loginError').textContent=e.message;$('#loginSubmit').disabled=false;}
  }
  function render(){
    syncRoster();if(!user){login();return;}user=member(user.name)||user;
    if(page==='people'&&!W.canPersonnel(state,user.name))page='dashboard';
    const titles=N.titles;
    const nav=N.groups;
    if(!B.canRead(state,user.name,boardTeam))boardTeam=user.team;
    let body=page==='dashboard'?dashboard():page==='work'||page==='customers'?dashboardContent():page==='users'?userWorkPage():page==='board'?D.board(state,user,boardTeam):page==='today'?D.today(state,user):page==='report'?report():page==='settings'?settings():page==='people'?peoplePage():page==='memo'?personalPanel():page==='schedule'?'<div class="home-panels">'+schedulePanel().thisWeek+schedulePanel().nextWeek+'</div>':page==='deadlines'?deadlinePage():page==='leaves'?vacationPage():revisionPage();
    $('#app').innerHTML=BoardDisplayStyles.shell('<div class="shell"><aside class="sidebar">'+brand()+'<div class="subbrand">WORK24 × PLACECND</div><nav class="nav" aria-label="주 메뉴">'+nav.map(g=>(g.label?'<div class="nav-group">'+g.label+'</div>':'')+g.items.filter(([key])=>key!=='people'||W.canPersonnel(state,user.name)).map(([key,icon,title])=>button('page','<span class="tossface" aria-hidden="true">'+icon+'</span>'+title,page===key?'active':'','data-page="'+key+'" aria-label="'+esc(title)+'" title="'+esc(title)+'" '+(page===key?'aria-current="page"':''))).join('')).join('')+'</nav><div class="sidebar-bottom"><div class="user">'+D.avatar(user)+'<div><strong>'+esc(user.name)+'</strong> <span class="muted">'+esc(user.rank||'직급 미지정')+'</span><div class="muted">'+esc(N.teamLabel(user.team))+' 팀</div></div>'+button('logout','로그아웃')+'</div></div></aside><main class="main"><header class="topbar">'+connectionBar()+'<div class="breadcrumb">워크 플레이스 / <strong>'+titles[page]+'</strong></div><div class="topright"><span class="muted">'+new Date().toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short'})+'</span>'+button('refreshAll','↻ 새로고침')+button('save','내용 저장','primary',saving?'disabled':'')+button('preferences','⚙ 설정')+'</div></header><div class="content"><div class="heading"><h1 tabindex="-1">'+titles[page]+'</h1><div class="actions">'+(['work','customers','report','revisions'].includes(page)?button('export','↓ 엑셀 내보내기')+button('new','＋ 새 과업 등록','primary'):'')+'</div></div>'+body+'</div></main></div>',styles.current());
    BoardMemoCarousel.init(document);
  }
  function scopeTabs(){const tabs=[['all','전체'],['team','팀'],['personal','개인']];return `<div class="tabs" role="group" aria-label="조회 범위">${tabs.map(([s,n])=>button('scope',n,scope===s?'active':'',`data-scope="${s}" aria-pressed="${scope===s}"`)).join('')}${scope==='team'?`<select aria-label="조회 팀" data-filter="selectedTeam">${options(C.TEAMS,selectedTeam)}</select>`:''}</div>`;}
  function filterBar(isReport=false){return `<div class="filters"><input class="search" type="search" placeholder="과업명, 담당자, 고객 검색" aria-label="업무 검색" data-filter="search" value="${esc(filters.search)}"><select aria-label="진행상태" data-filter="status">${options(C.STATUSES,filters.status,'전체 상태')}</select><select aria-label="담당팀" data-filter="teamFilter">${options(C.TEAMS,filters.teamFilter,'전체 담당팀')}</select><div class="date-filter">${isReport?'<span>작업일</span>':`<select aria-label="기간 기준" data-filter="dateField">${[['due','마감일'],['requestedDue','요청완료일'],['requested','요청일']].map(([v,t])=>`<option value="${v}" ${filters.dateField===v?'selected':''}>${t}</option>`).join('')}</select>`}<input type="date" aria-label="시작 날짜" data-filter="from" value="${filters.from}"><span>–</span><input type="date" aria-label="종료 날짜" data-filter="to" value="${filters.to}">${button('week','이번 주')}${button('clearFilters','초기화')}</div></div>`;}
  function dashboard(){
    const sections=schedulePanel(),memoItems=(state.personal[user.name]||[]),rows=state.projects.map(C.effective),revisionRows=rows.filter(p=>p.parentProjectId);
    const panels={...sections,memo:'<section class="card"><div class="sectionhead"><h2>메모 & 일정</h2>'+button('newMemo','＋ 메모 추가')+'</div>'+BoardMemoCarousel.render('home-memos',memoItems.map(i=>'<article class="agenda-item">'+button('editMemo',esc(i.title),'project-button','data-id="'+esc(i.id)+'"')+'<small>'+esc(i.date||'날짜 없는 메모')+'</small></article>').join(''),'<div class="agenda-list">'+D.illustratedHint(user.avatar,'기억할 일을 메모해 보세요','날짜를 넣으면 일정에서도 확인할 수 있어요.')+'</div>')+'</section>',work:'<section class="card"><div class="sectionhead"><h2>업무 현황</h2></div><div class="overview-counts"><span>전체 <strong>'+rows.length+'</strong></span><span>미완료 <strong>'+rows.filter(p=>p.status!=='완료').length+'</strong></span><span>수정작업 <strong>'+revisionRows.length+'</strong></span></div>'+button('page','수정작업 모아보기','','data-page="revisions"')+'</section>'};
    const destinations={memo:'memo',thisWeek:'schedule',nextWeek:'schedule',deadlines:'deadlines',leaves:'leaves',work:'work'};
    function homePanel(key){
      const detail=button('page','상세 보기 →','home-detail-button','data-page="'+destinations[key]+'"');
      return panels[key].replace(/(<div class="sectionhead">)([\s\S]*?)(<\/div>)(?=<div class="(?:agenda-list|overview-counts|memo-carousel)")/,(_,start,content,end)=>{
        const actions=[];const heading=content.replace(/<button[\s\S]*?<\/button>/g,action=>{actions.push(action);return '';});
        return start+'<div class="home-panel-heading">'+heading+'</div><div class="home-panel-actions">'+(key==='memo'?BoardMemoCarousel.controls('home-memos',memoItems.length):'')+actions.join('')+detail+'</div>'+end;
      });
    }
    return '<div class="home-layout-tools"><span class="muted">나의 일정 한눈에 보기</span>'+button('homeLayout','홈 배치 순서 설정')+'</div><div class="home-panels">'+BoardDisplayStyles.home({style:styles.current(),state,user,C,B,N,esc,button,badge,hint:D.illustratedHint,table:projectTable,orderNames:names=>P.orderNames(state,names)})+P.homeOrder(state,user.name).map(key=>'<div class="home-panel '+(['memo','work'].includes(key)?'home-wide':'')+'" data-home-section="'+key+'" data-home-target="'+destinations[key]+'">'+homePanel(key)+'</div>').join('')+'</div>';
  }
  function viewTabs(){return '<div class="tabs" role="group" aria-label="표 배치">'+button('view','분류별',view==='category'?'active':'','data-view="category"')+button('view','과업별',view==='project'?'active':'','data-view="project"')+'</div>';}
  function categorizedTable(rows){return W.group(rows).map(([label,group])=>'<section class="category-group"><h3>'+esc(label.replace(/^퍼블(?= >|$)/,'퍼블리싱'))+' <span class="count">'+group.length+'</span></h3>'+sheetTable(group)+'</section>').join('')||'<p class="empty">조회 조건에 맞는 과업이 없습니다.</p>';}
  function dashboardContent(){const rows=projects();return (page==='customers'?customerCards():'')+'<section class="card"><div class="table-toolbar"><h2>업무 목록 <span class="count">'+rows.length+'</span></h2>'+scopeTabs()+viewTabs()+'</div>'+filterBar()+(view==='category'?categorizedTable(rows):projectTable(rows))+'</section>';}
  
  function projectTable(rows){return T.projects(rows);}
  function taskRows(rows){const tf=f();if(!tf.taskMode){tf.status='';tf.from='';tf.to='';}return rows.flatMap(p=>(p.tasks?.length?p.tasks:[{role:'기타',assignees:p.assignees,started:p.started,due:p.due,status:p.status,notes:p.description}]).filter(t=>C.matchesTask(t,tf)).map(t=>({p,t})));}
  function sheetTable(rows){return T.tasks(taskRows(rows));}
  function customerCards(){
    const all=state.projects.map(C.effective),key=customerMode==='team'?'customer':'requester';
    const values=[...new Set(all.map(p=>p[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
    return `<div class="heading"><div class="tabs">${button('customerMode','고객 팀별',customerMode==='team'?'active':'','data-mode="team"')}${button('customerMode','고객 이름별',customerMode==='name'?'active':'','data-mode="name"')}${button('allCustomers','전체 고객')}</div></div><div class="customer-grid">${values.map(v=>{const rows=all.filter(p=>p[key]===v);return button('customer',`<strong>${esc(v)}</strong><p>전체 ${rows.length}건 &nbsp;·&nbsp; 미완료 ${rows.filter(p=>p.status!=='완료').length}건</p>`,`card customer-card ${filters[key]===v?'active':''}`,`data-value="${esc(v)}"`);}).join('')||'<p class="muted">등록된 고객이 없습니다.</p>'}</div>`;
  }
  function report(){const logs=C.reportRows(state.projects,f()).sort((a,b)=>b.date.localeCompare(a.date));const groups=W.group(logs,l=>view==='category'?W.classificationKey(l.project):l.project.title);return '<section class="card"><div class="report-intro"><h2>작업 내역 모아보기 <span class="count">'+logs.length+'건</span></h2>'+scopeTabs()+viewTabs()+'</div>'+filterBar(true)+groups.map(([label,items])=>'<div class="category-group"><h3>'+esc(label)+'</h3><div class="table-wrap"><table><caption class="sr-only">'+esc(label)+' 작업 내역</caption><thead><tr><th>작업일</th><th>과업명</th><th>작업자</th><th>담당팀</th><th>작업 내용</th></tr></thead><tbody>'+items.map(l=>'<tr><td>'+esc(l.date)+'</td><td>'+button('edit',esc(l.project.title),'project-button','data-id="'+esc(l.project.id)+'"')+'</td><td>'+esc(l.author)+'</td><td>'+esc(N.teamLabel(member(l.author)?.team||''))+'</td><td class="notes-cell">'+esc(l.content)+'</td></tr>').join('')+'</tbody></table></div></div>').join('')+(logs.length?'':'<p class="empty">선택 기간의 기록이 없습니다.</p>')+'</section>';}
  
  function settings(){return `<div class="settings-grid"><section class="card settings-card"><h2>원본과 저장 폴더</h2><p>원본 기준 폴더는 Z:\\고용24 디자인파트 요청관리\\디자인파트요청관리\\입니다. 요청관리 JSON의 정확한 위치는 직접 선택합니다. 원본의 프로젝트 자료와 팀관리 JSON도 변경하지 않습니다.</p>${connectionCards()}<div class="actions">${button('refreshAll','최신 자료 새로고침')}${button('reload','저장된 통합관리 파일 다시 읽기')}</div><p>최근 가져오기: ${state.importedAt?new Date(state.importedAt).toLocaleString('ko-KR'):'아직 없음'}</p></section><section class="card settings-card"><h2>저장 및 백업</h2><p>과업·인원·메모 변경사항은 현재 브라우저에 임시 저장됩니다. 내용 저장을 누르면 선택한 Y 폴더의 <strong>${BOARD_FILE}</strong>에만 반영합니다.</p><div class="actions">${button('save','내용 저장','primary')}${button('backup','통합관리 JSON 내려받기')}${button('restore','통합관리 JSON 복원')}</div><p>다른 사용자가 파일을 변경한 경우 덮어쓰기를 중단합니다. 여러 사람이 동시에 쓰는 순간까지 잠그는 기능은 없으므로 작업 전 새로고침 후 저장하세요.</p></section></div>`;}
  function classificationFields(project){const c=C.classification(project),content=c.taskCategory==='콘텐츠',lists=W.contentOptions(state);return '<fieldset class="full classification-fields"><legend>과업 분류</legend><div class="classification-grid"><div class="field"><label for="p-taskCategory">분류 1</label><select id="p-taskCategory" name="taskCategory" required>'+options(['UX','UI','기획','디자인','퍼블','콘텐츠'],c.taskCategory,'선택하세요')+'</select></div><div class="field" id="contentCategoryField" '+(content?'':'hidden')+'><label for="p-contentCategory">분류 2</label><input id="p-contentCategory" name="contentCategory" list="contentCategories" maxlength="100" value="'+esc(c.contentCategory)+'" '+(content?'required':'disabled')+' placeholder="예: 10월 뉴스레터"><datalist id="contentCategories">'+options(lists.level2,c.contentCategory)+'</datalist></div><div class="field" id="platformField" '+(content?'hidden':'')+'><label for="p-platform">분류 2</label><select id="p-platform" name="platform" '+(content?'disabled':'required')+'>'+options(['PC&MO','PC','MO'],c.platform,'선택하세요')+'</select></div><div class="field" id="contentTypeField" '+(content?'':'hidden')+'><label for="p-contentType">분류 3</label><select id="p-contentType" name="contentType" '+(content?'required':'disabled')+'>'+options([...new Set([...lists.level3,...(c.contentType?[c.contentType]:[])])],c.contentType,'선택하세요')+'</select></div></div><p class="muted">콘텐츠: 월별 주제 → 콘텐츠 유형 · 그 외: PC&MO / PC / MO</p></fieldset>';}
  
  function openEditor(id,parentId){
    dialogOpener=document.activeElement;
    const original=state.projects.find(p=>p.id===id);editing=original?C.effective(original):{id:C.uid(),source:'manual',title:'',customer:'',requester:'',category1:'',category2:'',requested:C.today(),requestedDue:'',description:'',link:'',logs:[],tasks:[]};
    if(parentId)editing=W.revisionDraft(state,parentId,user.name);
    taskDraft=structuredClone(editing.tasks?.length?editing.tasks:[{id:C.uid(),role:member(user.name)?.team==='콘텐츠'?'디자인':user.team,assignees:editing.assignees?.length?editing.assignees:[user.name],started:C.today(),due:editing.due||'',status:editing.status||'예정',notes:''}]);
    const field=(name,label,type='text')=>`<div class="field"><label for="p-${name}">${label}</label><input id="p-${name}" name="${name}" type="${type}" value="${esc(editing[name])}" ${name==='title'?'required maxlength="300"':''}></div>`;
    $('#editor').innerHTML=`<div class="modal-head"><div><h2>${original?'과업 상세 및 수정':'새 과업 등록'}</h2><div class="muted" style="margin-top:7px">${sourceLabel(editing)} · ${original?'변경 내용은 통합관리 데이터에 저장됩니다':'담당 업무를 기획·디자인·퍼블리싱별로 추가하세요'}</div></div>${button('close','✕','','aria-label="닫기"')}</div><form id="projectForm"><div class="modal-body"><div class="form-grid"><div class="full">${field('title','과업명')}</div>${classificationFields(editing)}<div class="field"><label for="p-customer">고객팀</label><input id="p-customer" name="customer" list="customerOptions" value="${esc(editing.customer)}"><datalist id="customerOptions">${options(C.CUSTOMERS,'')}</datalist></div>${field('requester','고객명 / 요청자')}${field('requested','요청일','date')}${field('requestedDue','요청완료일','date')}<div class="field full"><label for="p-description">과업 설명 / 요청사항</label><textarea id="p-description" name="description">${esc(editing.description)}</textarea></div><div class="full">${field('link','작업 링크')}</div></div><div class="sectionhead task-heading"><h2>담당 업무</h2>${button('addTask','＋ 담당 업무 추가')}</div><div id="taskList">${taskForms()}</div><div class="logs"><h2>날짜별 작업 내역 <span class="count">${editing.logs.length}</span></h2><div>${editing.logs.map(l=>`<div class="log"><small>${esc(l.date)} · ${esc(l.author)}</small><div style="white-space:pre-wrap">${esc(l.content)}</div></div>`).join('')||'<p class="muted">기록된 내역이 없습니다.</p>'}</div><div class="form-grid" style="margin-top:20px"><div class="field"><label for="logDate">작업일</label><input id="logDate" type="date" name="logDate" value="${C.today()}"></div><div class="field"><label>작업자</label><input aria-label="작업자" value="${user.name}" readonly></div><div class="field full"><label for="logContent">새 작업 내역 (저장 시 추가)</label><textarea id="logContent" name="logContent" placeholder="오늘 진행한 내용을 기록하세요. 주간 업무보고에 반영됩니다."></textarea></div></div></div><div class="error" id="projectError" role="alert"></div></div><div class="modal-foot">${button('close','취소')}<button class="primary" type="submit">과업 저장</button></div></form>`;
    $('#customerOptions').innerHTML=options(state.customerTeams,'');
    $('#editor .modal-body').insertAdjacentHTML('beforeend',revisionLinks(editing));
    $('#editor').showModal();
  }
  function taskForms(){return taskDraft.map((t,i)=>`<div class="task-form" data-task-index="${i}"><div class="task-top"><strong>담당 업무 ${i+1}</strong>${taskDraft.length>1?button('removeTask','삭제','','data-index="'+i+'"'):''}</div><div class="form-grid"><div class="field"><label for="task-role-${i}">세부유형</label><select id="task-role-${i}" data-task-field="role">${options(['기획','디자인','퍼블','기타'],t.role)}</select></div><div class="field"><label for="task-status-${i}">진행상태</label><select id="task-status-${i}" data-task-field="status">${options(C.STATUSES,t.status)}</select></div><div class="field full"><label>담당자 (여러 명 선택 가능)</label><div class="assignees">${P.orderedMembers(state).filter(m=>m.active!==false||t.assignees.includes(m.name)).map(m=>`<label class="check"><input type="checkbox" data-task-member="${esc(m.name)}" ${t.assignees.includes(m.name)?'checked':''}>${esc(m.name)}<span class="muted">${esc(N.teamLabel(m.team))}${m.active===false?' · 퇴사':''}</span></label>`).join('')}</div></div><div class="field"><label for="task-start-${i}">시작일</label><input id="task-start-${i}" type="date" data-task-field="started" value="${esc(t.started)}"></div><div class="field"><label for="task-due-${i}">마감일</label><input id="task-due-${i}" type="date" data-task-field="due" value="${esc(t.due)}"></div><div class="field full"><label for="task-notes-${i}">비고 / 진행 메모</label><textarea id="task-notes-${i}" data-task-field="notes" placeholder="기존 시트의 비고처럼 자유롭게 작성하세요.">${esc(t.notes)}</textarea></div></div></div>`).join('');}
  function collectTasks(){document.querySelectorAll('[data-task-index]').forEach(el=>{const t=taskDraft[Number(el.dataset.taskIndex)];el.querySelectorAll('[data-task-field]').forEach(input=>t[input.dataset.taskField]=input.value);t.assignees=[...el.querySelectorAll('[data-task-member]:checked')].map(x=>x.dataset.taskMember);});}
  function saveProject(form){
    collectTasks();const data=new FormData(form),values=Object.fromEntries(['title','taskCategory','contentCategory','contentType','platform','customer','requester','requested','requestedDue','description','link'].map(k=>[k,String(data.get(k)||'').trim()]));
    try{
      if(!values.title)throw new Error('과업명을 입력해 주세요.');
      Object.assign(values,C.cleanClassification(values));
      if(taskDraft.some(t=>!t.assignees.length))throw new Error('각 담당 업무에 담당자를 한 명 이상 선택해 주세요.');
      if(taskDraft.some(t=>t.started&&t.due&&t.started>t.due))throw new Error('마감일은 시작일보다 빠를 수 없습니다.');
      if(data.get('logContent').trim()&&!data.get('logDate'))throw new Error('작업 내역의 작업일을 입력해 주세요.');
      if(values.link && !/^(https?:\/\/|file:\/\/)/i.test(values.link))throw new Error('작업 링크는 http://, https:// 또는 file://로 입력해 주세요.');
      values.tasks=structuredClone(taskDraft);values.assignees=[...new Set(taskDraft.flatMap(t=>t.assignees))];values.status=C.effective({...editing,...values,overrides:{}}).status;
      const i=state.projects.findIndex(p=>p.id===editing.id),logs=structuredClone(editing.logs);
      if(data.get('logContent').trim())logs.push({id:C.uid(),date:data.get('logDate'),author:user.name,content:data.get('logContent').trim()});
      if(i<0)state.projects.push({...editing,...values,logs,updatedAt:new Date().toISOString()});
      else if(state.projects[i].source==='import'){const overrides={...(state.projects[i].overrides||{})};for(const [k,v] of Object.entries(values))if(JSON.stringify(v)!==JSON.stringify(editing[k]))overrides[k]=v;state.projects[i]={...state.projects[i],overrides,logs,updatedAt:new Date().toISOString()};}
      else state.projects[i]={...state.projects[i],...values,logs,updatedAt:new Date().toISOString()};
      changed();$('#editor').close();render();toast('과업을 임시 저장했습니다. 공용 파일에 반영하려면 변경사항 저장을 눌러 주세요.');
    }catch(e){$('#projectError').textContent=e.message;}
  }
  async function saveDisk(){
    if(saving)throw new Error('저장 중입니다. 잠시 기다려 주세요.');
    if(!targetHandle)throw new Error('먼저 통합관리 폴더를 연결해 주세요.');
    if(demoSession)throw new Error('예시 둘러보기에서는 공용 파일에 저장할 수 없습니다. 본인 이름으로 로그인해 주세요.');
    saving=true;
    try{
      const current=await (await targetHandle.getFile()).text();
      if(current!==diskText)throw new Error('다른 사용자가 파일을 변경했습니다. 덮어쓰지 않았습니다. 현재 내용을 JSON 백업한 후 저장된 파일을 다시 읽어 주세요.');
      const next={...state,revision:state.revision+1,savedAt:new Date().toISOString(),savedBy:user?.name||'계정 설정'};const serialized=JSON.stringify(next,null,2);
      const stream=await targetHandle.createWritable();try{await stream.write(serialized);await stream.close();}catch(e){try{await stream.abort();}catch{}throw e;}
      state=next;diskText=serialized;dirty=false;persist();await rememberFolders();
    }finally{saving=false;}
  }
  async function reload(){if(!targetHandle)return;if(dirty&&!confirm('임시 변경사항을 버리고 저장된 파일을 다시 읽으시겠습니까?'))return;const raw=await (await targetHandle.getFile()).text();const loaded=C.validateState(JSON.parse(raw));state=P.upgrade(loaded);syncRoster();diskText=raw;dirty=false;user=null;demoSession=false;persist();render();toast('공용 자료를 다시 읽었습니다. 로그인해 주세요.');}
  async function importData(raw){
    if(demoSession)throw new Error('실제 자료를 불러오려면 로그아웃 후 본인 이름으로 로그인해 주세요.');
    const result=C.importRows(state,JSON.parse(raw));state=P.enforceRemovals(result.state);syncRoster();changed();render();toast(`원본에서 ${result.added}건 추가, ${result.updated}건 갱신했습니다. 통합관리 수정 내용은 유지했습니다.`);
  }
  function pickFile(mode){const picker=$('#jsonPicker');picker.value='';picker.dataset.mode=mode;picker.click();}
  async function exportXlsx(){
    const ps=page==='report'?C.filterProjects(state.projects,{...f(),from:'',to:''}):page==='revisions'?projects().filter(p=>p.parentProjectId):projects();
    const logs=C.reportRows(state.projects,f());const ids=new Set(logs.map(l=>l.project.id));
    const rows=taskRows(page==='report'?ps.filter(p=>ids.has(p.id)):ps).sort((a,b)=>(view==='category'?W.classificationKey(a.p):a.p.title).localeCompare(view==='category'?W.classificationKey(b.p):b.p.title,'ko'));
    const sheets=[{name:'업무 목록',headers:['분류 1','분류 2','분류 3','과업명','세부유형','담당자','고객명','요청완료일','시작일','마감일','진행상태','비고','고객팀','요청일','담당팀','작업 링크'],widths:[18,20,14,50,14,24,18,16,16,16,14,75,23,16,18,45],rows:rows.map(({p,t})=>[N.teamLabel(C.classification(p).level1),C.classification(p).level2,C.classification(p).level3,p.title,N.teamLabel(t.role),t.assignees.join(', '),p.requester,p.requestedDue,t.started,t.due,t.status,t.notes,p.customer,p.requested,[...new Set(t.assignees.map(n=>N.teamLabel(member(n)?.team)).filter(Boolean))].join(', '),p.link])},{name:'날짜별 작업 내역',headers:['작업일','과업명','작업자','담당팀','작업 내용','고객팀','고객명'],widths:[16,50,16,16,75,23,18],rows:logs.filter(l=>page==='report'||ps.some(p=>p.id===l.project.id)).map(l=>[l.date,l.project.title,l.author,N.teamLabel(member(l.author)?.team),l.content,l.project.customer,l.project.requester])}];
    download(BoardXlsx.workbook(sheets),`통합관리_${page==='report'?'주간업무':'업무목록'}_${C.today()}.xlsx`);toast(`엑셀을 내보냈습니다. 담당 업무 ${rows.length}개`);
  }
  async function act(el){
    if(el.dataset.action==='memoSlide'){BoardMemoCarousel.move(el);return;}
    const a=el.dataset.action;
    if(a==='newRevision'){openEditor(null,el.dataset.id);return;}
    if(a==='contentOptions'){if(!W.canContent(state,user.name))throw new Error('콘텐츠 분류 관리 권한이 없습니다.');contentOptionsDialog();return;}
    if(a==='removeContentOption'){state=W.editOption(state,user.name,el.dataset.level,el.dataset.value,true);changed();contentOptionsDialog();return;}
    if(a==='homeLayout'){layoutDraft=P.homeOrder(state,user.name);homeLayout();return;}
    if(a==='layoutMove'){const index=layoutDraft.indexOf(el.dataset.key),next=index+Number(el.dataset.direction);if(index>=0&&next>=0&&next<layoutDraft.length){[layoutDraft[index],layoutDraft[next]]=[layoutDraft[next],layoutDraft[index]];homeLayout();}return;}
    if(a==='layoutReset'){layoutDraft=P.homeOrder({},user.name);homeLayout();return;}
    if(a==='layoutSave'){state=P.saveHomeOrder(state,user.name,layoutDraft);changed();$('#editor').close();render();toast('나의 홈 배치 순서를 저장했습니다. 공용 파일 반영은 내용 저장을 눌러 주세요.');return;}
    if(['manageMembers','addMember','rehire','removeMember','leaderSettings','passwords','resetPassword'].includes(a)&&!P.canManage(state,user?.name))throw new Error('전체관리자와 팀관리자만 사용할 수 있습니다.');
    if(['adminSettings','transferAdmin','editQuickLinks'].includes(a)&&!P.isOverallAdmin(state,user?.name))throw new Error('전체관리자만 사용할 수 있습니다.');
    if(a==='page'){if($('#editor').open)$('#editor').close();if(el.dataset.page==='people'&&!W.canPersonnel(state,user.name))throw new Error('인원관리 권한이 없습니다.');page=el.dataset.page;view='category';scope='all';filters.customer='';filters.requester='';if(page==='report'){scope='all';if(!filters.from&&!filters.to)setWeek();}render();}
    else if(a==='scope'){scope=el.dataset.scope;render();}
    else if(a==='view'){view=el.dataset.view;render();}
    else if(a==='customerMode'){customerMode=el.dataset.mode;filters.customer='';filters.requester='';render();}
    else if(a==='customer'){filters[customerMode==='team'?'customer':'requester']=el.dataset.value;render();}
    else if(a==='allCustomers'){filters.customer='';filters.requester='';render();}
    else if(a==='logout'){user=null;demoSession=false;render();}
    else if(a==='new')openEditor();
    else if(a==='edit')openEditor(el.dataset.id);
    else if(a==='close')$('#editor').close();
    else if(a==='addTask'){collectTasks();taskDraft.push({id:C.uid(),role:'디자인',assignees:[],status:'예정',started:'',due:'',notes:''});$('#taskList').innerHTML=taskForms();}
    else if(a==='removeTask'){collectTasks();taskDraft.splice(Number(el.dataset.index),1);$('#taskList').innerHTML=taskForms();}
    else if(a==='week'){setWeek();render();}
    else if(a==='sortWork'){T.toggleSort(el.dataset.sortKey);render();document.querySelector('[data-sort-key="'+el.dataset.sortKey+'"]')?.focus?.();}
    else if(a==='clearFilters'){filters={search:'',status:'',teamFilter:'',customer:'',requester:'',dateField:'due',from:'',to:''};render();}
    else if(a==='export')await exportXlsx();
    else if(a==='connect')await connect();
    else if(a==='reload')await reload();
    else if(a==='backup')download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),BOARD_FILE);
    else if(a==='save'){if(!targetHandle){if(persist())toast('이 브라우저에 임시 저장했습니다. 공용 파일 저장은 상단 폴더 재연결에서 저장 폴더를 연결해 주세요.');}else{await saveDisk();render();toast('통합관리 JSON에 저장했습니다.');}}
    else if(a==='import'||a==='restore')pickFile(a);
    else if(a==='sourceFolder')await selectSourceFolder();
    else if(a==='sourceFile')await selectSourceFile();
    else if(a==='finishSetup')await finishSetup();
    else if(a==='skipSetup'){deferredConnection=true;setupDone=true;user=null;render();}
    else if(a==='newLeave')openLeave();
    else if(a==='editLeave')openLeave(el.dataset.id);
    else if(a==='leaveList')leaveList();
    else if(a==='leaderSettings')leaderSettings();
    else if(a==='deleteLeave'){if(confirm('이 휴가 일정을 삭제하시겠습니까?')){state=P.deleteLeave(state,user.name,el.dataset.id);changed();$('#editor').close();render();toast('휴가를 삭제했습니다. 내용 저장으로 파일에 반영하세요.');}}
    else if(a==='permitFolders'){for(const [handle,mode] of [[sourceDir,'read'],[sourceHandle,'read'],[targetDir,'readwrite'],[targetHandle,'readwrite']])if(handle?.requestPermission)await handle.requestPermission({mode});if(await checkConnections())await finishSetup();else{render();toast('허용하지 않은 연결이 있습니다. 연결 버튼으로 다시 선택할 수 있습니다.');}}
    else if(a==='backSetup'){setupDone=false;user=null;render();}
    else if(a==='connections'){await checkConnections();showDialog('<div class="modal-head"><h2>폴더 연결 확인</h2>'+button('close','닫기')+'</div><div class="modal-body">'+connectionCards()+(sourceDir||targetDir?button('permitFolders','기억된 폴더 접근 허용'):'')+'</div>');}
    else if(a==='refreshAll'||a==='refreshSource')await refreshAll();
    else if(a==='displayStyle'){const saved=styles.select(el.dataset.style);render();preferences();toast(saved?'화면 스타일을 변경했습니다.':'화면 스타일을 변경했지만 브라우저에 기억하지 못했습니다.');}
    else if(a==='preferences')preferences();
    else if(a==='avatarSettings')showDialog(D.avatarPicker(user));
    else if(a==='setAvatar'){state=P.setAvatar(state,user.name,el.dataset.avatar);changed();$('#editor').close();render();toast('내 캐릭터를 변경했습니다. 내용 저장으로 공용 파일에 반영하세요.');}
    else if(a==='adminSettings')adminSettings();
    else if(a==='transferAdmin')transferAdminDialog();
    else if(a==='editQuickLinks')quickLinksDialog();
    else if(a==='boardTeam'){if(!B.canRead(state,user.name,el.dataset.team))throw Error('게시판 접근 권한이 없습니다.');boardTeam=el.dataset.team;render();}
    else if(a==='newPost'||a==='editPost')showDialog(D.postForm(state,user,boardTeam,el.dataset.id));
    else if(a==='deletePost'){if(confirm('게시글을 삭제하시겠습니까?')){state=B.remove(state,user.name,el.dataset.id);changed();$('#editor').close();render();}}
    else if(a==='userWork'){userWork=el.dataset.name||'';render();}
    else if(a==='passwords')passwordSettings();
    else if(a==='resetPassword'){const name=el.dataset.name;if(!confirm(name+'님의 비밀번호를 초기화할까요? 내용 저장 후 해당 팀원은 새 비밀번호를 설정해야 합니다.'))return;state=P.resetPassword(state,user.name,name);changed();try{if((await V.recall())?.name===name)await V.forget();}catch{}passwordSettings();toast('비밀번호를 임시 초기화했습니다. 내용 저장으로 공용 파일에 반영하세요.');}
    else if(a==='seedSamples'){state=P.addSamples(state);changed();if($('#editor').open)$('#editor').close();render();toast('샘플 프로젝트·일정·휴가·메모를 추가했습니다. 공용 파일에는 아직 저장하지 않았습니다.');}
    else if(a==='manageMembers'){$('#editor').close();page='people';render();}
    else if(a==='newMemo')openMemo();
    else if(a==='editMemo')openMemo(el.dataset.id);
    else if(a==='deleteMemo'){if(confirm('이 메모·일정을 삭제하시겠습니까?')){state.personal[user.name]=state.personal[user.name].filter(i=>i.id!==el.dataset.id);changed();$('#editor').close();render();}}
    else if(a==='addMember')addMemberDialog();
    else if(a==='rehire')addMemberDialog(el.dataset.name);
    else if(a==='removeMember')removeMemberDialog(el.dataset.name);
    else if(a==='forgetLogin'){await V.forget();if($('#loginPassword'))$('#loginPassword').value='';toast('이 브라우저에 저장된 로그인 정보를 지웠습니다.');}
  }
  function brand(){return '<div class="brand"><img src="../images/logo.svg" width="40" height="40" alt=""><span>워크 플레이스</span></div>';}
  function syncRoster(){P.upgrade(state);C.setMembers(state.members);}
  const activeMembers=()=>P.orderedMembers(state).filter(m=>m.active!==false);
  function setup(){
    $('#app').innerHTML=`<main class="login"><div class="setup-box">${brand()}<p class="eyebrow">WORK24 × PLACECND</p><h1>업무 공간을 연결해 주세요</h1><p class="setup-description">원본은 읽기 전용으로, 변경사항은 별도 통합관리 파일에 저장합니다.<br>폴더 연결을 마치면 로그인할 수 있습니다.</p>${cacheError?`<p class="error">${esc(cacheError)}</p>`:''}${connectionCards()}<div class="setup-footer"><p id="setupStatus" role="status">${connectionReady()?'모든 연결을 확인했습니다. 로그인으로 이동할 수 있습니다.':'원본 자료 폴더, 요청관리 JSON, 저장 폴더를 모두 연결해 주세요.'}</p>${button('finishSetup','연결 확인하고 로그인','primary',connectionReady()?'':'disabled')}</div><p class="muted">기준 자료 폴더: Z:\\고용24 디자인파트 요청관리\\디자인파트요청관리\\<br>요청관리.json의 위치와 Y 드라이브의 저장 폴더는 직접 선택합니다.</p>${!window.showDirectoryPicker?'<p class="error">현재 브라우저에서는 폴더 연결을 지원하지 않습니다. 이 프로그램의 index.html을 데스크톱 Edge 또는 Chrome에서 열어 주세요.</p>':''}</div></main>`;
  }
  function connectionReady(){return Boolean(sourceDir&&sourceHandle&&targetDir&&targetHandle&&health.source&&health.target);}
  function setupExtras(){const footer=$('.setup-footer');if(footer)footer.insertAdjacentHTML('afterend',`<div class="setup-secondary">${sourceDir||targetDir?button('permitFolders','기억된 폴더 접근 허용'):''}${button('skipSetup','연결은 나중에, 로그인 먼저','black-button')}<p class="muted">연결 전에는 이 브라우저에 임시 저장됩니다. 공용 저장은 로그인 후 폴더를 연결해 주세요.</p></div>`);}
  async function rememberFolders(){try{await V.rememberConnections({sourceDir,sourceHandle,targetDir,targetHandle,lastDiskText:diskText});}catch{toast('이 브라우저에서 폴더 연결을 기억하지 못했습니다. 다음 실행 때 다시 선택해 주세요.');}}
  async function restoreFolders(){
    const saved=await V.recallConnections();if(!saved||setupDone||user)return;
    sourceDir=saved.sourceDir||null;sourceHandle=saved.sourceHandle||null;targetDir=saved.targetDir||null;targetHandle=saved.targetHandle||null;diskText=saved.lastDiskText??null;
    if(await checkConnections()){
      const raw=await (await targetHandle.getFile()).text();
      if(dirty&&diskText!==raw){render();toast('기억된 폴더를 찾았지만 공용 파일이 변경되었습니다. 임시 자료를 백업한 뒤 저장 폴더를 다시 연결해 주세요.');return;}
      if(!dirty&&raw.trim()){state=P.upgrade(C.validateState(JSON.parse(raw)));syncRoster();}
      diskText=raw;await finishSetup();toast('이전에 연결한 폴더를 자동으로 연결했습니다.');
    }else render();
  }
  function connectionCards(){return `<div class="connection-grid"><section class="connect-card"><span class="step-number">01</span><h2>원본 자료 · 읽기 전용</h2><p>프로젝트 자료와 팀관리 JSON이 있는 폴더를 선택하세요.</p><div class="connection-line"><span>${sourceDir?esc(sourceDir.name):'자료 폴더 미연결'}</span>${button('sourceFolder',sourceDir?'폴더 재연결':'Z 자료 폴더 연결')}</div><div class="connection-line"><span>${sourceHandle&&health.source?'요청관리.json 연결됨':'요청관리 JSON 미연결'}</span>${button('sourceFile',sourceHandle?'JSON 재연결':'요청관리 JSON 선택')}</div><p class="muted">요청관리.json은 다른 위치에 있어도 별도로 선택할 수 있습니다.</p></section><section class="connect-card"><span class="step-number">02</span><h2>통합관리 · 읽기 및 저장</h2><p>Y 드라이브에서 통합관리 데이터를 보관할 폴더를 선택하세요.</p><div class="connection-line"><span>${targetDir&&health.target?esc(targetDir.name):'저장 폴더 미연결'}</span>${button('connect',targetDir?'폴더 재연결':'Y 저장 폴더 연결')}</div><p class="muted">저장 파일: ${BOARD_FILE}<br>선택한 폴더에 기존 파일이 있으면 그 자료를 불러옵니다.</p></section></div>`;}
  async function login(){
    if(!setupDone){setup();setupExtras();$('.setup-secondary').insertAdjacentHTML('beforeend',button('seedSamples','샘플 자료 채우기')+'<p class="muted">프로젝트·주간 일정·휴가·메모를 추가합니다. 로그인 후 확인할 수 있습니다.</p>');return;}
    syncRoster();const members=activeMembers();
    let remembered=null;try{remembered=await V.recall();}catch{}
    const previous=members.find(m=>m.name===remembered?.name),chosen=previous||members[0];
    if(!chosen){toast('로그인 가능한 인원이 없습니다. 통합관리 자료를 확인해 주세요.');setupDone=false;setup();return;}
    $('#app').innerHTML=`<main class="login"><div class="login-box">${brand()}<p class="eyebrow">WORK24 × PLACECND</p><h1>함께 만드는 업무 공간</h1><p>연결을 마쳤습니다. 팀과 이름을 선택해 주세요.</p><div class="login-connected">✓ 원본 읽기 연결 &nbsp;·&nbsp; ✓ 통합관리 저장 연결</div><form id="loginForm"><div class="field"><label for="loginTeam">팀</label><select id="loginTeam" name="team">${options(C.TEAMS,chosen.team)}</select></div><div class="field"><label for="loginName">이름</label><select id="loginName" name="name">${options(members.filter(m=>m.team===chosen.team).map(m=>m.name),chosen.name)}</select></div><div class="field"><label for="loginPassword">비밀번호</label><input type="password" id="loginPassword" name="password" required minlength="6" autocomplete="off" placeholder="비밀번호 6자 이상"></div><div class="field" id="confirmField" hidden><label for="confirmPassword">비밀번호 확인</label><input type="password" id="confirmPassword" name="confirm" autocomplete="new-password" placeholder="처음 설정할 비밀번호를 다시 입력"></div><p id="loginHint"></p><label class="remember-check"><input type="checkbox" name="remember" checked> 이 브라우저에 로그인 정보 기억</label><p class="muted">현재 PC의 이 브라우저에만 보관합니다. 공용 JSON에 비밀번호를 저장하지 않습니다.</p><div class="error" id="loginError" role="alert"></div><button class="primary wide" id="loginSubmit">로그인</button></form><div class="login-links">${button('forgetLogin','저장된 로그인 정보 지우기')}${button('backSetup','폴더 연결 확인')}</div><p class="muted">공용 파일의 사용자 구분을 위한 로그인입니다.</p></div></main>`;
    if(deferredConnection){$('.login-connected').textContent='연결 전 · 이 브라우저에 임시 저장됩니다';$('.login-box h1 + p').textContent='팀과 이름을 선택하세요. 폴더는 로그인 후 연결할 수 있습니다.';}
    await updateLogin(remembered);
  }
  async function updateLogin(remembered){
    const name=$('#loginName')?.value;$('#loginSubmit').disabled=!name;if(!name){$('#loginPassword').value='';$('#confirmField').hidden=true;$('#confirmPassword').required=false;$('#loginHint').textContent='이 팀에 재직자가 없습니다. 다른 팀을 선택하세요.';return;}
    const existing=Boolean(state.accounts[name]);$('#confirmField').hidden=existing;$('#confirmPassword').required=!existing;$('#confirmPassword').value='';$('#loginPassword').value='';
    $('#loginPassword').autocomplete=existing?'off':'new-password';
    $('#loginHint').textContent=existing?'기억된 정보를 확인하고 로그인하세요.':'최초 로그인입니다. 사용할 비밀번호를 설정해 주세요.';
    $('#loginSubmit').textContent=existing?'로그인':'비밀번호 설정하고 시작';
    try{const saved=remembered||await V.recall();if(existing&&saved?.name===name&&$('#loginName')?.value===name)$('#loginPassword').value=saved.password;}catch{}
  }
  function connectionBar(){return D.connection(health);}
  let layoutDraft=[];
  
  function homeLayout(){const labels={memo:'메모 & 일정',thisWeek:'이번 주 일정',nextWeek:'다음 주 일정',deadlines:'프로젝트 마감',leaves:'휴가 일정',work:'업무 현황·목록'};showDialog(`<div class="modal-head"><h2>나의 홈 배치 순서</h2>${button('close','닫기')}</div><div class="modal-body"><p>위에서 아래, 왼쪽에서 오른쪽 순서입니다. 다른 팀원의 배치는 바뀌지 않습니다.</p>${layoutDraft.map((key,i)=>`<div class="connection-line"><strong>${i+1}. ${labels[key]}</strong><div>${button('layoutMove','↑ 위로','',`data-key="${key}" data-direction="-1" ${i===0?'disabled':''}`)}${button('layoutMove','↓ 아래로','',`data-key="${key}" data-direction="1" ${i===layoutDraft.length-1?'disabled':''}`)}</div></div>`).join('')}</div><div class="modal-foot">${button('layoutReset','기본 순서')}${button('close','취소')}${button('layoutSave','배치 저장','primary')}</div>`);}
  function weekBlocks(date,done=false){if(!date)return '';const r=P.weekRemaining(date),past=date<C.today(),filled=past?P.weekRemaining(C.today(),date).filled:r.filled;return '<div class="week-countdown '+(done?'is-complete':past?'overdue':date===C.today()?'due-today':'upcoming')+'" aria-label="'+esc(done?'완료':P.dday(date))+'"><strong>'+(done?'완료':P.dday(date))+'</strong><div class="week-blocks" aria-hidden="true">'+Array.from({length:7},(_,i)=>'<span class="'+(!done&&i<filled?'filled':'')+'"></span>').join('')+'</div></div>';}
  function schedulePanel(){const leader=P.isLeader(state,user.name),team=member(user.name).team,ranges=P.weekRanges();const weeks=ranges.map((range,index)=>{const rows=P.schedule(state,user.name,range),shown=page==='dashboard'?rows.slice(0,4):rows;return '<section class="card"><div class="sectionhead"><div><h2>'+(index?'다음 주':'이번 주')+' '+(leader?'팀':'나의')+' 일정</h2><p class="muted">'+range.start+' ~ '+range.end+'</p></div></div><div class="agenda-list">'+(shown.map(i=>'<article class="agenda-item"><div><small>'+esc(i.date)+(i.end&&i.end!==i.date?' ~ '+esc(i.end):'')+' '+esc(i.time||'')+'</small><strong>'+esc(i.title)+'</strong><span>'+esc(i.owner)+' · '+i.kind+'</span></div>'+weekBlocks(i.date,i.done)+'</article>').join('')||'<p class="empty">등록된 일정이 없습니다.</p>')+'</div></section>';});
    const deadlines=state.projects.map(C.effective).filter(p=>p.status!=='완료'&&p.due&&p.assignees.some(n=>n===user.name||(leader&&member(n)?.team===team))).sort((a,b)=>a.due.localeCompare(b.due));
    const leaves=state.leaves.filter(l=>l.end>=C.today()&&(P.canManage(state,user.name)||member(l.owner)?.team===team)).sort((a,b)=>a.start.localeCompare(b.start));
    return {thisWeek:weeks[0],nextWeek:weeks[1],deadlines:'<section class="card"><div class="sectionhead"><h2>'+(leader?'팀':'나의')+' 프로젝트 마감</h2></div><div class="agenda-list">'+deadlineItems(page==='dashboard'?deadlines.slice(0,4):deadlines)+'</div></section>',leaves:'<section class="card"><div class="sectionhead"><h2>팀원 휴가 일정</h2>'+button('newLeave','＋ 휴가 등록')+'</div><div class="agenda-list">'+leaveItems(page==='dashboard'?leaves.slice(0,4):leaves)+'</div></section>'};
  }
  
  function openLeave(id){const i=state.leaves.find(l=>l.id===id)||{id:'',owner:user.name,start:C.today(),end:C.today(),type:'연차',note:''},leader=P.isLeader(state,user.name)||P.canManage(state,user.name);if(!P.canEditLeave(state,user.name,i.owner))throw new Error('이 팀원의 휴가를 변경할 권한이 없습니다.');showDialog(`<div class="modal-head"><h2>${i.id?'휴가 수정':'휴가 등록'}</h2>${button('close','닫기')}</div><form id="leaveForm"><div class="modal-body"><input name="id" type="hidden" value="${esc(i.id)}"><div class="field"><label for="leaveOwner">이름</label><select name="owner" id="leaveOwner">${options(activeMembers().filter(m=>P.canEditLeave(state,user.name,m.name)).map(m=>m.name),i.owner)}</select></div><div class="field"><label for="leaveType">휴가 종류</label><select name="type" id="leaveType">${options(['연차','오전 반차','오후 반차','기타 휴가','추가 사용'],i.type)}</select></div><div class="form-grid"><div class="field"><label for="leaveStart">시작일</label><input name="start" id="leaveStart" type="date" required value="${esc(i.start)}"></div><div class="field"><label for="leaveEnd">종료일</label><input name="end" id="leaveEnd" type="date" required value="${esc(i.end)}"></div></div><div class="field"><label for="leaveUnits">추가 사용 시 하루 차감량</label><select id="leaveUnits" name="dailyUnits">${options(['1','0.5'],String(i.dailyUnits||1))}</select></div><div class="field"><label for="leaveNote">메모 (선택)</label><textarea name="note" id="leaveNote" maxlength="300">${esc(i.note)}</textarea></div><p class="muted">${P.canManage(state,user.name)?'모든 재직자의 휴가를 등록·수정할 수 있습니다.':leader?'소속 팀원의 휴가를 등록·수정할 수 있습니다.':'본인의 휴가를 등록·수정할 수 있습니다.'} 등록한 휴가는 팀 일정에 표시됩니다.</p><div id="leaveError" class="error" role="alert"></div></div><div class="modal-foot">${i.id?button('deleteLeave','휴가 삭제','danger',`data-id="${esc(i.id)}"`):''}${button('close','취소')}<button class="primary">휴가 저장</button></div></form>`);}
  function leaveList(){const leader=P.isLeader(state,user.name)||P.canManage(state,user.name),team=member(user.name).team;const items=state.leaves.filter(l=>P.canEditLeave(state,user.name,l.owner)).slice().sort((a,b)=>b.start.localeCompare(a.start));showDialog(`<div class="modal-head"><h2>${P.canManage(state,user.name)?'전체':leader?'우리 팀':'나의'} 휴가 관리</h2>${button('close','닫기')}</div><div class="modal-body"><div class="agenda-list">${items.map(l=>`<article class="agenda-item"><strong>${esc(l.owner)} · ${esc(l.type)}</strong><small>${esc(l.start)} ~ ${esc(l.end)}</small>${P.canEditLeave(state,user.name,l.owner)?button('editLeave','편집','',`data-id="${esc(l.id)}"`):''}</article>`).join('')||'<p class="empty">등록된 휴가가 없습니다.</p>'}</div></div><div class="modal-foot">${button('newLeave','＋ 휴가 등록','primary')}${button('close','닫기')}</div>`);}
  function leaderSettings(){showDialog(`<div class="modal-head"><h2>팀장 지정</h2>${button('close','닫기')}</div><form id="leadersForm"><div class="modal-body"><p>팀별 팀장을 지정하세요. 팀장은 같은 팀의 일정을 조회하고, 같은 팀원의 휴가를 관리할 수 있습니다.</p>${C.TEAMS.map(team=>`<div class="field"><label for="leader-${esc(N.teamLabel(team))}">${esc(N.teamLabel(team))}팀 팀장</label><select id="leader-${esc(N.teamLabel(team))}" name="${esc(N.teamLabel(team))}">${options(activeMembers().filter(m=>m.team===team).map(m=>m.name),state.teamLeaders[team]||'','미지정')}</select></div>`).join('')}<div id="leadersError" class="error" role="alert"></div></div><div class="modal-foot">${button('close','취소')}<button class="primary">팀장 지정 저장</button></div></form>`);}
  function adminSettings(){showDialog(`<div class="modal-head"><h2>팀관리자 지정</h2>${button('close','닫기')}</div><form id="adminsForm"><div class="modal-body"><p>현재 전체관리자는 ${esc(P.overallAdmin(state))}님입니다. 아래에서 추가 팀관리자를 선택하세요.</p>${activeMembers().filter(m=>m.name!==P.overallAdmin(state)).map(m=>`<label class="remember-check"><input type="checkbox" name="admins" value="${esc(m.name)}" ${(state.teamAdmins||[]).includes(m.name)?'checked':''}> ${esc(N.teamLabel(m.team))} · ${esc(m.name)}</label>`).join('')}<div id="adminsError" class="error" role="alert"></div></div><div class="modal-foot">${button('close','취소')}<button class="primary">지정 저장</button></div></form>`);}
  function passwordSettings(){showDialog(`<div class="modal-head"><h2>개별 비밀번호 초기화</h2>${button('close','닫기')}</div><div class="modal-body"><p>초기화 후 내용 저장을 누르면 기존 비밀번호가 해제됩니다. 해당 팀원은 다음 로그인에서 새 비밀번호를 설정합니다.</p>${activeMembers().map(m=>`<div class="connection-line"><span>${esc(N.teamLabel(m.team))} · ${esc(m.name)}${state.accounts[m.name]?'':' · 최초 설정 대기'}</span>${button('resetPassword','비밀번호 초기화','danger',`data-name="${esc(m.name)}" ${!state.accounts[m.name]?'disabled':''}`)}</div>`).join('')}</div><div class="modal-foot">${button('close','닫기')}</div>`);}
  function deadlineItems(rows){return rows.map(p=>'<article class="agenda-item"><div>'+button('edit',esc(p.title),'project-button','data-id="'+esc(p.id)+'"')+'<small>'+esc(p.due)+' · '+esc(p.assignees.join(', '))+'</small></div>'+weekBlocks(p.due,p.status==='완료')+'</article>').join('')||'<p class="empty">예정된 마감이 없습니다.</p>';}
  function leaveItems(rows){return rows.map(l=>'<article class="agenda-item"><div><strong>'+esc(l.owner)+' · '+esc(l.type)+'</strong><small>'+esc(l.start)+' ~ '+esc(l.end)+'</small>'+(P.canEditLeave(state,user.name,l.owner)?button('editLeave','편집','','data-id="'+esc(l.id)+'"'):'')+'</div>'+weekBlocks(l.start)+'</article>').join('')||'<p class="empty">등록된 휴가가 없습니다.</p>';}
  function deadlinePage(){const rows=projects().filter(p=>p.due&&p.status!=='완료').sort((a,b)=>a.due.localeCompare(b.due));return '<section class="card"><div class="table-toolbar"><h2>마감 일정</h2>'+scopeTabs()+'</div>'+filterBar()+'<div class="agenda-list detail-agenda">'+deadlineItems(rows)+'</div></section>';}
  function vacationPage(management=false){const rows=state.leaves.filter(l=>management?P.canEditLeave(state,user.name,l.owner):P.canManage(state,user.name)||member(l.owner)?.team===user.team).slice().sort((a,b)=>b.start.localeCompare(a.start));return annualLeavePanel(management)+'<section class="card"><div class="sectionhead"><h2>'+(management?'팀원 휴가 관리':'휴가 일정')+'</h2>'+button('newLeave','＋ 휴가 등록','primary')+'</div><p class="panel-note">본인: 본인 휴가 · 팀장: 소속 팀 · 팀관리자: 전체 팀</p>'+D.leaves(state,user,rows)+'</section>';}
  function peoplePage(){if(!W.canPersonnel(state,user.name))return '';return '<div class="actions management-actions">'+(P.canManage(state,user.name)?button('leaderSettings','팀장 지정')+button('passwords','개별 비밀번호 초기화'):'')+(P.isOverallAdmin(state,user.name)?button('adminSettings','팀관리자 지정'):'')+'</div>'+vacationPage(true)+(P.canManage(state,user.name)?personnelPanel():'');}
  function revisionPage(){const rows=projects().filter(p=>p.parentProjectId);return '<section class="card"><div class="table-toolbar"><h2>연결된 수정작업 <span class="count">'+rows.length+'</span></h2>'+scopeTabs()+viewTabs()+'</div>'+filterBar()+(view==='category'?categorizedTable(rows):projectTable(rows))+'</section><p class="muted">원본 과업을 열고 ‘수정작업 추가’를 누르면 연결된 작업을 등록합니다.</p>';}
  function revisionLinks(project){const rootId=project.parentProjectId||project.id,root=state.projects.find(p=>p.id===rootId),children=state.projects.filter(p=>p.parentProjectId===rootId).map(C.effective);if(!root)return '';return '<section class="revision-links"><h2>수정작업 연결</h2>'+(project.parentProjectId?'<p>원본 과업: '+button('edit',esc(C.effective(root).title),'project-button','data-id="'+esc(rootId)+'"')+'</p>':'')+button('newRevision','＋ 수정작업 추가','','data-id="'+esc(rootId)+'"')+children.map(p=>'<div class="connection-line">'+button('edit',esc(p.title),'project-button','data-id="'+esc(p.id)+'"')+badge(p.status)+weekBlocks(p.due,p.status==='완료')+'</div>').join('')+'</section>';}
  function contentOptionsDialog(){const lists=W.contentOptions(state);showDialog('<div class="modal-head"><h2>콘텐츠 선택 항목 관리</h2>'+button('close','닫기')+'</div><div class="modal-body"><p>제거한 항목도 기존 과업에 저장된 값은 유지됩니다.</p>'+Object.entries(lists).map(([level,items])=>'<h3>'+(level==='level2'?'분류 2 · 월별 주제':'분류 3 · 콘텐츠 유형')+'</h3>'+items.map(value=>'<div class="connection-line"><span>'+esc(value)+'</span>'+button('removeContentOption','항목 제거','danger','data-level="'+level+'" data-value="'+esc(value)+'"')+'</div>').join('')).join('')+'<form id="contentOptionForm"><div class="form-grid"><div class="field"><label for="optionLevel">분류</label><select name="level" id="optionLevel"><option value="level2">분류 2</option><option value="level3">분류 3</option></select></div><div class="field"><label for="optionValue">추가할 항목</label><input id="optionValue" name="value" required maxlength="100"></div></div><button type="submit" class="primary">항목 추가</button><div class="error" id="contentOptionError"></div></form></div>');}
  function annualLeavePanel(){const allowed=activeMembers().filter(m=>m.name===user.name||P.canManage(state,user.name));if(!allowed.some(m=>m.name===leaveOwner))leaveOwner=user.name;const ledger=W.leaveLedger(state,leaveOwner,leaveYear),number=x=>x===null?'미입력':x+'일';return '<section class="card annual-panel"><div class="sectionhead"><h2>연차 현황</h2><div class="actions"><label>연도 <input id="leaveYear" type="number" min="2000" max="2100" value="'+leaveYear+'"></label><label>이름 <select id="leaveOwner">'+options(allowed.map(m=>m.name),leaveOwner)+'</select></label></div></div><div class="annual-totals">'+[['연차 총수',ledger.allowance],['사용 일수',ledger.used],['남은 일수',ledger.remaining],['사용 예정',ledger.planned],['예정 반영 잔여',ledger.available]].map(([label,value])=>'<div><small>'+label+'</small><strong>'+number(value)+'</strong></div>').join('')+'</div><form id="allowanceForm" class="allowance-form"><label for="allowanceDays">'+esc(leaveOwner)+'님의 '+leaveYear+'년 연차 총수</label><input name="days" id="allowanceDays" type="number" min="0" max="366" step="0.5" required value="'+(ledger.allowance??'')+'"><button class="primary" type="submit">총수 저장</button><span class="error" id="allowanceError"></span></form><p class="panel-note">연차 1일 · 반차 0.5일 · 추가 사용 0.5/1일. 주말·대한민국 공휴일·대체공휴일 제외, 기타 휴가는 차감하지 않습니다. 2026·2027년 휴일 자료가 포함되어 있으며 새로 지정되는 임시공휴일은 자료 갱신이 필요합니다. 오늘까지는 사용, 이후 날짜는 예정으로 표시합니다.</p>'+(!ledger.calendarSupported?'<p class="error" role="alert">'+leaveYear+'년 공휴일 자료가 없습니다. 사용·잔여 일수는 주말만 제외한 잠정치입니다.</p>':'')+(ledger.excluded.length?'<details><summary>공휴일로 차감 제외 ('+ledger.excluded.length+'일)</summary><ul>'+ledger.excluded.map(e=>'<li>'+e.date+' · '+esc(e.name)+' · 0일 차감</li>').join('')+'</ul></details>':'')+'<details><summary>날짜별 사용 내역 ('+ledger.entries.length+'일)</summary><div class="table-wrap"><table><thead><tr><th>사용일</th><th>구분</th><th>사용량</th><th>상태</th></tr></thead><tbody>'+ledger.entries.map(e=>'<tr><td>'+e.date+'</td><td>'+esc(e.types.join(' / '))+'</td><td>'+e.days+'일</td><td>'+(e.date<=C.today()?'사용':'예정')+'</td></tr>').join('')+'</tbody></table></div></details></section>';}
  function personalPanel(){
    const items=(state.personal[user.name]||[]).slice().sort((a,b)=>Number(a.done)-Number(b.done)||(a.date||'9999').localeCompare(b.date||'9999')||(a.time||'').localeCompare(b.time||''));
    return `<section class="card personal-panel"><div class="sectionhead"><div><h2>나의 메모 & 일정 <span class="count">${items.filter(i=>!i.done).length}</span></h2><p class="muted">${esc(user.name)}님의 할 일과 간단한 일정을 기록하세요.</p></div><div class="home-panel-actions">${BoardMemoCarousel.controls('personal-memos',items.length)}${button('newMemo','＋ 메모·일정 추가')}</div></div>${BoardMemoCarousel.render('personal-memos',items.map(i=>`<article class="memo-card ${i.done?'done':''}"><div class="memo-title"><label class="memo-check"><input type="checkbox" data-memo-toggle="${esc(i.id)}" ${i.done?'checked':''} aria-label="${esc(i.title)} 완료"><strong>${esc(i.title)}</strong></label>${button('editMemo','편집','',`data-id="${esc(i.id)}"`)}</div><div class="memo-date">${i.date?`${esc(i.date)} ${esc(i.time)}${i.date<C.today()&&!i.done?' · 지난 일정':''}`:'날짜 없는 메모'}${i.done?' · 완료':''}</div><p>${esc(i.content)||'내용 없음'}</p></article>`).join(''),'<div class="memo-grid">'+D.illustratedHint(user.avatar,'첫 메모를 남겨보세요','회의 준비, 확인할 일, 아이디어를 적고 날짜를 넣어 일정으로 관리하세요.')+'</div>')}</section>`;
  }
  function showDialog(content){dialogOpener=document.activeElement;$('#editor').innerHTML=content;$('#editor').showModal();}
  function openMemo(id){const i=(state.personal[user.name]||[]).find(i=>i.id===id)||{id:'',title:'',content:'',date:'',time:'',done:false};showDialog(`<div class="modal-head"><h2>${i.id?'메모·일정 편집':'새 메모·일정'}</h2>${button('close','닫기')}</div><form id="memoForm"><div class="modal-body"><input type="hidden" name="id" value="${esc(i.id)}"><div class="field"><label for="memoTitle">제목</label><input id="memoTitle" name="title" required maxlength="150" value="${esc(i.title)}"></div><div class="form-grid"><div class="field"><label for="memoDate">일정 날짜 (선택)</label><input id="memoDate" name="date" type="date" value="${esc(i.date)}"></div><div class="field"><label for="memoTime">시간 (선택)</label><input id="memoTime" name="time" type="time" value="${esc(i.time)}"></div></div><div class="field"><label for="memoContent">메모 내용</label><textarea id="memoContent" name="content">${esc(i.content)}</textarea></div><label class="remember-check"><input name="done" type="checkbox" ${i.done?'checked':''}> 완료한 메모·일정</label><p class="muted">날짜를 지정한 일정의 제목·날짜·시간·완료 상태는 팀장에게도 표시됩니다. 날짜 없는 메모와 상세 내용은 본인 화면에만 표시되며, 내용 저장 시 공용 통합관리 JSON에 함께 보관됩니다.</p><div id="memoError" class="error" role="alert"></div></div><div class="modal-foot">${i.id?button('deleteMemo','메모 삭제','danger',`data-id="${esc(i.id)}"`):''}${button('close','취소')}<button class="primary">메모 저장</button></div></form>`);}
  function personnelPanel(){return `<section class="card settings-card"><div class="sectionhead"><div><h2>입사·퇴사 인원 관리</h2><p class="muted">재직 ${activeMembers().length}명 · 퇴사 ${state.members.filter(m=>m.active===false).length}명</p></div>${button('addMember','＋ 인원 추가','primary')}</div><div class="table-wrap"><table><caption class="sr-only">등록 인원과 재직 상태</caption><thead><tr><th scope="col">팀</th><th scope="col">이름</th><th scope="col">상태</th><th scope="col">관리</th></tr></thead><tbody>${P.orderedMembers(state).map(m=>`<tr><td>${esc(N.teamLabel(m.team))}</td><td>${esc(m.name)}${m.name===user.name?' (본인)':''}</td><td>${m.active===false?`퇴사 · ${m.retention==='purge'?'개인 자료 삭제':'자료 보관'}`:'재직'}</td><td>${m.active===false?button('rehire','재입사','','data-name="'+esc(m.name)+'"'):button('removeMember','퇴사 처리','danger',`data-name="${esc(m.name)}" ${m.name===user.name?'disabled title="본인의 퇴사 처리는 다른 사용자가 진행해 주세요."':''}`)}</td></tr>`).join('')}</tbody></table></div><p>퇴사 처리 시 로그인 대상에서 제외하고, 기존 자료의 보관 또는 삭제를 선택합니다. 변경사항은 내용 저장을 눌러 공용 파일에 반영하세요.</p></section>`;}
  function addMemberDialog(name=''){const old=member(name);showDialog(`<div class="modal-head"><h2>${old?'재입사 등록':'인원 추가'}</h2>${button('close','닫기')}</div><form id="memberForm"><div class="modal-body"><div class="field"><label for="memberTeam">팀</label><select id="memberTeam" name="team">${options(C.TEAMS,old?.team||'기획')}</select></div><div class="field"><label for="memberName">이름</label><input id="memberName" name="name" value="${esc(name)}" required maxlength="40" ${old?'readonly':''}></div><div class="field"><label for="memberRank">직급</label><input id="memberRank" name="rank" maxlength="30" value="${esc(old?.rank||'')}"></div><p class="muted">추가한 인원은 최초 로그인 시 본인의 비밀번호를 설정합니다.</p><div id="memberError" class="error" role="alert"></div></div><div class="modal-foot">${button('close','취소')}<button class="primary">${old?'재입사 등록':'인원 추가'}</button></div></form>`);}
  function removeMemberDialog(name){const impact=P.removalImpact(state,name);showDialog(`<div class="modal-head"><h2>${esc(name)}님 퇴사 처리</h2>${button('close','닫기')}</div><form id="removeMemberForm"><input name="name" type="hidden" value="${esc(name)}"><div class="modal-body"><p>담당 과업 ${impact.projects}개 · 담당 업무 ${impact.tasks}개 · 작업 내역 ${impact.logs}개 · 개인 메모 ${impact.personal}개</p><fieldset class="retention-options"><legend>기존 자료 처리 방법</legend><label><input type="radio" name="retention" value="keep" checked><span><strong>자료 남기기</strong><small>업무·작업 내역·개인 메모를 보관합니다. 로그인과 신규 담당자 선택에서만 제외합니다.</small></span></label><label><input type="radio" name="retention" value="purge"><span><strong>개인 관련 자료 제거</strong><small>담당 배정, 단독 담당 업무·과업, 작성한 작업 내역과 개인 메모를 제거합니다. 공동 과업과 다른 담당자의 자료는 남깁니다. 원본 파일과 원본에서 가져온 자유 형식 설명·원문 사본은 변경하지 않습니다.</small></span></label></fieldset><label class="remember-check"><input type="checkbox" name="acknowledge" required> 선택한 처리 방식을 확인했습니다.</label><p class="muted">퇴사 계정의 비밀번호 해시는 두 방식 모두 제거됩니다. 자료 제거는 저장 후 되돌릴 수 없으므로 필요한 경우 JSON 백업을 먼저 받으세요.</p>${button('backup','현재 자료 JSON 백업')}<div id="removeError" class="error" role="alert"></div></div><div class="modal-foot">${button('close','취소')}<button class="primary">퇴사 처리 적용</button></div></form>`);}
  function userWorkPage(){const rows=projects(),names=P.orderNames(state,[...new Set(rows.flatMap(p=>p.assignees))]);return '<section class="card"><div class="table-toolbar"><h2>사용자별 업무</h2>'+scopeTabs()+viewTabs()+'</div>'+filterBar()+'<div class="tabs">'+button('userWork','전체 사용자',!userWork?'active':'')+names.map(n=>button('userWork',esc(n),userWork===n?'active':'','data-name="'+esc(n)+'"')).join('')+'</div>'+names.filter(n=>!userWork||n===userWork).map(n=>'<section class="user-work-section"><h3>'+esc(n)+' · '+esc(N.teamLabel(member(n)?.team||''))+'</h3>'+(view==='category'?categorizedTable(rows.filter(p=>p.assignees.includes(n))):projectTable(rows.filter(p=>p.assignees.includes(n))))+'</section>').join('')+(names.length?'':'<p class="empty">담당자가 지정된 과업이 없습니다.</p>')+'</section>';}
  function quickLinks(){let links;try{links=N.cleanLinks(state.quickLinks||N.defaults);}catch{links=N.defaults;}return '<div class="quick-links" aria-label="사이트 바로가기">'+links.map(l=>l.url?'<a href="'+esc(l.url)+'" target="_blank" rel="noopener noreferrer">'+esc(l.label)+' ↗</a>':'<span class="unconfigured">'+esc(l.label)+' · 주소 미등록</span>').join('')+(P.isOverallAdmin(state,user.name)?button('editQuickLinks','주소 설정'):'')+'</div>';}
  function quickLinksDialog(){const links=state.quickLinks||N.defaults;showDialog('<div class="modal-head"><h2>사이트 바로가기</h2>'+button('close','닫기')+'</div><form id="quickLinksForm"><div class="modal-body"><p>상단에 표시할 사이트를 최대 4개까지 등록하세요.</p>'+Array.from({length:4},(_,i)=>'<div class="link-fields"><input name="label'+i+'" aria-label="사이트 '+(i+1)+' 이름" placeholder="사이트 이름" maxlength="40" value="'+esc(links[i]?.label||'')+'"><input name="url'+i+'" aria-label="사이트 '+(i+1)+' 주소" placeholder="https://..." value="'+esc(links[i]?.url||'')+'"></div>').join('')+'<div id="quickLinksError" class="error"></div></div><div class="modal-foot"><button class="primary">바로가기 저장</button></div></form>');}
  function transferAdminDialog(){showDialog('<div class="modal-head"><h2>전체관리자 권한 이전</h2>'+button('close','닫기')+'</div><form id="transferAdminForm"><div class="modal-body"><p>현재 전체관리자: '+esc(P.overallAdmin(state))+'</p><label for="nextAdmin">새 전체관리자</label><select id="nextAdmin" name="target" required>'+options(activeMembers().filter(m=>m.name!==user.name).map(m=>m.name),'','재직자 선택')+'</select><p>이전 후 본인의 전체관리자·팀관리자 권한은 해제됩니다. 팀장 지정은 유지됩니다. 공용 반영은 내용 저장을 눌러 완료하세요.</p><div id="transferAdminError" class="error"></div></div><div class="modal-foot">'+button('close','취소')+'<button class="primary">권한 이전</button></div></form>');}
  function preferences(){showDialog('<div class="modal-head"><h2>설정</h2>'+button('close','닫기')+'</div><div class="modal-body"><h3>화면 스타일</h3><p>원하는 스타일을 누르면 바로 적용됩니다. 이 브라우저에 선택을 기억합니다.</p>'+styles.picker(esc)+'<h3>화면 밝기</h3><label class="remember-check"><input type="checkbox" id="darkMode" '+(styles.current()==='midnight'?'disabled ':'')+(document.documentElement.dataset.theme==='dark'?'checked':'')+'> 다크모드 사용</label>'+(styles.current()==='midnight'?'<p>미드나이트는 다크 화면을 사용합니다.</p>':'')+'<h3>내 캐릭터</h3>'+button('avatarSettings','캐릭터 선택')+'<h3>로그인 편의</h3>'+button('forgetLogin','저장된 로그인 정보 지우기')+(P.isOverallAdmin(state,user.name)?'<h3>전체관리자</h3><p>현재: '+esc(P.overallAdmin(state))+'</p>'+button('transferAdmin','전체관리자 권한 이전'):'')+'<h3>샘플 자료</h3>'+button('seedSamples','샘플 자료 추가')+(W.canContent(state,user.name)?'<h3>콘텐츠 분류</h3>'+button('contentOptions','콘텐츠 선택 항목 관리'):'')+'<p class="asset-credit">Pretendard · 토스페이스 © 토스팀(비바리퍼블리카)</p></div><div class="modal-foot">'+button('close','닫기')+'</div>');}
  
  async function checkConnections(){
    async function readable(handle,mode){if(!handle)return false;try{return !handle.queryPermission||await handle.queryPermission({mode})==='granted';}catch{return false;}}
    health.source=await readable(sourceDir,'read')&&await readable(sourceHandle,'read');health.target=await readable(targetDir,'readwrite')&&await readable(targetHandle,'readwrite');
    if(health.source)try{await sourceHandle.getFile();}catch{health.source=false;}
    if(health.target)try{await targetHandle.getFile();}catch{health.target=false;}
    return connectionReady();
  }
  async function selectSourceFolder(){
    if(!window.showDirectoryPicker)throw new Error('폴더 연결을 지원하는 데스크톱 Edge 또는 Chrome에서 열어 주세요.');
    const dir=await showDirectoryPicker({id:'workplace-source',mode:'read'});
    if(targetDir&&(await dir.isSameEntry(targetDir)||await dir.resolve(targetDir)!==null))throw new Error('원본 폴더와 그 하위 폴더를 저장 위치로 함께 사용할 수 없습니다.');
    let teams=null,requestHandle=null,raw=null;
    try{const teamHandle=await dir.getFileHandle('팀관리.json');const input=JSON.parse(await (await teamHandle.getFile()).text());const arr=Array.isArray(input)?input:input.teams||input.팀목록||input.요청팀||input.data; if(!Array.isArray(arr))throw new Error('팀관리.json의 팀 목록 구조를 확인해 주세요.');teams=arr.map(t=>typeof t==='string'?t:t.팀명||t.요청팀||t.name).filter(t=>typeof t==='string'&&t.trim());if(!teams.length)throw new Error('팀관리.json에 읽을 수 있는 팀명이 없습니다.');}catch(e){if(e.name!=='NotFoundError')throw e;}
    try{requestHandle=await dir.getFileHandle('요청관리.json');raw=await (await requestHandle.getFile()).text();C.importRows(state,JSON.parse(raw));}catch(e){if(e.name!=='NotFoundError')throw e;}
    sourceDir=dir;pendingTeams=teams;
    if(requestHandle){sourceHandle=requestHandle;pendingSource=raw;}health.source=Boolean(sourceHandle);await rememberFolders();if($('#editor').open)$('#editor').close();render();toast(requestHandle?'원본 폴더와 요청관리 JSON을 연결했습니다.':'자료 폴더를 연결했습니다. 요청관리 JSON의 위치를 따로 선택해 주세요.');
  }
  async function selectSourceFile(){
    if(!sourceDir)throw new Error('먼저 Z 원본 자료 폴더를 연결해 주세요.');
    if(!window.showOpenFilePicker)throw new Error('파일 연결을 지원하는 데스크톱 Edge 또는 Chrome에서 열어 주세요.');
    const [handle]=await showOpenFilePicker({id:'workplace-requests',multiple:false,types:[{description:'요청관리 JSON',accept:{'application/json':['.json']}}]});
    if(handle.name!=='요청관리.json')throw new Error('기존 요청관리.json 파일을 선택해 주세요.');
    const raw=await (await handle.getFile()).text();C.importRows(state,JSON.parse(raw));sourceHandle=handle;pendingSource=raw;health.source=true;await rememberFolders();if($('#editor').open)$('#editor').close();render();toast('읽기 전용 요청관리 JSON을 연결했습니다.');
  }
  async function connect(){
    if(!window.showDirectoryPicker)throw new Error('폴더 연결을 지원하는 데스크톱 Edge 또는 Chrome에서 열어 주세요.');
    const directory=await showDirectoryPicker({id:'workplace-output',mode:'readwrite'});
    if(sourceDir&&(await sourceDir.isSameEntry(directory)||await sourceDir.resolve(directory)!==null))throw new Error('원본 폴더와 그 하위 폴더에는 저장할 수 없습니다. Y 드라이브의 별도 폴더를 선택하세요.');
    let handle,existing=null,loaded=null;
    try{handle=await directory.getFileHandle(BOARD_FILE);existing=await (await handle.getFile()).text();if(existing.trim())loaded=P.upgrade(C.validateState(JSON.parse(existing)));}catch(e){if(e.name!=='NotFoundError')throw e;}
    if(loaded&&dirty&&!confirm('현재 임시 변경사항을 연결할 통합관리 파일의 자료로 바꾸시겠습니까? 취소 후 JSON 백업을 받을 수 있습니다.'))return;
    if(loaded){state=loaded;dirty=false;cacheError='';user=null;setupDone=false;}
    if(!handle){handle=await directory.getFileHandle(BOARD_FILE,{create:true});existing='';}
    targetDir=directory;targetHandle=handle;diskText=existing;health.target=true;syncRoster();persist();await rememberFolders();if($('#editor').open)$('#editor').close();render();toast('통합관리 저장 폴더를 연결했습니다.');
  }
  async function finishSetup(){
    if(!await checkConnections()){render();throw new Error('연결되지 않은 폴더 또는 JSON을 다시 연결해 주세요.');}
    const current=await (await targetHandle.getFile()).text();if(current!==diskText){if(dirty)throw new Error('공용 자료가 변경되었습니다. 임시 자료를 백업한 뒤 저장 폴더를 다시 연결하세요.');if(current.trim()){state=P.upgrade(C.validateState(JSON.parse(current)));syncRoster();}diskText=current;}
    const raw=await (await sourceHandle.getFile()).text();const result=C.importRows(state,JSON.parse(raw));state=P.enforceRemovals(result.state);if(pendingTeams)state.customerTeams=pendingTeams;pendingSource=null;syncRoster();changed();setupDone=true;deferredConnection=false;user=null;await rememberFolders();render();
  }
  async function refreshAll(){
    if(!await checkConnections()){render();throw new Error('연결이 끊겼습니다. 폴더 재연결에서 다시 연결해 주세요.');}
    const raw=await (await targetHandle.getFile()).text();let base=state;
    if(raw!==diskText){if(dirty)throw new Error('공용 파일과 현재 변경사항이 모두 있습니다. 현재 자료를 JSON 백업한 후 저장된 파일을 다시 읽어 주세요.');base=P.upgrade(C.validateState(JSON.parse(raw)));}
    C.setMembers(base.members);let result;try{result=C.importRows(base,JSON.parse(await (await sourceHandle.getFile()).text()));}catch(e){C.setMembers(state.members);throw e;}
    const oldAccount=user&&state.accounts[user.name];state=P.enforceRemovals(result.state);diskText=raw;syncRoster();if(pendingTeams)state.customerTeams=pendingTeams;
    if(user&&(member(user.name)?.active===false||JSON.stringify(oldAccount)!==JSON.stringify(state.accounts[user.name])))user=null;
    changed();render();toast('공용 자료와 최신 원본 요청을 새로 읽었습니다. 원본 반영 내용을 파일에 저장하려면 내용 저장을 눌러 주세요.');
  }
  function setWeek(){const d=new Date(),offset=(d.getDay()+6)%7;d.setDate(d.getDate()-offset);const fmt=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;filters.from=fmt(d);d.setDate(d.getDate()+6);filters.to=fmt(d);}
  document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(el)act(el).catch(err=>{if(err.name!=='AbortError')toast(err.message);});else if(!e.target.closest('button,input,select,textarea,a,label')){const card=e.target.closest('[data-home-target]');if(card)act({dataset:{action:'page',page:card.dataset.homeTarget}}).catch(err=>toast(err.message));}});
  document.addEventListener('submit',e=>{
    if(e.target.id==='allowanceForm'){e.preventDefault();try{state=W.setAllowance(state,user.name,leaveOwner,leaveYear,new FormData(e.target).get('days'));changed();render();toast('연차 총수를 저장했습니다. 공용 파일 반영은 내용 저장을 눌러 주세요.');}catch(err){$('#allowanceError').textContent=err.message;}}
    if(e.target.id==='contentOptionForm'){e.preventDefault();try{const data=new FormData(e.target);state=W.editOption(state,user.name,data.get('level'),data.get('value'));changed();contentOptionsDialog();}catch(err){$('#contentOptionError').textContent=err.message;}}
    if(['leadersForm','memberForm','removeMemberForm'].includes(e.target.id)&&!P.canManage(state,user?.name)){e.preventDefault();toast('전체관리자와 팀관리자만 사용할 수 있습니다.');return;}
    if(e.target.id==='postForm'){e.preventDefault();try{const data=Object.fromEntries(new FormData(e.target));state=B.save(state,user.name,data);changed();$('#editor').close();render();toast('게시글을 저장했습니다. 내용 저장으로 공용 파일에 반영하세요.');}catch(err){$('#postError').textContent=err.message;}}
    if(e.target.id==='quickLinksForm'){e.preventDefault();try{if(!P.isOverallAdmin(state,user?.name))throw Error('전체관리자만 설정할 수 있습니다.');const data=new FormData(e.target);state.quickLinks=N.cleanLinks(Array.from({length:4},(_,i)=>({label:data.get('label'+i),url:data.get('url'+i)})).filter(l=>l.label||l.url));changed();$('#editor').close();render();}catch(err){$('#quickLinksError').textContent=err.message;}}
    if(e.target.id==='transferAdminForm'){e.preventDefault();try{const target=new FormData(e.target).get('target'),next=P.transferAdmin(state,user?.name,target);if(!confirm(target+'님에게 전체관리자를 이전하시겠습니까? 본인의 관리 권한은 해제됩니다.'))return;state=next;changed();$('#editor').close();render();toast('전체관리자를 이전했습니다. 내용 저장으로 공용 파일에 반영하세요.');}catch(err){$('#transferAdminError').textContent=err.message;}}
    if(e.target.id==='adminsForm'){e.preventDefault();try{state=P.setTeamAdmins(state,user?.name,new FormData(e.target).getAll('admins'));changed();$('#editor').close();render();toast('팀관리자 지정을 변경했습니다. 내용 저장으로 반영하세요.');}catch(err){$('#adminsError').textContent=err.message;}}
    if(e.target.id==='leaveForm'){e.preventDefault();try{state=P.saveLeave(state,user.name,Object.fromEntries(new FormData(e.target)));changed();$('#editor').close();render();toast('휴가를 등록했습니다. 내용 저장으로 공용 파일에 반영하세요.');}catch(err){$('#leaveError').textContent=err.message;}}
    if(e.target.id==='leadersForm'){e.preventDefault();try{state=P.setLeaders(state,Object.fromEntries(new FormData(e.target)));changed();$('#editor').close();render();toast('팀장 지정을 변경했습니다. 내용 저장으로 공용 파일에 반영하세요.');}catch(err){$('#leadersError').textContent=err.message;}}
    if(e.target.id==='loginForm'){e.preventDefault();signIn(e.target);}
    if(e.target.id==='projectForm'){e.preventDefault();saveProject(e.target);}
    if(e.target.id==='memoForm'){e.preventDefault();try{const d=new FormData(e.target);state=P.savePersonal(state,user.name,{...Object.fromEntries(d),done:d.has('done')});changed();$('#editor').close();render();toast('메모를 임시 저장했습니다. 내용 저장으로 파일에 반영하세요.');}catch(err){$('#memoError').textContent=err.message;}}
    if(e.target.id==='memberForm'){e.preventDefault();try{const d=new FormData(e.target);state=P.addMember(state,d.get('name'),d.get('team'));state.members.find(m=>m.name===d.get('name').trim()).rank=String(d.get('rank')||'').trim().slice(0,30);syncRoster();changed();$('#editor').close();render();toast('인원을 추가했습니다. 내용 저장으로 파일에 반영하세요.');}catch(err){$('#memberError').textContent=err.message;}}
    if(e.target.id==='removeMemberForm'){e.preventDefault();try{const d=new FormData(e.target);if(!d.has('acknowledge'))throw new Error('자료 처리 방식을 확인해 주세요.');if(d.get('name')===user.name)throw new Error('본인의 퇴사 처리는 다른 사용자가 진행해 주세요.');state=P.removeMember(state,d.get('name'),d.get('retention'));syncRoster();changed();$('#editor').close();render();toast('퇴사 처리를 임시 반영했습니다. 내용 저장으로 파일에 반영하세요.');}catch(err){$('#removeError').textContent=err.message;}}
  });
  document.addEventListener('change',async e=>{
    const el=e.target;
    if(el.id==='leaveYear'){if(/^\d{4}$/.test(el.value)&&Number(el.value)>=2000&&Number(el.value)<=2100){leaveYear=el.value;render();}return;}
    if(el.id==='leaveOwner'){leaveOwner=el.value;render();return;}
    if(el.id==='p-taskCategory'){const isContent=el.value==='콘텐츠';for(const [container,input,show] of [['contentCategoryField','p-contentCategory',isContent],['contentTypeField','p-contentType',isContent],['platformField','p-platform',!isContent]]){$('#'+container).hidden=!show;$('#'+input).disabled=!show;$('#'+input).required=show;}}
    if(el.id==='loginTeam'){$('#loginName').innerHTML=options(activeMembers().filter(m=>m.team===el.value).map(m=>m.name),'');await updateLogin();}
    if(el.id==='loginName')await updateLogin();
    if(el.id==='darkMode'){styles.setTheme(el.checked); }
    if(el.dataset.memoToggle){const item=state.personal[user.name].find(i=>i.id===el.dataset.memoToggle);if(item){item.done=el.checked;changed();render();}}
    if(el.dataset.filter){if(el.dataset.filter==='selectedTeam')selectedTeam=el.value;else filters[el.dataset.filter]=el.value;if(filters.from&&filters.to&&filters.from>filters.to)toast('시작 날짜가 종료 날짜보다 늦습니다. 기간을 확인해 주세요.');render();}
    if(el.id==='jsonPicker'&&el.files[0])try{
      const raw=await el.files[0].text();
      if(el.dataset.mode==='import')await importData(raw);
      else{const loaded=C.validateState(JSON.parse(raw));if(dirty&&!confirm('현재 임시 변경사항을 선택한 JSON 자료로 바꾸시겠습니까?'))return;state=P.upgrade(loaded);syncRoster();targetHandle=null;targetDir=null;sourceHandle=null;sourceDir=null;setupDone=false;health={source:false,target:false};diskText=null;dirty=false;user=null;demoSession=false;cacheError='';persist();render();toast('자료를 불러왔습니다. 폴더를 다시 연결해 주세요.');}
    }catch(err){toast('불러오기 실패: '+err.message);}
  });
  let searchTimer;document.addEventListener('input',e=>{if(e.target.dataset.filter==='search'){filters.search=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{const pos=e.target.selectionStart;render();const field=$('[data-filter="search"]');if(field){field.focus();field.setSelectionRange(pos,pos);}},250);}});
  window.addEventListener('beforeunload',e=>{if(dirty&&targetHandle){e.preventDefault();e.returnValue='';}});
  $('#editor').addEventListener('close',()=>{if(dialogOpener?.isConnected)dialogOpener.focus();else $('.heading h1')?.focus();});
  window.addEventListener('focus',()=>{if(user)checkConnections().then(()=>{const bar=$('.workspace-tools');if(bar)bar.outerHTML=connectionBar();});});
  jQuery(()=>{render();restoreFolders().catch(e=>toast('기억된 폴더를 자동 연결하지 못했습니다. '+e.message));});
})();
