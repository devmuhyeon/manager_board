param([ValidateSet('Local','File')][string]$Mode='Local',[string]$ServerUrl)
$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$shell=New-Object -ComObject WScript.Shell
$shortcut=$shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'WorkLog.lnk'))
$shortcut.TargetPath=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments='-NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+(Join-Path $PSScriptRoot 'Start-WorkLog.ps1')+'" -Mode '+$Mode
if($ServerUrl){
 if($ServerUrl -notmatch '^https://[^\s"]+$'){throw 'ServerUrl must be an HTTPS address.'}
 $shortcut.Arguments+=' -ServerUrl "'+$ServerUrl+'"'
}
$shortcut.WorkingDirectory=$projectRoot
$shortcut.IconLocation=(Join-Path $projectRoot 'source\images\ico\WorkLog.ico')+',0'
$shortcut.Description='WorkLog - Edge app window'
$shortcut.Save()
Write-Host 'Created WorkLog shortcut on the Desktop. Re-run after moving the project folder.'
