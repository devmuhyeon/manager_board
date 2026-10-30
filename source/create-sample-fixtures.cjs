// Creates a separate fixture folder only; never writes real source or live dashboard files.
const fs=require('node:fs'),path=require('node:path'),C=require('../js/core.js'),P=require('../js/personnel.js'),W=require('../js/workspace.js');
const root=path.resolve(__dirname,'../samples/2026-10-26');
if(fs.existsSync(root))throw Error('샘플 폴더가 이미 있습니다. 기존 샘플을 덮어쓰지 않습니다.');
const rows=[
 ['전체 메뉴 설명 추가에 따른 UI 개선 사후평가','UX','PC','성아미','기획','고광필','10-06','11-20','진행중'],
 ['고용정보 콘텐츠 적용 사후 평가','UX','PC','성아미, 정윤정','기획','고광필','10-12','11-27','진행중'],
 ['고용정보 콘텐츠 메뉴 재구성 방안 설명 자료','UX','PC&MO','성아미','기획','고광필','10-01','10-06','완료'],
 ['UT 페이지 제작 (콘텐츠 / 전체메뉴)','퍼블','PC','김무현','퍼블','고광필','10-14','10-30','진행중'],
 ['고소득 취업의 조건, 정말 하나뿐일까?','콘텐츠','10월 뉴스레터','김아영, 김다솔','디자인','김재민','09-03','09-07','완료','뉴스레터 정기'],
 ['고용24 통합경력증명서로 발급·검증 한 번에 끝내세요!','콘텐츠','11월 뉴스레터','김아영, 최지안','디자인','김재민','09-04','11-06','진행중','뉴스레터 정기'],
 ['이 공고 괜찮을까? 신종 거짓 구인광고 조회 서비스','콘텐츠','10월 뉴스레터','김아영, 최지안','디자인','김재민','10-06','10-07','완료','뉴스레터 정기'],
 ['기업 인증서, 만료 전 점검으로 업무 공백 줄이기','콘텐츠','10월 뉴스레터','김아영, 최지안','디자인','김재민','10-12','10-15','완료','뉴스레터 정기'],
 ['거짓구인광고, 확인부터 대응까지','콘텐츠','10월 제작','김아영, 최지안','디자인','고광필','09-28','10-06','완료','정책안내'],
 ['면접, 답변 암기보다 경험 정리부터','콘텐츠','11월 제작','김아영, 최지안','디자인','고광필','10-01','10-30','진행중','구직노하우'],
 ['이직을 고민한다면, 먼저 점검해 보세요','콘텐츠','11월 제작','김아영, 김다솔','디자인','고광필','09-29','10-30','진행중','구직노하우'],
 ['중장년 재취업, 막막함은 줄이고! 가능성은 넓히고!','콘텐츠','10월 제작','김아영, 김다솔','디자인','고광필','10-12','10-30','진행중','구직노하우'],
 ['난임치료휴가, 6일 중 4일 유급으로','콘텐츠','10월 제작','김아영, 최지안','디자인','고광필','10-07','10-30','진행중','정책안내'],
 ['이직확인서 작성·제출 시 놓치기 쉬운 항목은?','콘텐츠','10월 제작','김아영, 최지안','디자인','고광필','10-19','10-30','진행중','기업실무'],
 ['OECD 주요국 중 한국의 최저임금은 어디쯤일까?','콘텐츠','10월 제작','김아영, 김다솔','디자인','고광필','10-19','10-30','진행중','고용동향'],
 ['10월 게시 콘텐츠 대체텍스트 작성','콘텐츠','10월 제작','김아영, 김다솔, 최지안','기획','하현승','10-23','10-30','예정','대체텍스트'],
 ['정책제도 카테고리 추가에 따른 아이콘 디자인','디자인','PC&MO','김민재','디자인','고광필','10-01','10-01','완료'],
 ['모성보호제도 사업장안내문 이미지 문구 수정요청','디자인','PC&MO','최완이','디자인','김보름','10-02','10-13','완료'],
 ['모성보호제도 사업장안내문 요약표 이미지 문구 수정 요청','디자인','PC&MO','최완이','디자인','김보름','10-07','10-13','완료'],
 ['직업심리검사 전용서비스 디자인 요청','디자인','PC&MO','최완이','디자인','양혜희','10-19','10-21','완료'],
 ['거짓구인광고 사례조회 메뉴 이미지','디자인','PC&MO','홍소영','디자인','김혜진','10-19','10-21','완료'],
 ['고용행정통계(EIS) 헤더 변경작업','UI','PC','홍소영, 임정규','디자인','강민지','10-21','10-22','완료'],
 ['직업심리검사 조사 메일 발송 관련 디자인 요청','디자인','PC&MO','김다솔','디자인','김재민','10-13','10-28','검토중'],
 ['구직자대상 프로파일링 진단(시범)','UX','PC&MO','정윤정, 임정규','기획','유길현','09-04','11-04','진행중']
];
const date=s=>'2026-'+s;
const requests=rows.map((r,i)=>{
 const [title,c1,c2,people,role,requester,start,due,status,c3='']=r,customer=i===23?'취업지원서비스1':'고용24대민포털';
 const folder=date(start).replaceAll('-','')+'_'+customer+'_'+requester+'_'+title.replace(/[<>:"/\\|?*]/g,'').replace(/[. ]+$/,'');
 const row={요청ID:'fixture-'+String(i+1).padStart(3,'0'),과업명:title,구분1:c1,구분2:c2,구분3:c3,요청팀:customer,요청자:requester,요청일:date(start),요청완료일:date(due),시작일:date(start),마감일:date(due),진행상태:status,담당자:people,폴더명:folder,요청내용:'[임시 샘플] 스크린샷을 참고해 재구성한 확인용 자료입니다. 미확인 날짜·상태·배정은 예시입니다.',비고:'실제 요청 원본이나 실제 인사·휴가 자료가 아닙니다.'};
 for(const name of people.split(', ')){const member=C.MEMBERS.find(m=>m.name===name),taskRole=member.team==='콘텐츠'?(name==='김아영'?'기획':'디자인'):member.team;row['담당자_'+taskRole]=[row['담당자_'+taskRole],name].filter(Boolean).join(', ');}
 return row;
});
let state=P.upgrade({schemaVersion:1,revision:0,demo:false,accounts:{},projects:[]});
state=C.importRows(state,{요청목록:requests}).state;state.teamAdmins=['성아미'];state.teamLeaders={기획:'성아미',퍼블:'임정규',디자인:'홍소영',콘텐츠:'김아영'};
state.contentOptions={level2:[...new Set(rows.filter(r=>r[1]==='콘텐츠').map(r=>r[2]))],level3:[...new Set(rows.filter(r=>r[1]==='콘텐츠').map(r=>r[9]))]};
state.projects.forEach((p,i)=>{const r=rows[i];p.overrides={...C.cleanClassification({taskCategory:r[1],platform:r[2],contentCategory:r[2],contentType:r[9]})};p.logs=[{id:'log-'+i,date:i%2?'2026-10-26':'2026-10-23',author:p.assignees[0],content:'[샘플] '+(p.status==='완료'?'최종 결과물 전달 및 검수 완료':'요청 내용 확인 및 화면 수정 진행')}];});
const manual={...structuredClone(C.effective(state.projects[3])),id:'fixture-manual',source:'manual',title:'[직접 등록 샘플] 공통 UI 접근성 점검',status:'진행중',due:'2026-11-03',logs:[],overrides:{}};manual.tasks=manual.tasks.map(t=>({...t,due:'2026-11-03',status:'진행중'}));state.projects.push(manual);
const revision=W.revisionDraft(state,state.projects[17].id,'최완이');revision.id='fixture-revision-1';revision.requested='2026-10-26';revision.started='2026-10-26';revision.due='2026-10-29';revision.tasks=revision.tasks.map(t=>({...t,started:'2026-10-26',due:'2026-10-29',status:'진행중'}));revision.description='[샘플] 완료한 이미지에서 문구와 아이콘 추가 수정';state.projects.push(revision);
for(const [i,m] of state.members.entries()){
 state.personal[m.name]=[{id:'memo-'+i,title:'[샘플] 이번 주 작업 메모',content:'고객 피드백 확인 → 수정안 전달 → 완료 내역 기록',date:'2026-10-28',time:'10:00',done:false},{id:'next-'+i,title:'[샘플] 다음 주 업무 점검',content:'진행 과업과 마감 일정 확인',date:'2026-11-03',time:'14:00',done:false}];
 state=W.setAllowance(state,'김무현',m.name,'2026',15+i%3);
 state=P.saveLeave(state,'김무현',{owner:m.name,start:'2026-10-22',end:'2026-10-22',type:'연차',note:'[샘플] 사용 연차'});
 const day=i%2?'2026-11-02':'2026-10-29';state=P.saveLeave(state,'김무현',{owner:m.name,start:day,end:day,type:i%2?'오전 반차':'연차',note:'[샘플] 예정 휴가'});
}
state=P.saveLeave(state,'김무현',{owner:'김무현',start:'2026-12-24',end:'2026-12-28',type:'연차',note:'[샘플] 성탄절·주말 제외 → 2일 차감 확인'});
state=P.saveLeave(state,'김무현',{owner:'김무현',start:'2026-10-23',end:'2026-10-23',type:'추가 사용',dailyUnits:.5,note:'[샘플] 추가 사용 0.5일'});
C.validateState(state);
const write=(rel,value)=>{const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof value==='string'?value:JSON.stringify(value,null,2),'utf8');};
write('원본자료/요청관리.json',{샘플:true,설명:'스크린샷 참고 재구성. 실제 요청관리 JSON 스키마는 미확인.',요청목록:requests});
write('원본자료/팀관리.json',{샘플:true,teams:C.CUSTOMERS});
for(const r of requests){const dir='원본자료/'+r.폴더명;write(dir+'/'+r.폴더명+'.json',r);write(dir+'/처리결과.json',{샘플:true,요청ID:r.요청ID,진행상태:r.진행상태,담당자:r.담당자,처리내용:'[샘플] '+r.진행상태});write(dir+'/원본파일/샘플 안내.txt','실제 원본파일이 아닌 폴더 구조 확인용입니다.');if(r.요청ID!=='fixture-024')write(dir+'/결과물/샘플 안내.txt','실제 디자인·퍼블 결과물이 아닌 폴더 구조 확인용입니다.');}
write('통합저장/통합관리 대시보드.json',state);
const next=structuredClone(requests);next[3].진행상태='검토중';next[3].마감일='2026-11-02';next.push({...next[16],요청ID:'fixture-025',과업명:'[새로고침 샘플] 신규 아이콘 추가 요청',진행상태:'예정',요청일:'2026-10-26',마감일:'2026-11-05'});
write('새로고침확인/요청관리.json',{샘플:true,요청목록:next});
write('사용안내.md',`# 임시 확인용 샘플\n\n스크린샷의 과업명·담당자·분류를 참고해 재구성했습니다. 연도는 2026년으로 가정했고, 일부 날짜·상태·로그·권한·직급·휴가는 화면 확인을 위한 가상 값입니다. 실제 원본 JSON 형식을 제공받은 것은 아닙니다. 실제 사용자 비밀번호는 포함하지 않습니다.\n\n## 연결 순서\n\n기존 작업 중인 내용이 있으면 먼저 내용 저장 또는 JSON 백업을 하세요.\n\n1. 원본 자료 폴더: 이 폴더 안의 **원본자료** 선택\n2. 요청관리 JSON: **원본자료/요청관리.json** 선택\n3. 통합관리 저장 폴더: **통합저장** 선택\n4. 연결 완료 후 팀과 이름을 선택하고 최초 로그인 비밀번호를 설정하세요. 샘플에는 미리 설정된 비밀번호가 없습니다.\n\n내용 저장은 이 샘플의 통합저장 JSON에만 반영됩니다. Z/Y 실사용 경로는 선택하지 마세요.\n\n## 확인할 내용\n\n- 원본 과업 24건 + 직접 등록 1건 + 연결된 수정작업 1건\n- 10명의 개인 메모·이번주/다음주 일정, 연차 총수·사용·예정·반차·추가 사용\n- 김무현: 전체 관리 / 성아미: 샘플 팀관리자\n- 팀장: 기획 성아미, 퍼블 임정규, 디자인 홍소영, 콘텐츠 김아영\n- 일반 팀원 예: 정윤정 / 최완이 / 김다솔\n- 김무현의 12/24~12/28 연차는 성탄절과 주말을 제외해 2일 차감\n- 홈·업무·고객별 업무·주간보고·수정작업·인원관리 확인\n\n## 새로고침 확인\n\n요청관리 JSON을 **새로고침확인/요청관리.json**으로 재연결하고 새로고침하세요. UT 페이지는 검토중/11월 2일 마감으로 변경되고 신규 과업 1건이 추가됩니다. 통합관리에서 직접 수정한 값은 유지되므로 변경 확인은 수정하지 않은 과업으로 하세요. 직접 등록·수정작업·메모·휴가도 유지됩니다.\n\n프로젝트별 요청 JSON·처리결과 JSON·원본파일·결과물은 구조 확인용이며 현재 과업 가져오기는 집계 요청관리.json을 기준으로 동작합니다. 팀관리.json은 고객팀 목록입니다. 콘텐츠 분류3 등 통합 전용 필드는 통합저장 샘플에 포함했습니다.\n\n이 샘플은 2026년 10월 26일 주간 기준입니다. 샘플 연결 후에는 다시 실사용 폴더를 선택하기 전까지 샘플 데이터로 작업하게 됩니다.\n`);
console.log(JSON.stringify({folder:root,sourceProjects:requests.length,dashboardProjects:state.projects.length,members:state.members.length,leaves:state.leaves.length},null,2));
