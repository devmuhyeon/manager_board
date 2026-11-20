(function(root){
 'use strict';
 const CalendarData=typeof module!=='undefined'?require('./calendar-data.js'):root.BoardCalendarData;
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
   return button('leaveDay','<span class="leave-week-date '+CalendarData.tone(day)+'"><strong>'+Number(day.slice(-2))+'</strong>'+['월','화','수','목','금','토','일'][index]+'</span>'+
    (count?'<span class="leave-week-count"><span>휴가자</span><strong>'+count+'명</strong></span>':''),
    'leave-week-day'+(selected===day?' selected':'')+(index>4?' weekend':'')+(day===today?' today':''),
    'data-date="'+day+'" aria-pressed="'+(selected===day)+'" aria-label="'+esc(day)+' 휴가 '+count+'명"');
  }).join('')+'</div></div>';
 }
 function render({rows,month,C,Calendar,esc,button,orderNames=names=>names}){
  const today=C.today();
  const weeks=Calendar.weeks(month).map(days=>{
   const dates=days.map((date,index)=>'<div class="leave-calendar-date'+(date.slice(0,7)!==month?' outside':'')+(date===today?' today':'')+' '+CalendarData.tone(date)+
    '" style="grid-column:'+(index+1)+';grid-row:1"><time datetime="'+date+'"'+(date===today?' aria-current="date"':'')+'>'+Number(date.slice(-2))+'</time></div>').join('');
   const summaries=days.map((date,index)=>{
    const leaves=rows.filter(leave=>leave.start<=date&&leave.end>=date);
    const people=orderNames([...new Set(leaves.map(leave=>leave.owner))]);
    if(!people.length)return '';
    const label=people[0]+(people.length>1?' 외 '+(people.length-1)+'명':'');
    const detail=leaves.map(leave=>leave.owner+' · '+leave.type+(leave.borrowNextYear?' · 내년 연차':'')).join(', ');
    return button('leaveMonthDay',esc(label),'leave-calendar-summary','data-date="'+date+'" style="grid-column:'+(index+1)+';grid-row:2" title="'+esc(detail)+'" aria-label="'+esc(date+' '+detail)+'"');
   }).join('');
   return '<div class="leave-calendar-week" style="--leave-lanes:1"><div class="leave-calendar-gridlines" aria-hidden="true">'+
    days.map(()=>'<span></span>').join('')+'</div>'+dates+summaries+'</div>';
  }).join('');
  return '<div class="leave-calendar-scroll"><div class="leave-calendar" aria-label="'+esc(month)+' 휴가 달력">'+
   '<div class="leave-calendar-weekdays">'+['월','화','수','목','금','토','일'].map((day,index)=>'<span class="'+(index===6?'date-holiday':index===5?'date-saturday':'date-weekday')+'">'+day+'</span>').join('')+'</div>'+weeks+'</div></div>';
 }
 const api={render,week,weekOverview};
 if(typeof module!=='undefined')module.exports=api;else root.BoardLeaveCalendar=api;
})(typeof window!=='undefined'?window:globalThis);
