(function(root){
 'use strict';
 function render({rows,month,C,Calendar,esc,button,canEdit}){
  const events=rows.map(leave=>({...leave,start:leave.start,end:leave.end,title:leave.owner+' · '+leave.type}));
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
 const api={render};
 if(typeof module!=='undefined')module.exports=api;else root.BoardLeaveCalendar=api;
})(typeof window!=='undefined'?window:globalThis);
