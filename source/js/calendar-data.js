/* Offline Korean calendar. Official references and forecast status: docs/공휴일.md. */
(function(root){
 'use strict';
 const lunar={2024:['02-10','05-15','09-17'],2025:['01-29','05-05','10-06'],2026:['02-17','05-24','09-25'],2027:['02-07','05-13','09-15'],2028:['01-27','05-02','10-03'],2029:['02-13','05-20','09-22'],2030:['02-03','05-09','09-12']};
 const shift=(date,n)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const weekday=date=>new Date(date+'T00:00:00Z').getUTCDay();
 function holidays(year){
  year=Number(year);if(!lunar[year])return null;
  const result={},groups=[];
  const add=(day,name,substitute=false)=>{const date=year+'-'+day;result[date]=result[date]?result[date]+' · '+name:name;if(substitute)groups.push({dates:[date],name,weekend:true});};
  add('01-01','신정');add('03-01','삼일절',true);add('05-05','어린이날',true);add('06-06','현충일');add('08-15','광복절',true);add('10-03','개천절',true);add('10-09','한글날',true);add('12-25','성탄절',true);
  if(year>=2026){add('05-01','노동절',true);add('07-17','제헌절',true);}
  add(lunar[year][1],'부처님오신날',true);
  for(const [center,name] of [[lunar[year][0],'설날'],[lunar[year][2],'추석']]){
   const date=year+'-'+center,dates=[-1,0,1].map(n=>shift(date,n));
   for(const day of dates)result[day]=result[day]?result[day]+' · '+name:name;
   groups.push({dates,name,weekend:false});
  }
  const needs=groups.filter(group=>group.dates.some(date=>(group.weekend?[0,6]:[0]).includes(weekday(date))||result[date].includes(' · ')));
  for(const group of needs.sort((a,b)=>a.dates[0].localeCompare(b.dates[0]))){
   let date=group.dates.at(-1);do{date=shift(date,1);}while([0,6].includes(weekday(date))||result[date]);
   // One substitute day for coincident holidays (e.g. Children's Day and Buddha's birthday).
   if(!needs.some(other=>other!==group&&other.dates.some(date=>group.dates.includes(date))&&needs.indexOf(other)<needs.indexOf(group)))result[date]='대체공휴일('+group.name+')';
  }
  const special={2024:{'04-10':'국회의원선거','10-01':'임시공휴일(국군의 날)'},2025:{'01-27':'임시공휴일','06-03':'대통령선거','10-08':'대체공휴일(추석)'},2026:{'06-03':'전국동시지방선거'},2028:{'04-12':'국회의원선거'},2030:{'06-05':'전국동시지방선거'}};
  for(const [day,name] of Object.entries(special[year]||{}))result[year+'-'+day]=name;
  return result;
 }
 function tone(date){const day=weekday(date);return holidays(date.slice(0,4))?.[date]||day===0?'date-holiday':day===6?'date-saturday':'date-weekday';}
 function birthdays(members,date){return (members||[]).filter(person=>person.active!==false&&person.birthday?.slice(5)===date.slice(5));}
 const api={holidays,tone,birthdays,shift};if(typeof module!=='undefined')module.exports=api;else root.BoardCalendarData=api;
})(typeof window!=='undefined'?window:globalThis);
