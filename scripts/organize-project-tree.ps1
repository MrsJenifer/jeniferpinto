[CmdletBinding()]
param(
  [switch]$Apply,
  [string]$ArchiveRoot = (Join-Path (Split-Path (Get-Location).Path -Parent) 'jenifer-finance-portfolio-maintenance')
)
$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
if (-not (Test-Path -LiteralPath (Join-Path $root 'package.json'))) {
  throw 'Run from the portfolio repository root (the folder containing package.json).'
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archive = Join-Path $ArchiveRoot ("archive-" + $stamp)
$sourceFolders = @('app','components','lib','scripts','database','docs','public','tests')
$skipSegments = @('node_modules','.next','.git','.vercel','coverage','playwright-report','test-results')
$files = [System.Collections.Generic.List[object]]::new()
foreach ($folder in $sourceFolders) {
  $path = Join-Path $root $folder
  if (-not (Test-Path -LiteralPath $path)) { continue }
  Get-ChildItem -LiteralPath $path -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $relative = $_.FullName.Substring($root.Length).TrimStart('\','/')
    $parts = $relative -split '[\\/]'
    if ($parts | Where-Object { $skipSegments -contains $_ }) { return }
    if ($_.Name -match '(?i)(\.backup-[^\\/]+|\.bak|\.before-[^\\/]+|\.orig|\.old)$') {
      $files.Add([pscustomobject]@{ Source=$_.FullName; Relative=$relative; Kind='source-backup'; Hash=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash })
    }
  }
}
# Archive known root-level backup snapshots and generated diagnostic files as well.
$rootArtifacts = Get-ChildItem -LiteralPath $root -File -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -match '(?i)(\.backup-[^\\/]+|\.before-[^\\/]+|\.bak|\.orig|\.old)$' -or
  $_.Name -match '^(npm-audit-.*\.json|repair-.*\.log|admin-diagnostics-.*\.txt|jenifer-content-schema-report\.txt|jenifer-media-integration-report\.txt|smoke-test-.*\.(json|csv|txt))$'
}
foreach ($item in $rootArtifacts) {
  $relative = $item.FullName.Substring($root.Length).TrimStart('\','/')
  if (-not ($files | Where-Object { $_.Source -eq $item.FullName })) {
    $kind = if ($item.Name -match '(?i)(\.backup-|\.before-|\.bak$|\.orig$|\.old$)') { 'root-backup' } else { 'generated-root-report' }
    $files.Add([pscustomobject]@{ Source=$item.FullName; Relative=$relative; Kind=$kind; Hash=(Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash })
  }
}
$generated = @('test-results','playwright-report','coverage') | ForEach-Object {
  $p = Join-Path $root $_
  if (Test-Path -LiteralPath $p) { Get-Item -LiteralPath $p }
}
Write-Host "Project root: $root" -ForegroundColor Cyan
Write-Host "Source backup files found: $($files.Count)"
Write-Host "Generated report folders found: $(@($generated).Count)"
if ($files.Count -gt 0) { $files | Select-Object Kind,Relative | Format-Table -AutoSize }
if (@($generated).Count -gt 0) { $generated | Select-Object Name,FullName | Format-Table -AutoSize }
if (-not $Apply) {
  Write-Host 'PREVIEW ONLY: nothing was moved. Run again with -Apply to archive verified copies outside the Git repository.' -ForegroundColor Yellow
  return
}
New-Item -ItemType Directory -Force -Path (Join-Path $archive 'source-backups') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $archive 'generated-reports') | Out-Null
$manifest = [System.Collections.Generic.List[object]]::new()
foreach ($item in $files) {
  $dest = Join-Path (Join-Path $archive 'source-backups') $item.Relative
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
  Copy-Item -LiteralPath $item.Source -Destination $dest -Force
  $copyHash = (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash
  if ($copyHash -ne $item.Hash) { throw "Backup verification failed; original retained: $($item.Source)" }
  Remove-Item -LiteralPath $item.Source -Force
  $manifest.Add([pscustomobject]@{ Kind=$item.Kind; Original=$item.Relative; Archived=$dest; SHA256=$item.Hash })
}
foreach ($dir in $generated) {
  $dest = Join-Path (Join-Path $archive 'generated-reports') $dir.Name
  Copy-Item -LiteralPath $dir.FullName -Destination $dest -Recurse -Force
  $sourceFiles = @(Get-ChildItem -LiteralPath $dir.FullName -File -Recurse)
  $verified = $true
  foreach ($srcFile in $sourceFiles) {
    $rel = $srcFile.FullName.Substring($dir.FullName.Length).TrimStart('\','/')
    $copy = Join-Path $dest $rel
    if (-not (Test-Path -LiteralPath $copy)) { $verified=$false; break }
    if ((Get-FileHash -LiteralPath $srcFile.FullName -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash) { $verified=$false; break }
  }
  if (-not $verified) { throw "Report folder verification failed; original retained: $($dir.FullName)" }
  Remove-Item -LiteralPath $dir.FullName -Recurse -Force
  $manifest.Add([pscustomobject]@{ Kind='generated-report-folder'; Original=$dir.FullName; Archived=$dest; SHA256='Per-file hashes verified' })
}
$manifestPath = Join-Path $archive 'archive-manifest.csv'
$manifest | Export-Csv -LiteralPath $manifestPath -NoTypeInformation -Encoding UTF8
Write-Host "`nArchive verified. Originals were removed from the repo only after copy/hash verification." -ForegroundColor Green
Write-Host "Archive: $archive"
Write-Host "Manifest: $manifestPath"
Write-Host 'Note: tracked backup files will appear as deletions in git status; commit those deletions to keep the project tree clean.'
