const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/core.js');
const Board = require('../js/task-board.js');

const C = {...Core, today: () => '2026-11-10'};
const project = {
  id: 'source:board-test', source: 'import', title: '공동 과업',
  tasks: [
    {id: 'planning', role: '기획', assignees: ['김무현'], status: '검토중', due: '2026-11-09'},
    {id: 'design', role: '디자인', assignees: ['정윤정'], status: '진행중', due: '2026-11-12'}
  ]
};

test('담당자별 남은 업무와 가장 가까운 마감일을 계산한다', () => {
  const [mine] = Board.cards([C.effective(project)], '  김무현 ', false, C);
  assert.equal(mine.remaining, 1);
  assert.equal(mine.nextDue, '2026-11-09');
  assert.equal(mine.status, '검토중');
  assert.deepEqual(mine.tasks.map(task => task.id), ['planning']);
  assert.deepEqual(Board.cards([C.effective(project)], '없는 이름', false, C), []);
});

test('가져온 과업은 원본을 보존하고 완료 체크 및 취소를 기록한다', () => {
  const checked = Board.toggle(project, 'planning',C,'김무현');
  assert.deepEqual(checked.tasks, project.tasks);
  assert.equal(C.effective(checked).tasks[0].completedOn, '2026-11-10');
  assert.equal(C.effective(checked).tasks[1].status, '진행중');
  assert.deepEqual(Board.cards([C.effective(checked)], '김무현', false, C), []);
  assert.equal(Board.cards([C.effective(checked)], '김무현', true, C)[0].completedOn, '2026-11-10');
  const reopened = C.effective(Board.toggle(checked, 'planning',C,'김무현'));
  assert.equal(reopened.tasks[0].status, '검토중');
  assert.equal(reopened.tasks[0].completedOn, '');
});

test('담당 업무가 없는 기존 과업도 완료 체크할 수 있다', () => {
  const legacy = {id: 'old', title: '이전 과업', assignees: ['김무현'], status: '대기'};
  const checked = Board.toggle(legacy, '',C,'김무현');
  assert.equal(checked.status, '완료');
  assert.equal(checked.completedOn, '2026-11-10');
  assert.equal(Board.toggle(checked, '',C,'김무현').status, '대기');
});

test('카드 이동은 검색된 담당 업무만 변경하고 가져온 원본을 보존한다',()=>{
 const moved=Board.move(project,'done','김무현',C,'김무현');
 assert.deepEqual(moved.tasks,project.tasks);
 assert.equal(C.effective(moved).tasks[0].completedOn,'2026-11-10');
 assert.equal(C.effective(moved).tasks[1].status,'진행중');
 const restored=C.validateState({...C.sampleState(),projects:[moved]}).projects[0];
 assert.equal(C.effective(restored).tasks[0].status,'완료');
 const reopened=Board.move(moved,'queue','김무현',C,'김무현');
 assert.equal(C.effective(reopened).tasks[0].completedOn,'');
 assert.equal(C.effective(reopened).tasks[0].status,'접수');
 assert.throws(()=>Board.move(project,'invalid','',C,'김무현'));
});
test('공동 카드 이동은 본인 업무만 바꾸고 다른 담당자의 상태를 유지한다',()=>{
 const done=Board.move(project,'done','',C,'김무현');
 assert.equal(C.effective(done).tasks[0].status,'완료');
 assert.equal(C.effective(done).tasks[1].status,'진행중');
 assert.equal(Board.cards([C.effective(done)],'김무현',true,C)[0].completedOn,C.today());
 const review=Board.move(done,'revision','',C,'김무현');
 assert.equal(C.effective(review).tasks[0].status,'완료 후 수정');
 assert.equal(C.effective(review).tasks[1].status,'진행중');
 assert.equal(C.effective(review).tasks[0].completedOn,C.today());
});

test('개인별·팀별 보기는 동일 카드의 담당 업무를 나눠 표시한다',()=>{
 const list=Board.cards([C.effective(project)],'',true,C);
 const people=Board.groups(list,'person',[],C);
 assert.deepEqual(people.map(g=>g.label),['김무현','정윤정']);
 assert.equal(people[0].entries[0].project.id,project.id);
 assert.deepEqual(people[0].entries[0].tasks.map(t=>t.id),['planning']);
 const teams=Board.groups(list,'team',[{name:'김무현',team:'퍼블'},{name:'정윤정',team:'디자인'}],C);
 assert.deepEqual(teams.map(g=>g.label),['퍼블','디자인']);
 assert.equal(Board.groups(list,'project',[],C).length,1);
 assert.equal(Board.groups(list,'status',[],C).length,6);
});

test('40% 진행률은 가져온 원본을 보존하며 재저장 후 유지된다',()=>{
 const updated=Board.setProgress(project,'planning',40,C,'김무현');
 assert.deepEqual(updated.tasks,project.tasks);
 const effective=C.effective(updated);
 assert.equal(effective.tasks[0].progress,40);
 assert.equal(effective.tasks[0].status,'진행중');
 assert.equal(Board.average(effective.tasks),20);
 const loaded=C.validateState(JSON.parse(JSON.stringify({...C.sampleState(),projects:[updated]})));
 assert.equal(Board.progress(C.effective(loaded.projects[0]).tasks[0]),40);
 assert.equal(C.effective(updated).tasks[1].progress,undefined);
});
test('진행률 100%는 완료일을 기록하고 완료 취소는 이전 진행률을 복원한다',()=>{
 const partial=Board.setProgress(project,'planning',40,C,'김무현');
 const done=Board.toggle(partial,'planning',C,'김무현');
 assert.equal(C.effective(done).tasks[0].progress,100);
 assert.equal(C.effective(done).tasks[0].completedOn,C.today());
 const reopened=C.effective(Board.toggle(done,'planning',C,'김무현')).tasks[0];
 assert.equal(reopened.progress,40);assert.equal(reopened.completedOn,'');
 const lowered=C.effective(Board.setProgress(done,'planning',65,C,'김무현')).tasks[0];
 assert.equal(lowered.status,'진행중');assert.equal(lowered.progress,65);assert.equal(lowered.completedOn,'');
 assert.equal(C.effective(Board.move(partial,'done','김무현',C,'김무현')).tasks[0].progress,100);
});
test('기존 단일 과업도 진행률을 지원하고 잘못된 값은 거절한다',()=>{
 const old={id:'legacy',source:'manual',title:'기존',assignees:['김무현'],status:'예정'};
 assert.equal(Board.setProgress(old,'',40,C,'김무현').progress,40);
 for(const value of [-1,101,NaN,Infinity,40.5,'40'])assert.throws(()=>Board.setProgress(old,'',value,C,'김무현'));
 assert.equal(Board.progress({status:'완료'}),100);
 assert.equal(Board.progress({status:'진행중'}),0);
});

test('주차 묶음은 월 경계를 잘라 표시하고 최신 주차와 미정 순서로 정렬한다',()=>{
 const make=(id,due)=>({project:{id},nextDue:due});
 const groups=Board.weekGroups([make('a','2026-10-01'),make('b','2026-10-09'),make('c',''),make('d','2026-11-02')]);
 assert.deepEqual(groups.map(g=>g.entries[0].project.id),['d','b','a','c']);
 assert.equal(groups[1].label,'2026년 10월 2주차 (10/5~10/11)');
 assert.equal(groups[2].label,'2026년 10월 1주차 (10/1~10/4)');
 assert.equal(groups[3].label,'마감일 미정');
});
test('카드 담당 업무는 기획 디자인 퍼블 순으로 정렬하고 동종 업무는 담당자 순서를 따른다',()=>{
 const tasks=[{id:'p',role:'퍼블',assignees:['P']},{id:'d2',role:'디자인',assignees:['후임']},{id:'c',role:'콘텐츠 기획',assignees:['C']},{id:'d1',role:'디자인',assignees:['선임']},{id:'a',role:'기획',assignees:['A']}];
 const ordered=Board.orderedTasks(tasks,[],()=>['A','C','선임','후임','P']);
 assert.deepEqual(ordered.map(t=>t.id),['a','c','d1','d2','p']);
 assert.equal(tasks[0].id,'p');
});

test('타인 및 미로그인 사용자는 같은 카드의 진행률과 완료 체크를 바꿀 수 없다',()=>{
 for(const actor of ['정윤정','관리자',undefined,'']){
  assert.throws(()=>Board.setProgress(project,'planning',80,C,actor),/본인이 담당/);
  assert.throws(()=>Board.toggle(project,'planning',C,actor),/본인이 담당/);
 }
 assert.throws(()=>Board.move(project,'done','김무현',C,'정윤정'),/본인 업무/);
 const moved=C.effective(Board.move(project,'done','',C,'김무현'));
 assert.deepEqual(moved.tasks[1],project.tasks[1]);
 assert.equal(moved.tasks[0].progress,100);
});
test('편집창의 진행률 변경 및 자기 이름 추가를 통한 동시 변경을 거절한다',()=>{
 const previous={...project.tasks[1],progress:40};
 assert.throws(()=>Board.guardEdit(previous,{...previous,progress:90},'김무현'),/다른 담당자/);
 assert.throws(()=>Board.guardEdit(previous,{...previous,assignees:['김무현'],progress:90},'김무현'),/다른 담당자/);
 const unchanged=Board.guardEdit(previous,{...previous,notes:'요청사항 수정',completedOn:'fake'},'김무현');
 assert.equal(unchanged.progress,40);assert.equal(unchanged.completedOn,undefined);
 assert.throws(()=>Board.guardEdit(null,{assignees:['정윤정'],status:'완료'},'김무현'),/0%/);
});
test('공동 담당 업무는 이름이 포함된 각 담당자가 조절할 수 있다',()=>{
 const shared={...project,tasks:[{...project.tasks[0],assignees:['김무현','정윤정']}]};
 for(const actor of ['김무현','정윤정'])assert.equal(C.effective(Board.setProgress(shared,'planning',40,C,actor)).tasks[0].progress,40);
});

test('여섯 진행 단계와 운영반영완료는 저장 후에도 유지된다',()=>{
 assert.deepEqual(Board.lanes.map(lane=>lane.label),['접수','진행중','완료','완료 후 수정','운영반영완료','보류']);
 let updated=Board.move(project,'released','김무현',C,'김무현');
 const loaded=C.validateState(JSON.parse(JSON.stringify({...C.sampleState(),projects:[updated]})));
 const task=C.effective(loaded.projects[0]).tasks[0];
 assert.equal(task.status,'운영반영완료');assert.equal(task.progress,100);
 assert.equal(Board.cards([C.effective(updated)],'김무현',false,C).length,0);
 updated=Board.move(updated,'revision','김무현',C,'김무현');
 assert.equal(C.effective(updated).tasks[0].status,'완료 후 수정');
 assert.equal(Board.cards([C.effective(updated)],'김무현',false,C).length,1);
 assert.deepEqual(C.effective(updated).tasks[1],project.tasks[1]);
});

test('개인별 탭은 본인 팀, 본인, 직급, 가나다 순으로 정렬한다',()=>{
 const members=[{name:'나팀장',team:'퍼블',rank:'차장'},{name:'가대리',team:'퍼블',rank:'대리'},{name:'나다리',team:'퍼블',rank:'대리'},{name:'본인',team:'퍼블',rank:'사원'},{name:'기획장',team:'기획',rank:'부장'}];
 const list=Board.cards([{id:'order',title:'순서',tasks:members.slice().reverse().map((m,i)=>({id:String(i),role:'기획',assignees:[m.name],status:'진행중'}))}],'',true,C);
 assert.deepEqual(Board.groups(list,'person',members,C,'본인').map(group=>group.label),['본인','나팀장','가대리','나다리','기획장']);
 assert.equal(Board.groups(list,'person',members,C,'기획장')[0].label,'기획장');
});

test('수정 게이지는 본인 업무에서만 원래 진행률과 독립적으로 변경된다',()=>{
 const done=Board.setProgress(project,'planning',100,C,'김무현');
 const revision=Board.move(done,'revision','김무현',C,'김무현');
 assert.equal(C.effective(revision).tasks[0].progress,100);
 const edited=Board.setRevisionProgress(revision,'planning',40,C,'김무현');
 assert.equal(C.effective(edited).tasks[0].revisionProgress,40);
 assert.equal(C.effective(edited).tasks[0].progress,100);
 assert.throws(()=>Board.setRevisionProgress(revision,'planning',60,C,'정윤정'));
 assert.throws(()=>Board.setRevisionProgress(done,'planning',40,C,'김무현'));
 assert.throws(()=>Board.guardEdit(C.effective(edited).tasks[0],{...C.effective(edited).tasks[0],revisionProgress:90},'정윤정'));
 const moved=Board.move(edited,'released','김무현',C,'김무현');
 assert.equal(C.effective(moved).tasks[0].revisionProgress,40);
 assert.equal(C.effective(moved).tasks[0].status,'운영반영완료');
});

test('수정 전용 게이지는 해당 상태에서만 표시된다',()=>{
 const options={name:'',showDone:true,C,N:{teamLabel:x=>x},esc:x=>String(x||''),button:(a,t)=>'<button>'+t+'</button>',dday:()=>'',orderNames:x=>x,actor:'김무현'};
 const revision=Board.move(Board.setProgress(project,'planning',100,C,'김무현'),'revision','김무현',C,'김무현');
 assert.match(Board.render({...options,rows:[C.effective(revision)]}),/revision-control/);
 const released=Board.move(revision,'released','김무현',C,'김무현');
 assert.ok(!Board.render({...options,rows:[C.effective(released)]}).includes('revision-control'));
});

test('보드 기간은 담당 업무 마감일 기준이며 시작일과 종료일을 포함한다',()=>{
 const rows=[C.effective(project)];
 const filtered=Board.cards(rows,'',true,C,{from:'2026-11-09',to:'2026-11-09'});
 assert.deepEqual(filtered[0].tasks.map(t=>t.id),['planning']);
 assert.equal(Board.cards(rows,'김무현',true,C,{from:'2026-11-10'}).length,0);
 assert.equal(Board.cards(rows,'',true,C,{to:'2026-11-12'})[0].tasks.length,2);
 assert.equal(Board.cards(rows,'',true,C,{})[0].tasks.length,2);
});
test('과업명 검색 중에도 본인 업무만 이동하며 진행별은 최근 수정순이다',()=>{
 const list=Board.cards([C.effective(project)],'공동',true,C);assert.equal(list[0].tasks.length,2);
 const moved=C.effective(Board.move(project,'hold','공동',C,'김무현'));assert.equal(moved.tasks[0].status,'보류');assert.equal(moved.tasks[1].status,'진행중');
 const older={...project,id:'old',updatedAt:'2026-11-01'},newer={...project,id:'new',updatedAt:'2026-11-10'};
 const groups=Board.groups(Board.cards([C.effective(older),C.effective(newer)],'',true,C),'status',[],C);
 assert.deepEqual(groups.find(g=>g.id==='doing').entries.map(c=>c.project.id),['new','old']);
});
