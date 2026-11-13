const test=require('node:test'),assert=require('node:assert/strict'),M=require('../source/js/modular-save.js');
function directory(name='root'){
 const children=new Map();return {kind:'directory',name,children,queryPermission:async()=> 'granted',async *entries(){yield* children;},
 async getDirectoryHandle(name,options={}){if(!children.has(name)){if(!options.create)throw Object.assign(Error(),{name:'NotFoundError'});children.set(name,directory(name));}return children.get(name);},
 async getFileHandle(name,options={}){if(!children.has(name)){if(!options.create)throw Object.assign(Error(),{name:'NotFoundError'});const file={kind:'file',name,value:'',getFile:async()=>({text:async()=>file.value}),createWritable:async()=>{let pending;return {write:async value=>{pending=value;},close:async()=>{if(file.fail)throw Error('network failure');file.value=pending;},abort:async()=>{}}}};children.set(name,file);}return children.get(name);}};
}
const read=async h=>(await h.getFile()).text();
const save=async(h,state)=>{const w=await h.createWritable();await w.write(JSON.stringify(state));await w.close();};
test('legacy migration preserves original, splits modules and reuses unchanged data',async()=>{
 const dir=directory(),legacy=await dir.getFileHandle('통합관리 대시보드.json',{create:true});legacy.value=JSON.stringify({revision:0,projects:[{id:'a'}],personal:{A:[]},members:[]});
 const original=legacy.value,h=await M.open(dir);assert.equal(await read(h),original);
 await save(h,{revision:1,projects:[{id:'a'}],personal:{A:[]},members:[]});
 const first=JSON.parse(await read(h));assert.equal(first.projects[0].id,'a');
 await save(h,{...first,revision:2,personal:{A:[{id:'memo'}]}});
 const folder=dir.children.get('process');assert.equal(folder.children.get('work').children.size,1);assert.equal(dir.children.get('dist').children.get('users').children.get('A').children.size,2);assert.equal(legacy.value,original);assert.equal(JSON.parse(await read(h)).revision,2);
});
test('stale writer is rejected and interrupted module save never publishes',async()=>{
 const dir=directory(),h=await M.open(dir);await save(h,{revision:1,projects:[]});const base=await read(h),stale=await h.createWritable({expectedText:base});await stale.write('{"revision":2,"projects":[1]}');
 await save(h,{revision:2,projects:[2]});await assert.rejects(stale.close(),/다른 사용자/);assert.deepEqual(JSON.parse(await read(h)).projects,[2]);
 await assert.rejects(h.createWritable({expectedText:base}),/다른 사용자/);
 const stream=await h.createWritable();await stream.write('{"revision":3}');await stream.abort();await assert.rejects(stream.close());assert.equal(JSON.parse(await read(h)).revision,2);
});
test('concurrent branches remain intact and block ambiguous reads',async()=>{
 const dir=directory(),h=await M.open(dir);await save(h,{revision:1,projects:[]});
 const commits=dir.children.get('process').children.get('commits'),first=[...commits.children.values()][0],record=JSON.parse(first.value);
 for(const id of ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222']){const f=await commits.getFileHandle(id+'.json',{create:true});f.value=JSON.stringify({...record,id,parents:[record.id]});}
 await assert.rejects(h.getFile(),/동시 저장 충돌/);assert.equal(commits.children.size,3);await assert.rejects(h.createWritable(),/동시 저장 충돌/);
});
test('a failed publish leaves previous snapshot readable',async()=>{
 const dir=directory(),h=await M.open(dir);await save(h,{revision:1,projects:[]});const commits=dir.children.get('process').children.get('commits'),original=commits.getFileHandle.bind(commits);
 commits.getFileHandle=async(...args)=>{const file=await original(...args);if(args[1]?.create)file.fail=true;return file;};
 await assert.rejects(save(h,{revision:2,projects:[2]}),/network failure/);assert.equal(JSON.parse(await read(h)).revision,1);
});
test('two truly overlapping publications retain both snapshots',async()=>{
 const dir=directory(),a=await M.open(dir),b=await M.open(dir),commits=dir.children.get('process').children.get('commits'),original=commits.getFileHandle.bind(commits);
 let arrived=0,release;const gate=new Promise(resolve=>release=resolve);
 commits.getFileHandle=async(...args)=>{const file=await original(...args);if(args[1]?.create){const create=file.createWritable;file.createWritable=async()=>{const stream=await create();return {...stream,close:async()=>{await stream.close();if(++arrived===2)release();await gate;}};};}return file;};
 const results=await Promise.allSettled([save(a,{revision:1,projects:[{id:'A'}]}),save(b,{revision:1,projects:[{id:'B'}]})]);
 assert.ok(results.some(r=>r.status==='rejected'));assert.equal(commits.children.size,2);
 const work=dir.children.get('process').children.get('work');assert.deepEqual([...work.children.values()].map(f=>JSON.parse(f.value).projects[0].id).sort(),['A','B']);
 await assert.rejects(a.getFile(),/동시 저장 충돌/);
});
test('complete existing application state survives split save and validation',async()=>{
 const C=require('./core-fixture.cjs'),P=require('./people-fixture.cjs'),state=P.addSamples(P.upgrade(C.sampleState())),h=await M.open(directory());
 await save(h,state);const restored=C.validateState(JSON.parse(await read(h)));
 assert.deepEqual(restored,state);
});

test('previous save modules migrate without modifying old files, with personal data under dist',async()=>{
 const dir=directory(),old=await dir.getDirectoryHandle('save',{create:true}),work=await old.getDirectoryHandle('work',{create:true}),memo=await old.getDirectoryHandle('memo',{create:true}),commits=await old.getDirectoryHandle('commits',{create:true}),id='11111111-1111-4111-8111-111111111111';
 const w=await work.getFileHandle(id+'.json',{create:true}),m=await memo.getFileHandle(id+'.json',{create:true}),c=await commits.getFileHandle(id+'.json',{create:true});w.value=JSON.stringify({projects:[{id:'old'}]});m.value=JSON.stringify({personal:{'김무현':[{id:'a',title:'보존'}]}});c.value=JSON.stringify({version:1,id,parents:[],parts:{work:id,memo:id}});const before=[w.value,m.value,c.value];
 const h=await M.open(dir),state=JSON.parse(await read(h));assert.equal(state.personal['김무현'][0].title,'보존');await save(h,{...state,revision:1});assert.deepEqual([w.value,m.value,c.value],before);assert.ok(dir.children.get('dist').children.get('users').children.has(encodeURIComponent('김무현')));assert.deepEqual(JSON.parse(await read(h)).personal,state.personal);
});
