const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../source/js/core.js'),B=require('../source/js/task-board.js'),P=require('../source/js/personnel.js');
const Work=require('../source/html/work/uiux/page.js'),Docs=require('../source/html/work/publishing-docs/page.js');
const esc=value=>String(value??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const button=(action,label,cls='',attrs='')=>'<button type="button" data-action="'+action+'" class="'+cls+'" '+attrs+'>'+label+'</button>';
const states=['진행중','완료','개발반영','운영반영완료','보류'];
const roleGroups=[['디자인'],['퍼블'],['디자인','퍼블'],['기획','디자인','퍼블']];
const paths=[['고객센터','홈',''],['고객센터','자주 묻는 질문',''],['개인서비스','신청','신청서'],['개인서비스','',''],['','','']];
function fixture(status,roles,id){
 const people={기획:'정윤정',디자인:'홍소영',퍼블:'김무현'},raw={id,과업명:'고용24 검색 결과 만족도 조사 기능 추가 설계 '+id,요청자:'김재민',요청팀:'고용24대민포털',요청일:'2026-11-05',완료요청일:'2026-11-11',진행상태:status==='개발반영'?'완료':status,요청배경:'요청 배경',요청사항:'요청 내용'};
 for(const role of roles){raw['담당자_'+role]=people[role];raw['작업내용_'+role]='작업시작일자: 2026-11-05\n'+role+' 작업 내용';}
 const p=C.normalize(raw);if(status==='개발반영')p.workflow={release:{development:{url:'https://example.com/development',by:'김무현',at:'2026-11-23T09:00:00Z'}}};return p;
}
function context(original){const state=P.upgrade({...C.emptyState(),projects:[original]});return {state,C,P,BoardTaskBoard:B,relatedRows:()=>[original],esc,button,user:{name:'김무현'},D:{avatar:person=>'<span class="test-avatar">'+esc(person?.name)+'</span>'},member:name=>C.MEMBERS.find(m=>m.name===name),displayProfile:person=>person,BoardProjectReport:{sourceTimeline:()=>'<section>고객 원본 변경 이력</section>'},filters:{},uiuxUi:{},publishingUi:{view:'tasks',selected:''},projectLinks:()=>''};}
let number=0;
for(const status of states)for(const roles of roleGroups)for(const path of paths){
 const n=++number;
 test('기획서 시뮬레이션 '+String(n).padStart(3,'0')+' · '+status+' · '+roles.join('/')+' · '+(path.filter(Boolean).join('/')||'메뉴없음'),()=>{
  const original=fixture(status,roles,'scenario-'+n),source=JSON.stringify(original.raw),c=context(original);
  const work=Work.render(c),detail=Work.detail(original,c);
  const order=['요청관리 대시보드','기획','디자인','퍼블'].map(label=>work.indexOf('<h3>'+label));assert.ok(order.every((v,i)=>v>=0&&(!i||v>order[i-1])));
  assert.equal((work.match(/data-uiux-filter="status"/g)||[]).length,4);
  assert.equal(work.includes('data-action="uiuxRelease"'),['완료','개발반영'].includes(status));
  assert.ok(detail.indexOf('class="ux-comments"')<detail.indexOf('class="ux-timeline"'));assert.doesNotMatch(detail,/<aside/);
  assert.ok(detail.includes('요청배경')&&detail.includes('요청사항')&&detail.includes('산출물 결과 폴더')&&detail.includes('작성기 연동 링크 (전달용)'));
  const sourceTask=Work.M.read(original,C,B).tasks[0];
  if(sourceTask.assignees.includes('김무현'))assert.doesNotThrow(()=>Work.M.toggle(original,sourceTask.id,C,B,'김무현'));
  else assert.throws(()=>Work.M.toggle(original,sourceTask.id,C,B,'김무현'),/본인/);
  if(status==='운영반영완료'){
   assert.equal(Docs.rows(c).length,0);assert.throws(()=>Docs.M.save(original,{path,links:[]},C,B,'김무현'),/제외/);
   assert.doesNotMatch(Docs.render(c),/고용24 검색 결과 만족도/);
  }else{
   const saved=Docs.M.save(original,{path,links:[1,2,3].map(i=>({name:'link#'+i,url:'https://example.com/'+n+'/'+i}))},C,B,'김무현');
   const loaded=C.validateState(JSON.parse(JSON.stringify({...C.emptyState(),projects:[saved]}))).projects[0],next=context(loaded);
   const records=Docs.rows(next);assert.equal(records.length,1);assert.deepEqual(records[0].path,path);
   const html=Docs.render(next);assert.match(html,/>○<\/button>/);assert.match(html,/link#1/);assert.match(html,/link#2/);assert.match(html,/link#3/);
   assert.equal(html.includes('class="pd-link-button"'),status==='개발반영');
   next.publishingUi.view='all';const all=Docs.render(next);assert.match(all,/1뎁스/);assert.match(all,/2뎁스/);assert.match(all,/3뎁스/);assert.match(all,/고용24 검색 결과 만족도/);if(!path[0])assert.match(all,/메뉴없음/);
   assert.equal(JSON.stringify(saved.raw),source);
  }
  assert.equal(JSON.stringify(original.raw),source);
 });
}
test('기획서 시뮬레이션은 중복 실행이 아닌 서로 다른 100개 조합이다',()=>assert.equal(number,100));
test('전체목록은 동일한 상위 메뉴를 합치고 메뉴없음은 마지막에 둔다',()=>{
 const entries=paths.map((path,i)=>({...fixture('진행중',['퍼블'],'group-'+i),workflow:{publication:{path,links:[],author:'김무현',registeredAt:'2026-11-23T09:00:00Z',updatedAt:'2026-11-23T09:00:00Z'}}}));
 const rows=Docs.M.records(entries,C,B),html=Docs.allTable(rows,{esc});assert.match(html,/rowspan="2" class="pd-menu">고객센터/);assert.ok(html.lastIndexOf('메뉴없음')>html.indexOf('개인서비스'));
 assert.deepEqual(Docs.M.choices(rows,['고객센터','',''],1),['홈','자주 묻는 질문'].sort((a,b)=>a.localeCompare(b,'ko')));
 assert.throws(()=>Docs.M.save(entries[0],{path:['','하위메뉴',''],links:[]},C,B,'김무현'),/상위/);
 assert.throws(()=>Docs.M.save(entries[0],{path:['고객센터','',''],links:[{name:'오류',url:'javascript:alert(1)'}]},C,B,'김무현'),/주소/);
});
test('고객의 개발반영 주소와 운영배포완료 표기를 원문 변경 없이 읽는다',()=>{
 const original=fixture('완료',['퍼블'],'raw-deploy');original.raw.개발반영='https://example.com/dev';assert.equal(Docs.rows(context(original))[0].development,'https://example.com/dev');
 original.raw.진행상태='운영배포완료';assert.equal(Docs.rows(context(original)).length,0);
});
test('부분 완료는 회색으로 표시하고 디자인·퍼블이 끝나야 반영 입력을 제공한다',()=>{
 let p=fixture('진행중',['기획','디자인','퍼블'],'partial');p=Work.M.toggle(p,'source-task:디자인',C,B,'홍소영');
 assert.equal(Work.M.read(p,C,B).status,'진행중');assert.equal(Work.M.read(p,C,B).readyToRelease,false);assert.doesNotMatch(Work.render(context(p)),/data-action="uiuxRelease"/);assert.match(Work.render(context(p)),/ux-card ux-completed/);
 p=Work.M.toggle(p,'source-task:퍼블',C,B,'김무현');assert.equal(Work.M.read(p,C,B).readyToRelease,true);assert.equal(Work.M.read(p,C,B).tasks.find(t=>t.role==='기획').status,'진행중');
 p=Work.M.release(p,'development','https://example.com/dev',C,B,'김무현');C.validateState({...C.emptyState(),projects:[p]});assert.match(Work.render(context(p)),/href="https:\/\/example.com\/dev"/);
});
test('고객 개발 URL에 이어 운영 반영을 기록하고 수정하면 이전 반영을 해제한다',()=>{
 let p=fixture('완료',['퍼블'],'raw-release');p.raw.개발반영='https://example.com/customer-dev';
 p=Work.M.release(p,'production','https://example.com/customer-live',C,B,'김무현');C.validateState({...C.emptyState(),projects:[p]});assert.equal(Docs.rows(context(p)).length,0);
 p=Work.M.toggle(p,'source-task:퍼블',C,B,'김무현');assert.equal(Docs.rows(context(p)).length,1);assert.equal(Docs.rows(context(p))[0].development,'');assert.equal(Work.M.read(p,C,B).status,'진행중');
});
