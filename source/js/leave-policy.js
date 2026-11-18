(function(root){
 'use strict';
 const read=state=>state.leavePolicy||{enabled:false,grants:[{year:0,days:0},{year:1,days:15}],hires:{}};
 function validate(policy){
  if(policy===undefined)return;
  if(!policy||typeof policy.enabled!=='boolean'||!Array.isArray(policy.grants)||!policy.grants.length||
   new Set(policy.grants.map(row=>row?.year)).size!==policy.grants.length||
   policy.grants.some(row=>!row||!Number.isInteger(row.year)||row.year<0||row.year>80||!Number.isFinite(row.days)||row.days<0||row.days>366||row.days*2%1)||
   !policy.hires||typeof policy.hires!=='object'||Array.isArray(policy.hires)||
   Object.values(policy.hires).some(date=>typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||
    new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date))throw Error('근속연수별 연차 설정을 확인하세요.');
 }
 function allowance(state,name,year){
  const policy=read(state),hire=policy.hires[name];
  if(!policy.enabled||!hire||hire>year+'-01-01')return null;
  const tenure=Number(year)-Number(hire.slice(0,4))-(hire.slice(5)>'01-01'?1:0);
  return policy.grants.filter(row=>row.year<=tenure).sort((a,b)=>b.year-a.year)[0]?.days??null;
 }
 const api={read,validate,allowance};
 if(typeof module!=='undefined')module.exports=api;else root.BoardLeavePolicy=api;
})(typeof window!=='undefined'?window:globalThis);
