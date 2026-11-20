/* Source handles remain read-only. Shared writes use BOARD_FILE and per-session presence files. */
(() => {
  'use strict';
  const N=BoardNavigation,B=BoardTeamPosts,Icons=BoardArrowIcons;
  const C=BoardCore, P=BoardPeople, W=BoardWorkspace, V=BoardVault, O=BoardOrganization, $=s=>document.querySelector(s), BOARD_FILE='통합관리 대시보드.json', CACHE='manager-board-v1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const loadState=raw=>{const validated=C.validateState(raw);if(validated.accountResetVersion!==BoardAccountReset.VERSION)V.forget().catch(()=>{});return P.migrateRoles(BoardAccountReset.apply(validated));};
  let state,cacheError='';
  const emptyState=()=>BoardAccountReset.apply({...C.emptyState(),projects:[],demo:false});
  try{const raw=localStorage.getItem(CACHE);state=raw?loadState(JSON.parse(raw)):emptyState();}catch(e){state=emptyState();cacheError='저장된 임시 데이터를 읽지 못했습니다. 원래 임시 데이터는 덮어쓰지 않습니다. JSON 백업을 불러와 주세요.';}
  let user=null,demoSession=false,page='dashboard',scope='all',customerMode='team',view='board',sourceHandle=null,targetHandle=null,diskText=null,dirty=false,saving=false;
  const privateAvatarOwner='정윤정';
  let privateAvatarSession=null;
  const canUsePrivateAvatar=()=>user?.name===privateAvatarOwner&&!demoSession&&Boolean(privateAvatarSession);
  function displayProfile(person){
    const src=canUsePrivateAvatar()&&person?.name===privateAvatarOwner&&privateAvatarSession.profile?.active&&privateAvatarSession.profile.src;
    return src?{...person,privateAvatarSrc:src}:person;
  }
  async function updatePrivateAvatar(session,profile){
    await V.savePrivateAvatar(session.key,profile);
    if(!canUsePrivateAvatar()||privateAvatarSession!==session)return false;
    session.profile=profile;
    return true;
  }
  function openAvatarPicker(){
    const privateProfile=canUsePrivateAvatar()?privateAvatarSession.profile:undefined;
    const privateControls=canUsePrivateAvatar()?'<section class="private-profile-picker"><h3>전용 프로필</h3><div class="actions">'+
      (privateProfile?'<img width="40" height="40" alt="" src="'+esc(privateProfile.src)+'">'+button('usePrivateAvatar',privateProfile.active?'사용 중':'전용 프로필 사용','',privateProfile.active?'disabled':''):'')+
      button('privateAvatarSettings',privateProfile?'GIF 변경':'전용 GIF 등록')+'</div></section>':'';
    showDialog(D.avatarPicker(user,privateControls));
  }
  try{dirty=localStorage.getItem(CACHE+'-dirty')==='true';}catch{}
  let filters={search:'',status:'',teamFilter:'',customer:'',requester:'',dateField:'due',from:'',to:''};
  let selectedTeam='퍼블',editing=null,taskDraft=[];
  let closedNav=[],closedWeeks=[],closedLanes=[],expandedCards=[];
  let boardName='',boardMode='workflow',boardLayout='cards';
  let boardTeam='all',boardPostId='',userWork='',calendarMonth=C.today().slice(0,7),calendarDay=C.today(),calendarFilter='all';
  const peopleSections={org:'조직도 관리',roles:'직책 관리',members:'멤버 관리'};
  const personnelActions=new Set([
    'manageMembers','addMember','rehire','removeMember','editMemberRank','passwords','resetPassword','adminSettings',
    'rankUp','rankDown','rankEdit','rankDelete','rankAdd','orgEdit','orgAdd','orgLevel','orgInsertLevel','orgDelete','orgMove'
  ]);
  const personnelForms=new Set(['memberForm','memberRankForm','removeMemberForm','adminsForm','rankOrderForm','organizationForm','organizationLevelForm']);
  let peopleSection='org';
  const expenseService=BoardCardExpenses.create({uid:C.uid,isAdmin:P.isOverallAdmin});
  let expenseCardId='',expenseMonth=BoardCardExpenses.today().slice(0,7);
  let scheduleWeekOffset=0,statsQuery={},kpiMode='sample';
  let linkedProject='',selectedProject='',leaveView='table',leaveMonth=C.today().slice(0,7),leaveSearch='';
  let leaveWeekDate=C.today(),leaveSelectedDay='';
  let leaveYear=C.today().slice(0,4),leaveOwner='';
  let sourceDir=null,targetDir=null,pendingSource=null,pendingTeams=null,setupDone=false,deferredConnection=false,health={source:false,target:false},dialogOpener=null;
  state=P.migrateRoles(state);P.upgrade(state);C.setMembers(P.orderedMembers(state));
  let developmentSamples=false;
  const heroDesign=BoardBriefingHero.create(localStorage);let heroDraft=null,heroSecretCount=0,heroSecretTime=0;
  function sourceRows({includeRemoved=false,forReports=false}={}){
    const snapshot=state.sourceSnapshotIds&&new Set(state.sourceSnapshotIds);
    const useWorkflowSamples=demoSession&&forReports&&state.projects.some(project=>project.workflowFixture);
    return state.projects.filter(project=>!state.hiddenProjects?.includes(project.id)&&(demoSession?(!useWorkflowSamples||project.workflowFixture||project.id===linkedProject):project.raw&&(includeRemoved||!snapshot||snapshot.has(project.id))))
      .map(project=>project.raw?{...C.normalize(project.raw),sourceHistory:project.sourceHistory,sampleFixture:project.sampleFixture,sourceAssignments:project.sourceAssignments,sourceRemoved:Boolean(snapshot&&!snapshot.has(project.id))}:C.effective(project));
  }
  const heroRows=()=>sourceRows();
  const reportViews={work:'UI·UX',report:'주간 업무',customers:'고객별',projects:'과업별'};
  let disconnectedSamples;
  function disconnectedWorkflowRows(){
    if(demoSession||sourceHandle||state.projects.some(project=>project.raw)||typeof BoardPreviewData==='undefined')return [];
    disconnectedSamples??=BoardPreviewData.workflowSamples(C).map(project=>({...project,readOnlySample:true}));
    return disconnectedSamples;
  }
  function relatedRows(includeRemoved=false){
    return [...sourceRows({includeRemoved,forReports:true}),...disconnectedWorkflowRows()].filter(project=>!linkedProject||project.id===linkedProject);
  }
  function projectLinks(id){
    if(!id)return '';
    const activeInSource=demoSession||!state.sourceSnapshotIds||state.sourceSnapshotIds.includes(id)||disconnectedWorkflowRows().some(project=>project.id===id);
    return '<div class="related-project-links" role="group" aria-label="같은 과업 보기">'+Object.entries(reportViews).filter(([key])=>key!==page&&(activeInSource||key==='report'||key==='projects')).map(([key,label])=>button('relatedProject',label,'','data-page="'+key+'" data-id="'+esc(id)+'"')).join('')+'</div>';
  }
  function linkedProjectBar(){
    if(!linkedProject||!reportViews[page])return '';
    const project=relatedRows(true)[0];
    return '<div class="linked-project-bar">'+(project?'<strong>'+esc(project.title)+'</strong>':'<strong>연결된 과업</strong>')+projectLinks(linkedProject)+button('clearLinkedProject','전체 목록')+'</div>';
  }
  const heroEditorHTML=()=>BoardBriefingHero.editor({user:displayProfile(user),rows:heroRows(),C,N,esc,record:heroDraft,button});
  const styles=BoardDisplayStyles.create({storage:localStorage,element:document.documentElement});
  window.addEventListener('storage',e=>{if(e.key===BoardDisplayStyles.KEY||e.key==='workplace-theme'||e.key===null){styles.restore();render();}});
  function renderOnlineProfiles(){
    const snapshot=presence.snapshot(),compare=P.nameComparator(state);
    return BoardPresence.render({...snapshot,people:snapshot.people.slice().sort((a,b)=>compare(a.name,b.name))},esc);
  }
  const presence=BoardPresence.create({onChange:()=>{const host=$('#onlineProfiles');if(host)host.innerHTML=renderOnlineProfiles();liveCursors?.paint();}});
  const liveCursors=BoardLiveCursors.create({document,window,getView:()=>page==='work'?JSON.stringify([boardMode,boardLayout,boardName,filters,linkedProject]):'',setCursor:c=>presence.setCursor(c),getPeople:()=>presence.snapshot().people,getUser:()=>user});
  window.addEventListener('pagehide',()=>{presence.stop().catch(()=>{});});
  window.addEventListener('pageshow',()=>{presence.setSession({directory:demoSession?null:targetDir,user:demoSession?null:user,members:state.members}).catch(()=>{});});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)presence.refresh().catch(()=>{});});
  const member=n=>state.members.find(m=>m.name===n);
  const options=(arr,value,empty)=>`${empty!==undefined?`<option value="">${esc(empty)}</option>`:''}${arr.map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(N.teamLabel(v))}</option>`).join('')}`;
  const button=(action,label,cls='',extra='')=>{
    if(personnelActions.has(action)&&!P.isOverallAdmin(state,user?.name))return '';
    if(action==='save'){
      label='<span class="tossface button-icon" aria-hidden="true">💾</span><span>내용 저장</span>';
      extra+=' aria-label="내용 저장'+(dirty?' · 저장 전 변경사항 있음':'')+'" title="'+(dirty?'저장 전 변경사항 있음':'내용 저장')+'"';
    }else if(action==='preferences')label='<span class="tossface button-icon" aria-hidden="true">⚙️</span><span>설정</span>';
    return '<button type="button" data-action="'+action+'" class="'+cls+'" '+extra+'>'+label+'</button>';
  };
  const D=BoardDetailViews.create({C,P,W,B,N,esc,button,options,member:name=>displayProfile(member(name)),weekBlocks,samplePostAvatar:post=>!demoSession&&post.sampleFixture&&typeof BoardPreviewData!=='undefined'?BoardPreviewData.sampleAvatar(post.author):undefined});
  function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',4500);}
  let cacheQueue=Promise.resolve(),cacheGeneration=0;
  function persist(){const generation=++cacheGeneration;if(demoSession)return true;if(cacheError){toast(cacheError);return false;}try{localStorage.setItem(CACHE,JSON.stringify(state));localStorage.setItem(CACHE+'-dirty',String(dirty));localStorage.setItem(CACHE+'-storage','local');return true;}catch(e){if(V.cacheState){const snapshot={state:structuredClone(state),dirty};cacheQueue=cacheQueue.then(()=>V.cacheState(snapshot)).then(()=>{if(generation===cacheGeneration){localStorage.removeItem(CACHE);localStorage.setItem(CACHE+'-storage','indexeddb');}}).catch(()=>toast('첨부파일 임시 저장에 실패했습니다. 내용 저장 또는 JSON 백업으로 보관해 주세요.'));return true;}toast('브라우저 임시 저장에 실패했습니다. JSON 백업으로 보관해 주세요.');return false;}}
  function changed(){dirty=true;persist();}
  function f(){return {...filters,scope,user:user?.name,team:selectedTeam,taskMode:page!=='report'&&view==='sheet'};}
  function projects(){const filter=f();return C.filterProjects(page==='customers'?relatedRows():page==='deadlines'?sourceRows():state.projects,page==='work'&&view==='board'?{...filter,from:'',to:''}:filter);}
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
      user=member(name);page='dashboard';demoSession=false;selectedTeam=user.team;scope='all';
      privateAvatarSession=null;
      if(name===privateAvatarOwner){
        try{privateAvatarSession=await V.unlockPrivateAvatar(password,state.accounts[name].salt);}
        catch{toast('이 브라우저에서 전용 프로필을 열지 못했습니다.');}
      }
      try{if(name!==privateAvatarOwner&&data.get('remember'))await V.remember({name,team:user.team,password});else await V.forget();}catch{toast('이 브라우저에서 로그인 정보를 기억하지 못했습니다. 로그인은 계속 진행합니다.');}
      render();
      await refreshWorkflowSource();
    }catch(e){$('#loginError').textContent=e.message;$('#loginSubmit').disabled=false;}
  }
  function featureContext(){return {state,user,C,P,W,B,N,O,D,T,Icons,esc,button,options,member,displayProfile,activeMembers,showDialog,sourceRows,relatedRows,projects,f,filters,scope,customerMode,view,boardLayout,boardAssignee,selectedProject,statsQuery,targetHandle,demoSession,peopleSection,peopleSections,readOrganization,leaveOwner,leaveYear,leaveMonth,leaveWeekDate,leaveSelectedDay,leaveView,leaveSearch,annualLeavePanel,leaveTypeCards,vacationRows,leaveTypeEditor,weekBlocks,leaveItems,deadlineItems,scheduleWeekOffset,scopeTabs,filterBar,categorizedTable,projectTable,reportRows,customerCards,boardLayoutToggle,page,boardName,boardMode,boardIncludesDone,closedWeeks,closedLanes,expandedCards,calendarMonth,calendarDay,calendarFilter,userWork,viewTabs,taskRows,sheetTable,connectionCards,expenseService,expenseCardId,expenseMonth,heroRows,heroDesign,personalPanel,organizationChart,peopleRoles,personnelPanel,BoardBriefingCalendar,BoardBriefingDashboard,BoardBriefingHero,BoardTaskBoard,BoardProjectReport,BoardCardExpenses,BoardLeaveTypes,BoardLeavePolicy,BoardLeaveCalendar,BoardMemoCarousel,BoardPreviewData:typeof BoardPreviewData!=='undefined'?BoardPreviewData:undefined};}
  function render(){
    if(user?.name!==privateAvatarOwner||demoSession)privateAvatarSession=null;
    if(typeof BoardPreviewData!=='undefined'&&developmentSamples&&!demoSession&&!cacheError){const filled=BoardPreviewData.ensure(state,C,P);if(filled!==state){state=filled;changed();}}
    BoardAvatars.sync(state.customAvatars||[]);
    presence.setSession({directory:demoSession?null:targetDir,user:demoSession?null:user,members:state.members}).catch(()=>{});
    const oldBoard=document.querySelector('.status-board'),boardScroll=oldBoard?{x:oldBoard.scrollLeft,y:oldBoard.scrollTop}:null;
    syncRoster();if(!user){login();return;}user=member(user.name)||user;
    if(page==='people'&&!W.canPersonnel(state,user.name))page='dashboard';
    const titles=N.titles;
    let body=Object.hasOwn(BoardFeaturePages.toys.items,page)?BoardFeaturePages.toys.render({page,esc}):page==='workContent'?'<section class="card"><p class="empty">등록된 '+esc(titles[page])+' 업무가 없습니다.</p></section>':page==='projects'?BoardProjectReport.render({rows:relatedRows(Boolean(selectedProject)),selected:selectedProject,C,N,Board:BoardTaskBoard,members:state.members,esc,button,orderNames:names=>P.orderNames(state,names)}):page==='dashboard'?dashboard():page==='work'||page==='customers'?dashboardContent():page==='users'?userWorkPage():page==='board'?D.board(state,user,boardTeam,boardPostId):page==='cardHistory'?expensePage():page==='today'?D.today(state,user):page==='report'?report():page==='kpi'?BoardKpi.render({rows:relatedRows(),Board:BoardTaskBoard,C,esc,button,mode:kpiMode,samples:typeof BoardKpiSamples!=='undefined'?BoardKpiSamples:undefined}):page==='stats'?statisticsPage():page==='settings'?settings():page==='people'?peoplePage():page==='memo'?personalPanel():page==='schedule'?weeklySchedule():page==='deadlines'?deadlinePage():page==='leaves'?vacationPage():revisionPage();
    $('#app').innerHTML=BoardDisplayStyles.shell('<div class="shell"><aside class="sidebar">'+brand()+'<div class="subbrand">WORK24 × PLACECND</div><nav class="nav" aria-label="주 메뉴">'+N.menu({page,closed:closedNav,canPersonnel:W.canPersonnel(state,user.name),esc,button})+'</nav><div class="sidebar-bottom"><div class="user">'+D.avatar(displayProfile(user))+'<div><strong>'+esc(user.name)+'</strong> <span class="muted">'+esc(user.rank||'직급 미지정')+'</span><div class="muted">'+esc(N.teamLabel(user.team))+' 팀</div></div>'+button('logout','로그아웃')+'</div></div></aside><main class="main"><header class="topbar">'+connectionBar()+'<div class="breadcrumb">WorkLog / <strong>'+titles[page]+'</strong></div><div class="topright">'+(demoSession?'<span class="preview-label">UI/UX 샘플 · 새로고침 시 초기화</span>':'')+'<span id="onlineProfiles">'+renderOnlineProfiles()+'</span><span class="muted topbar-date">'+new Date().toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short'})+'</span>'+button('refreshAll',Icons.arrow('refresh')+' 새로고침')+button('save','내용 저장','primary',saving?'disabled':'')+button('widgets',Icons.arrow('widget'),'topbar-widget','aria-label="바탕화면 위젯 열기" title="바탕화면 위젯"')+button('preferences','⚙ 설정')+'</div></header><div class="content" tabindex="-1"><div class="page-actions">'+(['revisions'].includes(page)?button('export',Icons.arrow('download')+' 엑셀 내보내기'):'' )+'</div>'+linkedProjectBar()+body+'</div></main></div>',styles.current());
    document.documentElement.dataset.boardView=String(page==='work'&&view==='board');
    BoardMemoCarousel.init(document);
    BoardBriefingHero.mount(document);
    liveCursors.paint();
    const newBoard=document.querySelector('.status-board');if(newBoard&&boardScroll){newBoard.scrollLeft=boardScroll.x;newBoard.scrollTop=boardScroll.y;}
  }
  function scopeTabs(){const tabs=[['all','전체'],['team','팀'],['personal','개인']];return `<div class="tabs" role="group" aria-label="조회 범위">${tabs.map(([s,n])=>button('scope',n,scope===s?'active':'',`data-scope="${s}" aria-pressed="${scope===s}"`)).join('')}${scope==='team'?`<select aria-label="조회 팀" data-filter="selectedTeam">${options(P.orderedTeams(state),selectedTeam)}</select>`:''}</div>`;}
  function filterBar(isReport=false){return `<div class="filters"><input class="search" type="search" placeholder="과업명, 담당자, 고객 검색" aria-label="업무 검색" data-filter="search" value="${esc(filters.search)}"><select aria-label="진행상태" data-filter="status">${options(C.STATUSES,filters.status,'전체 상태')}</select><select aria-label="담당팀" data-filter="teamFilter">${options(P.orderedTeams(state),filters.teamFilter,'전체 담당팀')}</select><div class="date-filter">${isReport?'<span>완료요청일</span>':`<select aria-label="기간 기준" data-filter="dateField">${[['due','마감일'],['requestedDue','요청완료일'],['requested','요청일']].map(([v,t])=>`<option value="${v}" ${filters.dateField===v?'selected':''}>${t}</option>`).join('')}</select>`}<input type="date" aria-label="시작 날짜" data-filter="from" value="${filters.from}"><span>–</span><input type="date" aria-label="종료 날짜" data-filter="to" value="${filters.to}">${button('week','이번 주')}${button('clearFilters','초기화')}</div></div>`;}
  function dashboard(){return BoardFeaturePages['home'].dashboard(featureContext());}
  function viewTabs(){return BoardFeaturePages['work'].viewTabs(featureContext());}
  function categorizedTable(rows){return W.group(rows).map(([label,group])=>'<section class="category-group"><h3>'+esc(label.replace(/^퍼블(?= >|$)/,'퍼블리싱'))+' <span class="count">'+group.length+'</span></h3>'+sheetTable(group)+'</section>').join('')||'<p class="empty">조회 조건에 맞는 과업이 없습니다.</p>';}
  const boardAssignee=()=>boardName||(scope==='personal'?user.name:'');
  const boardIncludesDone=()=>true;
  function boardLayoutToggle(){return BoardFeaturePages['work'].boardLayoutToggle(featureContext());}
  function dashboardContent(){return BoardFeaturePages['work'].dashboardContent(featureContext());}

  function projectTable(rows){return T.projects(rows);}
  function taskRows(rows){const tf=f();if(!tf.taskMode){tf.status='';tf.from='';tf.to='';}return rows.flatMap(p=>(p.tasks?.length?p.tasks:[{role:'기타',assignees:p.assignees,started:p.started,due:p.due,status:p.status,notes:p.description}]).filter(t=>C.matchesTask(t,tf)).map(t=>({p,t})));}
  function sheetTable(rows){return T.tasks(taskRows(rows));}
  function customerCards(){return BoardFeaturePages['reports'].customerCards(featureContext());}
  function reportRows(){return C.filterProjects(relatedRows(true),{...f(),from:'',to:''});}
  function report(){return BoardFeaturePages['reports'].report(featureContext());}

  function expensePage(){return BoardFeaturePages['organization/cards'].expensePage(featureContext());}

  function statisticsPage(){return BoardFeaturePages['reports'].statisticsPage(featureContext());}

  function settings(){return BoardFeaturePages['settings'].settings(featureContext());}
  function classificationFields(project){const c=C.classification(project),content=c.taskCategory==='콘텐츠',lists=W.contentOptions(state);return '<fieldset class="full classification-fields"><legend>과업 분류</legend><div class="classification-grid"><div class="field"><label for="p-taskCategory">분류 1</label><select id="p-taskCategory" name="taskCategory" required>'+options(['UX','UI','기획','디자인','퍼블','콘텐츠'],c.taskCategory,'선택하세요')+'</select></div><div class="field" id="contentCategoryField" '+(content?'':'hidden')+'><label for="p-contentCategory">분류 2</label><input id="p-contentCategory" name="contentCategory" list="contentCategories" maxlength="100" value="'+esc(c.contentCategory)+'" '+(content?'required':'disabled')+' placeholder="예: 10월 뉴스레터"><datalist id="contentCategories">'+options(lists.level2,c.contentCategory)+'</datalist></div><div class="field" id="platformField" '+(content?'hidden':'')+'><label for="p-platform">분류 2</label><select id="p-platform" name="platform" '+(content?'disabled':'required')+'>'+options(['PC&MO','PC','MO'],c.platform,'선택하세요')+'</select></div><div class="field" id="contentTypeField" '+(content?'':'hidden')+'><label for="p-contentType">분류 3</label><select id="p-contentType" name="contentType" '+(content?'required':'disabled')+'>'+options([...new Set([...lists.level3,...(c.contentType?[c.contentType]:[])])],c.contentType,'선택하세요')+'</select></div></div><p class="muted">콘텐츠: 월별 주제 / 콘텐츠 유형 · 그 외: PC&MO / PC / MO</p></fieldset>';}

  function moveBoardCard(id,lane,name=boardAssignee()){
    if(!user)return;
    const index=state.projects.findIndex(project=>project.id===id);if(index<0)return;
    state.projects[index]=BoardTaskBoard.move(state.projects[index],lane,name,C,user.name);
    changed();render();toast('목록을 변경했습니다. 공용 파일 반영은 내용 저장을 눌러 주세요.');
  }
  function openWorkflowDetail(id,role=''){
    const original=state.projects.find(project=>project.id===id)||disconnectedWorkflowRows().find(project=>project.id===id);
    if(!original)return;
    const project=C.effective(original),raw=BoardTaskBoard.sourceDetails(project,role);
    const roles=role?[role]:['기획','디자인','퍼블'];
    const compare=P.nameComparator(state);
    const assignments=roles.flatMap(part=>(project.sourceAssignments?.[part]||[]).slice().sort((a,b)=>compare(a.name,b.name)).map(item=>'<li>'+esc(part)+' · '+esc(item.name)+' · 시작일 '+esc(item.started||'기록 없음')+'</li>'));
    if($('#editor').open)$('#editor').close();
    showDialog('<div class="modal-head"><h2>'+esc(raw.title)+'</h2>'+button('close','닫기')+'</div>'
      +'<div class="modal-body workflow-detail"><p>'+esc(raw.customer||'—')+' · 완료요청일: '+esc(raw.requestedDue||'—')+'</p>'
      +'<p>'+esc(raw.status||'상태 미기재')+(role?' · '+esc(role):'')+'</p>'
      +(assignments.length?'<h3>담당자 시작일</h3><ul>'+assignments.join('')+'</ul>':'')
      +(raw.start?'<p>원문 작업시작일자: '+esc(raw.start)+'</p>':'')
      +(raw.end?'<p>작업종료일자: '+esc(raw.end)+'</p>':'')
      +'<h3>고객 작업 내용</h3><pre>'+esc(raw.notes||'기재된 작업 내용이 없습니다.')+'</pre>'+BoardProjectReport.sourceTimeline(original,esc,BoardTaskBoard,state.members)+'</div>'
      +'<div class="modal-foot">'+projectLinks(id)+(project.readOnlySample?'':button('edit','수정','primary','data-id="'+esc(id)+'"'))+'</div>');
  }
  async function refreshWorkflowSource(){
    if(demoSession||!sourceHandle||!user)return;
    const handle=sourceHandle,actor=user.name;
    try{
      if(handle.queryPermission&&await handle.queryPermission({mode:'read'})!=='granted')throw Error('원본 폴더를 다시 연결해 주세요.');
      const input=JSON.parse(await (await handle.getFile()).text());
      if(sourceHandle!==handle||user?.name!==actor)return;
      const result=C.importRows(state,input);
      const previous=new Map(state.projects.filter(project=>project.raw).map(project=>[project.id,project.raw]));
      const ids=result.state.sourceSnapshotIds,sourceIds=new Set(ids);
      if(JSON.stringify(state.sourceSnapshotIds)===JSON.stringify(ids)&&result.state.projects.every(project=>!sourceIds.has(project.id)||JSON.stringify(previous.get(project.id))===JSON.stringify(project.raw)))return;
      state=P.enforceRemovals(result.state);syncRoster();changed();render();
    }catch(error){toast('최신 고객 요청을 읽지 못했습니다. '+error.message);}
  }
  function goToRelatedProject(id,destination){
    if(!Object.hasOwn(reportViews,destination)||state.hiddenProjects?.includes(id))return;
    if(!state.projects.some(project=>project.id===id)&&!disconnectedWorkflowRows().some(project=>project.id===id))return;
    if($('#editor').open)$('#editor').close();
    linkedProject=id;selectedProject=destination==='projects'?id:'';
    page=destination;view=page==='work'?'board':'category';scope='all';boardName='';
    filters={search:'',status:'',teamFilter:'',customer:'',requester:'',dateField:page==='report'?'requestedDue':'due',from:'',to:''};
    closedNav=closedNav.filter(key=>key!==(page==='work'?'work':'reports'));render();
  }
  function boardDetail(id){goToRelatedProject(id,'projects');}
  function openEditor(id,parentId){
    dialogOpener=document.activeElement;
    const original=state.projects.find(p=>p.id===id);editing=original?C.effective(original):{id:C.uid(),source:'manual',title:'',customer:'',requester:'',category1:'',category2:'',requested:C.today(),requestedDue:'',description:'',link:'',logs:[],tasks:[]};
    if(parentId)editing=W.revisionDraft(state,parentId,user.name);
    taskDraft=structuredClone(editing.tasks?.length?editing.tasks:[{id:C.uid(),role:member(user.name)?.team==='콘텐츠'?'디자인':user.team,assignees:editing.assignees?.length?editing.assignees:[user.name],started:C.today(),due:editing.due||'',status:editing.status||'예정',progress:BoardTaskBoard.progress(editing),progressBeforeCompletion:editing.progressBeforeCompletion||0,revisionRequired:Boolean(editing.revisionRequired),revisionProgress:editing.revisionProgress||0,notes:''}]);
    $('#editor').innerHTML=BoardSimpleEditor.render({editing,body:taskForms(),C,esc,button,isExisting:Boolean(original)});
    $('#editor').showModal();
  }
  const canEditTaskProgress=t=>BoardTaskBoard.canProgress(editing.tasks?.find(old=>old.id===t.id)||t,user.name)&&BoardTaskBoard.canProgress(t,user.name);
  function taskForms(){return BoardSimpleEditor.tasks({draft:taskDraft,members:P.orderedMembers(state),orderNames:names=>P.orderNames(state,names),canEdit:canEditTaskProgress,C,Board:BoardTaskBoard,esc,options,button});}
  function collectTasks(){document.querySelectorAll('[data-task-index]').forEach(el=>{const t=taskDraft[Number(el.dataset.taskIndex)];el.querySelectorAll('[data-task-field]').forEach(input=>t[input.dataset.taskField]=input.type==='checkbox'?input.checked:['progress','revisionProgress'].includes(input.dataset.taskField)?Number(input.value):input.value);t.assignees=[...el.querySelectorAll('[data-task-member]:checked')].map(x=>x.dataset.taskMember);});}
  function saveProject(form){
    collectTasks();const data=new FormData(form),values=Object.fromEntries(['title','taskCategory','contentCategory','contentType','platform','customer','requester','requested','requestedDue','description','link'].map(k=>[k,String(data.has(k)?data.get(k):editing[k]||'').trim()]));
    try{
      if(!values.title)throw new Error('과업명을 입력해 주세요.');
      if(data.has('taskCategory'))Object.assign(values,C.cleanClassification(values));
      if(taskDraft.some(t=>!t.assignees.length))throw new Error('각 담당 업무에 담당자를 한 명 이상 선택해 주세요.');
      if(taskDraft.some(t=>t.started&&t.due&&t.started>t.due))throw new Error('마감일은 시작일보다 빠를 수 없습니다.');
      if(data.get('logContent').trim()&&!data.get('logDate'))throw new Error('작업 내역의 작업일을 입력해 주세요.');
      if(values.link && !/^(https?:\/\/|file:\/\/)/i.test(values.link))throw new Error('작업 링크는 http://, https:// 또는 file://로 입력해 주세요.');
      const current=state.projects.find(project=>project.id===editing.id);
      const baseline=current?C.effective(current):null;

      values.tasks=taskDraft.map(task=>{
        const previous=baseline?.tasks?.find(item=>item.id===task.id)||(!baseline?.tasks?.length?baseline:null);
        task=BoardTaskBoard.guardEdit(previous,task,user.name);
        if(previous&&(!BoardTaskBoard.canProgress(previous,user.name)||!BoardTaskBoard.canProgress(task,user.name)))return task;
        if(previous?.status===task.status&&!previous.completedOn)return {...task};
        return {...task,...BoardTaskBoard.completion(previous,task.status,C.today()),progress:C.isComplete(task.status)?100:BoardTaskBoard.progress(task),revisionProgress:task.revisionProgress||0};
      });
      values.assignees=[...new Set(taskDraft.flatMap(t=>t.assignees))];
      values.status=C.effective({...editing,...values,overrides:{}}).status;
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
      const stream=await targetHandle.createWritable({expectedText:diskText});try{await stream.write(serialized);await stream.close();}catch(e){try{await stream.abort();}catch{}throw e;}
      state=next;diskText=targetHandle.modular?await (await targetHandle.getFile()).text():serialized;dirty=false;persist();await rememberFolders();
    }finally{saving=false;}
  }
  async function reload(){if(!targetHandle)return;if(dirty&&!confirm('임시 변경사항을 버리고 저장된 파일을 다시 읽으시겠습니까?'))return;const raw=await (await targetHandle.getFile()).text();const loaded=loadState(JSON.parse(raw));state=P.upgrade(loaded);syncRoster();diskText=raw;dirty=false;user=null;demoSession=false;persist();render();toast('공용 자료를 다시 읽었습니다. 로그인해 주세요.');}
  async function importData(raw){
    if(demoSession)throw new Error('실제 자료를 불러오려면 로그아웃 후 본인 이름으로 로그인해 주세요.');
    const result=C.importRows(state,JSON.parse(raw));state=P.enforceRemovals(result.state);syncRoster();changed();render();toast(`원본에서 ${result.added}건 추가, ${result.updated}건 갱신했습니다. 통합관리 수정 내용은 유지했습니다.`);
  }
  function pickFile(mode){const picker=$('#jsonPicker');picker.value='';picker.dataset.mode=mode;picker.click();}
  async function exportXlsx(){
    let ps=page==='report'?reportRows().filter(project=>{const due=project.requestedDue||project.due;return (!filters.from||due&&due>=filters.from)&&(!filters.to||due&&due<=filters.to);}):page==='revisions'?projects().filter(p=>p.parentProjectId):projects();
    const boardCards=page==='work'&&view==='board'?BoardTaskBoard.cards(ps,boardAssignee(),boardIncludesDone(),C,{from:filters.from,to:filters.to}):null;
    if(boardCards)ps=boardCards.map(card=>card.project);
    const logs=page==='report'?ps.flatMap(project=>BoardProjectReport.history(project).filter(event=>event.source).map(event=>({...event,author:'고객 원본 JSON',project,content:'['+event.kind+'] '+event.content}))):C.reportRows(state.projects,f());
    const rows=boardCards?boardCards.flatMap(card=>card.tasks.map(t=>({p:card.project,t})))
      :taskRows(ps).sort((a,b)=>(view==='category'?W.classificationKey(a.p):a.p.title).localeCompare(view==='category'?W.classificationKey(b.p):b.p.title,'ko'));
    const sheets=[{name:'업무 목록',headers:['분류 1','분류 2','분류 3','과업명','세부유형','담당자','고객명','요청완료일','시작일','마감일','진행상태','비고','고객팀','요청일','담당팀','작업 링크'],widths:[18,20,14,50,14,24,18,16,16,16,14,75,23,16,18,45],rows:rows.map(({p,t})=>[N.teamLabel(C.classification(p).level1),C.classification(p).level2,C.classification(p).level3,p.title,N.teamLabel(t.role),P.orderNames(state,t.assignees).join(', '),p.requester,p.requestedDue,t.started,t.due,t.status,t.notes,p.customer,p.requested,P.orderedTeams(state,[...new Set(t.assignees.map(n=>member(n)?.team).filter(Boolean))]).map(N.teamLabel).join(', '),p.link])},{name:'날짜별 작업 내역',headers:['작업일','과업명','작업자','담당팀','작업 내용','고객팀','고객명'],widths:[16,50,16,16,75,23,18],rows:logs.filter(l=>page==='report'||ps.some(p=>p.id===l.project.id)).map(l=>[l.date,l.project.title,l.author,N.teamLabel(member(l.author)?.team),l.content,l.project.customer,l.project.requester])}];
    download(BoardXlsx.workbook(sheets),`통합관리_${page==='report'?'주간업무':'업무목록'}_${C.today()}.xlsx`);toast(`엑셀을 내보냈습니다. 담당 업무 ${rows.length}개`);
  }
  async function act(el){
    if(el.dataset.action==='memoSlide'){BoardMemoCarousel.move(el);return;}
    const a=el.dataset.action;
    if(demoSession&&['connect','reload','restore','import','sourceFolder','sourceFile','targetFolder','permitFolders','refreshAll','refreshSource','logout','save'].includes(a)){toast('샘플 검토 모드입니다. 변경은 이 화면에서만 유지되며 새로고침하면 초기화됩니다.');return;}
    if(a==='boardMineFromBriefing'){page='work';view='board';boardName=user.name;render();return;}
    if(a==='navSection'){const key=el.dataset.section;closedNav=closedNav.includes(key)?closedNav.filter(x=>x!==key):[...closedNav,key];const children=$('#nav-'+key),closed=closedNav.includes(key);if(children?.classList&&el.setAttribute){children.classList.toggle('is-collapsed',closed);children.inert=closed;children.setAttribute('aria-hidden',String(closed));el.setAttribute('aria-expanded',String(!closed));Icons.setDirection(el,closed?'down':'up');}else render();return;}
    if(a==='toggleCardDetails'){const id=el.dataset.id,open=!expandedCards.includes(id);expandedCards=open?[...expandedCards,id]:expandedCards.filter(x=>x!==id);document.querySelectorAll('[data-card-id]').forEach(card=>{if(card.dataset.cardId!==id)return;card.classList.toggle('is-expanded',open);const details=card.querySelector('.board-card-details'),toggle=card.querySelector('[data-action="toggleCardDetails"]');details.inert=!open;details.setAttribute('aria-hidden',String(!open));toggle.setAttribute('aria-expanded',String(open));Icons.setDirection(toggle,open?'up':'down');});return;}
    if(a==='toggleWeek'){const key=el.dataset.key;closedWeeks=closedWeeks.includes(key)?closedWeeks.filter(x=>x!==key):[...closedWeeks,key];if(!BoardFold.toggle(el,closedWeeks.includes(key)))render();return;}
    if(a==='toggleLane'){const key=el.dataset.key;closedLanes=closedLanes.includes(key)?closedLanes.filter(x=>x!==key):[...closedLanes,key];if(!BoardFold.toggle(el,closedLanes.includes(key)))render();return;}
    if(a==='birthdayInfo'){toast(el.getAttribute?.('title')||'생일을 축하합니다!');return;}
    if(a==='kpiMode'){if(['sample','live'].includes(el.dataset.mode)){kpiMode=el.dataset.mode;render();}return;}
    if(a==='calendarFilter'){calendarFilter=['all','project','memo'].includes(el.dataset.filter)?el.dataset.filter:'all';render();return;}
    if(a==='calendarWeek'){const start=el.dataset.date,end=new Date(start+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+6);const finish=end.toISOString().slice(0,10),events=BoardBriefingCalendar.events(state,user.name,C).filter(item=>(calendarFilter==='all'||item.kind===calendarFilter)&&item.start<=finish&&item.end>=start);showDialog('<div class="modal-head"><h2>'+esc(start)+' ~ '+esc(finish)+'</h2>'+button('close','닫기')+'</div><div class="modal-body calendar-week-list">'+events.map(item=>'<article>'+button(item.kind==='project'?'calendarProject':'calendarMemo',esc(item.title),'project-button','data-id="'+esc(item.id)+'"')+'<small>'+esc(item.start+' ~ '+item.end)+'</small></article>').join('')+'</div>');return;}
    if(a==='calendarProject'||a==='calendarMemo'){$('#editor').close();if(a==='calendarProject')boardDetail(el.dataset.id);else openMemo(el.dataset.id);return;}
    if(a==='calendarMonth'){calendarMonth=BoardBriefingCalendar.shift(calendarMonth,Number(el.dataset.step));calendarDay=calendarMonth+'-01';render();return;}
    if(a==='calendarToday'){calendarDay=C.today();calendarMonth=calendarDay.slice(0,7);render();return;}
    if(a==='calendarDay'){calendarDay=el.dataset.date;render();return;}
    if(a==='newRevision'){openEditor(null,el.dataset.id);return;}
    if(a==='contentOptions'){if(!W.canContent(state,user.name))throw new Error('콘텐츠 분류 관리 권한이 없습니다.');contentOptionsDialog();return;}
    if(a==='removeContentOption'){state=W.editOption(state,user.name,el.dataset.level,el.dataset.value,true);changed();contentOptionsDialog();return;}
    if(a==='homeLayout'){layoutDraft=P.homeOrder(state,user.name);homeLayout();return;}
    if(a==='layoutMove'){const index=layoutDraft.indexOf(el.dataset.key),next=index+Number(el.dataset.direction);if(index>=0&&next>=0&&next<layoutDraft.length){[layoutDraft[index],layoutDraft[next]]=[layoutDraft[next],layoutDraft[index]];homeLayout();}return;}
    if(a==='layoutReset'){layoutDraft=P.homeOrder({},user.name);homeLayout();return;}
    if(a==='layoutSave'){state=P.saveHomeOrder(state,user.name,layoutDraft);changed();$('#editor').close();render();toast('나의 홈 배치 순서를 저장했습니다. 공용 파일 반영은 내용 저장을 눌러 주세요.');return;}
    if(personnelActions.has(a)&&!P.isOverallAdmin(state,user?.name))throw new Error('WorkLog 관리자만 사용할 수 있습니다.');
    if(a==='editQuickLinks'&&!P.isOverallAdmin(state,user?.name))throw new Error('WorkLog 관리자만 사용할 수 있습니다.');
    if(a==='heroMode'){const persisted=heroDesign.setMode(user,el.dataset.mode);render();if(!persisted)toast('선택한 보기는 유지됩니다. 브라우저 저장이 제한되어 새로고침 후에는 복원되지 않을 수 있습니다.');return;}
    if(a==='heroSecret'){const now=Date.now();heroSecretCount=now-heroSecretTime>5000?1:heroSecretCount+1;heroSecretTime=now;if(heroSecretCount>=5){heroSecretCount=0;heroDraft=heroDesign.get(displayProfile(user));showDialog(heroEditorHTML());}return;}
    if(a==='heroPreviewMode'&&heroDraft){heroDraft.mode=el.dataset.mode==='big'?'big':'normal';$('#editor').innerHTML=heroEditorHTML();BoardBriefingHero.mount(document);return;}
    if(a==='heroPalette'&&heroDraft){const palette=BoardBriefingHero.palettes.find(p=>p.id===el.dataset.palette);if(palette){const current=heroDraft[heroDraft.mode];heroDraft[heroDraft.mode]={...BoardBriefingHero.fromPalette(palette,heroDraft.mode),scale:current.scale,x:current.x,y:current.y,rx:current.rx,ry:current.ry,rz:current.rz,flip:current.flip};$('#editor').innerHTML=heroEditorHTML();BoardBriefingHero.mount(document);}return;}
    if(a==='heroSaveMode'&&heroDraft){heroDesign.saveMode(displayProfile(user),heroDraft.mode,heroDraft[heroDraft.mode]);toast((heroDraft.mode==='big'?'대두형':'기본형')+' 설정을 이 사용자·캐릭터에 저장했습니다.');return;}
    if(a==='heroReset'&&heroDraft){heroDraft[heroDraft.mode]=BoardBriefingHero.defaults(displayProfile(user),heroDraft.mode);$('#editor').innerHTML=heroEditorHTML();BoardBriefingHero.mount(document);return;}
    if(a==='relatedProject'){goToRelatedProject(el.dataset.id,el.dataset.page);return;}
    if(a==='allProjects'||a==='clearLinkedProject'){linkedProject='';selectedProject='';render();return;}
    if(a==='leaveView'){
      if(['calendar','table'].includes(el.dataset.view))leaveView=el.dataset.view;
      render();return;
    }
    if(a==='leaveMonth'){
      leaveMonth=el.dataset.step==='today'?C.today().slice(0,7):BoardBriefingCalendar.shift(leaveMonth,Number(el.dataset.step));
      leaveWeekDate=leaveMonth+'-01';leaveSelectedDay='';leaveYear=leaveMonth.slice(0,4);render();return;
    }
    if(a==='leaveWeek'){
      const date=new Date(leaveWeekDate+'T00:00:00Z');
      date.setUTCDate(date.getUTCDate()+Number(el.dataset.step||0)*7);
      leaveWeekDate=el.dataset.step==='today'?C.today():date.toISOString().slice(0,10);
      leaveMonth=leaveWeekDate.slice(0,7);leaveYear=leaveWeekDate.slice(0,4);leaveSelectedDay='';render();return;
    }
    if(a==='leaveDay'){leaveSelectedDay=leaveSelectedDay===el.dataset.date?'':el.dataset.date;render();return;}
    if(a==='leaveMonthDay'){
      if(page!=='leaves'||!/^\d{4}-\d{2}-\d{2}$/.test(el.dataset.date))return;
      const rows=vacationRows().filter(leave=>leave.start<=el.dataset.date&&leave.end>=el.dataset.date);
      showDialog('<div class="modal-head"><h2>'+esc(el.dataset.date)+' 휴가</h2>'+button('close','닫기')+'</div><div class="modal-body leave-day-detail">'+D.leaves(state,user,rows)+'</div>');
      return;
    }
    if(a==='leaveBorrow'){openLeave('','annual',true,leaveOwner||user.name);return;}
    if(a==='leaveAllowance'){
      const ledger=W.leaveLedger(state,leaveOwner,leaveYear);
      showDialog('<div class="modal-head"><h2>연차 총수 설정</h2>'+button('close','닫기')+'</div><form id="allowanceForm"><div class="modal-body">'+
        '<p>'+esc(leaveOwner)+' · '+esc(leaveYear)+'년</p><label class="field" for="allowanceDays">연차 총수 (일)<input name="days" id="allowanceDays" type="number" min="0" max="366" step="0.5" required value="'+
        (ledger.allowance??'')+'"></label><p class="error" id="allowanceError" role="alert"></p></div><div class="modal-foot">'+button('close','취소')+
        '<button class="primary" type="submit">저장</button></div></form>');
      return;
    }
    if(a==='leaveTypeAdd'||a==='leaveTypeEdit'||a==='leaveTypeManage'){
      if(!P.isOverallAdmin(state,user?.name))throw Error('WorkLog 관리자만 휴가 종류를 설정할 수 있습니다.');
      leaveTypeEditor(a==='leaveTypeEdit'?el.dataset.id:a==='leaveTypeManage'?BoardLeaveTypes.all(state)[0]?.id:'');return;
    }
    if(a==='leaveTypeMove'){
      if(!P.isOverallAdmin(state,user?.name))throw Error('WorkLog 관리자만 휴가 종류 순서를 변경할 수 있습니다.');
      const form=$('#leaveTypeForm'),draft=form?.getAttribute?.('id')==='leaveTypeForm'?Object.fromEntries(new FormData(form)):null;
      state=BoardLeaveTypes.move(state,user.name,el.dataset.id,Number(el.dataset.step),P.isOverallAdmin);
      changed();leaveTypeEditor(draft?String(draft.id||''):el.dataset.id,draft);render();return;
    }
    if(a==='leavePolicy'||a==='leavePolicyAdd'||a==='leavePolicyRemove'||a==='leavePolicyStatutory'){
      if(!P.isOverallAdmin(state,user?.name))throw Error('WorkLog 관리자만 연차 정책을 설정할 수 있습니다.');
      const policy=a==='leavePolicy'?structuredClone(BoardLeavePolicy.read(state)):policyFormData($('#leavePolicyForm'));
      if(a==='leavePolicyAdd'){
        if(policy.grants.length>=80)throw Error('근속연수 범위는 최대 80개입니다.');
        const from=(policy.grants.at(-1)?.to||0)+1;
        policy.grants.push({from,to:from,days:Math.max(policy.grants.at(-1)?.days||15,BoardLeavePolicy.statutoryDays(from))});
        if(policy.cap.from<=from)policy.cap.from=from+1;
      }
      if(a==='leavePolicyRemove'){
        policy.grants.splice(Number(el.dataset.index),1);
      }
      if(a==='leavePolicyStatutory')Object.assign(policy,BoardLeavePolicy.statutory());
      leavePolicyEditor(policy);return;
    }
    if(a==='leaveTypeDelete'){
      if(!P.isOverallAdmin(state,user?.name))throw Error('WorkLog 관리자만 휴가 종류를 설정할 수 있습니다.');
      if(!confirm('이 휴가 종류를 카드 목록에서 삭제할까요?'))return;
      state=BoardLeaveTypes.remove(state,user?.name,el.dataset.id,P.isOverallAdmin);
      changed();$('#editor').close();render();return;
    }
    if(a==='leaveTypeRequest'){openLeave('',el.dataset.id);return;}
    if(a==='peopleSection'){
      const section=el.dataset.section;
      if(page!=='people'||!W.canPersonnel(state,user?.name)||!Object.hasOwn(peopleSections,section))return;
      peopleSection=section;
      render();
      $('.people-tabs button.active')?.focus();
      return;
    }
    if(a==='page'){linkedProject='';selectedProject='';if($('#editor').open)$('#editor').close();if(el.dataset.page==='people'&&!W.canPersonnel(state,user.name))throw new Error('인원관리 권한이 없습니다.');page=el.dataset.page;view=page==='work'?'board':'category';if(page==='work')filters={search:'',status:'',teamFilter:'',customer:'',requester:'',dateField:'due',from:'',to:''};scope='all';filters.customer='';filters.requester='';if(page==='report'){filters={search:'',status:'',teamFilter:'',customer:'',requester:'',dateField:'requestedDue',from:'',to:''};}render();if(page==='stats'||Object.hasOwn(reportViews,page))await refreshWorkflowSource();}
    else if(a==='resetStats'){statsQuery={};render();}
    else if(a==='scheduleWeek'){
      scheduleWeekOffset=el.dataset.step==='current'?0:scheduleWeekOffset+(el.dataset.step==='previous'?-1:1);
      render();$('#scheduleWeekHeading')?.focus?.({preventScroll:true});
    }
    else if(a==='scope'){scope=el.dataset.scope;render();}
    else if(a==='view'){view=el.dataset.view;render();}
    else if(a==='boardLayout'){boardLayout=boardLayout==='cards'?'table':'cards';render();}
    else if(a==='boardMode'){boardMode=['workflow','project','status'].includes(el.dataset.mode)?el.dataset.mode:'workflow';render();}
    else if(a==='editBoardTask'){if($('#editor').open)$('#editor').close();openEditor(el.dataset.id);const index=taskDraft.findIndex(task=>task.id===el.dataset.taskId);const field=$('#task-progress-'+Math.max(0,index));field?.scrollIntoView?.({block:'center'});field?.focus?.();}
    else if(a==='workflowDetail')openWorkflowDetail(el.dataset.id,el.dataset.role);
    else if(a==='workflowRelease'){
      const index=state.projects.findIndex(project=>project.id===el.dataset.id);
      if(index<0)throw Error('과업을 찾을 수 없습니다.');
      state.projects[index]=BoardTaskBoard.recordRelease(state.projects[index],el.dataset.taskId,el.dataset.stage,C,user.name);
      changed();render();toast('반영 이력을 기록했습니다. 내용 저장으로 공용 폴더에 반영하세요.');
    }
    else if(a==='reportRefresh'){await refreshWorkflowSource();if(page==='report')render();}
    else if(a==='boardDetail')boardDetail(el.dataset.id);
    else if(a==='boardAdd'){openEditor();const status=BoardTaskBoard.lanes.find(lane=>lane.id===el.dataset.lane)?.statuses[0]||'예정';taskDraft.forEach(task=>task.status=status);$('#taskList').innerHTML=taskForms();}
    else if(a==='boardMine'){boardName=boardName===user.name?'':user.name;render();}
    else if(a==='toggleBoardTask'){
      if(!user)throw new Error('로그인이 필요합니다.');
      const index=state.projects.findIndex(project=>project.id===el.dataset.id);
      if(index<0)throw new Error('과업을 찾을 수 없습니다.');
      const detailOpen=$('#editor').open;
      state.projects[index]=BoardTaskBoard.toggle(state.projects[index],el.dataset.taskId,C,user.name);
      changed();
      render();
      const matching=Array.from(document.querySelectorAll('[data-action="toggleBoardTask"]')).find(
        item=>item.dataset.id===el.dataset.id&&item.dataset.taskId===el.dataset.taskId
      );
      if(detailOpen){$('#editor').close();boardDetail(el.dataset.id);}else (matching||$('#boardName'))?.focus?.();
    }
    else if(a==='customerMode'){customerMode=el.dataset.mode;filters.customer='';filters.requester='';render();}
    else if(a==='customer'){filters[customerMode==='team'?'customer':'requester']=el.dataset.value;render();}
    else if(a==='allCustomers'){filters.customer='';filters.requester='';render();}
    else if(a==='logout'){user=null;demoSession=false;boardName='';peopleSection='org';render();}
    else if(a==='new')openEditor();
    else if(a==='edit'){if($('#editor').open)$('#editor').close();openEditor(el.dataset.id);}
    else if(a==='close')$('#editor').close();
    else if(a==='addTask'){collectTasks();taskDraft.push({id:C.uid(),role:'디자인',assignees:[],status:'예정',started:'',due:'',notes:''});$('#taskList').innerHTML=taskForms();}
    else if(a==='deleteProject'){if(!state.members.some(m=>m.name===user?.name&&m.active!==false))throw Error('로그인이 필요합니다.');const project=state.projects.find(p=>p.id===el.dataset.id);if(!project)throw Error('과업을 찾을 수 없습니다.');if(!confirm('이 과업과 담당 업무를 삭제하시겠습니까?'))return;state.hiddenProjects=[...new Set([...(state.hiddenProjects||[]),project.id])];state.projects=state.projects.filter(p=>p.id!==project.id);changed();$('#editor').close();render();toast('과업을 삭제했습니다. 공용 반영은 내용 저장을 눌러 주세요.');}
    else if(a==='removeTask'){if(!state.members.some(m=>m.name===user?.name&&m.active!==false))throw Error('로그인이 필요합니다.');collectTasks();taskDraft.splice(Number(el.dataset.index),1);$('#taskList').innerHTML=taskForms();}
    else if(a==='week'){setWeek();render();}
    else if(a==='sortWork'){T.toggleSort(el.dataset.sortKey);render();document.querySelector('[data-sort-key="'+el.dataset.sortKey+'"]')?.focus?.();}
    else if(a==='resetBoardDates'){filters.from='';filters.to='';render();$('#boardFrom')?.focus?.();}
    else if(a==='clearFilters'){filters={search:'',status:'',teamFilter:'',customer:'',requester:'',dateField:'due',from:'',to:''};if(page==='work'&&view==='board'){boardName='';}render();}
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
    else if(a==='deleteLeave'){if(confirm('이 휴가 일정을 삭제하시겠습니까?')){state=P.deleteLeave(state,user.name,el.dataset.id);changed();$('#editor').close();render();toast('휴가를 삭제했습니다. 내용 저장으로 파일에 반영하세요.');}}
    else if(a==='permitFolders'){for(const [handle,mode] of [[sourceDir,'read'],[sourceHandle,'read'],[targetDir,'readwrite'],[targetHandle,'readwrite']])if(handle?.requestPermission)await handle.requestPermission({mode});if(await checkConnections())await finishSetup();else{render();toast('허용하지 않은 연결이 있습니다. 연결 버튼으로 다시 선택할 수 있습니다.');}}
    else if(a==='backSetup'){setupDone=false;user=null;render();}
    else if(a==='connections'){await checkConnections();showDialog('<div class="modal-head"><h2>폴더 연결 확인</h2>'+button('close','닫기')+'</div><div class="modal-body">'+connectionCards()+(sourceDir||targetDir?button('permitFolders','기억된 폴더 접근 허용'):'')+'</div>');}
    else if(a==='refreshAll'||a==='refreshSource')await refreshAll();

    else if(a==='widgets'){el.disabled=true;try{await BoardDesktopWidget.launch({location:window.location,fetch:window.fetch.bind(window),open:window.open?.bind(window),rootUrl:typeof BoardPaths!=='undefined'?BoardPaths.root:undefined});toast('위젯을 별도 창으로 열었습니다.');}finally{el.disabled=false;}}
    else if(a==='preferences')preferences();
    else if(a==='addAvatar')showDialog('<div class="modal-head"><h2>캐릭터 추가</h2>'+button('close','닫기')+'</div><form id="addAvatarForm"><div class="modal-body"><div class="field"><label for="avatarName">캐릭터 이름</label><input id="avatarName" name="name" maxlength="40" required></div><div class="field"><label for="avatarFile">캐릭터 이미지</label><input id="avatarFile" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required></div><p>PNG·JPG·WebP 최대 10MB, 움직이는 GIF 최대 2MB. 추가하면 내 캐릭터로 선택되고 핑크 브리핑이 생성됩니다.</p><div id="avatarError" class="error" role="alert"></div></div><div class="modal-foot"><button class="primary" id="avatarSubmit">추가하고 사용</button></div></form>');
    else if(a==='avatarSettings')openAvatarPicker();
    else if(a==='privateAvatarSettings'){
      if(!canUsePrivateAvatar())throw Error('전용 프로필을 사용할 수 없습니다.');
      showDialog('<div class="modal-head"><h2>전용 GIF 등록</h2>'+button('close','닫기')+'</div><form id="privateAvatarForm"><div class="modal-body"><label class="field">GIF 파일<input type="file" name="image" accept="image/gif,.gif" required></label><p>등록한 GIF는 이 브라우저에서 본인에게만 보입니다.</p><div class="error" id="privateAvatarError" role="alert"></div></div><div class="modal-foot"><button class="primary" type="submit">등록하고 사용</button></div></form>');
    }
    else if(a==='usePrivateAvatar'){
      if(!canUsePrivateAvatar()||!privateAvatarSession.profile)throw Error('전용 프로필을 먼저 등록해 주세요.');
      if(await updatePrivateAvatar(privateAvatarSession,{...privateAvatarSession.profile,active:true})){$('#editor').close();render();}
    }
    else if(a==='setAvatar'){
      const owner=user.name;
      if(canUsePrivateAvatar()&&privateAvatarSession.profile?.active&&!(await updatePrivateAvatar(privateAvatarSession,{...privateAvatarSession.profile,active:false})))return;
      if(user?.name!==owner)return;
      state=P.setAvatar(state,owner,el.dataset.avatar);changed();$('#editor').close();render();toast('내 캐릭터를 변경했습니다. 내용 저장으로 공용 파일에 반영하세요.');
    }
    else if(a==='adminSettings')adminSettings();
    else if(a==='orgAdd'||a==='orgEdit')organizationEditor(el.dataset.id,el.dataset.parent);
    else if(a==='orgLevel')organizationLevelEditor(Number(el.dataset.index));
    else if(a==='orgInsertLevel')organizationLevelEditor();
    else if(a==='orgDelete'||a==='orgMove'){
      const chart=readOrganization(),node=chart.nodes.find(item=>item.id===el.dataset.id);
      if(!node)return;
      if(a==='orgDelete'){
        if(!confirm(node.name+' 항목과 하위 항목을 조직도에서 삭제할까요?'))return;
        O.remove(chart,node.id);
      }else{
        const siblings=O.walk(O.forest(chart,activeMembers())).filter(item=>item.parent===node.parent);
        const index=siblings.findIndex(item=>item.id===node.id),step=Number(el.dataset.step);
        if(index<0||Math.abs(step)!==1)return;
        const neighbor=siblings[index+step];
        if(!neighbor)return;
        const from=chart.nodes.indexOf(node),to=chart.nodes.findIndex(item=>item.id===neighbor.id);
        [chart.nodes[from],chart.nodes[to]]=[chart.nodes[to],chart.nodes[from]];
      }
      saveOrganization(chart);
      if(a==='orgMove'){
        const controls=[...document.querySelectorAll('.people-org-sheet [data-action="orgMove"]:enabled')].filter(control=>control.dataset.id===node.id);
        (controls.find(control=>control.dataset.step===el.dataset.step)||controls[0])?.focus();
      }
    }
    else if(a==='rankAdd'||a==='rankEdit')rankEditor(a==='rankEdit'?el.dataset.rank:'');
    else if(['rankUp','rankDown','rankDelete'].includes(a)){
      const ranks=P.ranks(state).map(name=>({old:name,name}));
      const index=ranks.findIndex(rank=>rank.old===el.dataset.rank);
      if(index<0)return;
      if(a==='rankDelete'){
        if(!confirm(ranks[index].name+' 직책을 삭제하시겠습니까? 해당 멤버의 직급은 미지정으로 변경됩니다.'))return;
        ranks.splice(index,1);
      }else{
        const next=index+(a==='rankUp'?-1:1);
        if(next<0||next>=ranks.length)return;
        [ranks[index],ranks[next]]=[ranks[next],ranks[index]];
      }
      saveRanks(ranks);
      $('.people-tabs button.active')?.focus();
    }
    else if(a==='editQuickLinks')quickLinksDialog();
    else if(a==='expenseSelectCard'){expenseCardId=el.dataset.id;render();}
    else if(a==='expenseAddCard'||a==='expenseExtra'||a==='expenseEditCard'){
      if(!expenseService.canBudget(state,user.name))throw Error('관리자만 월 금액을 설정할 수 있습니다.');
      const data=state.cardExpenses||BoardCardExpenses.empty(),card=data.cards.find(item=>item.id===el.dataset.id);
      if(a==='expenseExtra'&&!card)throw Error('카드 종류를 찾을 수 없습니다.');
      showDialog(a==='expenseExtra'?BoardCardExpenses.extraForm({data,card,month:expenseMonth,esc,button}):
        BoardCardExpenses.cardForm({data,card:a==='expenseEditCard'?card:undefined,month:expenseMonth,esc,button}));
    }
    else if(a==='expenseAddEntry'||a==='expenseEditEntry'){
      const data=state.cardExpenses||BoardCardExpenses.empty(),entry=a==='expenseEditEntry'?data.entries.find(item=>item.id===el.dataset.id):null;
      if(a==='expenseEditEntry'&&(!entry||!expenseService.canEdit(state,user.name,entry)))throw Error('이 사용 내역을 수정할 수 없습니다.');
      if(!data.cards.length)throw Error('카드 종류가 등록되면 카드 사용내역을 추가할 수 있습니다.');
      showDialog(BoardCardExpenses.entryForm({data,entry,cardId:el.dataset.id,month:expenseMonth,actor:user.name,esc,button}));
    }
    else if(a==='expenseDeleteEntry'){
      if(!confirm('이 사용 내역을 삭제하시겠습니까?'))return;
      state=expenseService.removeEntry(state,user.name,el.dataset.id);changed();$('#editor').close();render();
    }
    else if(a==='boardTeam'){if(!B.TABS.some(([key])=>key===el.dataset.team))return;boardTeam=el.dataset.team;render();}
    else if(a==='postDetail'){
      const post=B.boardPosts(state,user.name,boardTeam).find(item=>item.id===el.dataset.id);
      if(!post)throw Error('게시글을 볼 권한이 없습니다.');
      const list=$('.bulletin-table-wrap');
      const top=list?.scrollTop||0,left=list?.scrollLeft||0;
      boardPostId=post.id;render();
      const active=document.querySelector('[data-action="postDetail"][aria-pressed="true"]');
      active?.focus?.({preventScroll:true});
      const nextList=$('.bulletin-table-wrap');if(nextList){nextList.scrollTop=top;nextList.scrollLeft=left;}
    }
    else if(a==='newPost'||a==='editPost')showDialog(D.postForm(state,user,boardTeam==='common'||B.canRead(state,user.name,boardTeam)?boardTeam:user.team,el.dataset.id));
    else if(a==='editComment'){
      const post=state.teamPosts?.find(post=>post.id===el.dataset.id),comment=post?.comments?.find(item=>item.id===el.dataset.commentId);
      if(!comment||comment.author!==user.name||!B.canViewPost(state,user.name,post)||post.comments.some(item=>item.parentId===comment.id))throw Error('답글 없는 본인 댓글만 수정할 수 있습니다.');
      showDialog('<div class="modal-head"><h2>댓글 수정</h2>'+button('close','닫기')+'</div><form id="editCommentForm"><div class="modal-body"><input type="hidden" name="id" value="'+esc(post.id)+'"><input type="hidden" name="commentId" value="'+esc(comment.id)+'"><label class="field">댓글<input name="content" maxlength="2000" required value="'+esc(comment.content)+'"></label><p id="editCommentError" class="error" role="alert"></p></div><div class="modal-foot">'+button('close','취소')+'<button class="primary">저장</button></div></form>');
    }
    else if(a==='deletePost'){if(confirm('게시글을 삭제하시겠습니까?')){state=B.remove(state,user.name,el.dataset.id);changed();$('#editor').close();render();}}
    else if(a==='userWork'){userWork=el.dataset.name||'';render();}
    else if(a==='passwords')passwordSettings();
    else if(a==='resetPassword'){const name=el.dataset.name;if(!confirm(name+'님의 비밀번호를 초기화할까요? 내용 저장 후 해당 팀원은 새 비밀번호를 설정해야 합니다.'))return;state=P.resetPassword(state,user.name,name);changed();try{if((await V.recall())?.name===name)await V.forget();}catch{}passwordSettings();toast('비밀번호를 임시 초기화했습니다. 내용 저장으로 공용 파일에 반영하세요.');}
    else if(a==='seedSamples'){if(typeof P.addSamples!=='function')throw Error('개발 샘플 모듈이 없습니다.');state=P.addSamples(state);changed();if($('#editor').open)$('#editor').close();render();toast('샘플 프로젝트·일정·휴가·메모를 추가했습니다. 공용 파일에는 아직 저장하지 않았습니다.');}
    else if(a==='manageMembers'){$('#editor').close();page='people';peopleSection='members';render();}
    else if(a==='newMemo')openMemo();
    else if(a==='editMemo')openMemo(el.dataset.id);
    else if(a==='deleteMemo'){if(confirm('이 메모·일정을 삭제하시겠습니까?')){state.personal[user.name]=state.personal[user.name].filter(i=>i.id!==el.dataset.id);changed();$('#editor').close();render();}}
    else if(a==='editMemberRank')editMemberRankDialog(el.dataset.name);
    else if(a==='addMember')addMemberDialog();
    else if(a==='rehire')addMemberDialog(el.dataset.name);
    else if(a==='removeMember')removeMemberDialog(el.dataset.name);
    else if(a==='forgetLogin'){await V.forget();if($('#loginPassword'))$('#loginPassword').value='';toast('이 브라우저에 저장된 로그인 정보를 지웠습니다.');}
  }
  function brand(){return '<div class="brand"><img src="'+esc(window.BoardPaths?window.BoardPaths.asset('source/images/logo.svg'):'../images/logo.svg')+'" width="40" height="40" alt=""><span>WorkLog</span></div>';}
  function syncRoster(){P.upgrade(state);C.setMembers(state.members);}
  const activeMembers=()=>P.orderedMembers(state).filter(m=>m.active!==false);
  function setup(){
    $('#app').innerHTML=`<main class="login"><div class="setup-box">${brand()}<p class="eyebrow">WORK24 × PLACECND</p><h1>업무 공간을 연결해 주세요</h1><p class="setup-description">원본은 읽기 전용으로, 변경사항은 별도 통합관리 파일에 저장합니다.<br>폴더 연결을 마치면 로그인할 수 있습니다.</p>${cacheError?`<p class="error">${esc(cacheError)}</p>`:''}${connectionCards()}<div class="setup-footer"><p id="setupStatus" role="status">${connectionReady()?'모든 연결을 확인했습니다. 로그인으로 이동할 수 있습니다.':'원본 자료 폴더, 요청관리 JSON, 저장 폴더를 모두 연결해 주세요.'}</p>${button('finishSetup','연결 확인하고 로그인','primary',connectionReady()?'':'disabled')}</div><p class="muted">기준 자료 폴더: Z:\\고용24 디자인파트 요청관리\\디자인파트요청관리\\<br>요청관리.json의 위치와 Y 드라이브의 저장 폴더는 직접 선택합니다.</p>${!window.showDirectoryPicker?'<p class="error">현재 브라우저에서는 폴더 연결을 지원하지 않습니다. 이 프로그램의 index.html을 데스크톱 Edge 또는 Chrome에서 열어 주세요.</p>':''}</div></main>`;
  }
  function connectionReady(){return Boolean(sourceDir&&sourceHandle&&targetDir&&targetHandle&&health.source&&health.target);}
  function setupExtras(){const footer=$('.setup-footer');if(footer)footer.insertAdjacentHTML('afterend',`<div class="setup-secondary">${sourceDir||targetDir?button('permitFolders','기억된 폴더 접근 허용'):''}${button('skipSetup','연결은 나중에, 로그인 먼저','black-button')}<p class="muted">연결 전에는 이 브라우저에 임시 저장됩니다. 공용 저장은 로그인 후 폴더를 연결해 주세요.</p></div>`);}
  async function rememberFolders(){try{await V.rememberConnections({sourceDir,sourceHandle,targetDir,targetHandle:targetHandle?.modular?null:targetHandle,modular:!!targetHandle?.modular,lastDiskText:diskText});}catch{toast('이 브라우저에서 폴더 연결을 기억하지 못했습니다. 다음 실행 때 다시 선택해 주세요.');}}
  async function restoreFolders(){
    const saved=await V.recallConnections();if(!saved||setupDone||user)return;
    sourceDir=saved.sourceDir||null;sourceHandle=saved.sourceHandle||null;targetDir=saved.targetDir||null;targetHandle=targetDir?.getDirectoryHandle?null:saved.targetHandle||null;diskText=saved.lastDiskText??null;
    if(await checkConnections()){
      const raw=await (await targetHandle.getFile()).text();
      if(dirty&&diskText!==raw){render();toast('기억된 폴더를 찾았지만 공용 파일이 변경되었습니다. 임시 자료를 백업한 뒤 저장 폴더를 다시 연결해 주세요.');return;}
      if(!dirty&&raw.trim()){state=P.upgrade(loadState(JSON.parse(raw)));syncRoster();}
      diskText=raw;await finishSetup();toast('이전에 연결한 폴더를 자동으로 연결했습니다.');
    }else render();
  }
  function connectionCards(){return `<div class="connection-grid"><section class="connect-card"><span class="step-number">01</span><h2>원본 자료 · 읽기 전용</h2><p>프로젝트 자료와 팀관리 JSON이 있는 폴더를 선택하세요.</p><div class="connection-line"><span>${sourceDir?esc(sourceDir.name):'자료 폴더 미연결'}</span>${button('sourceFolder',sourceDir?'폴더 재연결':'Z 자료 폴더 연결')}</div><div class="connection-line"><span>${sourceHandle&&health.source?'요청관리.json 연결됨':'요청관리 JSON 미연결'}</span>${button('sourceFile',sourceHandle?'JSON 재연결':'요청관리 JSON 선택')}</div><p class="muted">요청관리.json은 다른 위치에 있어도 별도로 선택할 수 있습니다.</p></section><section class="connect-card"><span class="step-number">02</span><h2>통합관리 · 읽기 및 저장</h2><p>Y 드라이브에서 통합관리 데이터를 보관할 폴더를 선택하세요.</p><div class="connection-line"><span>${targetDir&&health.target?esc(targetDir.name):'저장 폴더 미연결'}</span>${button('connect',targetDir?'폴더 재연결':'Y 저장 폴더 연결')}</div><p class="muted">저장 위치: process/ (공용 업무) · save/users/ (개인별 데이터)<br>선택한 폴더에 기존 파일이 있으면 그 자료를 불러옵니다.</p></section></div>`;}
  async function login(){
    if(!setupDone){setup();setupExtras();return;}
    syncRoster();const members=activeMembers();
    let remembered=null;try{remembered=await V.recall();}catch{}
    const previous=members.find(m=>m.name===remembered?.name),chosen=previous||members[0];
    if(!chosen){toast('로그인 가능한 인원이 없습니다. 통합관리 자료를 확인해 주세요.');setupDone=false;setup();return;}
    $('#app').innerHTML=`<main class="login"><div class="login-box">${brand()}<p class="eyebrow">WORK24 × PLACECND</p><h1>함께 만드는 업무 공간</h1><p>연결을 마쳤습니다. 팀과 이름을 선택해 주세요.</p><div class="login-connected">✓ 원본 읽기 연결 &nbsp;·&nbsp; ✓ 통합관리 저장 연결</div><form id="loginForm"><div class="field"><label for="loginTeam">팀</label><select id="loginTeam" name="team">${options(P.orderedTeams(state),chosen.team)}</select></div><div class="field"><label for="loginName">이름</label><select id="loginName" name="name">${options(members.filter(m=>m.team===chosen.team).map(m=>m.name),chosen.name)}</select></div><div class="field"><label for="loginPassword">비밀번호</label><input type="password" id="loginPassword" name="password" required minlength="6" autocomplete="off" placeholder="비밀번호 6자 이상"></div><div class="field" id="confirmField" hidden><label for="confirmPassword">비밀번호 확인</label><input type="password" id="confirmPassword" name="confirm" autocomplete="new-password" placeholder="처음 설정할 비밀번호를 다시 입력"></div><p id="loginHint"></p><label class="remember-check"><input type="checkbox" name="remember" checked> 이 브라우저에 로그인 정보 기억</label><p class="muted">현재 PC의 이 브라우저에만 보관합니다. 공용 JSON에 비밀번호를 저장하지 않습니다.</p><div class="error" id="loginError" role="alert"></div><button class="primary wide" id="loginSubmit">로그인</button></form><div class="login-links">${button('forgetLogin','저장된 로그인 정보 지우기')}${button('backSetup','폴더 연결 확인')}</div><p class="muted">공용 파일의 사용자 구분을 위한 로그인입니다.</p></div></main>`;
    if(deferredConnection){$('.login-connected').textContent='연결 전 · 이 브라우저에 임시 저장됩니다';$('.login-box h1 + p').textContent='팀과 이름을 선택하세요. 폴더는 로그인 후 연결할 수 있습니다.';}
    await updateLogin(remembered);
  }
  async function updateLogin(remembered){
    const name=$('#loginName')?.value;$('#loginSubmit').disabled=!name;if(!name){$('#loginPassword').value='';$('#confirmField').hidden=true;$('#confirmPassword').required=false;$('#loginHint').textContent='이 팀에 재직자가 없습니다. 다른 팀을 선택하세요.';return;}
    const existing=Boolean(state.accounts[name]);$('#confirmField').hidden=existing;$('#confirmPassword').required=!existing;$('#confirmPassword').value='';$('#loginPassword').value='';
    $('#loginPassword').autocomplete=existing?'off':'new-password';
    $('#loginHint').textContent=existing?'기억된 정보를 확인하고 로그인하세요.':'최초 로그인입니다. 사용할 비밀번호를 설정해 주세요.';
    $('#loginSubmit').textContent=existing?'로그인':'비밀번호 설정하고 시작';
    const rememberBox=$('#loginForm')?.querySelector?.('[name="remember"]');
    if(rememberBox){rememberBox.disabled=name===privateAvatarOwner;if(rememberBox.disabled)rememberBox.checked=false;}
    if(name===privateAvatarOwner)return;
    try{const saved=remembered||await V.recall();if(existing&&saved?.name===name&&$('#loginName')?.value===name)$('#loginPassword').value=saved.password;}catch{}
  }
  function connectionBar(){return D.connection(health);}
  let layoutDraft=[];

  function homeLayout(){const labels={memo:'메모 & 일정',thisWeek:'이번 주 일정',nextWeek:'다음 주 일정',deadlines:'프로젝트 마감',leaves:'휴가 일정',work:'업무 현황·목록'};showDialog(`<div class="modal-head"><h2>나의 홈 배치 순서</h2>${button('close','닫기')}</div><div class="modal-body"><p>위에서 아래, 왼쪽에서 오른쪽 순서입니다. 다른 팀원의 배치는 바뀌지 않습니다.</p>${layoutDraft.map((key,i)=>`<div class="connection-line"><strong>${i+1}. ${labels[key]}</strong><div>${button('layoutMove',Icons.arrow('up')+' 위로','',`data-key="${key}" data-direction="-1" ${i===0?'disabled':''}`)}${button('layoutMove',Icons.arrow('down')+' 아래로','',`data-key="${key}" data-direction="1" ${i===layoutDraft.length-1?'disabled':''}`)}</div></div>`).join('')}</div><div class="modal-foot">${button('layoutReset','기본 순서')}${button('close','취소')}${button('layoutSave','배치 저장','primary')}</div>`);}
  function weekBlocks(date,done=false){if(!date)return '';const r=P.weekRemaining(date),past=date<C.today(),filled=past?P.weekRemaining(C.today(),date).filled:r.filled;return '<div class="week-countdown '+(done?'is-complete':past?'overdue':date===C.today()?'due-today':'upcoming')+'" aria-label="'+esc(done?'완료':P.dday(date))+'"><strong>'+(done?'완료':P.dday(date))+'</strong><div class="week-blocks" aria-hidden="true">'+Array.from({length:7},(_,i)=>'<span class="'+(!done&&i<filled?'filled':'')+'"></span>').join('')+'</div></div>';}
  function weeklySchedule(){return BoardFeaturePages['schedule'].weeklySchedule(featureContext());}

  function openLeave(id,typeId,borrowNextYear=false,owner=user.name){return BoardFeaturePages['organization/leaves'].openLeave(featureContext(),id,typeId,borrowNextYear,owner);}
  function leaveList(){return BoardFeaturePages['organization/leaves'].leaveList(featureContext());}
  function rankEditor(rank){return BoardFeaturePages['organization/people'].rankEditor(featureContext(),rank);}
  function saveRanks(ranks,close=false){
    state=P.setRanks(state,user?.name,ranks);
    syncRoster();
    changed();
    if(close)$('#editor').close();
    render();
    toast('직책을 변경했습니다. 내용 저장으로 공용 반영하세요.');
  }
  function adminSettings(){return BoardFeaturePages['organization/people'].adminSettings(featureContext());}
  function passwordSettings(){showDialog(`<div class="modal-head"><h2>개별 비밀번호 초기화</h2>${button('close','닫기')}</div><div class="modal-body"><p>초기화 후 내용 저장을 누르면 기존 비밀번호가 해제됩니다. 해당 팀원은 다음 로그인에서 새 비밀번호를 설정합니다.</p>${activeMembers().map(m=>`<div class="connection-line"><span>${esc(N.teamLabel(m.team))} · ${esc(m.name)}${state.accounts[m.name]?'':' · 최초 설정 대기'}</span>${button('resetPassword','비밀번호 초기화','danger',`data-name="${esc(m.name)}" ${!state.accounts[m.name]?'disabled':''}`)}</div>`).join('')}</div><div class="modal-foot">${button('close','닫기')}</div>`);}
  function deadlineItems(rows){return rows.map(p=>'<article class="agenda-item"><div>'+button('boardDetail',esc(p.title),'project-button','data-id="'+esc(p.id)+'"')+'<small>'+esc(p.due)+' · '+esc(P.orderNames(state,p.assignees).join(', '))+'</small></div>'+weekBlocks(p.due,C.isComplete(p.status))+'</article>').join('')||'<p class="empty">예정된 마감이 없습니다.</p>';}
  function leaveItems(rows){return rows.map(l=>'<article class="agenda-item"><div><strong>'+esc(l.owner)+' · '+esc(l.type)+'</strong><small>'+esc(l.start)+' ~ '+esc(l.end)+'</small>'+(P.canEditLeave(state,user.name,l.owner)?button('editLeave','편집','','data-id="'+esc(l.id)+'"'):'')+'</div>'+weekBlocks(l.start)+'</article>').join('')||'<p class="empty">등록된 휴가가 없습니다.</p>';}
  function deadlinePage(){return BoardFeaturePages['schedule'].deadlinePage(featureContext());}
  function vacationRows(){return BoardFeaturePages['organization/leaves'].vacationRows(featureContext());}
  function vacationPage(){return BoardFeaturePages['organization/leaves'].vacationPage(featureContext());}
  const readOrganization=()=>P.organization(state,state.members,N.teamLabel);
  function saveOrganization(chart){
    O.validate(chart,C.TEAMS);
    state.organizationChart=chart;
    changed();
    if($('#editor').open)$('#editor').close();
    render();
    toast('조직도를 변경했습니다. 공용 반영은 내용 저장을 눌러 주세요.');
  }
  function organizationChart(members){return BoardFeaturePages['organization/people'].organizationChart(featureContext(),members);}
  function organizationEditor(id,parent){return BoardFeaturePages['organization/people'].organizationEditor(featureContext(),id,parent);}
  function organizationLevelEditor(index){return BoardFeaturePages['organization/people'].organizationLevelEditor(featureContext(),index);}
  function peopleRoles(members){return BoardFeaturePages['organization/people'].peopleRoles(featureContext(),members);}
  function peoplePage(){return BoardFeaturePages['organization/people'].peoplePage(featureContext());}
  function revisionPage(){return BoardFeaturePages['reports'].revisionPage(featureContext());}
  function revisionLinks(project){const rootId=project.parentProjectId||project.id,root=state.projects.find(p=>p.id===rootId),children=state.projects.filter(p=>p.parentProjectId===rootId).map(C.effective);if(!root)return '';return '<section class="revision-links"><h2>수정작업 연결</h2>'+(project.parentProjectId?'<p>원본 과업: '+button('boardDetail',esc(C.effective(root).title),'project-button','data-id="'+esc(rootId)+'"')+'</p>':'')+button('newRevision','＋ 수정작업 추가','','data-id="'+esc(rootId)+'"')+children.map(p=>'<div class="connection-line">'+button('boardDetail',esc(p.title),'project-button','data-id="'+esc(p.id)+'"')+badge(p.status)+weekBlocks(p.due,C.isComplete(p.status))+'</div>').join('')+'</section>';}
  function contentOptionsDialog(){const lists=W.contentOptions(state);showDialog('<div class="modal-head"><h2>콘텐츠 선택 항목 관리</h2>'+button('close','닫기')+'</div><div class="modal-body"><p>제거한 항목도 기존 과업에 저장된 값은 유지됩니다.</p>'+Object.entries(lists).map(([level,items])=>'<h3>'+(level==='level2'?'분류 2 · 월별 주제':'분류 3 · 콘텐츠 유형')+'</h3>'+items.map(value=>'<div class="connection-line"><span>'+esc(value)+'</span>'+button('removeContentOption','항목 제거','danger','data-level="'+level+'" data-value="'+esc(value)+'"')+'</div>').join('')).join('')+'<form id="contentOptionForm"><div class="form-grid"><div class="field"><label for="optionLevel">분류</label><select name="level" id="optionLevel"><option value="level2">분류 2</option><option value="level3">분류 3</option></select></div><div class="field"><label for="optionValue">추가할 항목</label><input id="optionValue" name="value" required maxlength="100"></div></div><button type="submit" class="primary">항목 추가</button><div class="error" id="contentOptionError"></div></form></div>');}
  function annualLeavePanel(){if(!activeMembers().some(person=>person.name===leaveOwner&&(person.name===user.name||P.canManage(state,user.name))))leaveOwner=user.name;return BoardFeaturePages['organization/leaves'].annualLeavePanel(featureContext());}
  function leaveTypeCards(){return BoardFeaturePages['organization/leaves'].leaveTypeCards(featureContext());}
  function leaveTypeEditor(id,draft){return BoardFeaturePages['organization/leaves'].leaveTypeEditor(featureContext(),id,draft);}
  function policyFormData(form){
    const data=new FormData(form),count=Number(data.get('count')),hires={...BoardLeavePolicy.read(state).hires};
    if(!Number.isInteger(count)||count<0||count>80)throw Error('근속연수 범위를 확인하세요.');
    const memberCount=Number(data.get('members'));
    if(!Number.isInteger(memberCount)||memberCount<0||memberCount>state.members.length)throw Error('적용 멤버 목록을 확인하세요.');
    for(let index=0;index<memberCount;index++){
      const name=String(data.get('hireName'+index)||''),date=String(data.get('hire'+index)||'');
      if(name){if(date)hires[name]=date;else delete hires[name];}
    }
    return {version:2,enabled:data.has('enabled'),grants:Array.from({length:count},(_,index)=>({
      from:Number(data.get('from'+index)),to:Number(data.get('to'+index)),days:Number(data.get('days'+index))
    })),cap:{from:Number(data.get('capFrom')),days:Number(data.get('capDays'))},firstYear:{mode:data.get('firstYearMode')||'monthly',days:Number(data.get('firstYearDays')||11)},hires};
  }
  function leavePolicyEditor(policy){return BoardFeaturePages['organization/leaves'].leavePolicyEditor(featureContext(),policy);}
  function personalPanel(){return BoardFeaturePages['memo'].personalPanel(featureContext());}
  function showDialog(content){dialogOpener=document.activeElement;$('#editor').innerHTML=content;$('#editor').showModal();BoardBriefingHero.mount(document);}
  function openMemo(id){return BoardFeaturePages['memo'].openMemo(featureContext(),id);}
  function personnelPanel(members){return BoardFeaturePages['organization/people'].personnelPanel(featureContext(),members);}
  function editMemberRankDialog(name){return BoardFeaturePages['organization/people'].editMemberRankDialog(featureContext(),name);}
  function addMemberDialog(name=''){return BoardFeaturePages['organization/people'].addMemberDialog(featureContext(),name);}
  function removeMemberDialog(name){return BoardFeaturePages['organization/people'].removeMemberDialog(featureContext(),name);}
  function userWorkPage(){return BoardFeaturePages['reports'].userWorkPage(featureContext());}
  function quickLinks(){let links;try{links=N.cleanLinks(state.quickLinks||N.defaults);}catch{links=N.defaults;}return '<div class="quick-links" aria-label="사이트 바로가기">'+links.map(l=>l.url?'<a href="'+esc(l.url)+'" target="_blank" rel="noopener noreferrer">'+esc(l.label)+' '+Icons.arrow('external')+'</a>':'<span class="unconfigured">'+esc(l.label)+' · 주소 미등록</span>').join('')+(P.isOverallAdmin(state,user.name)?button('editQuickLinks','주소 설정'):'')+'</div>';}
  function quickLinksDialog(){const links=state.quickLinks||N.defaults;showDialog('<div class="modal-head"><h2>사이트 바로가기</h2>'+button('close','닫기')+'</div><form id="quickLinksForm"><div class="modal-body"><p>상단에 표시할 사이트를 최대 4개까지 등록하세요.</p>'+Array.from({length:4},(_,i)=>'<div class="link-fields"><input name="label'+i+'" aria-label="사이트 '+(i+1)+' 이름" placeholder="사이트 이름" maxlength="40" value="'+esc(links[i]?.label||'')+'"><input name="url'+i+'" aria-label="사이트 '+(i+1)+' 주소" placeholder="https://..." value="'+esc(links[i]?.url||'')+'"></div>').join('')+'<div id="quickLinksError" class="error"></div></div><div class="modal-foot"><button class="primary">바로가기 저장</button></div></form>');}
  function preferences(){return BoardFeaturePages['settings'].preferences(featureContext());}

  async function checkConnections(){
    async function readable(handle,mode){if(!handle)return false;try{return !handle.queryPermission||await handle.queryPermission({mode})==='granted';}catch{return false;}}
    if(!targetHandle&&targetDir&&await readable(targetDir,'readwrite'))targetHandle=await BoardModularSave.open(targetDir);
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
    const handle=await BoardModularSave.open(directory),existing=await (await handle.getFile()).text(),loaded=existing.trim()?P.upgrade(loadState(JSON.parse(existing))):null;
    if(loaded&&dirty&&!confirm('현재 임시 변경사항을 연결할 통합관리 파일의 자료로 바꾸시겠습니까? 취소 후 JSON 백업을 받을 수 있습니다.'))return;
    if(loaded){state=loaded;dirty=false;cacheError='';user=null;setupDone=false;}
    targetDir=directory;targetHandle=handle;diskText=existing;health.target=true;syncRoster();persist();await rememberFolders();if($('#editor').open)$('#editor').close();render();toast('통합관리 저장 폴더를 연결했습니다.');
  }
  async function finishSetup(){
    if(!await checkConnections()){render();throw new Error('연결되지 않은 폴더 또는 JSON을 다시 연결해 주세요.');}
    const current=await (await targetHandle.getFile()).text();if(current!==diskText){if(dirty)throw new Error('공용 자료가 변경되었습니다. 임시 자료를 백업한 뒤 저장 폴더를 다시 연결하세요.');if(current.trim()){state=P.upgrade(loadState(JSON.parse(current)));syncRoster();}diskText=current;}
    const raw=await (await sourceHandle.getFile()).text();const result=C.importRows(state,JSON.parse(raw));state=P.enforceRemovals(result.state);if(pendingTeams)state.customerTeams=pendingTeams;pendingSource=null;syncRoster();changed();setupDone=true;deferredConnection=false;user=null;await rememberFolders();render();
  }
  async function refreshAll(){
    if(!await checkConnections()){render();throw new Error('연결이 끊겼습니다. 폴더 재연결에서 다시 연결해 주세요.');}
    const raw=await (await targetHandle.getFile()).text();let base=state;
    if(raw!==diskText){if(dirty)throw new Error('공용 파일과 현재 변경사항이 모두 있습니다. 현재 자료를 JSON 백업한 후 저장된 파일을 다시 읽어 주세요.');base=P.upgrade(loadState(JSON.parse(raw)));}
    C.setMembers(base.members);let result;try{result=C.importRows(base,JSON.parse(await (await sourceHandle.getFile()).text()));}catch(e){C.setMembers(state.members);throw e;}
    const oldAccount=user&&state.accounts[user.name];state=P.enforceRemovals(result.state);diskText=raw;syncRoster();if(pendingTeams)state.customerTeams=pendingTeams;
    if(user&&(member(user.name)?.active===false||JSON.stringify(oldAccount)!==JSON.stringify(state.accounts[user.name])))user=null;
    changed();render();toast('공용 자료와 최신 원본 요청을 새로 읽었습니다. 원본 반영 내용을 파일에 저장하려면 내용 저장을 눌러 주세요.');
  }
  function setWeek(){const d=new Date(),offset=(d.getDay()+6)%7;d.setDate(d.getDate()-offset);const fmt=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;filters.from=fmt(d);d.setDate(d.getDate()+6);filters.to=fmt(d);}
  let draggedCard='',dragPreview=null;
  function clearDragPreview(){dragPreview?.remove();dragPreview=null;}
  document.addEventListener('dragstart',e=>{const card=e.target.closest('[data-card-id]');if(!card||card.getAttribute('draggable')!=='true'||card.closest('#editor')||e.target.closest('input,select'))return;draggedCard=card.dataset.cardId;e.dataTransfer.setData('text/plain',draggedCard);e.dataTransfer.effectAllowed='move';clearDragPreview();dragPreview=card.cloneNode(true);dragPreview.classList.add('board-drag-preview');dragPreview.style.width=card.getBoundingClientRect().width+'px';dragPreview.setAttribute('aria-hidden','true');document.body.appendChild(dragPreview);e.dataTransfer.setDragImage(dragPreview,card.getBoundingClientRect().width/2,32);card.classList.add('is-dragging');});
  document.addEventListener('dragover',e=>{const lane=e.target.closest('[data-lane]');if(lane&&draggedCard){e.preventDefault();e.dataTransfer.dropEffect='move';lane.classList.add('is-drop-target');const board=lane.closest('.status-board');if(board){const r=board.getBoundingClientRect();board.scrollBy({left:e.clientX<r.left+60?-24:e.clientX>r.right-60?24:0,top:e.clientY<r.top+70?-24:e.clientY>r.bottom-70?24:0});}}});
  document.addEventListener('dragleave',e=>{const lane=e.target.closest('[data-lane]');if(lane&&!lane.contains(e.relatedTarget))lane.classList.remove('is-drop-target');});
  document.addEventListener('drop',e=>{const lane=e.target.closest('[data-lane]');if(!lane||!draggedCard)return;e.preventDefault();moveBoardCard(draggedCard,lane.dataset.lane);draggedCard='';clearDragPreview();});
  document.addEventListener('dragend',()=>{draggedCard='';clearDragPreview();document.querySelectorAll('.is-dragging,.is-drop-target').forEach(el=>el.classList.remove('is-dragging','is-drop-target'));});
  document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(el)act(el).catch(err=>{if(err.name!=='AbortError')toast(err.message);});else if(!e.target.closest('button,input,select,textarea,a,label')){const card=e.target.closest('[data-home-target]');if(card)act({dataset:{action:'page',page:card.dataset.homeTarget}}).catch(err=>toast(err.message));}});
  document.addEventListener('input',e=>{const el=e.target;if(!heroDraft||!el.closest?.('#heroDesignForm'))return;const config=heroDraft[heroDraft.mode];if(el.dataset.heroColor){config[el.dataset.heroColor]=el.value;const check=document.querySelector('[data-hero-transparent="'+el.dataset.heroColor+'"]');if(check)check.checked=false;}else if(el.dataset.heroTransparent){const key=el.dataset.heroTransparent;config[key]=el.checked?'transparent':document.querySelector('[data-hero-color="'+key+'"]').value;}else if(el.hasAttribute('data-hero-flip')){config.flip=el.checked;}else if(el.dataset.heroPosition){config[el.dataset.heroPosition]=Number(el.value);const output=document.querySelector('[data-hero-output="'+el.dataset.heroPosition+'"]');if(output)output.textContent=el.value+(BoardBriefingHero.positions.find(p=>p[0]===el.dataset.heroPosition)?.[4]||'');}else return;heroDraft[heroDraft.mode]=BoardBriefingHero.clean(config,BoardBriefingHero.defaults(displayProfile(user),heroDraft.mode));$('#heroPreview').innerHTML=BoardBriefingHero.render({user:displayProfile(user),rows:heroRows(),C,N,esc,record:heroDraft,preview:true});BoardBriefingHero.mount(document);});
  document.addEventListener('invalid',e=>{let parent=e.target.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}},true);
  document.addEventListener('submit',e=>{
    const formId=e.target.getAttribute?.('id')??e.target.id;
    if(formId==='privateAvatarForm'){
      e.preventDefault();
      if(!canUsePrivateAvatar())return;
      const form=e.target,session=privateAvatarSession,file=new FormData(form).get('image');
      const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
      (async()=>{
        if(file?.type!=='image/gif')throw Error('GIF 파일을 선택해 주세요.');
        const src=await BoardAvatars.imageFile(file);
        if(!canUsePrivateAvatar()||privateAvatarSession!==session)return;
        if(await updatePrivateAvatar(session,{src,active:true})){$('#editor').close();render();}
      })().catch(error=>{if(form.isConnected){form.querySelector('#privateAvatarError').textContent=error.message;submit.disabled=false;}});
      return;
    }
    if(formId==='addAvatarForm'){e.preventDefault();const name=$('#avatarName').value.trim(),file=$('#avatarFile').files[0],owner=user.name;$('#avatarSubmit').disabled=true;BoardAvatars.imageFile(file).then(src=>{if(!user||user.name!==owner)throw Error('다시 로그인해 주세요.');const item={id:'custom-'+crypto.randomUUID(),name,src},items=[...(state.customAvatars||[]),item];BoardAvatars.validateCustom(items);state.customAvatars=items;state=P.setAvatar(state,owner,item.id);changed();$('#editor').close();render();toast('캐릭터와 핑크 브리핑을 추가했습니다. 공용 반영은 내용 저장을 눌러 주세요.');}).catch(err=>{if($('#avatarError'))$('#avatarError').textContent=err.message;if($('#avatarSubmit'))$('#avatarSubmit').disabled=false;});return;}

    if(formId==='heroDesignForm'){e.preventDefault();try{heroDesign.save(displayProfile(user),heroDraft);$('#editor').close();heroDraft=null;render();toast('이 캐릭터의 브리핑 디자인을 저장했습니다.');}catch(err){$('#heroDesignError').textContent='저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.';}return;}
    if(formId==='leaveSearchForm'){e.preventDefault();leaveSearch=String(new FormData(e.target).get('query')||'').trim();render();return;}
    if(formId==='leavePolicyForm'){
      e.preventDefault();
      try{
        if(!P.isOverallAdmin(state,user?.name))throw Error('WorkLog 관리자만 연차 정책을 설정할 수 있습니다.');
        const policy=policyFormData(e.target);
        BoardLeavePolicy.validate(policy);
        state.leavePolicy=policy;changed();$('#editor').close();render();toast('연차 정책을 저장했습니다.');
      }catch(err){$('#leavePolicyError').textContent=err.message;}
      return;
    }
    if(formId==='leaveTypeForm'){
      e.preventDefault();
      try{
        state=BoardLeaveTypes.save(state,user?.name,Object.fromEntries(new FormData(e.target)),{isAdmin:P.isOverallAdmin,uid:C.uid});
        changed();$('#editor').close();render();toast('휴가 종류를 저장했습니다.');
      }catch(err){$('#leaveTypeError').textContent=err.message;}
      return;
    }
    if(formId==='allowanceForm'){e.preventDefault();try{state=W.setAllowance(state,user.name,leaveOwner,leaveYear,new FormData(e.target).get('days'));changed();$('#editor').close();render();toast('연차 총수를 저장했습니다. 공용 파일 반영은 내용 저장을 눌러 주세요.');}catch(err){$('#allowanceError').textContent=err.message;}}
    if(formId==='contentOptionForm'){e.preventDefault();try{const data=new FormData(e.target);state=W.editOption(state,user.name,data.get('level'),data.get('value'));changed();contentOptionsDialog();}catch(err){$('#contentOptionError').textContent=err.message;}}
    if(personnelForms.has(formId)&&!P.isOverallAdmin(state,user?.name)){
      e.preventDefault();
      toast('WorkLog 관리자만 사용할 수 있습니다.');
      return;
    }
    if(formId==='expenseCardForm'||formId==='expenseEntryForm'||formId==='expenseExtraForm'){
      e.preventDefault();
      try{
        const data=Object.fromEntries(new FormData(e.target));
        if(formId==='expenseCardForm'){
          const result=expenseService.saveCard(state,user.name,data);state=result.state;expenseCardId=result.id;expenseMonth=data.month;
        }else if(formId==='expenseExtraForm'){
          state=expenseService.saveExtra(state,user.name,data);expenseCardId=data.cardId;expenseMonth=data.month;
        }else{
          state=expenseService.saveEntry(state,user.name,data);expenseCardId=data.cardId;expenseMonth=data.date.slice(0,7);
        }
        changed();$('#editor').close();render();
        toast((formId==='expenseCardForm'?'카드 설정':'카드 사용내역')+'을 반영했습니다. 내용 저장을 누르면 공용 폴더에 저장됩니다.');
      }catch(error){$('#expenseFormError').textContent=error.message;}
      return;
    }
    if(formId==='statsQueryForm'){
      e.preventDefault();
      const query=Object.fromEntries(new FormData(e.target));
      if(query.from&&query.to&&query.from>query.to){$('#statsQueryError').textContent='종료일은 시작일 이후로 지정하세요.';return;}
      statsQuery=query;render();
    }
    if(formId==='editCommentForm'){e.preventDefault();try{state=B.editComment(state,user.name,Object.fromEntries(new FormData(e.target)));changed();$('#editor').close();render();}catch(err){$('#editCommentError').textContent=err.message;}return;}
    if(formId==='postCommentForm'||formId?.startsWith('postReplyForm-')){
      e.preventDefault();
      try{
        const data=Object.fromEntries(new FormData(e.target));
        delete data.attachments;
        const list=$('.bulletin-table-wrap');
        const top=list?.scrollTop||0,left=list?.scrollLeft||0;
        const files=e.target.querySelector?.('input[type="file"]')?.files;
        if(files?.length){const form=e.target,actor=user.name;BoardAttachments.readFiles(files,[],true).then(attachments=>{if(user?.name!==actor)throw Error('다시 로그인하세요.');state=B.addComment(state,actor,{...data,attachments});changed();render();}).catch(error=>{const host=form.querySelector('[role="alert"]');if(host)host.textContent=error.message;});return;}
        state=B.addComment(state,user.name,data);
        const added=state.teamPosts.find(post=>post.id===data.id).comments.at(-1);
        boardPostId=data.id;changed();render();
        const nextList=$('.bulletin-table-wrap');if(nextList){nextList.scrollTop=top;nextList.scrollLeft=left;}
        const latest=[...document.querySelectorAll('[data-comment-id]')].find(row=>row.dataset.commentId===added.id);
        latest?.focus?.({preventScroll:true});latest?.scrollIntoView?.({block:'nearest'});
      }catch(err){const error=e.target.querySelector?.('[role="alert"]');if(error)error.textContent=err.message;else toast(err.message);}
    }
    if(formId==='postForm'){
      e.preventDefault();const form=e.target,actor=user.name;
      try{
        const data=Object.fromEntries(new FormData(form));
        if(data.category){data.team=data.category==='common'?member(actor).team:data.category;data.type=data.pinned?(data.category==='common'?'전체공지':'팀별공지'):'일반글';}
        const old=state.teamPosts?.find(post=>post.id===data.id),existing=data.clearAttachments?[]:old?.attachments||[];
        const finish=attachments=>{if(user?.name!==actor)throw Error('다시 로그인하세요.');state=B.save(state,actor,{...data,attachments});boardPostId=data.id||state.teamPosts.at(-1).id;if(data.category)boardTeam=data.category==='common'?'common':data.team;changed();$('#editor').close();render();toast('게시글을 저장했습니다. 내용 저장으로 공용 반영하세요.');};
        const files=form.querySelector?.('input[type="file"]')?.files;
        if(files?.length){const submit=form.querySelector('[type="submit"],button.primary');if(submit)submit.disabled=true;BoardAttachments.readFiles(files,existing).then(finish).catch(err=>{if($('#postError'))$('#postError').textContent=err.message;if(submit)submit.disabled=false;});}else finish(existing);
      }catch(err){$('#postError').textContent=err.message;}
      return;
    }
    if(formId==='quickLinksForm'){e.preventDefault();try{if(!P.isOverallAdmin(state,user?.name))throw Error('관리자만 설정할 수 있습니다.');const data=new FormData(e.target);state.quickLinks=N.cleanLinks(Array.from({length:4},(_,i)=>({label:data.get('label'+i),url:data.get('url'+i)})).filter(l=>l.label||l.url));changed();$('#editor').close();render();}catch(err){$('#quickLinksError').textContent=err.message;}}
    if(formId==='organizationForm'||formId==='organizationLevelForm'){
      e.preventDefault();
      try{
        const fields=new FormData(e.target),chart=readOrganization(),name=String(fields.get('name')||'').trim();
        if(!name||name.length>80)throw Error('이름을 1~80자로 입력해 주세요.');
        if(formId==='organizationLevelForm'){
          const index=Number(fields.get('index'));
          if(!Number.isInteger(index)||index<0||index>chart.levels.length)throw Error('레벨을 찾을 수 없습니다.');
          if(fields.get('mode')==='insert'){
            const content=String(fields.get('content')||'').trim();
            O.insertLevel(chart,index,name,content,C.uid);
          }else chart.levels[index]=name;
        }else{
          const id=String(fields.get('id')||''),parent=String(fields.get('parent')||'')||null;
          const item=chart.nodes.find(node=>node.id===id);
          if(id&&!item)throw Error('조직도 항목을 찾을 수 없습니다.');
          if(parent&&(!chart.nodes.some(node=>node.id===parent)||(item&&O.descendants(chart,id).has(parent))))throw Error('상위 항목을 다시 선택해 주세요.');
          if(item)Object.assign(item,{name,parent});
          else{
            const member=String(fields.get('member')||'');
            if(member&&(!activeMembers().some(person=>person.name===member)||chart.nodes.some(node=>node.member===member)))throw Error('연결할 멤버를 다시 선택해 주세요.');
            chart.nodes.push({id:C.uid(),name,parent,...(member?{member}:{})});
            if(member)chart.hiddenMembers=chart.hiddenMembers.filter(hidden=>hidden!==member);
          }
          O.extendLevels(chart);
        }
        saveOrganization(chart);
      }catch(err){$('#organizationError').textContent=err.message;}
      return;
    }
    if(formId==='rankOrderForm'){
      e.preventDefault();
      try{
        const fields=new FormData(e.target),old=String(fields.get('old')||''),name=String(fields.get('name')||'');
        const ranks=P.ranks(state).map(rank=>({old:rank,name:rank===old?name:rank}));
        if(!old)ranks.push({old:null,name});
        else if(!ranks.some(rank=>rank.old===old))throw Error('편집할 직책을 찾을 수 없습니다.');
        saveRanks(ranks,true);
      }catch(err){$('#rankOrderError').textContent=err.message;}
      return;
    }
    if(formId==='adminsForm'){e.preventDefault();try{state=P.setAdministrators(state,user?.name,new FormData(e.target).getAll('admins'));changed();$('#editor').close();render();toast('관리자 지정을 변경했습니다. 내용 저장으로 반영하세요.');}catch(err){$('#adminsError').textContent=err.message;}}
    if(formId==='leaveForm'){e.preventDefault();try{state=P.saveLeave(state,user.name,Object.fromEntries(new FormData(e.target)));changed();$('#editor').close();render();toast('휴가를 등록했습니다. 내용 저장으로 공용 파일에 반영하세요.');}catch(err){$('#leaveError').textContent=err.message;}}
    if(formId==='loginForm'){e.preventDefault();signIn(e.target);}
    if(formId==='projectForm'){e.preventDefault();saveProject(e.target);}
    if(formId==='memoForm'){e.preventDefault();try{const d=new FormData(e.target);state=P.savePersonal(state,user.name,{...Object.fromEntries(d),done:d.has('done')});changed();$('#editor').close();render();toast('메모를 임시 저장했습니다. 내용 저장으로 파일에 반영하세요.');}catch(err){$('#memoError').textContent=err.message;}}
    if(formId==='memberRankForm'){e.preventDefault();try{state=P.editMember(state,user.name,Object.fromEntries(new FormData(e.target)));syncRoster();changed();$('#editor').close();render();toast('멤버 정보를 수정했습니다.');}catch(err){$('#memberRankError').textContent=err.message;}return;}
    if(formId==='memberForm'){e.preventDefault();try{const data=Object.fromEntries(new FormData(e.target)),next=P.addMember(state,data.name,data.team);state=P.editMember(next,user.name,data);syncRoster();changed();$('#editor').close();render();toast('인원을 추가했습니다.');}catch(err){$('#memberError').textContent=err.message;}return;}
    if(formId==='removeMemberForm'){e.preventDefault();try{const d=new FormData(e.target);if(!d.has('acknowledge'))throw new Error('자료 처리 방식을 확인해 주세요.');if(d.get('name')===user.name)throw new Error('본인의 퇴사 처리는 다른 사용자가 진행해 주세요.');state=P.removeMember(state,d.get('name'),d.get('retention'));syncRoster();changed();$('#editor').close();render();toast('퇴사 처리를 임시 반영했습니다. 내용 저장으로 파일에 반영하세요.');}catch(err){$('#removeError').textContent=err.message;}}
  });
  document.addEventListener('change',async e=>{
    const el=e.target;
    if(el.type==='file'&&el.name==='attachments'){const output=el.closest('form')?.querySelector('.attachment-selection');if(output)output.textContent=[...el.files].map(file=>file.name).join(' · ');}
    if(el.id==='expenseCard'){
      const cards=state.cardExpenses?.cards||(!targetHandle&&typeof BoardPreviewData!=='undefined'?BoardPreviewData.cardSamples?.()?.cards:[])||[];
      if(cards.some(card=>card.id===el.value)){expenseCardId=el.value;render();$('#expenseCard')?.focus?.();}
      return;
    }
    if(el.id==='expenseYear'||el.id==='expenseMonth'){
      const month=el.id==='expenseYear'?el.value+'-'+expenseMonth.slice(5):expenseMonth.slice(0,4)+'-'+el.value;
      if(BoardCardExpenses.validMonth(month)){expenseMonth=month;render();$('#'+el.id)?.focus?.();}
      return;
    }
    if(el.dataset.revisionRequired){try{const index=state.projects.findIndex(p=>p.id===el.dataset.revisionRequired);state.projects[index]=BoardTaskBoard.setRevisionRequired(state.projects[index],el.dataset.taskId,el.checked,C,user.name);changed();render();}catch(err){toast(err.message);render();}return;}
    if(el.id==='leaveType'){const field=$('#leaveUnits')?.closest?.('.field');if(field)field.hidden=el.value!=='추가 사용';return;}
    if(el.dataset.boardDate){if(el.value&&(!/^\d{4}-\d{2}-\d{2}$/.test(el.value)||Number.isNaN(Date.parse(el.value+'T00:00:00Z'))||new Date(el.value+'T00:00:00Z').toISOString().slice(0,10)!==el.value)){toast('날짜를 YYYY-MM-DD 형식으로 입력해 주세요.');el.value=filters[el.dataset.boardDate];return;}const next={...filters,[el.dataset.boardDate]:el.value};if(next.from&&next.to&&next.from>next.to){toast('시작 날짜는 종료 날짜보다 늦을 수 없습니다.');el.value=filters[el.dataset.boardDate];return;}filters=next;render();$('#'+el.id)?.focus?.();return;}
    if(el.dataset.taskField==='role'){collectTasks();const task=taskDraft[Number(el.closest('[data-task-index]').dataset.taskIndex)],team=BoardSimpleEditor.teamOf(el.value);task.assignees=task.assignees.filter(name=>!team||member(name)?.team===team);$('#taskList').innerHTML=taskForms();return;}
    if(el.dataset.taskField==='revisionRequired'){collectTasks();$('#taskList').innerHTML=taskForms();return;}
    if(el.dataset.taskField==='progress'||el.dataset.taskField==='status'){
      const row=el.closest('[data-task-index]'),percent=row.querySelector('[data-task-field="progress"]'),status=row.querySelector('[data-task-field="status"]');
      if(el.dataset.taskField==='progress'&&el.value!==''&&el.validity.valid)status.value=Number(el.value)===100?'완료':Number(el.value)===0?'예정':'진행중';
      if(el.dataset.taskField==='status'){percent.value=C.isComplete(el.value)?100:el.value==='완료 후 수정'?Number(percent.value):Math.min(99,Number(percent.value));const task=taskDraft[Number(row.dataset.taskIndex)];if(task.status!==el.value)task.revisionRequired=false;collectTasks();if(el.value==='완료 후 수정')task.revisionRequired=false;$('#taskList').innerHTML=taskForms();}
    }
    if(el.dataset.taskMember){
      const row=el.closest('.editor-assignees'),summary=row?.querySelector('summary strong');
      if(summary)summary.textContent=P.orderNames(state,Array.from(row.querySelectorAll('[data-task-member]:checked'),input=>input.dataset.taskMember)).join(', ')||'선택하세요';
    }
    if(el.dataset.progressId){
      try{
        const index=state.projects.findIndex(project=>project.id===el.dataset.progressId);
        if(!user||index<0)return;
        if(el.value.trim()==='')throw new Error('진행률을 입력해 주세요.');
        const detailOpen=$('#editor').open;
        state.projects[index]=BoardTaskBoard[el.dataset.progressKind==='revision'?'setRevisionProgress':'setProgress'](state.projects[index],el.dataset.progressTask,Number(el.value),C,user.name);
        changed();render();
        if(detailOpen){$('#editor').close();boardDetail(el.dataset.progressId);}
        const controls=Array.from(document.querySelectorAll('[data-progress-id]'));
        const focus=controls.find(input=>input.dataset.progressId===el.dataset.progressId&&input.dataset.progressTask===el.dataset.progressTask&&input.type===el.type&&input.dataset.progressKind===el.dataset.progressKind&&Boolean(input.closest('#editor'))===detailOpen);
        focus?.focus?.({preventScroll:true});
      }catch(err){toast(err.message);}
      return;
    }
    if(el.dataset.boardMove){const detailOpen=$('#editor').open;moveBoardCard(el.dataset.boardMove,el.value,detailOpen?'':boardAssignee());if(detailOpen){$('#editor').close();boardDetail(el.dataset.boardMove);}return;}
    if(el.id==='leaveYear'){if(/^\d{4}$/.test(el.value)&&Number(el.value)>=2000&&Number(el.value)<=2100){leaveYear=el.value;leaveMonth=leaveYear+'-'+leaveMonth.slice(5);leaveWeekDate=leaveMonth+'-01';leaveSelectedDay='';render();}return;}
    if(el.id==='leaveOwner'&&!el.closest('#leaveForm')){leaveOwner=el.value;render();return;}
    if(el.id==='p-taskCategory'){const isContent=el.value==='콘텐츠';for(const [container,input,show] of [['contentCategoryField','p-contentCategory',isContent],['contentTypeField','p-contentType',isContent],['platformField','p-platform',!isContent]]){$('#'+container).hidden=!show;$('#'+input).disabled=!show;$('#'+input).required=show;}}
    if(el.id==='loginTeam'){$('#loginName').innerHTML=options(activeMembers().filter(m=>m.team===el.value).map(m=>m.name),'');await updateLogin();}
    if(el.id==='loginName')await updateLogin();

    if(el.dataset.memoToggle){const item=state.personal[user.name].find(i=>i.id===el.dataset.memoToggle);if(item){item.done=el.checked;changed();render();}}
    if(el.dataset.filter){if(el.dataset.filter==='selectedTeam')selectedTeam=el.value;else filters[el.dataset.filter]=el.value;if(filters.from&&filters.to&&filters.from>filters.to)toast('시작 날짜가 종료 날짜보다 늦습니다. 기간을 확인해 주세요.');render();}
    if(el.id==='jsonPicker'&&el.files[0])try{
      const raw=await el.files[0].text();
      if(el.dataset.mode==='import')await importData(raw);
      else{const loaded=loadState(JSON.parse(raw));if(dirty&&!confirm('현재 임시 변경사항을 선택한 JSON 자료로 바꾸시겠습니까?'))return;state=P.upgrade(loaded);syncRoster();targetHandle=null;targetDir=null;sourceHandle=null;sourceDir=null;setupDone=false;health={source:false,target:false};diskText=null;dirty=false;user=null;demoSession=false;cacheError='';persist();render();toast('자료를 불러왔습니다. 폴더를 다시 연결해 주세요.');}
    }catch(err){toast('불러오기 실패: '+err.message);}
  });
  let searchTimer;
  document.addEventListener('input',e=>{
    const form=e.target.form;
    if(form?.getAttribute('id')==='expenseEntryForm'&&['cardId','date','amount','excluded'].includes(e.target.name)){
      BoardCardExpenses.updateBalances(form,state.cardExpenses||BoardCardExpenses.empty());
    }
    const input=e.target;
    if(input.dataset.progressId){
      if(input.value.trim()===''||!input.validity.valid)return;
      const row=input.closest('li'),card=input.closest('.task-board-card');
      input.closest('.task-progress-control').querySelectorAll('[data-progress-id]').forEach(control=>{if(control!==input)control.value=input.value;});
      if(input.dataset.progressKind==='revision')return;
      const values=Array.from(card.querySelectorAll('input[type="range"][data-progress-id]:not([data-progress-kind])')).map(control=>Number(control.value));
      const percent=Math.floor(values.reduce((sum,value)=>sum+value,0)/values.length);
      card.querySelector('progress').value=percent;card.querySelector('[data-card-percent]').textContent=percent+'%';
      return;
    }
    const isName=input.id==='boardName';
    if(!isName&&input.dataset.filter!=='search')return;
    if(isName)boardName=input.value;else filters.search=input.value;
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>{
      if(!input.isConnected)return;
      const focused=document.activeElement===input;
      const pos=input.selectionStart;
      render();
      const field=$(isName?'#boardName':'[data-filter="search"]');
      if(field&&focused){field.focus();field.setSelectionRange(pos,pos);}
    },250);
  });
  window.addEventListener('beforeunload',e=>{if(dirty&&!demoSession){e.preventDefault();e.returnValue='';}});
  $('#editor').addEventListener('close',()=>{if(dialogOpener?.isConnected)dialogOpener.focus();else $('.content')?.focus();});
  window.addEventListener('focus',()=>{if(user&&!demoSession)checkConnections().then(()=>{const bar=$('.workspace-tools');if(bar)bar.outerHTML=connectionBar();});});
  const previewMode=window.location&&new URLSearchParams(window.location.search).get('preview')==='1';
  if(previewMode&&typeof BoardPreviewData!=='undefined'){state=P.migrateRoles(BoardPreviewData.create(C,P));user=state.members.find(m=>m.name==='김무현');demoSession=true;setupDone=true;deferredConnection=true;dirty=false;cacheError='';C.setMembers(P.orderedMembers(state));}
  jQuery(async()=>{if(!previewMode&&localStorage.getItem(CACHE+'-storage')==='indexeddb'&&V.cachedState){try{const cache=await V.cachedState();if(cache){state=loadState(cache.state);dirty=Boolean(cache.dirty);syncRoster();}}catch{cacheError='첨부파일이 포함된 임시 자료를 읽지 못했습니다. 공용 저장 또는 JSON 백업을 불러오세요.';}}render();if(previewMode)return;try{await restoreFolders();}catch(e){toast('기억된 폴더를 자동 연결하지 못했습니다. '+e.message);}developmentSamples=true;render();});
})();
