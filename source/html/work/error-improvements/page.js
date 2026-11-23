(function(root){
 'use strict';
 function render(){
  return '<section class="card" aria-label="오류개선"><p class="empty">등록된 오류개선 내용이 없습니다.</p></section>';
 }
 const api={render};
 if(typeof module!=='undefined')module.exports=api;else(root.BoardFeaturePages??={})['work/error-improvements']=api;
})(typeof window!=='undefined'?window:globalThis);
