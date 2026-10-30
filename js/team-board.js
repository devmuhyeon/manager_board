(function(root){
 'use strict';
 const P=typeof module!=='undefined'?require('./personnel.js'):root.BoardPeople;
 const C=typeof module!=='undefined'?require('./core.js'):root.BoardCore;
 const TYPES=['전체공지','팀별공지','일반글'];
 const typeOf=post=>post.type||'일반글';
 function canRead(s,actor,team){const m=s.members.find(x=>x.name===actor&&x.active!==false);return Boolean(C.TEAMS.includes(team)&&m&&(m.team===team||P.canManage(s,actor)));}
 function canEdit(s,actor,post){return canRead(s,actor,post.team)&&(actor===post.author||P.canManage(s,actor)||P.isLeader(s,actor));}
 function list(s,actor,team){if(!canRead(s,actor,team))throw Error('해당 팀 게시판 접근 권한이 없습니다.');return (s.teamPosts||[]).filter(p=>typeOf(p)==='전체공지'||p.team===team).slice().sort((a,b)=>TYPES.indexOf(typeOf(a))-TYPES.indexOf(typeOf(b))||Number(b.pinned)-Number(a.pinned)||b.updatedAt.localeCompare(a.updatedAt));}
 function save(s,actor,input){const old=(s.teamPosts||[]).find(p=>p.id===input.id);if(!canRead(s,actor,input.team)||(old&&(!canEdit(s,actor,old)||old.team!==input.team)))throw Error('게시글을 변경할 권한이 없습니다.');if(input.id&&!old)throw Error('게시글이 없습니다.');const type=input.type===undefined?typeOf(old||{}):input.type;if(!TYPES.includes(type))throw Error('글 구분을 선택하세요.');const title=String(input.title||'').trim(),content=String(input.content||'').trim();if(!title||title.length>150||!content||content.length>20000)throw Error('제목 1~150자, 내용 1~20,000자를 입력하세요.');const next=structuredClone(s);next.teamPosts??=[];const post={id:old?.id||C.uid(),team:input.team,type,author:old?.author||actor,title,content,pinned:Boolean(input.pinned),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),updatedBy:actor};if(old)next.teamPosts[next.teamPosts.findIndex(p=>p.id===old.id)]=post;else next.teamPosts.push(post);return next;}
 function remove(s,actor,id){const post=(s.teamPosts||[]).find(p=>p.id===id);if(!post||!canEdit(s,actor,post))throw Error('게시글을 삭제할 권한이 없습니다.');return {...structuredClone(s),teamPosts:s.teamPosts.filter(p=>p.id!==id)};}
 const api={TYPES,typeOf,canRead,canEdit,list,save,remove};if(typeof module!=='undefined')module.exports=api;else root.BoardTeamPosts=api;
})(typeof window!=='undefined'?window:globalThis);
