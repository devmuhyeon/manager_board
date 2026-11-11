(function(root){
 'use strict';
 const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&!isNaN(Date.parse(value+'T00:00:00Z'));
 function events(state,actor,C){
  const rows=[];
  for(const raw of state.projects){const p=C.effective(raw);if(state.hiddenProjects?.includes(p.id)||!p.assignees?.includes(actor))continue;
   const tasks=p.tasks?.length?p.tasks:[p],starts=tasks.map(t=>t.started||t.due).filter(valid).sort(),ends=tasks.map(t=>t.due||t.started).filter(valid).sort();
   const start=starts[0]||p.started||p.due,end=ends.at(-1)||p.due||start;if(!valid(start)||!valid(end)||start>end)continue;
   rows.push({id:p.id,title:p.title,start,end,kind:'project',done:C.isComplete(p.status)});
  }
  for(const m of state.personal?.[actor]||[]){const end=m.endDate||m.date;if(valid(m.date)&&valid(end)&&m.date<=end)rows.push({id:m.id,title:m.title,start:m.date,end,kind:'memo',done:m.done});}
  return rows.sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title,'ko'));
 }
 function shift(month,delta){const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta);return d.toISOString().slice(0,7);}
 function render({state,actor,C,month,selected,esc,button}){
  const all=events(state,actor,C),first=new Date(month+'-01T00:00:00Z'),offset=(first.getUTCDay()+6)%7;
  const days=Array.from({length:42},(_,i)=>{const d=new Date(first);d.setUTCDate(1-offset+i);return d.toISOString().slice(0,10);});
  const selectedEvents=all.filter(e=>e.start<=selected&&e.end>=selected);
  return '<section class="card briefing-calendar"><div class="sectionhead"><div><h2>내 업무 달력</h2><p class="muted">내가 참여한 프로젝트 기간 · 개인 메모 기간</p></div><div class="actions">'+button('calendarMonth','‹','','data-step="-1" aria-label="이전 달"')+'<strong>'+esc(month.replace('-','년 '))+'월</strong>'+button('calendarMonth','›','','data-step="1" aria-label="다음 달"')+button('calendarToday','오늘')+'</div></div><div class="calendar-legend"><span class="project">프로젝트</span><span class="memo">개인 메모</span></div><div class="calendar-scroll"><div class="calendar-grid">'+['월','화','수','목','금','토','일'].map(day=>'<div class="calendar-weekday">'+day+'</div>').join('')+days.map(date=>{const entries=all.filter(e=>e.start<=date&&e.end>=date);return '<div class="calendar-day '+(date.slice(0,7)!==month?'outside ':'')+(date===C.today()?'today ':'')+(date===selected?'selected':'')+'">'+button('calendarDay',String(Number(date.slice(-2))),'calendar-day-button','data-date="'+date+'" aria-label="'+date+' 일정 '+entries.length+'개" aria-pressed="'+(date===selected)+'"')+entries.slice(0,3).map(e=>button(e.kind==='project'?'boardDetail':'editMemo',esc(e.title),'calendar-event '+e.kind+(e.done?' done':''),'data-id="'+esc(e.id)+'" title="'+esc(e.title+' · '+e.start+' ~ '+e.end)+'"')).join('')+(entries.length>3?button('calendarDay','+'+(entries.length-3)+'개 더 보기','calendar-more','data-date="'+date+'"'):'')+'</div>';}).join('')+'</div></div><div class="calendar-day-list"><h3>'+esc(selected)+' 일정 <span class="count">'+selectedEvents.length+'</span></h3>'+selectedEvents.map(e=>'<article>'+button(e.kind==='project'?'boardDetail':'editMemo',esc(e.title),'project-button','data-id="'+esc(e.id)+'"')+'<small>'+esc((e.kind==='project'?'프로젝트':'개인 메모')+' · '+e.start+' ~ '+e.end)+'</small></article>').join('')+(!selectedEvents.length?'<p class="muted">선택한 날짜에 일정이 없습니다.</p>':'')+'</div></section>';
 }
 const api={events,shift,render};if(typeof module!=='undefined')module.exports=api;else root.BoardBriefingCalendar=api;
})(typeof window!=='undefined'?window:globalThis);
