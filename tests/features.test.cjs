const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/core.js'),P=require('../js/personnel.js'),V=require('../js/local-vault.js');
const state=()=>P.upgrade(C.sampleState());
test('입사 인원을 추가하고 새 담당자·계정을 검증할 수 있다',()=>{
  const s=P.addMember(state(),'신규인원','콘텐츠');C.setMembers(s.members);
  const imported=C.importRows(s,[{id:'new',과업명:'신규 과업',담당자_디자인:'신규인원'}]).state;
  assert.deepEqual(C.effective(imported.projects[0]).assignees,['신규인원']);
  assert.deepEqual(C.teamsOf(C.effective(imported.projects[0])),['콘텐츠']);
  imported.accounts.신규인원={salt:'abc',hash:'def',iterations:150000};assert.doesNotThrow(()=>C.validateState(imported));
  assert.throws(()=>P.addMember(s,'신규인원','콘텐츠'));C.setMembers();
});
test('퇴사 자료 보관은 로그인 계정만 없애고 기록을 유지한다',()=>{
  let s=state();s.accounts.김다솔={salt:'a',hash:'b',iterations:150000};s=P.savePersonal(s,'김다솔',{title:'보관 메모'});
  const before=JSON.stringify(s.projects),next=P.removeMember(s,'김다솔','keep');
  assert.equal(JSON.stringify(next.projects),before);assert.equal(next.personal.김다솔.length,1);assert.equal(next.accounts.김다솔,undefined);assert.equal(next.members.find(m=>m.name==='김다솔').active,false);
  assert.equal(s.members.find(m=>m.name==='김다솔').active,true);
});
test('퇴사 삭제는 공동업무를 보존하고 개인 작업·메모만 제거한다',()=>{
  let s=state();s.projects=[{id:'shared',title:'공동 과업',source:'manual',status:'진행중',assignees:['김다솔','홍소영'],tasks:[{id:'a',role:'디자인',assignees:['김다솔','홍소영'],status:'진행중',notes:'공동 결과'}],logs:[{id:'l1',author:'김다솔',date:'2026-10-23',content:'개인 기록'},{id:'l2',author:'홍소영',date:'2026-10-23',content:'다른 사람 기록'}]},{id:'solo',title:'단독 과업',source:'manual',status:'완료',assignees:['김다솔'],logs:[]}];
  s=P.savePersonal(s,'김다솔',{title:'개인 메모'});const n=P.removeMember(s,'김다솔','purge');
  assert.equal(n.projects.length,1);assert.deepEqual(C.effective(n.projects[0]).assignees,['홍소영']);assert.equal(n.projects[0].tasks[0].notes,'공동 결과');assert.equal(n.projects[0].logs.length,1);assert.equal(n.personal.김다솔,undefined);assert.ok(n.hiddenProjects.includes('solo'));
});
test('원본 재수입으로 제거한 담당 자료가 되살아나지 않는다',()=>{
  const input=[{id:'one',과업명:'단독 요청',담당자_디자인:'김다솔'},{id:'two',과업명:'공동 요청',담당자_디자인:'김다솔, 홍소영'}];const original=JSON.stringify(input);
  let s=C.importRows(state(),input).state;s=P.removeMember(s,'김다솔','purge');
  const n=P.enforceRemovals(C.importRows(s,input).state);assert.equal(n.projects.length,1);assert.deepEqual(C.effective(n.projects[0]).assignees,['홍소영']);assert.equal(JSON.stringify(input),original);
});
test('메모는 사용자별 저장되고 수정·완료 상태를 보존한다',()=>{
  let s=P.savePersonal(state(),'김무현',{title:'회의 준비',date:'2026-10-23',time:'14:00',content:'자료 확인'});
  const item=s.personal.김무현[0];s=P.savePersonal(s,'김무현',{...item,done:true,content:'완료'});
  assert.equal(s.personal.김무현.length,1);assert.equal(s.personal.김무현[0].done,true);assert.equal(s.personal.성아미,undefined);assert.throws(()=>P.savePersonal(s,'김무현',{title:'시간만',time:'14:00'}));
  assert.doesNotThrow(()=>C.validateState(s));
});
test('기기 비밀번호는 암호문으로 저장되며 다른 기기 키로 복호화할 수 없다',async()=>{
  const key=await V.newKey(),other=await V.newKey(),value={name:'테스트 사용자',team:'퍼블',password:'fixture-only-1234'};
  const record=await V.seal(key,value);assert.equal(key.extractable,false);assert.ok(!JSON.stringify(record).includes(value.password));assert.deepEqual(await V.unseal(key,record),value);await assert.rejects(()=>V.unseal(other,record));
});

test('인원 정렬은 관리자와 관계없이 소속 팀 안에서 팀장 다음 팀원이며 원본은 보존한다',()=>{
 const s=state();s.members=[{name:'김무현',team:'퍼블',active:true},{name:'정윤정',team:'기획',active:true},{name:'임정규',team:'퍼블',active:true},{name:'성아미',team:'기획',active:true},{name:'신규팀원',team:'퍼블',active:true}];s.teamLeaders={기획:'성아미',퍼블:'임정규'};s.overallAdmin='김무현';
 const before=JSON.stringify(s),expected=['성아미','정윤정','임정규','김무현','신규팀원'];
 assert.deepEqual(P.orderedMembers(s).map(m=>m.name),expected);
 assert.deepEqual(P.orderNames(s,['김무현','정윤정','임정규','성아미','신규팀원']),expected);
 assert.equal(JSON.stringify(s),before);
 s.teamLeaders.퍼블='신규팀원';assert.deepEqual(P.orderedMembers(s).filter(m=>m.team==='퍼블').map(m=>m.name),['신규팀원','김무현','임정규']);
});
