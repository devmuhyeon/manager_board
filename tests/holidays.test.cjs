const test=require('node:test'),assert=require('node:assert/strict'),W=require('../js/workspace.js');
const ledger=(start,end,type='연차',year='2026')=>W.leaveLedger({leaves:[{owner:'가',start,end,type,dailyUnits:.5}],leaveAllowances:{[year]:{'가':15}}},'가',year,'2026-10-26');
test('연휴·대체공휴일·선거일은 연차에서 자동 제외한다',()=>{
 assert.equal(ledger('2026-02-13','2026-02-19').used,2);
 assert.equal(ledger('2026-10-02','2026-10-06').used,2);
 assert.equal(ledger('2026-06-03','2026-06-03').used,0);
 assert.equal(ledger('2026-09-24','2026-09-28').used,1);
 assert.equal(ledger('2026-05-22','2026-05-26').used,2);
});
test('공휴일 반차·추가사용도 0일이며 사용 예정과 잔여에 반영한다',()=>{
 for(const type of ['오전 반차','오후 반차','추가 사용','연차']){const l=ledger('2026-12-25','2026-12-25',type);assert.equal(l.planned,0);assert.equal(l.remaining,15);assert.equal(l.available,15);assert.equal(l.excluded[0].name,'성탄절');}
 assert.equal(ledger('2026-12-24','2026-12-28').planned,2);
});
test('개정 공휴일 및 2027년 대체공휴일, 제외되지 않는 정상 평일',()=>{
 for(const date of ['2026-05-01','2026-07-17'])assert.equal(ledger(date,date).used,0);
 for(const date of ['2027-02-09','2027-05-03','2027-05-13','2027-07-19','2027-08-16','2027-10-04','2027-10-11','2027-12-27'])assert.equal(ledger(date,date,'연차','2027').planned,0,date);
 assert.equal(ledger('2026-09-28','2026-09-28').used,1);
 assert.equal(ledger('2027-06-07','2027-06-07','연차','2027').planned,1);
});
test('공식 월력요항의 연간 주5일제 휴일 총수와 일치한다',()=>{
 for(const [year,total] of [[2026,120],[2027,119]]){const holidays=W.holidayCalendar(year);let count=0;for(let d=new Date(year+'-01-01T00:00:00Z');d.getUTCFullYear()===year;d.setUTCDate(d.getUTCDate()+1)){if([0,6].includes(d.getUTCDay())||holidays[d.toISOString().slice(0,10)])count++;}assert.equal(count,total);}
});
test('미지원 연도는 공휴일 적용 완료로 표시하지 않고 원본 기록을 보존한다',()=>{
 const s={leaves:[{owner:'가',start:'2028-01-03',end:'2028-01-03',type:'연차'}]},before=JSON.stringify(s);const l=W.leaveLedger(s,'가','2028');assert.equal(l.calendarSupported,false);assert.equal(JSON.stringify(s),before);assert.equal(W.holidayCalendar(2028),null);
});
