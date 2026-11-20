(function(root){
 'use strict';
  function dashboardContent(context){
    const {page,boardName,boardMode,boardIncludesDone,closedWeeks,closedLanes,expandedCards,state,user,C,P,N,esc,button,activeMembers,relatedRows,projects,filters,scope,view,boardLayout,boardAssignee,demoSession,scopeTabs,filterBar,categorizedTable,projectTable,customerCards,boardLayoutToggle,viewTabs,BoardTaskBoard}=context;
    const rows=projects();
    const isBoard=page==='work'&&view==='board';
    const showDone=boardIncludesDone();
    const boardControls=isBoard?'<div class="board-control-row">'+boardLayoutToggle()+'<div class="task-board-controls">'
      +'<div class="board-period" role="group" aria-label="마감일 기간 조회"><input id="boardFrom" type="text" inputmode="numeric" placeholder="YYYY-MM-DD" maxlength="10" data-board-date="from" aria-label="마감일 시작 날짜" value="'+esc(filters.from)+'" max="'+esc(filters.to)+'"><span>~</span><input id="boardTo" type="text" inputmode="numeric" placeholder="YYYY-MM-DD" maxlength="10" data-board-date="to" aria-label="마감일 종료 날짜" value="'+esc(filters.to)+'" min="'+esc(filters.from)+'">'+button('resetBoardDates','날짜 초기화','','')+'</div><label class="sr-only" for="boardName">과업명 또는 담당자</label><input type="search" id="boardName" list="boardPeople" placeholder="과업명 · 담당자 검색" value="'+esc(boardName)+'">'
      +'<datalist id="boardPeople">'+activeMembers().map(person=>'<option value="'+esc(person.name)+'"></option>').join('')+'</datalist>'
      +button('boardMine','내 과업',boardName===user.name?'primary':'','aria-pressed="'+(boardName===user.name)+'"')
      +button('new','＋ 새 과업 등록','primary')
      +((boardName||scope!=='all'||Object.entries(filters).some(([key,value])=>key!=='dateField'&&value))?button('clearFilters','전체 보기'):'' )
      +'</div></div>':'';
    const content=isBoard&&boardMode==='workflow'&&boardLayout==='table'?'<div class="board-table-view">'+projectTable(BoardTaskBoard.cards(relatedRows(),boardAssignee(),true,C,{from:filters.from,to:filters.to}).map(card=>card.project))+'</div>':isBoard&&boardMode==='workflow'&&boardLayout==='cards'
      ?BoardTaskBoard.renderWorkflow({rows:relatedRows(),internalRows:rows,name:boardAssignee(),C,esc,button,actor:user.name,period:{from:filters.from,to:filters.to},demo:demoSession,includeSamples:demoSession,orderNames:names=>P.orderNames(state,names)})
      :isBoard?BoardTaskBoard.render({rows,name:boardAssignee(),showDone,mode:boardMode==='workflow'?'project':boardMode,layout:boardLayout,closedWeeks,closedLanes,expandedCards,period:{from:filters.from,to:filters.to},members:state.members,rankOrder:P.ranks(state),actor:user.name,C,N,esc,button,dday:P.dday,orderNames:names=>P.orderNames(state,names),organization:{teams:P.orderedTeams(state),orderNames:names=>P.orderNames(state,names)}})
      :view==='category'?categorizedTable(rows):projectTable(rows);
    return (page==='customers'?customerCards():'')+'<section class="card '+(isBoard?'board-surface':'')+'"><div class="table-toolbar"><h2>'
      +(isBoard?'남은 과업 보드':'업무 목록 <span class="count">'+rows.length+'</span>')+'</h2>'+(isBoard?'':scopeTabs()+viewTabs())
      +'</div>'+boardControls+(isBoard?'':filterBar())+content+'</section>';
  }
  function boardLayoutToggle(context){
    const {page,button,view,boardLayout}=context;return button('boardLayout','<span class="view-option '+(boardLayout==='cards'?'selected':'')+'" title="카드 보기"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="10" rx="2"/></svg></span><span class="view-option '+(boardLayout==='table'?'selected':'')+'" title="도표 보기"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/></svg></span>','board-layout-toggle','role="switch" aria-checked="'+(boardLayout==='table')+'" aria-label="도표형 보기"');}
  function viewTabs(context){
    const {page,button,view}=context;return '<div class="tabs" role="group" aria-label="업무 보기">'+(page==='work'?button('view','보드',view==='board'?'active':'','data-view="board"'):'')+button('view','분류별',view==='category'?'active':'','data-view="category"')+button('view','과업별',view==='project'?'active':'','data-view="project"')+'</div>';}
 const api={dashboardContent,boardLayoutToggle,viewTabs};if(typeof module!=='undefined')module.exports=api;else (root.BoardFeaturePages??={})['work']=api;
})(typeof window!=='undefined'?window:globalThis);
