const test=require('node:test'),assert=require('node:assert/strict'),C=require('../js/core.js'),P=require('../js/personnel.js'),Calendar=require('../js/briefing-calendar.js');
test('달력은 본인 참여 프로젝트 전체 기간과 본인 메모 기간만 표시한다',()=>{
 const state={projects:[{id:'p',title:'공동',tasks:[{id:'a',assignees:['본인'],started:'2026-10-30',due:'2026-11-03',status:'진행중'},{id:'b',assignees:['동료'],started:'2026-11-01',due:'2026-11-10',status:'진행중'}]},{id:'other',title:'다른 프로젝트',assignees:['동료'],started:'2026-11-01',due:'2026-11-02'}],personal:{본인:[{id:'m',title:'내 메모',date:'2026-11-02',endDate:'2026-11-05'},{id:'none',title:'무날짜'}],동료:[{id:'secret',title:'타인',date:'2026-11-02'}]}};
 const events=Calendar.events(state,'본인',C);assert.deepEqual(events.map(e=>e.id),['p','m']);assert.equal(events[0].start,'2026-10-30');assert.equal(events[0].end,'2026-11-10');assert.equal(events[1].end,'2026-11-05');
 assert.equal(Calendar.shift('2026-12',1),'2027-01');assert.equal(Calendar.shift('2026-01',-1),'2025-12');
});
test('메모 기간 저장과 역전 기간 검증 및 주간 일정 겹침을 처리한다',()=>{
 const state=P.upgrade({...C.sampleState(),projects:[]});
 const saved=P.savePersonal(state,'김무현',{title:'검토',date:'2026-11-01',endDate:'2026-11-12'});
 assert.equal(saved.personal['김무현'][0].endDate,'2026-11-12');assert.equal(P.schedule(saved,'김무현',{start:'2026-11-09',end:'2026-11-15'}).length,1);
 assert.throws(()=>P.savePersonal(state,'김무현',{title:'역전',date:'2026-11-05',endDate:'2026-11-01'}));
 assert.throws(()=>P.savePersonal(state,'김무현',{title:'종료만',endDate:'2026-11-01'}));
});
