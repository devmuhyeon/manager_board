(function(root){
  'use strict';
 const Avatars=typeof module!=='undefined'?require('./avatar-catalog.js'):root.BoardAvatars;
  const C=typeof module!=='undefined'?require('./core.js'):root.BoardCore;
  function compareNames(s,a,b){
    const members=s.members||C.MEMBERS,ma=members.find(m=>m.name===a),mb=members.find(m=>m.name===b);
    const team=m=>{const i=C.TEAMS.indexOf(m?.team);return i<0?C.TEAMS.length:i;};
    const ranks=s.rankOrder||['대표','사장','부사장','전무','상무','이사','부장','차장','과장','대리','주임','사원','인턴'];
    const rank=m=>{const index=ranks.indexOf(m?.rank);return index<0?ranks.length:index;};
    return team(ma)-team(mb)||Number(s.teamLeaders?.[mb?.team]===b)-Number(s.teamLeaders?.[ma?.team]===a)||rank(ma)-rank(mb)||a.localeCompare(b,'ko');
  }
  const orderNames=(s,names)=>names.slice().sort((a,b)=>compareNames(s,a,b));
  const orderedMembers=s=>(s.members||C.MEMBERS).slice().sort((a,b)=>compareNames(s,a.name,b.name));
  function ranks(s){return s.rankOrder||['대표','사장','부사장','전무','상무','이사','부장','차장','과장','대리','주임','사원','인턴'];}
  function setRanks(s,actor,entries){if(!isOverallAdmin(s,actor))throw Error('전체관리자만 직급을 관리할 수 있습니다.');if(!Array.isArray(entries)||entries.length>40)throw Error('직급은 최대 40개입니다.');const names=entries.map(e=>String(e.name||'').trim());if(names.some(n=>!n||n.length>30)||new Set(names).size!==names.length)throw Error('직급은 중복 없이 1~30자로 입력해 주세요.');const next=structuredClone(s),old=ranks(s);next.rankOrder=names;next.members=next.members.map(m=>{const e=entries.find(e=>e.old===m.rank);return e?{...m,rank:String(e.name).trim()}:old.includes(m.rank)?{...m,rank:''}:m;});return next;}
  function upgrade(s){
    s.members??=C.MEMBERS.map(m=>({...m,active:true}));s.personal??={};s.removedMembers??=[];s.hiddenProjects??=[];s.customerTeams??=[...C.CUSTOMERS];s.teamLeaders??={};s.leaves??=[];return s;
  }
  function addMember(state,name,team){
    name=name.trim();if(!name||name.length>40||['__proto__','constructor','prototype'].includes(name))throw new Error('이름은 1~40자로 입력해 주세요.');
    if(!C.TEAMS.includes(team))throw new Error('소속 팀을 선택해 주세요.');
    const next=upgrade(structuredClone(state)),old=next.members.find(m=>m.name===name);
    if(old?.active!==false&&old)throw new Error('같은 이름이 이미 등록되어 있습니다.');
    if(old){old.active=true;old.team=team;delete old.retiredAt;delete old.retention;}else next.members.push({name,team,active:true});
    next.removedMembers=next.removedMembers.filter(n=>n!==name);return next;
  }
  function removalImpact(state,name){
    const ps=state.projects.map(C.effective);
    return {projects:ps.filter(p=>p.assignees.includes(name)).length,tasks:ps.reduce((n,p)=>n+(p.tasks||[]).filter(t=>t.assignees.includes(name)).length,0),logs:ps.reduce((n,p)=>n+p.logs.filter(l=>l.author===name).length,0),personal:(state.personal?.[name]||[]).length};
  }
  // Removes only structured personal records. Shared work and source files remain intact.
  function applyRemoval(s,name){
    s.hiddenProjects??=[];
    s.projects=s.projects.filter(p=>{
      const e=C.effective(p),involved=e.assignees.includes(name);
      const tasks=(e.tasks||[]).filter(t=>!(t.assignees.length===1&&t.assignees[0]===name)).map(t=>({...t,assignees:t.assignees.filter(n=>n!==name)}));
      if(involved&&e.assignees.every(n=>n===name)&&!tasks.length){if(!s.hiddenProjects.includes(p.id))s.hiddenProjects.push(p.id);return false;}
      p.logs=(p.logs||[]).filter(l=>l.author!==name);
      const fields={assignees:e.assignees.filter(n=>n!==name),tasks};
      if(involved){Object.assign(p,fields);if(p.overrides)Object.assign(p.overrides,structuredClone(fields));}
      return true;
    });
    s.leaves=(s.leaves||[]).filter(l=>l.owner!==name);if(s.homeLayouts)delete s.homeLayouts[name];for(const values of Object.values(s.leaveAllowances||{}))delete values[name];delete s.personal[name];delete s.accounts[name];return s;
  }
  function removeMember(state,name,retention){
    if(isOverallAdmin(state,name))throw new Error('전체관리자는 먼저 권한을 이전한 후 퇴사 처리할 수 있습니다.');
    if(!['keep','purge'].includes(retention))throw new Error('자료 보관 방식을 선택해 주세요.');
    const next=upgrade(structuredClone(state)),m=next.members.find(m=>m.name===name&&m.active!==false);
    if(!m)throw new Error('재직 중인 인원을 선택해 주세요.');
    if(next.members.filter(m=>m.active!==false).length<=1)throw new Error('최소 한 명의 재직 인원이 필요합니다.');
    m.active=false;m.retiredAt=new Date().toISOString();m.retention=retention;delete next.accounts[name];
    next.teamAdmins=(next.teamAdmins||[]).filter(n=>n!==name);
    for(const team of Object.keys(next.teamLeaders))if(next.teamLeaders[team]===name)delete next.teamLeaders[team];
    if(retention==='purge'){if(!next.removedMembers.includes(name))next.removedMembers.push(name);applyRemoval(next,name);}
    return next;
  }
  function enforceRemovals(state){
    upgrade(state);state.projects=state.projects.filter(p=>!state.hiddenProjects.includes(p.id));
    for(const name of state.removedMembers)applyRemoval(state,name);return state;
  }
  function savePersonal(state,owner,item){
    if(!state.members.some(m=>m.name===owner&&m.active!==false))throw new Error('로그인한 재직자만 메모를 저장할 수 있습니다.');
    if(!String(item.title||'').trim())throw new Error('메모 제목을 입력해 주세요.');
    const next=structuredClone(state);next.personal??={};const items=next.personal[owner]||[];
    const clean={id:item.id||C.uid(),title:String(item.title).trim().slice(0,150),content:String(item.content||''),date:item.date||'',endDate:item.endDate||'',time:item.time||'',done:Boolean(item.done),updatedAt:new Date().toISOString()};
    if(clean.date&&!validDate(clean.date)||clean.endDate&&(!validDate(clean.endDate)||!clean.date||clean.endDate<clean.date))throw new Error('메모 시작일과 종료일을 확인해 주세요.');
    if(clean.time&&!clean.date)throw new Error('시간을 입력할 때에는 일정 날짜도 선택해 주세요.');
    const i=items.findIndex(x=>x.id===clean.id);if(i<0)items.push(clean);else items[i]=clean;next.personal[owner]=items;return next;
  }
  function isLeader(s,name){return s.members.some(m=>m.name===name&&m.active!==false&&s.teamLeaders?.[m.team]===name);}
  function overallAdmin(s){return s.overallAdmin===undefined?'김무현':s.overallAdmin;}
  function isOverallAdmin(s,name){return (Array.isArray(s.overallAdmins)?s.overallAdmins.includes(name):name===overallAdmin(s))&&s.members.some(m=>m.name===name&&m.active!==false);}
  function transferAdmin(s,actor,target){if(!isOverallAdmin(s,actor))throw new Error('현재 전체관리자만 권한을 이전할 수 있습니다.');if(target===actor||!s.members.some(m=>m.name===target&&m.active!==false))throw new Error('본인 이외의 재직자를 선택하세요.');const next=structuredClone(s);next.overallAdmin=target;if(next.overallAdmins)next.overallAdmins=[...new Set([...next.overallAdmins.filter(n=>n!==actor),target])];next.teamAdmins=(next.teamAdmins||[]).filter(n=>n!==actor&&n!==target);return next;}
  function canManage(s,name){return s.members.some(m=>m.name===name&&m.active!==false)&&(isOverallAdmin(s,name)||!Array.isArray(s.overallAdmins)&&(s.teamAdmins||[]).includes(name));}
  function canEditLeave(s,actor,owner){const me=s.members.find(m=>m.name===actor&&m.active!==false),target=s.members.find(m=>m.name===owner);return Boolean(me&&target&&(actor===owner||canManage(s,actor)||(isLeader(s,actor)&&me.team===target.team)));}
  const HOME_SECTIONS=['memo','thisWeek','nextWeek','deadlines','leaves','work'];
  function homeOrder(s,actor){const saved=s.homeLayouts?.[actor]||[];return [...new Set([...saved.filter(k=>HOME_SECTIONS.includes(k)),...HOME_SECTIONS])];}
  function saveHomeOrder(s,actor,order){if(!s.members.some(m=>m.name===actor&&m.active!==false))throw new Error('로그인이 필요합니다.');if(!Array.isArray(order)||order.length!==HOME_SECTIONS.length||new Set(order).size!==HOME_SECTIONS.length||order.some(k=>!HOME_SECTIONS.includes(k)))throw new Error('배치 순서를 확인하세요.');const next=structuredClone(s);next.homeLayouts??={};next.homeLayouts[actor]=order.slice();return next;}
  function weekRemaining(end,today=C.today()){const days=Math.max(0,Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000));return {days,filled:Math.min(7,days),label:days?'D-'+days:'D-day'};}
  function resetPassword(s,actor,name){if(!canManage(s,actor))throw new Error('비밀번호 초기화는 전체관리자만 가능합니다.');if(!s.members.some(m=>m.name===name&&m.active!==false))throw new Error('재직자를 선택하세요.');const next=structuredClone(s);delete next.accounts[name];return next;}
  function setTeamAdmins(s,actor,names){if(!isOverallAdmin(s,actor))throw new Error('전체관리자 지정은 전체관리자만 가능합니다.');if(!Array.isArray(names)||names.some(n=>!s.members.some(m=>m.name===n&&m.active!==false)))throw new Error('재직자만 팀관리자로 지정할 수 있습니다.');return Array.isArray(s.overallAdmins)?{...structuredClone(s),overallAdmins:[...new Set([overallAdmin(s),actor,...names])]}:{...structuredClone(s),teamAdmins:[...new Set(names)].filter(n=>n!==overallAdmin(s))};}
  function setLeaders(s,leaders){const next=upgrade(structuredClone(s));next.teamLeaders={};for(const team of C.TEAMS){const name=leaders[team];if(!name)continue;if(!s.members.some(m=>m.name===name&&m.team===team&&m.active!==false))throw new Error('팀관리자는 해당 팀의 재직자 중에서 선택하세요.');next.teamLeaders[team]=name;}return next;}
  function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
  function saveLeave(s,actor,input){
    const next=upgrade(structuredClone(s)),old=next.leaves.find(l=>l.id===input.id),owner=String(input.owner||actor);
    if(!s.members.some(m=>m.name===actor&&m.active!==false))throw new Error('로그인이 필요합니다.');
    if(!canEditLeave(s,actor,owner)||(old&&!canEditLeave(s,actor,old.owner)))throw new Error('이 팀원의 휴가를 변경할 권한이 없습니다.');
    if(!s.members.some(m=>m.name===owner&&m.active!==false))throw new Error('재직자를 선택하세요.');
    if(!validDate(input.start)||!validDate(input.end)||input.end<input.start)throw new Error('휴가 시작일과 종료일을 확인하세요.');
    if(!['연차','오전 반차','오후 반차','기타 휴가','추가 사용'].includes(input.type))throw new Error('휴가 종류를 선택하세요.');
    if(input.type.includes('반차')&&input.start!==input.end)throw new Error('반차는 같은 날로 등록하세요.');
    const leave={id:old?.id||C.uid(),owner,start:input.start,end:input.end,type:input.type,note:String(input.note||'').slice(0,300),updatedBy:actor,updatedAt:new Date().toISOString()};
    leave.dailyUnits=input.type==='추가 사용'?Number(input.dailyUnits||1):input.type.includes('반차')?.5:input.type==='기타 휴가'?0:1;if(![0,.5,1].includes(leave.dailyUnits))throw new Error('추가 사용은 0.5일 또는 1일로 입력하세요.');
    const overlap=next.leaves.some(l=>l.id!==old?.id&&l.owner===owner&&l.start<=input.end&&l.end>=input.start&&!(l.start===l.end&&input.start===input.end&&['오전 반차','오후 반차'].includes(l.type)&&['오전 반차','오후 반차'].includes(input.type)&&l.type!==input.type));if(overlap)throw new Error('이미 휴가가 등록된 날짜와 겹칩니다. 기존 휴가를 수정하세요.');
    if(old)next.leaves[next.leaves.indexOf(old)]=leave;else next.leaves.push(leave);return next;
  }
  function deleteLeave(s,actor,id){const l=s.leaves.find(l=>l.id===id);if(!l)throw new Error('휴가를 찾을 수 없습니다.');if(!canEditLeave(s,actor,l.owner))throw new Error('이 팀원의 휴가를 삭제할 권한이 없습니다.');const next=structuredClone(s);next.leaves=next.leaves.filter(l=>l.id!==id);return next;}
  function weekRanges(today=C.today()){const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return [0,1].map(n=>{const start=new Date(d);start.setUTCDate(start.getUTCDate()+n*7);const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};});}
  function schedule(s,actor,range){const me=s.members.find(m=>m.name===actor),names=s.members.filter(m=>m.active!==false&&(m.name===actor||(isLeader(s,actor)&&m.team===me.team))).map(m=>m.name);const rows=[];
    for(const name of names)for(const i of s.personal[name]||[])if(i.date&&i.date<=range.end&&(i.endDate||i.date)>=range.start)rows.push({owner:name,date:i.date,end:i.endDate||i.date,title:i.title,time:i.time,done:i.done,kind:'일정'});
    for(const l of s.leaves)if(names.includes(l.owner)&&l.start<=range.end&&l.end>=range.start)rows.push({owner:l.owner,date:l.start,end:l.end,title:l.type,kind:'휴가'});
    for(const raw of s.projects||[]){
      if(s.hiddenProjects?.includes(raw.id))continue;
      const project=C.effective(raw);
      const tasks=project.tasks?.length?project.tasks:[{...project,id:''}];
      for(const task of tasks){
        const owners=orderNames(s,(task.assignees||[]).filter(name=>names.includes(name)));
        if(!owners.length)continue;
        const start=task.started||task.due||'',end=task.due||task.started||'';
        if(!start||!end||start>range.end||end<range.start)continue;
        const done=C.isComplete(task.status),progress=done?100:Math.max(0,Math.min(99,Number.isFinite(task.progress)?task.progress:0));
        rows.push({projectId:project.id,taskId:task.id,title:project.title,owner:owners.join(', '),role:task.role||'과업',date:start,end,due:task.due||'',status:task.status,progress,done,kind:'업무보드'});
      }
    }
    return rows.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||'')||compareNames(s,a.owner,b.owner)||a.owner.localeCompare(b.owner));
  }
  function dday(date,today=C.today()){const n=Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);return n===0?'D-day':n>0?'D-'+n:'D+'+Math.abs(n);}
  function setAvatar(s,actor,avatar){if(!Avatars.keys.filter(key=>!key.startsWith('custom-')).includes(avatar)&&!(s.customAvatars||[]).some(v=>v.id===avatar))throw Error('캐릭터를 선택하세요.');const next=structuredClone(s),person=next.members.find(m=>m.name===actor&&m.active!==false);if(!person)throw Error('로그인이 필요합니다.');person.avatar=avatar;return next;}
  function migrateRoles(input){
    if(input.rolePolicyVersion===1)return input;
    const s=upgrade(structuredClone(input)),active=name=>s.members.some(m=>m.name===name&&m.active!==false);
    s.overallAdmins=[...new Set(['김무현','성아미',overallAdmin(s),...(s.teamAdmins||[])])].filter(active);
    if(!s.overallAdmins.length)s.overallAdmins=[s.members.find(m=>m.active!==false).name];
    if(!active(s.overallAdmin))s.overallAdmin=s.overallAdmins[0];
    s.teamAdmins=[];s.teamLeaders={};
    for(const [team,name] of Object.entries({기획:'성아미',디자인:'홍소영',퍼블:'임정규',콘텐츠:'김아영'}))if(s.members.some(m=>m.name===name&&m.team===team&&m.active!==false))s.teamLeaders[team]=name;
    s.rolePolicyVersion=1;return s;
  }
  const api={ranks,setRanks,migrateRoles,compareNames,orderNames,orderedMembers,setAvatar,overallAdmin,isOverallAdmin,transferAdmin,upgrade,addMember,removeMember,removalImpact,enforceRemovals,savePersonal,isLeader,setLeaders,saveLeave,deleteLeave,weekRanges,schedule,dday,canManage,setTeamAdmins,resetPassword,canEditLeave,homeOrder,saveHomeOrder,weekRemaining};if(typeof module!=='undefined')module.exports=api;else root.BoardPeople=api;
})(typeof window!=='undefined'?window:globalThis);
