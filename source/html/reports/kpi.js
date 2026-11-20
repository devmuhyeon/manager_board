(function(root){
 'use strict';
 function metrics(rows,Board,C,today){
  return ['기획','디자인','퍼블'].map(role=>{
   const tasks=rows.map(project=>({project,detail:Board.sourceDetails(project,role)})).filter(item=>String(item.detail.assignees||'').trim());
   const completed=tasks.filter(item=>C.isComplete(item.detail.status));
   const overdue=tasks.filter(item=>!C.isComplete(item.detail.status)&&item.detail.requestedDue&&item.detail.requestedDue<today);
   return {role,total:tasks.length,completed:completed.length,remaining:tasks.length-completed.length,overdue:overdue.length,rate:tasks.length?Math.round(completed.length/tasks.length*100):0};
  });
 }
 function render({rows,Board,C,esc,button}){
  const items=metrics(rows,Board,C,C.today());
  return '<section class="kpi-dashboard" aria-label="UI·UX KPI 대시보드"><div class="kpi-intro"><strong>UI·UX KPI <span class="badge">시안</span></strong><span>고객 원본 기준 · 기획 / 디자인 / 퍼블리싱</span></div><div class="kpi-grid">'+items.map(item=>'<article class="card kpi-card"><h2>'+esc(item.role==='퍼블'?'퍼블리싱':item.role)+'</h2><div class="kpi-rate"><strong>'+item.rate+'<small>%</small></strong><span>완료율</span></div><progress max="100" value="'+item.rate+'" aria-label="'+item.role+' 완료율"></progress><dl>'+[['할당 과업',item.total],['완료',item.completed],['남은 과업',item.remaining],['기한 경과',item.overdue]].map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('')+'</dl></article>').join('')+'</div><p class="muted kpi-note">담당 파트가 있는 과업만 집계합니다. 완료는 고객 원본의 파트별 상태, 기한 경과는 완료요청일 기준입니다. 근무시간·기여도·품질 점수는 추정하지 않습니다.</p></section>';
 }
 const api={metrics,render};if(typeof module!=='undefined')module.exports=api;else root.BoardKpi=api;
})(typeof window!=='undefined'?window:globalThis);
