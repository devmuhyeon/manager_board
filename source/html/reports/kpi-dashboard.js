(function(root){
 'use strict';
 const Icons=typeof module!=='undefined'?require('../../js/arrow-icons.js'):root.BoardArrowIcons;
 const roles=['기획','디자인','퍼블'];
 const sources=[
  {id:'sla',label:'국세청 · 서비스요청 SLA',url:'https://www.law.go.kr/admRulLsInfoP.do?admRulId=35023&efYd=0'},
  {id:'acceptance',label:'공공 발주 · 요구사항·검수',url:'https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK01803515&bidPbancOrd=000&fileSeq=3&fileType=&prcmBsneSeCd=03'},
  {id:'design',label:'디자인 용역 · 시안·퍼블 검수',url:'https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R25BK01225177&bidPbancOrd=000&fileSeq=4&fileType=&prcmBsneSeCd=09'},
  {id:'krds',label:'행정안전부 · KRDS',url:'https://www.krds.go.kr/html/site/utility/utility_07.html'},
  {id:'accessibility',label:'웹와치 · 접근성 심사',url:'https://www.webwatch.or.kr/contents/view/3'},
  {id:'compatibility',label:'NIA · 접근성·호환성 점검',url:'https://www.nia.or.kr/site/nia_kor/ex/bbs/View.do?bcIdx=21265&cbIdx=90180'}
 ];
 const definitions=[
  {id:'completion',group:'공통',title:'요청 처리 완료율',target:90,direction:'up',formula:'완료한 담당 업무 ÷ 배정된 담당 업무 × 100',meaning:'접수된 업무가 실제 완료로 이어지는 비율',source:'sla'},
  {id:'onTime',group:'공통',title:'납기 준수율',target:95,direction:'up',formula:'기한 내 완료 업무 ÷ 완료일·기한이 있는 완료 업무 × 100',meaning:'고객과 정한 완료요청일 이내에 처리한 비율',source:'sla'},
  {id:'leadTime',group:'공통',title:'평균 작업 소요일',target:5,direction:'down',unit:'일',formula:'완료 업무의 (완료일 − 시작일 + 1) 합계 ÷ 집계 업무 수',meaning:'시작·완료일을 포함한 달력일 기준 처리 기간',source:'sla'},
  {id:'overdue',group:'공통',title:'지연 과업 비율',target:10,direction:'down',formula:'기한이 지난 미완료 업무 ÷ 기한이 있는 미완료 업무 × 100',meaning:'진행 중 업무에서 납기 위험을 조기에 확인',source:'sla'},
  {id:'requirements',group:'기획',title:'요구사항 반영률',target:100,direction:'up',formula:'검수로 확인된 반영 요구사항 ÷ 확정 요구사항 × 100',meaning:'요구사항 ID와 설계·구현·검수 결과의 연결',source:'acceptance',fields:'확정 요구사항 목록, 반영·검수 결과'},
  {id:'planningApproval',group:'기획',title:'설계 산출물 1차 승인율',target:90,direction:'up',formula:'최초 검토에서 승인된 산출물 ÷ 최초 검토한 산출물 × 100',meaning:'화면설계서·정책서의 첫 검토 완성도',source:'design',fields:'산출물 ID, 검토 차수, 최초 승인 결과'},
  {id:'designSystem',group:'디자인',title:'디자인 가이드 준수율',target:95,direction:'up',formula:'가이드 점검 통과 항목 ÷ 점검한 항목 × 100',meaning:'색상·서체·컴포넌트·상태 표현의 일관성',source:'krds',fields:'적용 가이드, 점검 항목, 통과 결과'},
  {id:'designApproval',group:'디자인',title:'디자인 시안 1차 승인율',target:85,direction:'up',formula:'최초 검토에서 승인된 시안 ÷ 최초 검토한 시안 × 100',meaning:'요구사항과 발주처 의도가 첫 시안에 반영된 정도',source:'design',fields:'시안 ID, 검토 차수, 최초 승인 결과'},
  {id:'accessibility',group:'퍼블',title:'접근성 점검 통과율',target:100,direction:'up',formula:'통과한 적용 대상 점검 항목 ÷ 점검한 적용 대상 항목 × 100',meaning:'키보드·초점·대체텍스트·명도 대비 등 자체 점검',source:'accessibility',fields:'점검 기준·버전, 적용 대상 항목, 전문가·사용자 점검 결과'},
  {id:'compatibility',group:'퍼블',title:'반응형·호환성 검증 통과율',target:98,direction:'up',formula:'통과한 화면·환경 시나리오 ÷ 시험한 시나리오 × 100',meaning:'PC·모바일과 합의한 브라우저에서 화면·기능 검증',source:'compatibility',fields:'대상 화면, 기기·브라우저 조합, 시험 결과'}
 ];
 function date(value){const text=String(value||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(text)&&Number.isFinite(Date.parse(text+'T00:00:00Z'))&&new Date(text+'T00:00:00Z').toISOString().slice(0,10)===text?text:'';}
 const first=(fields,keys)=>keys.map(key=>fields[key]).find(value=>value!==undefined&&value!==null&&value!=='');
 function entries(rows,Board,C){
  return rows.filter(project=>!project.sourceRemoved).flatMap(project=>roles.flatMap(role=>{
   const detail=Board.sourceDetails(project,role),task=project.tasks?.find(task=>task.role===role);
   const raw=project.raw,fields=raw?{...raw,...(raw.처리결과||raw.처리정보||{})}:{};
   const assignees=raw?detail.assignees:task?.assignees?.join(', ')||detail.assignees;
   if(!String(assignees||'').trim())return [];
   const status=String(raw?detail.status:task?.status||detail.status).replace(/\s/g,'');
   const started=date(raw?first(fields,['작업시작일_'+role,'시작일_'+role])||detail.start:task?.started);
   const ended=date(raw?first(fields,['작업종료일_'+role,'완료일_'+role])||detail.end:task?.completedOn);
   const due=date(raw?first(fields,['완료요청일_'+role,'마감일_'+role])||detail.requestedDue:task?.due||detail.requestedDue);
   return [{role,status,started,ended,due,done:C.isComplete(status),projectId:project.id}];
  }));
 }
 function metrics(rows,Board,C,today){
  const all=entries(rows,Board,C);
  return roles.map(role=>{const tasks=all.filter(item=>item.role===role),completed=tasks.filter(item=>item.done),overdue=tasks.filter(item=>!item.done&&item.due&&item.due<today);return {role,total:tasks.length,completed:completed.length,remaining:tasks.length-completed.length,overdue:overdue.length,rate:tasks.length?Math.round(completed.length/tasks.length*100):0};});
 }
 const ratio=(count,total)=>total?Math.round(count/total*1000)/10:null;
 function indicators({rows,Board,C,today,measurements={}}){
  const all=entries(rows,Board,C),completed=all.filter(item=>item.done),dated=completed.filter(item=>item.due&&item.ended&&item.ended<=today);
  const durations=completed.filter(item=>item.started&&item.ended&&item.ended>=item.started&&item.ended<=today);
  const pending=all.filter(item=>!item.done&&item.due),late=pending.filter(item=>item.due<today);
  const automatic={
   completion:{value:ratio(completed.length,all.length),evidence:completed.length+' / '+all.length+'건 완료'},
   onTime:{value:ratio(dated.filter(item=>item.ended<=item.due).length,dated.length),evidence:'완료 '+completed.length+'건 중 날짜 확인 '+dated.length+'건'},
   leadTime:{value:durations.length?Math.round(durations.reduce((sum,item)=>sum+(Date.parse(item.ended)-Date.parse(item.started))/86400000+1,0)/durations.length*10)/10:null,evidence:'완료 '+completed.length+'건 중 시작·완료일 확인 '+durations.length+'건'},
   overdue:{value:ratio(late.length,pending.length),evidence:'진행 '+pending.length+'건 중 '+late.length+'건 지연'}
  };
  return definitions.map(definition=>{
   const measured=measurements[definition.id];
   const quality=measured&&Number.isInteger(measured.passed)&&Number.isInteger(measured.total)&&measured.total>0&&measured.passed>=0&&measured.passed<=measured.total?{value:ratio(measured.passed,measured.total),evidence:measured.passed+' / '+measured.total+'건 통과'}:{value:null,evidence:'검수·점검 기록 연결 필요'};
   return {...definition,...(automatic[definition.id]||quality),automatic:Boolean(automatic[definition.id])};
  });
 }
 function render({rows,Board,C,esc,button,samples,mode='sample'}){
  const sample=mode==='sample'&&samples?samples.create(C,C.today()):null;
  const values=indicators({rows:sample?sample.rows:rows,Board,C,today:C.today(),measurements:sample?.measurements});
  const summary=metrics(sample?sample.rows:rows,Board,C,C.today());
  const card=item=>{
   const available=item.value!==null,good=available&&(item.direction==='up'?item.value>=item.target:item.value<=item.target);
   const unit=item.unit||'%',target=(item.direction==='up'?'≥ ':'≤ ')+item.target+unit;
   return '<article class="card kpi-indicator" data-kpi-id="'+item.id+'"><div class="kpi-indicator-title"><h3>'+esc(item.title)+'</h3><span class="kpi-data-kind">'+(sample?'샘플':item.automatic?'자동':'기록 필요')+'</span></div><div class="kpi-indicator-value"><strong>'+(available?item.value:'—')+'</strong>'+(available?'<span>'+unit+'</span>':'')+'<small class="'+(available?good?'is-good':'needs-review':'')+'">'+(available?good?'목표 달성':'개선 필요':'집계 대기')+'</small></div>'+
    (available&&!item.unit?'<progress max="100" value="'+item.value+'" aria-label="'+esc(item.title)+'"></progress>':'<div class="kpi-rule-space"></div>')+
    '<div class="kpi-evidence"><span>'+esc(item.evidence)+'</span><span>목표안 '+target+'</span></div><details class="kpi-definition"><summary>산정 기준'+Icons.arrow('down')+'</summary><p>'+esc(item.meaning)+'</p><p>'+esc(item.formula)+'</p>'+(item.fields?'<p>필요 기록: '+esc(item.fields)+'</p>':'')+(item.id==='accessibility'?'<p>자체 점검 비율이며 접근성 인증 점수가 아닙니다.</p>':'')+'</details></article>';
  };
  return '<section class="kpi-dashboard" aria-label="UI·UX KPI 대시보드"><div class="kpi-toolbar"><div><strong>UI·UX KPI</strong><span class="kpi-mode-note">'+(sample?'최근 30일 예시 · 실제 실적 아님':'연결된 과업 기준 · 현재 스냅샷')+'</span></div><div class="tabs" role="group" aria-label="KPI 데이터">'+button('kpiMode','샘플 보기',sample?'active':'','data-mode="sample" aria-pressed="'+Boolean(sample)+'" '+(!samples?'disabled':''))+button('kpiMode','업무 데이터',!sample?'active':'','data-mode="live" aria-pressed="'+!sample+'"')+'</div></div>'+
   '<p class="kpi-explanation">공공기관 서비스요청 SLA·검수·UI 품질 기준을 참고한 10개 제안 지표입니다. 목표값은 검토용이며 기관의 공식 목표가 아닙니다.</p>'+
   '<div class="kpi-overview">'+summary.map(item=>'<div><strong>'+esc(item.role==='퍼블'?'퍼블리싱':item.role)+'</strong><span>배정 '+item.total+' · 완료 '+item.completed+' · 남은 과업 '+item.remaining+'</span></div>').join('')+'</div>'+
   '<section class="kpi-metric-section"><h2>공통 · 처리와 일정</h2><div class="kpi-common-grid">'+values.filter(item=>item.group==='공통').map(card).join('')+'</div></section>'+
   '<div class="kpi-role-grid">'+roles.map(role=>'<section class="kpi-metric-section"><h2>'+esc(role==='퍼블'?'퍼블리싱':role)+' · '+(role==='기획'?'요구사항과 설계':role==='디자인'?'일관성과 승인':'접근성과 구현 품질')+'</h2><div class="kpi-role-metrics">'+values.filter(item=>item.group===role).map(card).join('')+'</div></section>').join('')+'</div>'+
   '<details class="kpi-references"><summary>참고 사례와 데이터 기준'+Icons.arrow('down')+'</summary><p>지표와 산식은 WorkLog 업무에 맞춘 제안입니다. 승인·검수 기록이 없는 실제 과업에는 품질 점수를 만들지 않습니다. 시작·완료일 누락 과업은 기간·납기 산정에서 제외하고 집계 건수를 표시합니다.</p><ul>'+sources.map(source=>'<li><a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.label)+'</a></li>').join('')+'</ul></details></section>';
 }
 const api={definitions,sources,entries,metrics,indicators,render};if(typeof module!=='undefined')module.exports=api;else root.BoardKpi=api;
})(typeof window!=='undefined'?window:globalThis);
