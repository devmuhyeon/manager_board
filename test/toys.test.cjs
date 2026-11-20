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
test('끝말잇기는 워크로그에서 시작하고 로그인 사용자 이름으로 기록하며 계속 이어진다',()=>{
 let seq=0;const context={...options,id:()=> 'word-'+(++seq)};
 let data;for(const word of ['그림','임금','금리','이름'])data=T.apply(data,'wordAdd',{word,author:'가짜 작성자'},context);
 assert.equal(data.word.seed,'워크로그');assert.equal(data.word.entries.length,4);assert.ok(data.word.entries.every(e=>e.author==='김무현'));
 assert.throws(()=>T.apply(data,'wordAdd',{word:'그림'},context),/이미/);
 assert.throws(()=>T.apply(data,'wordAdd',{word:'사과'},context),/름/);
 assert.throws(()=>T.apply(data,'wordAdd',{word:'abc'},context),/한글/);
 assert.throws(()=>T.apply(undefined,'wordAdd',{word:'그가나다라마바'},context),/2~6/);
 assert.equal(T.apply(undefined,'wordAdd',{word:'그가나다라마'},context).word.entries[0].word.length,6);
 assert.throws(()=>T.apply(data,'wordAdd',{word:'름름',previous:'old'},context),/먼저/);
 assert.throws(()=>T.apply(data,'wordUndo',{}, {user:'정윤정'}),/본인/);
 assert.equal(T.apply(data,'wordUndo',{},context).word.entries.length,3);
 assert.equal(T.wordGame().seed,'워크로그');
 assert.deepEqual(T.starts('락'),['락','낙']);assert.deepEqual(T.starts('녀'),['녀','여']);
 const old={polls:[],word:{players:['가','나'],words:['기차']},ladder:null,wheel:null};
 const migrated=T.apply(old,'wordAdd',{word:'그림'},{...context,user:'정윤정'});
 assert.deepEqual(migrated.word.legacyGame,old.word);assert.equal(migrated.word.entries[0].author,'정윤정');
 assert.equal(old.word.words[0],'기차');assert.throws(()=>T.apply(data,'wordStart',{players:'가\n나'},context),/지원/);
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

test('식사추천은 공식 목록에서 무작위로 고르고 직전 추천은 연속으로 나오지 않는다',()=>{
 const M=require('../source/html/toys/meal.js'),rows=M.catalog.restaurants;
 assert.equal(rows.length,303);assert.ok(rows.every(r=>r.area==='음성'));assert.equal(rows.filter(r=>r.area==='진천').length,0);
 assert.ok(rows.every(r=>r.name&&r.address&&/음성군 맹동면 (두성리|동성리)/.test(r.lot)));
 assert.equal(new Set(rows.map(r=>r.name+'|'+r.address)).size,rows.length);
 assert.equal(M.today(new Date('2026-11-20T14:59:59Z')),'2026-11-20');assert.equal(M.today(new Date('2026-11-20T15:00:00Z')),'2026-11-21');
 const first=M.pick('',()=>0);assert.equal(first.id,rows[0].id);
 assert.equal(M.pick('',()=>.999999).id,rows.at(-1).id);
 assert.notEqual(M.pick(first.id,()=>0).id,first.id);
 assert.throws(()=>M.pick('',()=>1));assert.throws(()=>M.pick('',()=>NaN));
 assert.ok(M.search(rows[0].name).some(r=>r.id===rows[0].id));assert.equal(M.search('없는음식점xyz').length,0);
});
