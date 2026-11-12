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
 function weeks(month){
  const first=new Date(month+'-01T00:00:00Z'),offset=(first.getUTCDay()+6)%7,last=new Date(first);last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
  return Array.from({length:Math.ceil((last.getUTCDate()+offset)/7)},(_,w)=>Array.from({length:7},(_,i)=>{const d=new Date(first);d.setUTCDate(1-offset+w*7+i);return d.toISOString().slice(0,10);}));
 }
 function segments(all,days){
  const occupied=[Array(7).fill(false),Array(7).fill(false)],visible=[],overflow=[];
  all.filter(e=>e.start<=days[6]&&e.end>=days[0]).forEach(event=>{
   const start=Math.max(0,days.findIndex(day=>day>=event.start)),end=event.end>=days[6]?6:days.findLastIndex(day=>day<=event.end);
   const row=occupied.findIndex(cells=>cells.slice(start,end+1).every(value=>!value));
   if(row<0){overflow.push(event);return;}for(let i=start;i<=end;i++)occupied[row][i]=true;
   visible.push({...event,column:start+1,span:end-start+1,row:row+2,continuesBefore:event.start<days[0],continuesAfter:event.end>days[6]});
  });return {visible,overflow};
 }
 function render({state,actor,C,month,esc,button}){
  const all=events(state,actor,C);
  return '<section class="card briefing-calendar compact-calendar"><div class="sectionhead"><h2>내 업무 달력</h2><div class="calendar-legend"><span class="project">프로젝트</span><span class="memo">개인 메모</span></div><div class="actions">'+button('calendarMonth','‹','','data-step="-1" aria-label="이전 달"')+'<strong>'+esc(month.replace('-','년 '))+'월</strong>'+button('calendarMonth','›','','data-step="1" aria-label="다음 달"')+button('calendarToday','오늘')+'</div></div><div class="calendar-scroll"><div class="calendar-weekdays">'+['월','화','수','목','금','토','일'].map(day=>'<span>'+day+'</span>').join('')+'</div>'+weeks(month).map(days=>{const packed=segments(all,days);return '<div class="calendar-week">'+days.map((date,i)=>'<div class="calendar-date '+(date.slice(0,7)!==month?'outside ':'')+(date===C.today()?'today':'')+'" style="grid-column:'+(i+1)+';grid-row:1" aria-label="'+date+'">'+(date===C.today()?'<span class="calendar-date-number" aria-current="date">':'<span class="calendar-date-number">')+Number(date.slice(-2))+'</span></div>').join('')+packed.visible.map(e=>button(e.kind==='project'?'boardDetail':'editMemo',(e.continuesBefore?'<span class="calendar-continuation" aria-hidden="true">‹</span>':'')+'<span class="calendar-event-title">'+esc(e.title)+'</span>'+(e.continuesAfter?'<span class="calendar-continuation" aria-hidden="true">›</span>':''),'calendar-span calendar-tone-'+(Array.from(e.id).reduce((n,c)=>n+c.charCodeAt(0),0)%6)+' '+e.kind+(e.continuesBefore?' continues-before':'')+(e.continuesAfter?' continues-after':''),'data-id="'+esc(e.id)+'" style="grid-column:'+e.column+' / span '+e.span+';grid-row:'+e.row+'" title="'+esc(e.title+' · '+e.start+' ~ '+e.end)+'"')).join('')+(packed.overflow.length?button('calendarWeek','+'+packed.overflow.length+'개 · 이번 주 전체','calendar-overflow','data-date="'+days[0]+'" style="grid-column:1 / -1;grid-row:4"'):'')+'</div>';}).join('')+'</div></section>';
 }
 const api={events,shift,weeks,segments,render};if(typeof module!=='undefined')module.exports=api;else root.BoardBriefingCalendar=api;
})(typeof window!=='undefined'?window:globalThis);
