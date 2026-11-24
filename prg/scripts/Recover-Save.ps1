# Writes a new recovery commit. Customer files and previous snapshots are read-only.
param([Parameter(Mandatory=$true)][string]$SaveFolder,[string]$Commit)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath $SaveFolder).Path
$commits=Join-Path $root 'commits'
# Korean bulletin folder name, kept ASCII for Windows PowerShell 5.1.
$boardFolder=-join @([char]0xAC8C,[char]0xC2DC,[char]0xD310)
$postDirectory=Join-Path (Join-Path (Split-Path $root -Parent) 'save') $boardFolder
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
 $dataRoot=if($head.dataStore -eq 'save'){Join-Path (Split-Path $root -Parent) 'save'}else{$root}
 foreach($part in $head.parts.PSObject.Properties){
  if($part.Name -notin @('work','memo','leave','board','people','settings','assets','cards','toys','publishing') -or $part.Value -notmatch '^[a-f0-9-]{36}$'){throw 'Invalid module path'}
  $data=Get-Content -LiteralPath (Join-Path (Join-Path $dataRoot $part.Name) ($part.Value+'.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach($item in $data.PSObject.Properties){$state[$item.Name]=$item.Value}
 }
 if($head.personalParts){
  $state.personal=[ordered]@{}
  foreach($person in $head.personalParts.PSObject.Properties){
   if($person.Value -notmatch '^[a-f0-9-]{36}$'){throw 'Invalid personal path'}
   # Match encodeURIComponent used by the browser, including its unescaped punctuation.
   $encoded=[Uri]::EscapeDataString($person.Name).Replace('%21','!').Replace('%27',"'").Replace('%28','(').Replace('%29',')').Replace('%2A','*')
   $personalPath=if($head.personalStore -eq 'save'){'save/users'}else{'dist/users'}
   $userFolder=Join-Path (Join-Path (Split-Path $root -Parent) $personalPath) $encoded
   $state.personal[$person.Name]=@(Get-Content -LiteralPath (Join-Path $userFolder ($person.Value+'.json')) -Raw -Encoding UTF8 | ConvertFrom-Json)
  }
 }
 if($head.PSObject.Properties['postParts']){
  $state.teamPosts=@(foreach($entry in $head.postParts){
   if(!$entry.id -or $entry.revision -notmatch '^[a-f0-9-]{36}$'){throw 'Invalid bulletin post path'}
   $post=Get-Content -LiteralPath (Join-Path $postDirectory ($entry.revision+'.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
   if($post.id -cne $entry.id){throw 'Bulletin post ID does not match the manifest'}
   foreach($item in @($post)+@($post.comments)){
    foreach($attachment in $item.attachments){
     if($attachment.assetRevision){
      if($attachment.assetRevision -notmatch '^[a-f0-9-]{36}$'){throw 'Invalid attachment path'}
      $assetFolder=Join-Path $postDirectory (-join @([char]0xCCA8,[char]0xBD80))
      $asset=Get-Content -LiteralPath (Join-Path $assetFolder ($attachment.assetRevision+'.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
      foreach($property in $asset.PSObject.Properties){$attachment | Add-Member -MemberType NoteProperty -Name $property.Name -Value $property.Value -Force}
      $attachment.PSObject.Properties.Remove('assetRevision')
     }
    }
   }
   $post
  })
 }
 if($head.PSObject.Properties['leaveParts']){
  $parts=$head.leaveParts
  $leaveFolder=Join-Path (Join-Path (Split-Path $root -Parent) 'save') (-join @([char]0xD734,[char]0xAC00))
  if('leaves' -in $parts.fields){$state.leaves=@()}
  if('leaveAllowances' -in $parts.fields){$state.leaveAllowances=[ordered]@{}}
  foreach($year in $parts.years.PSObject.Properties){
   if($year.Name -notmatch '^\d{4}$' -or $year.Value -notmatch '^[a-f0-9-]{36}$'){throw 'Invalid leave year path'}
   $data=Get-Content -LiteralPath (Join-Path (Join-Path $leaveFolder $year.Name) ($year.Value+'.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
   if('leaves' -in $parts.fields){$state.leaves+=@($data.leaves)}
   if('leaveAllowances' -in $parts.fields -and $data.hasAllowances){$state.leaveAllowances[$year.Name]=$data.allowances}
  }
  if('leaves' -in $parts.fields){$byId=@{};foreach($leave in $state.leaves){$byId[$leave.id]=$leave};$state.leaves=@(foreach($leaveId in $parts.order){if(!$byId.ContainsKey($leaveId)){throw 'Missing leave record'};$byId[$leaveId]})}
  if($parts.settings){
   if($parts.settings -notmatch '^[a-f0-9-]{36}$'){throw 'Invalid leave settings path'}
   $settingsFolder=Join-Path $leaveFolder (-join @([char]0xC124,[char]0xC815))
   $settings=Get-Content -LiteralPath (Join-Path $settingsFolder ($parts.settings+'.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
   foreach($property in $settings.PSObject.Properties){$state[$property.Name]=$property.Value}
  }
 }
 [IO.File]::WriteAllText((Join-Path $exports ($head.id+'.json')),($state | ConvertTo-Json -Depth 100),(New-Object Text.UTF8Encoding($false)))
}
$id=[Guid]::NewGuid().ToString()
$record=@{version=1;id=$id;parents=@($heads | ForEach-Object {$_.id});parts=$selected.parts;savedAt=[DateTime]::UtcNow.ToString('o');savedBy='manual recovery'}
if($selected.personalParts){$record.personalParts=$selected.personalParts;if($selected.personalStore){$record.personalStore=$selected.personalStore}}
if($selected.PSObject.Properties['postParts']){$record.postParts=@($selected.postParts)}
if($selected.PSObject.Properties['dataStore']){$record.dataStore=$selected.dataStore}
if($selected.PSObject.Properties['leaveParts']){$record.leaveParts=$selected.leaveParts}
$temp=Join-Path $commits ($id+'.pending')
[IO.File]::WriteAllText($temp,($record | ConvertTo-Json -Depth 100),(New-Object Text.UTF8Encoding($false)))
Move-Item -LiteralPath $temp -Destination (Join-Path $commits ($id+'.json'))
Write-Host 'Recovered selected snapshot. Other snapshots remain in process/recovery. Reload before editing.'
