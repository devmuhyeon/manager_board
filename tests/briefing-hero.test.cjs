const test=require('node:test'),assert=require('node:assert/strict');
const Hero=require('../js/briefing-hero.js'),Editor=require('../js/simple-editor.js');
const user={name:'테스트',team:'디자인',avatar:'kitty'},storage=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}};
test('브리핑 설정은 사용자·캐릭터·모드별로 분리해 저장한다',()=>{
 const controller=Hero.create(storage()),initial=controller.get(user);assert.equal(initial.mode,'normal');assert.equal(initial.normal.scale,100);assert.equal(initial.big.scale,160);
 initial.normal.title='#123456';initial.big.scale=200;initial.mode='big';controller.save(user,initial);const restored=controller.get(user);assert.equal(restored.normal.title,'#123456');assert.equal(restored.big.scale,200);assert.equal(restored.mode,'big');
 assert.notEqual(controller.get({...user,name:'다른사람'}).normal.title,'#123456');assert.notEqual(controller.get({...user,avatar:'frog'}).normal.title,'#123456');
});
test('브리핑 색상과 위치는 유효 범위만 허용하며 미리보기에 반영한다',()=>{
 const base=Hero.defaults(user,'normal'),clean=Hero.clean({title:'red;display:none',bgStart:'#abcdef',scale:999,x:-999,titleBg:'transparent'},base);assert.equal(clean.title,base.title);assert.equal(clean.bgStart,'#abcdef');assert.equal(clean.scale,260);assert.equal(clean.x,-150);
 const html=Hero.render({user,rows:[{status:'진행중',due:'2026-01-01'}],C:{isComplete:s=>s==='완료',today:()=> '2026-11-12'},N:{teamLabel:x=>x},esc:x=>String(x),record:{mode:'normal',normal:clean},preview:true});assert.match(html,/--hero-bgStart:#abcdef/);assert.match(html,/키티.png/);assert.match(html,/heroPreviewMode/);assert.ok(!html.includes('hero-secret'));assert.match(html,/미완료/);
});
test('업무별 담당자 목록은 해당 팀만 표시하고 콘텐츠 업무를 구분한다',()=>{
 const members=[{name:'기획자',team:'기획'},{name:'디자이너',team:'디자인'},{name:'퍼블리셔',team:'퍼블'},{name:'콘텐츠',team:'콘텐츠'},{name:'퇴사자',team:'디자인',active:false}];
 assert.deepEqual(Editor.candidates({role:'디자인',assignees:[]},members).map(m=>m.name),['디자이너']);assert.deepEqual(Editor.candidates({role:'퍼블',assignees:[]},members).map(m=>m.name),['퍼블리셔']);assert.deepEqual(Editor.candidates({role:'콘텐츠 기획',assignees:[]},members).map(m=>m.name),['콘텐츠']);assert.equal(Editor.roleOf({role:'디자인',assignees:['콘텐츠']},members),'콘텐츠 디자인');assert.equal(Editor.candidates({role:'기타',assignees:[]},members).length,4);
});
test('클릭한 보기 모드는 재렌더·프로필 변경·새 세션에서도 유지된다',()=>{
 const store=storage(),controller=Hero.create(store);controller.setMode(user,'big');assert.equal(controller.get(user).mode,'big');assert.equal(controller.get({...user,avatar:'frog'}).mode,'big');assert.equal(Hero.create(store).get(user).mode,'big');controller.setMode(user,'normal');assert.equal(Hero.create(store).get(user).mode,'normal');
 const blocked=Hero.create({getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}});assert.equal(blocked.setMode(user,'big'),false);assert.equal(blocked.get(user).mode,'big');
});
