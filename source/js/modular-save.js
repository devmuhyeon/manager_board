(function(root){
 'use strict';
 const LEGACY='통합관리 대시보드.json',POSTS_FOLDER='게시판',ID=/^[a-f0-9-]{36}$/;
 const group=key=>key==='cardExpenses'?'cards':key==='customAvatars'?'assets':key==='projects'?'work':key==='personal'?'memo':/leave/i.test(key)?'leave':/post|board/i.test(key)?'board':key==='organizationChart'||/member|account|remov/i.test(key)?'people':'settings';
 async function optional(dir,name,kind='file'){try{return await dir[kind==='file'?'getFileHandle':'getDirectoryHandle'](name);}catch(e){if(e.name==='NotFoundError')return null;throw e;}}
 async function read(file){return (await file.getFile()).text();}
 async function write(dir,name,text){const file=await dir.getFileHandle(name,{create:true}),stream=await file.createWritable();try{await stream.write(text);await stream.close();}catch(e){try{await stream.abort();}catch{}throw e;}}
 const BulletinStorage=typeof module!=='undefined'?require('../html/organization/board/storage.js'):root.BoardBulletinStorage;
 const {readPosts,writePosts}=BulletinStorage.create({read,write});
 const leaveKeys=['leaves','leaveAllowances','leaveTypes','leavePolicy'];
 const validYear=year=>/^\d{4}$/.test(year);
 async function readLeaves(directory,parts){
  if(!parts||!Array.isArray(parts.fields)||parts.fields.some(key=>!leaveKeys.includes(key))||
    !parts.years||typeof parts.years!=='object'||Array.isArray(parts.years)||!Array.isArray(parts.order))throw Error('휴가 저장 목록이 올바르지 않습니다.');
  const folder=await (await directory.getDirectoryHandle('save')).getDirectoryHandle('휴가'),result={};
  if(parts.fields.includes('leaves'))result.leaves=[];
  if(parts.fields.includes('leaveAllowances'))result.leaveAllowances={};
  for(const [year,revision] of Object.entries(parts.years)){
   if(!validYear(year)||!ID.test(revision))throw Error('휴가 연도별 저장 경로가 올바르지 않습니다.');
   const dir=await folder.getDirectoryHandle(year),data=JSON.parse(await read(await dir.getFileHandle(revision+'.json')));
   if(!data||!Array.isArray(data.leaves)||data.leaves.some(leave=>typeof leave?.start!=='string'||leave.start.slice(0,4)!==year)||
     !data.allowances||typeof data.allowances!=='object'||Array.isArray(data.allowances))throw Error('휴가 연도별 저장 자료를 확인하세요.');
   if(result.leaves)result.leaves.push(...data.leaves);
   if(result.leaveAllowances&&data.hasAllowances)result.leaveAllowances[year]=data.allowances;
  }
  if(result.leaves){
   const order=new Map(parts.order.map((id,index)=>[id,index]));
   if(order.size!==parts.order.length||result.leaves.length!==order.size||result.leaves.some(leave=>!order.has(leave.id)))throw Error('휴가 저장 순서가 올바르지 않습니다.');
   result.leaves.sort((a,b)=>order.get(a.id)-order.get(b.id));
  }
  if(parts.settings){
   if(!ID.test(parts.settings))throw Error('휴가 설정 저장 경로가 올바르지 않습니다.');
   const dir=await folder.getDirectoryHandle('설정'),settings=JSON.parse(await read(await dir.getFileHandle(parts.settings+'.json')));
   if(!settings||Object.keys(settings).some(key=>!['leaveTypes','leavePolicy'].includes(key)))throw Error('휴가 설정 자료를 확인하세요.');
   Object.assign(result,settings);
  }
  return result;
 }
 const leaveYearData=(state,year)=>({leaves:(state.leaves||[]).filter(leave=>leave.start.slice(0,4)===year),
  allowances:state.leaveAllowances?.[year]||{},hasAllowances:Object.hasOwn(state.leaveAllowances||{},year)});
 const leaveSettings=state=>Object.fromEntries(['leaveTypes','leavePolicy'].filter(key=>Object.hasOwn(state,key)).map(key=>[key,state[key]]));
 async function writeLeaves(directory,state,old,previousParts){
  const fields=leaveKeys.filter(key=>Object.hasOwn(state,key));
  if(!fields.length)return undefined;
  const years=[...new Set([...(state.leaves||[]).map(leave=>leave.start.slice(0,4)),...Object.keys(state.leaveAllowances||{})])];
  if(years.some(year=>!validYear(year)))throw Error('휴가 저장 연도를 확인하세요.');
  const folder=await (await directory.getDirectoryHandle('save',{create:true})).getDirectoryHandle('휴가',{create:true});
  const parts={fields,years:{},order:(state.leaves||[]).map(leave=>leave.id)};
  for(const year of years){
   const data=leaveYearData(state,year),previous=previousParts?.years?.[year];
   if(previous&&JSON.stringify(data)===JSON.stringify(leaveYearData(old,year)))parts.years[year]=previous;
   else{
    const revision=crypto.randomUUID(),dir=await folder.getDirectoryHandle(year,{create:true});
    await write(dir,revision+'.json',JSON.stringify(data,null,2));parts.years[year]=revision;
   }
  }
  const settings=leaveSettings(state);
  if(Object.keys(settings).length){
   if(previousParts?.settings&&JSON.stringify(settings)===JSON.stringify(leaveSettings(old)))parts.settings=previousParts.settings;
   else{
    const revision=crypto.randomUUID(),dir=await folder.getDirectoryHandle('설정',{create:true});
    await write(dir,revision+'.json',JSON.stringify(settings,null,2));parts.settings=revision;
   }
  }
  return parts;
 }
 async function open(directory,{folder='process',readOnly=false}={}){
  const save=readOnly?await optional(directory,folder,'directory'):await directory.getDirectoryHandle(folder,{create:true});if(!save)return null;const commits=readOnly?await optional(save,'commits','directory'):await save.getDirectoryHandle('commits',{create:true});if(!commits)return null;
  async function snapshot(){
   const records=[];
   for await(const [name,file] of commits.entries())if(file.kind==='file'&&/^[a-f0-9-]{36}\.json$/.test(name)){
    const raw=await read(file);if(!raw.trim())continue;
    const m=JSON.parse(raw);if(m.version!==1||m.id!==name.slice(0,-5)||!Array.isArray(m.parents)||!m.parts)throw Error('저장 이력이 손상되었습니다: '+name);records.push(m);
   }
   const ids=new Set(records.map(m=>m.id));
   if(records.some(m=>m.parents.some(id=>!ID.test(id)||!ids.has(id))))throw Error('저장 이력 일부가 없습니다. process 및 save 폴더 전체를 복구해 주세요.');
   const parents=new Set(records.flatMap(m=>m.parents)),heads=records.filter(m=>!parents.has(m.id));
   if(heads.length>1)throw Error('동시 저장 충돌: 양쪽 자료는 process와 save에 보존되었습니다. 현재 내용을 JSON 백업하고 관리자에게 저장 이력 복구를 요청하세요. 이력: '+heads.map(m=>m.id).join(', '));
   if(!heads.length){if(records.length)throw Error('저장 이력 연결이 손상되었습니다.');if(folder==='process'){const old=await open(directory,{folder:'save',readOnly:true});if(old){const text=await (await old.getFile()).text();if(text)return {text,manifest:null};}}let legacy=await optional(directory,LEGACY);if(!legacy&&folder==='process'){const archive=await optional(save,'legacy','directory');if(archive)legacy=await optional(archive,LEGACY);}return {text:legacy?await read(legacy):'',manifest:null};}
   const manifest=heads[0],state={};
   for(const [folder,id] of Object.entries(manifest.parts)){
    if(!['work','memo','leave','board','people','settings','assets','cards'].includes(folder)||!ID.test(id))throw Error('잘못된 저장 경로입니다.');
    const store=manifest.dataStore==='save'?await directory.getDirectoryHandle('save'):save;
    const dir=await store.getDirectoryHandle(folder),part=JSON.parse(await read(await dir.getFileHandle(id+'.json')));
    for(const key of Object.keys(part))if(group(key)!==folder||['__proto__','constructor','prototype'].includes(key))throw Error('잘못된 저장 항목입니다.');
    Object.assign(state,part);
   }
   if(manifest.personalParts){const users=await (await directory.getDirectoryHandle(manifest.personalStore==='save'?'save':'dist')).getDirectoryHandle('users');state.personal={};for(const [name,id] of Object.entries(manifest.personalParts)){if(!ID.test(id)||['__proto__','constructor','prototype'].includes(name))throw Error('잘못된 개인 저장 항목입니다.');const person=await users.getDirectoryHandle(encodeURIComponent(name));state.personal[name]=JSON.parse(await read(await person.getFileHandle(id+'.json')));}}
   if(manifest.postParts!==undefined)state.teamPosts=await readPosts(directory,manifest.postParts);
   if(manifest.leaveParts!==undefined)Object.assign(state,await readLeaves(directory,manifest.leaveParts));
   return {text:JSON.stringify(state,null,2),manifest};
  }
  return {name:folder,modular:true,queryPermission:options=>directory.queryPermission(options),requestPermission:options=>directory.requestPermission(options),
   async getFile(){const s=await snapshot();return {text:async()=>s.text};},
   async createWritable(options={}){if(readOnly)throw Error('이전 저장 폴더는 읽기 전용입니다.');const base=await snapshot();if(options.expectedText!==undefined&&base.text!==options.expectedText)throw Error("다른 사용자가 먼저 저장했습니다. 덮어쓰지 않았습니다.");let value,aborted=false;return {
    async write(text){value=String(text);JSON.parse(value);},async abort(){aborted=true;},
    async close(){
     if(aborted||value===undefined)throw Error('저장이 취소되었습니다.');
     const state=JSON.parse(value),parts={},old=base.text.trim()?JSON.parse(base.text):{},buckets={};
     for(const [key,item] of Object.entries(state))if(key!=='personal'&&key!=='teamPosts'&&!leaveKeys.includes(key))(buckets[group(key)]??={})[key]=item;
     const id=crypto.randomUUID(),personalParts={};if(state.personal){const users=await (await directory.getDirectoryHandle('save',{create:true})).getDirectoryHandle('users',{create:true});for(const [name,items] of Object.entries(state.personal)){if(!name||['__proto__','constructor','prototype'].includes(name))throw Error('잘못된 사용자 이름입니다.');if(base.manifest?.personalStore==='save'&&base.manifest.personalParts?.[name]&&JSON.stringify(old.personal?.[name])===JSON.stringify(items))personalParts[name]=base.manifest.personalParts[name];else{const person=await users.getDirectoryHandle(encodeURIComponent(name),{create:true});await write(person,id+'.json',JSON.stringify(items,null,2));personalParts[name]=id;}}}
     for(const [folder,data] of Object.entries(buckets)){
      const previous=Object.fromEntries(Object.entries(old).filter(([key])=>group(key)===folder&&key!=='teamPosts'&&!leaveKeys.includes(key)));
      const oldBoardIncludesPosts=folder==='board'&&base.manifest?.postParts===undefined&&old.teamPosts!==undefined;
      const oldLeaveIncludesRecords=folder==='leave'&&base.manifest?.leaveParts===undefined&&leaveKeys.some(key=>Object.hasOwn(old,key));
      if(base.manifest?.dataStore==='save'&&!oldBoardIncludesPosts&&!oldLeaveIncludesRecords&&base.manifest?.parts[folder]&&JSON.stringify(previous)===JSON.stringify(data))parts[folder]=base.manifest.parts[folder];
      else{const store=await directory.getDirectoryHandle('save',{create:true}),dir=await store.getDirectoryHandle(folder,{create:true});await write(dir,id+'.json',JSON.stringify(data,null,2));parts[folder]=id;}
     }
     const postParts=state.teamPosts===undefined?undefined:await writePosts(directory,state.teamPosts,old.teamPosts,base.manifest?.postParts);
     const leaveParts=await writeLeaves(directory,state,old,base.manifest?.leaveParts);
     if((await snapshot()).text!==base.text)throw Error('다른 사용자가 먼저 저장했습니다. 변경사항을 백업한 뒤 새로 읽어 주세요.');
     // Publish last: incomplete module writes never become visible; concurrent commits never overwrite each other.
     await write(commits,id+'.json',JSON.stringify({version:1,dataStore:'save',id,parents:base.manifest?[base.manifest.id]:[],parts,...(state.personal?{personalParts,personalStore:'save'}:{}),postParts,leaveParts,savedAt:state.savedAt,savedBy:state.savedBy},null,2));
     await snapshot();
    }
   };}
  };
 }
 const api={open,group};if(typeof module!=='undefined')module.exports=api;else root.BoardModularSave=api;
})(typeof window!=='undefined'?window:globalThis);
