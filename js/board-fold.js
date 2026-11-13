(function(root){
 'use strict';
 const running=new WeakMap();
 function toggle(button,closed){
  const section=button.closest?.('.board-week,.task-board-lane,.board-table-section'),body=section?.querySelector('.board-week-cards,.lane-content,.table-wrap');
  if(!body)return false;
  const start=body.hidden?0:body.getBoundingClientRect().height;
  running.get(body)?.cancel();running.delete(body);
  button.setAttribute('aria-expanded',String(!closed));
  const arrow=button.querySelector('[aria-hidden]');if(arrow)arrow.textContent=closed?'⌄':'⌃';else button.textContent=closed?'⌄':'⌃';
  if(!closed)section.classList.remove('is-collapsed');
  body.hidden=false;body.inert=closed;body.style.overflow='hidden';
  const finish=()=>{body.hidden=closed;body.style.overflow='';if(section.classList.contains('task-board-lane'))section.classList.toggle('is-collapsed',closed);running.delete(body);};
  if(!body.animate||root.matchMedia?.('(prefers-reduced-motion: reduce)').matches){finish();return true;}
  const animation=body.animate([{height:start+'px',opacity:closed?1:0},{height:(closed?0:body.scrollHeight)+'px',opacity:closed?0:1}],{duration:240,easing:'cubic-bezier(.2,0,0,1)'});
  running.set(body,animation);animation.onfinish=finish;return true;
 }
 const api={toggle};if(typeof module!=='undefined')module.exports=api;else root.BoardFold=api;
})(typeof window!=='undefined'?window:globalThis);
