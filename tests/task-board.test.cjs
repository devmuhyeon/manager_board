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
  const checked = Board.toggle(project, 'planning', C);
  assert.deepEqual(checked.tasks, project.tasks);
  assert.equal(C.effective(checked).tasks[0].completedOn, '2026-11-10');
  assert.equal(C.effective(checked).tasks[1].status, '진행중');
  assert.deepEqual(Board.cards([C.effective(checked)], '김무현', false, C), []);
  assert.equal(Board.cards([C.effective(checked)], '김무현', true, C)[0].completedOn, '2026-11-10');
  const reopened = C.effective(Board.toggle(checked, 'planning', C));
  assert.equal(reopened.tasks[0].status, '검토중');
  assert.equal(reopened.tasks[0].completedOn, '');
});

test('담당 업무가 없는 기존 과업도 완료 체크할 수 있다', () => {
  const legacy = {id: 'old', title: '이전 과업', assignees: ['김무현'], status: '대기'};
  const checked = Board.toggle(legacy, '', C);
  assert.equal(checked.status, '완료');
  assert.equal(checked.completedOn, '2026-11-10');
  assert.equal(Board.toggle(checked, '', C).status, '대기');
});

test('카드 이동은 검색된 담당 업무만 변경하고 가져온 원본을 보존한다',()=>{
 const moved=Board.move(project,'done','김무현',C);
 assert.deepEqual(moved.tasks,project.tasks);
 assert.equal(C.effective(moved).tasks[0].completedOn,'2026-11-10');
 assert.equal(C.effective(moved).tasks[1].status,'진행중');
 const restored=C.validateState({...C.sampleState(),projects:[moved]}).projects[0];
 assert.equal(C.effective(restored).tasks[0].status,'완료');
 const reopened=Board.move(moved,'queue','김무현',C);
 assert.equal(C.effective(reopened).tasks[0].completedOn,'');
 assert.equal(C.effective(reopened).tasks[0].status,'예정');
 assert.throws(()=>Board.move(project,'invalid','',C));
});
test('전체 카드의 목록 이동과 완료 체크는 왕복할 수 있다',()=>{
 const done=Board.move(project,'done','',C);
 assert.equal(C.effective(done).status,'완료');
 assert.equal(Board.cards([C.effective(done)],'',true,C)[0].completedOn,C.today());
 const review=Board.move(done,'review','',C);
 assert.equal(C.effective(review).status,'검토중');
 assert.ok(C.effective(review).tasks.every(task=>!task.completedOn));
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
 assert.equal(Board.groups(list,'status',[],C).length,4);
});
