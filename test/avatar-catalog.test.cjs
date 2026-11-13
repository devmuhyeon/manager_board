const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Avatars=require('../source/js/avatar-catalog.js'),C=require('./core-fixture.cjs'),P=require('./people-fixture.cjs');
test('프로필 목록 전체의 파일이 존재하고 선택은 저장·복원 후 유지된다',()=>{
 const state=P.upgrade(C.sampleState());assert.equal(Avatars.characters.length,27);assert.equal(new Set(Avatars.keys).size,27);
 for(const [key,name,file] of Avatars.characters){assert.ok(name);const image=fs.readFileSync(path.join(__dirname,'../source/images/keis',file));assert.ok(image.length>0,file);
 const changed=P.setAvatar(state,'김무현',key),loaded=C.validateState(JSON.parse(JSON.stringify(changed)));assert.equal(loaded.members.find(m=>m.name==='김무현').avatar,key);assert.equal(changed.members.find(m=>m.name==='정윤정').avatar,state.members.find(m=>m.name==='정윤정').avatar);
 }
 assert.throws(()=>P.setAvatar(state,'김무현','../../unknown'));
});
