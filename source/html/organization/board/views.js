(function(root){
 'use strict';
 const Icons=typeof module!=='undefined'?require('../../../js/arrow-icons.js'):root.BoardArrowIcons;
 const Attachments=typeof module!=='undefined'?require('./attachments.js'):root.BoardAttachments;
 function create({C,P,W,B,N,esc,button,options,member,weekBlocks,samplePostAvatar,profileImage,illustratedHint}){
  const team=t=>esc(N.teamLabel(t));
  function postTypeLabel(post){
    const type=B.typeOf(post);
    if(post.category==='common'||type==='전체공지')return '공통';
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
    return '<span class="post-byline">'+profileImage({...person,avatar},24,24)+'<strong>'+esc(post.author)+teamLabel+'</strong></span>';
  }
  function board(state,user,selected,postId){
    const allowed=selected==='all'||selected==='common'||B.canRead(state,user.name,selected);
    const posts=B.boardPosts(state,user.name,selected);
    const active=posts.find(post=>post.id===postId)||posts[0];
    const tabs=[...B.TABS.slice(0,2),...P.orderedTeams(state).map(team=>B.TABS.find(([key])=>key===team))].map(([key,label])=>button('boardTeam',label,selected===key?'active':'','data-team="'+esc(key)+'" aria-pressed="'+(selected===key)+'"')).join('');
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
    return '<article class="bulletin-detail"><header><div class="bulletin-heading"><span class="post-type">'+esc(postTypeLabel(post))+'</span><h2>'+esc(post.title)+'</h2></div><div class="bulletin-meta">'+postByline(post,true)+'<time>'+esc(postDate(post))+'</time>'+edit+'</div></header><p class="bulletin-content">'+esc(post.content)+'</p>'+Attachments.render(post.attachments,esc)+postComments(post,user)+'</article>';
  }
  const commentClock=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  function commentTime(comment){
    const date=new Date(comment.createdAt);
    return Number.isNaN(date.getTime())?'<span>—</span>':'<time datetime="'+esc(date.toISOString())+'">'+esc(postDate(comment)+' '+commentClock.format(date))+'</time>';
  }
  function commentComposer(postId,parentId=''){
    const id=parentId?'postReplyForm-'+parentId:'postCommentForm';
    const label=parentId?'답글':'댓글';
    return '<form id="'+esc(id)+'" class="bulletin-comment-form"><input type="hidden" name="id" value="'+esc(postId)+'">'+(parentId?'<input type="hidden" name="parentId" value="'+esc(parentId)+'">':'')+'<div class="bulletin-comment-input"><label class="comment-attach-button" title="이미지 첨부"><span aria-hidden="true">＋</span><input type="file" name="attachments" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" multiple aria-label="'+label+' 이미지 첨부"></label><input type="text" name="content" aria-label="'+label+'" maxlength="2000" placeholder="'+label+'을 입력하세요"><button class="primary" type="submit">'+label+' 등록</button></div><output class="attachment-selection" aria-live="polite"></output><p class="error" role="alert"></p></form>';
  }
  function postComments(post,user){
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
        '<div class="bulletin-comment-meta">'+marker+postByline(comment,true)+commentTime(comment)+(comment.author===user.name&&!children.length?button('editComment',Icons.arrow('edit'),'people-icon-button','data-id="'+esc(post.id)+'" data-comment-id="'+esc(comment.id)+'" aria-label="댓글 수정"'):'')+'</div><p>'+target+esc(comment.content)+'</p>'+Attachments.render(comment.attachments,esc)+
        '<details class="bulletin-reply-form" name="bulletin-reply"><summary><span class="reply-open-label">답글 달기</span><span class="reply-close-label">답글 닫기</span></summary>'+commentComposer(post.id,comment.id)+'</details></li>');
    }
    return '<section class="bulletin-comments" aria-labelledby="bulletinCommentsTitle"><h3 id="bulletinCommentsTitle">댓글 <span>'+comments.length+'</span></h3>'+(list.length?'<ol>'+list.join('')+'</ol>':'<p class="muted">아직 댓글이 없습니다.</p>')+commentComposer(post.id)+'</section>';
  }
  function postTypeOptions(selected){
    const labels={'일반글':'일반글','팀별공지':'팀 공지','전체공지':'공통'};
    return B.TYPES.map(type=>'<option value="'+type+'"'+(selected===type?' selected':'')+'>'+labels[type]+'</option>').join('');
  }
  function postForm(state,user,selected,id){
    const p=(state.teamPosts||[]).find(x=>x.id===id)||{id:'',team:selected==='all'?user.team:selected,title:'',content:'',pinned:false};
    if(p.id&&!B.canEdit(state,user.name,p))throw Error('편집 권한이 없습니다.');
    const category=p.category==='common'||B.typeOf(p)==='전체공지'||p.team==='common'?'common':p.team;
    return '<div class="modal-head"><h2>게시글 '+(p.id?'수정':'작성')+'</h2>'+button('close','닫기')+'</div><form id="postForm"><div class="modal-body board-post-editor">'+
      '<input type="hidden" name="id" value="'+esc(p.id)+'"><label class="field">구분<select name="category">'+[['common','공통'],...P.orderedTeams(state).filter(t=>B.canRead(state,user.name,t)).map(t=>[t,N.teamLabel(t)])].map(([key,label])=>'<option value="'+key+'" '+(category===key?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label>'+
      '<label class="field">제목<input name="title" maxlength="150" required value="'+esc(p.title)+'"></label><label class="field">내용<textarea name="content" maxlength="20000" rows="8" required>'+esc(p.content)+'</textarea></label>'+
      '<label class="field">첨부파일<input name="attachments" type="file" multiple accept=".png,.jpg,.jpeg,.gif,.webp,.avif,.mp4,.webm,.ogv,.zip,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.hwpx"></label><output class="attachment-selection" aria-live="polite"></output>'+Attachments.render(p.attachments,esc)+
      (p.attachments?.length?'<label class="remember-check"><input type="checkbox" name="clearAttachments"> 기존 첨부파일 모두 제거</label>':'')+
      '<p class="muted">파일당 20MB, 최대 10개 · 이미지, 동영상, ZIP, 문서</p><div id="postError" class="error" role="alert"></div></div><div class="modal-foot board-post-footer"><label class="remember-check"><input type="checkbox" name="pinned" aria-label="공지 설정" role="switch" '+(p.pinned||B.typeOf(p)==='팀별공지'?'checked':'')+'> 공지</label><div class="actions">'+
      (p.id?button('deletePost','삭제','danger','data-id="'+esc(p.id)+'"'):'')+button('close','취소')+'<button class="primary">'+(p.id?'저장':'등록')+'</button></div></div></form>';
  }

 return {board,postDetail,postForm};
 }
 const api={create};if(typeof module!=='undefined')module.exports=api;else root.BoardBulletinViews=api;
})(typeof window!=='undefined'?window:globalThis);
