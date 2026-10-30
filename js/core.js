(function (root) {
  'use strict';
  const MEMBERS = [
    ['성아미','기획','차장'],['정윤정','기획','대리'],['임정규','퍼블','차장'],['김무현','퍼블','대리'],
    ['홍소영','디자인','과장'],['김민재','디자인','대리'],['최완이','디자인','대리'],
    ['김아영','콘텐츠','대리'],['김다솔','콘텐츠','대리'],['최지안','콘텐츠','대리']
  ].map(([name,team,rank])=>({name,team,rank}));
  let roster=MEMBERS;
  const setMembers=members=>{roster=members||MEMBERS;};
  const TEAMS = ['기획','퍼블','디자인','콘텐츠'];
  const CUSTOMERS = ['고용24대민포털','고용24행정포털','취업지원서비스1','취업지원서비스2','고용보험서비스','능력개발서비스','외국인고용서비스','AI고용서비스','시스템운영','데이터지원'];
  const STATUSES = ['예정','대기','진행중','검토중','완료','보류'];
  const text = v => v == null ? '' : Array.isArray(v) ? v.map(text).join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const pick = (o, keys) => { for (const k of keys) if(o[k] != null && o[k] !== '') return o[k]; return ''; };
  const date = v => { const s=text(v).trim(); const m=s.match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };
  const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  function names(value) {
    const s=text(value);return roster.filter(m=>s.includes(m.name)).map(m=>m.name);
  }
  function normalize(row) {
    if (!row || typeof row!=='object' || Array.isArray(row)) throw new Error('요청 목록에 올바르지 않은 항목이 있습니다.');
    const nested = pick(row,['처리결과','처리정보']);
    const r={...row,...(nested && typeof nested==='object' ? nested : {})};
    const title=text(pick(r,['프로젝트명','과업명','요청제목','제목','요청명','사업명','title','name']));
    if(!title) throw new Error('프로젝트 제목을 찾을 수 없습니다. 프로젝트명·요청제목·제목 필드를 확인해 주세요.');
    const customer=text(pick(r,['요청팀','고객팀','customer']));
    const requester=text(pick(r,['요청자','requester']));
    const requested=date(pick(r,['요청일','요청일자','requested']));
    const key=text(pick(r,['id','ID','요청ID','요청번호','프로젝트ID','폴더명','프로젝트폴더','folderName'])) || JSON.stringify([title,customer,requester,requested]);
    const rawStatus=text(pick(r,['상태','진행상태','처리상태','status'])).replace(/\s/g,'');
    const status=STATUSES.includes(rawStatus)?rawStatus:rawStatus.includes('완료')?'완료':rawStatus.includes('검토')?'검토중':rawStatus.includes('진행')?'진행중':'대기';
    const workKeys=['작업내용','작업 내용','작업내용_기획','작업내용_디자인','작업내용_퍼블','기획작업내용','디자인작업내용','퍼블작업내용','description'];
    const description=workKeys.filter(k=>r[k]).map(k=>text(r[k])).join('\n') || text(pick(r,['요청사항','요청내용']));
    const tasks=['기획','디자인','퍼블'].filter(role=>r['담당자_'+role]).map(role=>({id:'source-task:'+role,role,assignees:names(r['담당자_'+role]),started:date(r['시작일_'+role]||r.시작일),due:date(r['마감일_'+role]||r.마감일),status,notes:text(r['작업내용_'+role]||r[role+'작업내용']||'')}));
    return {id:'source:'+key,source:'import',title,customer,requester,requested,category1:text(r.구분1),category2:text(r.구분2),requestedDue:date(pick(r,['요청완료일','완료요청일','완료요청일자'])),started:date(r.시작일),due:date(pick(r,['마감일','due','완료요청일'])),status,tasks,
      assignees:names([r.담당자_기획,r.담당자_디자인,r.담당자_퍼블,r.담당자,r.작업자,r.assignees]),description,
      link:text(pick(r,['작업링크','퍼블링크','퍼블작업링크','퍼블_작업링크','link'])),logs:[],raw:row};
  }
  function importRows(state, input) {
    const arr=Array.isArray(input)?input:pick(input||{},['요청목록','요청관리','requests','projects','data']);
    if(!Array.isArray(arr)) throw new Error('JSON은 요청 배열 또는 requests·projects·data 배열을 포함해야 합니다.');
    const normalized=arr.map(normalize);
    if(new Set(normalized.map(p=>p.id)).size!==normalized.length) throw new Error('중복된 프로젝트 ID가 있습니다. 원본의 식별자를 확인해 주세요.');
    const next=structuredClone(state);next.projects=next.projects.filter(p=>p.source!=='sample');
    let added=0,updated=0;
    for(const p of normalized){const i=next.projects.findIndex(x=>x.id===p.id);if(i<0){next.projects.push(p);added++;}else{
      const old=next.projects[i];next.projects[i]={...p,overrides:old.overrides||{},logs:old.logs||[]};updated++;
    }}
    next.demo=false;next.importedAt=new Date().toISOString();return {state:next,added,updated};
  }
  function effective(p){
    const e={...p,...(p.overrides||{}),id:p.id,source:p.source,logs:p.logs||[]};
    if(e.tasks?.length){
      e.assignees=[...new Set(e.tasks.flatMap(t=>t.assignees))];
      const states=e.tasks.map(t=>t.status);
      e.status=states.every(s=>s==='완료')?'완료':states.includes('진행중')||states.includes('완료')?'진행중':states.includes('검토중')?'검토중':states.includes('보류')?'보류':states.includes('대기')?'대기':'예정';
      const dues=e.tasks.map(t=>t.due).filter(Boolean).sort();if(dues.length)e.due=dues[dues.length-1];
    }
    return e;
  }
  const teamsOf = p => TEAMS.filter(t=>roster.some(m=>m.team===t && p.assignees.includes(m.name)));
  function matchesTask(t,f={}){
    if(f.scope==='personal'&&!t.assignees.includes(f.user))return false;
    if(f.scope==='team'&&!t.assignees.some(n=>roster.some(m=>m.name===n&&m.team===f.team)))return false;
    if(f.teamFilter&&!t.assignees.some(n=>roster.some(m=>m.name===n&&m.team===f.teamFilter)))return false;
    if(f.status&&t.status!==f.status)return false;
    if(f.dateField==='due'&&f.from&&(!t.due||t.due<f.from))return false;
    if(f.dateField==='due'&&f.to&&(!t.due||t.due>f.to))return false;
    return true;
  }
  function filterProjects(projects,f={}) {
    return projects.map(effective).filter(p=>{
      if(f.scope==='personal' && !p.assignees.includes(f.user)) return false;
      if(f.scope==='team' && !teamsOf(p).includes(f.team)) return false;
      if(f.teamFilter && !teamsOf(p).includes(f.teamFilter)) return false;
      if(f.customer && p.customer!==f.customer) return false;
      if(f.requester && p.requester!==f.requester) return false;
      if(f.taskMode&&p.tasks?.length){if(!p.tasks.some(t=>matchesTask(t,f)))return false;}
      else if(f.status && p.status!==f.status) return false;
      if(f.search && ![p.title,p.customer,p.requester,p.description,...p.assignees].join(' ').toLowerCase().includes(f.search.toLowerCase())) return false;
      const d=f.dateField==='due'?p.due:f.dateField==='requestedDue'?p.requestedDue:p.requested;
      if(!(f.taskMode&&p.tasks?.length&&f.dateField==='due')){
        if(f.from && (!d || d<f.from)) return false;
        if(f.to && (!d || d>f.to)) return false;
      }
      return true;
    });
  }
  function reportRows(projects,f={}) {
    return filterProjects(projects,{...f,from:'',to:''}).flatMap(p=>(p.logs||[]).filter(l=>
      (!f.from||l.date>=f.from)&&(!f.to||l.date<=f.to)&&
      (!f.teamFilter||roster.some(m=>m.name===l.author&&m.team===f.teamFilter))&&
      (f.scope!=='personal'||l.author===f.user)&&
      (f.scope!=='team'||roster.some(m=>m.name===l.author&&m.team===f.team))
    ).map(l=>({project:p,...l})));
  }
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
  function classification(p){const platform=String(p.platform??p.category2??'').toUpperCase().replace(/\s/g,'');const taskCategory=p.taskCategory??(['UX','UI','기획','디자인','퍼블','콘텐츠'].includes(p.category1)?p.category1:'');const contentCategory=taskCategory==='콘텐츠'?String(p.contentCategory??(!['PC&MO','PC','MO'].includes(platform)?p.category2||'':'')):'';const contentType=taskCategory==='콘텐츠'?String(p.contentType??p.category3??''):'';const device=['PC&MO','PC','MO'].includes(platform)?platform:'';return {taskCategory,contentCategory,contentType,platform:device,level1:taskCategory||p.category1||'미분류',level2:taskCategory==='콘텐츠'?contentCategory:device,level3:contentType};}
  function cleanClassification(p){if(!['UX','UI','기획','디자인','퍼블','콘텐츠'].includes(p.taskCategory))throw new Error('분류1을 선택해 주세요.');if(p.taskCategory==='콘텐츠'){if(!String(p.contentCategory||'').trim()||!String(p.contentType||'').trim())throw new Error('콘텐츠 분류2와 분류3을 입력해 주세요.');return {taskCategory:p.taskCategory,contentCategory:String(p.contentCategory).trim().slice(0,100),contentType:String(p.contentType).trim().slice(0,100),platform:''};}if(!['PC&MO','PC','MO'].includes(p.platform))throw new Error('분류2에서 PC&MO / PC / MO를 선택해 주세요.');return {taskCategory:p.taskCategory,contentCategory:'',contentType:'',platform:p.platform};}
  function validateState(s){
    if(!s||s.schemaVersion!==1||!Array.isArray(s.projects)||!s.accounts||typeof s.accounts!=='object'||Array.isArray(s.accounts))throw new Error('통합관리 JSON 형식이 올바르지 않습니다.');
    if(!Number.isSafeInteger(s.revision)||s.revision<0)throw new Error('저장 버전이 올바르지 않습니다.');
    const ids=new Set();
    for(const p of s.projects){
      const e=effective(p);
      if(typeof p.id!=='string'||ids.has(p.id)||typeof e.title!=='string'||!Array.isArray(e.assignees)||!Array.isArray(e.logs)||!STATUSES.includes(e.status)||!['sample','import','manual'].includes(p.source))throw new Error('프로젝트 데이터 형식이 올바르지 않습니다.');
      ids.add(p.id);
      if(e.tasks && (!Array.isArray(e.tasks)||e.tasks.some(t=>typeof t.id!=='string'||!Array.isArray(t.assignees)||!STATUSES.includes(t.status))))throw new Error('담당 업무 형식이 올바르지 않습니다.');
      for(const l of e.logs)if(typeof l.id!=='string'||!date(l.date)||typeof l.author!=='string'||typeof l.content!=='string')throw new Error('작업 내역 형식이 올바르지 않습니다.');
    }
    const people=s.members||MEMBERS;
    if(Array.isArray(people)&&people.some(m=>m.avatar!==undefined&&!['yongyong','bbiyak','terriermon','kirby','pikachu','charmander','hamtaro','penguin'].includes(m.avatar)))throw Error('사용자 캐릭터 정보가 올바르지 않습니다.');
    if(s.overallAdmin!==undefined&&(typeof s.overallAdmin!=='string'||!people.some(m=>m.name===s.overallAdmin&&m.active!==false)))throw new Error('전체관리자는 재직자 한 명이어야 합니다.');
    if(s.teamPosts!==undefined){if(!Array.isArray(s.teamPosts)||new Set(s.teamPosts.map(p=>p.id)).size!==s.teamPosts.length||s.teamPosts.some(p=>!p||typeof p.id!=='string'||!TEAMS.includes(p.team)||(p.type!==undefined&&!['전체공지','팀별공지','일반글'].includes(p.type))||typeof p.author!=='string'||typeof p.title!=='string'||typeof p.content!=='string'||typeof p.createdAt!=='string'||typeof p.updatedAt!=='string'))throw new Error('팀 게시판 자료 형식을 확인하세요.');}
    if(s.quickLinks!==undefined&&(!Array.isArray(s.quickLinks)||s.quickLinks.length>4||s.quickLinks.some(l=>!l||typeof l.label!=='string'||typeof l.url!=='string'||(l.url&&!/^https?:\/\//i.test(l.url)))))throw new Error('바로가기 형식을 확인하세요.');
    if(s.contentOptions!==undefined&&(!s.contentOptions||typeof s.contentOptions!=='object'||['level2','level3'].some(k=>!Array.isArray(s.contentOptions[k])||s.contentOptions[k].some(v=>typeof v!=='string'||v.length>100))))throw new Error('콘텐츠 선택 항목 형식이 올바르지 않습니다.');
    if(s.leaveAllowances!==undefined){if(!s.leaveAllowances||typeof s.leaveAllowances!=='object'||Array.isArray(s.leaveAllowances))throw new Error('연차 총수 형식을 확인하세요.');for(const [year,values] of Object.entries(s.leaveAllowances)){if(!/^\d{4}$/.test(year)||!values||typeof values!=='object'||Object.values(values).some(n=>!Number.isFinite(n)||n<0||n>366||n*2%1))throw new Error('연차 총수 형식을 확인하세요.');}}
    if(s.homeLayouts!==undefined&&(!s.homeLayouts||typeof s.homeLayouts!=='object'||Array.isArray(s.homeLayouts)||Object.values(s.homeLayouts).some(order=>!Array.isArray(order)||order.some(k=>!['memo','thisWeek','nextWeek','deadlines','leaves','work'].includes(k)))))throw new Error('홈 배치 정보가 올바르지 않습니다.');
    if(s.teamAdmins!==undefined&&(!Array.isArray(s.teamAdmins)||s.teamAdmins.some(n=>typeof n!=='string'||!people.some(m=>m.name===n))))throw new Error('팀관리자 정보가 올바르지 않습니다.');
    if(s.teamLeaders!==undefined){if(!s.teamLeaders||typeof s.teamLeaders!=='object'||Array.isArray(s.teamLeaders)||Object.entries(s.teamLeaders).some(([team,name])=>!TEAMS.includes(team)||!people.some(m=>m.name===name&&m.team===team&&m.active!==false)))throw new Error('팀장 지정 정보가 올바르지 않습니다.');}
    if(s.leaves!==undefined&&(!Array.isArray(s.leaves)||s.leaves.some(l=>!l||typeof l.id!=='string'||typeof l.owner!=='string'||!date(l.start)||!date(l.end)||!l.start||!l.end||l.start>l.end||!['연차','오전 반차','오후 반차','기타 휴가','추가 사용'].includes(l.type)||typeof l.note!=='string')))throw new Error('휴가 일정 형식이 올바르지 않습니다.');
    if(!Array.isArray(people)||!people.length||new Set(people.map(m=>m.name)).size!==people.length||people.some(m=>typeof m.name!=='string'||!m.name||!TEAMS.includes(m.team)||['__proto__','constructor','prototype'].includes(m.name)))throw new Error('인원 정보가 올바르지 않습니다.');
    if(s.personal){if(typeof s.personal!=='object'||Array.isArray(s.personal))throw new Error('개인 메모 형식이 올바르지 않습니다.');for(const items of Object.values(s.personal))if(!Array.isArray(items)||items.some(i=>!i||typeof i.id!=='string'||typeof i.title!=='string'||typeof i.content!=='string'))throw new Error('개인 메모 형식이 올바르지 않습니다.');}
    for(const key of ['removedMembers','hiddenProjects','customerTeams'])if(s[key]!==undefined&&(!Array.isArray(s[key])||s[key].some(v=>typeof v!=='string')))throw new Error('통합관리 설정 형식이 올바르지 않습니다.');
    for(const [name,a] of Object.entries(s.accounts))if(!people.some(m=>m.name===name)||!a||typeof a.salt!=='string'||typeof a.hash!=='string'||a.iterations!==150000)throw new Error('계정 데이터 형식이 올바르지 않습니다.');
    return s;
  }
    const api={MEMBERS,TEAMS,CUSTOMERS,STATUSES,today,uid,normalize,importRows,effective,teamsOf,matchesTask,filterProjects,reportRows,sampleState,validateState,setMembers,classification,cleanClassification};
  if(typeof module!=='undefined')module.exports=api;else root.BoardCore=api;
})(typeof window!=='undefined'?window:globalThis);
