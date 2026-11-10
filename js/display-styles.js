(function(root){
 'use strict';
 const catalog=[
  ['01','clean','워크 플레이스 · 개편안','네이비 탐색 영역과 또렷한 업무 표'],
  ['02','navy','네이비 데스크','짙은 탐색 영역과 단정한 작업 공간'],
  ['03','top','탑 내비게이션','한 줄 상단바의 메뉴로 넓게 쓰는 본문'],
  ['04','compact','컴팩트 시트','간격을 줄여 많은 업무를 한눈에'],
  ['05','soft','소프트 카드','둥근 카드와 부드러운 개인 작업 공간'],
  ['06','rail','포커스 레일','작은 아이콘 메뉴와 넓은 본문'],
  ['07','kanban','칸반 스튜디오','실제 과업을 진행 상태별 카드로 확인'],
  ['08','briefing','팀 브리핑','팀 소식과 업무 현황, 주간 일정을 함께'],
  ['09','timeline','타임라인 플래너','이번 주 마감을 날짜별로 확인'],
  ['10','midnight','미드나이트','짙은 네이비 바탕의 다크 화면']
 ].map(([number,id,name,description])=>Object.freeze({number,id,name,description}));
 const KEY='workplace-style',DEFAULT='briefing';
 const valid=id=>catalog.some(s=>s.id===id);
 function create({storage,element}){
  let selected=DEFAULT,theme='light';
  function restore(){try{const saved=storage.getItem(KEY);selected=valid(saved)?saved:DEFAULT;theme=storage.getItem('workplace-theme')==='dark'?'dark':'light';}catch{selected=DEFAULT;theme='light';}paint();return selected;}
  function paint(){element.dataset.style=selected;element.dataset.theme=selected==='midnight'?'dark':theme;}
  function select(id){if(!valid(id))throw Error('화면 스타일을 선택해 주세요.');selected=id;paint();try{storage.setItem(KEY,id);return true;}catch{return false;}}
  function setTheme(dark){theme=dark?'dark':'light';paint();try{storage.setItem('workplace-theme',theme);}catch{}}
  function picker(esc){return '<div class="style-picker" role="group" aria-label="화면 스타일">'+catalog.map(s=>'<button type="button" data-action="displayStyle" data-style="'+s.id+'" aria-pressed="'+(selected===s.id)+'" class="style-choice '+(selected===s.id?'is-selected':'')+'"><span class="style-swatch swatch-'+s.id+'" aria-hidden="true"><i></i><b></b><em></em></span><span><strong>'+esc(s.name)+(s.id===DEFAULT?' · 기본':'')+'</strong><small>'+esc(s.description)+'</small></span><span class="style-check" aria-hidden="true">'+(selected===s.id?'✓':'')+'</span></button>').join('')+'</div>';}
  restore();return {restore,select,setTheme,picker,current:()=>selected};
 }
 function overview({rows,user,C,N,esc,button}){
  const today=C.today();
  const active=rows.filter(project=>!C.isComplete(project.status));
  const metrics=[
   ['전체 과업',rows.length,'all'],
   ['미완료',active.length,'active'],
   ['마감일 경과',active.filter(project=>project.due&&project.due<today).length,'overdue']
  ];
  return '<section class="workspace-overview" aria-labelledby="workspace-overview-title">'
   +'<div class="workspace-overview-intro"><span class="workspace-kicker">'+esc(N.teamLabel(user.team))+' 팀</span>'
   +'<h2 id="workspace-overview-title">'+esc(user.name)+'님의 업무 브리핑</h2>'
   +'<p>전체 과업 현황을 보고, 아래에서 팀 소식과 내 일정을 확인하세요.</p>'
   +button('page','업무 관리 →','primary','data-page="work"')+'</div>'
   +'<dl class="workspace-metrics">'+metrics.map(([label,value,tone])=>
    '<div data-tone="'+tone+'"><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('')+'</dl></section>';
 }
 function home({style,state,user,C,B,N,esc,button,badge,hint,table,orderNames=names=>names}){
  const rows=state.projects.map(C.effective);
  const open=p=>button('edit',esc(p.title),'project-button','data-id="'+esc(p.id)+'"');
  if(style==='briefing'){
   const posts=B.list(state,user.name,user.team).slice(0,3);
   return '<section class="card briefing-news"><div class="sectionhead"><h2>'+esc(N.teamLabel(user.team))+' 팀 브리핑</h2>'+button('page','팀 게시판 →','','data-page="board"')+'</div><div class="briefing-posts">'+(posts.map(p=>'<article><span class="origin-label">'+esc(B.typeOf(p))+'</span><h3>'+esc(p.title)+'</h3><p>'+esc(p.content)+'</p><small>'+esc(p.author)+' · '+esc(p.updatedAt.slice(0,10))+'</small></article>').join('')||hint(user.avatar,'팀의 첫 소식을 남겨보세요','팀 게시판에서 공지와 작업 소식을 공유할 수 있어요.'))+'</div></section><section class="card style-work-panel"><div class="sectionhead"><h2>진행 중인 과업</h2>'+button('page','전체 업무 →','','data-page="work"')+'</div>'+table(rows.filter(p=>!C.isComplete(p.status)).slice(0,6))+'</section>';
  }
  if(style==='kanban')return '<section class="card style-work-panel"><div class="sectionhead"><h2>과업 진행 보드</h2>'+button('page','전체 업무 →','','data-page="work"')+'</div><div class="live-kanban">'+['접수','진행중','완료','완료 후 수정','운영반영완료','보류'].map(status=>{const items=rows.filter(p=>({'예정':'접수','대기':'접수','검토중':'진행중'}[p.status]||p.status)===status);return '<section class="kanban-lane"><h3>'+badge(status)+'<span class="count">'+items.length+'</span></h3>'+items.map(p=>'<article>'+open(p)+'<small>'+esc(orderNames(p.assignees||[]).join(', ')||'미배정')+'</small><time>'+esc(p.due||'마감일 없음')+'</time></article>').join('')+(items.length?'':'<p class="muted">등록된 과업이 없습니다.</p>')+'</section>';}).join('')+'</div></section>';
  if(style==='timeline'){
   const today=C.today(),monday=new Date(today+'T12:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
   const days=Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);});
   return '<section class="card style-work-panel"><div class="sectionhead"><h2>이번 주 과업 마감</h2><span class="muted">'+days[0]+' — '+days[6]+'</span></div><div class="live-timeline">'+days.map((day,i)=>{const items=rows.filter(p=>p.due===day);return '<section class="timeline-day '+(day===today?'is-today':'')+'"><h3>'+['월','화','수','목','금','토','일'][i]+' <time datetime="'+day+'">'+day.slice(5).replace('-','.')+'</time></h3>'+items.map(p=>'<article>'+badge(p.status)+open(p)+'<small>'+esc(orderNames(p.assignees||[]).join(', ')||'미배정')+'</small></article>').join('')+(items.length?'':'<p class="muted">마감 없음</p>')+'</section>';}).join('')+'</div></section>';
  }
  return '';
 }
 function shell(html,style){if(style!=='top')return html;const sidebar=html.match(/<aside class="sidebar">[\s\S]*?<\/aside>/);if(!sidebar)return html;return html.replace(sidebar[0],'').replace('<header class="topbar">','<header class="topbar"><details class="top-navigation"><summary aria-label="주 메뉴 열기">☰ 메뉴</summary>'+sidebar[0]+'</details>');}
 const api={catalog,KEY,DEFAULT,valid,create,overview,home,shell};if(typeof module!=='undefined')module.exports=api;else root.BoardDisplayStyles=api;
})(typeof window!=='undefined'?window:globalThis);
