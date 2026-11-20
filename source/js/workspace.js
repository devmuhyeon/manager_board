(function(root){
 'use strict';
 const C=typeof module!=='undefined'?require('./core.js'):root.BoardCore,P=typeof module!=='undefined'?require('./personnel.js'):root.BoardPeople;
 const LeavePolicy=typeof module!=='undefined'?require('./leave-policy.js'):root.BoardLeavePolicy;
 const defaults={level2:[...Array.from({length:12},(_,i)=>(i+1)+'월 뉴스레터'),'정기과업','요청과업','홍보'],level3:['뉴스레터 정기','뉴스레터 비정기','구직노하우','정책안내','기업실무','고용동향']};
 function canPersonnel(s,name){return s.members.some(member=>member.name===name&&member.active!==false);}
 function canContent(s,name){return P.canManage(s,name)||(P.isLeader(s,name)&&s.members.find(m=>m.name===name)?.team==='콘텐츠');}
 function contentOptions(s){return {level2:s.contentOptions?.level2??defaults.level2,level3:s.contentOptions?.level3??defaults.level3};}
 function editOption(s,actor,level,value,remove=false){if(!canContent(s,actor))throw new Error('콘텐츠 팀관리자 또는 전체관리자만 선택 항목을 관리할 수 있습니다.');if(!['level2','level3'].includes(level))throw new Error('분류를 선택하세요.');value=String(value||'').trim();if(!value||value.length>100)throw new Error('항목은 1~100자로 입력하세요.');const next=structuredClone(s);next.contentOptions=structuredClone(contentOptions(s));const list=next.contentOptions[level];if(remove)next.contentOptions[level]=list.filter(x=>x!==value);else{if(list.includes(value))throw new Error('이미 있는 항목입니다.');list.push(value);}return next;}
 function classificationKey(p){const c=C.classification(p);return [c.level1,c.level2,c.level3].filter(Boolean).join(' > ');}
 function group(rows,key=p=>classificationKey(p)){const groups=new Map();for(const row of rows){const label=key(row)||'미분류';if(!groups.has(label))groups.set(label,[]);groups.get(label).push(row);}return [...groups].sort(([a],[b])=>a.localeCompare(b,'ko'));}
 function revisionDraft(s,parentId,actor){const parent=s.projects.find(p=>p.id===parentId);if(!parent)throw new Error('원본 과업을 찾을 수 없습니다.');const rootId=parent.parentProjectId||parent.id,original=s.projects.find(p=>p.id===rootId);if(!original)throw new Error('원본 과업이 없습니다.');const p=C.effective(original),number=Math.max(0,...s.projects.filter(x=>x.parentProjectId===rootId).map(x=>Number(x.revisionNumber)||0))+1;return {...structuredClone(p),id:C.uid(),source:'manual',parentProjectId:rootId,revisionNumber:number,title:p.title+' · '+number+'차 수정',status:'예정',requested:C.today(),requestedDue:'',started:C.today(),due:'',logs:[],overrides:{},description:'',tasks:(p.tasks||[]).map(t=>({...t,id:C.uid(),status:'예정',started:C.today(),due:'',notes:'',assignees:t.assignees.length?t.assignees:[actor]}))};}
 function setAllowance(s,actor,owner,year,days,mode='manual'){
  if(!(actor===owner&&s.members.some(m=>m.name===actor&&m.active!==false))&&!P.canManage(s,actor))throw new Error('본인 또는 전체관리자만 연차 총수를 설정할 수 있습니다.');
  year=String(year);days=Number(days);
  if(!/^\d{4}$/.test(year)||!['auto','manual'].includes(mode)||mode==='manual'&&(!Number.isFinite(days)||days<0||days>366||days*2%1))throw new Error('연차 총수는 0~366일, 0.5일 단위로 입력하세요.');
  const next=structuredClone(s);next.leaveAllowanceModes??={};next.leaveAllowanceModes[year]??={};next.leaveAllowanceModes[year][owner]=mode;
  if(mode==='manual'){next.leaveAllowances??={};next.leaveAllowances[year]??={};next.leaveAllowances[year][owner]=days;}
  return next;
 }
 function leaveLedger(s,owner,year,today=C.today()){
  const excluded=new Map(),usedDates=new Map(),period=LeavePolicy.period(s,owner,year,today);
  let calendarSupported=holidayCalendar(period.start.slice(0,4))!==null&&holidayCalendar(period.end.slice(0,4))!==null;
  for(const leave of s.leaves||[]){
   if(leave.owner!==owner||(leave.typeId?leave.dailyUnits===0:leave.type==='기타 휴가'))continue;
   const shift=leave.borrowNextYear?-12:0,yearStart=LeavePolicy.anniversary(period.start,shift),yearEnd=LeavePolicy.anniversary(period.end,shift);
   if(leave.end<yearStart||leave.start>yearEnd)continue;
   const holidays={...holidayCalendar(yearStart.slice(0,4)),...holidayCalendar(yearEnd.slice(0,4))};
   if(holidays===null)calendarSupported=false;
   const start=leave.start>yearStart?leave.start:yearStart,end=leave.end<yearEnd?leave.end:yearEnd;
   const day=new Date(start+'T00:00:00Z');
   while(day.toISOString().slice(0,10)<=end){
    const date=day.toISOString().slice(0,10),weekday=day.getUTCDay();
    if(holidays?.[date])excluded.set(date,{date,name:holidays[date]});
    if(weekday!==0&&weekday!==6&&!holidays?.[date]){
     const units=leave.typeId&&leave.dailyUnits!==undefined?leave.dailyUnits:
      leave.type.includes('반차')?.5:leave.type==='추가 사용'?Number(leave.dailyUnits||1):1;
     const previous=usedDates.get(date)||{date,days:0,types:[],borrowed:Boolean(leave.borrowNextYear)};
     previous.days=Math.min(1,previous.days+units);previous.types.push(leave.type);usedDates.set(date,previous);
    }
    day.setUTCDate(day.getUTCDate()+1);
   }
  }
  const entries=[...usedDates.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const used=entries.filter(entry=>entry.date<=today).reduce((sum,entry)=>sum+entry.days,0);
  const planned=entries.filter(entry=>entry.date>today).reduce((sum,entry)=>sum+entry.days,0);
  const borrowed=entries.filter(entry=>entry.borrowed).reduce((sum,entry)=>sum+entry.days,0);
  const calculatedAllowance=LeavePolicy.cycleAllowance(s,owner,year,today),fixed=s.leaveAllowances?.[year]?.[owner],mode=s.leaveAllowanceModes?.[year]?.[owner];
  const allowanceMode=mode==='manual'||mode===undefined&&calculatedAllowance===null&&fixed!==undefined?'manual':'auto';
  const allowance=allowanceMode==='manual'?(fixed??null):calculatedAllowance;
  return {period,allowance,calculatedAllowance,allowanceMode,used,planned,borrowed,remaining:allowance===null?null:allowance-used,
   available:allowance===null?null:allowance-used-planned,entries,calendarSupported,
   excluded:[...excluded.values()].sort((a,b)=>a.date.localeCompare(b.date))};
 }
 const CalendarData=typeof module!=='undefined'?require('./calendar-data.js'):root.BoardCalendarData;
 const holidayCalendar=year=>CalendarData.holidays(year);
 const api={canPersonnel,canContent,contentOptions,editOption,classificationKey,group,revisionDraft,setAllowance,leaveLedger,holidayCalendar};if(typeof module!=='undefined')module.exports=api;else root.BoardWorkspace=api;
})(typeof window!=='undefined'?window:globalThis);
