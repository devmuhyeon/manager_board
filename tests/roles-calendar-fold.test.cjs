const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../js/personnel.js'),C=require('../js/core.js'),Calendar=require('../js/briefing-calendar.js'),Board=require('../js/task-board.js');
test('role migration is one-time, preserves data, and maps named admins without progress bypass',()=>{
 const input=P.upgrade(C.sampleState());input.teamAdmins=['정윤정'];const before=structuredClone(input),s=P.migrateRoles(input);
 assert.deepEqual(input,before);assert.deepEqual(s.overallAdmins,['김무현','성아미','정윤정']);assert.deepEqual(s.teamLeaders,{기획:'성아미',디자인:'홍소영',퍼블:'임정규',콘텐츠:'김아영'});
 assert.equal(P.isOverallAdmin(s,'성아미'),true);assert.equal(P.isLeader(s,'임정규'),true);assert.equal(P.canManage(s,'임정규'),false);assert.equal(P.canManage(s,'홍소영'),false);assert.equal(P.canEditLeave(s,'홍소영','김민재'),true);assert.equal(P.canEditLeave(s,'홍소영','김무현'),false);
 assert.equal(Board.canProgress({assignees:['김민재']},'성아미'),false);assert.deepEqual(s.projects,input.projects);assert.equal(P.migrateRoles(s),s);C.validateState(s);
 const changed=P.setTeamAdmins(s,'성아미',['임정규']);assert.ok(P.isOverallAdmin(changed,'임정규'));assert.throws(()=>P.setTeamAdmins(s,'홍소영',['홍소영']));
});
test('calendar filters before row packing and includes accessible selected state',()=>{
 const state=P.upgrade({...C.sampleState(),projects:[]}),actor='김무현';state.personal[actor]=[{id:'memo',title:'내 개인 일정',date:'2026-11-03',endDate:'2026-11-05'}];state.projects=[{id:'project',title:'내 프로젝트',assignees:[actor],status:'진행중',started:'2026-11-03',due:'2026-11-05',logs:[]}];
 const render=filter=>Calendar.render({state,actor,C,month:'2026-11',filter,esc:v=>v,button:(a,t,c,attrs)=>'<button class="'+c+'" '+attrs+'>'+t+'</button>'});
 assert.ok(render('all').includes('내 개인 일정'));assert.ok(render('all').includes('내 프로젝트'));
 assert.ok(!render('project').includes('내 개인 일정'));assert.ok(render('project').includes('내 프로젝트'));assert.ok(!render('memo').includes('내 프로젝트'));assert.match(render('memo'),/data-filter="memo" aria-pressed="true"/);
});
test('board folding animates in place and retains accessible hidden state',()=>{
 const Fold=require('../js/board-fold.js'),classes=new Set(),animations=[];
 const body={hidden:false,inert:false,style:{},scrollHeight:120,getBoundingClientRect:()=>({height:120}),animate:(frames,options)=>{const animation={cancel(){},frames,options};animations.push(animation);return animation;}};
 const section={querySelector:()=>body,classList:{contains:name=>name==='task-board-lane',remove:name=>classes.delete(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name)}};
 const button={closest:()=>section,setAttribute(k,v){this[k]=v;},querySelector:()=>null};
 assert.equal(Fold.toggle(button,true),true);assert.equal(body.hidden,false);assert.equal(button['aria-expanded'],'false');assert.equal(animations[0].frames[1].height,'0px');animations[0].onfinish();assert.equal(body.hidden,true);
 Fold.toggle(button,false);assert.equal(body.hidden,false);assert.equal(body.inert,false);assert.equal(animations[1].frames[0].height,'0px');animations[1].onfinish();assert.equal(button['aria-expanded'],'true');assert.equal(body.style.overflow,'');
});
