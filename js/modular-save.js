(function(root){
 'use strict';
 const LEGACY='통합관리 대시보드.json',ID=/^[a-f0-9-]{36}$/;
 const group=key=>key==='projects'?'work':key==='personal'?'memo':/leave/i.test(key)?'leave':/post|board/i.test(key)?'board':/member|account|remov/i.test(key)?'people':'settings';
 async function optional(dir,name,kind='file'){try{return await dir[kind==='file'?'getFileHandle':'getDirectoryHandle'](name);}catch(e){if(e.name==='NotFoundError')return null;throw e;}}
 async function read(file){return (await file.getFile()).text();}
 async function write(dir,name,text){const file=await dir.getFileHandle(name,{create:true}),stream=await file.createWritable();try{await stream.write(text);await stream.close();}catch(e){try{await stream.abort();}catch{}throw e;}}
 async function open(directory){
  const save=await directory.getDirectoryHandle('save',{create:true}),commits=await save.getDirectoryHandle('commits',{create:true});
  async function snapshot(){
   const records=[];
   for await(const [name,file] of commits.entries())if(file.kind==='file'&&/^[a-f0-9-]{36}\.json$/.test(name)){
    const raw=await read(file);if(!raw.trim())continue;
    const m=JSON.parse(raw);if(m.version!==1||m.id!==name.slice(0,-5)||!Array.isArray(m.parents)||!m.parts)throw Error('저장 이력이 손상되었습니다: '+name);records.push(m);
   }
   const ids=new Set(records.map(m=>m.id));
   if(records.some(m=>m.parents.some(id=>!ID.test(id)||!ids.has(id))))throw Error('저장 이력 일부가 없습니다. save 폴더 전체를 복구해 주세요.');
   const parents=new Set(records.flatMap(m=>m.parents)),heads=records.filter(m=>!parents.has(m.id));
   if(heads.length>1)throw Error('동시 저장 충돌: 양쪽 자료는 save에 보존되었습니다. 현재 내용을 JSON 백업하고 관리자에게 저장 이력 복구를 요청하세요. 이력: '+heads.map(m=>m.id).join(', '));
   if(!heads.length){if(records.length)throw Error('저장 이력 연결이 손상되었습니다.');const legacy=await optional(directory,LEGACY);return {text:legacy?await read(legacy):'',manifest:null};}
   const manifest=heads[0],state={};
   for(const [folder,id] of Object.entries(manifest.parts)){
    if(!['work','memo','leave','board','people','settings'].includes(folder)||!ID.test(id))throw Error('잘못된 저장 경로입니다.');
    const dir=await save.getDirectoryHandle(folder),part=JSON.parse(await read(await dir.getFileHandle(id+'.json')));
    for(const key of Object.keys(part))if(group(key)!==folder||['__proto__','constructor','prototype'].includes(key))throw Error('잘못된 저장 항목입니다.');
    Object.assign(state,part);
   }
   return {text:JSON.stringify(state,null,2),manifest};
  }
  return {name:'save',modular:true,queryPermission:options=>directory.queryPermission(options),requestPermission:options=>directory.requestPermission(options),
   async getFile(){const s=await snapshot();return {text:async()=>s.text};},
   async createWritable(options={}){const base=await snapshot();if(options.expectedText!==undefined&&base.text!==options.expectedText)throw Error("다른 사용자가 먼저 저장했습니다. 덮어쓰지 않았습니다.");let value,aborted=false;return {
    async write(text){value=String(text);JSON.parse(value);},async abort(){aborted=true;},
    async close(){
     if(aborted||value===undefined)throw Error('저장이 취소되었습니다.');
     const state=JSON.parse(value),parts={},old=base.text.trim()?JSON.parse(base.text):{},buckets={};
     for(const [key,item] of Object.entries(state))(buckets[group(key)]??={})[key]=item;
     const id=crypto.randomUUID();
     for(const [folder,data] of Object.entries(buckets)){
      const previous=Object.fromEntries(Object.entries(old).filter(([key])=>group(key)===folder));
      if(base.manifest?.parts[folder]&&JSON.stringify(previous)===JSON.stringify(data))parts[folder]=base.manifest.parts[folder];
      else{const dir=await save.getDirectoryHandle(folder,{create:true});await write(dir,id+'.json',JSON.stringify(data,null,2));parts[folder]=id;}
     }
     if((await snapshot()).text!==base.text)throw Error('다른 사용자가 먼저 저장했습니다. 변경사항을 백업한 뒤 새로 읽어 주세요.');
     // Publish last: incomplete module writes never become visible; concurrent commits never overwrite each other.
     await write(commits,id+'.json',JSON.stringify({version:1,id,parents:base.manifest?[base.manifest.id]:[],parts,savedAt:state.savedAt,savedBy:state.savedBy},null,2));
     await snapshot();
    }
   };}
  };
 }
 const api={open,group};if(typeof module!=='undefined')module.exports=api;else root.BoardModularSave=api;
})(typeof window!=='undefined'?window:globalThis);
