(function(root){
 'use strict';
 const validDays=days=>Number.isFinite(days)&&days>=0&&days<=366&&days*2%1===0;
 const validYear=year=>Number.isInteger(year)&&year>=1&&year<=80;
 const statutoryDays=tenure=>Math.min(25,15+Math.floor((tenure-1)/2));
 const statutory=()=>({grants:Array.from({length:10},(_,index)=>({from:index*2+1,to:index*2+2,days:15+index})),cap:{from:21,days:25}});
 function read(state){
  if(!state.leavePolicy)return {version:2,enabled:false,...statutory(),hires:{}};
  const policy=state.leavePolicy;
  if(policy.version===2)return {firstYear:{mode:'monthly',days:11},...structuredClone(policy)};
  const thresholds=policy.grants.filter(row=>row.year>=1).slice().sort((a,b)=>a.year-b.year);
  const last=thresholds.at(-1)||{year:1,days:0};
  return {version:2,enabled:policy.enabled,hires:structuredClone(policy.hires),
   grants:thresholds.slice(0,-1).map((row,index)=>({from:row.year,to:thresholds[index+1].year-1,days:row.days})),
   cap:{from:last.year,days:last.days}};
 }
 function validate(policy){
  if(policy===undefined)return;
  const invalid=()=>{throw Error('근속연수 범위와 부여 일수를 확인하세요.');};
  if(!policy||typeof policy.enabled!=='boolean'||!Array.isArray(policy.grants)||
   !policy.hires||typeof policy.hires!=='object'||Array.isArray(policy.hires)||
   Object.values(policy.hires).some(date=>typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||
    new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date))invalid();
  if(policy.version===2){
   if(policy.firstYear&&(!['monthly','annual'].includes(policy.firstYear.mode)||!validDays(policy.firstYear.days)||policy.firstYear.days<11))invalid();
   if(policy.grants.length>80||!policy.cap||!validYear(policy.cap.from)||!validDays(policy.cap.days)||
    policy.grants.some(row=>!row||!validYear(row.from)||!validYear(row.to)||row.from>row.to||row.to>=policy.cap.from||!validDays(row.days)))invalid();
   const sorted=policy.grants.slice().sort((a,b)=>a.from-b.from);
   if(sorted.some((row,index)=>index&&row.from<=sorted[index-1].to))invalid();
   if(policy.cap.days<25||policy.grants.some(row=>row.days<statutoryDays(row.to)))throw Error('법정 기본 일수보다 적게 설정할 수 없습니다. 최대 부여 구간은 25일 이상으로 설정하세요.');
  }else if(!policy.grants.length||new Set(policy.grants.map(row=>row?.year)).size!==policy.grants.length||
   policy.grants.some(row=>!row||!Number.isInteger(row.year)||row.year<0||row.year>80||!validDays(row.days)))invalid();
 }
 function anniversary(hire,months){
  const date=new Date(hire+'T00:00:00Z'),day=date.getUTCDate();
  date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+months);
  const last=new Date(date);last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
  date.setUTCDate(Math.min(day,last.getUTCDate()));
  return date.toISOString().slice(0,10);
 }
 function grantsForYear(state,name,year,today){
  const policy=read(state),hire=policy.hires[name];
  if(!policy.enabled||!hire)return null;
  const end=year+'-12-31',reference=today.slice(0,4)<year?year+'-01-01':today>end?end:today;
  if(hire>reference)return null;
  let tenure=Number(reference.slice(0,4))-Number(hire.slice(0,4));
  if(reference<anniversary(hire,tenure*12))tenure--;
  let monthly=0;
  for(let month=1;month<12;month++){
   const grant=anniversary(hire,month);
   if(grant.slice(0,4)===year&&grant<=today&&grant<=end)monthly++;
  }
  const configured=tenure>=policy.cap.from?policy.cap.days:policy.grants.find(row=>tenure>=row.from&&tenure<=row.to)?.days;
  const annual=tenure<1?0:Math.max(statutoryDays(tenure),configured??0);
  return {tenure,monthly,annual};
 }
 function allowance(state,name,year,today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())){
  return cycleAllowance(state,name,String(year),today);
 }
 function tenure(hire,today){
  if(!hire||hire>today)return null;
  let months=(Number(today.slice(0,4))-Number(hire.slice(0,4)))*12+Number(today.slice(5,7))-Number(hire.slice(5,7));
  if(anniversary(hire,months)>today)months--;
  return {years:Math.floor(months/12),months:months%12,totalMonths:months};
 }
 function period(state,name,year,today){
  const hire=read(state).hires[name]||state.members?.find(person=>person.name===name)?.hireDate;
  if(!hire)return {start:year+'-01-01',end:year+'-12-31',hire:null};
  let months=(Number(year)-Number(hire.slice(0,4)))*12;
  if(String(year)===today.slice(0,4)&&anniversary(hire,months)>today)months-=12;
  months=Math.max(0,months);
  const start=anniversary(hire,months),next=anniversary(hire,months+12),end=new Date(next+'T00:00:00Z');end.setUTCDate(end.getUTCDate()-1);
  return {start,end:end.toISOString().slice(0,10),hire};
 }
 function cycleAllowance(state,name,year,today){
  const policy=read(state),cycle=period(state,name,year,today);
  if(!policy.enabled||!cycle.hire)return null;
  const service=tenure(cycle.hire,cycle.start)?.years||0;
  if(service===0){
   const monthly=Math.min(11,Math.max(0,tenure(cycle.hire,today<cycle.end?today:cycle.end)?.totalMonths||0));
   return policy.firstYear?.mode==='annual'?Math.max(monthly,policy.firstYear.days):monthly;
  }
  const configured=service>=policy.cap.from?policy.cap.days:policy.grants.find(row=>service>=row.from&&service<=row.to)?.days;
  return Math.max(statutoryDays(service),configured||0);
 }
 const api={read,validate,allowance,cycleAllowance,period,tenure,anniversary,grantsForYear,statutory,statutoryDays};
 if(typeof module!=='undefined')module.exports=api;else root.BoardLeavePolicy=api;
})(typeof window!=='undefined'?window:globalThis);
