(function(root){
 'use strict';
 const defaults=[
  {id:'annual',name:'연차',icon:'🌸',description:'하루 단위로 사용하는 연차',units:1},
  {id:'morning',name:'오전반차',icon:'🌤️',description:'오전 반일 휴가',units:.5},
  {id:'afternoon',name:'오후반차',icon:'🌙',description:'오후 반일 휴가',units:.5},
  {id:'special',name:'특별휴가',icon:'🌿',description:'경조사 등 별도로 부여하는 휴가',units:0}
 ];
 const all=state=>state.leaveTypes||defaults;
 const active=state=>all(state).filter(type=>type.active!==false);
 function validate(types){
  if(types===undefined)return;
  if(!Array.isArray(types)||new Set(types.map(type=>type?.id)).size!==types.length||
   new Set(types.filter(type=>type?.active!==false).map(type=>type?.name)).size!==types.filter(type=>type?.active!==false).length||
   types.some(type=>!type||typeof type.id!=='string'||!type.id||typeof type.name!=='string'||!type.name.trim()||type.name.length>40||
    typeof type.icon!=='string'||type.icon.length>12||typeof type.description!=='string'||type.description.length>160||
    ![0,.5,1].includes(type.units)||(type.active!==undefined&&typeof type.active!=='boolean')||
    (type.code!==undefined&&(typeof type.code!=='string'||type.code.length>40))||
    (type.paid!==undefined&&typeof type.paid!=='boolean')||
    (type.minDays!==undefined&&(!Number.isFinite(type.minDays)||type.minDays<0||type.minDays>366))||
    (type.maxDays!==undefined&&(!Number.isFinite(type.maxDays)||type.maxDays<.5||type.maxDays>366||type.maxDays<(type.minDays||0)))))throw Error('휴가 종류 설정을 확인하세요.');
 }
 function save(state,actor,input,{isAdmin,uid}){
  if(!isAdmin(state,actor))throw Error('WorkLog 관리자만 휴가 종류를 설정할 수 있습니다.');
  const types=structuredClone(all(state)),old=types.find(type=>type.id===input.id);
  if(input.id&&!old)throw Error('휴가 종류를 찾을 수 없습니다.');
  const item={id:old?.id||uid(),name:String(input.name||'').trim(),icon:String(input.icon||'📅').trim(),
   description:String(input.description||'').trim(),units:Number(input.units),active:input.active!=='off',
   code:String(input.code||'').trim(),paid:input.paid!==false&&input.paid!=='off'};
  if(String(input.minDays??'').trim())item.minDays=Number(input.minDays);
  if(String(input.maxDays??'').trim())item.maxDays=Number(input.maxDays);
  if(old)types[types.indexOf(old)]=item;else types.push(item);
  if(input.position!==undefined){
   const position=Number(input.position);if(!Number.isInteger(position)||position<0||position>=types.length)throw Error('목록 순서를 확인하세요.');
   types.splice(types.indexOf(item),1);types.splice(position,0,item);
  }
  validate(types);
  return {...state,leaveTypes:types};
 }
 function remove(state,actor,id,isAdmin){
  if(!isAdmin(state,actor))throw Error('WorkLog 관리자만 휴가 종류를 삭제할 수 있습니다.');
  if(!all(state).some(type=>type.id===id))throw Error('휴가 종류를 찾을 수 없습니다.');
  return {...state,leaveTypes:all(state).map(type=>type.id===id?{...type,active:false}:{...type})};
 }
 function move(state,actor,id,step,isAdmin){
  if(!isAdmin(state,actor))throw Error('WorkLog 관리자만 휴가 종류 순서를 변경할 수 있습니다.');
  const types=structuredClone(all(state)),index=types.findIndex(type=>type.id===id),next=index+step;
  if(index<0||![1,-1].includes(step)||next<0||next>=types.length)return state;
  [types[index],types[next]]=[types[next],types[index]];
  return {...state,leaveTypes:types};
 }
 const api={all,active,validate,save,remove,move};
 if(typeof module!=='undefined')module.exports=api;else root.BoardLeaveTypes=api;
})(typeof window!=='undefined'?window:globalThis);
