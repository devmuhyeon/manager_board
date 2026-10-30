const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../js/display-styles.js'),C=require('../js/core.js'),P=require('../js/personnel.js'),B=require('../js/team-board.js'),N=require('../js/navigation.js');
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const button=(action,label,cls='',extra='')=>'<button data-action="'+action+'" class="'+cls+'" '+extra+'>'+label+'</button>';
const badge=s=>'<span>'+esc(s)+'</span>';
function setup(values=[]){const data=new Map(values),element={dataset:{}},storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};return {data,element,storage,styles:S.create({storage,element})};}
test('기본은 팀 브리핑이고 10개 스타일 선택이 새 세션에도 유지된다',()=>{
 const h=setup();assert.equal(h.styles.current(),'briefing');assert.equal(h.element.dataset.style,'briefing');
 for(const style of S.catalog){assert.equal(h.styles.select(style.id),true);assert.equal(S.create(h).current(),style.id);assert.equal(h.element.dataset.style,style.id);}
 assert.equal(S.catalog.length,10);assert.throws(()=>h.styles.select('unknown'));
 assert.equal(setup([[S.KEY,'unknown']]).styles.current(),'briefing');
});
test('미드나이트를 나가면 이전 밝기 설정을 복원하고 저장 불가여도 화면은 적용한다',()=>{
 const h=setup();h.styles.select('midnight');assert.equal(h.element.dataset.theme,'dark');h.styles.select('briefing');assert.equal(h.element.dataset.theme,'light');
 h.styles.setTheme(true);h.styles.select('midnight');h.styles.select('soft');assert.equal(h.element.dataset.theme,'dark');
 h.storage.setItem=()=>{throw Error('full');};assert.equal(h.styles.select('compact'),false);assert.equal(h.element.dataset.style,'compact');
});
test('팀 브리핑은 전체공지와 본인 팀 게시글만 출력하고 데이터가 있으면 빈 안내를 숨긴다',()=>{
 let state=P.upgrade({...C.sampleState(),projects:[],demo:false});
 state=B.save(state,'김다솔',{team:'콘텐츠',type:'전체공지',title:'전체 안내',content:'모든 팀 공유'});
 state=B.save(state,'김다솔',{team:'콘텐츠',type:'팀별공지',title:'다른 팀 비공개',content:'다른 팀 내용'});
 state=B.save(state,'정윤정',{team:'기획',type:'일반글',title:'우리 팀 <소식>',content:'본문 <script>'});
 const args={style:'briefing',state,user:state.members.find(m=>m.name==='정윤정'),C,B,N,esc,button,badge,hint:()=>'<img class="empty-hint">',table:()=>'<table></table>'};
 const html=S.home(args);assert.match(html,/전체 안내/);assert.match(html,/우리 팀 &lt;소식&gt;/);assert.ok(!html.includes('다른 팀 비공개'));assert.ok(!html.includes('empty-hint'));
 assert.match(S.home({...args,state:{...state,teamPosts:[]}}),/empty-hint/);
});
test('칸반과 주간 타임라인은 실제 과업을 출력하며 상태와 날짜의 누락·주 경계를 처리한다',()=>{
 const rows=[{id:'a',title:'주 시작',status:'진행중',due:'2026-12-28',assignees:['담당자']},{id:'b',title:'다음 연도',status:'완료',due:'2027-01-03',assignees:[]},{id:'c',title:'다음 주',status:'보류',due:'2027-01-04',assignees:[]}];
 const args={state:{projects:rows},C:{...C,effective:p=>p,today:()=> '2027-01-01'},esc,button,badge};
 const board=S.home({...args,style:'kanban'});for(const p of rows)assert.ok(board.includes(p.title));assert.equal((board.match(/class="kanban-lane"/g)||[]).length,6);
 const timeline=S.home({...args,style:'timeline'});assert.match(timeline,/주 시작/);assert.match(timeline,/다음 연도/);assert.ok(!timeline.includes('다음 주'));assert.match(timeline,/2026-12-28 — 2027-01-03/);assert.match(timeline,/is-today/);
});
