(function(root){
 'use strict';
  function customerCards(context){
    const {page,C,Icons,esc,button,relatedRows,filters,customerMode}=context;
    const all=relatedRows(),key=customerMode==='team'?'customer':'requester';
    const values=[...new Set(all.map(p=>p[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
    return `<div class="customer-report-toolbar">${button('export',Icons.arrow('download')+' 엑셀 내보내기')}<div class="tabs">${button('customerMode','고객 팀별',customerMode==='team'?'active':'','data-mode="team"')}${button('customerMode','고객 이름별',customerMode==='name'?'active':'','data-mode="name"')}${button('allCustomers','전체 고객')}</div></div><div class="customer-grid">${values.map(v=>{const rows=all.filter(p=>p[key]===v);return button('customer',`<strong>${esc(v)}</strong><p>전체 ${rows.length}건 &nbsp;·&nbsp; 미완료 ${rows.filter(p=>!C.isComplete(p.status)).length}건</p>`,`card customer-card ${filters[key]===v?'active':''}`,`data-value="${esc(v)}"`);}).join('')||'<p class="muted">등록된 고객이 없습니다.</p>'}</div>`;
  }
  function report(context){
    const {page,state,P,Icons,esc,button,filters,scopeTabs,filterBar,reportRows,BoardTaskBoard,BoardProjectReport}=context;return '<section class="card weekly-report"><div class="weekly-report-toolbar">'+scopeTabs()+'<div class="actions">'+button('reportRefresh','원본 새로고침')+button('export',Icons.arrow('download')+' 엑셀 내보내기')+'</div>'+'</div>'+filterBar(true)+'<p class="weekly-history-label">원본 변경 횟수는 고객 JSON을 다시 읽을 때 변경을 확인한 횟수입니다. 과업 상세에서 이전 값과 변경 값을 볼 수 있습니다.</p>'+BoardProjectReport.weeklyTable({rows:reportRows(),filters,Board:BoardTaskBoard,esc,button,orderNames:names=>P.orderNames(state,names)})+'</section>';}
  function statisticsPage(context){
    const {page,C,esc,button,options,relatedRows,statsQuery,BoardTaskBoard,BoardProjectReport}=context;
    const all=relatedRows(),sourceDetails=BoardTaskBoard.sourceDetails;
    const labels=(value)=>[...new Set(all.map(project=>String(value(project)||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
    const statuses=labels(project=>sourceDetails(project).status),customers=labels(project=>project.customer||sourceDetails(project).customer);
    const rows=all.filter(project=>{
      const raw=sourceDetails(project),due=project.requestedDue||project.due;
      return (!statsQuery.from||due&&due>=statsQuery.from)&&(!statsQuery.to||due&&due<=statsQuery.to)
        &&(!statsQuery.role||String(sourceDetails(project,statsQuery.role).assignees||'').trim())
        &&(!statsQuery.status||raw.status===statsQuery.status)
        &&(!statsQuery.customer||(project.customer||raw.customer)===statsQuery.customer);
    });
    const select=(name,label,values,placeholder)=>'<label>'+label+'<select name="'+name+'">'+options(values,statsQuery[name],placeholder)+'</select></label>';
    const date=(name,label)=>'<label>'+label+'<input type="date" name="'+name+'" value="'+esc(statsQuery[name]||'')+'"></label>';
    return '<form class="card stats-query" id="statsQueryForm"><div class="stats-query-fields">'+date('from','완료요청일 시작')+date('to','완료요청일 종료')+select('role','담당 파트',['기획','디자인','퍼블'],'전체')+select('status','진행 상태',statuses,'전체')+select('customer','고객',customers,'전체')+select('group','집계 항목',['상태별','담당 파트별','고객별'],'전체')+'</div><div class="stats-query-actions"><p id="statsQueryError" class="error" role="alert"></p>'+button('resetStats','초기화')+'<button type="submit" class="primary">통계 조회</button></div></form>'+BoardProjectReport.statistics({rows,C,Board:BoardTaskBoard,esc,group:statsQuery.group});
  }
  function userWorkPage(context){
    const {userWork,page,state,user,P,N,esc,button,member,projects,view,scopeTabs,filterBar,categorizedTable,projectTable,viewTabs}=context;const rows=projects(),names=P.orderNames(state,[...new Set(rows.flatMap(p=>p.assignees))]);return '<section class="card"><div class="table-toolbar"><h2>사용자별 업무</h2>'+scopeTabs()+viewTabs()+'</div>'+filterBar()+'<div class="tabs">'+button('userWork','전체 사용자',!userWork?'active':'')+names.map(n=>button('userWork',esc(n),userWork===n?'active':'','data-name="'+esc(n)+'"')).join('')+'</div>'+names.filter(n=>!userWork||n===userWork).map(n=>'<section class="user-work-section"><h3>'+esc(n)+' · '+esc(N.teamLabel(member(n)?.team||''))+'</h3>'+(view==='category'?categorizedTable(rows.filter(p=>p.assignees.includes(n))):projectTable(rows.filter(p=>p.assignees.includes(n))))+'</section>').join('')+(names.length?'':'<p class="empty">담당자가 지정된 과업이 없습니다.</p>')+'</section>';}
  function revisionPage(context){
    const {page,projects,view,scopeTabs,filterBar,categorizedTable,projectTable,viewTabs}=context;const rows=projects().filter(p=>p.parentProjectId);return '<section class="card"><div class="table-toolbar"><h2>연결된 수정작업 <span class="count">'+rows.length+'</span></h2>'+scopeTabs()+viewTabs()+'</div>'+filterBar()+(view==='category'?categorizedTable(rows):projectTable(rows))+'</section><p class="muted">원본 과업을 열고 ‘수정작업 추가’를 누르면 연결된 작업을 등록합니다.</p>';}
 const api={customerCards,report,statisticsPage,userWorkPage,revisionPage};if(typeof module!=='undefined')module.exports=api;else (root.BoardFeaturePages??={})['reports']=api;
})(typeof window!=='undefined'?window:globalThis);
