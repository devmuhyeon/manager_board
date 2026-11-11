const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const C=require('../js/core.js'),P=require('../js/personnel.js');
function harness(){
 const events={};
 const nodes=new Map(),element=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',value:'',dataset:{},style:{},hidden:false,disabled:false,open:false,addEventListener(){},insertAdjacentHTML(_,html){this.innerHTML+=html;},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(selector);};
 const store=new Map(),vault={rememberConnections:async v=>{vault.connections=v;},recallConnections:async()=>vault.connections,recall:async()=>null,forget:async()=>{}};
 const context={BoardSimpleEditor:require('../js/simple-editor.js'),BoardBriefingCalendar:require('../js/briefing-calendar.js'),BoardAccountReset:require('../js/account-reset.js'),BoardTaskBoard:require('../js/task-board.js'),BoardMemoCarousel:require('../js/memo-carousel.js'),BoardDisplayStyles:require('../js/display-styles.js'),BoardXlsx:{workbook:sheets=>{context.exportedSheets=sheets;return {};}},URL:{createObjectURL:()=>'',revokeObjectURL(){}},FormData:class extends Map{constructor(form){super(Object.entries(form.fields||form));}},BoardWorkTables:require('../js/work-tables.js'),BoardNavigation:require('../js/navigation.js'),BoardTeamPosts:require('../js/team-board.js'),BoardDetailViews:require('../js/detail-views.js'),BoardCore:C,BoardPeople:P,BoardWorkspace:require('../js/workspace.js'),BoardVault:vault,document:{createElement:()=>({click(){}}),querySelectorAll:()=>[],querySelector:element,documentElement:{dataset:{}},addEventListener:(type,fn)=>{(events[type]??=[]).push(fn);},activeElement:null},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},window:{addEventListener:(type,fn)=>{(events['window:'+type]??=[]).push(fn);}},jQuery:()=>{},structuredClone,crypto:require('node:crypto').webcrypto,TextEncoder,Uint8Array,setTimeout:()=>0,clearTimeout(){},console,confirm:()=>true};
 vm.createContext(context);
 const source=fs.readFileSync(require.resolve('../js/app.js'),'utf8');
 // Expose the closure only in this isolated in-memory test; no production login bypass.
 const instrumented=source.replace(/\}\)\(\);\s*$/,`globalThis.testApp={weekBlocks,render,login,act,saveProject,exportXlsx,updateLogin,refreshAll,saveDisk,restoreFolders,setupExtras,read:()=>({state,dirty,setupDone,health}),seed:s=>{state=P.upgrade(s);syncRoster();},session:(n,startPage="dashboard")=>{user=member(n);setupDone=true;if(startPage){page=startPage;view=startPage==="work"?"board":"category";}},connect:(src,out,text)=>{sourceHandle=src;targetHandle=out;sourceDir=targetDir={queryPermission:async()=> 'granted'};diskText=text;},markDirty:()=>changed()};})();`);
 vm.runInContext(instrumented,context);return {api:context.testApp,element,vault,context,change:async target=>{for(const fn of events.change||[])await fn({target});},windowEvent:(type,event)=>events['window:'+type]?.forEach(fn=>fn(event)),submit:form=>events.submit.forEach(fn=>fn({target:form,preventDefault(){}}))};
}
const fixture=()=>P.upgrade({...C.sampleState(),demo:false,projects:[]});
test('내 아바타 선택은 다른 사용자를 바꾸지 않고 공용 저장 후에도 유지된다',async()=>{const h=harness(),s=fixture(),out=handle(JSON.stringify(s),true);h.api.seed(s);h.api.session('김무현');h.api.connect(handle('[]'),out,out.text);await h.api.act({dataset:{action:'avatarSettings'}});assert.match(h.element('#editor').innerHTML,/용용이/);assert.match(h.element('#editor').innerHTML,/삐약이/);await h.api.act({dataset:{action:'setAvatar',avatar:'bbiyak'}});assert.equal(h.api.read().state.members.find(m=>m.name==='김무현').avatar,'bbiyak');assert.equal(h.api.read().state.members.find(m=>m.name==='정윤정').avatar,undefined);assert.match(h.element('#app').innerHTML,/내 캐릭터 변경: 삐약이/);await h.api.act({dataset:{action:'save'}});assert.equal(C.validateState(JSON.parse(out.text)).members.find(m=>m.name==='김무현').avatar,'bbiyak');await assert.rejects(h.api.act({dataset:{action:'setAvatar',avatar:'unknown'}}));});
test('상단 한 줄에 원본·저장 연결 상태와 재연결을 두고 바로가기·사이드바 중복을 제거한다',()=>{const h=harness();h.api.seed(fixture());h.api.session('김무현');h.api.render();const html=h.element('#app').innerHTML,header=html.match(/<header class="topbar">[\s\S]*?<\/header>/)[0];assert.equal((html.match(/class="topbar"/g)||[]).length,1);assert.match(header,/원본 연결안됨/);assert.match(header,/저장 연결안됨/);assert.match(header,/data-action="connections"/);assert.match(header,/data-connection="source"/);assert.match(header,/data-connection="target"/);assert.ok(!header.includes('folder-icon'));assert.ok(!header.includes('pending-dot'));assert.ok(!html.includes('W24DG'));assert.equal((html.match(/data-action="connections"/g)||[]).length,2);assert.ok(!html.split('</aside>')[0].includes('workspace-tools'));});
test('새 메뉴와 연도·퍼블리싱 표시, 휴가 상세 표에는 D-day가 없다',async()=>{const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현');for(const page of ['board','today','users','leaves']){await h.api.act({dataset:{action:'page',page}});const html=h.element('#app').innerHTML;assert.ok(!html.includes('undefined'));assert.match(html,/202\d년/);assert.match(html,/퍼블리싱 팀/);if(page==='leaves'){assert.ok(!html.includes('week-countdown'));for(const label of ['팀','이름','직급','연차구분','연차 기간','편집'])assert.ok(html.includes('>'+label+'</th>'));}}});
test('팀 게시글 UI 저장 후 공용 파일 저장·다시 읽기에 보존된다',async()=>{const h=harness(),s=fixture(),src=handle('[]'),out=handle(JSON.stringify(s),true);h.api.seed(s);h.api.session('김무현');h.api.connect(src,out,out.text);await h.api.act({dataset:{action:'page',page:'board'}});await h.api.act({dataset:{action:'newPost'}});assert.match(h.element('#editor').innerHTML,/postForm/);h.submit({id:'postForm',fields:{id:'',team:'퍼블',title:'안내 <script>',content:'공유 내용',pinned:'on'}});assert.equal(h.api.read().state.teamPosts.length,1);assert.match(h.element('#app').innerHTML,/안내 &lt;script&gt;/);await h.api.act({dataset:{action:'save'}});const loaded=C.validateState(JSON.parse(out.text));assert.equal(loaded.teamPosts[0].content,'공유 내용');assert.equal(src.writes,0);});
test('설정에서 전체관리자 이전 후 메뉴 권한과 공용 저장이 함께 변경된다',async()=>{const h=harness(),s=fixture(),src=handle('[]'),out=handle(JSON.stringify(s),true);h.api.seed(s);h.api.session('김무현');h.api.connect(src,out,out.text);await h.api.act({dataset:{action:'preferences'}});assert.match(h.element('#editor').innerHTML,/전체관리자 권한 이전/);await h.api.act({dataset:{action:'transferAdmin'}});h.submit({id:'transferAdminForm',target:'정윤정'});assert.equal(h.api.read().state.overallAdmin,'정윤정');assert.equal(P.canManage(h.api.read().state,'김무현'),false);await h.api.act({dataset:{action:'save'}});assert.equal(JSON.parse(out.text).overallAdmin,'정윤정');await assert.rejects(h.api.act({dataset:{action:'adminSettings'}}));h.api.session('정윤정');await h.api.act({dataset:{action:'adminSettings'}});assert.match(h.element('#editor').innerHTML,/현재 전체관리자는 정윤정/);});
test('모든 상세 탭은 렌더되고 업무는 보드가 기본이고 고객·주간보고는 표를 제공한다',async()=>{const h=harness(),s=P.addSamples(fixture());h.api.seed(s);h.api.session('김무현');for(const page of ['dashboard','work','memo','schedule','deadlines','leaves','revisions','customers','report','people','settings']){await h.api.act({dataset:{action:'page',page}});const html=h.element('#app').innerHTML;assert.ok(!html.includes('undefined'),page);if(page==='work')assert.match(html,/남은 과업 보드/);if(page==='work'){assert.ok(!html.includes('board-filters'));assert.match(html,/board-control-row/);}if(['customers','report'].includes(page)){assert.match(html,/분류별/);assert.match(html,/과업별/);assert.ok(html.indexOf('data-scope="all"')<html.indexOf('data-scope="team"'));assert.ok(html.indexOf('data-scope="team"')<html.indexOf('data-scope="personal"'));}}});
test('일정 제목에는 날짜칸이 없고 각 일정·마감·휴가에 날짜칸이 붙는다',async()=>{const h=harness();h.api.seed(P.savePersonal(P.addSamples(fixture()),'김무현',{title:'오늘 일정 검증',date:C.today()}));h.api.session('김무현');await h.api.act({dataset:{action:'page',page:'schedule'}});let html=h.element('#app').innerHTML;assert.ok(html.includes('week-countdown'));assert.ok(!/<div class="sectionhead">[\s\S]*?week-countdown[\s\S]*?<div class="agenda-list">/.test(html.split('<div class="agenda-list">')[0]));for(const page of ['deadlines']){await h.api.act({dataset:{action:'page',page}});assert.match(h.element('#app').innerHTML,/week-countdown/);}});
test('인원관리 탭은 팀장에게 휴가만, 관리자에게 입사·퇴사도 제공한다',async()=>{const s=P.setLeaders(fixture(),{기획:'성아미'});for(const actor of ['정윤정','성아미','김무현']){const h=harness();h.api.seed(s);h.api.session(actor);h.api.render();const hasTab=h.element('#app').innerHTML.includes('data-page="people"');assert.equal(hasTab,actor!=='정윤정');if(hasTab){await h.api.act({dataset:{action:'page',page:'people'}});assert.match(h.element('#app').innerHTML,/팀원 휴가 관리/);assert.equal(h.element('#app').innerHTML.includes('입사·퇴사 인원 관리'),actor==='김무현');}}});
test('수정작업 저장은 부모 과업을 보존하고 수정 탭과 엑셀 분류 열에 반영한다',async()=>{const h=harness(),s=P.addSamples(fixture()),root=s.projects[0];h.api.seed(s);h.api.session('김무현');const before=JSON.stringify(h.api.read().state.projects[0]);await h.api.act({dataset:{action:'newRevision',id:root.id}});h.api.saveProject({title:'검증용 1차 수정',taskCategory:'UX',platform:'PC&MO',contentCategory:'',contentType:'',logContent:'',logDate:C.today()});const state=h.api.read().state,revision=state.projects.find(p=>p.parentProjectId===root.id);assert.ok(revision);assert.equal(JSON.stringify(state.projects[0]),before);await h.api.act({dataset:{action:'page',page:'revisions'}});assert.match(h.element('#app').innerHTML,/검증용 1차 수정/);await h.api.exportXlsx();const sheet=h.context.exportedSheets[0];assert.deepEqual(Array.from(sheet.headers.slice(0,3)),['분류 1','분류 2','분류 3']);assert.equal(sheet.headers.length,sheet.rows[0].length);});
test('홈 빈 일정에는 날짜칸을 표시하지 않고 개인 배치를 유지한다',async()=>{const h=harness();h.api.seed(fixture());h.api.session('김무현');h.api.render();let html=h.element('#app').innerHTML;assert.equal((html.match(/data-home-section=/g)||[]).length,6);assert.equal((html.match(/<span class="(?:filled)?"><\/span>/g)||[]).length,0);assert.ok(html.indexOf('data-home-section="memo"')<html.indexOf('data-home-section="thisWeek"'));await h.api.act({dataset:{action:'homeLayout'}});await h.api.act({dataset:{action:'layoutMove',key:'memo',direction:'1'}});await h.api.act({dataset:{action:'layoutSave'}});html=h.element('#app').innerHTML;assert.ok(html.indexOf('data-home-section="thisWeek"')<html.indexOf('data-home-section="memo"'));assert.equal(P.homeOrder(h.api.read().state,'정윤정')[0],'memo');});
test('팀장 휴가 등록 목록에는 소속 팀원만 나온다',async()=>{const h=harness();h.api.seed(P.setLeaders(fixture(),{콘텐츠:'김다솔'}));h.api.session('김다솔');await h.api.act({dataset:{action:'newLeave'}});const select=h.element('#editor').innerHTML.match(/<select name="owner"[\s\S]*?<\/select>/)[0];assert.equal((select.match(/<option /g)||[]).length,3);assert.ok(select.includes('김아영'));assert.ok(!select.includes('김무현'));});
test('저장 폴더 없이 내용 저장을 눌러도 홈과 로그인 상태를 유지한다',async()=>{const h=harness();h.api.seed(fixture());h.api.session('김무현');h.api.render();const before=h.element('#app').innerHTML;h.api.markDirty();await h.api.act({dataset:{action:'save'}});assert.equal(h.element('#app').innerHTML,before);assert.match(h.element('#toast').textContent,/브라우저에 임시 저장/);h.api.render();assert.match(h.element('#app').innerHTML,/나의 일정 한눈에 보기/);assert.equal(h.api.read().dirty,true);});
test('공용 파일 저장 후에도 홈과 로그인 상태를 유지한다',async()=>{const h=harness(),s=fixture(),src=handle('[]'),out=handle(JSON.stringify(s),true);h.api.seed(s);h.api.session('김무현');h.api.connect(src,out,out.text);h.api.markDirty();await h.api.act({dataset:{action:'save'}});assert.equal(out.writes,1);assert.match(h.element('#app').innerHTML,/나의 일정 한눈에 보기/);assert.match(h.element('#app').innerHTML,/로그아웃/);assert.equal(h.api.read().dirty,false);});
test('휴가 등록의 이름 목록은 관리자에게 전체 재직자, 일반 팀원에게 본인만 표시한다',async()=>{for(const actor of ['김무현','성아미','정윤정']){const h=harness();h.api.seed(P.setTeamAdmins(fixture(),'김무현',['성아미']));h.api.session(actor);await h.api.act({dataset:{action:'newLeave'}});const html=h.element('#editor').innerHTML,select=html.match(/<select name="owner"[\s\S]*?<\/select>/)[0];assert.equal((select.match(/<option /g)||[]).length,actor==='정윤정'?1:10);}});
function handle(text,writable=false){const h={text,writes:0,queryPermission:async()=> 'granted',getFile:async()=>({text:async()=>h.text})};h.createWritable=async()=>{if(!writable)throw new Error('원본 쓰기 금지');return {write:async value=>{h.text=value;h.writes++;},close:async()=>{},abort:async()=>{}};};return h;}
test('시작 화면의 검은 로그인 버튼과 로그인 확인란 조건을 연결한다',async()=>{const h=harness();await h.api.login();assert.match(h.element('.setup-footer').innerHTML,/black-button/);await h.api.act({dataset:{action:'skipSetup'}});await Promise.resolve();assert.equal(h.api.read().setupDone,true);h.element('#loginName').value='김무현';await h.api.updateLogin();assert.equal(h.element('#confirmField').hidden,false);const s=fixture();s.accounts.김무현={salt:'a',hash:'b',iterations:150000};h.api.seed(s);await h.api.updateLogin();assert.equal(h.element('#confirmField').hidden,true);});
test('홈·팀장 설정·주간보고 전체 팀 개인 순서가 실제 렌더 함수에 연결된다',async()=>{const h=harness();h.api.seed(fixture());h.api.session('김무현');h.api.render();const html=h.element('#app').innerHTML;for(const text of ['이번 주','다음 주','프로젝트 마감','팀원 휴가 일정','휴가 등록','로그아웃','내용 저장'])assert.ok(html.includes(text),text);await h.api.act({dataset:{action:'page',page:'people'}});assert.match(h.element('#app').innerHTML,/팀장 지정/);await h.api.act({dataset:{action:'page',page:'report'}});const report=h.element('#app').innerHTML;assert.ok(report.indexOf('data-scope="all"')<report.indexOf('data-scope="team"'));assert.ok(report.indexOf('data-scope="team"')<report.indexOf('data-scope="personal"'));});
test('새로고침은 원본 전체를 읽고 통합관리 파일에만 저장한다',async()=>{const h=harness(),s=fixture(),src=handle(JSON.stringify([{id:'r1',과업명:'처음 요청',담당자_퍼블:'김무현'}])),out=handle(JSON.stringify(s),true);h.api.seed(s);h.api.session('김무현');h.api.connect(src,out,out.text);await h.api.refreshAll();assert.equal(h.api.read().state.projects.length,1);src.text=JSON.stringify([{id:'r1',과업명:'변경 요청',담당자_퍼블:'김무현'},{id:'r2',과업명:'새 요청'}]);await h.api.refreshAll();assert.equal(h.api.read().state.projects.length,2);assert.equal(C.effective(h.api.read().state.projects[0]).title,'변경 요청');await h.api.saveDisk();assert.equal(src.writes,0);assert.equal(out.writes,1);assert.ok(h.vault.connections.sourceHandle===src);assert.equal(JSON.parse(out.text).projects.length,2);});
test('다른 사람의 저장과 임시 변경이 충돌하면 새로고침과 저장 모두 중단한다',async()=>{const h=harness(),s=fixture(),src=handle('[]'),out=handle(JSON.stringify(s),true);h.api.seed(s);h.api.session('김무현');h.api.connect(src,out,out.text);h.api.markDirty();out.text=JSON.stringify({...s,revision:100});await assert.rejects(h.api.refreshAll(),/공용 파일과 현재 변경사항/);await assert.rejects(h.api.saveDisk(),/다른 사용자가/);assert.equal(out.writes,0);assert.equal(h.api.read().dirty,true);});
test('기억된 연결의 권한이 유지되면 폴더를 다시 선택하지 않고 복원한다',async()=>{const h=harness(),s=fixture(),src=handle('[]'),out=handle(JSON.stringify(s),true),dir={queryPermission:async()=> 'granted'};h.api.seed(s);h.vault.connections={sourceDir:dir,targetDir:dir,sourceHandle:src,targetHandle:out,lastDiskText:out.text};await h.api.restoreFolders();assert.equal(h.api.read().setupDone,true);assert.equal(h.api.read().health.source,true);assert.equal(out.writes,0);});

test('모든 스타일을 실제 설정에서 전환해도 자료와 저장 상태, 단일 상단바를 보존한다',async()=>{
 const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현');h.api.markDirty();h.api.render();
 assert.equal(h.context.document.documentElement.dataset.style,'briefing');assert.match(h.element('#app').innerHTML,/팀 브리핑/);
 const before=JSON.stringify(h.api.read().state);
 for(const style of require('../js/display-styles.js').catalog){
  await h.api.act({dataset:{action:'displayStyle',style:style.id}});
  const html=h.element('#app').innerHTML;
  assert.equal(h.context.document.documentElement.dataset.style,style.id);
  assert.equal(JSON.stringify(h.api.read().state),before);
  assert.equal(h.api.read().dirty,true);
  assert.equal((html.match(/class="topbar"/g)||[]).length,1);
  assert.equal((html.match(/data-action="connections"/g)||[]).length,2);
  assert.match(h.element('#editor').innerHTML,new RegExp('data-style="'+style.id+'" aria-pressed="true"'));
  if(style.id==='top'){assert.match(html,/<header class="topbar"><details class="top-navigation">/);assert.equal((html.match(/<aside/g)||[]).length,1);}
  if(style.id==='kanban')assert.match(html,/live-kanban/);
  if(style.id==='timeline')assert.match(html,/live-timeline/);
 }
});

test('비교 화면에서 선택한 스타일은 열린 업무 화면에도 반영되며 편집 중인 내용은 보존한다',async()=>{
 const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현');h.api.render();
 const current=h.api.read().state.projects[0];await h.api.act({dataset:{action:'edit',id:current.id}});
 const editor=h.element('#editor').innerHTML,before=JSON.stringify(h.api.read().state);
 h.context.localStorage.setItem('workplace-style','timeline');h.windowEvent('storage',{key:'workplace-style'});
 assert.equal(h.context.document.documentElement.dataset.style,'timeline');assert.match(h.element('#app').innerHTML,/live-timeline/);
 assert.equal(h.element('#editor').innerHTML,editor);assert.equal(h.element('#editor').open,true);assert.equal(JSON.stringify(h.api.read().state),before);
});

test('연결 상태 버튼에서 연결 관리를 열고 별도 점 없이 저장 버튼으로 변경사항을 표시한다',async()=>{
 const h=harness();h.api.seed(fixture());h.api.session('김무현');h.api.markDirty();h.api.render();
 const header=h.element('#app').innerHTML.match(/<header class="topbar">[\s\S]*?<\/header>/)[0];
 assert.match(header,/저장 전 변경사항 있음/);assert.match(header,/💾/);assert.match(header,/⚙️/);assert.ok(!header.includes('● 내용 저장'));assert.ok(!header.includes('pending-dot'));assert.ok(!header.includes('folder-icon'));
 assert.equal((header.match(/connection-status needs-connection/g)||[]).length,2);
 for(const connection of ['source','target']){
  await h.api.act({dataset:{action:'connections',connection}});
  assert.match(h.element('#editor').innerHTML,/폴더 연결 확인/);
  assert.match(h.element('#editor').innerHTML,/data-action="sourceFolder"/);
  assert.match(h.element('#editor').innerHTML,/data-action="connect"/);
 }
});

test('D+2는 두 칸, D+9는 일곱 칸을 채우고 완료 일정은 채우지 않는다',()=>{
 const h=harness(),today=C.today(),day=delta=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10);};
 for(const [offset,count] of [[-2,2],[-9,7],[2,2],[0,0]]){
  const html=h.api.weekBlocks(day(offset));assert.equal((html.match(/class="filled"/g)||[]).length,count);if(offset<0)assert.match(html,/week-countdown overdue/);
 }
 const done=h.api.weekBlocks(day(-2),true);assert.match(done,/is-complete/);assert.ok(!done.includes('class="filled"'));
});

test('홈 메모는 다섯 번째 이후도 유지하고 제목 오른쪽 넘김 버튼과 연결한다',async()=>{
 const h=harness(),s=fixture();s.personal['김무현']=Array.from({length:6},(_,i)=>({id:'carousel-'+i,title:'메모 '+(i+1),date:'',time:'',content:'메모 내용',done:false}));
 h.api.seed(s);h.api.session('김무현');h.api.render();
 let html=h.element('#app').innerHTML;for(let i=1;i<=6;i++)assert.ok(html.includes('메모 '+i));
 assert.match(html,/data-memo-controls="home-memos"/);assert.match(html,/id="home-memos"/);
 await h.api.act({dataset:{action:'page',page:'memo'}});html=h.element('#app').innerHTML;assert.match(html,/id="personal-memos"/);assert.match(html,/data-memo-controls="personal-memos"/);
 await h.api.act({dataset:{action:'preferences'}});assert.ok(!h.element('#editor').innerHTML.includes('디자인 시안 10개 비교하기'));assert.match(h.element('#editor').innerHTML,/화면 스타일/);
});

test('빈 안내 캐릭터는 화면 종류가 아닌 로그인한 사용자의 선택을 따른다',async()=>{
 const h=harness(),s=fixture();s.members.find(m=>m.name==='김무현').avatar='bbiyak';h.api.seed(s);h.api.session('김무현');
 for(const page of ['dashboard','memo','today','board']){
  await h.api.act({dataset:{action:'page',page}});
  const hints=[...h.element('#app').innerHTML.matchAll(/class="illustrated-hint"><img src="([^"]+)"/g)];
  assert.ok(hints.length,page);assert.ok(hints.every(m=>m[1].endsWith('bbiyak-3d.png')),page);
 }
 await h.api.act({dataset:{action:'setAvatar',avatar:'yongyong'}});
 assert.match(h.element('#app').innerHTML,/class="illustrated-hint"><img src="[^"]*yongyong-3d.png"/);
 h.api.session('정윤정');await h.api.act({dataset:{action:'page',page:'memo'}});
 assert.match(h.element('#app').innerHTML,/class="illustrated-hint"><img src="[^"]*yongyong-3d.png"/);
});

test('제거한 캐릭터는 선택 목록에서 숨기고 기존 선택은 기본 캐릭터로 표시한다',async()=>{
 const h=harness(),s=fixture();s.members.find(m=>m.name==='김무현').avatar='kirby';h.api.seed(s);h.api.session('김무현');h.api.render();
 assert.match(h.element('#app').innerHTML,/내 캐릭터 변경: 용용이/);
 await h.api.act({dataset:{action:'avatarSettings'}});
 for(const key of ['kirby','pikachu','charmander']){
  assert.ok(!h.element('#editor').innerHTML.includes('data-avatar="'+key+'"'));
  await assert.rejects(h.api.act({dataset:{action:'setAvatar',avatar:key}}));
 }
});

test('새 3D 햄토리와 펭귄을 선택하면 프로필과 빈 안내에 적용하고 저장할 수 있다',async()=>{
 const h=harness();h.api.seed(fixture());h.api.session('김무현');
 for(const key of ['hamtaro','penguin']){
  await h.api.act({dataset:{action:'avatarSettings'}});assert.ok(h.element('#editor').innerHTML.includes(key+'-3d.png'));
  await h.api.act({dataset:{action:'setAvatar',avatar:key}});const html=h.element('#app').innerHTML;
  assert.ok(html.includes(key+'-3d.png'));assert.ok([...html.matchAll(/class="illustrated-hint"><img src="([^"]+)"/g)].every(m=>m[1].endsWith(key+'-3d.png')));
  assert.doesNotThrow(()=>C.validateState(JSON.parse(JSON.stringify(h.api.read().state))));
 }
});

test('테리어몬은 사용자가 지정한 original 경로로 선택·프로필·빈 안내에 연결한다',async()=>{
 const h=harness();h.api.seed(fixture());h.api.session('김무현');await h.api.act({dataset:{action:'avatarSettings'}});
 assert.match(h.element('#editor').innerHTML,/terriermon-original.jpg/);
 await h.api.act({dataset:{action:'setAvatar',avatar:'terriermon'}});
 const html=h.element('#app').innerHTML;assert.match(html,/내 캐릭터 변경: 테리어몬/);assert.match(html,/terriermon-original.jpg/);assert.ok(!html.includes('terriermon-3d.png'));
 assert.doesNotThrow(()=>C.validateState(JSON.parse(JSON.stringify(h.api.read().state))));
});

test('첫 화면은 업무 보드이며 카드 상세에서 체크와 수정이 연결된다',async()=>{
 const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현',null);h.api.render();
 assert.equal(h.context.document.documentElement.dataset.boardView,'true');
 assert.match(h.element('#app').innerHTML,/보드 기준/);
 await h.api.act({dataset:{action:'boardMode',mode:'status'}});
 assert.match(h.element('#app').innerHTML,/draggable="true"/);
 const p=h.api.read().state.projects.find(p=>p.tasks?.length);
 await h.api.act({dataset:{action:'boardDetail',id:p.id}});
 assert.equal(h.element('#editor').open,true);
 assert.match(h.element('#editor').innerHTML,/활동 기록/);
 h.api.session(p.tasks[0].assignees[0],'work');
 await h.api.act({dataset:{action:'toggleBoardTask',id:p.id,taskId:p.tasks[0].id}});
 assert.equal(h.element('#editor').open,true);
 assert.match(h.element('#editor').innerHTML,/담당자 · 마감일 · 내용 편집/);
 await h.api.act({dataset:{action:'edit',id:p.id}});
 assert.match(h.element('#editor').innerHTML,/projectForm/);
});

test('모든 보드 보기에서 카드와 하위 업무 수정이 같은 편집기를 연다',async()=>{
 const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현','work');
 const p=h.api.read().state.projects.find(p=>p.tasks?.length);
 for(const mode of ['person','status','team','project']){
  await h.api.act({dataset:{action:'boardMode',mode}});
  assert.match(h.element('#app').innerHTML,/data-action="editBoardTask"/);
  assert.match(h.element('#app').innerHTML,/카드 편집/);
  await h.api.act({dataset:{action:'editBoardTask',id:p.id,taskId:p.tasks[0].id}});
  assert.equal(h.element('#editor').open,true);
  assert.match(h.element('#editor').innerHTML,/projectForm/);
  await h.api.act({dataset:{action:'close'}});
 }
});

test('화면 이벤트에서도 타인의 완료 체크를 차단하고 원본 상태를 유지한다',async()=>{
 const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현','work');
 const state=h.api.read().state,p=state.projects.find(p=>p.tasks?.some(t=>!t.assignees.includes('김무현')));
 const task=p.tasks.find(t=>!t.assignees.includes('김무현')),before=JSON.stringify(state.projects);
 await assert.rejects(h.api.act({dataset:{action:'toggleBoardTask',id:p.id,taskId:task.id}}),/본인이 담당/);
 assert.equal(JSON.stringify(h.api.read().state.projects),before);
 h.api.render();assert.match(h.element('#app').innerHTML,/disabled title="담당자 본인만 진행률을 변경할 수 있습니다"/);
});

test('도표형 전환은 네 탭에서 같은 과업을 표시하고 신규 버튼 왼쪽에 위치한다',async()=>{
 const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현','work');h.api.render();
 let html=h.element('#app').innerHTML;
 assert.ok(html.indexOf('data-action="boardLayout"')<html.indexOf('data-action="new"'));
 const nav=html.match(/<nav[^>]*>[\s\S]*?<\/nav>/)[0];assert.ok(!nav.includes('data-page="revisions"'));
 await h.api.act({dataset:{action:'boardLayout'}});
 for(const mode of ['project','status','team','person']){
  await h.api.act({dataset:{action:'boardMode',mode}});html=h.element('#app').innerHTML;
  assert.match(html,/board-table-view/);assert.match(html,/<table>/);assert.match(html,/진행률/);assert.match(html,/카드형 보기/);
 }
 await h.api.act({dataset:{action:'boardLayout'}});assert.ok(!h.element('#app').innerHTML.includes('board-table-view'));
});

test('날짜 초기화는 담당자와 도표형 선택을 유지한다',async()=>{
 const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현','work');
 await h.api.act({dataset:{action:'boardMine'}});await h.api.act({dataset:{action:'boardLayout'}});
 await h.change({id:'boardFrom',dataset:{boardDate:'from'},value:'2026-11-01'});
 await h.change({id:'boardTo',dataset:{boardDate:'to'},value:'2026-11-30'});
 assert.match(h.element('#app').innerHTML,/value="2026-11-01"/);
 await h.api.act({dataset:{action:'resetBoardDates'}});
 const html=h.element('#app').innerHTML;assert.match(html,/boardFrom[^>]*value=""/);assert.match(html,/boardTo[^>]*value=""/);assert.match(html,/id="boardName"[^>]*value="김무현"/);assert.match(html,/board-table-view/);
});
test('간단 편집에서 제목만 바꿔도 고객과 분류 및 기존 기록을 보존한다',async()=>{
 const h=harness(),s=P.addSamples(fixture()),p=s.projects[0];p.customer='보존 고객';p.link='https://example.com';p.taskCategory='UX';p.platform='PC&MO';h.api.seed(s);h.api.session('김무현','work');
 await h.api.act({dataset:{action:'edit',id:p.id}});
 assert.match(h.element('#editor').innerHTML,/simple-project-form/);assert.ok(!h.element('#editor').innerHTML.includes('classification-fields'));
 h.api.saveProject({title:'간단 수정',description:'설명',logContent:'',logDate:C.today()});
 const saved=C.effective(h.api.read().state.projects.find(item=>item.id===p.id));assert.equal(saved.title,'간단 수정');assert.equal(saved.customer,'보존 고객');assert.equal(saved.link,'https://example.com');assert.equal(saved.taskCategory,'UX');assert.deepEqual(saved.logs,p.logs);
});
