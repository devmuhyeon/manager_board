const test=require('node:test'),assert=require('node:assert/strict'),C=require('./core-fixture.cjs'),R=require('../source/js/project-report.js'),B=require('../source/js/task-board.js');
const project=(id='a')=>({id,source:'manual',title:'같은 과업명',customer:'고객',status:'진행중',tasks:[{id:'t',role:'퍼블',assignees:['김무현'],started:'2026-11-01',due:'2026-11-30',status:'진행중',progress:40}],logs:[]});
const opts=projects=>({projects,C,filters:{from:'2026-11-16',to:'2026-11-22'},members:[{name:'김무현',team:'퍼블'}]});
test('주간 과업은 제목이 같아도 ID로 구분하고 기록 없는 진행 과업도 보인다',()=>{
 const a=project(),b=project('b');a.logs=[{id:'l',date:'2026-11-17',author:'김무현',content:'수정 완료'}];const before=JSON.stringify([a,b]);
 const groups=R.weeklyGroups(opts([a,b]));assert.equal(groups.length,2);assert.equal(groups[0].weekly.length,1);assert.equal(groups[1].weekly.length,0);assert.equal(JSON.stringify([a,b]),before);
});
test('히스토리는 한국 날짜로 경계를 판정하고 기간 밖 기록을 전체 이력에 보존한다',()=>{
 const p=project();p.logs=[{id:'old',date:'2026-11-01',author:'김무현',content:'기획 전달'}];p.workflowRelease={t:{development:{by:'김무현',at:'2026-11-15T16:00:00Z'}}};p.sourceAssignments={퍼블:[{name:'김무현',started:'2026-11-17'}]};
 const requests=[{id:'r',projectId:'a',from:'김무현',to:['홍소영'],title:'확인 요청',body:'검토 바랍니다',createdAt:Date.parse('2026-11-17T00:00:00Z')},{id:'x',projectId:'other',from:'김무현',createdAt:Date.now()}];
 const [g]=R.weeklyGroups({...opts([p]),requests});assert.equal(g.events.length,4);assert.equal(g.weekly.length,3);assert.equal(g.weekly.find(e=>e.kind==='개발 반영').date,'2026-11-16');assert.ok(g.events.some(e=>e.content==='기획 전달'));
});
test('개인 범위는 다른 작성자의 기록을 제외한다',()=>{const p=project();p.logs=[{id:'1',date:'2026-11-17',author:'김무현',content:'내 기록'},{id:'2',date:'2026-11-17',author:'홍소영',content:'다른 기록'}];const config=opts([p]);const [g]=R.weeklyGroups({...config,filters:{...config.filters,scope:'personal',user:'김무현'}});assert.equal(g.events.length,1);});
test('완료와 취소는 실제 히스토리를 남기고 원본을 변경하지 않는다',()=>{const p=project(),before=JSON.stringify(p);const done=B.toggle(p,'t',C,'김무현');assert.equal(done.logs.length,1);assert.match(done.logs[0].content,/40% → 100%/);const undo=B.toggle(done,'t',C,'김무현');assert.equal(undo.logs.length,2);assert.equal(JSON.stringify(p),before);assert.throws(()=>B.toggle(p,'t',C,'홍소영'),/본인이/);const same=B.setProgress(p,'t',40,C,'김무현');assert.equal(same.logs.length,0);});
test('표시하는 히스토리와 제목은 HTML을 이스케이프한다',()=>{const p=project();p.title='<img>';p.logs=[{id:'1',date:'2026-11-17',author:'김무현',content:'<script>'}];const groups=R.weeklyGroups(opts([p]));const html=R.renderWeekly({groups,Board:B,esc:s=>String(s).replace(/</g,'&lt;'),button:(a,t)=>'<button>'+t+'</button>'});assert.ok(html.includes('&lt;script>'));assert.ok(!html.includes('<img>'));});
