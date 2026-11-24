const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const C=require('./core-fixture.cjs'),P=require('./people-fixture.cjs');
function harness(){
 const events={};
 const nodes=new Map(),element=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',value:'',dataset:{},style:{},hidden:false,disabled:false,open:false,addEventListener(){},focus(){},insertAdjacentHTML(_,html){this.innerHTML+=html;},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(selector);};
 const store=new Map(),vault={rememberConnections:async v=>{vault.connections=v;},recallConnections:async()=>vault.connections,recall:async()=>null,forget:async()=>{}};
 const context={BoardKpiSamples:require('./kpi-samples.js'),BoardDesktopWidget:require('../source/html/widgets/launcher.js'),BoardFeaturePages:require('../source/html/pages.js'),BoardKpi:require('../source/html/reports/kpi.js'),BoardLeavePolicy:require('../source/js/leave-policy.js'),BoardLeaveTypes:require('../source/js/leave-types.js'),BoardLeaveCalendar:require('../source/js/leave-calendar.js'),BoardOrganization:require('../source/js/organization-chart.js'),BoardCardExpenses:require('../source/js/card-expenses.js'),BoardArrowIcons:require('../source/js/arrow-icons.js'),BoardWorkRequests:{ui:()=>({sync(){},paint(){},service:{snapshot:()=>({rows:[]}),refresh:async()=>{}}})},BoardLiveCursors:{create:()=>({paint(){}})},BoardFold:require('../source/js/board-fold.js'),BoardAvatars:require('../source/js/avatar-catalog.js'),BoardBriefingDashboard:require('../source/js/briefing-dashboard.js'),BoardBriefingHero:require('../source/js/briefing-hero.js'),BoardPresence:require('../source/js/presence.js'),BoardProjectReport:require('../source/js/project-report.js'),BoardSimpleEditor:require('../source/js/simple-editor.js'),BoardBriefingCalendar:require('../source/js/briefing-calendar.js'),BoardAccountReset:require('../source/js/account-reset.js'),BoardTaskBoard:require('../source/js/task-board.js'),BoardMemoCarousel:require('../source/js/memo-carousel.js'),BoardDisplayStyles:require('../source/js/display-styles.js'),BoardXlsx:{workbook:sheets=>{context.exportedSheets=sheets;return {};}},URL:{createObjectURL:()=>'',revokeObjectURL(){}},FormData:class extends Map{constructor(form){super(Object.entries(form.fields||form));}getAll(key){const value=this.get(key);return Array.isArray(value)?value:value===undefined?[]:[value];}},BoardWorkTables:require('../source/js/work-tables.js'),BoardNavigation:require('../source/js/navigation.js'),BoardTeamPosts:require('../source/js/team-board.js'),BoardDetailViews:require('../source/js/detail-views.js'),BoardCore:C,BoardPeople:P,BoardWorkspace:require('../source/js/workspace.js'),BoardVault:vault,document:{createElement:()=>({click(){}}),querySelectorAll:()=>[],querySelector:element,documentElement:{dataset:{}},addEventListener:(type,fn)=>{(events[type]??=[]).push(fn);},activeElement:null},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},window:{addEventListener:(type,fn)=>{(events['window:'+type]??=[]).push(fn);}},jQuery:()=>{},structuredClone,crypto:require('node:crypto').webcrypto,TextEncoder,Uint8Array,setTimeout:()=>0,clearTimeout(){},console,confirm:()=>true};
 vm.createContext(context);
 const source=fs.readFileSync(require.resolve('../source/js/app.js'),'utf8');
 // Expose the closure only in this isolated in-memory test; no production login bypass.
 const instrumented=source.replace(/\}\)\(\);\s*$/,`globalThis.testApp={weekBlocks,render,login,act,saveProject,exportXlsx,updateLogin,refreshAll,saveDisk,restoreFolders,setupExtras,read:()=>({state,dirty,setupDone,health}),seed:s=>{state=P.upgrade(s);syncRoster();},session:(n,startPage="dashboard")=>{user=member(n);setupDone=true;if(startPage){page=startPage;view=startPage==="work"?"board":"category";}},connect:(src,out,text)=>{sourceHandle=src;targetHandle=out;sourceDir=targetDir={queryPermission:async()=> 'granted'};diskText=text;},markDirty:()=>changed()};})();`);
 vm.runInContext(instrumented,context);return {api:context.testApp,element,vault,context,change:async target=>{for(const fn of events.change||[])await fn({target});},windowEvent:(type,event)=>events['window:'+type]?.forEach(fn=>fn(event)),submit:form=>events.submit.forEach(fn=>fn({target:form,preventDefault(){}}))};
}
const fixture=()=>P.upgrade({...C.sampleState(),demo:false,projects:[]});
test('퍼블리싱 문서는 고객 목록 자동 생성 없이 탭 안에서 직접 등록하고 독립 저장한다',async()=>{
 const raw={id:'not-a-document',과업명:'문서로 자동 생성하면 안 되는 고객 과업',담당자_퍼블:'김무현'},h=harness();h.api.seed(C.importRows(fixture(),[raw]).state);h.api.session('김무현','publishingDocs');h.api.render();
 assert.doesNotMatch(h.element('#app').innerHTML,/문서로 자동 생성하면 안 되는 고객 과업/);assert.match(h.element('#app').innerHTML,/data-action="publishingNewDocument"/);
 const source=handle(JSON.stringify([raw])),out=handle(JSON.stringify(h.api.read().state),true);h.api.connect(source,out,out.text);
 await h.api.act({dataset:{action:'publishingNewDocument'}});assert.equal(h.element('#editor').open,true);assert.match(h.element('#editor').innerHTML,/id="publishingDocumentForm"/);assert.doesNotMatch(h.element('#app').innerHTML,/id="publishingDocumentForm"/);
 h.submit({id:'publishingDocumentForm',dataset:{id:''},fields:{title:'직접 등록한 퍼블리싱 문서',due:'2026-12-01','디자인':['홍소영'],'퍼블':['김무현']}});
 const doc=h.api.read().state.publishingDocuments[0];assert.equal(doc.source,'manual');assert.equal(doc.createdBy,'김무현');assert.equal(h.api.read().state.projects.length,1);assert.match(h.element('#app').innerHTML,/직접 등록한 퍼블리싱 문서/);
 await h.api.act({dataset:{action:'publishingRegister',id:doc.id,section:'development'}});
 h.submit({id:'publishingForm',dataset:{id:doc.id,section:'development'},fields:{section:'development',developmentName:['개발'],developmentUrl:['https://example.com/manual-dev']}});
 assert.equal(C.effective(h.api.read().state.publishingDocuments[0]).workflow.publication.developmentLinks.length,1);
 await h.api.act({dataset:{action:'save'}});assert.equal(source.writes,0);const loaded=C.validateState(JSON.parse(out.text));assert.equal(loaded.publishingDocuments[0].title,'직접 등록한 퍼블리싱 문서');assert.deepEqual(loaded.projects[0].raw,raw);
 await h.api.act({dataset:{action:'page',page:'work'}});assert.doesNotMatch(h.element('#app').innerHTML,/직접 등록한 퍼블리싱 문서/);
 await h.api.act({dataset:{action:'page',page:'publishingDocs'}});assert.match(h.element('#app').innerHTML,/직접 등록한 퍼블리싱 문서/);
});
test('퍼블리싱 등록 팝업에서 전체 항목을 한 번에 저장하고 수정한다',async()=>{
 const h=harness();h.api.seed(fixture());h.api.session('김무현','publishingDocs');await h.api.act({dataset:{action:'publishingNewDocument'}});
 for(const name of ['title','due','depth1','depth2','depth3','artifactName','artifactUrl','developmentName','developmentUrl','linkName','linkUrl','outputFiles'])assert.ok(h.element('#editor').innerHTML.includes('name="'+name+'"'),name);
 const fields={title:'팝업 통합 문서',due:'2026-12-01','디자인':['홍소영'],'퍼블':['김무현'],depth1:'고객센터',depth2:'홈',depth3:'안내',artifactName:['결과물'],artifactUrl:['https://example.com/output.zip'],developmentName:['PC','MO'],developmentUrl:['https://example.com/pc','https://example.com/mo'],linkName:['참고'],linkUrl:['https://example.com/reference']};
 h.submit({id:'publishingDocumentForm',dataset:{id:''},fields});
 const doc=h.api.read().state.publishingDocuments[0],pub=doc.workflow.publication;assert.equal(h.element('#editor').open,false);assert.deepEqual(Array.from(pub.path),['고객센터','홈','안내']);assert.equal(pub.developmentLinks.length,2);assert.equal(pub.links[0].name,'참고');assert.equal(pub.artifacts[0].name,'결과물');assert.equal(pub.outputRegistered,true);assert.equal(h.api.read().state.projects.length,0);
 assert.match(h.element('#app').innerHTML,/문서 수정/);assert.ok(h.element('#app').innerHTML.includes('>수정</button>'));await h.api.act({dataset:{action:'publishingView',view:'all'}});assert.match(h.element('#app').innerHTML,/문서 수정/);await h.api.act({dataset:{action:'publishingEditDocument',id:doc.id}});assert.match(h.element('#editor').innerHTML,/value="결과물"/);assert.ok(h.element('#editor').innerHTML.includes('value="https://example.com/mo"'));
 h.submit({id:'publishingDocumentForm',dataset:{id:doc.id},fields:{...fields,title:'수정한 문서',due:'2026-12-20',depth3:'변경한 메뉴',artifactName:['새 산출물'],linkName:['새 링크'],developmentName:['수정 PC','수정 MO']}});assert.equal(h.api.read().state.publishingDocuments.length,1);assert.equal(h.api.read().state.publishingDocuments[0].title,'수정한 문서');const edited=h.api.read().state.publishingDocuments[0];assert.equal(edited.requestedDue,'2026-12-20');assert.equal(edited.workflow.publication.path[2],'변경한 메뉴');assert.equal(edited.workflow.publication.artifacts[0].name,'새 산출물');assert.equal(edited.workflow.publication.links[0].name,'새 링크');assert.equal(edited.workflow.publication.developmentLinks[1].name,'수정 MO');C.validateState(JSON.parse(JSON.stringify(h.api.read().state)));
});
test('퍼블리싱 팝업 검증 실패 시 문서 일부를 저장하지 않는다',async()=>{
 const h=harness();h.api.seed(fixture());h.api.session('김무현','publishingDocs');await h.api.act({dataset:{action:'publishingNewDocument'}});
 h.submit({id:'publishingDocumentForm',dataset:{id:''},fields:{title:'잘못된 링크','퍼블':['김무현'],developmentName:['개발'],developmentUrl:['javascript:alert(1)']}});
 await new Promise(resolve=>setImmediate(resolve));assert.match(h.element('#publishingDocumentError').textContent,/개발배포/);assert.equal(h.api.read().state.publishingDocuments?.length||0,0);assert.equal(h.element('#editor').open,true);
});
const legacyPublication=state=>{for(const p of state.projects)p.workflow={...p.workflow,publication:{path:['','',''],links:[],outputRegistered:false,author:'김무현',registeredAt:'2026-11-24T09:00:00Z',updatedAt:'2026-11-24T09:00:00Z'}};return state;};

test('산출물 파일 선택부터 비동기 읽기·등록·JSON 복원까지 원본과 분리한다',async()=>{
 const fs=require('node:fs'),{File}=require('node:buffer'),Attachments=require('../source/html/organization/board/attachments.js'),previous=globalThis.FileReader;
 // Bridge the browser FileReader API to a real File in the headless app harness.
 globalThis.FileReader=class{readAsDataURL(file){file.arrayBuffer().then(data=>{this.result='data:'+file.type+';base64,'+Buffer.from(data).toString('base64');this.onload();},error=>{this.error=error;this.onerror();});}};
 try{
  const raw={id:'file-output',과업명:'파일 산출물',담당자_퍼블:'김무현',진행상태:'진행중'},h=harness();h.context.BoardAttachments=Attachments;h.api.seed(C.importRows(fixture(),[raw]).state);h.api.session('김무현','publishingDocs');
  await h.api.act({dataset:{action:'publishingRegister',id:'source:file-output',section:'outputs'}});
  const bytes=fs.readFileSync(require.resolve('./fixtures/publishing-output.txt')),file=new File([bytes],'publishing-output.txt',{type:'text/plain'});
  h.submit({id:'publishingForm',dataset:{id:'source:file-output',section:'outputs'},fields:{section:'outputs',depth1:'__choose__',depth2:'',depth3:''},querySelector:()=>({files:[file]})});
  for(let i=0;i<20&&!C.effective(h.api.read().state.projects[0]).workflow?.publication;i++)await new Promise(resolve=>setImmediate(resolve));
  const saved=C.validateState(JSON.parse(JSON.stringify(h.api.read().state))),publication=C.effective(saved.projects[0]).workflow.publication;
  assert.equal(publication.outputRegistered,true);assert.equal(publication.attachments.length,1);assert.equal(publication.attachments[0].data,'data:text/plain;base64,'+bytes.toString('base64'));assert.deepEqual(publication.path,['','','']);assert.deepEqual(saved.projects[0].raw,raw);assert.match(h.element('#app').innerHTML,/publishing-output\.txt/);
 }finally{if(previous===undefined)delete globalThis.FileReader;else globalThis.FileReader=previous;}
});
test('퍼블리싱 열마다 별도로 등록하며 메뉴 선택을 링크 등록에 강제하지 않는다',async()=>{
 const raw={id:'edit-columns',과업명:'독립 등록',담당자_퍼블:'김무현',진행상태:'진행중'},h=harness();h.api.seed(legacyPublication(C.importRows(fixture(),[raw]).state));h.api.session('김무현','publishingDocs');
 await h.api.act({dataset:{action:'publishingRegister',id:'source:edit-columns',section:'development'}});assert.match(h.element('#app').innerHTML,/개발배포 링크 등록/);
 h.submit({id:'publishingForm',dataset:{id:'source:edit-columns',section:'development'},fields:{section:'development',developmentName:['개발1','개발2'],developmentUrl:['https://example.com/dev1','https://example.com/dev2']}});
 let publication=C.effective(h.api.read().state.projects[0]).workflow.publication;assert.equal(publication.developmentLinks.length,2);assert.equal(publication.outputRegistered,false);
 await h.api.act({dataset:{action:'publishingRegister',id:'source:edit-columns',section:'links'}});
 h.submit({id:'publishingForm',dataset:{id:'source:edit-columns',section:'links'},fields:{section:'links',linkName:['화면1','화면2'],linkUrl:['https://example.com/1','https://example.com/2']}});
 publication=C.effective(h.api.read().state.projects[0]).workflow.publication;assert.equal(publication.links.length,2);assert.equal(publication.developmentLinks.length,2);assert.equal(publication.outputRegistered,false);
 await h.api.act({dataset:{action:'publishingRegister',id:'source:edit-columns',section:'outputs'}});
 h.submit({id:'publishingForm',dataset:{id:'source:edit-columns',section:'outputs'},fields:{section:'outputs',depth1:'',depth2:'',depth3:'',artifactName:['파일 경로'],artifactUrl:['Z:\\산출물\\index.html']}});
 publication=C.effective(h.api.read().state.projects[0]).workflow.publication;assert.equal(publication.outputRegistered,true);assert.equal(publication.artifacts.length,1);assert.equal(publication.links.length,2);assert.deepEqual(h.api.read().state.projects[0].raw,raw);
});
test('퍼블리싱 문서는 지정 탭에서만 등록하고 원본을 보존하며 저장·복원한다',async()=>{
 const raw={id:'publication',과업명:'산출물 연결 과업',담당자_디자인:'홍소영',담당자_퍼블:'김무현',진행상태:'완료',완료요청일:'2026-11-25',작업링크:'https://example.com/output',개발반영:'https://example.com/dev'},source=handle(JSON.stringify([raw]));
 const h=harness();h.api.seed(legacyPublication(C.importRows(fixture(),[raw]).state));h.api.session('김무현','publishingDocs');
 const out=handle(JSON.stringify(h.api.read().state),true);h.api.connect(source,out,out.text);h.api.render();
 let html=h.element('#app').innerHTML;assert.match(html,/pd-table pd-tasks/);assert.doesNotMatch(html,/workflow-board/);
 const labels=['과업명','디자인','퍼블','마감일','개발배포','산출물','LINK'].map(label=>html.indexOf('>'+label+'</th>'));assert.ok(labels.every((v,i)=>v>=0&&(!i||v>labels[i-1])));assert.match(html,/href="https:\/\/example.com\/dev"/);
 await h.api.act({dataset:{action:'publishingRegister',id:'source:publication'}});assert.match(h.element('#app').innerHTML,/id="publishingForm"/);
 h.submit({id:'publishingForm',dataset:{id:'source:publication'},fields:{depth1:'고객센터',depth2:'홈',depth3:'',linkName:['결과물'],linkUrl:['https://example.com/output']}});
 assert.deepEqual(Array.from(C.effective(h.api.read().state.projects[0]).workflow.publication.path),['고객센터','홈','']);assert.match(h.element('#app').innerHTML,/>○<\/button>/);
 await h.api.act({dataset:{action:'publishingView',view:'all'}});assert.match(h.element('#app').innerHTML,/pd-table pd-all/);assert.match(h.element('#app').innerHTML,/고객센터/);
 await h.api.act({dataset:{action:'save'}});assert.equal(source.writes,0);const restored=C.validateState(JSON.parse(out.text));assert.deepEqual(restored.projects[0].raw,raw);assert.deepEqual(C.effective(restored.projects[0]).workflow.publication.path,['고객센터','홈','']);
 const updated={...raw,과업명:'고객이 갱신한 과업명'};const refreshed=C.importRows(restored,[updated]).state;assert.ok(C.effective(refreshed.projects[0]).workflow.publication);h.api.seed(refreshed);h.api.render();assert.match(h.element('#app').innerHTML,/고객이 갱신한 과업명/);
 await h.api.act({dataset:{action:'page',page:'work'}});assert.doesNotMatch(h.element('#app').innerHTML,/pd-table|publishingForm/);
});
test('UIUX 일정은 토글 옆에 있고 상세 타임라인은 댓글 뒤에 한 열로 둔다',async()=>{
 const h=harness();h.api.seed(C.importRows(fixture(),[{id:'detail-layout',과업명:'상세 레이아웃',담당자_퍼블:'김무현',진행상태:'진행중'}]).state);h.api.session('김무현','work');h.api.render();
 const html=h.element('#app').innerHTML,toolbar=html.match(/<div class="board-control-row ux-board-controls">[^]*?<\/div><\/div>/)[0];assert.match(toolbar,/boardLayout[^]*?uiuxSchedule[^]*?주간 일정[^]*?월간 일정/);assert.doesNotMatch(toolbar,/boardName|boardFrom|boardMine|새 과업/);
 await h.api.act({dataset:{action:'workflowDetail',id:'source:detail-layout',role:'퍼블'}});const detail=h.element('#editor').innerHTML;assert.ok(detail.indexOf('ux-comments')<detail.indexOf('ux-timeline'));assert.doesNotMatch(detail,/<aside|정보 수정/);assert.equal((detail.match(/data-uiux-form="starts"/g)||[]).length,1);
});
test('내 아바타 선택은 다른 사용자를 바꾸지 않고 공용 저장 후에도 유지된다',async()=>{const h=harness(),s=fixture(),out=handle(JSON.stringify(s),true);h.api.seed(s);h.api.session('김무현');h.api.connect(handle('[]'),out,out.text);await h.api.act({dataset:{action:'avatarSettings'}});assert.match(h.element('#editor').innerHTML,/용용이/);assert.match(h.element('#editor').innerHTML,/삐약이/);await h.api.act({dataset:{action:'setAvatar',avatar:'bbiyak'}});assert.equal(h.api.read().state.members.find(m=>m.name==='김무현').avatar,'bbiyak');assert.equal(h.api.read().state.members.find(m=>m.name==='정윤정').avatar,undefined);assert.match(h.element('#app').innerHTML,/내 캐릭터 변경: 삐약이/);await h.api.act({dataset:{action:'save'}});assert.equal(C.validateState(JSON.parse(out.text)).members.find(m=>m.name==='김무현').avatar,'bbiyak');await assert.rejects(h.api.act({dataset:{action:'setAvatar',avatar:'unknown'}}));});
test('상단 한 줄에 원본·저장 연결 상태와 재연결을 두고 바로가기·사이드바 중복을 제거한다',()=>{const h=harness();h.api.seed(fixture());h.api.session('김무현');h.api.render();const html=h.element('#app').innerHTML,header=html.match(/<header class="topbar">[\s\S]*?<\/header>/)[0];assert.equal((html.match(/class="topbar"/g)||[]).length,1);assert.match(header,/원본 연결안됨/);assert.match(header,/저장 연결안됨/);assert.match(header,/data-action="connections"/);assert.match(header,/data-connection="source"/);assert.match(header,/data-connection="target"/);assert.ok(!header.includes('folder-icon'));assert.ok(!header.includes('pending-dot'));assert.ok(!html.includes('W24DG'));assert.equal((html.match(/data-action="connections"/g)||[]).length,2);assert.ok(!html.split('</aside>')[0].includes('workspace-tools'));});
test('새 메뉴와 연도·퍼블리싱 표시, 휴가 상세 표에는 D-day가 없다',async()=>{const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현');for(const page of ['board','today','users','leaves']){await h.api.act({dataset:{action:'page',page}});const html=h.element('#app').innerHTML;assert.ok(!html.includes('undefined'));assert.match(html,/202\d년/);assert.match(html,/퍼블리싱 팀/);if(page==='leaves'){await h.api.act({dataset:{action:'leaveView',view:'table'}});const html=h.element('#app').innerHTML;assert.ok(!html.includes('week-countdown'));for(const label of ['날짜','팀','이름','직급','연차구분','비고','편집'])assert.ok(html.includes('>'+label+'</th>'));}}});
test('팀 게시글 UI 저장 후 공용 파일 저장·다시 읽기에 보존된다',async()=>{const h=harness(),s=fixture(),src=handle('[]'),out=handle(JSON.stringify(s),true);h.api.seed(s);h.api.session('김무현');h.api.connect(src,out,out.text);await h.api.act({dataset:{action:'page',page:'board'}});await h.api.act({dataset:{action:'newPost'}});assert.match(h.element('#editor').innerHTML,/postForm/);h.submit({id:'postForm',fields:{id:'',team:'퍼블',title:'안내 <script>',content:'공유 내용',pinned:'on'}});assert.equal(h.api.read().state.teamPosts.length,1);assert.match(h.element('#app').innerHTML,/안내 &lt;script&gt;/);await h.api.act({dataset:{action:'save'}});const loaded=C.validateState(JSON.parse(out.text));assert.equal(loaded.teamPosts[0].content,'공유 내용');assert.equal(src.writes,0);});
test('WorkLog 관리자 등록과 해제를 직책 관리에서 적용하고 공용으로 저장한다',async()=>{
 const h=harness(),s=P.migrateRoles(fixture()),src=handle('[]'),out=handle(JSON.stringify(s),true);
 h.api.seed(s);h.api.session('김무현','people');h.api.connect(src,out,out.text);
 await h.api.act({dataset:{action:'peopleSection',section:'roles'}});
 await h.api.act({dataset:{action:'adminSettings'}});
 assert.match(h.element('#editor').innerHTML,/WorkLog 관리자 등록·해제/);
 h.submit({id:'adminsForm',fields:{admins:[]}});
 assert.match(h.element('#adminsError').textContent,/한 명 이상/);
 h.submit({id:'adminsForm',fields:{admins:['정윤정']}});
 assert.equal(h.api.read().state.overallAdmin,'정윤정');
 assert.equal(P.canManage(h.api.read().state,'김무현'),false);
 await h.api.act({dataset:{action:'save'}});
 assert.deepEqual(JSON.parse(out.text).overallAdmins,['정윤정']);
 await assert.rejects(h.api.act({dataset:{action:'adminSettings'}}));
 h.api.session('정윤정','people');
 await h.api.act({dataset:{action:'adminSettings'}});
 assert.match(h.element('#editor').innerHTML,/value="정윤정" checked/);
});
test('모든 상세 탭은 렌더되고 업무는 보드가 기본이고 고객·주간보고는 표를 제공한다',async()=>{const h=harness(),s=P.addSamples(fixture());h.api.seed(s);h.api.session('김무현');for(const page of ['dashboard','work','memo','schedule','deadlines','leaves','revisions','customers','report','people','settings']){await h.api.act({dataset:{action:'page',page}});const html=h.element('#app').innerHTML;assert.ok(!html.includes('undefined'),page);if(page==='work')assert.match(html,/남은 과업 보드/);if(page==='work'){assert.ok(!html.includes('board-filters'));assert.match(html,/board-control-row/);}if(page==='report')assert.match(html,/weekly-projects/);if(['customers','report'].includes(page)){if(page==='customers'){assert.match(html,/분류별/);assert.match(html,/과업별/);}assert.ok(html.indexOf('data-scope="all"')<html.indexOf('data-scope="team"'));assert.ok(html.indexOf('data-scope="team"')<html.indexOf('data-scope="personal"'));}}});
test('일정 제목에는 날짜칸이 없고 각 일정·마감·휴가에 날짜칸이 붙는다',async()=>{const h=harness();h.api.seed(P.savePersonal(C.importRows(fixture(),[{id:'scheduled',과업명:'일정 검증',담당자_퍼블:'김무현',시작일:C.today(),마감일:C.today()}]).state,'김무현',{title:'오늘 일정 검증',date:C.today()}));h.api.session('김무현');await h.api.act({dataset:{action:'page',page:'schedule'}});let html=h.element('#app').innerHTML;assert.ok(html.includes('week-countdown'));assert.ok(!/<div class="sectionhead">[\s\S]*?week-countdown[\s\S]*?<div class="agenda-list">/.test(html.split('<div class="agenda-list">')[0]));for(const page of ['deadlines']){await h.api.act({dataset:{action:'page',page}});assert.match(h.element('#app').innerHTML,/week-countdown/);}});
test('인원관리는 재직자가 조회하고 수정 버튼과 저장은 관리자에게만 허용한다',async()=>{
 const s=P.setTeamAdmins(P.setLeaders(fixture(),{디자인:'홍소영'}),'김무현',['성아미']);
 for(const actor of ['정윤정','홍소영','성아미','김무현']){
  const h=harness();h.api.seed(s);h.api.session(actor);h.api.render();
  const hasTab=h.element('#app').innerHTML.includes('data-page="people"');
  assert.equal(hasTab,true);
  if(actor!=='김무현'){
   const before=JSON.stringify(h.api.read().state);
   await h.api.act({dataset:{action:'page',page:'people'}});
   for(const section of ['org','roles','members']){
    await h.api.act({dataset:{action:'peopleSection',section}});
    const html=h.element('#app').innerHTML;
    assert.match(html,/people-management/);
    assert.match(html,/김무현/);
    assert.doesNotMatch(html,/data-action="(?:orgAdd|orgEdit|orgDelete|orgMove|orgLevel|orgInsertLevel|rankAdd|rankEdit|rankDelete|rankUp|rankDown|adminSettings|addMember|rehire|removeMember|editMemberRank|passwords|resetPassword)"/);
   }
   for(const action of ['addMember','editMemberRank','passwords','rankAdd','orgEdit','adminSettings']){
    await assert.rejects(h.api.act({dataset:{action}}),/WorkLog 관리자/);
   }
   for(const [id,fields] of Object.entries({
    memberForm:{name:'새 멤버',team:'기획',rank:'대리'},
    memberRankForm:{name:'정윤정',rank:'부장'},
    removeMemberForm:{name:'정윤정',retention:'keep',acknowledge:'on'},
    adminsForm:{admins:[actor]},
    rankOrderForm:{name:'새 직책'},
    organizationForm:{id:'worklog',name:'다른 이름'},
    organizationLevelForm:{index:'0',name:'다른 레벨'}
   }))h.submit({id,fields});
   assert.equal(JSON.stringify(h.api.read().state),before);
   continue;
  }
  await h.api.act({dataset:{action:'page',page:'people'}});
  const org=h.element('#app').innerHTML;
  assert.match(org,/data-section="org" aria-pressed="true"/);
  assert.match(org,/people-org-sheet/);
  assert.match(org,/rowspan="\d+"><div class="people-cell-actions"><strong>WorkLog/);
  assert.ok(org.includes('<strong>디자인</strong>'));
  assert.match(org,/<div class="people-org-member"><strong>김무현<\/strong><span class="muted">대리<\/span><span class="badge">관리자<\/span><\/div>/);
  assert.doesNotMatch(org,/입사·퇴사 인원 관리|팀원 휴가 관리/);
  await h.api.act({dataset:{action:'peopleSection',section:'roles'}});
  const roles=h.element('#app').innerHTML;
  assert.match(roles,/data-section="roles" aria-pressed="true"/);
  assert.match(roles,/직책과 정렬 순서/);
  assert.ok(roles.includes('data-action="rankAdd"'));
  assert.ok(roles.includes('data-action="rankEdit"'));
  assert.ok(roles.includes('data-action="adminSettings"'));
  assert.doesNotMatch(roles,/전체관리자|팀관리자/);
  assert.deepEqual([...roles.matchAll(/<tr><td>(부장|차장|과장|대리|사원)<\/td>/g)].map(match=>match[1]),['부장','차장','과장','대리','사원']);
  await h.api.act({dataset:{action:'peopleSection',section:'members'}});
  const members=h.element('#app').innerHTML;
  assert.match(members,/data-section="members" aria-pressed="true"/);
  assert.doesNotMatch(members,/팀원 휴가 관리|leave-workspace/);
  assert.ok(members.includes('입사·퇴사 인원 관리'));
  assert.ok(members.includes('개별 비밀번호 초기화'));
  const nav=members.match(/<nav\b[\s\S]*?<\/nav>/)[0];
  assert.match(nav,/data-page="dashboard"[^]*?<\/div><div class="nav-section"><button[^>]*data-page="memo"[^]*?data-section="work"/);
  const teamNav=nav.slice(nav.indexOf('id="nav-team"'),nav.indexOf('data-section="toys"'));
  assert.deepEqual([...teamNav.matchAll(/data-page="([^"]+)"/g)].map(match=>match[1]),['board','leaves','cardHistory','people']);
  assert.doesNotMatch(nav,/개인관리/);
  await h.api.act({dataset:{action:'peopleSection',section:'roles'}});
  await h.api.act({dataset:{action:'rankAdd'}});
  assert.match(h.element('#editor').innerHTML,/신규 직책 추가/);
  h.submit({id:'rankOrderForm',fields:{old:'',name:'리드'}});
  assert.equal(P.ranks(h.api.read().state).at(-1),'리드');
  await h.api.act({dataset:{action:'rankUp',rank:'리드'}});
  assert.equal(P.ranks(h.api.read().state).at(-2),'리드');
  await h.api.act({dataset:{action:'rankEdit',rank:'리드'}});
  h.submit({id:'rankOrderForm',fields:{old:'리드',name:'팀 리드'}});
  assert.equal(P.ranks(h.api.read().state).at(-2),'팀 리드');
  await h.api.act({dataset:{action:'rankDelete',rank:'팀 리드'}});
  assert.ok(!P.ranks(h.api.read().state).includes('팀 리드'));
 }
});
test('수정작업 저장은 부모 과업을 보존하고 수정 탭과 엑셀 분류 열에 반영한다',async()=>{const h=harness(),s=P.addSamples(fixture()),root=s.projects[0];h.api.seed(s);h.api.session('김무현');const before=JSON.stringify(h.api.read().state.projects[0]);await h.api.act({dataset:{action:'newRevision',id:root.id}});h.api.saveProject({title:'검증용 1차 수정',taskCategory:'UX',platform:'PC&MO',contentCategory:'',contentType:'',logContent:'',logDate:C.today()});const state=h.api.read().state,revision=state.projects.find(p=>p.parentProjectId===root.id);assert.ok(revision);assert.equal(JSON.stringify(state.projects[0]),before);await h.api.act({dataset:{action:'page',page:'revisions'}});assert.match(h.element('#app').innerHTML,/검증용 1차 수정/);await h.api.exportXlsx();const sheet=h.context.exportedSheets[0];assert.deepEqual(Array.from(sheet.headers.slice(0,3)),['분류 1','분류 2','분류 3']);assert.equal(sheet.headers.length,sheet.rows[0].length);});
test('브리핑은 기존 업무 패널과 작은 달력을 함께 표시한다',()=>{const h=harness();h.api.seed(fixture());h.api.session('김무현');h.api.render();const html=h.element('#app').innerHTML;assert.match(html,/compact-calendar/);assert.equal((html.match(/data-home-section=/g)||[]).length,4);assert.ok(!html.includes('data-home-section="work"'));assert.ok(!html.includes('data-home-section="memo"'));assert.ok(!html.includes('calendar-selected'));});

test('팀장 휴가 등록 목록에는 소속 팀원만 나온다',async()=>{const h=harness();h.api.seed(P.setLeaders(fixture(),{콘텐츠:'김다솔'}));h.api.session('김다솔');await h.api.act({dataset:{action:'newLeave'}});const select=h.element('#editor').innerHTML.match(/<select name="owner"[\s\S]*?<\/select>/)[0];assert.equal((select.match(/<option /g)||[]).length,3);assert.ok(select.includes('김아영'));assert.ok(!select.includes('김무현'));});
test('저장 폴더 없이 내용 저장을 눌러도 홈과 로그인 상태를 유지한다',async()=>{const h=harness();h.api.seed(fixture());h.api.session('김무현');h.api.render();const before=h.element('#app').innerHTML;h.api.markDirty();await h.api.act({dataset:{action:'save'}});assert.equal(h.element('#app').innerHTML,before);assert.match(h.element('#toast').textContent,/브라우저에 임시 저장/);h.api.render();assert.match(h.element('#app').innerHTML,/업무 달력/);assert.equal(h.api.read().dirty,true);});
test('공용 파일 저장 후에도 홈과 로그인 상태를 유지한다',async()=>{const h=harness(),s=fixture(),src=handle('[]'),out=handle(JSON.stringify(s),true);h.api.seed(s);h.api.session('김무현');h.api.connect(src,out,out.text);h.api.markDirty();await h.api.act({dataset:{action:'save'}});assert.equal(out.writes,1);assert.match(h.element('#app').innerHTML,/업무 달력/);assert.match(h.element('#app').innerHTML,/로그아웃/);assert.equal(h.api.read().dirty,false);});
test('휴가 등록의 이름 목록은 관리자에게 전체 재직자, 일반 팀원에게 본인만 표시한다',async()=>{for(const actor of ['김무현','성아미','정윤정']){const h=harness();h.api.seed(P.setTeamAdmins(fixture(),'김무현',['성아미']));h.api.session(actor);await h.api.act({dataset:{action:'newLeave'}});const html=h.element('#editor').innerHTML,select=html.match(/<select name="owner"[\s\S]*?<\/select>/)[0];assert.equal((select.match(/<option /g)||[]).length,actor==='정윤정'?1:10);}});
function handle(text,writable=false){const h={text,writes:0,queryPermission:async()=> 'granted',getFile:async()=>({text:async()=>h.text})};h.createWritable=async()=>{if(!writable)throw new Error('원본 쓰기 금지');return {write:async value=>{h.text=value;h.writes++;},close:async()=>{},abort:async()=>{}};};return h;}
test('시작 화면의 검은 로그인 버튼과 로그인 확인란 조건을 연결한다',async()=>{const h=harness();await h.api.login();assert.match(h.element('.setup-footer').innerHTML,/black-button/);await h.api.act({dataset:{action:'skipSetup'}});await Promise.resolve();assert.equal(h.api.read().setupDone,true);h.element('#loginName').value='김무현';await h.api.updateLogin();assert.equal(h.element('#confirmField').hidden,false);const s=fixture();s.accounts.김무현={salt:'a',hash:'b',iterations:150000};h.api.seed(s);await h.api.updateLogin();assert.equal(h.element('#confirmField').hidden,true);});
test('조직도 레벨과 항목을 추가·편집하고 기존 계정과 분리해 공용으로 저장한다',async()=>{
 const h=harness(),s=P.migrateRoles(fixture()),out=handle(JSON.stringify(s),true);
 h.api.seed(s);h.api.session('김무현','people');h.api.connect(handle('[]'),out,out.text);h.api.render();
 await h.api.act({dataset:{action:'orgLevel',index:'1'}});
 assert.match(h.element('#editor').innerHTML,/레벨 이름 편집/);
 h.submit({id:'organizationLevelForm',fields:{index:'1',name:'부서'}});
 await h.api.act({dataset:{action:'orgInsertLevel'}});
 h.submit({id:'organizationLevelForm',fields:{mode:'insert',index:'3',name:'파트',content:'기본 파트'}});
 await h.api.act({dataset:{action:'orgEdit',id:'worklog'}});
 h.submit({id:'organizationForm',fields:{id:'worklog',name:'우리 조직',parent:''}});
 await h.api.act({dataset:{action:'orgAdd',parent:'member:정윤정'}});
 assert.match(h.element('#editor').innerHTML,/value="member:정윤정" selected/);
 h.submit({id:'organizationForm',fields:{id:'',name:'서비스 운영',parent:'member:정윤정'}});
 const chart=h.api.read().state.organizationChart;
 const child=chart.nodes.find(node=>node.name==='서비스 운영');
 assert.equal(child.parent,'member:정윤정');
 assert.deepEqual(chart.levels,['조직','부서','멤버','파트']);
 h.submit({id:'organizationForm',fields:{id:'worklog',name:'순환 조직',parent:child.id}});
 assert.match(h.element('#organizationError').textContent,/상위 항목/);
 await h.api.act({dataset:{action:'orgEdit',id:child.id}});
 h.submit({id:'organizationForm',fields:{id:child.id,name:'서비스 운영',parent:'team:디자인'}});
 assert.equal(h.api.read().state.organizationChart.nodes.find(node=>node.id===child.id).parent,'team:디자인');
 await h.api.act({dataset:{action:'orgDelete',id:'member:정윤정'}});
 assert.doesNotMatch(h.element('#app').innerHTML,/정윤정/);
 assert.ok(h.api.read().state.members.some(person=>person.name==='정윤정'));
 await h.api.act({dataset:{action:'save'}});
 C.validateState(JSON.parse(out.text));
 assert.equal(JSON.parse(out.text).organizationChart.nodes.find(node=>node.id==='worklog').name,'우리 조직');
 h.api.session('정윤정');
 await assert.rejects(h.api.act({dataset:{action:'orgAdd'}}),/WorkLog 관리자/);
});
test('조직도에서 같은 직급의 순서를 바꾸면 멤버·담당자·조회 화면에 반영한다',async()=>{
 const h=harness(),original='김민재, 외부담당자 / 최완이';
 const source=[{id:'org-order',과업명:'정렬 확인',담당자_디자인:original,완료요청일:C.today(),진행상태:'접수'}];
 const s=C.importRows(P.migrateRoles(fixture()),source).state;
 const out=handle(JSON.stringify(s),true);
 h.api.seed(s);h.api.connect(handle(JSON.stringify(source)),out,out.text);h.api.session('김무현','people');h.api.render();
 const before=h.element('#app').innerHTML;
 assert.match(before,/data-action="orgMove"[^>]*data-id="member:최완이" data-step="-1"/);
 await h.api.act({dataset:{action:'orgMove',id:'member:최완이',step:'-1'}});
 assert.match(h.element('#app').innerHTML,/<strong>최완이<\/strong>[\s\S]*<strong>김민재<\/strong>/);
 await h.api.act({dataset:{action:'orgMove',id:'team:디자인',step:'-1'}});
 assert.deepEqual(P.orderedTeams(h.api.read().state),['기획','디자인','퍼블','콘텐츠']);
 await h.api.act({dataset:{action:'peopleSection',section:'members'}});
 assert.match(h.element('#app').innerHTML,/<td>최완이<\/td>[\s\S]*<td>김민재<\/td>/);
 await h.api.act({dataset:{action:'page',page:'work'}});
 assert.match(h.element('#app').innerHTML,/최완이, 외부담당자 \/ 김민재/);
 await h.api.act({dataset:{action:'editBoardTask',id:'source:org-order',taskId:'source-task:디자인'}});
 assert.match(h.element('#editor').innerHTML,/data-task-member="최완이"[\s\S]*data-task-member="김민재"/);
 await h.api.act({dataset:{action:'page',page:'report'}});
 assert.match(h.element('#app').innerHTML,/최완이, 외부담당자 \/ 김민재/);
 await h.api.act({dataset:{action:'save'}});
 const saved=C.validateState(JSON.parse(out.text));
 assert.deepEqual(P.orderNames(saved,['김민재','최완이']),['최완이','김민재']);
 assert.equal(saved.projects[0].raw.담당자_디자인,original);
 h.api.session('정윤정','people');
 await assert.rejects(h.api.act({dataset:{action:'orgMove',id:'member:최완이',step:'1'}}),/WorkLog 관리자/);
});
test('홈·관리자 설정·주간보고 전체 팀 개인 순서가 실제 렌더 함수에 연결된다',async()=>{const h=harness();h.api.seed(fixture());h.api.session('김무현');h.api.render();const html=h.element('#app').innerHTML;for(const text of ['업무 달력','진행 중','로그아웃','내용 저장'])assert.ok(html.includes(text),text);await h.api.act({dataset:{action:'page',page:'people'}});await h.api.act({dataset:{action:'peopleSection',section:'roles'}});assert.match(h.element('#app').innerHTML,/WorkLog 관리자/);await h.api.act({dataset:{action:'page',page:'report'}});const report=h.element('#app').innerHTML;assert.ok(report.indexOf('data-scope="all"')<report.indexOf('data-scope="team"'));assert.ok(report.indexOf('data-scope="team"')<report.indexOf('data-scope="personal"'));});
test('새로고침은 원본 전체를 읽고 통합관리 파일에만 저장한다',async()=>{const h=harness(),s=fixture(),src=handle(JSON.stringify([{id:'r1',과업명:'처음 요청',담당자_퍼블:'김무현'}])),out=handle(JSON.stringify(s),true);h.api.seed(s);h.api.session('김무현');h.api.connect(src,out,out.text);await h.api.refreshAll();assert.equal(h.api.read().state.projects.length,1);src.text=JSON.stringify([{id:'r1',과업명:'변경 요청',담당자_퍼블:'김무현'},{id:'r2',과업명:'새 요청'}]);await h.api.refreshAll();assert.equal(h.api.read().state.projects.length,2);assert.equal(C.effective(h.api.read().state.projects[0]).title,'변경 요청');await h.api.saveDisk();assert.equal(src.writes,0);assert.equal(out.writes,1);assert.ok(h.vault.connections.sourceHandle===src);assert.equal(JSON.parse(out.text).projects.length,2);});
test('다른 사람의 저장과 임시 변경이 충돌하면 새로고침과 저장 모두 중단한다',async()=>{const h=harness(),s=fixture(),src=handle('[]'),out=handle(JSON.stringify(s),true);h.api.seed(s);h.api.session('김무현');h.api.connect(src,out,out.text);h.api.markDirty();out.text=JSON.stringify({...s,revision:100});await assert.rejects(h.api.refreshAll(),/공용 파일과 현재 변경사항/);await assert.rejects(h.api.saveDisk(),/다른 사용자가/);assert.equal(out.writes,0);assert.equal(h.api.read().dirty,true);});
test('기억된 연결의 권한이 유지되면 폴더를 다시 선택하지 않고 복원한다',async()=>{const h=harness(),s=fixture(),src=handle('[]'),out=handle(JSON.stringify(s),true),dir={queryPermission:async()=> 'granted'};h.api.seed(s);h.vault.connections={sourceDir:dir,targetDir:dir,sourceHandle:src,targetHandle:out,lastDiskText:out.text};await h.api.restoreFolders();assert.equal(h.api.read().setupDone,true);assert.equal(h.api.read().health.source,true);assert.equal(out.writes,0);});

test('설정에서 화면 스타일·다크모드·폰트 문구를 제거하고 자료를 보존한다',async()=>{const h=harness();h.api.seed(fixture());h.api.session('김무현');const before=JSON.stringify(h.api.read().state);await h.api.act({dataset:{action:'preferences'}});const html=h.element('#editor').innerHTML;for(const text of ['화면 스타일','다크모드','Pretendard ·'])assert.ok(!html.includes(text));assert.deepEqual([...html.matchAll(/data-action="([^"]+)"/g)].map(match=>match[1]),['close','avatarSettings','forgetLogin','page']);assert.match(html,/내 캐릭터 선택/);assert.match(html,/저장된 로그인 정보 지우기/);assert.match(html,/데이터 연결/);assert.equal(JSON.stringify(h.api.read().state),before);});

test('비교 화면에서 선택한 스타일은 열린 업무 화면에도 반영되며 편집 중인 내용은 보존한다',async()=>{
 const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현');h.api.render();
 const current=h.api.read().state.projects[0];await h.api.act({dataset:{action:'edit',id:current.id}});
 const editor=h.element('#editor').innerHTML,before=JSON.stringify(h.api.read().state);
 h.context.localStorage.setItem('workplace-style','timeline');h.windowEvent('storage',{key:'workplace-style'});
 assert.equal(h.context.document.documentElement.dataset.style,'timeline');assert.match(h.element('#app').innerHTML,/compact-calendar/);
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

test('개인 메모 목록은 별도 페이지에만 유지한다',async()=>{
 const h=harness(),s=fixture();s.personal['김무현']=Array.from({length:6},(_,i)=>({id:'carousel-'+i,title:'메모 '+(i+1),date:'',time:'',content:'메모 내용',done:false}));
 h.api.seed(s);h.api.session('김무현');h.api.render();
 let html=h.element('#app').innerHTML;assert.ok(!html.includes('id="home-memos"'));
 await h.api.act({dataset:{action:'page',page:'memo'}});html=h.element('#app').innerHTML;assert.match(html,/id="personal-memos"/);assert.match(html,/data-memo-controls="personal-memos"/);
 await h.api.act({dataset:{action:'preferences'}});assert.ok(!h.element('#editor').innerHTML.includes('디자인 시안 10개 비교하기'));assert.doesNotMatch(h.element('#editor').innerHTML,/화면 스타일/);
});

test('빈 안내 캐릭터는 화면 종류가 아닌 로그인한 사용자의 선택을 따른다',async()=>{
 const h=harness(),s=fixture();s.members.find(m=>m.name==='김무현').avatar='bbiyak';h.api.seed(s);h.api.session('김무현');
 for(const page of ['memo','today','board']){
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

test('첫 화면은 홈이며 프로젝트 클릭은 과업별 도표로 연결된다',async()=>{
 const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현',null);h.api.render();
 assert.equal(h.context.document.documentElement.dataset.boardView,'false');
 await h.api.act({dataset:{action:'page',page:'work'}});
 assert.match(h.element('#app').innerHTML,/workflow-board/);
 await h.api.act({dataset:{action:'boardMode',mode:'status'}});
 assert.match(h.element('#app').innerHTML,/draggable="true"/);
 const p=h.api.read().state.projects.find(p=>p.tasks?.length);
 await h.api.act({dataset:{action:'boardDetail',id:p.id}});
 assert.equal(h.element('#editor').open,false);assert.match(h.element('#app').innerHTML,/project-spreadsheet/);
 h.api.session(p.tasks[0].assignees[0],'work');
 await h.api.act({dataset:{action:'toggleBoardTask',id:p.id,taskId:p.tasks[0].id}});
 assert.equal(h.element('#editor').open,false);
 await h.api.act({dataset:{action:'edit',id:p.id}});
 assert.match(h.element('#editor').innerHTML,/projectForm/);
});

test('모든 보드 보기에서 카드와 하위 업무 수정이 같은 편집기를 연다',async()=>{
 const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현','work');
 const p=h.api.read().state.projects.find(p=>p.tasks?.length);
 for(const mode of ['status','project']){
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
 await h.api.act({dataset:{action:'boardMode',mode:'project'}});assert.match(h.element('#app').innerHTML,/disabled title="담당자 본인만 진행률을 변경할 수 있습니다"/);
});

test('UIUX의 일정은 보기 토글 옆이고 신규 등록은 대시보드 안이며 다른 업무 탭과 분리된다',async()=>{
 const h=harness(),original={id:'toggle',과업명:'카드와 도표 공통 과업',담당자_퍼블:'김무현'};
 h.api.seed(C.importRows(fixture(),[original]).state);h.api.session('김무현','work');h.api.render();
 let html=h.element('#app').innerHTML;
 assert.match(html,/data-section="work"[^>]*aria-controls="nav-work"/);
 assert.match(html,/data-page="work" aria-label="UI·UX"/);assert.match(html,/data-page="workContent" aria-label="콘텐츠"/);
 assert.doesNotMatch(html,/requestNotice|data-page="requests"/);
 assert.match(html,/board-control-row ux-board-controls"><button[^>]+data-action="boardLayout"/);
 assert.match(html,/data-action="boardLayout"[^]*?data-action="uiuxSchedule"[^]*?주간 일정[^]*?월간 일정/);assert.doesNotMatch(html,/id="boardName"|id="boardFrom"|data-action="boardMine"/);assert.match(html,/data-action="new"[^]*?신규 등록/);
 assert.match(html,/카드와 도표 공통 과업/);
 await h.api.act({dataset:{action:'boardLayout'}});html=h.element('#app').innerHTML;
 assert.match(html,/class="board-table-view"/);assert.match(html,/<table\b/);assert.match(html,/카드와 도표 공통 과업/);
 await h.api.act({dataset:{action:'page',page:'workContent'}});html=h.element('#app').innerHTML;
 assert.match(html,/등록된 콘텐츠 업무가 없습니다/);assert.doesNotMatch(html,/workflow-board|board-control-row/);
 await h.api.act({dataset:{action:'page',page:'publishingDocs'}});html=h.element('#app').innerHTML;
 assert.match(html,/data-page="workContent"[^]*?data-page="publishingDocs"/);assert.match(html,/aria-current="page"[^>]*><span[^]*?퍼블리싱 문서/);
 assert.match(html,/pd-table pd-tasks/);assert.match(html,/>과업별<\/button>/);assert.match(html,/>전체목록<\/button>/);assert.doesNotMatch(html,/workflow-board|board-control-row/);
 await h.api.act({dataset:{action:'page',page:'errorImprovements'}});html=h.element('#app').innerHTML;
 assert.match(html,/data-page="publishingDocs"[^]*?data-page="errorImprovements"/);assert.match(html,/등록된 오류개선 내용이 없습니다/);assert.doesNotMatch(html,/workflow-board|board-control-row/);
});

test('기존 보드의 날짜 초기화는 담당자와 도표형 선택을 유지한다',async()=>{
 const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현','work');
 await h.api.act({dataset:{action:'boardMode',mode:'project'}});
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
test('메뉴 그룹과 주차는 각각 독립적으로 접고 펼친다',async()=>{
 const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현','work');h.api.render();
 await h.api.act({dataset:{action:'navSection',section:'schedule'}});await h.api.act({dataset:{action:'page',page:'memo'}});
 assert.match(h.element('#app').innerHTML,/id="nav-schedule" class="nav-children is-collapsed" inert/);
 await h.api.act({dataset:{action:'navSection',section:'schedule'}});assert.ok(!h.element('#app').innerHTML.includes('id="nav-schedule" class="nav-children is-collapsed" inert'));
 await h.api.act({dataset:{action:'page',page:'work'}});await h.api.act({dataset:{action:'boardMode',mode:'project'}});const key=h.element('#app').innerHTML.match(/data-action="toggleWeek"[^>]*data-key="([^"]+)"/)[1];
 await h.api.act({dataset:{action:'toggleWeek',key}});assert.match(h.element('#app').innerHTML,/class="board-week-cards" hidden/);
 await h.api.act({dataset:{action:'boardMode',mode:'status'}});await h.api.act({dataset:{action:'toggleLane',key:'done'}});assert.match(h.element('#app').innerHTML,/task-board-lane is-collapsed" data-lane="done"/);
});
test('카드 도표 전환은 텍스트 대신 두 아이콘과 접근성 이름을 제공한다',()=>{
 const h=harness();h.api.seed(fixture());h.api.session('김무현','work');h.api.render();const toggle=h.element('#app').innerHTML.match(/<button[^>]*data-action="boardLayout"[\s\S]*?<\/button>/)[0];
 assert.equal((toggle.match(/<svg /g)||[]).length,2);assert.match(toggle,/title="카드 보기"/);assert.match(toggle,/title="도표 보기"/);assert.match(toggle,/aria-label="도표형 보기"/);assert.ok(!toggle.includes('>카드</span>'));
});
test('업무조회 메뉴는 고객별 다음에 과업별을 표시하고 클릭한 프로젝트만 도표로 연다',async()=>{
 const h=harness();h.api.seed(C.importRows(fixture(),[{id:'first',과업명:'원본 첫 과업',담당자_퍼블:'김무현'},{id:'second',과업명:'원본 다음 과업',담당자_디자인:'홍소영'}]).state);h.api.session('김무현','work');h.api.render();let html=h.element('#app').innerHTML;
 const nav=html.match(/<nav[\s\S]*?<\/nav>/)[0];assert.ok(nav.indexOf('data-page="customers"')<nav.indexOf('data-page="projects"'));assert.ok(!nav.includes('고객별 업무'));
 const projects=h.api.read().state.projects;await h.api.act({dataset:{action:'boardDetail',id:projects[0].id}});html=h.element('#app').innerHTML;assert.match(html,/project-spreadsheet/);assert.ok(html.includes(projects[0].title));assert.ok(!html.includes(projects[1].title));assert.equal(h.element('#editor').open,false);
 await h.api.act({dataset:{action:'allProjects'}});assert.ok(h.element('#app').innerHTML.includes(projects[1].title));
 await h.api.act({dataset:{action:'editBoardTask',id:projects[0].id,taskId:projects[0].tasks[0].id}});assert.match(h.element('#editor').innerHTML,/projectForm/);
});
test('휴가 개인별 보기는 기존 조회 권한 안에서 이름으로 분리하고 인원 추가는 팀 이름 직급을 받는다',async()=>{
 const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현','leaves');h.api.render();await h.api.act({dataset:{action:'leaveView',view:'table'}});let html=h.element('#app').innerHTML;assert.match(html,/id="leaveSearchForm"/);assert.match(html,/leave-table/);
 h.submit({id:'leaveSearchForm',fields:{query:'김무현'}});const table=h.element('#app').innerHTML.match(/<table class="leave-table">[\s\S]*?<\/table>/)[0];assert.ok(!table.includes('정윤정'));
 await h.api.act({dataset:{action:'page',page:'people'}});await h.api.act({dataset:{action:'peopleSection',section:'members'}});html=h.element('#app').innerHTML;assert.match(html,/입사·퇴사 인원 관리/);assert.match(html,/<th scope="col">직급<\/th>/);
 await h.api.act({dataset:{action:'addMember'}});for(const field of ['memberTeam','memberName','memberRank'])assert.ok(h.element('#editor').innerHTML.includes('id="'+field+'"'));
});
test('관리자는 기존 인원 직급만 변경하고 일반 사용자의 직접 저장은 차단한다',async()=>{
 const h=harness(),s=P.addSamples(fixture());h.api.seed(s);h.api.session('김무현','people');h.api.render();await h.api.act({dataset:{action:'peopleSection',section:'members'}});assert.match(h.element('#app').innerHTML,/data-action="editMemberRank"/);
 const before=h.api.read().state,projects=JSON.stringify(before.projects),person=before.members.find(m=>m.name==='정윤정'),team=person.team;
 await h.api.act({dataset:{action:'editMemberRank',name:'정윤정'}});assert.match(h.element('#editor').innerHTML,/memberRankForm/);
 h.submit({id:'memberRankForm',fields:{name:'정윤정',rank:'차장'}});assert.equal(h.api.read().state.members.find(m=>m.name==='정윤정').rank,'차장');assert.equal(person.team,team);assert.equal(JSON.stringify(h.api.read().state.projects),projects);
 h.api.session('정윤정');await assert.rejects(h.api.act({dataset:{action:'editMemberRank',name:'김무현'}}),/관리자/);
 h.submit({id:'memberRankForm',fields:{name:'정윤정',rank:'이사'}});assert.equal(h.api.read().state.members.find(m=>m.name==='정윤정').rank,'차장');
});
test('접속 프로필은 단일 상단바의 날짜 바로 왼쪽에 위치한다',()=>{
 const h=harness();h.api.seed(fixture());h.api.session('김무현');h.api.render();const header=h.element('#app').innerHTML.match(/<header class="topbar">[\s\S]*?<\/header>/)[0];assert.match(header,/id="onlineProfiles"/);assert.ok(header.indexOf('id="onlineProfiles"')<header.indexOf('topbar-date'));assert.equal((h.element('#app').innerHTML.match(/class="topbar"/g)||[]).length,1);
});
test('브리핑 기본형·대두형과 다섯 번 클릭 커스텀 창이 동작하고 취소 시 보존된다',async()=>{
 const h=harness();h.api.seed(P.addSamples(fixture()));h.api.session('김무현','dashboard');h.api.render();assert.match(h.element('#app').innerHTML,/briefing-hero hero-normal/);
 await h.api.act({dataset:{action:'heroMode',mode:'big'}});assert.match(h.element('#app').innerHTML,/briefing-hero hero-big/);
 for(let i=0;i<4;i++)await h.api.act({dataset:{action:'heroSecret'}});assert.equal(h.element('#editor').open,false);
 await h.api.act({dataset:{action:'heroSecret'}});assert.equal(h.element('#editor').open,true);assert.match(h.element('#editor').innerHTML,/heroDesignForm/);assert.match(h.element('#editor').innerHTML,/type="color"/);
 await h.api.act({dataset:{action:'heroPalette',palette:'pink'}});assert.match(h.element('#editor').innerHTML,/--hero-bgEnd:#fcb2d1/);
 await h.api.act({dataset:{action:'close'}});h.api.render();assert.ok(!h.element('#app').innerHTML.includes('--hero-bgEnd:#fcb2d1'));
 for(let i=0;i<5;i++)await h.api.act({dataset:{action:'heroSecret'}});await h.api.act({dataset:{action:'heroPalette',palette:'pink'}});h.submit({id:'heroDesignForm'});assert.match(h.element('#app').innerHTML,/--hero-bgEnd:#fcb2d1/);assert.equal(h.element('#editor').open,false);
});
test('브리핑에서 메모 목록과 배치 도구는 숨기고 달력의 개인 일정은 유지한다',async()=>{
 const h=harness(),s=P.savePersonal(fixture(),'김무현',{title:'달력에 남을 개인 일정',date:C.today()});h.api.seed(s);h.api.session('김무현','dashboard');h.api.render();const html=h.element('#app').innerHTML;assert.ok(!html.includes('data-home-section="memo"'));assert.ok(!html.includes('data-action="homeLayout"'));assert.ok(!html.includes('나의 일정 한눈에 보기'));assert.match(html,/달력에 남을 개인 일정/);
 await h.api.act({dataset:{action:'page',page:'memo'}});assert.match(h.element('#app').innerHTML,/달력에 남을 개인 일정/);
});

test('브리핑은 달력과 일정·전체 휴가 다음에 진행과 팀브리핑을 제공한다',async()=>{const h=harness();h.api.seed(require('./preview-data.js').create(C,P));h.api.session('김무현');h.api.render();const html=h.element('#app').innerHTML;const markers=['briefing-hero-frame','briefing-calendar','data-home-section="schedule"','data-home-section="leaves"','data-home-section="progress"','data-home-section="team"'];let previous=-1;for(const marker of markers){const at=html.indexOf(marker);assert.ok(at>previous,marker);previous=at;}assert.ok(!html.includes('이번 주 나의 일정'));assert.ok(!html.includes('나의 프로젝트 마감'));await h.api.act({dataset:{action:'avatarSettings'}});assert.match(h.element('#editor').innerHTML,/data-action="addAvatar"/);await h.api.act({dataset:{action:'addAvatar'}});assert.match(h.element('#editor').innerHTML,/id="addAvatarForm"/);});

test('다른 사람의 담당 업무와 전체 과업도 재직 사용자가 삭제할 수 있다',async()=>{const h=harness(),s=P.upgrade(C.sampleState());const project=s.projects[0];project.tasks=[{id:'other-a',role:'디자인',assignees:['김민재'],status:'진행중',progress:40,due:''},{id:'other-b',role:'퍼블',assignees:['김무현'],status:'접수',progress:0,due:''}];project.assignees=['김민재','김무현'];h.api.seed(s);h.api.session('김다솔');await h.api.act({dataset:{action:'edit',id:project.id}});assert.match(h.element('#editor').innerHTML,/data-action="deleteProject"/);assert.match(h.element('#editor').innerHTML,/data-action="removeTask"/);await h.api.act({dataset:{action:'removeTask',index:'0'}});h.api.saveProject({title:project.title,description:project.description,logContent:'',logDate:C.today()});assert.equal(C.effective(h.api.read().state.projects.find(p=>p.id===project.id)).tasks.length,1);await h.api.act({dataset:{action:'deleteProject',id:project.id}});assert.ok(!h.api.read().state.projects.some(p=>p.id===project.id));assert.ok(h.api.read().state.hiddenProjects.includes(project.id));});
test('홈 메뉴가 먼저이고 업무관리는 4열이며 주간 일정은 전용 2열이다',async()=>{const h=harness();h.api.seed(fixture());h.api.session('김무현','work');h.api.render();let html=h.element('#app').innerHTML;const nav=html.match(/<nav[\s\S]*?<\/nav>/)[0];assert.ok(nav.indexOf('data-page="dashboard"')<nav.indexOf('data-page="work"'));for(const title of ['홈','업무관리','일정관리','조회·보고','조직관리'])assert.ok(nav.includes(title));assert.match(html,/class="workflow-board(?: ux-board)?"/);assert.doesNotMatch(html,/data-action="boardMode"/);await h.api.act({dataset:{action:'page',page:'schedule'}});assert.match(h.element('#app').innerHTML,/weekly-schedule-panels/);});

test('the normal work page opens the customer workflow and its read-only detail popup',async()=>{
 const h=harness(),source={id:'workflow-source',프로젝트명:'고객 원문 과업',고객명:'요청 고객',완료요청일:'2026.11.20',진행상태:'진행 중',담당자_퍼블:'김무현',작업내용_퍼블:'고객이 작성한 원문'};
 h.api.seed(C.importRows(fixture(),[source]).state);
 h.api.session('김무현','work');
 h.api.render();
 const html=h.element('#app').innerHTML;
 assert.match(html,/class="workflow-board(?: ux-board)?"/);
 assert.doesNotMatch(html,/data-action="boardMode"/);
 assert.match(html,/고객 원문 과업/);
 assert.match(html,/완료요청: <time[^>]*>2026\.11\.20/);
 await h.api.act({dataset:{action:'workflowDetail',id:'source:workflow-source',role:'퍼블'}});
 assert.equal(h.element('#editor').open,true);
 assert.match(h.element('#editor').innerHTML,/고객이 작성한 원문/);
});

test('주간 업무는 고객 원본을 주차별 표로 표시하고 상세에서 변경 이력을 연다',async()=>{
 const h=harness();const raw={id:'weekly-history',과업명:'원본 과업',완료요청일:'2026-11-19',담당자_퍼블:'김무현',진행상태:'접수'};
 const baseline=C.importRows(fixture(),[raw],'2026-11-16').state;
 const state=C.importRows(baseline,[{...raw,진행상태:'진행중'}],'2026-11-17').state;
 state.projects[0].overrides={title:'내부 변경 제목'};state.projects[0].logs=[{id:'local-note',date:'2026-11-17',author:'김무현',content:'내부 전용 기록'}];
 h.api.seed(state);h.api.session('김무현');await h.api.act({dataset:{action:'page',page:'report'}});
 const html=h.element('#app').innerHTML;
 assert.match(html,/11월 4주차/);assert.match(html,/<table>/);assert.match(html,/원본 과업/);assert.doesNotMatch(html,/이전: 접수|내부 변경 제목|내부 전용 기록/);
 await h.api.act({dataset:{action:'workflowDetail',id:'source:weekly-history'}});
 const detail=h.element('#editor').innerHTML;
 assert.match(detail,/고객 원본 변경 이력/);assert.match(detail,/이전: 접수/);assert.match(detail,/변경: 진행중/);assert.doesNotMatch(detail,/내부 전용 기록/);
 await h.api.exportXlsx();assert.ok(h.context.exportedSheets[1].rows.some(row=>row.some(cell=>String(cell).includes('이전: 접수'))));
});

test('같은 원본 ID로 UIUX, 주간 업무, 고객별, 과업별을 오간다',async()=>{
 const h=harness();h.api.seed(C.importRows(fixture(),[{id:'shared',과업명:'연결 대상',요청팀:'고객 A',담당자_퍼블:'김무현'},{id:'neighbor',과업명:'다른 과업',요청팀:'고객 A'}]).state);h.api.session('김무현','work');
 await h.api.act({dataset:{action:'workflowDetail',id:'source:shared'}});assert.match(h.element('#editor').innerHTML,/data-id="source:shared"/);assert.doesNotMatch(h.element('#editor').innerHTML,/data-action="relatedProject"/);
 for(const page of ['report','customers','projects','work']){
  await h.api.act({dataset:{action:'relatedProject',page,id:'source:shared'}});
  const html=h.element('#app').innerHTML;
  assert.match(html,/linked-project-bar/);assert.match(html,/연결 대상/);assert.doesNotMatch(html,/다른 과업/);
 }
 await h.api.act({dataset:{action:'clearLinkedProject'}});assert.match(h.element('#app').innerHTML,/다른 과업/);
});

test('게시판 공통 공지에는 작성자 아바타가 표시되고 공지 설정으로 상단 고정한다',async()=>{
 const h=harness(),s=fixture(),B=h.context.BoardTeamPosts;s.members.find(m=>m.name==='김무현').avatar='bbiyak';
 const saved=B.save(s,'김무현',{team:'퍼블',type:'일반글',title:'검토 글',content:'상세 내용'});
 saved.teamPosts[0].createdAt='2026-11-15T16:00:00Z';saved.teamPosts[0].updatedAt='2026-11-17T08:00:00Z';
 h.api.seed(saved);h.api.session('김무현','board');h.api.render();
 const html=h.element('#app').innerHTML,tabs=[...html.matchAll(/data-action="boardTeam"[^>]*>([^<]+)<\/button>/g)].map(match=>match[1]);
 assert.deepEqual(tabs,['전체','공통','기획','퍼블','디자인','콘텐츠']);assert.match(html,/post-byline"><img[^>]+><strong>김무현/);
 assert.match(html,/<th scope="col">순번<\/th><th scope="col">구분<\/th><th scope="col"><span class="sr-only">공지<\/span><\/th><th scope="col">제목<\/th><th scope="col">작성자<\/th><th scope="col">작성일자<\/th>/);
 assert.match(html,/datetime="2026-11-16"/);assert.match(html,/<td class="bulletin-notice"><\/td>/);assert.doesNotMatch(html.split('</table>')[0],/상세 내용/);
 const post=h.api.read().state.teamPosts[0];
 h.api.session('정윤정','board');await assert.rejects(h.api.act({dataset:{action:'postDetail',id:post.id}}),/권한/);
 h.api.session('김무현','board');await h.api.act({dataset:{action:'postDetail',id:post.id}});assert.match(h.element('#app').innerHTML,/id="bulletinDetail"[\s\S]*상세 내용/);assert.equal(h.element('#editor').open,false);assert.match(h.element('#app').innerHTML,/댓글 등록/);assert.doesNotMatch(h.element('#app').innerHTML,/공지 설정/);
 h.submit({id:'postCommentForm',fields:{id:post.id,content:'확인했습니다.'}});assert.match(h.element('#app').innerHTML,/확인했습니다\./);
 const comment=h.api.read().state.teamPosts[0].comments[0];
 assert.match(h.element('#app').innerHTML,/김무현<span class="bulletin-author-team"> · 퍼블리싱/);
 assert.match(h.element('#app').innerHTML,/\d{4}-\d{2}-\d{2} \d{2}:\d{2}<\/time>/);
 h.submit({id:'postReplyForm-'+comment.id,fields:{id:post.id,parentId:comment.id,content:'답글도 확인했습니다.'}});
 const reply=h.api.read().state.teamPosts[0].comments[1];
 assert.match(h.element('#app').innerHTML,/class="bulletin-reply"[\s\S]*답글도 확인했습니다\./);
 h.submit({id:'postReplyForm-'+reply.id,fields:{id:post.id,parentId:reply.id,content:'답글에 다시 답글'}});
 const nextReply=h.api.read().state.teamPosts[0].comments[2];
 h.submit({id:'postReplyForm-'+nextReply.id,fields:{id:post.id,parentId:nextReply.id,content:'한 단계 더 답글'}});
 assert.match(h.element('#app').innerHTML,/김무현<span class="sr-only">에게 답글<\/span><\/span>한 단계 더 답글/);
 await h.api.act({dataset:{action:'editPost',id:post.id}});assert.match(h.element('#editor').innerHTML,/공지 설정/);
 h.submit({id:'postForm',fields:{id:post.id,team:post.team,title:post.title,content:post.content,type:'전체공지',pinned:'on'}});
 assert.equal(h.api.read().state.teamPosts[0].comments[0].content,'확인했습니다.');
 assert.equal(C.validateState(JSON.parse(JSON.stringify(h.api.read().state))).teamPosts[0].comments[1].parentId,comment.id);
 assert.equal(C.validateState(JSON.parse(JSON.stringify(h.api.read().state))).teamPosts[0].comments[3].parentId,nextReply.id);
 await h.api.act({dataset:{action:'boardTeam',team:'common'}});assert.match(h.element('#app').innerHTML,/<td>공통<\/td>/);assert.match(h.element('#app').innerHTML,/bulletin-notice[^>]*><span[^>]*>📢/);assert.doesNotMatch(h.element('#app').innerHTML,/>고정</);assert.equal(h.api.read().state.teamPosts[0].pinned,true);assert.match(h.element('#app').innerHTML,/검토 글/);
 assert.throws(()=>B.save(h.api.read().state,'정윤정',{...post,type:'일반글',pinned:false}),/권한/);
 assert.throws(()=>B.addComment({...s,teamPosts:[post]},'정윤정',{id:post.id,content:'권한 확인'}),/권한/);
});

test('일반 주소에서 원본 연결 전에는 UI·UX 샘플을 보여주고 실제 과업 저장에는 포함하지 않는다',async()=>{
 const h=harness();h.context.BoardPreviewData=require('./preview-data.js');h.api.seed(fixture());h.api.session('김무현');
 await h.api.act({dataset:{action:'page',page:'work'}});
 assert.equal((h.element('#app').innerHTML.match(/class="workflow-dashboard-row"/g)||[]).length,10);
 const id='source:uiux-history';await h.api.act({dataset:{action:'workflowDetail',id}});
 assert.match(h.element('#editor').innerHTML,/신청서 접근성 점검/);assert.doesNotMatch(h.element('#editor').innerHTML,/data-action="edit"/);
 for(const page of ['report','customers','projects']){
  await h.api.act({dataset:{action:'relatedProject',page,id}});
  assert.match(h.element('#app').innerHTML,/신청서 접근성 점검/);
 }
 assert.equal(h.api.read().state.projects.length,0);
 const src=handle('[]');h.api.connect(src,null,null);await h.api.act({dataset:{action:'page',page:'work'}});
 assert.doesNotMatch(h.element('#app').innerHTML,/신청서 접근성 점검/);
});

test('통계는 과업별 다음에 있고 같은 원본 과업을 집계한다',async()=>{
 const h=harness();const s=C.importRows(fixture(),[{id:'s1',과업명:'완료 과업',요청팀:'고객 A',진행상태:'완료',완료요청일:'2020-01-01',담당자_퍼블:'김무현'},{id:'s2',과업명:'지연 과업',요청팀:'고객 A',진행상태:'접수',완료요청일:'2020-01-01'}]).state;
 h.api.seed(s);h.api.session('김무현');await h.api.act({dataset:{action:'page',page:'stats'}});
 const html=h.element('#app').innerHTML;
 assert.ok(html.indexOf('data-page="projects"')<html.indexOf('data-page="stats"'));
 assert.match(html,/<span>전체 과업<\/span><strong>2<\/strong>/);assert.match(html,/<span>마감일 경과<\/span><strong>1<\/strong>/);assert.match(html,/<span>고객 A<\/span><strong>2건<\/strong>/);
 h.submit({id:'statsQueryForm',fields:{role:'퍼블',group:'고객별'}});
 assert.match(h.element('#app').innerHTML,/<span>전체 과업<\/span><strong>1<\/strong>/);
 assert.equal((h.element('#app').innerHTML.match(/class="card stats-breakdown"/g)||[]).length,1);
});

test('일반 주소의 게시판도 샘플 글은 작성자별 캐릭터로 표시한다',async()=>{
 const h=harness(),preview=require('./preview-data.js'),s=preview.ensure(fixture(),C,P);h.context.BoardPreviewData=preview;
 assert.ok(s.members.filter(m=>['임정규','김무현'].includes(m.name)).every(m=>!m.avatar));
 h.api.seed(s);h.api.session('김무현');await h.api.act({dataset:{action:'page',page:'board'}});
 const html=h.element('#app').innerHTML;
 assert.match(html,/post-byline"><img src="[^\"]*펭귄\.png"[^>]*><strong>김무현/);
 assert.match(html,/post-byline"><img src="[^\"]*소년 손오공\.png"[^>]*><strong>임정규/);
});


test('주간 일정은 월요일 시작으로 구분하고 이전 주와 이번 주로 이동한다',async()=>{
 const h=harness();h.api.seed(fixture());h.api.session('김무현');await h.api.act({dataset:{action:'page',page:'schedule'}});
 const current=P.weekRanges()[0].start,html=h.element('#app').innerHTML;
 assert.match(html,new RegExp('data-week-start="'+current+'"'));assert.match(html,/월 [1-6]주차/);
 await h.api.act({dataset:{action:'scheduleWeek',step:'previous'}});
 const previous=[...h.element('#app').innerHTML.matchAll(/data-week-start="([^"]+)"/g)].map(match=>match[1]);
 assert.ok(previous[0]<current);assert.equal(previous[1],current);
 await h.api.act({dataset:{action:'scheduleWeek',step:'current'}});
 assert.equal(h.element('#app').innerHTML.match(/data-week-start="([^"]+)"/)[1],current);
});

test('법인카드에서 카드별 월 금액·작성자·합계 제외를 반영한다',async()=>{
 const h=harness(),E=h.context.BoardCardExpenses;h.api.seed(fixture());h.api.session('김무현');
 await h.api.act({dataset:{action:'page',page:'cardHistory'}});
 assert.match(h.element('#app').innerHTML,/법인카드 사용내역/);assert.doesNotMatch(h.element('#app').innerHTML,/기타 디자인/);
 assert.match(h.element('#app').innerHTML,/data-action="expenseAddEntry"[^>]*disabled/);
 await assert.rejects(h.api.act({dataset:{action:'expenseAddEntry'}}),/카드 종류가 등록되면/);
 await h.api.act({dataset:{action:'expenseAddCard'}});
 assert.match(h.element('#editor').innerHTML,/expenseCardForm/);
 const month=E.today().slice(0,7);
 h.submit({id:'expenseCardForm',fields:{id:'',name:'운영 카드',month,limit:'300000',extra:'50000'}});
 const card=h.api.read().state.cardExpenses.cards[0];
 assert.equal(h.element('#editor').open,false);
 await h.api.act({dataset:{action:'expenseAddEntry',id:card.id}});
 assert.match(h.element('#editor').innerHTML,/작성자<input readonly value="김무현"/);
 const entry={id:'',cardId:card.id,date:month+'-01',purpose:'회의비',amount:'25000',author:'임의 작성자'};
 h.submit({id:'expenseEntryForm',fields:entry});
 h.submit({id:'expenseEntryForm',fields:{...entry,purpose:'제외 테스트',amount:'15000',excluded:'on'}});
 const saved=C.validateState(h.api.read().state).cardExpenses;
 assert.ok(saved.entries.every(item=>item.author==='김무현'));
 assert.equal(E.monthly(saved,card.id,month).used,25000);assert.equal(E.monthly(saved,card.id,month).balance,325000);
 assert.match(h.element('#app').innerHTML,/합계 제외 금액 15,000원/);
 const next=new Date(month+'-01T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);const following=next.toISOString().slice(0,7);
 assert.equal(E.monthly(saved,card.id,following).balance,300000);
 const service=E.create({uid:C.uid,isAdmin:P.isOverallAdmin});
 assert.throws(()=>service.saveCard(h.api.read().state,'정윤정',{id:card.id,name:card.name,month,limit:'0',extra:'0'}),/전체관리자/);
 assert.throws(()=>service.saveEntry(h.api.read().state,'정윤정',{...entry,id:saved.entries[0].id}),/수정할 수 없습니다/);
});

test('기본 금액을 바꾸면 이후 설정을 덮고 월별 추가금액만 해당 달에 남긴다',()=>{
 const E=require('../source/js/card-expenses.js'),service=E.create({uid:C.uid,isAdmin:P.isOverallAdmin});
 let result=service.saveCard(fixture(),'김무현',{name:'공용 카드',month:'2026-10',limit:'500000',extra:'10000'});
 const id=result.id,base={id,name:'공용 카드'};
 result=service.saveCard(result.state,'김무현',{...base,month:'2027-01',limit:'800000',extra:'20000'});
 result=service.saveCard(result.state,'김무현',{...base,month:'2026-12',limit:'600000',extra:'30000'});
 const data=result.state.cardExpenses;
 assert.equal(E.monthly(data,id,'2026-10').balance,510000);
 assert.equal(E.monthly(data,id,'2026-11').balance,500000);
 assert.equal(E.monthly(data,id,'2026-12').balance,630000);
 assert.equal(E.monthly(data,id,'2027-01').balance,620000);
 assert.equal(E.monthly(data,id,'2027-02').balance,600000);
});
test('조직도 중간에 레벨을 삽입하면 기존 팀과 멤버가 함께 내려간다',async()=>{
 const h=harness(),O=require('../source/js/organization-chart.js');
 h.api.seed(P.migrateRoles(fixture()));h.api.session('김무현','people');h.api.render();
 const initial=P.orderedMembers(h.api.read().state).map(member=>member.name);
 await h.api.act({dataset:{action:'orgInsertLevel'}});
 assert.match(h.element('#editor').innerHTML,/추가 위치/);
 h.submit({id:'organizationLevelForm',fields:{mode:'insert',index:'1',name:'사업부',content:'UI·UX 사업부'}});
 const state=h.api.read().state,chart=state.organizationChart;
 C.validateState(state);
 assert.deepEqual(chart.levels,['조직','사업부','팀','멤버']);
 assert.equal(O.depth(chart,'team:기획'),2);
 assert.equal(O.depth(chart,'member:김무현'),3);
 const parent=chart.nodes.find(node=>node.id===chart.nodes.find(node=>node.id==='team:기획').parent);
 assert.equal(parent.name,'UI·UX 사업부');
 assert.deepEqual(P.orderedMembers(state).map(member=>member.name),initial);
});
test('카드 선택과 월 추가금액 설정은 기본금액 및 다른 달의 금액을 보존한다',async()=>{
 const h=harness(),E=require('../source/js/card-expenses.js');
 h.api.seed(P.migrateRoles(fixture()));h.api.session('김무현','cardHistory');
 const month=E.today().slice(0,7);
 h.submit({id:'expenseCardForm',fields:{name:'첫 카드',month,limit:'300000',extra:'0'}});
 h.submit({id:'expenseCardForm',fields:{name:'둘째 카드',month,limit:'500000',extra:'10000'}});
 const cards=h.api.read().state.cardExpenses.cards;
 await h.change({id:'expenseCard',value:cards[0].id});
 assert.match(h.element('#app').innerHTML,/id="expenseCard"[^]*?id="expenseYear"[^]*?id="expenseMonth"[^]*?data-action="expenseExtra"/);
 assert.doesNotMatch(h.element('#app').innerHTML,/expenseEditBudget|data-action="expenseSelectCard"/);
 await h.api.act({dataset:{action:'expenseExtra',id:cards[0].id}});
 h.submit({id:'expenseExtraForm',fields:{cardId:cards[0].id,month,extra:'20000'}});
 const data=C.validateState(h.api.read().state).cardExpenses;
 assert.equal(E.monthly(data,cards[0].id,month).balance,320000);
 assert.equal(E.monthly(data,cards[1].id,month).balance,510000);
 assert.deepEqual(data.cards[0].limits,[{month,amount:300000}]);
 const service=E.create({uid:C.uid,isAdmin:P.isOverallAdmin});
 assert.throws(()=>service.saveExtra(h.api.read().state,'정윤정',{cardId:cards[0].id,month,extra:'1000'}),/관리자/);
});
test('관리자 휴가 카드 편집과 삭제는 기존 휴가의 이름과 차감량을 보존한다',async()=>{
 const h=harness(),Types=require('../source/js/leave-types.js'),month=C.today().slice(0,7);
 h.api.seed(P.migrateRoles(fixture()));h.api.session('김무현','leaves');h.api.render();
 assert.deepEqual(Types.active(h.api.read().state).map(type=>type.name),['연차','오전반차','오후반차','특별휴가']);
 assert.match(h.element('#app').innerHTML,/leave-type-scroll[^]*?data-action="leaveTypeAdd"/);
 assert.doesNotMatch(h.element('#app').innerHTML,/data-action="leaveTypeEdit"/);
 await h.api.act({dataset:{action:'leaveTypeAdd'}});
 h.submit({id:'leaveTypeForm',fields:{name:'리프레시',icon:'🌿',description:'충전 시간',units:'0.5'}});
 const type=Types.active(h.api.read().state).find(item=>item.name==='리프레시');
 const date=C.today();
 await h.api.act({dataset:{action:'leaveTypeRequest',id:type.id}});
 assert.match(h.element('#editor').innerHTML,/<option value="리프레시" selected/);
 h.submit({id:'leaveForm',fields:{owner:'김무현',type:'리프레시',start:date,end:date,note:''}});
 const before=structuredClone(h.api.read().state.leaves[0]);
 await h.api.act({dataset:{action:'leavePolicy'}});
 assert.match(h.element('#editor').innerHTML,/data-action="leaveTypeManage"/);
 await h.api.act({dataset:{action:'leaveTypeManage'}});
 assert.match(h.element('#editor').innerHTML,/휴가 유형 관리/);
 await h.api.act({dataset:{action:'leaveTypeEdit',id:type.id}});
 h.submit({id:'leaveTypeForm',fields:{id:type.id,name:'리프레시 휴가',icon:'🌿',description:'이름 변경',units:'1'}});
 await h.api.act({dataset:{action:'leaveTypeDelete',id:type.id}});
 const saved=C.validateState(h.api.read().state);
 assert.deepEqual(saved.leaves[0],before);
 assert.ok(!Types.active(saved).some(item=>item.id===type.id));
 await h.api.act({dataset:{action:'leaveView',view:'table'}});
 assert.match(h.element('#app').innerHTML,/리프레시/);
 h.api.session('정윤정','leaves');h.api.render();
 assert.doesNotMatch(h.element('#app').innerHTML,/data-action="leaveType(?:Add|Edit|Delete)"/);
 await assert.rejects(h.api.act({dataset:{action:'leaveTypeAdd'}}),/관리자/);
});
test('오전·오후 반차는 같은 날 등록하며 근속연수 정책은 개별 설정을 우선한다',async()=>{
 const h=harness(),W=require('../source/js/workspace.js');
 const date='2026-11-02';
 let s=P.migrateRoles(fixture());
 s=P.saveLeave(s,'김무현',{owner:'김무현',type:'오전반차',start:date,end:date});
 s=P.saveLeave(s,'김무현',{owner:'김무현',type:'오후반차',start:date,end:date});
 assert.equal(W.leaveLedger(s,'김무현','2026','2026-11-03').used,1);
 h.api.seed(s);h.api.session('김무현','leaves');
 await h.api.act({dataset:{action:'leavePolicy'}});
 h.submit({id:'leavePolicyForm',fields:{enabled:'on',count:'1',members:'1',
   from0:'1',to0:'2',days0:'15',capFrom:'21',capDays:'25',hireName0:'김무현',hire0:'2024-01-01'}});
 assert.equal(W.leaveLedger(h.api.read().state,'김무현','2026').allowance,15);
 const personal=W.setAllowance(h.api.read().state,'김무현','김무현','2026',20);
 assert.equal(W.leaveLedger(personal,'김무현','2026').allowance,20);
 C.validateState(personal);
 h.api.session('정윤정','leaves');
 const before=JSON.stringify(h.api.read().state);
 await assert.rejects(h.api.act({dataset:{action:'leavePolicy'}}),/관리자/);
 h.submit({id:'leavePolicyForm',fields:{enabled:'on',count:'1',members:'0',year0:'0',days0:'100'}});
 assert.equal(JSON.stringify(h.api.read().state),before);
});
test('주간 휴가 현황에서 날짜를 선택하고 내년 연차 선사용을 등록한다',async()=>{
 const h=harness(),today=C.today(),nextYear=Number(today.slice(0,4))+1;
 h.api.seed(P.migrateRoles(fixture()));h.api.session('김무현','leaves');h.api.render();
 assert.match(h.element('#app').innerHTML,/leave-week-overview/);
 await h.api.act({dataset:{action:'leaveBorrow'}});
 assert.match(h.element('#editor').innerHTML,/name="borrowNextYear" type="checkbox" checked/);
 h.submit({id:'leaveForm',fields:{owner:'김무현',type:'연차',start:today,end:today,borrowNextYear:'on',note:'미리 사용'}});
 assert.equal(h.api.read().state.leaves[0].borrowNextYear,true);
 assert.match(h.element('#app').innerHTML,new RegExp(nextYear+'년 연차 선사용'));
 await h.api.act({dataset:{action:'leaveDay',date:today}});
 assert.match(h.element('#app').innerHTML,/leave-week-day selected/);
 await h.api.act({dataset:{action:'leaveWeek',step:'1'}});
 assert.doesNotMatch(h.element('#app').innerHTML,/leave-week-day selected/);
 await h.api.act({dataset:{action:'leaveWeek',step:'today'}});
 assert.match(h.element('#app').innerHTML,/미리 사용|년 연차 선사용/);
});
test('휴가 월별 요약은 같은 날 사람 수를 묶고 상세에서 모두 표시한다',async()=>{
 const h=harness(),today=C.today();
 let s=P.migrateRoles(fixture());
 for(const owner of ['김무현','홍소영'])s=P.saveLeave(s,'김무현',{owner,type:'연차',start:today,end:today,note:owner+' 비고'});
 h.api.seed(s);h.api.session('김무현','leaves');h.api.render();
 const weekly=h.element('#app').innerHTML;
 assert.match(weekly,/data-view="table"[^]*?주차별[^]*?data-view="calendar"[^]*?월별/);
 assert.doesNotMatch(weekly,/id="leavePerson"|id="leaveTypeFilter"|id="leaveSort"/);
 assert.match(weekly,/<th scope="col">날짜<\/th><th scope="col">팀<\/th><th scope="col">이름<\/th><th scope="col">직급<\/th><th scope="col">연차구분<\/th><th scope="col">비고<\/th><th scope="col">편집<\/th>/);
 await h.api.act({dataset:{action:'leaveView',view:'calendar'}});
 const html=h.element('#app').innerHTML;
 const summaries=[...html.matchAll(/data-action="leaveMonthDay"[^>]*data-date="([^"]+)"[^>]*>([^<]+)<\/button>/g)];
 assert.equal(summaries.filter(match=>match[1]===today).length,1);
 assert.match(summaries.find(match=>match[1]===today)[2],/외 1명/);
 await h.api.act({dataset:{action:'leaveMonthDay',date:today}});
 assert.match(h.element('#editor').innerHTML,/김무현 비고/);
 assert.match(h.element('#editor').innerHTML,/홍소영 비고/);
});
test('관리자가 휴가 유형 순서를 바꾸면 카드와 등록창도 같은 순서로 표시한다',async()=>{
 const h=harness(),Types=require('../source/js/leave-types.js');
 h.api.seed(P.migrateRoles(fixture()));h.api.session('김무현','leaves');
 await h.api.act({dataset:{action:'leavePolicy'}});
 await h.api.act({dataset:{action:'leaveTypeManage'}});
 assert.match(h.element('#editor').innerHTML,/목록 순서<select name="position"/);
 h.submit({id:'leaveTypeForm',fields:{id:'special',name:'특별휴가',icon:'🌿',description:'경조사',units:'0',position:'2',active:'on',paid:'on'}});
 const names=Types.active(h.api.read().state).map(type=>type.name);
 assert.deepEqual(names,['연차','오전반차','특별휴가','오후반차']);
 const cards=[...h.element('#app').innerHTML.matchAll(/data-action="leaveTypeRequest"[^>]*data-id="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(cards,['annual','morning','special','afternoon']);
 await h.api.act({dataset:{action:'newLeave'}});
 const typeSelect=h.element('#editor').innerHTML.match(/id="leaveType">([\s\S]*?)<\/select>/)[1];
 assert.ok(typeSelect.indexOf('특별휴가')<typeSelect.indexOf('오후반차'));
 C.validateState(h.api.read().state);
 h.api.session('정윤정','leaves');
 await assert.rejects(h.api.act({dataset:{action:'leaveTypeMove',id:'special',step:'1'}}),/관리자/);
});


test('상단 위젯은 페이지 모달을 열지 않고 별도 창 실행기에 연결한다',async()=>{const h=harness();h.api.seed(fixture());h.api.session('김무현');let request;h.context.window.location=new URL('http://127.0.0.1:49271/source/html/index.html');h.context.window.fetch=async(url,options)=>{request={url,options};return {ok:true};};const button={dataset:{action:'widgets'}};await h.api.act(button);assert.equal(request.options.method,'POST');assert.ok(request.url.endsWith('/__worklog/widget'));assert.equal(h.element('#editor').open,false);assert.equal(button.disabled,false);});


test('KPI 20개는 업무 데이터를 기본 표시하고 샘플 전환은 저장 상태를 바꾸지 않는다',async()=>{const h=harness(),s=fixture();h.api.seed(s);h.api.session('김무현');const before=JSON.stringify(h.api.read().state);await h.api.act({dataset:{action:'page',page:'kpi'}});assert.equal((h.element('#app').innerHTML.match(/data-kpi-id=/g)||[]).length,20);assert.doesNotMatch(h.element('#app').innerHTML,/최근 30일 예시/);await h.api.act({dataset:{action:'kpiMode',mode:'sample'}});assert.match(h.element('#app').innerHTML,/최근 30일 예시/);await h.api.act({dataset:{action:'kpiMode',mode:'live'}});assert.match(h.element('#app').innerHTML,/집계 대기/);assert.doesNotMatch(h.element('#app').innerHTML,/최근 30일 예시/);assert.equal(JSON.stringify(h.api.read().state),before);});

test('장난감 네 메뉴는 동작하고 투표·게임 상태는 메뉴를 옮겨도 보존된다',async()=>{
 const h=harness();h.api.seed(fixture());h.api.session('김무현');
 await h.api.act({dataset:{action:'page',page:'toyWordChain'}});
 let html=h.element('#app').innerHTML;
 const nav=html.slice(html.indexOf('id="nav-toys"'));
 assert.deepEqual([...nav.matchAll(/data-page="([^"]+)"/g)].map(m=>m[1]),['toyWordChain','toyVote','toyWheel','toyMeal']);
 h.submit({dataset:{toyForm:'wordAdd'},fields:{word:'그림'}});
 assert.equal(h.api.read().state.toys.word.entries[0].word,'그림');
 await h.api.act({dataset:{action:'page',page:'toyVote'}});
 h.submit({dataset:{toyForm:'pollCreate'},fields:{title:'점심 메뉴',options:'한식\n일식'}});
 const poll=h.api.read().state.toys.polls[0];
 await h.api.act({dataset:{action:'toy',toyAction:'pollVote',id:poll.id,index:'1'}});
 assert.equal(h.api.read().state.toys.polls[0].ballots.김무현,1);
 assert.match(h.element('#app').innerHTML,/1표 · 100%/);
 await h.api.act({dataset:{action:'page',page:'toyWheel'}});
 h.submit({dataset:{toyForm:'wheelSpin'},fields:{options:'한식\n일식'}});
 assert.equal(h.api.read().state.toys.wheel.history.length,1);
 assert.match(h.element('#app').innerHTML,/is-spinning/);
 await h.api.act({dataset:{action:'page',page:'toyWordChain'}});
 assert.match(h.element('#app').innerHTML,/그림/);
 assert.doesNotThrow(()=>C.validateState(h.api.read().state));
});

test('좌측 메뉴 이동 시 스크롤과 선택 버튼의 포커스를 유지한다',async()=>{
 const h=harness();h.api.seed(fixture());h.api.session('김무현');h.api.render();
 h.element('.sidebar').scrollTop=196;h.element('.sidebar .nav').scrollTop=280;
 const button=h.element('.nav [data-page="toyWordChain"]');let focused;
 button.focus=opts=>{focused=opts;};
 await h.api.act({dataset:{action:'page',page:'toyWordChain'}});
 assert.equal(h.element('.sidebar').scrollTop,196);assert.equal(h.element('.sidebar .nav').scrollTop,280);
 assert.deepEqual(JSON.parse(JSON.stringify(focused)),{preventScroll:true});
 assert.match(h.element('#app').innerHTML,/data-page="toyWordChain"[^>]*aria-current="page"/);
});

test('끝말잇기는 참가자 설정 없이 내 캐릭터·이름으로 이어가고 프로필 변경을 반영한다',async()=>{
 const h=harness(),state=fixture();state.members.find(m=>m.name==='김무현').avatar='bbiyak';h.api.seed(state);h.api.session('김무현','toyWordChain');h.api.render();
 let html=h.element('#app').innerHTML;assert.match(html,/워크로그/);assert.doesNotMatch(html,/data-toy-form="wordStart"|name="players"/);
 h.submit({dataset:{toyForm:'wordAdd'},fields:{word:'그림',author:'정윤정',previous:'워크로그'}});
 assert.equal(h.api.read().state.toys.word.entries[0].author,'김무현');assert.match(h.element('#app').innerHTML,/toy-community-history/);
 h.api.session('정윤정','toyWordChain');h.api.render();h.submit({dataset:{toyForm:'wordAdd'},fields:{word:'임금'}});
 assert.deepEqual(h.api.read().state.toys.word.entries.map(e=>e.author),['김무현','정윤정']);
 html=h.element('#app').innerHTML;assert.match(html,/그림/);assert.match(html,/임금/);assert.match(html,/character-avatar/);
 await h.api.act({dataset:{action:'page',page:'toyMeal'}});assert.match(h.element('#app').innerHTML,/303곳/);assert.match(h.element('#app').innerHTML,/오늘의 식사추천/);
 h.submit({dataset:{toyForm:'mealSearch'},fields:{query:'없는음식점xyz'}});assert.match(h.element('#app').innerHTML,/검색 결과가 없습니다/);
});


test('식사추천은 버튼을 누를 때만 다시 뽑고 검색과 페이지 전환은 결과를 유지한다',async()=>{
 const h=harness();h.api.seed(fixture());h.api.session('김무현','toyMeal');h.api.render();
 assert.match(h.element('#app').innerHTML,/식사 추천받기/);
 await h.api.act({dataset:{action:'toy',toyAction:'mealRecommend'}});
 let html=h.element('#app').innerHTML;const name=html.match(/<h2>([^<]+)<\/h2>/)[1];
 assert.match(html,/다시 추천/);const before=JSON.stringify(h.api.read().state);
 await h.api.act({dataset:{action:'page',page:'toyVote'}});await h.api.act({dataset:{action:'page',page:'toyMeal'}});
 assert.ok(h.element('#app').innerHTML.includes('<h2>'+name+'</h2>'));
 await h.api.act({dataset:{action:'toy',toyAction:'mealRecommend'}});
 html=h.element('#app').innerHTML;assert.ok(!html.includes('<h2>'+name+'</h2>'));
 assert.equal(JSON.stringify(h.api.read().state),before);
});

test('끝말잇기는 kill 기록과 총점 계산을 유지하면서 화면에서는 kill을 숨긴다',async()=>{
 const h=harness();h.api.seed(fixture());h.api.session('김무현','toyWordChain');h.api.render();
 assert.match(h.element('#app').innerHTML,/data-toy-action="wordForfeit" disabled/);
 h.submit({dataset:{toyForm:'wordAdd'},fields:{word:'그림'}});const word=h.api.read().state.toys.word.entries[0];
 h.api.session('정윤정','toyWordChain');h.api.render();
 h.context.confirm=()=>false;await h.api.act({dataset:{action:'toy',toyAction:'wordForfeit',previous:word.id}});
 assert.equal(h.api.read().state.toys.word.entries.length,1);
 h.context.confirm=()=>true;await h.api.act({dataset:{action:'toy',toyAction:'wordForfeit',previous:word.id}});
 assert.equal(h.api.read().state.toys.word.rounds[0].by,'정윤정');assert.equal(h.api.read().state.toys.word.rounds[0].killer,'김무현');
 const html=h.element('#app').innerHTML;assert.match(html,/인원별 점수/);assert.match(html,/정윤정<\/strong> 포기/);assert.doesNotMatch(html,/kill/i);assert.match(html,/총점/);
 assert.match(html,/지금 이어갈 단어<\/small><strong>워크로그/);assert.doesNotThrow(()=>C.validateState(h.api.read().state));
});

test('연차 현황과 설정 팝업은 자동 계산 기본값과 수동·자동 전환을 표시한다',async()=>{
 const h=harness(),state=fixture();state.members.find(m=>m.name==='김무현').hireDate='2020-01-01';state.leaveAllowances={'2026':{'김무현':15}};
 h.api.seed(state);h.api.session('김무현','leaves');h.api.render();assert.match(h.element('#app').innerHTML,/입사일·근속연수 기준 자동 계산/);
 await h.api.act({dataset:{action:'leaveAllowance'}});assert.match(h.element('#editor').innerHTML,/value="auto" selected/);assert.match(h.element('#editor').innerHTML,/자동 계산: 17일/);
 h.submit({id:'allowanceForm',fields:{mode:'manual',days:'22'}});assert.equal(h.api.read().state.leaveAllowanceModes['2026'].김무현,'manual');assert.match(h.element('#app').innerHTML,/수동 총수 적용 중/);
 await h.api.act({dataset:{action:'leaveAllowance'}});h.submit({id:'allowanceForm',fields:{mode:'auto'}});
 assert.match(h.element('#app').innerHTML,/입사일·근속연수 기준 자동 계산/);assert.equal(h.api.read().state.leaveAllowances['2026'].김무현,22);assert.doesNotThrow(()=>C.validateState(h.api.read().state));
});

test('끝말잇기 오답도 감점 상태를 보관하고 참여 인원·성공·오답·총점을 갱신한다',async()=>{
 const h=harness();h.api.seed(fixture());h.api.session('김무현','toyWordChain');h.api.render();
 h.submit({dataset:{toyForm:'wordAdd'},fields:{word:'그림'}});
 h.api.session('정윤정','toyWordChain');h.api.render();h.submit({dataset:{toyForm:'wordAdd'},fields:{word:'임금'}});
 assert.equal(h.api.read().state.toys.word.entries[1].points,1);
 h.submit({dataset:{toyForm:'wordAdd'},fields:{word:'사과'}});
 assert.equal(h.api.read().state.toys.word.entries.length,2);assert.equal(h.api.read().state.toys.word.mistakes[0].points,-2);
 assert.match(h.element('#toyError').textContent,/오답 −2점/);
 const html=h.element('#app').innerHTML;assert.match(html,/현재 판 참여 · 2명/);assert.match(html,/성공<\/th><th scope="col">오답/);assert.doesNotMatch(html,/kill/i);
 assert.doesNotThrow(()=>C.validateState(h.api.read().state));
});
