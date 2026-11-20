const test=require('node:test'),assert=require('node:assert/strict'),K=require('../source/html/reports/kpi.js'),Samples=require('./kpi-samples.js'),C=require('./core-fixture.cjs'),Board=require('../source/js/task-board.js');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label,cls='',attrs='')=>'<button data-action="'+action+'" class="'+cls+'" '+attrs+'>'+label+'</button>';
const today='2026-11-20';
const indicator=rows=>K.indicators({rows,Board,C,today});
test('공통 8개와 기획·디자인·퍼블 각 4개를 보유 데이터에서 집계한다',()=>{
 const sample=Samples.create(C,today),before=JSON.stringify(sample),items=K.indicators({...sample,Board,C,today});
 assert.equal(items.length,20);assert.equal(new Set(items.map(item=>item.id)).size,20);
 assert.deepEqual(['공통','기획','디자인','퍼블'].map(role=>items.filter(item=>item.group===role).length),[8,4,4,4]);
 assert.ok(items.every(item=>Number.isFinite(item.value)&&item.formula));assert.equal(JSON.stringify(sample),before);
 const html=K.render({rows:[],Board,C:{...C,today:()=>today},esc,button,samples:Samples,mode:'sample'});assert.equal((html.match(/data-kpi-id=/g)||[]).length,20);assert.match(html,/최근 30일 예시 · 실제 실적 아님/);assert.ok(!html.includes('NaN'));assert.ok(!html.includes('undefined'));
});
test('실제 데이터는 원본만 사용하고 누락 날짜·검수 기록을 가짜 점수로 바꾸지 않는다',()=>{
 const rows=C.importRows(C.emptyState(),[
  {id:'1',과업명:'기한 내 완료',담당자_기획:'성아미',상태_기획:'완료',완료요청일:'2026-11-19',작업내용_기획:'작업시작일자: 2026-11-17\n작업종료일자: 2026-11-19'},
  {id:'2',과업명:'지연 완료',담당자_디자인:'홍소영',상태_디자인:'완료',완료요청일:'2026-11-18',작업내용_디자인:'작업시작일자: 2026-11-18\n작업종료일자: 2026-11-20'},
  {id:'3',과업명:'완료일 없음',담당자_퍼블:'김무현',상태_퍼블:'완료',완료요청일:'2026-11-20'},
  {id:'4',과업명:'기한 경과',담당자_퍼블:'김무현',상태_퍼블:'진행중',완료요청일:'2026-11-19'},
  {id:'5',과업명:'오늘 기한',담당자_기획:'성아미',상태_기획:'진행중',완료요청일:'2026-11-20'}
 ]).state.projects;
 rows[0].overrides={status:'보류',requestedDue:'2026-01-01'};const before=JSON.stringify(rows),items=indicator(rows),byId=Object.fromEntries(items.map(item=>[item.id,item]));
 assert.equal(byId.completion.value,60);assert.equal(byId.onTime.value,50);assert.equal(byId.leadTime.value,3);assert.equal(byId.overdue.value,50);assert.match(byId.onTime.evidence,/3건 중 날짜 확인 2건/);
 assert.ok(items.filter(item=>!item.automatic).every(item=>item.value===null));assert.equal(JSON.stringify(rows),before);
 const html=K.render({rows,Board,C:{...C,today:()=>today},esc,button,samples:Samples,mode:'live'});assert.match(html,/집계 대기/);assert.ok(!html.includes('최근 30일 예시'));
 assert.ok(indicator([]).every(item=>item.unit==='건'?item.value===0:item.value===null));
});
test('잘못된 날짜와 미래 완료일은 소요일·납기 집계에서 제외한다',()=>{
 const rows=C.importRows(C.emptyState(),[{id:'bad',과업명:'날짜 오류',담당자_기획:'성아미',상태_기획:'완료',완료요청일:'2026-11-20',작업내용_기획:'작업시작일자: 2026-02-30\n작업종료일자: 2026-12-01'}]).state.projects;
 const items=indicator(rows);assert.equal(items.find(item=>item.id==='leadTime').value,null);assert.equal(items.find(item=>item.id==='onTime').value,null);
});

test('20개 지표는 파트별 상태·공동 담당·미배정·삭제·중복 과업을 구분한다',()=>{
 const rows=C.importRows(C.emptyState(),[
  {id:'one',과업명:'공동 과업',담당자_기획:'성아미, 정윤정',상태_기획:'완료 후 수정',담당자_디자인:'홍소영',상태_디자인:'완료',완료요청일:'2026-11-22',작업내용_디자인:'작업시작일자: 2026-11-17\n작업종료일자: 2026-11-18'},
  {id:'two',과업명:'미배정'},
  {id:'removed',과업명:'원본에서 제거',담당자_퍼블:'김무현',상태_퍼블:'완료'}
 ]).state.projects;rows[2].sourceRemoved=true;
 const data=[rows[0],rows[0],rows[1],rows[2]],before=JSON.stringify(data),values=Object.fromEntries(indicator(data).map(item=>[item.id,item.value]));
 assert.equal(values.projectCount,2);assert.equal(values.assignedWork,2);assert.equal(values.unassignedProjects,1);assert.equal(values.revisionRate,50);
 assert.equal(values.planning_assigned,1);assert.equal(values.planning_completion,0);assert.equal(values.planning_dueSoon,1);assert.equal(values.planning_revision,1);
 assert.equal(values.design_assigned,1);assert.equal(values.design_completion,100);assert.equal(values.publishing_assigned,0);assert.equal(values.publishing_completion,null);
 assert.ok(!K.definitions.some(item=>['requirements','accessibility','compatibility','planningApproval','designApproval','designSystem'].includes(item.id)));
 assert.equal(JSON.stringify(data),before);
});
