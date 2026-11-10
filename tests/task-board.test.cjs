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
