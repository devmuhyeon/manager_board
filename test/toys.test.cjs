const test=require('node:test'),assert=require('node:assert/strict'),T=require('../source/html/toys/model.js');
const options={user:'김무현',id:()=> 'poll-1',random:()=>.25};
test('투표는 1인 1표로 변경·집계하며 마감과 삭제 권한을 검사한다',()=>{
 const first=T.apply(undefined,'pollCreate',{title:'점심',options:'한식\n중식'},options);
 let next=T.apply(first,'pollVote',{id:'poll-1',index:0},options);
 next=T.apply(next,'pollVote',{id:'poll-1',index:1},options);
 next=T.apply(next,'pollVote',{id:'poll-1',index:0},{user:'정윤정'});
 assert.deepEqual(next.polls[0].ballots,{'김무현':1,'정윤정':0});assert.deepEqual(first.polls[0].ballots,{});
 assert.throws(()=>T.apply(next,'pollDelete',{id:'poll-1'},{user:'정윤정'}),/작성자/);
 next=T.apply(next,'pollClose',{id:'poll-1'},options);
 assert.throws(()=>T.apply(next,'pollVote',{id:'poll-1',index:1},options),/마감/);
 next=T.apply(next,'pollClose',{id:'poll-1'},{user:'관리자',admin:true});
 assert.equal(next.polls[0].closed,false);
 assert.equal(T.apply(next,'pollDelete',{id:'poll-1'},options).polls.length,0);
 assert.throws(()=>T.apply(undefined,'pollCreate',{title:'중복',options:'하나\n하나'},options));
});
test('끝말잇기는 순서·중복·한글·두음법칙을 확인하고 한 수 되돌릴 수 있다',()=>{
 let data=T.apply(undefined,'wordStart',{players:'가\n나'},options);
 for(const word of ['기차','차도','도리','이름'])data=T.apply(data,'wordAdd',{word},options);
 assert.equal(data.word.words.length,4);assert.equal(data.word.players[data.word.words.length%2],'가');
 assert.throws(()=>T.apply(data,'wordAdd',{word:'기차'},options),/이미/);
 assert.throws(()=>T.apply(data,'wordAdd',{word:'사과'},options),/름/);
 assert.throws(()=>T.apply(data,'wordAdd',{word:'abc'},options),/한글/);
 assert.equal(T.apply(data,'wordUndo',{},options).word.words.length,3);
 assert.deepEqual(T.starts('락'),['락','낙']);assert.deepEqual(T.starts('녀'),['녀','여']);
 assert.throws(()=>T.apply(data,'wordStart',{players:'가\n가'},options),/서로/);
});
test('사다리는 모든 인원에게 겹치지 않는 도착점을 배정하고 경로가 가로선과 일치한다',()=>{
 let seed=123;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(let n=2;n<=12;n++){
  const data=T.apply(undefined,'ladderDraw',{players:Array.from({length:n},(_,i)=>'인원'+i).join('\n'),prizes:Array.from({length:n},(_,i)=>'결과'+i).join('\n')},{...options,random});
  const ends=[];for(let i=0;i<n;i++){const route=T.path(data.ladder,i);ends.push(route.end);assert.equal(route.points.length,34);assert.ok(route.points.every(([x])=>x>=0&&x<n));}
  assert.equal(new Set(ends).size,n);assert.doesNotThrow(()=>T.validate(data));
 }
 assert.throws(()=>T.apply(undefined,'ladderDraw',{players:'가\n나',prizes:'1\n2\n3'},options),/개수/);
});
test('돌림판의 당첨 인덱스·최근 기록과 잘못된 저장 자료를 검증한다',()=>{
 let data=T.apply(undefined,'wheelSpin',{options:'한식\n중식\n일식\n분식'},options);
 assert.equal(data.wheel.index,1);assert.equal(data.wheel.history[0],'중식');
 for(let i=0;i<25;i++)data=T.apply(data,'wheelSpin',{options:'가\n나'},{...options,random:()=>.99});
 assert.equal(data.wheel.index,1);assert.equal(data.wheel.history.length,20);
 assert.throws(()=>T.apply(data,'wheelSpin',{options:'가\n나'},{...options,random:()=>1}));
 assert.throws(()=>T.validate({polls:[],wheel:{options:['가','나'],index:9,history:[]}}));
 assert.throws(()=>T.validate({polls:[{id:'bad'}]}));
});
