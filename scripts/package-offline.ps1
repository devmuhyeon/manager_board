$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputFolder = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $outputFolder -Force | Out-Null
$runtimeNames = @('index.html','html','js','source','font','images','server.cjs','README.md','scripts','Create-Desktop-Shortcut.bat','Start-Workplace.bat')
$runtimePaths = $runtimeNames | ForEach-Object { Join-Path $projectRoot $_ }
$archive = Join-Path $outputFolder 'manager-board-offline.zip'
Compress-Archive -LiteralPath $runtimePaths -DestinationPath $archive -CompressionLevel Optimal -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
try {
  $files = @($zip.Entries | Where-Object { $_.Name })
  if ($files | Where-Object { $_.FullName -match '(^|[/\\])(node_modules|\.git|\.workboard-presence|save)([/\\]|$)|\.json$|\.bak$' }) { throw 'Archive contains private data or development dependencies.' }
  [pscustomobject]@{Archive=$archive;Files=$files.Count;SizeMB=[Math]::Round((Get-Item -LiteralPath $archive).Length / 1MB,2)}
} finally { $zip.Dispose() }
