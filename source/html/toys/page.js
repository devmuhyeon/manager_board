(function(root){
 'use strict';
 const items={
  toyVote:{title:'투표',description:'팀원들과 의견을 모으는 공간입니다.'},
  toyWordChain:{title:'끝말잇기',description:'팀원들과 함께 끝말잇기를 즐기는 공간입니다.'},
  toyLadder:{title:'사다리타기',description:'사다리로 순서와 역할을 정하는 공간입니다.'},
  toyWheel:{title:'돌림판',description:'돌림판으로 가볍게 추첨하는 공간입니다.'}
 };
 function render({page,esc}){
  const item=items[page];
  return '<section class="card" aria-label="'+esc(item.title)+'"><div class="empty"><strong>'+esc(item.title)+' · 준비 중</strong><p>'+esc(item.description)+'</p><p class="muted">기능을 추가할 예정입니다.</p></div></section>';
 }
 const api={items,render};
 if(typeof module!=='undefined')module.exports=api;else(root.BoardFeaturePages??={}).toys=api;
})(typeof window!=='undefined'?window:globalThis);
