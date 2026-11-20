(function(root){
 'use strict';
 async function launch({location,fetch}){
  if(location.protocol!=='http:'||!['127.0.0.1','localhost'].includes(location.hostname)||location.port!=='49271')throw Error('바탕화면 위젯은 프로젝트의 prg/Start-Widget.bat으로 실행하세요. WorkLog 로컬 실행기에서는 위젯 버튼으로 열 수 있습니다.');
  const response=await fetch(new URL('/__worklog/widget',location.href).href,{method:'POST',headers:{'X-WorkLog-Widget':'open'},credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw Error('로컬 실행기에 위젯 기능이 아직 적용되지 않았습니다. prg/Start-Widget.bat으로 실행해 주세요.');
  return true;
 }
 const api={launch};if(typeof module!=='undefined')module.exports=api;else root.BoardDesktopWidget=api;
})(typeof window!=='undefined'?window:globalThis);
