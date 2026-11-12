(function(root){
 'use strict';
 const Avatars=typeof module!=='undefined'?require('./avatar-catalog.js'):root.BoardAvatars;
 const FOLDER='.workboard-presence',INTERVAL=10000,TTL=40000;
 function online(records,members,now){
  const allowed=new Set(members.filter(m=>m.active!==false).map(m=>m.name)),byName=new Map();
  for(const row of records){if(row?.version!==1||!allowed.has(row.name)||!Avatars.keys.includes(row.avatar)||!Number.isFinite(row.updatedAt)||!Number.isFinite(row.joinedAt)||row.updatedAt>now+TTL||now-row.updatedAt>TTL||row.joinedAt>row.updatedAt)continue;
   const old=byName.get(row.name);if(!old)byName.set(row.name,{...row});else byName.set(row.name,{...(row.updatedAt>old.updatedAt?row:old),joinedAt:Math.min(old.joinedAt,row.joinedAt)});
  }
  return [...byName.values()].sort((a,b)=>a.joinedAt-b.joinedAt||a.name.localeCompare(b.name,'ko'));
 }
 function render({people=[],connected=false},esc){
  if(!people.length)return '';
  const overflow=people.slice(5),status=connected?'공용 폴더 접속 현황 · 약 10초마다 갱신':'공용 폴더 접속 상태를 확인할 수 없습니다 · 본인만 표시';
  return '<div class="online-profiles" role="group" aria-label="'+esc(status)+'">'+people.slice(0,5).map(person=>{const avatar=Avatars.characters.find(([key])=>key===person.avatar)||Avatars.characters[0];return '<span class="online-profile" tabindex="0" title="'+esc(person.name+(connected?'':' · 공용 접속 확인 대기'))+'" aria-label="'+esc(person.name)+'"><img src="'+esc(Avatars.src(avatar[2]))+'" alt="" width="30" height="30"></span>';}).join('')+(overflow.length?'<span class="online-profile online-overflow" tabindex="0" title="'+esc(overflow.map(p=>p.name).join(', '))+'" aria-label="그 외 '+overflow.length+'명: '+esc(overflow.map(p=>p.name).join(', '))+'">+'+overflow.length+'</span>':'')+'</div>';
 }
 function create({onChange=()=>{},now=()=>Date.now(),id=()=>crypto.randomUUID(),interval=setInterval,clear=clearInterval}={}){
  let current=null,desired={},members=[],timer=null,chain=Promise.resolve(),queued=false,view={people:[],connected:false};
  const publish=(people,connected)=>{view={people,connected};onChange(view);};
  const run=fn=>{const result=chain.then(fn);chain=result.catch(()=>{});return result;};
  const own=()=>current?{version:1,name:current.user.name,avatar:Avatars.keys.includes(current.user.avatar)?current.user.avatar:'yongyong',joinedAt:current.joinedAt,updatedAt:now()}:null;
  async function removeOwn(){if(current?.folder)try{await current.folder.removeEntry(current.filename);}catch{} }
  async function tick(){
   if(!current){publish([],false);return;}
   const self=own();
   if(!current.directory?.getDirectoryHandle){publish([self],false);return;}
   try{
    if(await current.directory.queryPermission({mode:'readwrite'})!=='granted')throw new Error('Permission unavailable');
    current.folder=await current.directory.getDirectoryHandle(FOLDER,{create:true});
    const file=await current.folder.getFileHandle(current.filename,{create:true}),stream=await file.createWritable();
    try{await stream.write(JSON.stringify(self));await stream.close();}catch(error){try{await stream.abort();}catch{}throw error;}
    const records=[self];
    for await(const [name,handle] of current.folder.entries()){
     if(handle.kind!=='file'||name===current.filename||!/^session-[a-z0-9-]+\.json$/.test(name))continue;
     try{const data=await handle.getFile();if(data.size>2048)continue;records.push(JSON.parse(await data.text()));}catch{}
    }
    publish(online(records,members,now()),true);
   }catch{publish([self],false);}
  }
  function refresh(){if(queued)return chain;queued=true;return run(tick).finally(()=>{queued=false;});}
  function setSession({directory=null,user=null,members:roster=[]}={}){
   members=roster;
   if(desired.directory===directory&&desired.name===user?.name&&desired.avatar===user?.avatar)return chain;
   desired={directory,name:user?.name,avatar:user?.avatar};
   return run(async()=>{
    const same=current&&current.directory===directory&&current.user.name===user?.name;
    if(timer){clear(timer);timer=null;}
    if(!same)await removeOwn();
    current=user?{directory,user:{name:user.name,avatar:user.avatar},joinedAt:same?current.joinedAt:now(),filename:same?current.filename:'session-'+id()+'.json',folder:same?current.folder:null}:null;
    await tick();
    if(current?.directory?.getDirectoryHandle){timer=interval(()=>{refresh().catch(()=>{});},INTERVAL);timer?.unref?.();}
   });
  }
  function stop(){return setSession({members});}
  return {setSession,refresh,stop,snapshot:()=>view};
 }
 const api={create,render,online,FOLDER,INTERVAL,TTL};if(typeof module!=='undefined')module.exports=api;else root.BoardPresence=api;
})(typeof window!=='undefined'?window:globalThis);
