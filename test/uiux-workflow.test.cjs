const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../source/js/core.js'),B=require('../source/js/task-board.js'),M=require('../source/html/work/uiux/model.js');
const members=C.MEMBERS;
const source=()=>C.normalize({id:'spec',프로젝트명:'인증키 상세화면 디자인 및 퍼블 요청',요청자:'김재민',요청팀:'고용24대민포털',요청일:'2026-11-16',완료요청일:'2026-11-20',진행상태:'진행중',담당자_디자인:'홍소영',담당자_퍼블:'김무현',작업내용_디자인:'작업시작일자: 2026-11-16\n디자인 전달',작업내용_퍼블:'퍼블 작업중'});
test('원본은 불변이며 담당자별 완료·수정과 실제 완료일을 저장한다',()=>{
 const original=source(),before=JSON.stringify(original.raw);
 assert.throws(()=>M.toggle(original,'source-task:디자인',C,B,'김무현'),/본인/);
 let p=M.toggle(original,'source-task:디자인',C,B,'홍소영');
 assert.equal(M.read(p,C,B).tasks.find(t=>t.role==='디자인').completedOn,C.today());
 assert.equal(M.read(p,C,B).tasks.find(t=>t.role==='퍼블').status,'진행중');
 p=M.toggle(p,'source-task:디자인',C,B,'홍소영');assert.equal(M.read(p,C,B).tasks[0].status,'완료 후 수정');
 assert.equal(JSON.stringify(p.raw),before);assert.equal(JSON.stringify(original.raw),before);
});
test('전체 담당업무 완료 후 주소를 기록하고 운영반영을 최우선 표시한다',()=>{
 let p=source();assert.throws(()=>M.release(p,'development','https://dev.example',C,B,'김무현'),/모두 완료/);
 p=M.toggle(p,'source-task:디자인',C,B,'홍소영');p=M.toggle(p,'source-task:퍼블',C,B,'김무현');
 assert.throws(()=>M.release(p,'production','https://example.com',C,B,'김무현'),/개발 반영/);
 assert.throws(()=>M.release(p,'development','javascript:alert(1)',C,B,'김무현'),/주소/);
 p=M.release(p,'development','https://dev.example',C,B,'김무현');p=M.release(p,'production','https://example.com',C,B,'김무현');
 assert.equal(M.read(p,C,B).status,'운영반영완료');assert.ok(M.read(p,C,B).tasks.every(t=>t.status==='완료'));
 const state={...C.emptyState(),projects:[p]};assert.equal(M.read(C.validateState(JSON.parse(JSON.stringify(state))).projects[0],C,B).release.production.url,'https://example.com');
});
const input=()=>({title:'자체 등록 과업',roles:['디자인','기타'],platforms:['PC','MO'],services:['WK'],requested:'2026-11-23',requestedDue:'2026-11-25',customer:'고용24',assignees:{디자인:['홍소영']},notes:{디자인:'작업 내용'}});
test('자체 등록과 역할 추가, 배정 시 시작일, 디자인 단독 완료를 지원한다',()=>{
 let p=M.save(null,input(),C,B,'홍소영',members);assert.equal(p.workflow.etc,true);assert.equal(p.tasks[0].started,C.today());
 const start=p.tasks[0].started;
 p=M.save(p,{...input(),title:'변경'},C,B,'홍소영',members);assert.equal(p.tasks[0].started,start);
 p=M.toggle(p,p.tasks[0].id,C,B,'홍소영');assert.equal(M.read(p,C,B).complete,true);assert.equal(M.read(p,C,B).status,'완료');
 p=M.release(p,'development','Z:\\산출물\\작업',C,B,'홍소영');assert.equal(M.read(p,C,B).status,'개발반영');
 assert.equal(p.source,'manual');C.validateState({...C.emptyState(),projects:[p]});
});
test('편집으로 다른 작업자의 상태를 변경할 수 없고 댓글은 본인만 수정한다',()=>{
 const original=source();assert.throws(()=>M.save(original,{...input(),roles:['디자인','퍼블'],statuses:{디자인:'완료'},assignees:{디자인:['홍소영'],퍼블:['김무현']}},C,B,'김무현',members),/본인/);
 let p=M.comment(original,{content:'디자인 확인했습니다.'},C,B,'홍소영');const id=M.read(p,C,B).workflow.comments[0].id;
 assert.throws(()=>M.comment(p,{commentId:id,remove:true},C,B,'김무현'),/본인/);
 p=M.comment(p,{commentId:id,content:'수정 확인'},C,B,'홍소영');assert.equal(M.read(p,C,B).workflow.comments[0].content,'수정 확인');
 p=M.comment(p,{commentId:id,remove:true},C,B,'홍소영');assert.equal(M.read(p,C,B).workflow.comments.length,0);
});
test('필터·주소·날짜 검증과 연결 전 샘플 보호',()=>{
 assert.equal(M.match('운영반영완료','진행중'),false);assert.equal(M.match('완료','진행중'),true);assert.equal(M.match('보류','all'),true);
 assert.equal(M.date('2026-02-30'),'');assert.equal(M.date('2026.11.20'),'2026-11-20');assert.equal(M.safeUrl('data:text/html,hello'),'');
 assert.throws(()=>M.toggle({...source(),readOnlySample:true},'source-task:퍼블',C,B,'김무현'),/보기 전용/);
});
test('본인 완료 기록은 보존하면서 새 고객 JSON의 다른 작업자·내용·상태를 최신화한다',()=>{
 const original=source();let p=M.toggle(original,'source-task:디자인',C,B,'홍소영');
 p={...p,raw:{...p.raw,담당자_퍼블:'임정규',작업내용_퍼블:'고객이 갱신한 내용',상태_퍼블:'보류'}};
 const current=M.read(p,C,B);assert.equal(current.tasks.find(t=>t.role==='디자인').status,'완료');
 const pub=current.tasks.find(t=>t.role==='퍼블');assert.deepEqual(pub.assignees,['임정규']);assert.equal(pub.notes,'고객이 갱신한 내용');assert.equal(pub.status,'보류');
});
test('완료 후 수정의 공백을 보존해 다른 업무 완료 저장도 검증을 통과한다',()=>{
 const p=source();p.raw.상태_디자인='완료 후 수정';
 const updated=M.toggle(p,'source-task:퍼블',C,B,'김무현');
 assert.equal(M.read(updated,C,B).tasks.find(t=>t.role==='디자인').status,'완료 후 수정');
 C.validateState({...C.emptyState(),projects:[updated]});
 assert.deepEqual(M.period('week','2026-11-23'),{from:'2026-11-23',to:'2026-11-29'});
 assert.deepEqual(M.period('month','2026-11-23'),{from:'2026-11-01',to:'2026-11-30'});
});
