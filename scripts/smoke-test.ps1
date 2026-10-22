[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:3000",
    [int]$TimeoutSeconds = 15
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportDir = Join-Path (Get-Location) "test-results"
$null = New-Item -ItemType Directory -Force -Path $reportDir

$script:Results = [System.Collections.Generic.List[object]]::new()
$script:Failures = 0
$script:Warnings = 0

function Add-TestResult {
    param(
        [string]$Category,
        [string]$Name,
        [string]$Status,
        [string]$Details,
        [long]$DurationMs = 0
    )

    if ($Status -eq "FAIL") { $script:Failures++ }
    if ($Status -eq "WARN") { $script:Warnings++ }

    $script:Results.Add([PSCustomObject]@{
        Time       = (Get-Date).ToString("o")
        Category   = $Category
        Test       = $Name
        Status     = $Status
        DurationMs = $DurationMs
        Details    = $Details
    })

    $color = switch ($Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "WARN" { "Yellow" }
        default { "Gray" }
    }
    Write-Host ("[{0}] {1}: {2}" -f $Status, $Name, $Details) -ForegroundColor $color
}

function Invoke-SafeHttpTest {
    param(
        [string]$Path,
        [string]$Category = "Page",
        [int[]]$ExpectedStatus = @(200),
        [string]$ExpectedContentType = "",
        [switch]$RequireHtml
    )

    $uri = "$($BaseUrl.TrimEnd('/'))$Path"
    $watch = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        $response = Invoke-WebRequest `
            -Uri $uri `
            -Method GET `
            -UseBasicParsing `
            -TimeoutSec $TimeoutSeconds `
            -MaximumRedirection 5 `
            -ErrorAction Stop

        $watch.Stop()
        $status = [int]$response.StatusCode
        $contentType = [string]$response.Headers["Content-Type"]
        $details = "HTTP $status; ${contentType}; $($watch.ElapsedMilliseconds) ms"

        if ($ExpectedStatus -contains $status) {
            if ($RequireHtml -and $contentType -notmatch "text/html") {
                Add-TestResult $Category $Path "FAIL" "Expected HTML; received $contentType" $watch.ElapsedMilliseconds
            }
            elseif ($ExpectedContentType -and $contentType -notmatch $ExpectedContentType) {
                Add-TestResult $Category $Path "FAIL" "Unexpected content type: $contentType" $watch.ElapsedMilliseconds
            }
            else {
                Add-TestResult $Category $Path "PASS" $details $watch.ElapsedMilliseconds
            }
        }
        else {
            Add-TestResult $Category $Path "FAIL" "Unexpected HTTP $status; expected $($ExpectedStatus -join ', ')" $watch.ElapsedMilliseconds
        }
    }
    catch {
        $watch.Stop()
        $statusCode = $null

        # PowerShell 7 and Windows PowerShell expose HTTP errors differently.
        try {
            if ($_.Exception.Response.StatusCode) {
                $statusCode = [int]$_.Exception.Response.StatusCode
            }
        } catch {}

        if ($null -ne $statusCode -and $ExpectedStatus -contains $statusCode) {
            Add-TestResult $Category $Path "PASS" "Expected HTTP $statusCode" $watch.ElapsedMilliseconds
        }
        elseif ($null -ne $statusCode) {
            Add-TestResult $Category $Path "FAIL" "HTTP $statusCode; request did not meet expectation" $watch.ElapsedMilliseconds
        }
        else {
            # Do not print full exception objects, headers, or response bodies.
            $message = $_.Exception.Message
            if ($message.Length -gt 180) { $message = $message.Substring(0,180) }
            Add-TestResult $Category $Path "FAIL" "Request failed: $message" $watch.ElapsedMilliseconds
        }
    }
}

Write-Host "`n=== JENIFER FINANCE PORTFOLIO: SAFE SMOKE TEST ===" -ForegroundColor Cyan
Write-Host "Target: $BaseUrl"
Write-Host "Timeout: $TimeoutSeconds seconds"
Write-Host "Mode: GET-only; no database writes or form submissions`n"

# 1. Server availability. Stop early if the server cannot be reached.
try {
    $healthWatch = [System.Diagnostics.Stopwatch]::StartNew()
    $health = Invoke-WebRequest -Uri "$($BaseUrl.TrimEnd('/'))/" `
        -Method GET -UseBasicParsing -TimeoutSec $TimeoutSeconds -ErrorAction Stop
    $healthWatch.Stop()

    Add-TestResult "Availability" "Server responds" "PASS" `
        "HTTP $([int]$health.StatusCode)" $healthWatch.ElapsedMilliseconds
}
catch {
    $msg = $_.Exception.Message
    if ($msg.Length -gt 180) { $msg = $msg.Substring(0,180) }

    Add-TestResult "Availability" "Server responds" "FAIL" `
        "Server unreachable or request failed: $msg"

    Write-Host "`nFallback: start the production server in another terminal with npm.cmd run start." -ForegroundColor Yellow
    Write-Host "No further HTTP tests can run until the server is reachable." -ForegroundColor Yellow
}

# Continue tests only if the availability check passed.
$serverAvailable = $script:Results |
    Where-Object { $_.Test -eq "Server responds" -and $_.Status -eq "PASS" } |
    Select-Object -First 1

if ($serverAvailable) {
    # 2. Public and admin page responses.
    $pages = @(
        "/",
        "/about",
        "/contact",
        "/education",
        "/experience",
        "/projects",
        "/skills",
        "/privacy",
        "/admin/login",
        "/admin",
        "/admin/content",
        "/admin/enquiries",
        "/admin/media"
    )

    foreach ($path in $pages) {
        Invoke-SafeHttpTest -Path $path -Category "Page" `
            -ExpectedStatus @(200) -RequireHtml
    }

    # 3. Unauthenticated admin APIs must reject requests without a session.
    # These tests intentionally send no cookies or credentials.
    $protectedApis = @(
        "/api/admin/content",
        "/api/admin/content/versions",
        "/api/admin/enquiries",
        "/api/admin/media"
    )

    foreach ($path in $protectedApis) {
        Invoke-SafeHttpTest -Path $path -Category "Unauthenticated API" `
            -ExpectedStatus @(401,403)
    }

    # 4. Check the contact endpoint is reachable without submitting anything.
    # GET may correctly return 405 if only POST is supported.
    Invoke-SafeHttpTest -Path "/api/contact" -Category "Contact API method check" `
        -ExpectedStatus @(200, 401, 403, 405)
}

# 5. Repository checks: run without changing dependency versions.
function Invoke-SafeCommandTest {
    param([string]$Name, [string]$Executable, [string[]]$Arguments)

    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $output = & $Executable @Arguments 2>&1
        $exitCode = $LASTEXITCODE
        $watch.Stop()

        if ($exitCode -eq 0) {
            Add-TestResult "Repository" $Name "PASS" "Exit code 0" $watch.ElapsedMilliseconds
        }
        else {
            # Capture only a short tail, avoiding dumping environment secrets.
            $tail = ($output | Select-Object -Last 4 | Out-String).Trim()
            if ($tail.Length -gt 240) { $tail = $tail.Substring(0,240) }
            Add-TestResult "Repository" $Name "FAIL" "Exit $exitCode. $tail" $watch.ElapsedMilliseconds
        }
    }
    catch {
        $watch.Stop()
        $msg = $_.Exception.Message
        if ($msg.Length -gt 180) { $msg = $msg.Substring(0,180) }
        Add-TestResult "Repository" $Name "FAIL" $msg $watch.ElapsedMilliseconds
    }
}

if (Test-Path ".\package.json") {
    Invoke-SafeCommandTest "TypeScript typecheck" "npm.cmd" @("run","typecheck")
    Invoke-SafeCommandTest "ESLint" "npm.cmd" @("run","lint")
    Invoke-SafeCommandTest "Source verification" "npm.cmd" @("run","verify:source")
    Invoke-SafeCommandTest "Production dependency audit" "npm.cmd" @("audit","--omit=dev")
}
else {
    Add-TestResult "Repository" "package.json exists" "FAIL" "Run the script from the project root."
}

# 6. Save machine-readable and human-readable reports.
$jsonPath = Join-Path $reportDir "smoke-test-$stamp.json"
$csvPath  = Join-Path $reportDir "smoke-test-$stamp.csv"
$txtPath  = Join-Path $reportDir "smoke-test-$stamp.txt"

$script:Results | ConvertTo-Json -Depth 5 |
    Set-Content -LiteralPath $jsonPath -Encoding UTF8
$script:Results | Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding UTF8

$summary = @(
    "Jenifer Finance Portfolio - Smoke Test Report"
    "Run time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
    "Target: $BaseUrl"
    "Total: $($script:Results.Count)"
    "Passed: $(($script:Results | Where-Object Status -eq 'PASS').Count)"
    "Failed: $script:Failures"
    "Warnings: $script:Warnings"
    ""
    "DETAILS"
    ($script:Results | Format-Table Category,Test,Status,DurationMs,Details -Wrap | Out-String)
    ""
    "LIMITATIONS"
    "This is an HTTP smoke test and repository check, not a full security penetration test."
    "It does not verify logged-in browser sessions, UI interactions, RLS policies, or write operations."
    "No form submissions, content edits, uploads, or deletes were performed."
)
$summary | Set-Content -LiteralPath $txtPath -Encoding UTF8

Write-Host "`n=== FINAL SUMMARY ===" -ForegroundColor Cyan
Write-Host "Total:   $($script:Results.Count)"
Write-Host "Passed:  $(($script:Results | Where-Object Status -eq 'PASS').Count)" -ForegroundColor Green
Write-Host "Failed:  $script:Failures" -ForegroundColor $(if ($script:Failures) {"Red"} else {"Green"})
Write-Host "Warnings: $script:Warnings" -ForegroundColor Yellow
Write-Host "`nReports saved:"
Write-Host $jsonPath
Write-Host $csvPath
Write-Host $txtPath

if ($script:Failures -gt 0) {
    exit 1
}
exit 0
