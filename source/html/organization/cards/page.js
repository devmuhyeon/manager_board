(function(root){
 'use strict';
  function expensePage(context){
    const {BoardPreviewData,state,user,esc,button,targetHandle,expenseService,expenseCardId,expenseMonth,BoardCardExpenses}=context;
    const sampleData=!targetHandle&&typeof BoardPreviewData!=='undefined'?BoardPreviewData.cardSamples?.():undefined;
    return BoardCardExpenses.render({state,actor:user.name,cardId:expenseCardId,month:expenseMonth,service:expenseService,esc,button,sampleData});
  }
 const api={expensePage};if(typeof module!=='undefined')module.exports=api;else (root.BoardFeaturePages??={})['organization/cards']=api;
})(typeof window!=='undefined'?window:globalThis);
