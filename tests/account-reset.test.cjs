const test=require('node:test'),assert=require('node:assert/strict'),R=require('../js/account-reset.js');
test('전체 비밀번호 초기화는 업무 자료를 유지하고 한 번만 적용한다',()=>{
 const state={accounts:{a:{hash:'old'},b:{hash:'old'}},projects:[{id:'work'}],members:[{name:'a'}]};
 const reset=R.apply(state);assert.deepEqual(reset.accounts,{});assert.equal(reset.projects,state.projects);assert.equal(reset.members,state.members);assert.equal(Object.keys(state.accounts).length,2);
 reset.accounts.a={hash:'new'};assert.equal(R.apply(reset).accounts.a.hash,'new');
});
