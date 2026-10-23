[CmdletBinding()]
param()
$ErrorActionPreference = 'Continue'
$root = (Get-Location).Path
if (-not (Test-Path -LiteralPath (Join-Path $root 'package.json'))) { throw 'Run from the portfolio repository root.' }
$fail=0; $warn=0
function Report([string]$name,[bool]$ok,[string]$details,[switch]$Warning){
  if($Warning){$script:warn++; Write-Host "[WARN] $name - $details" -ForegroundColor Yellow}
  elseif($ok){Write-Host "[PASS] $name - $details" -ForegroundColor Green}
  else{$script:fail++;Write-Host "[FAIL] $name - $details" -ForegroundColor Red}
}
$required = @('app','components','lib','public','database\migrations','database\tests','docs','scripts','tests\e2e')
foreach($item in $required){ Report "Directory $item" (Test-Path -LiteralPath (Join-Path $root $item)) 'expected folder exists' }
try { $null = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json; Report 'package.json parses' $true 'valid JSON' } catch { Report 'package.json parses' $false $_.Exception.Message }
$backupFiles = @()
foreach($folder in @('app','components','lib','scripts','database','docs','public','tests')){
  $p=Join-Path $root $folder
  if(Test-Path -LiteralPath $p){$backupFiles += Get-ChildItem -LiteralPath $p -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)(\.backup-[^\\/]+|\.bak|\.before-[^\\/]+|\.orig|\.old)$' }}
}
Report 'No backup snapshots in source tree' ($backupFiles.Count -eq 0) $(if($backupFiles.Count){"$($backupFiles.Count) files remain; run scripts/organize-project-tree.ps1 -Apply"}else{'No backup snapshots found'})
$envPath=Join-Path $root '.env.local'
if(Test-Path -LiteralPath $envPath){
  $ignored = & git check-ignore .env.local 2>$null; $ignoredOk=($LASTEXITCODE -eq 0 -and $ignored)
  Report '.env.local ignored' ([bool]$ignoredOk) 'secret configuration should remain ignored'
  $tracked=& git ls-files --error-unmatch -- .env.local 2>$null; $trackedOk=($LASTEXITCODE -eq 0 -and $tracked)
  Report '.env.local not tracked' (-not $trackedOk) 'never commit local secrets'
  $text=Get-Content -LiteralPath $envPath -Raw
  $line=$text -split "`r?`n" | Where-Object { $_ -match '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=' } | Select-Object -First 1
  $hasValue=($line -and ($line -replace '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=','').Trim() -ne '')
  Report 'Server-only Supabase key configured' ([bool]$hasValue) $(if($hasValue){'key variable has a non-empty value; value not displayed'}else{'SUPABASE_SERVICE_ROLE_KEY absent or blank; contact endpoint will fail closed'}) -Warning:(-not $hasValue)
}else{Report '.env.local exists' $false 'needed for local Supabase integration' -Warning}
$diff = & git diff --check 2>&1; $diffCode=$LASTEXITCODE
Report 'git diff --check' ($diffCode -eq 0) ($(if($diffCode -eq 0){'no whitespace errors'}else{$diff -join ' '}))
Write-Host "`nTree verification summary: $($script:fail) failed; $($script:warn) warning(s)." -ForegroundColor Cyan
if($script:fail -gt 0){exit 1}; exit 0
