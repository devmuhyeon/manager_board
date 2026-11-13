const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('./core-fixture.cjs'),P=require('./people-fixture.cjs'),Preview=require('./preview-data.js'),Avatars=require('../source/js/avatar-catalog.js'),Hero=require('../source/js/briefing-hero.js'),Dashboard=require('../source/js/briefing-dashboard.js');
test('development fixtures fill every section without replacing accounts, avatars or edited data',()=>{
 const state=P.upgrade({...C.sampleState(),demo:false});state.accounts={김무현:{salt:'existing',hash:'existing',iterations:150000}};state.members.find(m=>m.name==='김무현').avatar='kitty';
 const original=structuredClone(state),filled=Preview.ensure(state,C,P);
 assert.deepEqual(state,original);assert.deepEqual(filled.accounts,original.accounts);assert.equal(filled.members.find(m=>m.name==='김무현').avatar,'kitty');assert.ok(filled.projects.length>=36);assert.ok(filled.teamPosts.length>=36);assert.ok(filled.leaves.length>=20);assert.ok(Object.values(filled.personal).every(items=>items.length>=12));
 filled.projects.find(p=>p.id==='ux-preview:0').title='수정한 샘플';assert.equal(Preview.ensure(filled,C,P),filled);assert.equal(filled.projects.find(p=>p.id==='ux-preview:0').title,'수정한 샘플');C.validateState(filled);
});
test('custom character survives shared JSON and generates a pink briefing with safe image source',()=>{
 const item={id:'custom-11111111-1111-4111-8111-111111111111',name:'직접 추가',src:'data:image/png;base64,aGVsbG8='};
 let state=P.upgrade(C.sampleState());state.customAvatars=[item];state=P.setAvatar(state,'김무현',item.id);state=C.validateState(JSON.parse(JSON.stringify(state)));Avatars.sync(state.customAvatars);
 try{const user=state.members.find(m=>m.name==='김무현'),normal=Hero.defaults(user,'normal');assert.equal(normal.bgStart,'#feebf8');assert.equal(normal.title,'#bd005b');const html=Hero.render({user,rows:[],C,N:{teamLabel:v=>v},esc:v=>v,record:{mode:'normal',normal}});assert.ok(html.includes('src="'+item.src+'"'));assert.ok(!html.includes('../images/keis/data:'));assert.equal(require('../source/js/modular-save.js').group('customAvatars'),'assets');
 assert.throws(()=>C.validateState({...state,customAvatars:[]}));assert.throws(()=>Avatars.validateCustom([{...item,src:'data:image/svg+xml;base64,aGVsbG8='}]));assert.throws(()=>Avatars.validateCustom([item,item]));}finally{Avatars.sync();}
});
test('my schedule merges personal dates and project deadlines without duplicates or other people memos',()=>{
 const state=Preview.create(C,P),user=state.members.find(m=>m.name==='김무현'),items=Dashboard.schedule(state,user,C,P);
 assert.ok(items.some(i=>i.id.startsWith('memo:')));assert.ok(items.some(i=>i.projectId));assert.equal(new Set(items.map(i=>i.id)).size,items.length);
 assert.ok(items.filter(i=>!i.projectId).every(i=>state.personal[user.name].some(m=>'memo:'+m.id===i.id)));
});
test('all authored margin and padding lengths follow the four pixel grid',()=>{
 for(const name of fs.readdirSync('source').filter(n=>n.endsWith('.css'))){const css=fs.readFileSync('source/css/'+name,'utf8');for(const declaration of css.matchAll(/(?:padding|margin)(?:-[a-z]+)?\s*:\s*([^;}]+)/g))for(const value of declaration[1].matchAll(/(-?(?:\d*\.)?\d+)(px|rem|em|%)/g)){assert.equal(value[2],'px',name+': '+declaration[0]);assert.equal(Math.abs(Number(value[1]))%4,0,name+': '+declaration[0]);}}
});
