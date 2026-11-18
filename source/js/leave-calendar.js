(function(root){
 'use strict';
 function week(date){
  const first=new Date(date+'T00:00:00Z');
  first.setUTCDate(first.getUTCDate()-(first.getUTCDay()+6)%7);
  return Array.from({length:7},(_,index)=>{
   const day=new Date(first);day.setUTCDate(day.getUTCDate()+index);return day.toISOString().slice(0,10);
  });
 }
 function weekOverview({rows,date,selected,today,esc,button}){
  return '<div class="leave-week-scroll"><div class="leave-week-overview" role="group" aria-label="주간 휴가 현황">'+week(date).map((day,index)=>{
   const count=new Set(rows.filter(leave=>leave.start<=day&&leave.end>=day).map(leave=>leave.owner)).size;
   return button('leaveDay','<span class="leave-week-date"><strong>'+Number(day.slice(-2))+'</strong>'+['월','화','수','목','금','토','일'][index]+'</span>'+
    (count?'<span class="leave-week-count"><span>휴가자</span><strong>'+count+'명</strong></span>':''),
    'leave-week-day'+(selected===day?' selected':'')+(index>4?' weekend':'')+(day===today?' today':''),
    'data-date="'+day+'" aria-pressed="'+(selected===day)+'" aria-label="'+esc(day)+' 휴가 '+count+'명"');
  }).join('')+'</div></div>';
 }
 function render({rows,month,C,Calendar,esc,button,canEdit}){
  const events=rows.map(leave=>({...leave,start:leave.start,end:leave.end,title:leave.owner+' · '+leave.type+(leave.borrowNextYear?' · 내년 연차':'')}));
  const today=C.today();
  const weeks=Calendar.weeks(month).map(days=>{
   const items=Calendar.segments(events,days,Math.max(1,events.length)).visible;
   const lanes=Math.max(1,...items.map(item=>item.row-1));
   const dates=days.map((date,i)=>'<div class="leave-calendar-date'+(date.slice(0,7)!==month?' outside':'')+(date===today?' today':'')+
    '" style="grid-column:'+(i+1)+';grid-row:1"><time datetime="'+date+'"'+(date===today?' aria-current="date"':'')+'>'+Number(date.slice(-2))+'</time></div>').join('');
   const bars=items.map(item=>{
    const tone=item.dailyUnits===.5||item.type.includes('반차')?'half':item.type==='연차'?'annual':'other';
    const attrs='style="grid-column:'+item.column+' / span '+item.span+';grid-row:'+item.row+'" title="'+esc(item.title+' · '+item.start+' ~ '+item.end)+'"';
    const text=esc(item.title);
    return canEdit(item)?button('editLeave',text,'leave-calendar-event '+tone,'data-id="'+esc(item.id)+'" '+attrs):
     '<div class="leave-calendar-event '+tone+'" '+attrs+'>'+text+'</div>';
   }).join('');
   return '<div class="leave-calendar-week" style="--leave-lanes:'+lanes+'">'+
    '<div class="leave-calendar-gridlines" aria-hidden="true">'+days.map(()=>'<span></span>').join('')+'</div>'+dates+bars+'</div>';
  }).join('');
  return '<div class="leave-calendar-scroll"><div class="leave-calendar" aria-label="'+esc(month)+' 휴가 달력">'+
   '<div class="leave-calendar-weekdays">'+['월','화','수','목','금','토','일'].map(day=>'<span>'+day+'</span>').join('')+'</div>'+weeks+'</div></div>';
 }
 const api={render,week,weekOverview};
 if(typeof module!=='undefined')module.exports=api;else root.BoardLeaveCalendar=api;
})(typeof window!=='undefined'?window:globalThis);
