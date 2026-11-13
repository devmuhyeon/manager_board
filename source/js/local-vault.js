/* Device/browser-only login convenience. Neither plaintext nor ciphertext is included in shared JSON. */
(function(root){
  'use strict';
  const enc=new TextEncoder(),dec=new TextDecoder();
  const newKey=()=>crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  async function seal(key,value){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(value)));return {iv:[...iv],data:[...new Uint8Array(data)]};}
  async function unseal(key,record){return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(record.iv)},key,new Uint8Array(record.data))));}
  let dbPromise;
  function database(){return dbPromise??=new Promise((resolve,reject)=>{const req=indexedDB.open('workboard-device-login-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('local');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function read(key){const db=await database();return new Promise((resolve,reject)=>{const req=db.transaction('local').objectStore('local').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function write(entries){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('local','readwrite');for(const [k,v] of entries)if(v===undefined)tx.objectStore('local').delete(k);else tx.objectStore('local').put(v,k);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('기기 저장이 중단되었습니다.'));});}
  async function remember(value){const key=await read('key')||await newKey();await write([['key',key],['login',await seal(key,value)]]);}
  async function recall(){const key=await read('key'),record=await read('login');return key&&record?unseal(key,record):null;}
  const forget=()=>write([['key',undefined],['login',undefined]]);
  const rememberConnections=value=>write([['connections',value]]);
  const recallConnections=()=>read('connections');
  const api={newKey,seal,unseal,remember,recall,forget,rememberConnections,recallConnections};if(typeof module!=='undefined')module.exports=api;else root.BoardVault=api;
})(typeof window!=='undefined'?window:globalThis);
