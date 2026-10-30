const test=require('node:test'),assert=require('node:assert/strict'),M=require('../js/memo-carousel.js');
test('메모의 처음·끝과 화면 너비에 맞춰 이동 버튼을 갱신한다',()=>{
 const prev={},next={},controls={hidden:false,querySelector:s=>s.includes('"-1"')?prev:next},listeners={};
 const track={id:'memos',scrollWidth:1300,clientWidth:1000,scrollLeft:0,ownerDocument:{querySelector:()=>controls},addEventListener:(type,fn)=>listeners[type]=fn};
 M.init({querySelectorAll:()=>[track]});assert.equal(prev.disabled,true);assert.equal(next.disabled,false);assert.equal(controls.hidden,false);
 track.scrollLeft=300;listeners.scroll();assert.equal(prev.disabled,false);assert.equal(next.disabled,true);
 track.clientWidth=1300;listeners.scroll();assert.equal(controls.hidden,true);
});
test('메모 넘김은 데이터를 다시 렌더하지 않고 트랙만 이동한다',()=>{
 let args;const track={clientWidth:1000,scrollBy:value=>args=value};
 M.move({dataset:{target:'memos',direction:'1'},ownerDocument:{getElementById:()=>track}});assert.equal(args.left,1016);
 M.move({dataset:{target:'memos',direction:'-1'},ownerDocument:{getElementById:()=>track}});assert.equal(args.left,-1016);
});
