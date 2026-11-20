(function(root){
 'use strict';
 const chevron='m6 9 6 6 6-6';
 const directions=['down','up','left','right'];
 const paths={reply:'M5 5v4a5 5 0 0 0 5 5h9m-5-5 5 5-5 5',sort:'m7 9 5-5 5 5m-10 6 5 5 5-5',external:'M7 17 17 7M7 7h10v10',refresh:'M20 7v5h-5m5 0a8 8 0 1 0-2 5'};
 paths.edit='m14 6 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15z';
 paths.trash='M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13m-8 3v7m4-7v7';
 paths.download='M12 3v12m-4-4 4 4 4-4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3';
 paths.settings='M10 3h4l1 3 3 1 3-1 2 4-2 2v3l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-3l-2-2 2-4 3 1 3-1z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0';
 paths.widget='M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z';
 paths.search='M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0';
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
