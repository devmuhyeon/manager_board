(function(root){
 'use strict';
 const Avatars=typeof module!=='undefined'?require('../source/js/avatar-catalog.js'):root.BoardAvatars;
 const representativeAvatars={성아미:'sailor-moon',정윤정:'quokka',임정규:'young-goku',김무현:'penguin-new',홍소영:'powerpuff',김민재:'frog',최완이:'kitty',김아영:'terriermon',김다솔:'hamtaro',최지안:'bbiyak'};
 const sampleAvatar=name=>Object.hasOwn(representativeAvatars,name)?representativeAvatars[name]:undefined;
 function relativeDays(today){return offset=>{const date=new Date(today+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);};}
 function workflowSamples(C,day=relativeDays(C.today())){
  const rows=[
   {id:'uiux-intake',과업명:'[샘플] 모바일 회원가입 개선',요청팀:'서비스 운영팀',진행상태:'접수',완료요청일:day(4),요청내용:'가입 첫 화면의 안내 문구를 검토해 주세요.'},
   {id:'uiux-plan',과업명:'[샘플] 검색 필터 정책 정리',요청팀:'서비스 운영팀',진행상태:'진행중',완료요청일:day(3),담당자_기획:'성아미',작업내용_기획:'조건별 필터 노출 정책을 정리하고 있습니다.'},
   {id:'uiux-history',과업명:'[샘플] 신청서 접근성 점검',요청팀:'신청 서비스팀',등록일:day(-4),등록자:'성아미',완료요청일:day(1),작업내용_디자인:'안내 문구 배치를 검토합니다.',작업내용_퍼블:'키보드 이동 순서를 점검합니다.',담당자_기획:'정윤정',담당자_퍼블:'김무현',처리결과:{진행상태:'접수',담당자_디자인:'홍소영'},요청내용:'키보드 이동과 입력 오류 안내를 확인합니다.'},
   {id:'uiux-publish',과업명:'[샘플] 모바일 메뉴 반영',요청팀:'서비스 운영팀',진행상태:'완료',완료요청일:day(-3),담당자_퍼블:'김무현',작업내용_퍼블:'모바일 메뉴와 키보드 탐색을 검증했습니다.'},
   {id:'uiux-revision',과업명:'[샘플] 공지 배너 문구 수정',요청팀:'고객 지원팀',진행상태:'완료 후 수정',완료요청일:day(-2),담당자_디자인:'최완이',작업내용_디자인:'고객 피드백으로 배너 제목과 줄바꿈을 수정합니다.'},
   {id:'uiux-hold',과업명:'[샘플] FAQ 분류 개편',요청팀:'고객 지원팀',진행상태:'보류',담당자_기획:'정윤정',담당자_디자인:'김민재',요청내용:'고객이 FAQ 분류를 확정한 이후 진행합니다.'},
   {id:'uiux-live',과업명:'[샘플] 대시보드 도움말 반영',요청팀:'신청 서비스팀',진행상태:'운영반영완료',완료요청일:day(-8),담당자_디자인:'홍소영',담당자_퍼블:'임정규',작업내용_퍼블:'운영 화면에서 도움말 표시를 확인했습니다.'},
   {id:'uiux-overdue',과업명:'[샘플] 신청서 저장 오류 안내 수정',요청팀:'신청 서비스팀',진행상태:'진행중',완료요청일:day(-2),담당자_기획:'정윤정',담당자_퍼블:'김무현',요청내용:'임시 저장이 실패했을 때 다시 시도할 수 있도록 오류 안내를 수정합니다.'},
   {id:'uiux-design',과업명:'[샘플] 서비스 소개 화면 시안',요청팀:'서비스 운영팀',진행상태:'검토중',완료요청일:day(1),담당자_디자인:'최완이',작업내용_디자인:'두 가지 헤더 시안의 모바일 가독성을 비교합니다.'},
   {id:'uiux-today',과업명:'[샘플] 통합검색 빈 화면 개선',요청팀:'고객 지원팀',진행상태:'진행중',완료요청일:day(0),담당자_디자인:'김민재',담당자_퍼블:'임정규',요청내용:'검색 결과가 없을 때 추천 검색어와 초기화 버튼을 표시합니다.'},
   {id:'uiux-next',과업명:'[샘플] 로그인 옵션과 인증 안내 개편',요청팀:'서비스 운영팀',진행상태:'예정',완료요청일:day(8),담당자_기획:'성아미, 정윤정',담당자_디자인:'홍소영',담당자_퍼블:'김무현',요청내용:'로그인 옵션의 기본 순서와 인증 안내 문구를 검토합니다.'},
   {id:'uiux-previous',과업명:'[샘플] 고객센터 접근성 점검 완료',요청팀:'고객 지원팀',진행상태:'완료',완료요청일:day(-13),담당자_기획:'성아미',담당자_디자인:'최완이',담당자_퍼블:'임정규',요청내용:'제목 구조, 명도 대비, 키보드 이동 범위를 점검했습니다.'}
  ].map(row=>({...row,마감일:row.완료요청일||'',시작일:row.완료요청일?day(-9):''}));
  const baseline=C.importRows(C.emptyState(),rows,day(-2)).state;
  const updated=rows.map(row=>row.id==='uiux-history'?{...row,완료요청일:day(3),마감일:day(3),작업내용_디자인:'작성자: 홍소영\n입력 오류 안내를 필드 아래에 표시하도록 시안을 수정했습니다.',작업내용_퍼블:'수정자: 김무현\n오류가 발생하면 키보드 초점이 첫 오류 필드로 이동하도록 반영했습니다.',처리결과:{진행상태:'진행중',담당자_디자인:'홍소영, 김민재'}}:row);
  return C.importRows(baseline,updated,day(0)).state.projects.map(project=>({...project,sampleFixture:true,workflowFixture:true}));
 }
 function create(C,P){
  const state=P.upgrade({...C.emptyState(),projects:[],demo:false});
  const today=C.today(),day=relativeDays(today);
  state.overallAdmin='김무현';state.teamLeaders={기획:'성아미',퍼블:'김무현',디자인:'홍소영',콘텐츠:'김아영'};
  const statuses=['접수','진행중','완료','완료 후 수정','운영반영완료','보류'];
  const titles=['회원가입 화면 개선','신청서 접근성 점검','서비스 소개 페이지','검색 결과 화면 정비','월간 뉴스레터 제작','모바일 메뉴 개선','공지 배너 제작','대시보드 사용성 개선','오류 안내 문구 정비','콘텐츠 상세 화면','서비스 운영 점검','FAQ 화면 개선'];
  state.projects=Array.from({length:36},(_,i)=>{const title=titles[i%titles.length]+(i>=12?' · '+(Math.floor(i/12)+1)+'차':'');return ({id:'ux-preview:'+i,source:'manual',title:'[샘플] '+title,customer:['샘플 서비스팀','샘플 운영팀','샘플 콘텐츠팀'][i%3],requester:'검토 담당 '+(i%3+1),taskCategory:'UX',platform:'PC&MO',requested:day(-10),requestedDue:day(i-4),description:'UI/UX 검토용 샘플입니다. 카드 배치, 진행률, 담당자 및 마감일 표시를 확인해 주세요.',link:'',sampleFixture:true,
   tasks:['기획','디자인','퍼블'].map((role,j)=>({id:'ux-task:'+i+':'+j,role,assignees:[j===0?'성아미':j===1?(i%2?'김다솔':'홍소영'):'김무현'],status:statuses[i%6],progress:[0,40,100,25,100,60][i%6],started:day(-6),due:day(i-4),completedOn:[2,4].includes(i%6)?day(-1):'',notes:'담당 업무 '+(j+1)+' 진행 확인'})),logs:[{id:'ux-log:'+i,date:day(-(i%4)),author:'김무현',content:'[샘플] 화면 구성 검토 및 피드백 반영. 버튼 정렬과 모바일 표시를 확인했습니다.'}]});});
  state.projects[3].parentProjectId=state.projects[2].id;
  const sampleBefore={id:'preview-history',과업명:'신청서 접근성 점검',처리결과:{담당자_디자인:'홍소영',진행상태:'접수',완료요청일:day(1)}};
  const sampleAfter={...sampleBefore,처리결과:{담당자_디자인:'홍소영, 김민재',진행상태:'진행중',완료요청일:day(3)}};
  const sampleBaseline=C.importRows(C.emptyState(),[sampleBefore],day(-1)).state;
  state.projects[1].sourceHistory=C.importRows(sampleBaseline,[sampleAfter],today).state.projects[0].sourceHistory;
  state.projects[10].tasks=[{id:'ux-content-plan',role:'기획',assignees:['김아영'],status:'진행중',progress:65,started:day(-2),due:day(4),notes:''},{id:'ux-content-design',role:'디자인',assignees:['최지안'],status:'진행중',progress:30,started:day(-1),due:day(5),notes:''}];
  state.projects.forEach((project,i)=>{
   const due=[2,4].includes(i%6)?day(-1-(i%9)):day((i%12-3)*3);
   const start=new Date(due+'T00:00:00Z');start.setUTCDate(start.getUTCDate()-3-i%8);
   project.requestedDue=due;
   if(i%4===0)project.tasks=project.tasks.slice(0,2);
   project.tasks.forEach((task,j)=>{const pool=state.members.filter(m=>m.team===(i%4===0?'콘텐츠':j===0?'기획':j===1?'디자인':'퍼블'));task.assignees=[pool[Math.floor(i/2)%pool.length].name];task.started=start.toISOString().slice(0,10);task.due=due;task.status=statuses[i%6];task.progress=[0,40,100,25,100,60][i%6];if(task.status==='완료 후 수정'){task.progress=100;task.revisionProgress=20+(i%4)*15;}});
   project.logs.push({id:'ux-log-detail:'+i,date:day(-i%6),author:project.tasks[0].assignees[0],content:'[샘플] 담당자 검토 완료. 상세 화면, 긴 제목, 기간 겹침, 상태별 표현을 비교합니다.'});
  });
  state.projects.push(...workflowSamples(C,day));
  state.personal={};state.leaves=[];state.leaveAllowances={[today.slice(0,4)]:{}};
  state.members.forEach((m,i)=>{m.avatar=sampleAvatar(m.name)||Avatars.keys[i%Avatars.keys.length];state.leaveAllowances[today.slice(0,4)][m.name]=15;
   state.personal[m.name]=Array.from({length:12},(_,j)=>['검토할 화면','UI 피드백 회의','체크리스트','다음 주 할 일','버튼 정렬 확인','모바일 화면 점검'][j%6]+' '+(j+1)).map((title,j)=>({id:'ux-memo:'+i+':'+j,title:'[샘플] '+title,content:'화면 검토 의견을 여기에 기록해 주세요.\n간격, 글자 크기, 이동 흐름을 확인합니다.',date:j<10?day((j-3)*3):'',endDate:j<10&&j%2?day((j-3)*3+2+j%3):'',time:j===1?'14:00':'',done:j===2}));
   for(const offset of [-7,i+2])state.leaves.push({id:'ux-leave:'+i+':'+offset,owner:m.name,start:day(offset),end:day(offset),type:i%2?'오후 반차':'연차',note:'[샘플] 일정 표시 확인',dailyUnits:i%2?.5:1});
  });
  state.teamPosts=C.TEAMS.flatMap((team,i)=>[...(i<3?[0]:[]),2,5,8].map(j=>{
   const isNotice=j===0;
   const title=isNotice?['UI·UX 검토 안내: 회원가입과 신청서 화면의 키보드 이동, 오류 안내, 모바일 레이아웃 확인 항목 및 팀별 의견 제출 일정','이번 주 업무 공유','화면 개선 의견 모집'][i]:'화면 개선 의견 모음 '+(Math.floor(j/3)+1);
   const content=isNotice?['UI·UX 보드와 주간 업무 화면에서 같은 과업을 열어 보세요.','이번 주 마감 과업과 담당자를 확인해 주세요.','화면에서 발견한 불편사항을 게시판에 남겨 주세요.'][i]:'화면 검토 의견을 기록합니다.\n1. 버튼 위치\n2. 글자 크기\n3. 모바일 스크롤';
   const authors=state.members.filter(member=>member.team===team);
   return {id:'ux-post:'+i+':'+j,team,type:isNotice?'전체공지':'일반글',author:authors[Math.floor(j/3)%authors.length].name,title:'[샘플] '+title,content,pinned:isNotice&&i===0,sampleFixture:true,createdAt:day(-(isNotice?i:j))+'T09:00:00Z',updatedAt:day(-(isNotice?i:j))+'T09:00:00Z'};
  }));
  state.teamPosts[0].comments=[
   {id:'sample-comment-1',author:'김무현',team:'퍼블',content:'모바일 화면도 함께 확인하겠습니다.',createdAt:day(0)+'T09:10:00Z',sampleFixture:true},
   {id:'sample-comment-2',parentId:'sample-comment-1',author:'홍소영',team:'디자인',content:'오류 안내 문구가 길어지는 경우도 같이 봐 주세요.',createdAt:day(0)+'T09:24:00Z',sampleFixture:true},
   {id:'sample-comment-3',parentId:'sample-comment-2',author:'김무현',team:'퍼블',content:'작은 화면에서도 문구가 줄바꿈되는지 확인했습니다.',createdAt:day(0)+'T09:31:00Z',sampleFixture:true},
   {id:'sample-comment-4',parentId:'sample-comment-3',author:'성아미',team:'기획',content:'다음 검토 때도 이 문구를 기준으로 확인하면 좋겠습니다.',createdAt:day(0)+'T09:42:00Z',sampleFixture:true},
   {id:'sample-comment-5',parentId:'sample-comment-4',author:'홍소영',team:'디자인',content:'검토 항목에 추가했습니다. 긴 문구로도 확인할 수 있게 샘플을 남길게요.',createdAt:day(0)+'T09:51:00Z',sampleFixture:true},
   {id:'sample-comment-6',parentId:'sample-comment-2',author:'임정규',team:'퍼블',content:'키보드로 이동할 때도 오류 위치를 바로 찾을 수 있는지 확인하겠습니다.',createdAt:day(0)+'T10:02:00Z',sampleFixture:true}
  ];
  state.customerTeams=['샘플 서비스팀','샘플 운영팀','샘플 콘텐츠팀'];return C.validateState(state);
 }
 function ensure(input,C,P){
  if(input.developmentSamplesVersion===1)return input;
  const state=P.upgrade(structuredClone(input)),sample=create(C,P),active=state.members.filter(m=>m.active!==false);
  for(const project of sample.projects){
   if(project.workflowFixture)continue;
   if(state.projects.some(p=>p.id===project.id))continue;
   project.tasks.forEach(task=>{task.assignees=task.assignees.filter(name=>active.some(m=>m.name===name));if(!task.assignees.length){const team=task.role==='디자인'?'디자인':task.role==='퍼블'?'퍼블':'기획';task.assignees=active.filter(m=>m.team===team).slice(0,1).map(m=>m.name);}});
   state.projects.push(project);
  }
  for(const person of active){
   state.personal[person.name]??=[];
   const templates=sample.personal[person.name]||Object.values(sample.personal)[0];
   for(const [index,item] of templates.entries()){const id='dev-memo:'+person.name+':'+index;if(!state.personal[person.name].some(m=>m.id===item.id||m.id===id))state.personal[person.name].push({...item,id,sampleFixture:true});}
  }
  for(const leave of sample.leaves)if(active.some(m=>m.name===leave.owner)&&!state.leaves.some(l=>l.id===leave.id))state.leaves.push({...leave,sampleFixture:true});
  state.teamPosts??=[];
  for(const post of sample.teamPosts)if(!state.teamPosts.some(p=>p.id===post.id)){const author=active.find(m=>m.name===post.author&&m.team===post.team)||active.find(m=>m.team===post.team);if(author)state.teamPosts.push({...post,author:author.name,sampleFixture:true});}
  state.developmentSamplesVersion=1;state.demo=false;return state;
 }
 const api={create,ensure,workflowSamples,sampleAvatar};if(typeof module!=='undefined')module.exports=api;else root.BoardPreviewData=api;
})(typeof window!=='undefined'?window:globalThis);
