const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/core.js'),P=require('../js/personnel.js');
const base=()=>P.upgrade({...C.sampleState(),projects:[]});
const leave=(owner,start='2026-10-23',end=start)=>({owner,start,end,type:'연차',note:''});
test('팀원은 본인 휴가만 등록·수정·삭제할 수 있다',()=>{
 let s=P.saveLeave(base(),'김다솔',leave('김다솔'));const id=s.leaves[0].id;
 assert.throws(()=>P.saveLeave(s,'정윤정',leave('김다솔')));
 assert.throws(()=>P.saveLeave(s,'정윤정',{...leave('정윤정'),id}));
 assert.throws(()=>P.deleteLeave(s,'정윤정',id));
 assert.equal(P.deleteLeave(s,'김다솔',id).leaves.length,0);
 assert.equal(s.leaves.length,1);assert.doesNotThrow(()=>C.validateState(s));
});
test('지정 팀장은 소속 팀원의 휴가만 관리한다',()=>{
 let s=base();const manager=s.members.find(m=>m.name==='김다솔');s=P.setLeaders(s,{[manager.team]:manager.name});
 assert.throws(()=>P.saveLeave(s,'김다솔',leave('김무현')));
 s=P.saveLeave(s,'김다솔',leave('김아영'));assert.equal(s.leaves[0].owner,'김아영');
 assert.equal(P.deleteLeave(s,'김다솔',s.leaves[0].id).leaves.length,0);
 assert.throws(()=>P.setLeaders(s,{[manager.team]:'없는사람'}));
});
test('주간 범위는 월~일이고 연도 경계와 휴가 기간 겹침을 처리한다',()=>{
 assert.deepEqual(P.weekRanges('2027-01-01'),[{start:'2026-12-28',end:'2027-01-03'},{start:'2027-01-04',end:'2027-01-10'}]);
 let s=P.saveLeave(base(),'김다솔',leave('김다솔','2026-10-18','2026-10-27'));
 assert.equal(P.schedule(s,'김다솔',P.weekRanges('2026-10-23')[0]).length,1);
 assert.equal(P.schedule(s,'김다솔',P.weekRanges('2026-10-23')[1]).length,1);
 assert.equal(P.dday('2026-10-24','2026-10-23'),'D-1');assert.equal(P.dday('2026-10-23','2026-10-23'),'D-day');assert.equal(P.dday('2026-10-22','2026-10-23'),'D+1');
});
test('팀장은 같은 팀의 날짜 지정 일정만 보고 개인 메모 본문은 노출하지 않는다',()=>{
 let s=base(),manager=s.members[0],peer=s.members.find(m=>m.team===manager.team&&m.name!==manager.name),other=s.members.find(m=>m.team!==manager.team);
 for(const m of [manager,peer,other]){s=P.savePersonal(s,m.name,{title:m.name+' 일정',date:'2026-10-23',content:'비공개 본문'});s=P.savePersonal(s,m.name,{title:'날짜 없는 메모'});}
 const range=P.weekRanges('2026-10-23')[0];assert.equal(P.schedule(s,manager.name,range).length,1);
 s=P.setLeaders(s,{[manager.team]:manager.name});const rows=P.schedule(s,manager.name,range);
 assert.equal(rows.length,2);assert.ok(rows.every(r=>!r.content&&r.owner!==other.name));
});
test('퇴사 시 팀장 해제 및 휴가 보관·삭제가 적용된다',()=>{
 let s=base(),m=s.members[0];s=P.setLeaders(s,{[m.team]:m.name});s=P.saveLeave(s,m.name,leave(m.name));
 const keep=P.removeMember(s,m.name,'keep');assert.equal(keep.leaves.length,1);assert.equal(P.isLeader(keep,m.name),false);assert.doesNotThrow(()=>C.validateState(keep));
 const purge=P.removeMember(s,m.name,'purge');assert.equal(purge.leaves.length,0);
});
test('잘못된 날짜와 여러 날에 걸친 반차를 거절한다',()=>{
 assert.throws(()=>P.saveLeave(base(),'김다솔',leave('김다솔','2026-02-30')));
 assert.throws(()=>P.saveLeave(base(),'김다솔',{...leave('김다솔','2026-10-23','2026-10-24'),type:'오전 반차'}));
 assert.throws(()=>P.saveLeave(base(),'김다솔',leave('김다솔','2026-10-24','2026-10-23')));
});
