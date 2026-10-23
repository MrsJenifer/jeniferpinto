[CmdletBinding()]
param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [switch]$SkipBuild,
  [switch]$SkipBrowserTests
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
if (-not (Test-Path -LiteralPath (Join-Path (Get-Location) "package.json"))) {
  throw "Run this script from the portfolio repository root (the folder containing package.json)."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportRoot = Join-Path $env:LOCALAPPDATA "JeniferFinancePortfolio\AuditReports"
$reportDir = Join-Path $reportRoot "security-ux-audit-$stamp"
$null = New-Item -ItemType Directory -Force -Path $reportDir
$results = [System.Collections.Generic.List[object]]::new()

function Add-Result {
  param([string]$Name, [string]$Status, [string]$Details, [long]$DurationMs = 0)
  $results.Add([pscustomobject]@{ Name=$Name; Status=$Status; DurationMs=$DurationMs; Details=$Details })
  $color = switch ($Status) { "PASS" { "Green" } "FAIL" { "Red" } "WARN" { "Yellow" } default { "Gray" } }
  Write-Host ("[{0}] {1} - {2}" -f $Status, $Name, $Details) -ForegroundColor $color
}

function Invoke-NpmCheck {
  param([string]$Name, [string[]]$Arguments)
  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  & npm.cmd @Arguments
  $code = $LASTEXITCODE
  $watch.Stop()
  if ($code -eq 0) { Add-Result $Name "PASS" "Exit code 0" $watch.ElapsedMilliseconds }
  else { Add-Result $Name "FAIL" "Exit code $code" $watch.ElapsedMilliseconds }
}

Write-Host "`n=== JENIFER PORTFOLIO SECURITY / UX / MOBILE AUDIT ===" -ForegroundColor Cyan
Write-Host "Target: $BaseUrl"
Write-Host "Repository: $(Get-Location)"
Write-Host "This script runs checks; it does not perform destructive tests or submit forms. `n"

# Static checks; all checks continue so one failure does not hide the rest.
Invoke-NpmCheck "Encoding guard" @("run", "check:encoding")
Invoke-NpmCheck "TypeScript" @("run", "typecheck")
Invoke-NpmCheck "ESLint" @("run", "lint")
Invoke-NpmCheck "Source verification" @("run", "verify:source")
Invoke-NpmCheck "Production dependency audit (high+)" @("audit", "--omit=dev", "--audit-level=high")
Invoke-NpmCheck "All dependency audit (high+)" @("audit", "--audit-level=high")

# Check .env.local is ignored and not tracked. Never print environment-file contents.
$ignoreOutput = & git check-ignore .env.local 2>$null
$ignoreCode = $LASTEXITCODE
if ($ignoreCode -eq 0 -and $ignoreOutput) { Add-Result "Environment file ignored" "PASS" ".env.local is ignored by Git." }
else { Add-Result "Environment file ignored" "FAIL" ".env.local is not confirmed ignored. Check .gitignore before committing." }
$trackedEnv = & git ls-files --error-unmatch -- .env.local 2>$null
if ($LASTEXITCODE -eq 0 -and $trackedEnv) { Add-Result "Environment file untracked" "FAIL" ".env.local is already tracked. Remove it from Git history/index and rotate any exposed secrets." }
else { Add-Result "Environment file untracked" "PASS" ".env.local is not tracked by Git." }

& git diff --check
if ($LASTEXITCODE -eq 0) { Add-Result "Git whitespace check" "PASS" "git diff --check passed." }
else { Add-Result "Git whitespace check" "FAIL" "git diff --check reported whitespace errors." }

if (-not $SkipBuild) { Invoke-NpmCheck "Production build" @("run", "build") }
else { Add-Result "Production build" "WARN" "Skipped by parameter." }

# Run no-credential checks when a server is already reachable. No POSTs/writes are made.
$reachable = $false
try {
  $response = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd('/') + "/") -Method GET -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
  $reachable = ([int]$response.StatusCode -eq 200)
  if ($reachable) {
    foreach ($header in @(@("X-Content-Type-Options", "nosniff"), @("X-Frame-Options", "DENY"), @("Referrer-Policy", "strict-origin-when-cross-origin"))) {
      $value = [string]$response.Headers[$header[0]]
      if ($value -and $value -ieq $header[1]) { Add-Result "Header $($header[0])" "PASS" $value }
      else { Add-Result "Header $($header[0])" "FAIL" "Expected '$($header[1])'; received '$value'." }
    }
    $csp = [string]$response.Headers["Content-Security-Policy-Report-Only"]
    if ($csp) { Add-Result "CSP report-only header" "PASS" "Present (non-blocking; review findings before enforcement)." }
    else { Add-Result "CSP report-only header" "FAIL" "Missing." }
    if ([Uri]::IsWellFormedUriString($BaseUrl, [UriKind]::Absolute) -and ([uri]$BaseUrl).Scheme -eq "https") {
      if ([string]$response.Headers["Strict-Transport-Security"]) { Add-Result "HSTS header" "PASS" ([string]$response.Headers["Strict-Transport-Security"]) }
      else { Add-Result "HSTS header" "FAIL" "Missing on HTTPS origin." }
    } else { Add-Result "HSTS header" "WARN" "Skipped because BaseUrl is not HTTPS; test production HTTPS separately." }
  }
} catch {
  Add-Result "HTTP security headers" "WARN" "Server was not reachable at $BaseUrl. Start the app to run HTTP checks."
}

if ($reachable) {
  foreach ($api in @("/api/admin/content", "/api/admin/content/versions", "/api/admin/enquiries", "/api/admin/media")) {
    $status = 0
    try {
      $r = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd('/') + $api) -Method GET -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
      $status = [int]$r.StatusCode
    } catch {
      try { $status = [int]$_.Exception.Response.StatusCode } catch { $status = 0 }
    }
    if ($status -eq 401 -or $status -eq 403) { Add-Result "Unauthenticated API $api" "PASS" "HTTP $status" }
    else { Add-Result "Unauthenticated API $api" "FAIL" "Expected 401/403; received HTTP $status." }
  }
}

if (-not $SkipBrowserTests) {
  if ((Test-Path "node_modules\@playwright\test") -and (Test-Path "node_modules\@axe-core\playwright")) {
    Invoke-NpmCheck "Playwright responsive/accessibility tests" @("exec", "playwright", "test")
  } else {
    Add-Result "Playwright responsive/accessibility tests" "WARN" "Not installed. Run: npm install --save-dev @playwright/test @axe-core/playwright; npx playwright install chromium; then rerun this script."
  }
} else {
  Add-Result "Playwright responsive/accessibility tests" "WARN" "Skipped by parameter."
}

# Playwright can clean the shared test-results directory at startup; recreate the audit folder before exporting.
$null = New-Item -ItemType Directory -Force -Path $reportDir
$results | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $reportDir "results.json") -Encoding UTF8
$results | Export-Csv -LiteralPath (Join-Path $reportDir "results.csv") -NoTypeInformation -Encoding UTF8
$summary = @(
  "Jenifer Finance Portfolio Security / UX / Mobile Audit",
  "Run: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
  "Target: $BaseUrl",
  "Total: $($results.Count)",
  "Passed: $(($results | Where-Object Status -eq 'PASS').Count)",
  "Failed: $(($results | Where-Object Status -eq 'FAIL').Count)",
  "Warnings: $(($results | Where-Object Status -eq 'WARN').Count)",
  "",
  ($results | Format-Table Name,Status,DurationMs,Details -Wrap | Out-String),
  "Limits: This does not replace a third-party penetration test, a logged-in role/RLS test, provider-side WAF checks, or review of Vercel/Supabase configuration."
)
$summary | Set-Content -LiteralPath (Join-Path $reportDir "summary.txt") -Encoding UTF8
Write-Host "`nReports: $reportDir" -ForegroundColor Cyan
$failures = @($results | Where-Object Status -eq "FAIL").Count
if ($failures -gt 0) { exit 1 }
exit 0
