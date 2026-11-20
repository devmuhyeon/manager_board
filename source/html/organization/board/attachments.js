(function(root){
 'use strict';
 const types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',avif:'image/avif',mp4:'video/mp4',webm:'video/webm',ogv:'video/ogg',zip:'application/zip',pdf:'application/pdf',txt:'text/plain',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',hwp:'application/x-hwp',hwpx:'application/vnd.hancom.hwpx'};
 const limit=20*1024*1024;
 function validate(items=[],imagesOnly=false){
  if(!Array.isArray(items)||items.length>10||new Set(items.map(item=>item?.id)).size!==items.length)throw Error('첨부파일은 최대 10개입니다.');
  let total=0;
  for(const item of items){
   const ext=String(item?.name||'').split('.').at(-1).toLowerCase(),mime=types[ext];
   if(!mime||imagesOnly&&!mime.startsWith('image/')||typeof item.id!=='string'||!item.id||item.name.length>200||item.type!==mime||!Number.isInteger(item.size)||item.size<1||item.size>limit||typeof item.data!=='string'||!item.data.startsWith('data:'+mime+';base64,')||!/^[A-Za-z0-9+/]*={0,2}$/.test(item.data.split(',')[1])||item.data.length>Math.ceil(limit/3)*4+100)throw Error('지원하지 않는 첨부파일이거나 파일 크기가 20MB를 넘습니다.');
   const encoded=item.data.split(',')[1],size=encoded.length*3/4-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0);
   if(size!==item.size)throw Error('첨부파일 크기 정보가 올바르지 않습니다.');
   total+=item.size;
  }
  if(total>40*1024*1024)throw Error('한 글의 첨부파일 합계는 40MB까지 가능합니다.');
  return items;
 }
 async function readFiles(files,existing=[],imagesOnly=false){
  const items=[...existing];
  for(const file of files){
   const ext=file.name.split('.').at(-1).toLowerCase(),type=types[ext];
   if(!type||imagesOnly&&!type.startsWith('image/')||file.size<1||file.size>limit)throw Error('지원 형식과 파일 크기(20MB 이하)를 확인하세요.');
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve('data:'+type+';base64,'+String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('첨부파일을 읽지 못했습니다.'));reader.readAsDataURL(file);});
   items.push({id:crypto.randomUUID(),name:file.name,type,size:file.size,data});
  }
  return validate(items,imagesOnly);
 }
 function render(items,esc){
  return '<div class="board-attachments">'+(items||[]).map(item=>{
   const url=esc(item.data),name=esc(item.name);
   return '<div class="board-attachment">'+(item.type.startsWith('image/')?'<a href="'+url+'" download="'+name+'"><img src="'+url+'" alt="'+name+'" loading="lazy"></a>':item.type.startsWith('video/')?'<video controls preload="metadata" src="'+url+'" aria-label="'+name+'"></video>':'')+'<a href="'+url+'" download="'+name+'">'+name+'</a></div>';
  }).join('')+'</div>';
 }
 const api={validate,readFiles,render,types};if(typeof module!=='undefined')module.exports=api;else root.BoardAttachments=api;
})(typeof window!=='undefined'?window:globalThis);
