(function(root){
 'use strict';
 const initial=()=>({polls:[],word:null,wheel:null});
 const wordGame=data=>data?.word?.version===2?data.word:{version:2,seed:'워크로그',entries:[],...(data?.word?{legacyGame:data.word}:{})};
 const text=(value,max=100)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
 function list(value,min=2,max=12){const values=String(value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(values.length<min||values.length>max||values.some(s=>s.length>40))throw Error(min+'~'+max+'개를 한 줄에 하나씩 입력하세요. (각 40자 이내)');return values;}
 function validateEntries(entries){
  if(!Array.isArray(entries)||entries.some(e=>!e||!text(e.id)||!text(e.author)||!/^[가-힣]{2,10}$/.test(e.word)||typeof e.createdAt!=='string'||!Number.isFinite(Date.parse(e.createdAt))||!validPoints(e,true))||new Set(entries.map(e=>e.id)).size!==entries.length)throw Error('끝말잇기 자료를 확인하세요.');
  let last='워크로그';const used=new Set([last]);for(const e of entries){if(used.has(e.word)||!starts(last.slice(-1)).includes(e.word[0]))throw Error('끝말잇기 연결을 확인하세요.');used.add(e.word);last=e.word;}
 }
 function participants(game){return [...new Set([...(game.participantNames||[]),...(game.entries||[]).map(e=>e.author),...(game.mistakes||[]).map(e=>e.author)])];}
 function scoreSize(game,actor){return Math.max(1,new Set([...participants(game),...(actor?[actor]:[])]).size);}
 function validPoints(item,success){return item.participants===undefined&&item.points===undefined||Number.isInteger(item.participants)&&item.participants>=1&&item.participants<=10000&&item.points===(success?item.participants-1:-item.participants);}
 function validateParticipants(game){if(game.participantNames!==undefined&&(!Array.isArray(game.participantNames)||game.participantNames.length>10000||new Set(game.participantNames).size!==game.participantNames.length||game.participantNames.some(name=>!text(name))))throw Error('끝말잇기 참여자 정보를 확인하세요.');}
 function validateMistakes(items){
  if(items===undefined)return;
  if(!Array.isArray(items)||new Set(items.map(e=>e?.id)).size!==items.length||items.some(e=>!e||!text(e.id)||!text(e.author)||!text(e.word,10)||!text(e.reason,200)||typeof e.createdAt!=='string'||!Number.isFinite(Date.parse(e.createdAt))||!validPoints(e,false)||e.points===undefined))throw Error('끝말잇기 오답 기록을 확인하세요.');
 }
 function scores(data,names=[]){
  const people=new Map(names.map(name=>[name,{name,successes:0,wrongs:0,forfeits:0,kills:0,score:0}]));
  const get=name=>{if(!people.has(name))people.set(name,{name,successes:0,wrongs:0,forfeits:0,kills:0,score:0});return people.get(name);};
  const count=game=>{const seen=new Set();for(const entry of game.entries||[]){seen.add(entry.author);const person=get(entry.author);person.successes++;person.score+=entry.points??seen.size-1;}for(const mistake of game.mistakes||[]){const person=get(mistake.author);person.wrongs++;person.score+=mistake.points;}};
  const game=wordGame(data);
  for(const round of game.rounds||[]){count(round);const person=get(round.by);person.forfeits++;person.score+=round.points??-scoreSize(round);if(round.killer)get(round.killer).kills++;}
  count(game);return [...people.values()];
 }
 function validate(data){
  if(data===undefined)return;
  if(!data||!Array.isArray(data.polls)||data.polls.length>100)throw Error('장난감 저장 자료를 확인하세요.');
  for(const p of data.polls){if(!p||!text(p.id)||!text(p.title,120)||!text(p.author)||typeof p.closed!=='boolean'||!Array.isArray(p.options)||p.options.length<2||p.options.length>12||p.options.some(s=>!text(s,40))||!p.ballots||typeof p.ballots!=='object'||Array.isArray(p.ballots)||Object.entries(p.ballots).some(([name,index])=>!text(name)||!Number.isInteger(index)||index<0||index>=p.options.length))throw Error('투표 자료를 확인하세요.');}
  const w=data.word;if(w){
   if(w.version===2){
    if(w.seed!=='워크로그')throw Error('끝말잇기 시작 단어를 확인하세요.');validateEntries(w.entries);validateMistakes(w.mistakes);validateParticipants(w);
    if(w.rounds!==undefined){
     if(!Array.isArray(w.rounds)||new Set(w.rounds.map(r=>r?.id)).size!==w.rounds.length)throw Error('끝말잇기 포기 기록을 확인하세요.');
     for(const r of w.rounds){if(!r||!text(r.id)||!text(r.by)||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt)))throw Error('끝말잇기 포기 기록을 확인하세요.');validateEntries(r.entries);validateMistakes(r.mistakes);validateParticipants(r);if(!validPoints(r,false))throw Error('끝말잇기 감점 기록을 확인하세요.');const last=r.entries.at(-1);if(!last||r.killer!==(last.author===r.by?'':last.author))throw Error('끝말잇기 점수 기록을 확인하세요.');}
    }
   }
   else if(!Array.isArray(w.players)||w.players.some(s=>!text(s,40))||!Array.isArray(w.words)||w.words.some(s=>!/^[가-힣]{2,10}$/.test(s)))throw Error('끝말잇기 자료를 확인하세요.');
  }
  const l=data.ladder;if(l&&(!Array.isArray(l.players)||l.players.length<2||l.players.length>12||!Array.isArray(l.prizes)||l.prizes.length!==l.players.length||[...l.players,...l.prizes].some(s=>!text(s,40))||!Array.isArray(l.rungs)||l.rungs.length>24||l.rungs.some(row=>!Array.isArray(row)||row.some((x,i)=>!Number.isInteger(x)||x<0||x>=l.players.length-1||i>0&&x<=row[i-1]+1))))throw Error('사다리 자료를 확인하세요.');
  const wheel=data.wheel;if(wheel&&(!Array.isArray(wheel.options)||wheel.options.length<2||wheel.options.length>12||wheel.options.some(s=>!text(s,40))||!Number.isInteger(wheel.index)||wheel.index<0||wheel.index>=wheel.options.length||!Array.isArray(wheel.history)||wheel.history.length>20||wheel.history.some(s=>!text(s,40))))throw Error('돌림판 자료를 확인하세요.');
 }
 function draw(max,random=Math.random){const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw Error('추첨 값을 만들지 못했습니다. 다시 시도하세요.');return Math.floor(value*max);}
 function starts(last){const cp=last.charCodeAt(0)-0xac00,first=Math.floor(cp/588),vowel=Math.floor(cp%588/28),tail=cp%28,values=[last];const changesToIeung=[2,3,6,7,12,17,20].includes(vowel);if(first===5)values.push(String.fromCharCode(0xac00+(changesToIeung?11:2)*588+vowel*28+tail));else if(first===2&&changesToIeung)values.push(String.fromCharCode(0xac00+11*588+vowel*28+tail));return [...new Set(values)];}
 function apply(data,action,input,{user,id=()=>crypto.randomUUID(),random=Math.random,admin=false,now=()=>new Date().toISOString()}={}){
  const next=structuredClone(data||initial());validate(next);if(!text(user))throw Error('로그인 후 이용하세요.');
  if(action==='pollCreate'){
   if(next.polls.length>=100)throw Error('기존 투표를 정리한 뒤 추가하세요.');const title=String(input.title||'').trim(),options=list(input.options);if(!text(title,120)||new Set(options).size!==options.length)throw Error('제목과 중복되지 않는 선택지를 입력하세요.');next.polls.unshift({id:id(),title,options,author:user,ballots:{},closed:false});
  }else if(['pollVote','pollClose','pollDelete'].includes(action)){
   const p=next.polls.find(p=>p.id===input.id);if(!p)throw Error('투표를 찾을 수 없습니다.');
   if(action==='pollVote'){const index=Number(input.index);if(p.closed)throw Error('마감된 투표입니다.');if(!Number.isInteger(index)||index<0||index>=p.options.length)throw Error('선택지를 확인하세요.');Object.defineProperty(p.ballots,user,{value:index,writable:true,enumerable:true,configurable:true});}
   else{if(p.author!==user&&!admin)throw Error('작성자 또는 관리자만 변경할 수 있습니다.');if(action==='pollClose')p.closed=!p.closed;else next.polls=next.polls.filter(v=>v.id!==p.id);}
  }else if(action==='wordAdd'){
   const w=structuredClone(wordGame(next)),word=String(input.word||'').trim(),last=w.entries.at(-1),previous=last?.word||w.seed;
   if(input.previous!==undefined&&input.previous!==(last?.id||w.seed))throw Error('다른 사용자가 먼저 입력했습니다. 최신 단어를 확인하세요.');
   if(!/^[가-힣]{2,6}$/.test(word))throw Error('한글 2~6글자의 단어를 입력하세요.');
   w.participantNames=[...new Set([...participants(w),user])];
   const n=scoreSize(w,user);
   const reason=word===w.seed||w.entries.some(e=>e.word===word)?'이미 나온 단어입니다.':!starts(previous.slice(-1)).includes(word[0])?starts(previous.slice(-1)).join(' / ')+'(으)로 시작하세요.':'';
   if(reason){(w.mistakes??=[]).push({id:id(),word,author:user,createdAt:now(),reason,participants:n,points:-n});}
   else w.entries.push({id:id(),word,author:user,createdAt:now(),participants:n,points:n-1});
   next.word=w;
  }else if(action==='wordForfeit'){
   const w=structuredClone(wordGame(next)),last=w.entries.at(-1);
   if(!last)throw Error('단어가 나온 뒤에 포기할 수 있습니다.');
   if(input.previous!==undefined&&input.previous!==last.id)throw Error('마지막 단어가 바뀌었습니다. 확인 후 다시 포기하세요.');
   (w.rounds??=[]).push({id:id(),by:user,killer:last.author===user?'':last.author,createdAt:now(),entries:w.entries,mistakes:w.mistakes||[],participantNames:participants(w),participants:scoreSize(w),points:-scoreSize(w)});
   w.entries=[];w.mistakes=[];w.participantNames=[];next.word=w;
  }else if(action==='wordUndo'){
   const w=structuredClone(wordGame(next)),last=w.entries.at(-1);
   if(!last)throw Error('되돌릴 단어가 없습니다.');
   if(last.author!==user&&!admin)throw Error('마지막 단어를 입력한 본인만 되돌릴 수 있습니다.');
   w.participantNames=participants(w);w.entries.pop();next.word=w;
  }else if(action==='wheelSpin'){
   const options=list(input.options),index=draw(options.length,random);next.wheel={options,index,history:[options[index],...(next.wheel?.history||[])].slice(0,20)};
  }else throw Error('지원하지 않는 장난감 동작입니다.');
  validate(next);return next;
 }
 const api={initial,wordGame,participants,scoreSize,scores,list,validate,draw,starts,apply};if(typeof module!=='undefined')module.exports=api;else root.BoardToys=api;
})(typeof window!=='undefined'?window:globalThis);
