(function(root){
 'use strict';
 const P=typeof module!=='undefined'?require('./personnel.js'):root.BoardPeople;
 const C=typeof module!=='undefined'?require('./core.js'):root.BoardCore;
 const TYPES=['전체공지','팀별공지','일반글'];
 const TABS=[['all','전체'],['common','공통'],['기획','기획'],['퍼블','퍼블'],['디자인','디자인'],['콘텐츠','콘텐츠']];
 const typeOf=post=>post.type||'일반글';
 function canRead(s,actor,team){const m=s.members.find(x=>x.name===actor&&x.active!==false);return Boolean(C.TEAMS.includes(team)&&m&&(m.team===team||P.canManage(s,actor)));}
 function canViewPost(s,actor,post){
  if(!s.members.some(member=>member.name===actor&&member.active!==false))return false;
  return typeOf(post)==='전체공지'||canRead(s,actor,post.team);
 }
 function canEdit(s,actor,post){return canRead(s,actor,post.team)&&(actor===post.author||P.canManage(s,actor)||P.isLeader(s,actor));}
 function list(s,actor,team){if(!canRead(s,actor,team))throw Error('해당 팀 게시판 접근 권한이 없습니다.');return (s.teamPosts||[]).filter(p=>typeOf(p)==='전체공지'||p.team===team).slice().sort((a,b)=>TYPES.indexOf(typeOf(a))-TYPES.indexOf(typeOf(b))||Number(b.pinned)-Number(a.pinned)||b.updatedAt.localeCompare(a.updatedAt));}
 function boardPosts(s,actor,tab){
  if(!s.members.some(member=>member.name===actor&&member.active!==false))return [];
  const posts=(s.teamPosts||[]).filter(post=>typeOf(post)==='전체공지'||canRead(s,actor,post.team))
   .sort((a,b)=>Number(b.pinned)-Number(a.pinned)||TYPES.indexOf(typeOf(a))-TYPES.indexOf(typeOf(b))||b.updatedAt.localeCompare(a.updatedAt));
  let sampleNotices=0;
  return posts.filter(post=>!post.sampleFixture||typeOf(post)==='일반글'||++sampleNotices<=3).filter(post=>{
   if(typeOf(post)==='전체공지')return tab==='all'||tab==='common';
   return tab==='all'||tab===post.team;
  });
 }
 function addComment(state,actor,{id,content}){
  const posts=state.teamPosts||[];
  const index=posts.findIndex(post=>post.id===id);
  const post=posts[index];
  if(!post||!canViewPost(state,actor,post))throw Error('댓글을 작성할 권한이 없습니다.');
  const text=String(content||'').trim();
  if(!text||text.length>2000)throw Error('댓글을 1~2,000자로 입력하세요.');
  const comment={id:C.uid(),author:actor,content:text,createdAt:new Date().toISOString()};
  return {...state,teamPosts:posts.map((item,i)=>i===index?{...item,comments:[...(item.comments||[]),comment]}:item)};
 }
 function save(s,actor,input){const old=(s.teamPosts||[]).find(p=>p.id===input.id);if(!canRead(s,actor,input.team)||(old&&(!canEdit(s,actor,old)||old.team!==input.team)))throw Error('게시글을 변경할 권한이 없습니다.');if(input.id&&!old)throw Error('게시글이 없습니다.');const type=input.type===undefined?typeOf(old||{}):input.type;if(!TYPES.includes(type))throw Error('글 구분을 선택하세요.');const title=String(input.title||'').trim(),content=String(input.content||'').trim();if(!title||title.length>150||!content||content.length>20000)throw Error('제목 1~150자, 내용 1~20,000자를 입력하세요.');const next=structuredClone(s);next.teamPosts??=[];const post={...(old?.sampleFixture?{sampleFixture:true}:{}),...(old?.comments?{comments:structuredClone(old.comments)}:{}),id:old?.id||C.uid(),team:input.team,type,author:old?.author||actor,title,content,pinned:Boolean(input.pinned),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),updatedBy:actor};if(old)next.teamPosts[next.teamPosts.findIndex(p=>p.id===old.id)]=post;else next.teamPosts.push(post);return next;}
 function remove(s,actor,id){const post=(s.teamPosts||[]).find(p=>p.id===id);if(!post||!canEdit(s,actor,post))throw Error('게시글을 삭제할 권한이 없습니다.');return {...structuredClone(s),teamPosts:s.teamPosts.filter(p=>p.id!==id)};}
 const api={TYPES,TABS,typeOf,canRead,canViewPost,canEdit,list,boardPosts,addComment,save,remove};if(typeof module!=='undefined')module.exports=api;else root.BoardTeamPosts=api;
})(typeof window!=='undefined'?window:globalThis);
