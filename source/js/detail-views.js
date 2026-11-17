(function(root){
 'use strict';
 const Icons=typeof module!=='undefined'?require('./arrow-icons.js'):root.BoardArrowIcons;
 const Avatars=typeof module!=='undefined'?require('./avatar-catalog.js'):root.BoardAvatars;
 function create({C,P,W,B,N,esc,button,options,member,weekBlocks,samplePostAvatar=()=>undefined}){
  const characters=Avatars.characters;
  const characterKey=value=>characters.some(([key])=>key===value)?value:'yongyong';
  const characterFile=value=>characters.find(c=>c[0]===characterKey(value))[2];
  function characterImage(key,width,height){
    return '<img src="'+esc(Avatars.src(characterFile(key)))+'" alt="" aria-hidden="true" width="'+width+'" height="'+height+'">';
  }
  const team=t=>esc(N.teamLabel(t));
  function leaves(state,user,rows,mode='person'){rows=rows.slice().sort((a,b)=>mode==='date'?b.start.localeCompare(a.start)||P.compareNames(state,a.owner,b.owner):P.compareNames(state,a.owner,b.owner)||b.start.localeCompare(a.start));return '<div class="table-wrap"><table class="leave-table"><caption class="sr-only">휴가 일정</caption><thead><tr>'+['팀','이름','직급','연차구분','연차 기간','편집'].map(t=>'<th scope="col">'+t+'</th>').join('')+'</tr></thead><tbody>'+rows.map(l=>'<tr><td>'+team(member(l.owner)?.team||'—')+'</td><td>'+esc(l.owner)+'</td><td>'+esc(member(l.owner)?.rank||'미지정')+'</td><td><span class="leave-type-badge">'+esc(l.type)+'</span></td><td class="leave-date-cell">'+esc(l.start)+(l.end!==l.start?' ~ '+esc(l.end):'')+'</td><td>'+(P.canEditLeave(state,user.name,l.owner)?button('editLeave','편집','','data-id="'+esc(l.id)+'"'):'—')+'</td></tr>').join('')+(rows.length?'':'<tr><td colspan="6" class="empty">등록된 휴가가 없습니다.</td></tr>')+'</tbody></table></div>';}
  function today(state,user){const date=C.today(),items=P.schedule(state,user.name,{start:date,end:date}),due=state.projects.map(C.effective).filter(p=>p.due===date&&p.status!=='완료'&&p.assignees.includes(user.name));return '<section class="card"><div class="sectionhead"><h2>'+date+' 오늘 일정</h2>'+button('newMemo','＋ 일정 추가','primary')+'</div><div class="agenda-list">'+items.map(i=>'<article class="agenda-item"><div><small>'+esc(i.time||'종일')+' · '+esc(i.owner)+'</small>'+(i.projectId?button('boardDetail',esc(i.title),'project-button','data-id="'+esc(i.projectId)+'"'):'<strong>'+esc(i.title)+'</strong>')+'</div>'+weekBlocks(i.date,i.done)+'</article>').join('')+due.map(p=>'<article class="agenda-item"><div><small>오늘 마감</small>'+button('boardDetail',esc(p.title),'project-button','data-id="'+esc(p.id)+'"')+'</div>'+weekBlocks(p.due)+'</article>').join('')+(!items.length&&!due.length?illustratedHint(user.avatar,'오늘 등록된 일정과 마감 과업이 없어요','필요한 일정은 위의 일정 추가 버튼으로 등록하세요.'):'')+'</div></section>';}
  function postTypeLabel(post){
    const type=B.typeOf(post);
    if(type==='전체공지')return '공통';
    if(type==='팀별공지')return '팀 공지';
    return B.TABS.find(([key])=>key===post.team)?.[1]||post.team;
  }
  function postDate(post){
    const date=new Date(post.createdAt);
    return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  }
  function postByline(post,showTeam=false){
    const person=member(post.author),authorTeam=person?.team||post.team;
    const avatar=samplePostAvatar(post)||person?.avatar;
    const teamLabel=showTeam&&authorTeam?'<span class="bulletin-author-team"> · '+team(authorTeam)+'</span>':'';
    return '<span class="post-byline">'+characterImage(avatar,24,24)+'<strong>'+esc(post.author)+teamLabel+'</strong></span>';
  }
  function board(state,user,selected,postId){
    const allowed=selected==='all'||selected==='common'||B.canRead(state,user.name,selected);
    const posts=B.boardPosts(state,user.name,selected);
    const active=posts.find(post=>post.id===postId)||posts[0];
    const tabs=B.TABS.map(([key,label])=>button('boardTeam',label,selected===key?'active':'','data-team="'+esc(key)+'" aria-pressed="'+(selected===key)+'"')).join('');
    const headers=['순번','구분','<span class="sr-only">공지</span>','제목','작성자','작성일자'];
    const rows=posts.map((post,index)=>{
      const date=postDate(post);
      const notice=B.typeOf(post)!=='일반글'?'<span class="tossface" aria-hidden="true">📢</span><span class="sr-only">공지</span>':'';
      const title=esc(post.title);
      return '<tr data-action="postDetail" data-id="'+esc(post.id)+'"><td>'+(posts.length-index)+'</td><td>'+esc(postTypeLabel(post))+'</td><td class="bulletin-notice">'+notice+'</td><td>'+button('postDetail',title,'project-button','data-id="'+esc(post.id)+'" title="'+title+'" aria-controls="bulletinDetail" aria-pressed="'+(post.id===active?.id)+'"')+'</td><td>'+postByline(post)+'</td><td><time datetime="'+esc(date==='—'?'':date)+'">'+esc(date)+'</time></td></tr>';
    }).join('');
    const empty=allowed?illustratedHint(user.avatar,'등록된 게시글이 없습니다.'):'<p class="empty">이 팀 게시판은 해당 팀원과 관리자만 볼 수 있습니다.</p>';
    return '<section class="card bulletin-board"><div class="bulletin-toolbar"><div class="tabs" role="group" aria-label="게시판 범위">'+tabs+'</div>'+(allowed?button('newPost','＋ 글 작성','primary'):'')+'</div><div class="bulletin-split"><div class="table-wrap bulletin-table-wrap" tabindex="0" aria-label="게시글 목록"><table class="bulletin-table"><caption class="sr-only">게시글 목록</caption><thead><tr>'+headers.map(header=>'<th scope="col">'+header+'</th>').join('')+'</tr></thead><tbody>'+(rows||'<tr><td colspan="6">'+empty+'</td></tr>')+'</tbody></table></div><section id="bulletinDetail" class="bulletin-pane" aria-label="게시글 상세">'+(active?postDetail(state,user,active.id):'<p class="empty">표시할 게시글이 없습니다.</p>')+'</section></div></section>';
  }
  function postDetail(state,user,id){
    const post=(state.teamPosts||[]).find(item=>item.id===id);
    if(!post||!B.canViewPost(state,user.name,post))throw Error('게시글을 볼 권한이 없습니다.');
    const data='data-id="'+esc(id)+'"';
    const edit=B.canEdit(state,user.name,post)?button('editPost','수정','bulletin-edit',data):'';
    return '<article class="bulletin-detail"><header><div class="bulletin-heading"><span class="post-type">'+esc(postTypeLabel(post))+'</span><h2>'+esc(post.title)+'</h2></div><div class="bulletin-meta">'+postByline(post,true)+'<time>'+esc(postDate(post))+'</time>'+edit+'</div></header><p class="bulletin-content">'+esc(post.content)+'</p>'+postComments(post)+'</article>';
  }
  const commentClock=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  function commentTime(comment){
    const date=new Date(comment.createdAt);
    return Number.isNaN(date.getTime())?'<span>—</span>':'<time datetime="'+esc(date.toISOString())+'">'+esc(postDate(comment)+', '+commentClock.format(date))+'</time>';
  }
  function commentComposer(postId,parentId=''){
    const id=parentId?'postReplyForm-'+parentId:'postCommentForm';
    const label=parentId?'답글':'댓글';
    return '<form id="'+esc(id)+'" class="bulletin-comment-form"><input type="hidden" name="id" value="'+esc(postId)+'">'+(parentId?'<input type="hidden" name="parentId" value="'+esc(parentId)+'">':'')+'<div class="bulletin-comment-input"><input type="text" name="content" aria-label="'+label+'" maxlength="2000" required placeholder="'+label+'을 입력하세요"><button class="primary" type="submit">'+label+' 등록</button></div><p class="error" role="alert"></p></form>';
  }
  function postComments(post){
    const comments=post.comments||[];
    const replies=new Map(),roots=[];
    for(const comment of comments){
      if(!comment.parentId){roots.push(comment);continue;}
      if(!replies.has(comment.parentId))replies.set(comment.parentId,[]);
      replies.get(comment.parentId).push(comment);
    }
    const pending=roots.reverse().map(comment=>({comment,parent:null,depth:0}));
    const list=[];
    while(pending.length){
      const {comment,parent,depth}=pending.pop();
      const children=replies.get(comment.id)||[];
      for(let index=children.length-1;index>=0;index--)pending.push({comment:children[index],parent:comment,depth:depth+1});
      const marker=parent?'<span class="bulletin-reply-marker" aria-hidden="true">'+Icons.arrow('reply')+'</span>':'';
      const target=parent?'<span class="bulletin-reply-target">'+esc(parent.author)+'<span class="sr-only">에게 답글</span></span>':'';
      list.push('<li class="'+(parent?'bulletin-reply':'bulletin-root-comment')+'" data-comment-id="'+esc(comment.id)+'" tabindex="-1" style="--reply-indent:'+Math.min(depth,7)*16+'px">'+
        '<div class="bulletin-comment-meta">'+marker+postByline(comment,true)+commentTime(comment)+'</div><p>'+target+esc(comment.content)+'</p>'+
        '<details class="bulletin-reply-form" name="bulletin-reply"><summary>답글</summary>'+commentComposer(post.id,comment.id)+'</details></li>');
    }
    return '<section class="bulletin-comments" aria-labelledby="bulletinCommentsTitle"><h3 id="bulletinCommentsTitle">댓글 <span>'+comments.length+'</span></h3>'+(list.length?'<ol>'+list.join('')+'</ol>':'<p class="muted">아직 댓글이 없습니다.</p>')+commentComposer(post.id)+'</section>';
  }
  function postTypeOptions(selected){
    const labels={'일반글':'일반글','팀별공지':'팀 공지','전체공지':'공통'};
    return B.TYPES.map(type=>'<option value="'+type+'"'+(selected===type?' selected':'')+'>'+labels[type]+'</option>').join('');
  }
  function postForm(state,user,selected,id){const p=(state.teamPosts||[]).find(x=>x.id===id)||{id:'',team:selected,title:'',content:'',pinned:false,...(selected==='common'?{team:user.team,type:'전체공지'}:{})};if(p.id&&!B.canEdit(state,user.name,p))throw Error('편집 권한이 없습니다.');return '<div class="modal-head"><h2>'+team(p.team)+' 게시글 '+(p.id?'수정':'작성')+'</h2>'+button('close','닫기')+'</div><form id="postForm"><div class="modal-body"><input type="hidden" name="id" value="'+esc(p.id)+'"><input type="hidden" name="team" value="'+esc(p.team)+'"><label class="field">제목<input name="title" maxlength="150" required value="'+esc(p.title)+'"></label><label class="field">내용<textarea name="content" maxlength="20000" rows="10" required>'+esc(p.content)+'</textarea></label><fieldset class="bulletin-notice-settings"><legend>공지 설정</legend><label class="field">글 구분<select name="type" required>'+postTypeOptions(B.typeOf(p))+'</select></label><label><input type="checkbox" name="pinned" '+(p.pinned?'checked':'')+'> 상단 고정</label></fieldset><p class="muted">내용 저장을 누르면 공용 통합관리 파일에 반영됩니다.</p><div id="postError" class="error" role="alert"></div></div><div class="modal-foot">'+(p.id?button('deletePost','삭제','danger','data-id="'+esc(p.id)+'"'):'')+button('close','취소')+'<button class="primary">게시글 저장</button></div></form>';}
  function connection(health){return '<div class="connection workspace-tools connection-statuses" aria-label="폴더 연결 상태">'+[['원본',health.source,'source'],['저장',health.target,'target']].map(([name,ok,key])=>button('connections','<span class="status-circle '+(ok?'online':'offline')+'" aria-hidden="true"></span>'+name+' '+(ok?'연결중':'연결안됨')+'<span class="reconnect-icon" aria-hidden="true">'+Icons.arrow('refresh')+'</span>','connection-status '+(ok?'is-connected':'needs-connection'),'data-connection="'+key+'" aria-label="'+name+' '+(ok?'연결됨':'연결 안 됨')+' · 연결 관리" title="'+name+' 폴더 연결 확인 및 재연결"')).join('')+'</div>';}
  function illustratedHint(character,title,detail=''){const file=characterFile(character);return '<div class="illustrated-hint">'+characterImage(character,64,72)+'<div><strong>'+esc(title)+'</strong>'+(detail?'<p>'+esc(detail)+'</p>':'')+'</div></div>';}
  function avatar(user){const key=characterKey(user.avatar),name=characters.find(c=>c[0]===key)[1];return button('avatarSettings',characterImage(key,38,38),'avatar character-avatar','aria-label="내 캐릭터 변경: '+esc(name)+'" title="내 캐릭터 변경"');}
  function avatarPicker(user){return '<div class="modal-head"><h2>내 캐릭터 선택</h2>'+button('close','닫기')+'</div><div class="modal-body"><p>프로필에 표시할 캐릭터를 선택하세요.</p>'+button('addAvatar','＋ 캐릭터 추가','primary')+'<div class="avatar-choices">'+characters.map(([key,name])=>button('setAvatar',characterImage(key,100,110)+'<strong>'+esc(name)+'</strong>','avatar-choice','data-avatar="'+key+'" aria-pressed="'+((user.avatar||'yongyong')===key)+'"')).join('')+'</div><p class="muted">선택은 본인에게만 적용됩니다. 내용 저장을 누르면 통합관리 파일에 반영됩니다.</p></div>';}
  return {leaves,today,board,postDetail,postForm,connection,illustratedHint,avatar,avatarPicker};
 }
 const api={create};if(typeof module!=='undefined')module.exports=api;else root.BoardDetailViews=api;
})(typeof window!=='undefined'?window:globalThis);
