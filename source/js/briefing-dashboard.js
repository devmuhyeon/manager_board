(function(root){
 'use strict';
 function schedule(state,user,C,P){
  const range=P.weekRanges(),end=range[1].end,items=[];
  for(const memo of state.personal?.[user.name]||[])if(memo.date&&memo.date<=end&&(memo.endDate||memo.date)>=range[0].start)items.push({id:'memo:'+memo.id,title:memo.title,date:memo.date,end:memo.endDate,time:memo.time,kind:'개인 일정',done:memo.done});
  for(const raw of state.projects){if(state.hiddenProjects?.includes(raw.id))continue;const p=C.effective(raw);if(p.assignees.includes(user.name)&&p.due&&!C.isComplete(p.status))items.push({id:'project:'+p.id,projectId:p.id,title:p.title,date:p.due,kind:'프로젝트 마감',done:false});}
  return items.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
 }
 function render({state,user,C,P,B,N,esc,button,table,hint,weekBlocks,leaveItems}){
  const rows=state.projects.filter(p=>!state.hiddenProjects?.includes(p.id)).map(C.effective).filter(p=>!C.isComplete(p.status)),posts=B.list(state,user.name,user.team),items=schedule(state,user,C,P);
  const leaves=state.leaves.filter(l=>l.end>=C.today()&&state.members.find(m=>m.name===l.owner)?.team===user.team).sort((a,b)=>a.start.localeCompare(b.start));
  const head=(title,action,page)=>'<div class="sectionhead"><h2>'+title+'</h2>'+button('page',action,'home-detail-button','data-page="'+page+'"')+'</div>';
  return '<div class="home-panels briefing-panels">'
   +'<section class="card style-work-panel" data-home-section="progress">'+head('진행 중인 과업','전체 업무 →','work')+'<div class="briefing-progress-scroll">'+table(rows)+'</div>'+'</section>'
   +'<section class="card" data-home-section="schedule">'+head('나의 일정','전체 일정 →','schedule')+'<div class="agenda-list briefing-agenda">'+(items.map(i=>'<article class="agenda-item"><div><small>'+esc(i.kind)+' · '+esc(i.date)+(i.end&&i.end!==i.date?' ~ '+esc(i.end):'')+' '+esc(i.time||'')+'</small>'+(i.projectId?button('boardDetail',esc(i.title),'project-button','data-id="'+esc(i.projectId)+'"'):'<strong>'+esc(i.title)+'</strong>')+'</div>'+weekBlocks(i.date,i.done)+'</article>').join('')||hint(user.avatar,'등록된 나의 일정이 없어요','개인 메모에 기간을 지정하면 달력과 함께 표시됩니다.'))+'</div></section>'
   +'<section class="card briefing-news" data-home-section="team">'+head(esc(N.teamLabel(user.team))+' 팀 브리핑','팀 게시판 →','board')+'<div class="briefing-posts">'+(posts.map(p=>'<article><span class="origin-label">'+esc(B.typeOf(p))+'</span><h3>'+esc(p.title)+'</h3><p>'+esc(p.content)+'</p><small>'+esc(p.author)+' · '+esc(p.updatedAt.slice(0,10))+'</small></article>').join('')||hint(user.avatar,'팀의 첫 소식을 남겨보세요','팀 게시판에서 소식을 공유할 수 있어요.'))+'</div></section>'
   +'<section class="card" data-home-section="leaves">'+head('팀 휴가 일정','전체 휴가 →','leaves')+'<div class="agenda-list briefing-agenda">'+leaveItems(leaves)+'</div></section></div>';
 }
 const api={schedule,render};if(typeof module!=='undefined')module.exports=api;else root.BoardBriefingDashboard=api;
})(typeof window!=='undefined'?window:globalThis);
