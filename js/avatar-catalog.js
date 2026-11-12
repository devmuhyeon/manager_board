(function(root){
 'use strict';
 const characters=[
  ['yongyong','용용이','yongyong-3d.png'],['bbiyak','삐약이','bbiyak-3d.png'],['hamtaro','햄토리','hamtaro-3d.png'],['penguin','펭귄','penguin-3d.png'],['terriermon','테리어몬','terriermon-original.jpg'],
  ['sprout-potato','감자 품은 새싹','감자 품은 새싹.png'],['frog','개구리','개구리.png'],['sweet-potato','고구마','고구마.png'],['danbi','단비','단비.png'],['dongdong','동동이','동동이.png'],['strawberry','딸기','딸기.png'],['ddochi','또치','또치.png'],['maruko','마루코','마루코.png'],['mashimaro','마시마로','마시마로.png'],['majin-buu','마인부우','마인부우.png'],['culprit','범인','범인.png'],['baby-jjanggu','베이비짱구','베이비짱구.png'],['sailor-moon','세일러문','세일러문.png'],['atammamma','아따맘마','아따맘마.png'],['glasses','안경녀','안경녀.png'],['juice','주스','주스.png'],['kongkong','콩콩이','콩콩이.png'],['quokka','쿼카','쿼카.png'],['kitty','키티','키티.png'],['powerpuff','파워퍼프걸','파워퍼프걸.png'],['penguin-new','핑구','펭귄.png'],['young-goku','소년 손오공','소년 손오공.png']
 ];
 const keys=characters.map(([key])=>key),legacyKeys=['kirby','pikachu','charmander'];
 const builtins=characters.map(row=>row.slice());
 function validateCustom(items=[]){
  if(!Array.isArray(items)||items.length>100||new Set(items.map(v=>v?.id)).size!==items.length||items.some(v=>!v||!/^custom-[a-f0-9-]{36}$/.test(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.length>40||typeof v.src!=='string'||v.src.length>350000||!/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(v.src)))throw Error('추가 캐릭터 이미지 형식을 확인해 주세요.');
  return items;
 }
 function sync(items=[]){validateCustom(items);characters.splice(0,characters.length,...builtins,...items.map(v=>[v.id,v.name,v.src]));keys.splice(0,keys.length,...characters.map(v=>v[0]));}
 const src=value=>value?.startsWith('data:image/')?value:'../images/keis/'+value;
 async function imageFile(file){
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('10MB 이하 PNG·JPG·WebP 이미지를 선택하세요.');
  const bitmap=await createImageBitmap(file);
  try{const ratio=Math.min(1,512/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const value=canvas.toDataURL('image/webp',.85);if(value.length>350000)throw Error('이미지가 너무 복잡합니다. 더 작은 이미지를 선택하세요.');return value;}finally{bitmap.close();}
 }
 const api={characters,keys,legacyKeys,validateCustom,sync,src,imageFile};if(typeof module!=='undefined')module.exports=api;else root.BoardAvatars=api;
})(typeof window!=='undefined'?window:globalThis);
