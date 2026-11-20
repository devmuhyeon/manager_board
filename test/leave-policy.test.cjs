const test=require('node:test'),assert=require('node:assert/strict'),L=require('../source/js/leave-policy.js');
const policy=hire=>({leavePolicy:{version:2,enabled:true,...L.statutory(),hires:{A:hire}}});
test('법정 기본값은 근속 범위와 21년 이상 최대 25일로 구성된다',()=>{
 const s=policy('2000-01-01');
 L.validate(s.leavePolicy);
 assert.deepEqual(s.leavePolicy.grants[0],{from:1,to:2,days:15});
 assert.deepEqual(s.leavePolicy.grants[1],{from:3,to:4,days:16});
 assert.deepEqual(s.leavePolicy.cap,{from:21,days:25});
 for(const [hire,days] of [['2025-01-01',15],['2023-01-01',16],['2021-01-01',17],['2005-01-01',25],['1990-01-01',25]]){
  assert.equal(L.allowance(policy(hire),'A','2026','2026-11-18'),days);
 }
});
test('입사 1년 미만은 완료된 개근 월만 부여하고 미래의 월을 먼저 부여하지 않는다',()=>{
 const s=policy('2026-01-18');
 assert.equal(L.allowance(s,'A','2026','2026-02-17'),0);
 assert.equal(L.allowance(s,'A','2026','2026-02-18'),1);
 assert.equal(L.allowance(s,'A','2026','2026-12-17'),10);
 assert.equal(L.allowance(s,'A','2026','2026-12-18'),11);
 assert.equal(L.allowance(s,'A','2027','2027-01-18'),15);
 const endOfMonth=policy('2026-01-31');
 assert.equal(L.allowance(endOfMonth,'A','2026','2026-02-27'),0);
 assert.equal(L.allowance(endOfMonth,'A','2026','2026-02-28'),1);
 assert.equal(L.allowance(endOfMonth,'A','2026','2026-03-31'),2);
});
test('범위 중첩과 법정 미달값을 막고 회사의 추가 부여와 이전 설정을 읽는다',()=>{
 const s=policy('2022-01-01'),before=structuredClone(s);
 s.leavePolicy.grants[0].to=3;
 assert.throws(()=>L.validate(s.leavePolicy),/범위/);
 s.leavePolicy=structuredClone(before.leavePolicy);s.leavePolicy.cap.days=24;
 assert.throws(()=>L.validate(s.leavePolicy),/25일/);
 s.leavePolicy=structuredClone(before.leavePolicy);s.leavePolicy.grants[0].days=3;
 assert.throws(()=>L.validate(s.leavePolicy),/법정/);
 s.leavePolicy={version:2,enabled:true,grants:[{from:1,to:9,days:25}],cap:{from:10,days:30},hires:{A:'2000-01-01'}};
 L.validate(s.leavePolicy);
 assert.equal(L.allowance(s,'A','2026','2026-11-18'),30);
 const old={enabled:true,grants:[{year:0,days:0},{year:1,days:15},{year:3,days:16},{year:21,days:25}],hires:{A:'2024-01-01'}};
 const snapshot=structuredClone(old),converted=L.read({leavePolicy:old});
 assert.deepEqual(converted.grants[0],{from:1,to:2,days:15});
 assert.deepEqual(converted.cap,{from:21,days:25});assert.deepEqual(old,snapshot);
 assert.equal(L.allowance({leavePolicy:old},'A','2026','2026-11-18'),15);
});

test('정책을 저장하지 않아도 멤버 입사일로 월별 발생·근속연수를 자동 계산한다',()=>{
 const state={members:[{name:'A',hireDate:'2026-06-15'},{name:'B',hireDate:'2018-06-15'}]};
 const before=JSON.stringify(state);assert.equal(L.read(state).enabled,true);assert.equal(L.read(state).hires.A,'2026-06-15');
 assert.equal(L.allowance(state,'A','2026','2026-07-14'),0);assert.equal(L.allowance(state,'A','2026','2026-07-15'),1);
 assert.equal(L.allowance(state,'A','2026','2026-11-20'),5);assert.equal(L.allowance(state,'A','2027','2027-06-15'),15);
 assert.equal(L.allowance(state,'B','2026','2026-11-20'),18);assert.equal(JSON.stringify(state),before);
 const configured={...state,leavePolicy:{version:2,enabled:true,...L.statutory(),hires:{B:'2020-06-15'}}};
 assert.equal(L.read(configured).hires.A,'2026-06-15');assert.equal(L.allowance(configured,'B','2026','2026-11-20'),17);
 configured.leavePolicy.enabled=false;assert.equal(L.allowance(configured,'A','2026','2026-11-20'),null);
});
