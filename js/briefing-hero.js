(function(root){
 'use strict';
 const Avatars=typeof module!=='undefined'?require('./avatar-catalog.js'):root.BoardAvatars;
 const KEY='workplace-briefing-design-v1';
 const palettes=[
  {id:'pink',name:'핑크',start:'#feebf8',end:'#ffc7df',ink:'#bd005b',muted:'#8c6178',accent:'#fa61ab',button:'#fec5e3'},
  {id:'pink-bold',name:'진한 핑크',start:'#fcb0d0',end:'#f965a9',ink:'#ffffff',muted:'#ffffff',accent:'#fc67ac',button:'#ffb7da',buttonText:'#bd005b',metricInk:'#bd005b'},
  {id:'blue',name:'블루',start:'#d6eefe',end:'#719eff',ink:'#1c2bad',muted:'#5f6f91',accent:'#5163d6',button:'#a5bcf3'},
  {id:'orange',name:'오렌지',start:'#fef6ed',end:'#ffbc70',ink:'#b84200',muted:'#8f735d',accent:'#f57505',button:'#fccca7'},
  {id:'yellow',name:'옐로',start:'#fef7c4',end:'#ffe457',ink:'#845200',muted:'#876b29',accent:'#ffa600',button:'#fff7cd'},
  {id:'green',name:'그린',start:'#f1fae9',end:'#b5df8d',ink:'#35591f',muted:'#62765b',accent:'#668e3b',button:'#ddedc8'},
  {id:'mint',name:'민트',start:'#e8fcf5',end:'#8dddd1',ink:'#105c53',muted:'#5e7d77',accent:'#218779',button:'#c5f1e6'},
  {id:'purple',name:'퍼플',start:'#f5efff',end:'#c7a5ed',ink:'#5f298d',muted:'#7b668a',accent:'#9059bf',button:'#e6d2f6'},
  {id:'gray',name:'그레이',start:'#f5f5f6',end:'#bac8d6',ink:'#33475e',muted:'#687581',accent:'#60778d',button:'#dbe4ed'}
 ];
 const colorsByAvatar={yongyong:'green',bbiyak:'yellow',hamtaro:'orange',penguin:'blue',terriermon:'green','sprout-potato':'green',frog:'mint','sweet-potato':'purple',danbi:'pink',dongdong:'blue',strawberry:'pink',ddochi:'yellow',maruko:'orange',mashimaro:'mint','majin-buu':'pink',culprit:'gray','baby-jjanggu':'orange','sailor-moon':'blue',atammamma:'orange',glasses:'purple',juice:'orange',kongkong:'green',quokka:'orange',kitty:'pink',powerpuff:'pink','penguin-new':'blue'};
 const groups=[
  ['배경',[['bgStart','왼쪽 색'],['bgEnd','오른쪽 색']]],
  ['타이틀',[['title','글자'],['titleBg','배경',true]]],
  ['설명',[['description','글자'],['descriptionBg','배경',true]]],
  ['팀 배지',[['badgeBg','배경'],['badgeText','글자']]],
  ['업무 관리 버튼',[['buttonBg','배경'],['buttonText','글자']]],
  ['보기 전환',[['toggleBg','배경'],['toggleText','글자'],['toggleActiveBg','선택 배경'],['toggleActiveText','선택 글자']]],
  ['전체 과업 카드',[['allBg','배경'],['allLabel','제목'],['allText','숫자']]],
  ['미완료 카드',[['activeBg','배경'],['activeLabel','제목'],['activeText','숫자']]],
  ['마감일 경과 카드',[['overdueBg','배경'],['overdueLabel','제목'],['overdueText','숫자']]]
 ];
 const fields=groups.flatMap(([,fields])=>fields),positions=[['scale','이미지 크기',50,260,'%'],['x','가로 위치',-150,150,'px'],['y','세로 위치',-150,150,'px']];
 const avatarKey=user=>Avatars.keys.includes(user.avatar)?user.avatar:'yongyong';
 function fromPalette(p,mode='normal'){return {bgStart:mode==='big'&&p.id==='pink'?'#fce1f0':p.start,bgEnd:mode==='big'&&p.id==='pink'?'#fcb2d1':p.end,title:p.ink,titleBg:'transparent',description:p.muted,descriptionBg:'transparent',badgeBg:p.accent,badgeText:'#ffffff',buttonBg:p.button,buttonText:p.buttonText||p.ink,toggleBg:p.button,toggleText:p.ink,toggleActiveBg:p.accent,toggleActiveText:'#ffffff',allBg:'#ffffff',allLabel:p.muted,allText:'#333333',activeBg:'#ffffff',activeLabel:p.muted,activeText:'#333333',overdueBg:'#ffffff',overdueLabel:p.muted,overdueText:p.metricInk||p.ink,scale:mode==='big'?160:100,x:0,y:mode==='big'?18:0};}
 function defaults(user,mode){return fromPalette(palettes.find(p=>p.id===colorsByAvatar[avatarKey(user)])||palettes[0],mode);}
 function clean(input,base){const out={...base};if(!input||typeof input!=='object')return out;for(const [key,,transparent] of fields)if(/^#[a-f0-9]{6}$/i.test(input[key]||'')||transparent&&input[key]==='transparent')out[key]=input[key];for(const [key,,min,max] of positions)if(Number.isFinite(input[key]))out[key]=Math.max(min,Math.min(max,input[key]));return out;}
 function create(storage){
  const modes=new Map(),records=new Map(),person=user=>KEY+':'+encodeURIComponent(user.name),key=user=>person(user)+':'+avatarKey(user);
  function get(user){let saved=records.get(key(user))||{};try{saved=JSON.parse(storage.getItem(key(user))||JSON.stringify(saved))||{};}catch{}
   let mode=modes.get(person(user));if(!mode){try{mode=storage.getItem(person(user)+':mode');}catch{}mode=mode==='big'||mode==='normal'?mode:saved.mode==='big'?'big':'normal';}
   return {mode,normal:clean(saved.normal,defaults(user,'normal')),big:clean(saved.big,defaults(user,'big'))};
  }
  function setMode(user,value){const mode=value==='big'?'big':'normal';modes.set(person(user),mode);try{storage.setItem(person(user)+':mode',mode);return true;}catch{return false;}}
  function save(user,value){const record={mode:value.mode==='big'?'big':'normal',normal:clean(value.normal,defaults(user,'normal')),big:clean(value.big,defaults(user,'big'))};storage.setItem(key(user),JSON.stringify(record));records.set(key(user),record);setMode(user,record.mode);return record;}
  function saveMode(user,mode,config){const record=get(user);record.mode=mode==='big'?'big':'normal';record[record.mode]=clean(config,defaults(user,record.mode));return save(user,record);}
  return {get,save,setMode,saveMode};
 }
 function render({user,rows,C,N,esc,record,preview=false}){
  const mode=record.mode==='big'?'big':'normal',config=clean(record[mode],defaults(user,mode)),image=Avatars.characters.find(([key])=>key===avatarKey(user))[2],active=rows.filter(p=>!C.isComplete(p.status));
  const metrics=[['all','전체 과업',rows.length],['active','미완료',active.length],['overdue','마감일 경과',active.filter(p=>p.due&&p.due<C.today()).length]];
  const vars=fields.map(([key])=>'--hero-'+key+':'+config[key]).concat(['--hero-scale:'+config.scale/100,'--hero-x:'+config.x+'px','--hero-y:'+config.y+'px']).join(';');
  return '<div class="briefing-hero-frame" style="aspect-ratio:1656 / '+258+'"><section class="briefing-hero hero-'+mode+'" style="'+vars+'" aria-label="'+esc(user.name)+'님의 업무 브리핑"><div class="hero-image"><img src="'+esc(Avatars.src(image))+'" alt="" width="220" height="220"></div><div class="hero-intro"><span class="hero-team">'+esc(N.teamLabel(user.team))+' 팀</span><h2>'+esc(user.name)+'님의 업무 브리핑</h2><p>전체 과업 현황을 보고, 아래에서 팀 소식과 내 일정을 확인하세요.</p><button type="button" class="hero-work-button" '+(preview?'disabled':'data-action="page" data-page="work"')+'>업무 관리 →</button></div><div class="hero-right"><div class="hero-mode-toggle" role="group" aria-label="브리핑 이미지 보기">'+[['normal','기본형'],['big','대두형']].map(([key,label])=>'<button type="button" data-action="'+(preview?'heroPreviewMode':'heroMode')+'" data-mode="'+key+'" aria-label="'+label+'" title="'+label+'" aria-pressed="'+(mode===key)+'">'+(key==='normal'?'x1':'x1.6')+'</button>').join('')+'</div><dl class="hero-metrics">'+metrics.map(([key,label,value])=>'<div class="hero-metric metric-'+key+'"><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('')+'</dl></div>'+(preview?'':'<button type="button" class="hero-secret" data-action="heroSecret" aria-label="브리핑 디자인 설정: 다섯 번 클릭"></button>')+'</section></div>';
 }
 function editor({user,rows,C,N,esc,record,button}){
  const config=record[record.mode];return '<div class="modal-head"><div><h2>브리핑 커스텀</h2><p>'+esc(Avatars.characters.find(([key])=>key===avatarKey(user))[1])+' · '+(record.mode==='big'?'대두형':'기본형')+'</p></div>'+button('close','닫기')+'</div><form id="heroDesignForm"><div class="modal-body hero-custom-body"><div id="heroPreview" class="hero-preview">'+render({user,rows,C,N,esc,record,preview:true})+'</div><p class="hero-custom-note">현재 캐릭터의 기본형·대두형을 각각 설정합니다. 이 브라우저에서 본인에게만 저장됩니다.</p><div class="hero-palette" role="group" aria-label="추천 컬러 팔레트">'+palettes.map(p=>button('heroPalette','<i style="background:linear-gradient(120deg,'+p.start+','+p.end+')"></i>'+p.name,'','data-palette="'+p.id+'"')).join('')+'</div><div class="hero-custom-layout"><fieldset class="hero-image-settings"><legend>이미지 크기·위치</legend>'+positions.map(([key,label,min,max,unit])=>'<label>'+label+'<output data-hero-output="'+key+'">'+config[key]+unit+'</output><input type="range" data-hero-position="'+key+'" min="'+min+'" max="'+max+'" value="'+config[key]+'" aria-label="'+label+'"></label>').join('')+'</fieldset><div class="hero-color-groups">'+groups.map(([title,list])=>'<fieldset><legend>'+title+'</legend>'+list.map(([key,label,transparent])=>'<div class="hero-color-field"><label>'+label+'<input type="color" data-hero-color="'+key+'" value="'+(config[key]==='transparent'?'#ffffff':config[key])+'" aria-label="'+title+' '+label+'"></label>'+(transparent?'<label class="hero-transparent"><input type="checkbox" data-hero-transparent="'+key+'" '+(config[key]==='transparent'?'checked':'')+'>투명</label>':'')+'</div>').join('')+'</fieldset>').join('')+'</div></div><div class="error" id="heroDesignError" role="alert"></div></div><div class="modal-foot">'+button('heroSaveMode',(record.mode==='big'?'대두형':'기본형')+'만 저장')+button('heroReset','현재 모드 초기화')+button('close','취소')+'<button class="primary">두 모드 저장 후 닫기</button></div></form>';
 }
 let observer;
 function mount(doc){
  const frames=[...doc.querySelectorAll('.briefing-hero-frame')],fit=frame=>{if(frame.clientWidth>0)frame.style.setProperty('--hero-fit',String(frame.clientWidth/1656));};
  if(typeof ResizeObserver!=='undefined'){if(!observer)observer=new ResizeObserver(entries=>entries.forEach(entry=>fit(entry.target)));observer.disconnect();frames.forEach(frame=>observer.observe(frame));}
  frames.forEach(fit);
 }
 const api={mount,create,render,editor,clean,defaults,fromPalette,palettes,fields,positions,avatarKey};if(typeof module!=='undefined')module.exports=api;else root.BoardBriefingHero=api;
})(typeof window!=='undefined'?window:globalThis);
