const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,types={'.ico':'image/x-icon','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(name==='/'||name==='/index.html')name='/html/index.html';
 const parts=name.split('/'),file=path.resolve(root,'.'+name),ext=path.extname(file);
 if(!['html','js','source','images','font'].includes(parts[1])||parts.some(p=>p==='..'||p.startsWith('.'))||!file.startsWith(root+path.sep)||!types[ext]){res.writeHead(404);res.end('Not found');return;}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[ext],'Cache-Control':'no-store'});res.end(data);});
});
if(require.main===module)server.listen(4173,'127.0.0.1',()=>console.log('워크 플레이스: http://127.0.0.1:4173'));
module.exports=server;
