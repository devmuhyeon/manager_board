param([ValidateSet('Local','File')][string]$Mode='Local',[string]$ServerUrl)
$ErrorActionPreference='Stop'
try{
 $projectRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
 $edge=@((Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),(Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),(Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe')) | Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1
 if(!$edge){throw 'Microsoft Edge was not found.'}
 if($ServerUrl){if($ServerUrl -notmatch '^https://[^\s"]+$'){throw 'Use an HTTPS internal server address.'};$url=$ServerUrl}
 elseif($Mode -eq 'File'){$url=([Uri](Join-Path $projectRoot 'source\html\index.html')).AbsoluteUri}
 else{
  $url='http://127.0.0.1:49271/source/html/index.html'
  $sha=[Security.Cryptography.SHA256]::Create();try{$identity=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($projectRoot))).Replace('-','')}finally{$sha.Dispose()}
  function Read-Identity {try{(Invoke-WebRequest 'http://127.0.0.1:49271/__workplace' -UseBasicParsing -TimeoutSec 2).Content}catch{''}}
  $found=Read-Identity
  if($found -and $found -ne $identity){throw 'Port 49271 is serving another project. Close its local server before moving this project.'}
  if(!$found){
   Start-Process (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -WindowStyle Hidden -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+(Join-Path $PSScriptRoot 'Serve-Workplace.ps1')+'"')) | Out-Null
   for($i=0;$i -lt 20;$i++){Start-Sleep -Milliseconds 250;if((Read-Identity) -eq $identity){break}}
   if((Read-Identity) -ne $identity){throw 'The local server could not start. Check company policy or port 49271. File mode is also available.'}
  }
 }
 Start-Process -FilePath $edge -ArgumentList @('--app="'+$url+'"')
}catch{
 Add-Type -AssemblyName System.Windows.Forms
 [Windows.Forms.MessageBox]::Show($_.Exception.Message,'Workplace startup') | Out-Null
 exit 1
}
