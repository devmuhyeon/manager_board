(function(root){
 'use strict';
 const characters=[
  ['yongyong','용용이','yongyong-3d.png'],['bbiyak','삐약이','bbiyak-3d.png'],['hamtaro','햄토리','hamtaro-3d.png'],['penguin','펭귄','penguin-3d.png'],['terriermon','테리어몬','terriermon-original.jpg'],
  ['sprout-potato','감자 품은 새싹','감자 품은 새싹.png'],['frog','개구리','개구리.png'],['sweet-potato','고구마','고구마.png'],['danbi','단비','단비.png'],['dongdong','동동이','동동이.png'],['strawberry','딸기','딸기.png'],['ddochi','또치','또치.png'],['maruko','마루코','마루코.png'],['mashimaro','마시마로','마시마로.png'],['majin-buu','마인부우','마인부우.png'],['culprit','범인','범인.png'],['baby-jjanggu','베이비짱구','베이비짱구.png'],['sailor-moon','세일러문','세일러문.png'],['atammamma','아따맘마','아따맘마.png'],['glasses','안경녀','안경녀.png'],['juice','주스','주스.png'],['kongkong','콩콩이','콩콩이.png'],['quokka','쿼카','쿼카.png'],['kitty','키티','키티.png'],['powerpuff','파워퍼프걸','파워퍼프걸.png'],['penguin-new','펭귄 2','펭귄.png']
 ];
 const keys=characters.map(([key])=>key),legacyKeys=['kirby','pikachu','charmander'];
 const api={characters,keys,legacyKeys};if(typeof module!=='undefined')module.exports=api;else root.BoardAvatars=api;
})(typeof window!=='undefined'?window:globalThis);
