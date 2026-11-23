(function(root){
 'use strict';
 function render(){
  return '<section class="card" aria-label="퍼블리싱 문서"><p class="empty">등록된 퍼블리싱 문서가 없습니다.</p></section>';
 }
 const api={render};
 if(typeof module!=='undefined')module.exports=api;else(root.BoardFeaturePages??={})['work/publishing-docs']=api;
})(typeof window!=='undefined'?window:globalThis);
