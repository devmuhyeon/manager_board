const test=require('node:test'),assert=require('node:assert/strict'),K=require('../source/html/reports/kpi.js'),Samples=require('./kpi-samples.js'),C=require('./core-fixture.cjs'),Board=require('../source/js/task-board.js');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label,cls='',attrs='')=>'<button data-action="'+action+'" class="'+cls+'" '+attrs+'>'+label+'</button>';
const today='2026-11-20';
const indicator=rows=>K.indicators({rows,Board,C,today});
test('공통 4개와 기획·디자인·퍼블 각 2개를 샘플 수치로 채운다',()=>{
 const sample=Samples.create(C,today),before=JSON.stringify(sample),items=K.indicators({...sample,Board,C,today});
 assert.equal(items.length,10);assert.equal(new Set(items.map(item=>item.id)).size,10);
 assert.deepEqual(['공통','기획','디자인','퍼블'].map(role=>items.filter(item=>item.group===role).length),[4,2,2,2]);
 assert.ok(items.every(item=>Number.isFinite(item.value)&&item.formula));assert.equal(JSON.stringify(sample),before);
 const html=K.render({rows:[],Board,C:{...C,today:()=>today},esc,button,samples:Samples});assert.equal((html.match(/data-kpi-id=/g)||[]).length,10);assert.match(html,/최근 30일 예시 · 실제 실적 아님/);assert.ok(!html.includes('NaN'));assert.ok(!html.includes('undefined'));
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
 assert.ok(indicator([]).every(item=>item.value===null));
});
test('잘못된 날짜와 미래 완료일은 소요일·납기 집계에서 제외한다',()=>{
 const rows=C.importRows(C.emptyState(),[{id:'bad',과업명:'날짜 오류',담당자_기획:'성아미',상태_기획:'완료',완료요청일:'2026-11-20',작업내용_기획:'작업시작일자: 2026-02-30\n작업종료일자: 2026-12-01'}]).state.projects;
 const items=indicator(rows);assert.equal(items.find(item=>item.id==='leadTime').value,null);assert.equal(items.find(item=>item.id==='onTime').value,null);
});
