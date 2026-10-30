const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../js/core.js');
const X=require('../js/xlsx.js');
const source=[{id:'r1',과업명:'공동 작업',요청팀:'고용24대민포털',요청자:'고객',요청일:'2026-10-01',완료요청일:'2026-10-30',담당자_디자인:'김다솔, 홍소영',상태:'진행중',작업내용_디자인:'원본 메모'}];
test('공동 업무는 콘텐츠·디자인 모두에 표시되고 전체에서 한 건이다',()=>{
  const s=C.importRows(C.sampleState(),source).state;
  assert.equal(s.projects.length,1);
  for(const user of ['김다솔','홍소영'])assert.equal(C.filterProjects(s.projects,{scope:'personal',user}).length,1);
  for(const team of ['콘텐츠','디자인'])assert.equal(C.filterProjects(s.projects,{scope:'team',team}).length,1);
  assert.equal(C.filterProjects(s.projects,{scope:'all'}).length,1);
});
test('재수입은 로컬 수정·작업 내역·직접 등록을 보존하고 원본은 변경하지 않는다',()=>{
  const original=JSON.stringify(source);const s=C.importRows(C.sampleState(),source).state;
  s.projects[0].overrides={title:'통합관리 수정',tasks:[{id:'task',role:'디자인',assignees:['김다솔'],status:'완료',due:'2026-10-22'}]};
  s.projects[0].logs=[{id:'log',date:'2026-10-22',author:'김다솔',content:'작업 완료'}];
  s.projects.push({id:'manual',source:'manual',title:'직접',assignees:['김무현'],status:'대기',logs:[]});
  const result=C.importRows(s,[{...source[0],과업명:'원본 제목 갱신'}]);
  assert.equal(result.state.projects.length,2);assert.equal(result.updated,1);
  const p=C.effective(result.state.projects[0]);assert.equal(p.title,'통합관리 수정');assert.equal(p.status,'완료');assert.equal(p.logs.length,1);
  assert.equal(result.state.projects[0].raw.과업명,'원본 제목 갱신');assert.equal(JSON.stringify(source),original);
});
test('잘못된 파일이나 중복 ID는 부분 반영 없이 거부한다',()=>{
  const s=C.sampleState(),before=JSON.stringify(s);
  assert.throws(()=>C.importRows(s,[source[0],{}]));assert.throws(()=>C.importRows(s,[source[0],source[0]]));
  assert.equal(JSON.stringify(s),before);assert.throws(()=>C.validateState({projects:[]}));
});
test('작업 기간과 개인/팀 필터를 주간보고에 적용한다',()=>{
  const s=C.importRows(C.sampleState(),source).state;s.projects[0].logs=[
    {id:'1',date:'2026-10-19',author:'김다솔',content:'디자인'},
    {id:'2',date:'2026-10-20',author:'홍소영',content:'검토'},
    {id:'3',date:'2026-10-26',author:'김다솔',content:'다음주'}];
  const f={from:'2026-10-19',to:'2026-10-25'};
  assert.equal(C.reportRows(s.projects,f).length,2);
  assert.equal(C.reportRows(s.projects,{...f,scope:'personal',user:'김다솔'}).length,1);
  assert.equal(C.reportRows(s.projects,{...f,scope:'team',team:'디자인'}).length,1);
  assert.equal(C.filterProjects(s.projects,{dateField:'requestedDue',from:'2026-10-30',to:'2026-10-30'}).length,1);
});
test('담당 업무별 상태와 일정을 독립적으로 유지한다',()=>{
  const p=C.effective({id:'p',source:'manual',logs:[],tasks:[{id:'a',role:'기획',assignees:['성아미'],status:'진행중',due:'2026-11-20'},{id:'b',role:'디자인',assignees:['김다솔'],status:'완료',due:'2026-10-22'}]});
  assert.equal(p.status,'진행중');assert.equal(p.due,'2026-11-20');assert.deepEqual(p.assignees,['성아미','김다솔']);
  assert.equal(p.tasks[1].status,'완료');
});
test('xlsx는 유효한 ZIP 구조와 문자열 셀을 생성한다',async()=>{
  const blob=X.workbook([{name:'업무 목록',headers:['과업명','비고'],rows:[['한글 & <기호>','=HYPERLINK("evil")']]}]);
  const bytes=Buffer.from(await blob.arrayBuffer());assert.equal(bytes.readUInt32LE(0),0x04034b50);
  const files={};let pos=0;
  while(bytes.readUInt32LE(pos)===0x04034b50){const size=bytes.readUInt32LE(pos+18),n=bytes.readUInt16LE(pos+26),extra=bytes.readUInt16LE(pos+28);const name=bytes.subarray(pos+30,pos+30+n).toString();const start=pos+30+n+extra;files[name]=bytes.subarray(start,start+size).toString();pos=start+size;}
  assert.match(files['xl/worksheets/sheet1.xml'],/한글 &amp; &lt;기호&gt;/);assert.match(files['xl/worksheets/sheet1.xml'],/t="inlineStr"/);assert.doesNotMatch(files['xl/worksheets/sheet1.xml'],/<f>/);
  assert.equal(bytes.readUInt32LE(bytes.length-22),0x06054b50);
});
test('시트형 필터는 담당 업무의 상태와 마감일을 적용한다',()=>{
  const projects=[{id:'p',source:'manual',title:'과업',requested:'2026-10-01',logs:[],tasks:[{id:'a',role:'기획',assignees:['성아미'],status:'진행중',due:'2026-11-20'},{id:'b',role:'디자인',assignees:['김다솔'],status:'완료',due:'2026-10-22'}]}];
  const f={taskMode:true,dateField:'due',from:'2026-10-20',to:'2026-10-25',status:'완료'};
  assert.equal(C.filterProjects(projects,f).length,1);
  assert.equal(projects[0].tasks.filter(t=>C.matchesTask(t,f)).length,1);
  assert.equal(C.filterProjects(projects,{...f,scope:'personal',user:'성아미'}).length,0);
});
test('예시 데이터의 담당 일정이 유효하다',()=>{
  const s=C.sampleState();C.validateState(s);
  for(const p of s.projects)for(const t of p.tasks)assert.ok(t.started<=t.due);
});
