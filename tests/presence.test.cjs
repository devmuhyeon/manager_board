const test=require('node:test'),assert=require('node:assert/strict'),Presence=require('../js/presence.js');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function directory(){const files=new Map();const handle=name=>({kind:'file',getFile:async()=>({size:(files.get(name)||'').length,text:async()=>files.get(name)}),createWritable:async()=>({write:async text=>files.set(name,text),close:async()=>{},abort:async()=>{}})});const folder={getFileHandle:async name=>handle(name),removeEntry:async name=>files.delete(name),async *entries(){for(const name of [...files.keys()])yield [name,handle(name)];}};return {files,queryPermission:async()=> 'granted',getDirectoryHandle:async name=>{assert.equal(name,Presence.FOLDER);return folder;}};}
const members=Array.from({length:8},(_,i)=>({name:'인원'+i,avatar:'yongyong',active:true}));
test('공용 폴더의 두 접속자가 서로 보이고 로그아웃 및 만료가 반영된다',async()=>{
 let now=100000;const dir=directory(),create=id=>Presence.create({now:()=>now,id:()=>id,interval:()=>1,clear:()=>{}}),a=create('a'),b=create('b');
 await a.setSession({directory:dir,user:members[0],members});now+=10;await b.setSession({directory:dir,user:members[1],members});await a.refresh();assert.deepEqual(a.snapshot().people.map(p=>p.name),['인원0','인원1']);assert.equal(a.snapshot().connected,true);
 await b.stop();await a.refresh();assert.deepEqual(a.snapshot().people.map(p=>p.name),['인원0']);
 await b.setSession({directory:dir,user:members[1],members});now+=Presence.TTL+1;await a.refresh();assert.deepEqual(a.snapshot().people.map(p=>p.name),['인원0']);await a.stop();await b.stop();assert.equal(dir.files.size,0);
});
test('같은 사람의 여러 탭은 하나로 표시하며 가장 최근 프로필을 사용한다',()=>{
 const row={version:1,name:'인원0',avatar:'yongyong',joinedAt:100,updatedAt:200};const rows=Presence.online([row,{...row,joinedAt:150,updatedAt:210,avatar:'kitty'},{...row,name:'퇴사자'}],members,220);assert.equal(rows.length,1);assert.equal(rows[0].joinedAt,100);assert.equal(rows[0].avatar,'kitty');
 assert.equal(Presence.online([{...row,updatedAt:NaN},{...row,avatar:'unknown'},{...row,updatedAt:0}],members,Presence.TTL+500).length,0);
});
test('이미지는 최대 5개와 초과 인원 원형 숫자로 표시하고 이름을 이스케이프한다',()=>{
 const people=members.map(m=>({...m,joinedAt:1}));const html=Presence.render({people,connected:true},esc);assert.equal((html.match(/<img /g)||[]).length,5);assert.match(html,/>\+3<\/span>/);assert.match(html,/title="인원0"/);assert.match(html,/인원5, 인원6, 인원7/);
 assert.ok(!Presence.render({people:people.slice(0,5),connected:true},esc).includes('online-overflow'));
 assert.match(Presence.render({people:[{...people[0],name:'<img>'}],connected:true},esc),/title="&lt;img&gt;"/);
});
test('권한 상실과 잘못된 접속 파일은 다른 사용자 접속을 추측하지 않는다',async()=>{
 const dir=directory(),client=Presence.create({now:()=>10000,id:()=> 'test',interval:()=>1,clear:()=>{}});dir.files.set('session-broken.json','invalid');
 await client.setSession({directory:dir,user:members[0],members});assert.equal(client.snapshot().people.length,1);dir.queryPermission=async()=> 'denied';await client.refresh();assert.equal(client.snapshot().connected,false);assert.equal(client.snapshot().people.length,1);await client.stop();assert.deepEqual(client.snapshot().people,[]);
});
