(function(root){
 'use strict';
 const catalog=[['고객센터','홈',''],['고객센터','자주 묻는 질문',''],['개인서비스','신청','신청서']];
 function decorate(projects,C){return projects.map(p=>{
  const index=['source:uiux-history','source:uiux-publish','source:uiux-overdue'].indexOf(p.id);if(index<0||p.workflow?.publication)return p;
  const at=C.today()+'T09:00:00+09:00',links=[1,2,3].map(n=>({name:'link#'+n,url:'https://example.com/worklog-sample/'+index+'/'+n}));
  return {...p,workflow:{...p.workflow,...(index===1?{release:{development:{url:'https://example.com/worklog-sample/development',by:'김무현',at}}}:{}),publication:{path:index===2?['','','']:catalog[index],links,registeredAt:at,updatedAt:at,author:'김무현'}}};
 });}
 const api={catalog,decorate};if(typeof module!=='undefined')module.exports=api;else root.BoardPublishingSamples=api;
})(typeof window!=='undefined'?window:globalThis);
