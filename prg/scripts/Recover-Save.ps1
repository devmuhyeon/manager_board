# Writes a new recovery commit. Customer files and previous snapshots are read-only.
param([Parameter(Mandatory=$true)][string]$SaveFolder,[string]$Commit)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath $SaveFolder).Path
$commits=Join-Path $root 'commits'
$records=@(Get-ChildItem -LiteralPath $commits -Filter '*.json' | ForEach-Object {$raw=Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8;if($raw -and $raw.Trim()){$raw | ConvertFrom-Json}})
$parents=@($records | ForEach-Object {$_.parents})
$heads=@($records | Where-Object {$_.id -notin $parents})
$heads | Select-Object id,savedAt,savedBy | Format-Table
if(!$Commit){Write-Host 'Stop all writers. Use -Commit with the snapshot to restore; all branches will be exported.';exit}
$selected=$heads | Where-Object {$_.id -eq $Commit}
if(!$selected){throw 'Choose an existing head ID.'}
$exports=Join-Path $root 'recovery'
New-Item -ItemType Directory -Path $exports -Force | Out-Null
foreach($head in $heads){
 $state=[ordered]@{}
 foreach($part in $head.parts.PSObject.Properties){
  if($part.Name -notin @('work','memo','leave','board','people','settings','assets') -or $part.Value -notmatch '^[a-f0-9-]{36}$'){throw 'Invalid module path'}
  $data=Get-Content -LiteralPath (Join-Path (Join-Path $root $part.Name) ($part.Value+'.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach($item in $data.PSObject.Properties){$state[$item.Name]=$item.Value}
 }
 if($head.personalParts){
  $state.personal=[ordered]@{}
  foreach($person in $head.personalParts.PSObject.Properties){
   if($person.Value -notmatch '^[a-f0-9-]{36}$'){throw 'Invalid personal path'}
   # Match encodeURIComponent used by the browser, including its unescaped punctuation.
   $encoded=[Uri]::EscapeDataString($person.Name).Replace('%21','!').Replace('%27',"'").Replace('%28','(').Replace('%29',')').Replace('%2A','*')
   $userFolder=Join-Path (Join-Path (Split-Path $root -Parent) 'dist/users') $encoded
   $state.personal[$person.Name]=@(Get-Content -LiteralPath (Join-Path $userFolder ($person.Value+'.json')) -Raw -Encoding UTF8 | ConvertFrom-Json)
  }
 }
 [IO.File]::WriteAllText((Join-Path $exports ($head.id+'.json')),($state | ConvertTo-Json -Depth 100),(New-Object Text.UTF8Encoding($false)))
}
$id=[Guid]::NewGuid().ToString()
$record=@{version=1;id=$id;parents=@($heads | ForEach-Object {$_.id});parts=$selected.parts;savedAt=[DateTime]::UtcNow.ToString('o');savedBy='manual recovery'}
if($selected.personalParts){$record.personalParts=$selected.personalParts}
$temp=Join-Path $commits ($id+'.pending')
[IO.File]::WriteAllText($temp,($record | ConvertTo-Json -Depth 100),(New-Object Text.UTF8Encoding($false)))
Move-Item -LiteralPath $temp -Destination (Join-Path $commits ($id+'.json'))
Write-Host 'Recovered selected snapshot. Other snapshots remain in process/recovery. Reload before editing.'
