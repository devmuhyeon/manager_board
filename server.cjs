const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  const files=['images/keis/terriermon-original.jpg','images/keis/hamtaro-3d.png','images/keis/penguin-3d.png','js/memo-carousel.js','source/ui-system.css','source/layout-spacing.css','js/display-styles.js','source/display-styles.css','html/index.html','html/design-mockups.html','js/design-mockups.js','source/design-mockups.css','source/components.css','source/work-tables.css','source/workplace-design.css','js/work-tables.js','source/single-topbar.css','js/navigation.js','js/team-board.js','js/detail-views.js','font/tossface/tossface.css',...Array.from({length:12},(_,i)=>'font/tossface/TossFaceFontMac-'+String(i).padStart(2,'0')+'.woff2'),'source/style.css','source/theme.css','js/core.js','js/xlsx.js','js/app.js','js/personnel.js','js/workspace.js','js/local-vault.js','js/jquery-3.7.1.min.js','images/logo.svg','images/keis/yongyong-3d.png','images/keis/bbiyak-3d.png','font/PretendardVariable.woff2'];
  const allowed=Object.fromEntries(files.map(file=>['/'+file,file]));allowed['/']='html/index.html';allowed['/index.html']='html/index.html';
  if(!allowed[name]){res.writeHead(404);res.end('Not found');return;}
  const file=path.join(root,allowed[name]);res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
}).listen(4173,'127.0.0.1',()=>console.log('워크 플레이스: http://127.0.0.1:4173'));
