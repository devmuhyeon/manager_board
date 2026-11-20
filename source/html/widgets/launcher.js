(function(root){
 'use strict';
 let widgetWindow=null;
 function pageUrl(location,rootUrl){
  const base=new URL(location.href);base.search='';base.hash='';
  return rootUrl?new URL('source/html/widgets/index.html',rootUrl).href:
   new URL(base.pathname.endsWith('/source/html/index.html')?'widgets/index.html':'source/html/widgets/index.html',base).href;
 }
 function openWindow({location,open,rootUrl}){
  if(widgetWindow&&!widgetWindow.closed){widgetWindow.focus();return true;}
  const target=pageUrl(location,rootUrl);
  widgetWindow=open?.(target,'WorkLogDesktopWidget','popup=yes,width=400,height=520,resizable=yes,scrollbars=yes');
  if(!widgetWindow)throw Error('위젯 창이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 위젯 버튼을 다시 눌러 주세요.');
  widgetWindow.opener=null;widgetWindow.focus();
  return true;
 }
 async function launch({location,fetch,open,rootUrl,requestTimeout=1200}){
  const local=location.protocol==='http:'&&['127.0.0.1','localhost'].includes(location.hostname)&&location.port==='49271';
  // Web/file launches stay synchronous until window.open, preserving the click gesture.
  if(!local)return openWindow({location,open,rootUrl});
  let timer;const controller=new AbortController();
  try{
   const response=await Promise.race([
    fetch(new URL('/__worklog/widget',location.href).href,{method:'POST',headers:{'X-WorkLog-Widget':'open'},credentials:'same-origin',cache:'no-store',signal:controller.signal}),
    new Promise((resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Widget launcher timeout'));},requestTimeout);})
   ]);
   if(response.ok||response.status===429)return true;
  }catch{ /* An older or unavailable local launcher still supports a separate widget window. */ }
  finally{clearTimeout(timer);}
  return openWindow({location,open,rootUrl});
 }
 const api={launch,pageUrl};if(typeof module!=='undefined')module.exports=api;else root.BoardDesktopWidget=api;
})(typeof window!=='undefined'?window:globalThis);
