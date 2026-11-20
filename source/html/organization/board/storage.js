(function(root){
 'use strict';
 function create({read,write}){
 const POSTS_FOLDER='게시판',ID=/^[a-f0-9-]{36}$/;
 async function postsDirectory(directory,create=false){
  const save=await directory.getDirectoryHandle('save',{create});
  return save.getDirectoryHandle(POSTS_FOLDER,{create});
 }
 async function readPosts(directory,parts){
  if(!Array.isArray(parts))throw Error('게시판 저장 목록이 올바르지 않습니다.');
  if(!parts.length)return [];
  const dir=await postsDirectory(directory),ids=new Set(),posts=[];
  for(const part of parts){
   if(!part||typeof part.id!=='string'||!part.id||ids.has(part.id)||!ID.test(part.revision))throw Error('게시글 저장 경로가 올바르지 않습니다.');
   const post=JSON.parse(await read(await dir.getFileHandle(part.revision+'.json')));
   for(const item of [post,...(post.comments||[])])for(const attachment of item.attachments||[]){if(attachment.assetRevision){if(!ID.test(attachment.assetRevision))throw Error('잘못된 첨부파일 경로입니다.');const assets=await dir.getDirectoryHandle('첨부');const saved=JSON.parse(await read(await assets.getFileHandle(attachment.assetRevision+'.json')));Object.assign(attachment,saved);delete attachment.assetRevision;}}
   if(post?.id!==part.id)throw Error('게시글 ID가 저장 목록과 다릅니다.');
   ids.add(part.id);posts.push(post);
  }
  return posts;
 }
 async function writePosts(directory,posts,oldPosts,previousParts){
  if(!Array.isArray(posts)||posts.some(post=>typeof post?.id!=='string'||!post.id)||new Set(posts.map(post=>post.id)).size!==posts.length)throw Error('게시글 저장 목록이 올바르지 않습니다.');
  const previous=new Map((previousParts||[]).map(part=>[part.id,part]));
  const old=new Map((oldPosts||[]).map(post=>[post.id,post]));
  const dir=await postsDirectory(directory,true),parts=[];
  for(const post of posts){
   const saved=previous.get(post.id),oldPost=old.get(post.id);
   if(saved&&JSON.stringify(oldPost)===JSON.stringify(post))parts.push(saved);
   else{
    const revision=crypto.randomUUID();
    const stored=structuredClone(post),assetParts={};
    const oldAssets=new Map([oldPost,...(oldPost?.comments||[])].filter(Boolean).flatMap(item=>(item.attachments||[]).map(attachment=>[item.id+'|'+attachment.id,attachment])));
    for(const item of [stored,...(stored.comments||[])])for(const attachment of item.attachments||[]){
     const key=item.id+'|'+attachment.id,reuse=saved?.assets?.[key];
     const assetRevision=reuse&&ID.test(reuse)&&JSON.stringify(oldAssets.get(key))===JSON.stringify(attachment)?reuse:crypto.randomUUID();
     if(assetRevision!==reuse){const assets=await dir.getDirectoryHandle('첨부',{create:true});await write(assets,assetRevision+'.json',JSON.stringify(attachment));}
     assetParts[key]=assetRevision;
     delete attachment.data;attachment.assetRevision=assetRevision;
    }
    await write(dir,revision+'.json',JSON.stringify(stored,null,2));
    parts.push({id:post.id,revision,assets:assetParts});
   }
  }
  return parts;
 }
return {readPosts,writePosts};}
 const api={create};if(typeof module!=='undefined')module.exports=api;else root.BoardBulletinStorage=api;
})(typeof window!=='undefined'?window:globalThis);
