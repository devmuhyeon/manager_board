$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$outputFolder=Join-Path $projectRoot 'prg/releases'
New-Item -ItemType Directory -Path $outputFolder -Force | Out-Null
$stage=Join-Path $outputFolder ('package-'+[Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $stage | Out-Null
try {
 $names=@('index.html','source','docs/README.md','prg/scripts','prg/Start-Workplace.bat','prg/Create-Desktop-Shortcut.bat','test/legacy-samples.js','test/preview-data.js','test/request-samples.js')
 foreach($name in $names){$destination=Join-Path $stage $name;New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null;Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $destination -Recurse}
 foreach($folder in @('process','dist')){New-Item -ItemType Directory -Path (Join-Path $stage $folder) | Out-Null}
 $archive=Join-Path $outputFolder 'manager-board-offline.zip'
 Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $archive -CompressionLevel Optimal -Force
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $zip=[IO.Compression.ZipFile]::OpenRead($archive)
 try {if($zip.Entries | Where-Object {$_.Name -and $_.FullName -match '(^|[/\\])(node_modules|\.git|\.workboard-presence|process|dist|save)([/\\]|$)|\.json$|\.bak$'}){throw 'Private data found in archive'};[pscustomobject]@{Archive=$archive;Files=$zip.Entries.Count;SizeMB=[Math]::Round((Get-Item -LiteralPath $archive).Length/1MB,2)}} finally {$zip.Dispose()}
} finally {
 $resolvedStage=[IO.Path]::GetFullPath($stage)
 if(!$resolvedStage.StartsWith($outputFolder+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe staging path'}
 Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}
