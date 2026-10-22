$ErrorActionPreference = "Continue"
$Root = (Get-Location).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $Root "test-results\admin-diagnostics-$Stamp.txt"

Start-Transcript -Path $Report -Force | Out-Null

try {
    Write-Host "`n=== 1. PROJECT SCRIPTS ===" -ForegroundColor Cyan
    $Package = Get-Content ".\package.json" -Raw | ConvertFrom-Json
    $Package.scripts | Format-List

    Write-Host "`n=== 2. ADMIN SOURCE FILES ===" -ForegroundColor Cyan
    Get-ChildItem ".\app\admin" -Recurse -File |
        Where-Object { $_.Extension -in @(".tsx", ".ts", ".jsx", ".js") } |
        Select-Object FullName, Length, LastWriteTime |
        Format-Table -AutoSize -Wrap

    Write-Host "`n=== 3. ADMIN LOADING PATTERNS ===" -ForegroundColor Cyan
    $SourceFiles = Get-ChildItem ".\app\admin", ".\components", ".\lib" `
        -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -in @(".tsx", ".ts", ".jsx", ".js") }

    $Patterns = @(
        "loading", "Suspense", "useEffect", "useState",
        "isLoading", "isPending", "finally", "catch",
        "createClient", "getUser", "getSession", "fetch\(",
        "router\.refresh", "router\.push", "disabled=", "Promise\.all"
    )

    foreach ($Pattern in $Patterns) {
        Write-Host "`n--- $Pattern ---" -ForegroundColor Yellow
        $Found = @(
            $SourceFiles |
                Select-String -Pattern $Pattern -ErrorAction SilentlyContinue |
                Select-Object -First 8 Path, LineNumber, Line
        )

        if ($Found.Count -gt 0) {
            $Found | Format-Table -AutoSize -Wrap
        } else {
            Write-Host "No matches."
        }
    }

    Write-Host "`n=== 4. LOADING AND ERROR BOUNDARIES ===" -ForegroundColor Cyan
    $BoundaryFiles = @(
        Get-ChildItem ".\app" -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Name -in @(
                    "loading.tsx", "loading.ts", "error.tsx",
                    "error.ts", "global-error.tsx", "not-found.tsx"
                )
            } |
            Select-Object FullName
    )

    if ($BoundaryFiles.Count -gt 0) {
        $BoundaryFiles | Format-Table -AutoSize
    } else {
        Write-Host "No matching boundary files found."
    }

    Write-Host "`n=== 5. API ROUTES ===" -ForegroundColor Cyan
    Get-ChildItem ".\app\api" -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -in @("route.ts", "route.js") } |
        Select-Object FullName |
        Format-Table -AutoSize -Wrap

    Write-Host "`n=== 6. HTTP RESPONSE TIMINGS ===" -ForegroundColor Cyan
    $Routes = @(
        "/", "/admin", "/admin/content", "/admin/enquiries",
        "/admin/media", "/api/admin/content",
        "/api/admin/enquiries", "/api/admin/media"
    )

    $HttpResults = @(
        foreach ($Route in $Routes) {
            $Watch = [System.Diagnostics.Stopwatch]::StartNew()
            try {
                $Response = Invoke-WebRequest `
                    -Uri "http://localhost:3000$Route" `
                    -Method GET -UseBasicParsing -TimeoutSec 20 `
                    -ErrorAction Stop

                $Watch.Stop()
                [PSCustomObject]@{
                    Route = $Route
                    Status = [int]$Response.StatusCode
                    DurationMs = $Watch.ElapsedMilliseconds
                    Result = "Response received"
                }
            }
            catch {
                $Watch.Stop()
                $Status = "ERROR"
                try {
                    if ($_.Exception.Response.StatusCode) {
                        $Status = [int]$_.Exception.Response.StatusCode
                    }
                } catch {}

                [PSCustomObject]@{
                    Route = $Route
                    Status = $Status
                    DurationMs = $Watch.ElapsedMilliseconds
                    Result = "Request failed or timed out"
                }
            }
        }
    )

    $HttpResults | Format-Table -AutoSize

    Write-Host "`n=== 7. RECENT TEST REPORTS ===" -ForegroundColor Cyan
    Get-ChildItem ".\test-results" -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 10 Name, Length, LastWriteTime |
        Format-Table -AutoSize

    Write-Host "`nDiagnostics finished. Report: $Report" -ForegroundColor Green
}
finally {
    Stop-Transcript | Out-Null
}
