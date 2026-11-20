(function(root){
 'use strict';
 const Icons=typeof module!=='undefined'?require('./arrow-icons.js'):root.BoardArrowIcons;
 const Avatars=typeof module!=='undefined'?require('./avatar-catalog.js'):root.BoardAvatars;
 const Attachments=typeof module!=='undefined'?require('../html/organization/board/attachments.js'):root.BoardAttachments;
 const LeaveTypes=typeof module!=='undefined'?require('./leave-types.js'):root.BoardLeaveTypes;
 function create({C,P,W,B,N,esc,button,options,member,weekBlocks,samplePostAvatar=()=>undefined}){
  const characters=Avatars.characters;
  const characterKey=value=>characters.some(([key])=>key===value)?value:'yongyong';
  const characterFile=value=>characters.find(c=>c[0]===characterKey(value))[2];
  function characterImage(key,width,height){
    return '<img src="'+esc(Avatars.src(characterFile(key)))+'" alt="" aria-hidden="true" width="'+width+'" height="'+height+'">';
  }
  function profileImage(person,width,height){
    return person?.privateAvatarSrc?'<img src="'+esc(person.privateAvatarSrc)+'" alt="" aria-hidden="true" width="'+width+'" height="'+height+'">':characterImage(person?.avatar,width,height);
  }
  const team=t=>esc(N.teamLabel(t));
  function leaves(state,user,rows,mode='person'){
    const compare=P.nameComparator(state);
    rows=rows.slice().sort((a,b)=>mode==='date'?b.start.localeCompare(a.start)||compare(a.owner,b.owner):compare(a.owner,b.owner)||b.start.localeCompare(a.start));
    const body=rows.map(leave=>{
      const person=member(leave.owner),type=LeaveTypes.all(state).find(type=>type.id===leave.typeId||type.name.replace(/\s/g,'')===leave.type.replace(/\s/g,''));
      const borrowed=leave.borrowNextYear?'<small class="leave-borrow-label">'+(Number(leave.start.slice(0,4))+1)+
        (leave.end.slice(0,4)!==leave.start.slice(0,4)?'~'+(Number(leave.end.slice(0,4))+1):'')+'년 연차 선사용</small>':'';
      return '<tr><td class="leave-date-cell">'+esc(leave.start)+(leave.end!==leave.start?' ~ '+esc(leave.end):'')+'</td><td>'+team(person?.team||'—')+'</td><td><span class="leave-table-person">'+
        (person?profileImage(person,28,28):'')+'<span>'+esc(leave.owner)+'</span></span></td><td>'+esc(person?.rank||'미지정')+'</td>'+
        '<td><span class="leave-type-badge"><span class="tossface" aria-hidden="true">'+esc(type?.icon||'📅')+'</span>'+esc(leave.type)+'</span>'+borrowed+'</td>'+
        '<td class="leave-note-cell">'+esc(leave.note||'—')+'</td><td>'+
        (P.canEditLeave(state,user.name,leave.owner)?button('editLeave',Icons.arrow('edit'),'leave-row-edit','data-id="'+esc(leave.id)+
          '" aria-label="'+esc(leave.owner+' '+leave.type)+' 수정" title="수정"'):'—')+'</td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="leave-table"><caption class="sr-only">휴가 일정</caption><thead><tr>'+
      ['날짜','팀','이름','직급','연차구분','비고','편집'].map(title=>'<th scope="col">'+title+'</th>').join('')+'</tr></thead><tbody>'+
      (body||'<tr><td colspan="7" class="empty">등록된 휴가가 없습니다.</td></tr>')+'</tbody></table></div>';
  }
  function today(state,user){const date=C.today(),items=P.schedule(state,user.name,{start:date,end:date}),due=state.projects.map(C.effective).filter(p=>p.due===date&&p.status!=='완료'&&p.assignees.includes(user.name));return '<section class="card"><div class="sectionhead"><h2>'+date+' 오늘 일정</h2>'+button('newMemo','＋ 일정 추가','primary')+'</div><div class="agenda-list">'+items.map(i=>'<article class="agenda-item"><div><small>'+esc(i.time||'종일')+' · '+esc(i.owner)+'</small>'+(i.projectId?button('boardDetail',esc(i.title),'project-button','data-id="'+esc(i.projectId)+'"'):'<strong>'+esc(i.title)+'</strong>')+'</div>'+weekBlocks(i.date,i.done)+'</article>').join('')+due.map(p=>'<article class="agenda-item"><div><small>오늘 마감</small>'+button('boardDetail',esc(p.title),'project-button','data-id="'+esc(p.id)+'"')+'</div>'+weekBlocks(p.due)+'</article>').join('')+(!items.length&&!due.length?illustratedHint(user.avatar,'오늘 등록된 일정과 마감 과업이 없어요','필요한 일정은 위의 일정 추가 버튼으로 등록하세요.'):'')+'</div></section>';}
  function connection(health){return '<div class="connection workspace-tools connection-statuses" aria-label="폴더 연결 상태">'+[['원본',health.source,'source'],['저장',health.target,'target']].map(([name,ok,key])=>button('connections','<span class="status-circle '+(ok?'online':'offline')+'" aria-hidden="true"></span>'+name+' '+(ok?'연결중':'연결안됨')+'<span class="reconnect-icon" aria-hidden="true">'+Icons.arrow('refresh')+'</span>','connection-status '+(ok?'is-connected':'needs-connection'),'data-connection="'+key+'" aria-label="'+name+' '+(ok?'연결됨':'연결 안 됨')+' · 연결 관리" title="'+name+' 폴더 연결 확인 및 재연결"')).join('')+'</div>';}
  function illustratedHint(character,title,detail=''){const file=characterFile(character);return '<div class="illustrated-hint">'+characterImage(character,64,72)+'<div><strong>'+esc(title)+'</strong>'+(detail?'<p>'+esc(detail)+'</p>':'')+'</div></div>';}
  function avatar(user,editable=true){const key=characterKey(user.avatar),name=user.privateAvatarSrc?'전용 프로필':characters.find(c=>c[0]===key)[1];return editable?button('avatarSettings',profileImage(user,38,38),'avatar character-avatar','aria-label="내 캐릭터 변경: '+esc(name)+'" title="내 캐릭터 변경"'):'<span class="avatar character-avatar" aria-hidden="true">'+profileImage(user,38,38)+'</span>';}
  function avatarPicker(user,privateControls=''){return '<div class="modal-head"><h2>내 캐릭터 선택</h2>'+button('close','닫기')+'</div><div class="modal-body"><p>프로필에 표시할 캐릭터를 선택하세요.</p>'+privateControls+button('addAvatar','＋ 캐릭터 추가','primary')+'<div class="avatar-choices">'+characters.map(([key,name])=>button('setAvatar',characterImage(key,100,110)+'<strong>'+esc(name)+'</strong>','avatar-choice','data-avatar="'+key+'" aria-pressed="'+((user.avatar||'yongyong')===key)+'"')).join('')+'</div><p class="muted">선택은 본인에게만 적용됩니다. 내용 저장을 누르면 통합관리 파일에 반영됩니다.</p></div>';}
  const Bulletin=typeof module!=='undefined'?require('../html/organization/board/views.js'):root.BoardBulletinViews;
  return {...Bulletin.create({C,P,W,B,N,esc,button,options,member,weekBlocks,samplePostAvatar,profileImage,illustratedHint}),leaves,today,connection,illustratedHint,avatar,avatarPicker};
 }
 const api={create};if(typeof module!=='undefined')module.exports=api;else root.BoardDetailViews=api;
})(typeof window!=='undefined'?window:globalThis);
