const test=require('node:test'),assert=require('node:assert/strict');
const C=require('./core-fixture.cjs'),P=require('./people-fixture.cjs'),L=require('../source/js/leave-policy.js'),W=require('../source/js/workspace.js'),Calendar=require('../source/js/calendar-data.js'),Cards=require('../source/js/card-expenses.js'),B=require('../source/js/team-board.js'),A=require('../source/html/organization/board/attachments.js'),Kpi=require('../source/html/reports/kpi.js'),Board=require('../source/js/task-board.js');
const state=()=>P.migrateRoles(P.upgrade(C.sampleState()));
test('입사일 주기 경계에서 이전 연차 사용과 다음 부여를 분리한다',()=>{
 const s=state(),name='김무현';s.leavePolicy={version:2,enabled:true,...L.statutory(),hires:{[name]:'2025-06-16'}};s.leaveAllowances={};
 s.leaves=[{owner:name,start:'2026-06-15',end:'2026-06-15',type:'연차'},{owner:name,start:'2026-06-16',end:'2026-06-16',type:'연차'}];
 const before=W.leaveLedger(s,name,'2026','2026-06-15');assert.equal(before.period.start,'2025-06-16');assert.equal(before.period.end,'2026-06-15');assert.equal(before.allowance,11);assert.equal(before.used,1);
 const after=W.leaveLedger(s,name,'2026','2026-06-16');assert.equal(after.period.start,'2026-06-16');assert.equal(after.period.end,'2027-06-15');assert.equal(after.allowance,15);assert.equal(after.used,1);
 s.leavePolicy.firstYear={mode:'annual',days:15};assert.equal(L.cycleAllowance(s,name,'2025','2025-06-16'),15);
 assert.equal(L.cycleAllowance({...s,leavePolicy:{...s.leavePolicy,firstYear:{mode:'monthly',days:11}}},name,'2025','2025-07-15'),0);
 assert.deepEqual(L.tenure('2025-06-16','2026-11-20'),{years:1,months:5,totalMonths:17});
});
test('관리자가 다른 관리자를 퇴사 처리하고 마지막 관리자와 잘못된 멤버 수정은 차단한다',()=>{
 let s=state();s=P.setAdministrators(s,'김무현',['김무현','성아미']);s=P.removeMember(s,'성아미','keep');assert.equal(P.isOverallAdmin(s,'성아미'),false);C.validateState(s);assert.throws(()=>P.removeMember(s,'김무현','keep'),/마지막/);
 const before=JSON.stringify(s);assert.throws(()=>P.editMember(s,'김무현',{name:'정윤정',rank:'과장',birthday:'2026-02-30'}));assert.equal(JSON.stringify(s),before);
 assert.throws(()=>P.editMember(s,'정윤정',{name:'정윤정',rank:'과장'}),/관리자/);
 s=P.editMember(s,'김무현',{name:'정윤정',team:'기획',rank:'과장',birthday:'1993-11-20',hireDate:'2024-06-01'});assert.equal(s.members.find(m=>m.name==='정윤정').birthday,'1993-11-20');assert.equal(Calendar.birthdays(s.members,'2026-11-20')[0].name,'정윤정');
});
test('2024~2030 공휴일과 요일 색상, 겹친 공휴일의 단일 대체일을 제공한다',()=>{
 for(let year=2024;year<=2030;year++)assert.ok(Calendar.holidays(year)[year+'-01-01']);
 assert.ok(Calendar.holidays(2024)['2024-10-01']);assert.ok(Calendar.holidays(2025)['2025-06-03']);assert.ok(Calendar.holidays(2028)['2028-10-05']);assert.equal(Calendar.holidays(2028)['2028-10-06'],undefined);
 assert.ok(Calendar.holidays(2025)['2025-05-06']);assert.equal(Calendar.holidays(2025)['2025-05-07'],undefined);
 assert.equal(Calendar.tone('2026-11-21'),'date-saturday');assert.equal(Calendar.tone('2026-11-22'),'date-holiday');assert.equal(Calendar.tone('2026-12-25'),'date-holiday');assert.equal(Calendar.tone('2026-11-20'),'date-weekday');
});
test('카드별 리셋·누적 설정을 적용 월부터 계산하고 제외 지출은 이월 잔액에 넣지 않는다',()=>{
 let s=state();const service=Cards.create({uid:()=> 'card-1',isAdmin:P.isOverallAdmin});
 s=service.saveCard(s,'김무현',{name:'운영',month:'2026-10',limit:'550000',extra:'0',carry:'on'}).state;
 s=service.saveEntry(s,'김무현',{cardId:'card-1',date:'2026-10-20',purpose:'구매',amount:'510000'});
 assert.equal(Cards.monthly(s.cardExpenses,'card-1','2026-11').balance,590000);
 s=service.saveCard(s,'김무현',{id:'card-1',name:'운영',month:'2026-11',limit:'550000',extra:'0',modePresent:'1'}).state;
 assert.equal(Cards.monthly(s.cardExpenses,'card-1','2026-11').balance,550000);assert.equal(Cards.monthly(s.cardExpenses,'card-1','2026-10').balance,40000);
 assert.throws(()=>service.saveCard(s,'정윤정',{name:'침입',month:'2026-11',limit:'1',extra:'0'}),/관리자/);
});
test('첨부는 허용 형식·크기·내용을 검사하고 답글이 달린 댓글 수정은 차단한다',()=>{
 const image={id:'image-1',name:'test.png',type:'image/png',size:1,data:'data:image/png;base64,YQ=='};A.validate([image],true);
 assert.throws(()=>A.validate([{...image,name:'attack.html'}]));assert.throws(()=>A.validate([{...image,size:2}]));assert.throws(()=>A.validate([{...image,type:'image/svg+xml'}]));
 let s=state();s=B.save(s,'김무현',{team:'퍼블',title:'첨부 테스트',content:'본문',attachments:[image]});const id=s.teamPosts.at(-1).id;
 s=B.addComment(s,'김무현',{id,content:'',attachments:[image]});const commentId=s.teamPosts.at(-1).comments[0].id;C.validateState(s);
 s=B.editComment(s,'김무현',{id,commentId,content:'수정 가능'});s=B.addComment(s,'김무현',{id,parentId:commentId,content:'답글'});
 assert.throws(()=>B.editComment(s,'김무현',{id,commentId,content:'수정 불가'}),/답글/);
 const common=B.save(s,'김무현',{team:'퍼블',category:'common',title:'일반 공통 글',content:'본문',type:'일반글'});assert.ok(B.boardPosts(common,'정윤정','common').some(post=>post.title==='일반 공통 글'));
});
test('파트별 KPI는 고객 원본의 담당자·상태·요청일만 집계한다',()=>{
 const rows=C.importRows(state(),[{id:'1',과업명:'KPI',담당자_기획:'정윤정',상태_기획:'완료',담당자_디자인:'홍소영',상태_디자인:'진행중',완료요청일:'2026-11-01'}]).state.projects;
 const result=Kpi.metrics(rows,Board,C,'2026-11-20');assert.equal(result[0].completed,1);assert.equal(result[0].rate,100);assert.equal(result[1].overdue,1);assert.equal(result[2].total,0);
});
