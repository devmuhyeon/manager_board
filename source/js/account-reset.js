(function(root){
 'use strict';
 const VERSION='2026-11-10-all-accounts-2';
 function apply(state){
  if(state.accountResetVersion===VERSION)return state;
  return {...state,accounts:{},accountResetVersion:VERSION};
 }
 const api={VERSION,apply};if(typeof module!=='undefined')module.exports=api;else root.BoardAccountReset=api;
})(typeof window!=='undefined'?window:globalThis);
