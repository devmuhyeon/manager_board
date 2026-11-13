# Windows PowerShell/.NET only. Loopback static files; no data/write API.
param([int]$Port=49271)
$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$sha=[Security.Cryptography.SHA256]::Create();try{$identity=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($projectRoot))).Replace('-','')}finally{$sha.Dispose()}
$types=@{'.html'='text/html; charset=utf-8';'.css'='text/css; charset=utf-8';'.js'='application/javascript; charset=utf-8';'.png'='image/png';'.jpg'='image/jpeg';'.jpeg'='image/jpeg';'.webp'='image/webp';'.svg'='image/svg+xml';'.ico'='image/x-icon';'.woff2'='font/woff2'}
$listener=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,$Port)
$listener.Start()
try{
 while($true){
  $client=$listener.AcceptTcpClient();$client.ReceiveTimeout=5000;$client.SendTimeout=10000
  try{
   $stream=$client.GetStream();$reader=New-Object IO.StreamReader($stream,[Text.Encoding]::ASCII,$false,1024,$true)
   $line=$reader.ReadLine();$total=0;$hostHeader=''
   do{$header=$reader.ReadLine();$total+=$header.Length;if($total -gt 16384){throw 'Headers too large'};if($header -match '^Host:\s*(.+)$'){$hostHeader=$Matches[1]}}while($header)
   $status='404 Not Found';$type='text/plain';$bytes=[Text.Encoding]::UTF8.GetBytes('Not found')
   if($line -match '^GET (/\S*) HTTP/1\.[01]$' -and $hostHeader -in @("127.0.0.1:$Port","localhost:$Port")){
    $name=[Uri]::UnescapeDataString(($Matches[1] -split '\?')[0])
    if($name -eq '/__workplace'){$status='200 OK';$bytes=[Text.Encoding]::UTF8.GetBytes($identity)}
    else{
     if($name -in @('/','/index.html','/html/index.html')){$name='/source/html/index.html'}
     $parts=$name.Split('/');$file=[IO.Path]::GetFullPath((Join-Path $projectRoot $name.TrimStart('/')));$ext=[IO.Path]::GetExtension($file).ToLowerInvariant()
     $safe=($parts[1] -eq 'source' -or $name -in @('/test/preview-data.js','/test/request-samples.js','/test/legacy-samples.js')) -and !($parts | Where-Object {$_ -eq '..' -or $_.StartsWith('.')}) -and !$name.Contains('\') -and !$name.Contains(':') -and $file.StartsWith($projectRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)
     if($safe -and $types.ContainsKey($ext) -and (Test-Path -LiteralPath $file -PathType Leaf)){
      $probe=Get-Item -LiteralPath $file
      while($probe.FullName -ne $projectRoot){if($probe.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked resources are not served'};$probe=$probe.Parent;if(!$probe){$probe=(Get-Item -LiteralPath $file).Directory}}
      $status='200 OK';$type=$types[$ext];$bytes=[IO.File]::ReadAllBytes($file)
     }
    }
   }
   $head=[Text.Encoding]::ASCII.GetBytes("HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nConnection: close`r`n`r`n")
   $stream.Write($head,0,$head.Length);$stream.Write($bytes,0,$bytes.Length)
  }catch{}finally{$client.Dispose()}
 }
}finally{$listener.Stop()}
