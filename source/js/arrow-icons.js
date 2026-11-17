(function(root){
 'use strict';
 const chevron='m6 9 6 6 6-6';
 const directions=['down','up','left','right'];
 const paths={reply:'M5 5v4a5 5 0 0 0 5 5h9m-5-5 5 5-5 5',sort:'m7 9 5-5 5 5m-10 6 5 5 5-5',external:'M7 17 17 7M7 7h10v10',refresh:'M20 7v5h-5m5 0a8 8 0 1 0-2 5'};
 function arrow(kind){
  const direction=directions.includes(kind)?kind:'';
  const path=direction?chevron:paths[kind];
  if(!path)return '';
  return '<svg class="arrow-icon"'+(direction?' data-arrow-direction="'+direction+'"':'')+' viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="'+path+'"/></svg>';
 }
 function setDirection(container,direction){
  if(directions.includes(direction))container?.querySelector?.('svg[data-arrow-direction]')?.setAttribute('data-arrow-direction',direction);
 }
 const api={arrow,setDirection};if(typeof module!=='undefined')module.exports=api;else root.BoardArrowIcons=api;
})(typeof window!=='undefined'?window:globalThis);
