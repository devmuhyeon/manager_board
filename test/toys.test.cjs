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
 assert.match(T.apply(data,'wordAdd',{word:'그림'},context).word.mistakes.at(-1).reason,/이미/);
 assert.match(T.apply(data,'wordAdd',{word:'사과'},context).word.mistakes.at(-1).reason,/름/);
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

test('포기 횟수와 kill은 로그인 사용자와 직전 작성자로 계산하고 판 기록을 보존한다',()=>{
 let seq=0;const context={user:'김무현',id:()=> 'event-'+(++seq),now:()=> '2026-11-20T07:00:00Z'};
 assert.throws(()=>T.apply(undefined,'wordForfeit',{},context),/단어가 나온 뒤/);
 const first=T.apply(undefined,'wordAdd',{word:'그림'},context),last=first.word.entries.at(-1);
 assert.throws(()=>T.apply(first,'wordForfeit',{previous:'old'},{...context,user:'정윤정'}),/바뀌었습니다/);
 const next=T.apply(first,'wordForfeit',{previous:last.id,by:'김무현',killer:'홍소영'},{...context,user:'정윤정'});
 assert.equal(next.word.entries.length,0);assert.equal(next.word.seed,'워크로그');
 assert.equal(next.word.rounds[0].by,'정윤정');assert.equal(next.word.rounds[0].killer,'김무현');
 assert.deepEqual(next.word.rounds[0].entries,first.word.entries);assert.equal(first.word.entries.length,1);
 const scores=T.scores(next,['김무현','정윤정','홍소영']);
 assert.deepEqual(scores,[{name:'김무현',successes:1,wrongs:0,forfeits:0,kills:1,score:0},{name:'정윤정',successes:0,wrongs:0,forfeits:1,kills:0,score:-1},{name:'홍소영',successes:0,wrongs:0,forfeits:0,kills:0,score:0}]);
 assert.throws(()=>T.apply(next,'wordForfeit',{previous:last.id},{...context,user:'정윤정'}),/단어가 나온 뒤/);
 let again=T.apply(next,'wordAdd',{word:'그림'},context);again=T.apply(again,'wordForfeit',{},context);
 assert.deepEqual(T.scores(again,['김무현'])[0],{name:'김무현',successes:2,wrongs:0,forfeits:1,kills:1,score:-1});
 assert.equal(again.word.rounds.length,2);assert.doesNotThrow(()=>T.validate(JSON.parse(JSON.stringify(again))));
 const invalid=structuredClone(again);invalid.word.rounds[0].killer='홍소영';assert.throws(()=>T.validate(invalid),/점수/);
});

test('현재 판 제출 인원 n으로 성공 n-1점과 오답·포기 -n점을 당시 값으로 저장한다',()=>{
 let seq=0;const ctx={id:()=> 'score-'+(++seq),now:()=> '2026-11-23T06:00:00Z'};
 let data=T.apply(undefined,'wordAdd',{word:'그림',participants:99,points:999},{...ctx,user:'A'});
 assert.deepEqual([data.word.entries[0].participants,data.word.entries[0].points],[1,0]);
 data=T.apply(data,'wordAdd',{word:'임금'},{...ctx,user:'B'});
 assert.deepEqual([data.word.entries[1].participants,data.word.entries[1].points],[2,1]);
 data=T.apply(data,'wordAdd',{word:'사과'},{...ctx,user:'C'});
 assert.equal(data.word.entries.length,2);assert.deepEqual([data.word.mistakes[0].participants,data.word.mistakes[0].points],[3,-3]);
 assert.deepEqual(T.participants(data.word),['A','B','C']);
 data=T.apply(data,'wordAdd',{word:'금리'},{...ctx,user:'A'});
 assert.equal(data.word.entries[2].points,2);assert.equal(data.word.entries[1].points,1);
 data=T.apply(data,'wordAdd',{word:'이름'},{...ctx,user:'D'});
 assert.equal(data.word.entries[3].points,3);
 const tip=data.word.entries.at(-1).id;
 assert.throws(()=>T.apply(data,'wordAdd',{word:'름름',previous:'old'},{...ctx,user:'A'}),/먼저/);
 assert.throws(()=>T.apply(data,'wordAdd',{word:''},{...ctx,user:'A'}),/한글/);
 assert.equal(data.word.mistakes.length,1);
 data=T.apply(data,'wordForfeit',{previous:tip},{...ctx,user:'B'});
 assert.equal(data.word.rounds[0].points,-4);assert.equal(data.word.rounds[0].mistakes.length,1);assert.equal(T.participants(data.word).length,0);
 const scores=Object.fromEntries(T.scores(data).map(row=>[row.name,row]));
 assert.equal(scores.A.score,2);assert.equal(scores.B.score,-3);assert.equal(scores.C.score,-3);assert.equal(scores.C.wrongs,1);assert.equal(scores.D.score,3);
 data=T.apply(data,'wordAdd',{word:'그림'},{...ctx,user:'A'});assert.equal(data.word.entries[0].points,0);
 assert.doesNotThrow(()=>T.validate(JSON.parse(JSON.stringify(data))));
 const bad=structuredClone(data);bad.word.entries[0].points=20;assert.throws(()=>T.validate(bad));
});

test('되돌리기는 성공 가점을 취소하지만 판에 참여한 이력은 유지한다',()=>{
 let seq=0;const ctx={id:()=> 'undo-score-'+(++seq)};
 let data=T.apply(undefined,'wordAdd',{word:'그림'},{...ctx,user:'A'});
 data=T.apply(data,'wordAdd',{word:'임금'},{...ctx,user:'B'});
 assert.equal(T.scores(data).find(p=>p.name==='B').score,1);
 data=T.apply(data,'wordUndo',{}, {...ctx,user:'B'});
 assert.deepEqual(T.participants(data.word),['A','B']);
 assert.equal(T.scores(data,['B']).find(p=>p.name==='B').score,0);
 data=T.apply(data,'wordAdd',{word:'임금'}, {...ctx,user:'A'});
 assert.equal(data.word.entries.at(-1).participants,2);assert.equal(data.word.entries.at(-1).points,1);
});
