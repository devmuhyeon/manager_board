(function(root){
 'use strict';
 const catalog=[['고객센터','홈',''],['고객센터','자주 묻는 질문',''],['개인서비스','신청','신청서']];
 const Board=typeof module!=='undefined'?require('../source/js/task-board.js'):root.BoardTaskBoard;
 const Model=typeof module!=='undefined'?require('../source/html/work/publishing-docs/model.js'):root.BoardPublishingModel;
 function documents(C,members){return ['김무현','임정규'].map((actor,i)=>{let p=Model.saveDocument(null,{title:i?'[샘플] 모바일 공통 컴포넌트 산출물':'[샘플] 퍼블리셔 직접 등록 문서',due:C.today(),'디자인':['홍소영'],'퍼블':[actor]},C,actor,members);p={...p,id:'publishing-sample:direct-'+i,sampleFixture:true};if(i)p=Model.save(p,{section:'outputs',path:['개인서비스','신청','신청서'],artifacts:[{name:'컴포넌트 결과',url:'https://example.com/worklog-sample/components'}],attachments:[]},C,Board,actor);return p;});}
 function decorate(projects,C){return projects.map(p=>{
  const index=['source:uiux-history','source:uiux-publish','source:uiux-overdue'].indexOf(p.id);if(index<0||p.workflow?.publication)return p;
  const at=C.today()+'T09:00:00+09:00',links=[1,2,3].map(n=>({name:'link#'+n,url:'https://example.com/worklog-sample/'+index+'/'+n}));
  return {...p,workflow:{...p.workflow,...(index===1?{release:{development:{url:'https://example.com/worklog-sample/development',by:'김무현',at}}}:{}),publication:{path:index===2?['','','']:catalog[index],links,registeredAt:at,updatedAt:at,author:'김무현'}}};
 });}
 const api={catalog,decorate,documents};if(typeof module!=='undefined')module.exports=api;else root.BoardPublishingSamples=api;
})(typeof window!=='undefined'?window:globalThis);
