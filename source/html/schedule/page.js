(function(root){
 'use strict';
  function weeklySchedule(context){
    const {state,user,P,N,Icons,esc,button,sourceRows,projects,weekBlocks,scheduleWeekOffset,BoardTaskBoard}=context;
    const current=P.weekRanges()[0].start,anchor=new Date(current+'T00:00:00Z');anchor.setUTCDate(anchor.getUTCDate()+scheduleWeekOffset*7);
    const ranges=P.weekRanges(anchor.toISOString().slice(0,10)),scheduleState={...state,projects:sourceRows()};
    const panels=ranges.map(range=>{
      const rows=P.schedule(scheduleState,user.name,range),label=BoardTaskBoard.weekGroups([{nextDue:range.start,project:{}}])[0].label.split(' (')[0];
      const items=rows.map(item=>'<article class="agenda-item schedule-task"><div><small>'+esc(item.date+(item.end&&item.end!==item.date?' ~ '+item.end:''))+(item.time?' · '+esc(item.time):'')+'</small>'+
        (item.projectId?button('boardDetail',esc(item.title),'project-button','data-id="'+esc(item.projectId)+'"'):'<strong>'+esc(item.title)+'</strong>')+
        '<span>'+esc(item.owner)+' · '+esc(item.projectId?N.teamLabel(item.role):item.kind)+'</span></div>'+weekBlocks(item.due||item.date,item.done)+'</article>').join('');
      return '<section class="card schedule-week-row" data-week-start="'+range.start+'"><div class="sectionhead"><h2>'+esc(label)+(range.start===current?' <small>이번 주</small>':'')+'</h2><p class="muted">'+range.start+'<br>~ '+range.end+'</p><span class="count">'+rows.length+'건</span></div><div class="agenda-list">'+(items||'<p class="empty">등록된 일정이 없습니다.</p>')+'</div></section>';
    }).join('');
    return '<div class="weekly-schedule-toolbar"><span id="scheduleWeekHeading" tabindex="-1">'+(P.isLeader(state,user.name)?'팀 일정':'내 일정')+'</span><div class="actions">'+button('scheduleWeek',Icons.arrow('left'),'','data-step="previous" aria-label="이전 주"')+button('scheduleWeek',Icons.arrow('refresh'),'','data-step="current" aria-label="이번 주"')+button('scheduleWeek',Icons.arrow('right'),'','data-step="next" aria-label="다음 주"')+'</div></div><div class="weekly-schedule-panels">'+panels+'</div>';
  }
  function deadlinePage(context){
    const {C,projects,deadlineItems,scopeTabs,filterBar}=context;const rows=projects().filter(p=>p.due&&!C.isComplete(p.status)).sort((a,b)=>a.due.localeCompare(b.due));return '<section class="card"><div class="table-toolbar"><h2>마감 일정</h2>'+scopeTabs()+'</div>'+filterBar()+'<div class="agenda-list detail-agenda">'+deadlineItems(rows)+'</div></section>';}
 const api={weeklySchedule,deadlinePage};if(typeof module!=='undefined')module.exports=api;else (root.BoardFeaturePages??={})['schedule']=api;
})(typeof window!=='undefined'?window:globalThis);
