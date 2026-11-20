(function(root){
 'use strict';
  function dashboard(context){
    const {calendarMonth,calendarDay,calendarFilter,page,state,user,C,P,B,N,D,esc,button,displayProfile,weekBlocks,leaveItems,projectTable,heroRows,heroDesign,BoardBriefingCalendar,BoardBriefingDashboard,BoardBriefingHero}=context;const calendar=BoardBriefingCalendar.render({state,actor:user.name,C,month:calendarMonth,selected:calendarDay,filter:calendarFilter,esc,button});return '<div class="briefing-layout">'+BoardBriefingHero.render({rows:heroRows(),user:displayProfile(user),C,N,esc,record:heroDesign.get(displayProfile(user))})+BoardBriefingDashboard.render({state,user,C,P,B,N,esc,button,table:projectTable,hint:D.illustratedHint,weekBlocks,leaveItems,calendar})+'</div>';}
 const api={dashboard};if(typeof module!=='undefined')module.exports=api;else (root.BoardFeaturePages??={})['home']=api;
})(typeof window!=='undefined'?window:globalThis);
