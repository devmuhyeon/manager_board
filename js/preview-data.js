(function(root){
 'use strict';
 function create(C,P){
  const state=P.upgrade({...C.sampleState(),projects:[],demo:false});
  const today=C.today(),day=n=>{const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  state.overallAdmin='김무현';state.teamLeaders={기획:'성아미',퍼블:'김무현',디자인:'홍소영',콘텐츠:'김아영'};
  const statuses=['접수','진행중','완료','완료 후 수정','운영반영완료','보류'];
  const titles=['회원가입 화면 개선','신청서 접근성 점검','서비스 소개 페이지','검색 결과 화면 정비','월간 뉴스레터 제작','모바일 메뉴 개선','공지 배너 제작','대시보드 사용성 개선','오류 안내 문구 정비','콘텐츠 상세 화면','서비스 운영 점검','FAQ 화면 개선'];
  state.projects=Array.from({length:36},(_,i)=>{const title=titles[i%titles.length]+(i>=12?' · '+(Math.floor(i/12)+1)+'차':'');return ({id:'ux-preview:'+i,source:'manual',title:'[샘플] '+title,customer:['샘플 서비스팀','샘플 운영팀','샘플 콘텐츠팀'][i%3],requester:'검토 담당 '+(i%3+1),taskCategory:'UX',platform:'PC&MO',requested:day(-10),requestedDue:day(i-4),description:'UI/UX 검토용 샘플입니다. 카드 배치, 진행률, 담당자 및 마감일 표시를 확인해 주세요.',link:'',sampleFixture:true,
   tasks:['기획','디자인','퍼블'].map((role,j)=>({id:'ux-task:'+i+':'+j,role,assignees:[j===0?'성아미':j===1?(i%2?'김다솔':'홍소영'):'김무현'],status:statuses[i%6],progress:[0,40,100,25,100,60][i%6],started:day(-6),due:day(i-4),completedOn:[2,4].includes(i%6)?day(-1):'',notes:'담당 업무 '+(j+1)+' 진행 확인'})),logs:[{id:'ux-log:'+i,date:day(-(i%4)),author:'김무현',content:'[샘플] 화면 구성 검토 및 피드백 반영. 버튼 정렬과 모바일 표시를 확인했습니다.'}]});});
  state.projects[3].parentProjectId=state.projects[2].id;
  state.projects[10].tasks=[{id:'ux-content-plan',role:'기획',assignees:['김아영'],status:'진행중',progress:65,started:day(-2),due:day(4),notes:''},{id:'ux-content-design',role:'디자인',assignees:['최지안'],status:'진행중',progress:30,started:day(-1),due:day(5),notes:''}];
  state.projects.forEach((project,i)=>{
   const due=[2,4].includes(i%6)?day(-1-(i%9)):day((i%12-3)*3);
   const start=new Date(due+'T00:00:00Z');start.setUTCDate(start.getUTCDate()-3-i%8);
   project.requestedDue=due;
   if(i%4===0)project.tasks=project.tasks.slice(0,2);
   project.tasks.forEach((task,j)=>{const pool=state.members.filter(m=>m.team===(i%4===0?'콘텐츠':j===0?'기획':j===1?'디자인':'퍼블'));task.assignees=[pool[Math.floor(i/2)%pool.length].name];task.started=start.toISOString().slice(0,10);task.due=due;task.status=statuses[i%6];task.progress=[0,40,100,25,100,60][i%6];if(task.status==='완료 후 수정'){task.progress=100;task.revisionProgress=20+(i%4)*15;}});
   project.logs.push({id:'ux-log-detail:'+i,date:day(-i%6),author:project.tasks[0].assignees[0],content:'[샘플] 담당자 검토 완료. 상세 화면, 긴 제목, 기간 겹침, 상태별 표현을 비교합니다.'});
  });
  state.personal={};state.leaves=[];state.leaveAllowances={[today.slice(0,4)]:{}};
  state.members.forEach((m,i)=>{m.avatar=i%2?'bbiyak':'yongyong';state.leaveAllowances[today.slice(0,4)][m.name]=15;
   state.personal[m.name]=Array.from({length:12},(_,j)=>['검토할 화면','UI 피드백 회의','체크리스트','다음 주 할 일','버튼 정렬 확인','모바일 화면 점검'][j%6]+' '+(j+1)).map((title,j)=>({id:'ux-memo:'+i+':'+j,title:'[샘플] '+title,content:'화면 검토 의견을 여기에 기록해 주세요.\n간격, 글자 크기, 이동 흐름을 확인합니다.',date:j<10?day((j-3)*3):'',endDate:j<10&&j%2?day((j-3)*3+2+j%3):'',time:j===1?'14:00':'',done:j===2}));
   for(const offset of [-7,i+2])state.leaves.push({id:'ux-leave:'+i+':'+offset,owner:m.name,start:day(offset),end:day(offset),type:i%2?'오후 반차':'연차',note:'[샘플] 일정 표시 확인',dailyUnits:i%2?.5:1});
  });
  state.teamPosts=C.TEAMS.flatMap((team,i)=>Array.from({length:9},(_,j)=>['전체공지','팀별공지','일반글'][j%3]).map((type,j)=>({id:'ux-post:'+i+':'+j,team,type,author:state.members.find(m=>m.team===team).name,title:'[샘플] '+['UI/UX 검토 안내','이번 주 팀 업무 공유','화면 개선 의견 모음'][j%3]+' '+(j+1),content:['업무보드와 주간 일정의 연동을 확인해 주세요.\n카드형과 도표형을 전환하고 진행률 40% 입력도 확인합니다.','이번 주 마감 과업과 담당자를 확인해 주세요.\n휴가 일정과 업무량을 함께 점검합니다.','발견한 불편사항을 기록하는 샘플 게시글입니다.\n1. 버튼 위치\n2. 글자 크기\n3. 모바일 가로 스크롤'][j%3],pinned:j===0,createdAt:day(-j)+'T09:00:00Z',updatedAt:day(-j)+'T09:00:00Z'})));
  state.customerTeams=['샘플 서비스팀','샘플 운영팀','샘플 콘텐츠팀'];return C.validateState(state);
 }
 function ensure(input,C,P){
  if(input.developmentSamplesVersion===1)return input;
  const state=P.upgrade(structuredClone(input)),sample=create(C,P),active=state.members.filter(m=>m.active!==false);
  for(const project of sample.projects){
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
  for(const post of sample.teamPosts)if(!state.teamPosts.some(p=>p.id===post.id)){const author=active.find(m=>m.team===post.team);if(author)state.teamPosts.push({...post,author:author.name,sampleFixture:true});}
  state.developmentSamplesVersion=1;state.demo=false;return state;
 }
 const api={create,ensure};if(typeof module!=='undefined')module.exports=api;else root.BoardPreviewData=api;
})(typeof window!=='undefined'?window:globalThis);
