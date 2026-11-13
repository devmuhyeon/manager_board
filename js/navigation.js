(function(root){
 'use strict';
 const groups=[{items:[['dashboard','🏠','홈'],['work','📁','업무관리']]},{label:'메모',items:[['memo','📝','개인 메모'],['board','📌','팀 게시판']]},{label:'일정관리',items:[['today','📅','오늘 일정'],['schedule','📆','주간 일정'],['deadlines','⏰','마감 일정'],['leaves','🌴','휴가 일정']]},{label:'업무 관리',items:[['revisions','🔁','과업 완료 후 수정사항'],['users','👤','사용자별'],['customers','🏢','고객별'],['projects','📋','과업별'],['report','📊','주간 업무보고']]},{items:[['people','👥','인원관리'],['settings','🔗','데이터 연결']]}];
 const titles=Object.fromEntries(groups.flatMap(g=>g.items.map(([key,,name])=>[key,name])));
 const teamLabel=value=>value==='퍼블'?'퍼블리싱':value;
 const defaults=[{label:'W24DG',url:''},{label:'고용24 테스트서버',url:''},{label:'퍼블리셔 작업문서',url:''}];
 function cleanLinks(input){if(!Array.isArray(input)||input.length>4)throw Error('바로가기는 최대 4개까지 등록하세요.');return input.map(l=>{const label=String(l.label||'').trim(),url=String(l.url||'').trim();if(!label||label.length>40)throw Error('사이트 이름은 1~40자로 입력하세요.');if(url){let u;try{u=new URL(url);}catch{throw Error('올바른 사이트 주소를 입력하세요.');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('http 또는 https 주소만 사용할 수 있습니다.');}return {label,url};});}
 const sections=[['schedule','일정관리',['schedule','deadlines']],['reports','조회·보고',['report','customers','projects']],['personal','개인관리',['memo','leaves']],['team','조직관리',['board','people']]];
 function menu({page,canPersonnel,esc,button,closed=[]}){
  const all=groups.flatMap(group=>group.items);
  const labels={report:'주간 업무',customers:'고객별'};
  const item=key=>{const entry=all.find(item=>item[0]===key);if(!entry||(key==='people'&&!canPersonnel))return '';const [,icon,name]=entry,title=labels[key]||name;return button('page','<span class="tossface" aria-hidden="true">'+icon+'</span><span class="nav-label">'+title+'</span>',page===key?'active':'','data-page="'+key+'" aria-label="'+esc(title)+'" title="'+esc(title)+'" '+(page===key?'aria-current="page"':''));};
  return '<div class="nav-section">'+item('dashboard')+'</div><div class="nav-section">'+item('work')+'</div>'+sections.map(([id,title,keys])=>'<div class="nav-section">'+button('navSection','<span class="nav-label">'+title+'</span><span aria-hidden="true">'+(closed.includes(id)?'⌄':'⌃')+'</span>','nav-parent','data-section="'+id+'" aria-expanded="'+!closed.includes(id)+'" aria-controls="nav-'+id+'"')+'<div id="nav-'+id+'" class="nav-children'+(closed.includes(id)?' is-collapsed':'')+'"'+(closed.includes(id)?' inert':'')+' aria-hidden="'+closed.includes(id)+'"><div class="nav-children-inner">'+keys.map(item).join('')+'</div></div></div>').join('');
 }
 const api={menu,groups,titles,teamLabel,defaults,cleanLinks};if(typeof module!=='undefined')module.exports=api;else root.BoardNavigation=api;
})(typeof window!=='undefined'?window:globalThis);
