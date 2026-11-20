(function(root){
 'use strict';
 const P=typeof module!=='undefined'?require('../../../js/personnel.js'):root.BoardPeople;
 const C=typeof module!=='undefined'?require('../../../js/core.js'):root.BoardCore;
 const Attachments=typeof module!=='undefined'?require('./attachments.js'):root.BoardAttachments;
 const TYPES=['전체공지','팀별공지','일반글'];
 const TABS=[['all','전체'],['common','공통'],['기획','기획'],['퍼블','퍼블'],['디자인','디자인'],['콘텐츠','콘텐츠']];
 const typeOf=post=>post.type||'일반글';
 function canRead(s,actor,team){const m=s.members.find(x=>x.name===actor&&x.active!==false);return Boolean(C.TEAMS.includes(team)&&m&&(m.team===team||P.canManage(s,actor)));}
 function canViewPost(s,actor,post){
  if(!s.members.some(member=>member.name===actor&&member.active!==false))return false;
  return post.category==='common'||typeOf(post)==='전체공지'||canRead(s,actor,post.team);
 }
 function canEdit(s,actor,post){return canRead(s,actor,post.team)&&(actor===post.author||P.canManage(s,actor)||P.isLeader(s,actor));}
 function list(s,actor,team){if(!canRead(s,actor,team))throw Error('해당 팀 게시판 접근 권한이 없습니다.');return (s.teamPosts||[]).filter(p=>typeOf(p)==='전체공지'||p.team===team).slice().sort((a,b)=>TYPES.indexOf(typeOf(a))-TYPES.indexOf(typeOf(b))||Number(b.pinned)-Number(a.pinned)||b.updatedAt.localeCompare(a.updatedAt));}
 function boardPosts(s,actor,tab){
  if(!s.members.some(member=>member.name===actor&&member.active!==false))return [];
  const posts=(s.teamPosts||[]).filter(post=>post.category==='common'||typeOf(post)==='전체공지'||canRead(s,actor,post.team))
   .sort((a,b)=>Number(b.pinned)-Number(a.pinned)||TYPES.indexOf(typeOf(a))-TYPES.indexOf(typeOf(b))||b.updatedAt.localeCompare(a.updatedAt));
  let sampleNotices=0;
  return posts.filter(post=>!post.sampleFixture||typeOf(post)==='일반글'||++sampleNotices<=3).filter(post=>{
   if(post.category==='common'||typeOf(post)==='전체공지')return tab==='all'||tab==='common';
   return tab==='all'||tab===post.team;
  });
 }
 function addComment(state,actor,{id,content,parentId,attachments=[]}){
  const posts=state.teamPosts||[];
  const index=posts.findIndex(post=>post.id===id);
  const post=posts[index];
  if(!post||!canViewPost(state,actor,post))throw Error('댓글을 작성할 권한이 없습니다.');
  Attachments.validate(attachments,true);
  const text=String(content||'').trim();
  if((!text&&!attachments.length)||text.length>2000)throw Error('댓글을 1~2,000자로 입력하세요.');
  const comments=post.comments||[];
  if(parentId&&!comments.some(comment=>comment.id===parentId))throw Error('답글을 달 댓글을 찾을 수 없습니다.');
  const comment={id:C.uid(),author:actor,team:state.members.find(member=>member.name===actor).team,content:text,attachments,createdAt:new Date().toISOString(),...(parentId?{parentId}:{})};
  return {...state,teamPosts:posts.map((item,i)=>i===index?{...item,comments:[...comments,comment]}:item)};
 }
 function save(s,actor,input){const old=(s.teamPosts||[]).find(p=>p.id===input.id);if(!canRead(s,actor,input.team)||(old&&!canEdit(s,actor,old)))throw Error('게시글을 변경할 권한이 없습니다.');if(input.id&&!old)throw Error('게시글이 없습니다.');const type=input.type===undefined?typeOf(old||{}):input.type;if(!TYPES.includes(type))throw Error('글 구분을 선택하세요.');const title=String(input.title||'').trim(),content=String(input.content||'').trim();if(!title||title.length>150||!content||content.length>20000)throw Error('제목 1~150자, 내용 1~20,000자를 입력하세요.');Attachments.validate(input.attachments||old?.attachments||[]);const next=structuredClone(s);next.teamPosts??=[];const post={...(old?.sampleFixture?{sampleFixture:true}:{}),...(old?.comments?{comments:structuredClone(old.comments)}:{}),id:old?.id||C.uid(),team:input.team,type,author:old?.author||actor,category:input.category||old?.category||input.team,title,content,attachments:input.attachments||old?.attachments||[],pinned:Boolean(input.pinned),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),updatedBy:actor};if(old)next.teamPosts[next.teamPosts.findIndex(p=>p.id===old.id)]=post;else next.teamPosts.push(post);return next;}
 function remove(s,actor,id){const post=(s.teamPosts||[]).find(p=>p.id===id);if(!post||!canEdit(s,actor,post))throw Error('게시글을 삭제할 권한이 없습니다.');return {...structuredClone(s),teamPosts:s.teamPosts.filter(p=>p.id!==id)};}
 function editComment(state,actor,input){
  const post=state.teamPosts?.find(post=>post.id===input.id),comment=post?.comments?.find(comment=>comment.id===input.commentId);
  if(!post||!canViewPost(state,actor,post)||!comment||comment.author!==actor)throw Error('본인의 댓글만 수정할 수 있습니다.');
  if(post.comments.some(item=>item.parentId===comment.id))throw Error('답글이 달린 댓글은 수정할 수 없습니다.');
  const content=String(input.content||'').trim();if(!content||content.length>2000)throw Error('댓글 내용을 확인하세요.');
  return {...state,teamPosts:state.teamPosts.map(item=>item.id===post.id?{...post,comments:post.comments.map(item=>item.id===comment.id?{...comment,content,updatedAt:new Date().toISOString()}:item)}:item)};
 }
 const api={editComment,TYPES,TABS,typeOf,canRead,canViewPost,canEdit,list,boardPosts,addComment,save,remove};if(typeof module!=='undefined')module.exports=api;else root.BoardTeamPosts=api;
})(typeof window!=='undefined'?window:globalThis);
