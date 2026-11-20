const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),Widget=require('../source/html/widgets/launcher.js');
test('위젯 버튼은 페이지 팝업 대신 로컬 독립 실행기로 요청한다',async()=>{
 let received;await Widget.launch({location:new URL('http://127.0.0.1:49271/source/html/index.html'),fetch:async(url,options)=>{received={url,options};return {ok:true};}});
 assert.equal(received.url,'http://127.0.0.1:49271/__worklog/widget');assert.equal(received.options.method,'POST');assert.equal(received.options.headers['X-WorkLog-Widget'],'open');assert.equal(received.options.credentials,'same-origin');
 for(const url of ['https://devmuhyeon.github.io/manager_board/','file:///C:/WorkLog/index.html','http://127.0.0.1:4173/'])await assert.rejects(Widget.launch({location:new URL(url),fetch:()=>{throw Error('Must not request');}}),/Start-Widget.bat/);
 await assert.rejects(Widget.launch({location:new URL('http://localhost:49271/'),fetch:async()=>({ok:false})}),/Start-Widget.bat/);
});
test('바탕화면 실행기는 메인 페이지와 분리된 Edge 앱 창을 실행한다',{skip:process.platform!=='win32'},()=>{
 const folder=path.resolve('test/results'),id=crypto.randomUUID(),script=path.join(folder,'widget-launch-'+id+'.ps1'),output=path.join(folder,'widget-args-'+id+'.json');fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(script,`function Start-Process {param([string]$FilePath,[object[]]$ArgumentList) @{file=$FilePath;arguments=$ArgumentList} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $env:WORKLOG_WIDGET_TEST_OUTPUT -Encoding UTF8}\n& '${path.resolve('prg/scripts/Start-WorkLog.ps1').replaceAll("'","''")}' -Mode File -Widget\n`);
 const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',script],{env:{...process.env,WORKLOG_WIDGET_TEST_OUTPUT:output},encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);
 const recorded=JSON.parse(fs.readFileSync(output,'utf8').replace(/^\uFEFF/,''));assert.match(recorded.file,/msedge\.exe$/i);assert.equal(recorded.arguments.length,3);assert.match(recorded.arguments[0],/^--app="file:\/\/\/.*\/source\/html\/widgets\/index\.html"$/);assert.equal(recorded.arguments[1],'--new-window');assert.equal(recorded.arguments[2],'--window-size=400,520');
});
test('위젯 리소스와 실행 파일은 오프라인 배포에 포함된다',()=>{
 const page=fs.readFileSync('source/html/widgets/index.html','utf8'),packageScript=fs.readFileSync('prg/scripts/package-offline.ps1','utf8');
 assert.ok(page.includes('source/html/widgets/style.css'));assert.ok(!page.includes('source/js/app.js'));assert.ok(packageScript.includes('prg/Start-Widget.bat'));assert.ok(!page.includes('https://'));
});

test('로컬 서버는 위젯 화면을 제공하고 외부 출처의 실행 요청은 거절한다',{skip:process.platform!=='win32',timeout:30000},async()=>{
 const net=require('node:net'),{spawn}=require('node:child_process'),probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.resolve('prg/scripts/Serve-WorkLog.ps1'),'-Port',String(port)],{windowsHide:true,stdio:'ignore'}),base='http://127.0.0.1:'+port;
 try{
  let ready=false;for(let i=0;i<50;i++){try{ready=(await fetch(base+'/__workplace')).ok;if(ready)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert.equal(ready,true);
  const response=await fetch(base+'/source/html/widgets/index.html');assert.equal(response.status,200);assert.ok((await response.text()).includes('WorkLog 위젯'));
  assert.equal((await fetch(base+'/source/html/widgets/style.css')).status,200);
  for(const headers of [{},{Origin:'https://other.example','X-WorkLog-Widget':'open'},{Origin:base}])assert.equal((await fetch(base+'/__worklog/widget',{method:'POST',headers})).status,403);
  assert.equal((await fetch(base+'/__worklog/widget')).status,404);
 }finally{child.kill();}
});
