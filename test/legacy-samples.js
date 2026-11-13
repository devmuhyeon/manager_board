(function(root){function install(C,P){const uid=C.uid,upgrade=P.upgrade,weekRanges=P.weekRanges,day=(date,n)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  function sampleState(){
    const d=(offset)=>{const x=new Date();x.setDate(x.getDate()+offset);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
    const rows=[
      ['고용24 대민포털 이용가이드 개편','고용24대민포털','예시 고객 A',['김무현','홍소영'],'진행중',2,'PC·모바일 이용가이드 화면 개편 및 접근성 확인'],
      ['직업심리검사 조사 메일 디자인','고용24대민포털','예시 고객 B',['김다솔','홍소영'],'검토중',0,'조사 안내 메일 디자인 및 고객 검토'],
      ['구직자 프로파일링 진단 화면 개선','취업지원서비스1','예시 고객 C',['정윤정','임정규','김민재'],'진행중',5,'진단 화면 기획 및 반응형 퍼블리싱'],
      ['10월 공지사항 홍보 이미지 제작','고용보험서비스','예시 고객 D',['김아영','최지안'],'완료',-1,'공지사항 배너와 이메일 홍보 이미지 제작'],
      ['행정포털 신청서 UI 정비','고용24행정포털','예시 고객 E',['김무현','최완이'],'진행중',-2,'신청서 입력 항목과 오류 메시지 개선'],
      ['AI 추천 서비스 신규 화면','AI고용서비스','예시 고객 F',['성아미','김민재'],'대기',7,'추천 결과 화면 기획 및 디자인'],
      ['교육과정 상세페이지 접근성 점검','능력개발서비스','예시 고객 G',['김무현','임정규'],'완료',-3,'키보드 이동과 스크린리더 안내 점검'],
      ['외국인 고용 안내 콘텐츠 정비','외국인고용서비스','예시 고객 H',['김아영','김다솔'],'진행중',3,'다국어 안내 콘텐츠 레이아웃 정리']
    ];
    return {schemaVersion:1,revision:0,demo:true,accounts:{},projects:rows.map((r,i)=>({id:'sample:'+i,source:'sample',title:r[0],customer:r[1],requester:r[2],assignees:r[3],status:r[4],category1:i===3||i===7?'콘텐츠':'UX',category2:i===3?'뉴스레터 정기':'PC&MO',requested:d(-10+i),requestedDue:d(r[5]+2),started:d(-10+i),due:d(r[5]),description:r[6],link:'',tasks:r[3].map(name=>({id:uid(),role:['김다솔','최지안','홍소영','김민재','최완이'].includes(name)?'디자인':['김무현','임정규'].includes(name)?'퍼블':'기획',assignees:[name],started:d(-10+i),due:d(r[5]),status:r[4],notes:r[6]})),logs:[{id:uid(),date:d(-i%4),author:r[3][0],content:r[6]}]}))};
  }

  function addSamples(s){
    const next=upgrade(structuredClone(s)),sample=C.sampleState();
    for(const p of sample.projects){const id='preview:'+p.id;if(!next.projects.some(x=>x.id===id))next.projects.push({...p,id,source:'manual',sampleFixture:true,title:'[샘플] '+p.title});}
    const ranges=weekRanges('2026-10-23'),day=(start,n)=>{const d=new Date(start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
    for(const [index,m] of next.members.filter(m=>m.active!==false).entries()){
      next.personal[m.name]??=[];
      const items=[{id:'preview:week:'+m.name,title:'[샘플] 이번 주 업무 점검',date:'2026-10-23',time:'10:00',content:'진행 중 과업과 고객 피드백을 확인합니다.',done:false},{id:'preview:next:'+m.name,title:'[샘플] 다음 주 협업 회의',date:day(ranges[1].start,index%5),time:'14:00',content:'마감 일정과 역할 분담을 정리합니다.',done:false},{id:'preview:memo:'+m.name,title:'[샘플] 확인할 사항',date:'',time:'',content:'접근성 점검\n공통 컴포넌트 검토\n요청 변경사항 확인',done:false}];
      for(const i of items)if(!next.personal[m.name].some(x=>x.id===i.id))next.personal[m.name].push({...i,sampleFixture:true});
      const id='preview:leave:'+m.name;if(!next.leaves.some(l=>l.id===id)){const date=day(ranges[1].start,index%5);next.leaves.push({id,owner:m.name,start:date,end:date,type:index%2?'오후 반차':'연차',note:'화면 확인용 샘플 휴가',sampleFixture:true});}
    }return next;
  }

C.sampleState=sampleState;P.addSamples=addSamples;return {C,P};}if(typeof module!=='undefined')module.exports={install};else install(root.BoardCore,root.BoardPeople);})(typeof window!=='undefined'?window:globalThis);