(function(root){
 'use strict';
 const Icons=typeof module!=='undefined'?require('../../js/arrow-icons.js'):root.BoardArrowIcons;
 const roles=['기획','디자인','퍼블'];
 const sources=[];
 const common=[
  {id:'projectCount',title:'전체 과업 수',unit:'건',formula:'현재 원본에 존재하는 과업 ID 수',meaning:'기획·디자인·퍼블 업무가 함께 있어도 과업은 한 건으로 집계'},
  {id:'assignedWork',title:'배정된 담당 업무 수',unit:'건',formula:'담당자가 있는 과업·파트 조합 수',meaning:'공동 담당자가 여러 명이어도 같은 과업·파트는 한 건'},
  {id:'unassignedProjects',title:'담당자 미배정 과업 수',unit:'건',formula:'원본에 담당자가 한 명도 없는 과업 수',meaning:'파트 담당자와 공통 담당자가 모두 없는 과업'},
  {id:'completion',title:'전체 업무 완료율',formula:'완료·운영반영완료 담당 업무 ÷ 배정 담당 업무 × 100',meaning:'완료 후 수정은 미완료로 집계'},
  {id:'onTime',title:'기한 내 완료율',formula:'완료일이 완료요청일 이내인 업무 ÷ 완료일·요청일이 있는 완료 업무 × 100',meaning:'실제 완료일과 요청일이 모두 있어야 집계'},
  {id:'leadTime',title:'평균 완료 소요일',unit:'일',formula:'완료 업무의 (종료일 − 시작일 + 1) 합계 ÷ 집계 업무 수',meaning:'실제 시작·종료일이 모두 있는 완료 업무의 달력일 평균'},
  {id:'overdue',title:'마감 초과 미완료율',formula:'마감일이 오늘보다 이른 미완료 업무 ÷ 마감일이 있는 미완료 업무 × 100',meaning:'접수·진행중·완료 후 수정·보류 등 미완료 상태를 포함'},
  {id:'revisionRate',title:'완료 후 수정 업무 비율',formula:'완료 후 수정 상태 업무 ÷ 배정 담당 업무 × 100',meaning:'현재 수정 중인 업무 비중이며 과거 수정 횟수나 품질 점수가 아님'}
 ];
 const perRole=[
  {key:'assigned',title:'배정 업무 수',unit:'건',formula:'해당 파트에 담당자가 있는 과업 수',meaning:'같은 과업의 공동 담당자는 한 건으로 집계'},
  {key:'completion',title:'업무 완료율',formula:'해당 파트의 완료·운영반영완료 업무 ÷ 해당 파트 배정 업무 × 100',meaning:'해당 파트 상태만 사용하며 다른 파트의 완료 상태와 합치지 않음'},
  {key:'dueSoon',title:'3일 내 마감 업무 수',unit:'건',formula:'오늘부터 3일 뒤까지 마감 예정인 해당 파트 미완료 업무 수',meaning:'오늘 마감을 포함하고 이미 마감이 지난 업무는 제외'},
  {key:'revision',title:'수정 진행 업무 수',unit:'건',formula:'해당 파트 상태가 완료 후 수정인 업무 수',meaning:'다른 파트의 수정 여부로 추정하지 않고 현재 파트 상태를 사용'}
 ];
 const definitions=[...common.map(item=>({...item,group:'공통'})),...roles.flatMap((role,index)=>perRole.map(item=>({...item,id:['planning','design','publishing'][index]+'_'+item.key,group:role})))];
 function date(value){const text=String(value||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(text)&&Number.isFinite(Date.parse(text+'T00:00:00Z'))&&new Date(text+'T00:00:00Z').toISOString().slice(0,10)===text?text:'';}
 const first=(fields,keys)=>keys.map(key=>fields[key]).find(value=>value!==undefined&&value!==null&&value!=='');
 const projects=rows=>[...new Map(rows.filter(row=>!row.sourceRemoved).map((row,index)=>[row.id??index,row])).values()];
 function entries(rows,Board,C){
  return projects(rows).flatMap(project=>roles.flatMap(role=>{
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
 function indicators({rows,Board,C,today}){
  const current=projects(rows),all=entries(current,Board,C),completed=all.filter(item=>item.done),dated=completed.filter(item=>item.due&&item.ended&&item.ended<=today);
  const durations=completed.filter(item=>item.started&&item.ended&&item.ended>=item.started&&item.ended<=today);
  const pending=all.filter(item=>!item.done&&item.due),late=pending.filter(item=>item.due<today);
  const unassigned=current.filter(project=>{const source=project.raw?C.normalize(project.raw):project;return !(source.assignees?.length||source.tasks?.some(task=>task.assignees?.length));});
  const revision=all.filter(item=>item.status==='완료후수정');
  const measured={
   projectCount:{value:current.length,evidence:'원본 과업 ID 기준 · '+current.length+'건'},
   assignedWork:{value:all.length,evidence:'과업 × 담당 파트 기준 · '+all.length+'건'},
   unassignedProjects:{value:unassigned.length,evidence:'전체 '+current.length+'건 중 담당자 없음 '+unassigned.length+'건'},
   completion:{value:ratio(completed.length,all.length),evidence:completed.length+' / '+all.length+'건 완료'},
   onTime:{value:ratio(dated.filter(item=>item.ended<=item.due).length,dated.length),evidence:'완료 '+completed.length+'건 중 날짜 확인 '+dated.length+'건'},
   leadTime:{value:durations.length?Math.round(durations.reduce((sum,item)=>sum+(Date.parse(item.ended)-Date.parse(item.started))/86400000+1,0)/durations.length*10)/10:null,evidence:'완료 '+completed.length+'건 중 시작·완료일 확인 '+durations.length+'건'},
   overdue:{value:ratio(late.length,pending.length),evidence:'기한 있는 미완료 '+pending.length+'건 중 '+late.length+'건 초과'},
   revisionRate:{value:ratio(revision.length,all.length),evidence:revision.length+' / '+all.length+'건 수정 진행'}
  };
  const limit=new Date(today+'T00:00:00Z');limit.setUTCDate(limit.getUTCDate()+3);const until=limit.toISOString().slice(0,10);
  roles.forEach((role,index)=>{const tasks=all.filter(item=>item.role===role),prefix=['planning','design','publishing'][index];
   measured[prefix+'_assigned']={value:tasks.length,evidence:'해당 파트 배정 '+tasks.length+'건'};
   measured[prefix+'_completion']={value:ratio(tasks.filter(item=>item.done).length,tasks.length),evidence:tasks.filter(item=>item.done).length+' / '+tasks.length+'건 완료'};
   const soon=tasks.filter(item=>!item.done&&item.due>=today&&item.due<=until);
   measured[prefix+'_dueSoon']={value:soon.length,evidence:today+' ~ '+until+' · '+soon.length+'건'};
   const corrections=tasks.filter(item=>item.status==='완료후수정');
   measured[prefix+'_revision']={value:corrections.length,evidence:'현재 완료 후 수정 '+corrections.length+'건'};
  });
  return definitions.map(definition=>({...definition,...measured[definition.id],automatic:true}));
 }
 function render({rows,Board,C,esc,button,samples,mode='live'}){
  const sample=mode==='sample'&&samples?samples.create(C,C.today()):null;
  const values=indicators({rows:sample?sample.rows:rows,Board,C,today:C.today()});
  const summary=metrics(sample?sample.rows:rows,Board,C,C.today());
  const card=item=>{const available=item.value!==null,unit=item.unit||'%';
   return '<article class="card kpi-indicator" data-kpi-id="'+item.id+'"><div class="kpi-indicator-title"><h3>'+esc(item.title)+'</h3><span class="kpi-data-kind">'+(sample?'샘플':'자동 집계')+'</span></div><div class="kpi-indicator-value"><strong>'+(available?item.value:'—')+'</strong>'+(available?'<span>'+unit+'</span>':'')+'<small>'+(available?'현재 데이터 기준':'집계 대기')+'</small></div>'+(available&&!item.unit?'<progress max="100" value="'+item.value+'" aria-label="'+esc(item.title)+'"></progress>':'<div class="kpi-rule-space"></div>')+'<div class="kpi-evidence"><span>'+esc(item.evidence)+'</span></div><details class="kpi-definition"><summary>산정 기준'+Icons.arrow('down')+'</summary><p>'+esc(item.meaning)+'</p><p>'+esc(item.formula)+'</p></details></article>';
  };
  return '<section class="kpi-dashboard" aria-label="UI·UX KPI 대시보드"><div class="kpi-toolbar"><div><strong>UI·UX KPI · 20개</strong><span class="kpi-mode-note">'+(sample?'최근 30일 예시 · 실제 실적 아님':'연결된 과업 기준 · 현재 스냅샷')+'</span></div><div class="tabs" role="group" aria-label="KPI 데이터">'+button('kpiMode','업무 데이터',!sample?'active':'','data-mode="live" aria-pressed="'+!sample+'"')+button('kpiMode','샘플 보기',sample?'active':'','data-mode="sample" aria-pressed="'+Boolean(sample)+'" '+(!samples?'disabled':''))+'</div></div><p class="kpi-explanation">현재 보유한 과업·담당자·상태·시작일·종료일·완료요청일로 계산하는 지표입니다. 날짜가 없는 업무는 일정·기간 집계에서 제외합니다.</p><div class="kpi-overview">'+summary.map(item=>'<div><strong>'+esc(item.role==='퍼블'?'퍼블리싱':item.role)+'</strong><span>배정 '+item.total+' · 완료 '+item.completed+' · 남은 과업 '+item.remaining+'</span></div>').join('')+'</div><section class="kpi-metric-section"><h2>공통 · 과업과 일정</h2><div class="kpi-common-grid">'+values.filter(item=>item.group==='공통').map(card).join('')+'</div></section><div class="kpi-role-grid">'+roles.map(role=>'<section class="kpi-metric-section"><h2>'+esc(role==='퍼블'?'퍼블리싱':role)+' · 담당 업무 현황</h2><div class="kpi-role-metrics">'+values.filter(item=>item.group===role).map(card).join('')+'</div></section>').join('')+'</div><details class="kpi-references"><summary>집계 데이터 기준'+Icons.arrow('down')+'</summary><p>고객 원본 JSON의 현재 스냅샷만 사용합니다. 개인 편집값·작업자 추가 감지 시각·샘플 검수 점수를 실제 실적에 섞지 않습니다. 담당자가 없는 파트는 담당 업무 집계에서 제외합니다.</p><p>완료는 완료·운영반영완료, 수정은 완료 후 수정 상태입니다. 파트별 담당자·상태와 시작·종료일 필드 또는 작업내용의 작업시작일자·작업종료일자를 사용합니다. 유효하지 않은 날짜·미래 완료일·시작일보다 이른 완료일은 소요일 집계에서 제외합니다.</p><p>분모가 0인 비율·날짜가 없어 계산할 수 없는 소요일은 집계 대기로 표시합니다. 건수는 해당 기록이 없으면 0건입니다. 승인율·접근성·검수 통과율은 해당 기록이 없어 지표에서 제외했습니다.</p></details></section>';
 }
 const api={definitions,sources,entries,metrics,indicators,render};if(typeof module!=='undefined')module.exports=api;else root.BoardKpi=api;
})(typeof window!=='undefined'?window:globalThis);
