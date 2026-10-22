$ErrorActionPreference = 'Stop'

# Permanent-ish encoding repair + guard for the Jenifer Finance Portfolio.
# Windows PowerShell 5.1+ compatible. Does not read or print .env files.

$Project = 'C:\Projects\jenifer-finance-portfolio'
if (!(Test-Path -LiteralPath $Project -PathType Container)) {
    throw "Project folder not found: $Project"
}
Set-Location -LiteralPath $Project

function New-UString {
    param([Parameter(Mandatory=$true)][int[]]$CodePoints)
    return -join ($CodePoints | ForEach-Object { [char]$_ })
}

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupRoot = "C:\Projects\jenifer-finance-portfolio-encoding-backup-$Stamp"
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Keep historical snapshots outside the source tree so TypeScript/ESLint do not compile them.
$InProjectBackups = Join-Path $Project 'backups'
if (Test-Path -LiteralPath $InProjectBackups -PathType Container) {
    $MovedBackups = "C:\Projects\jenifer-finance-portfolio-backups-$Stamp"
    if (Test-Path -LiteralPath $MovedBackups) {
        throw "Backup destination already exists: $MovedBackups"
    }
    Move-Item -LiteralPath $InProjectBackups -Destination $MovedBackups
    Write-Host "Moved historical backups outside project: $MovedBackups" -ForegroundColor Cyan
}

$SourceDirs = @('app','components','lib','public','scripts','supabase')
$Extensions = @('.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.css','.scss','.html','.md','.txt','.svg','.yml','.yaml','.sql')
$SourceFiles = [System.Collections.Generic.List[string]]::new()
foreach ($Dir in $SourceDirs) {
    if (Test-Path -LiteralPath (Join-Path $Project $Dir) -PathType Container) {
        Get-ChildItem -LiteralPath (Join-Path $Project $Dir) -Recurse -File -ErrorAction Stop |
            Where-Object {
                $_.Extension.ToLowerInvariant() -in $Extensions -and
                $_.FullName -notmatch '[\\/](node_modules|\.next|backups|\.git|dist|build|coverage)[\\/]'
            } |
            ForEach-Object { $SourceFiles.Add($_.FullName) }
    }
}
$RootTextFiles = @('package.json','next.config.ts','next.config.mjs','tsconfig.json','eslint.config.mjs','eslint.config.js','postcss.config.mjs','postcss.config.js','proxy.ts','middleware.ts','.gitignore','.gitattributes','.editorconfig')
foreach ($Name in $RootTextFiles) {
    $Path = Join-Path $Project $Name
    if ((Test-Path -LiteralPath $Path -PathType Leaf) -and !$SourceFiles.Contains($Path)) {
        $SourceFiles.Add($Path)
    }
}

# Exact, reversible fixes for common Windows-1252/UTF-8 mojibake. Build the damaged sequences
# from code points so terminal encoding cannot corrupt this repair script itself.
$ReplacementPairs = @(
    @{ Old = (New-UString @(0x00E2,0x20AC,0x00A2)); New = (New-UString @(0x2022)) }, # bullet
    @{ Old = (New-UString @(0x00E2,0x20AC,0x00A6)); New = (New-UString @(0x2026)) }, # ellipsis
    @{ Old = (New-UString @(0x00E2,0x20AC,0x0153)); New = (New-UString @(0x201C)) }, # left double quote
    @{ Old = (New-UString @(0x00E2,0x20AC,0x009D)); New = (New-UString @(0x201D)) }, # right double quote
    @{ Old = (New-UString @(0x00E2,0x20AC,0x2122)); New = (New-UString @(0x2019)) }, # right apostrophe
    @{ Old = (New-UString @(0x00E2,0x20AC,0x02DC)); New = (New-UString @(0x2018)) }, # left apostrophe
    @{ Old = (New-UString @(0x00E2,0x20AC,0x201C)); New = (New-UString @(0x2013)) }, # en dash
    @{ Old = (New-UString @(0x00E2,0x20AC,0x201D)); New = (New-UString @(0x2014)) }, # em dash
    @{ Old = (New-UString @(0x00C3,0x00A9)); New = (New-UString @(0x00E9)) }, # e acute
    @{ Old = (New-UString @(0x00C3,0x00A1)); New = (New-UString @(0x00E1)) }, # a acute
    @{ Old = (New-UString @(0x00C3,0x00A0)); New = (New-UString @(0x00E0)) }, # a grave
    @{ Old = (New-UString @(0x00C3,0x00A8)); New = (New-UString @(0x00E8)) }, # e grave
    @{ Old = (New-UString @(0x00C3,0x00AD)); New = (New-UString @(0x00ED)) }, # i acute
    @{ Old = (New-UString @(0x00C3,0x00B3)); New = (New-UString @(0x00F3)) }, # o acute
    @{ Old = (New-UString @(0x00C3,0x00BA)); New = (New-UString @(0x00FA)) }, # u acute
    @{ Old = (New-UString @(0x00C3,0x00B1)); New = (New-UString @(0x00F1)) }, # n tilde
    @{ Old = (New-UString @(0x00C3,0x00BC)); New = (New-UString @(0x00FC)) }, # u umlaut
    @{ Old = (New-UString @(0x00C3,0x00A4)); New = (New-UString @(0x00E4)) }, # a umlaut
    @{ Old = (New-UString @(0x00C3,0x00B6)); New = (New-UString @(0x00F6)) }, # o umlaut
    @{ Old = (New-UString @(0x00C3,0x00A7)); New = (New-UString @(0x00E7)) }, # c cedilla
    @{ Old = (New-UString @(0x00C2,0x00B7)); New = (New-UString @(0x00B7)) }, # middle dot
    @{ Old = (New-UString @(0x00C2,0x00A9)); New = (New-UString @(0x00A9)) }, # copyright
    @{ Old = (New-UString @(0x00C2,0x00AE)); New = (New-UString @(0x00AE)) }, # registered
    @{ Old = (New-UString @(0x00C2,0x00A3)); New = (New-UString @(0x00A3)) }  # pound
)

# Also correct known semantic corruption in source phrases (quotes substituted for punctuation).
$SemanticPairs = @(
    @{ Old = ('other relevant professional experiences' + (New-UString @(0x201D)) + 'clearly distinguished and factually supported.'); New = 'other relevant professional experiences, clearly distinguished and factually supported.' },
    @{ Old = ('business implications' + (New-UString @(0x201D)) + 'not just the final chart.'); New = 'business implications - not just the final chart.' },
    @{ Old = ('?` ' + (New-UString @(0x201C)) + ' ${s(x.data.end_date)}`:""'); New = '?` - ${s(x.data.end_date)}`:""' },
    @{ Old = 'String(education.length?"01":"' + (New-UString @(0x201D)) + '")'; New = 'String(education.length?"01":"00")' }
)

$ChangedCount = 0
$ChangedFiles = [System.Collections.Generic.List[string]]::new()
foreach ($Path in ($SourceFiles | Select-Object -Unique)) {
    $Text = [System.IO.File]::ReadAllText($Path)
    $Original = $Text
    foreach ($Pair in $ReplacementPairs) { $Text = $Text.Replace($Pair.Old, $Pair.New) }
    foreach ($Pair in $SemanticPairs) { $Text = $Text.Replace($Pair.Old, $Pair.New) }
    if ($Text -ne $Original) {
        $Relative = $Path.Substring($Project.Length).TrimStart('\','/')
        $BackupPath = Join-Path $BackupRoot $Relative
        $BackupDir = Split-Path -Parent $BackupPath
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
        Copy-Item -LiteralPath $Path -Destination $BackupPath -Force
        [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
        $ChangedCount++
        $ChangedFiles.Add($Relative)
        Write-Host "Repaired: $Relative" -ForegroundColor Green
    }
}

# Establish repository/editor defaults. Preserve existing configuration and append only missing rules.
$EditorConfig = Join-Path $Project '.editorconfig'
$EditorText = if (Test-Path -LiteralPath $EditorConfig) { [System.IO.File]::ReadAllText($EditorConfig) } else { '' }
if (Test-Path -LiteralPath $EditorConfig) { Copy-Item -LiteralPath $EditorConfig -Destination (Join-Path $BackupRoot '.editorconfig') -Force }
# Add root-level defaults without placing a root key inside an existing section.
if ($EditorText -notmatch '(?m)^charset\s*=\s*utf-8\s*$') {
    if ([string]::IsNullOrWhiteSpace($EditorText)) {
        $EditorText = "root = true`r`n`r`n[*]`r`ncharset = utf-8`r`nend_of_line = lf`r`ninsert_final_newline = true`r`n"
    } else {
        if ($EditorText -notmatch '(?m)^root\s*=\s*true\s*$') { $EditorText = "root = true`r`n`r`n" + $EditorText }
        $EditorText += "`r`n[*]`r`ncharset = utf-8`r`nend_of_line = lf`r`ninsert_final_newline = true`r`n"
    }
    [System.IO.File]::WriteAllText($EditorConfig, $EditorText, $Utf8NoBom)
}

$GitAttributes = Join-Path $Project '.gitattributes'
$AttrText = if (Test-Path -LiteralPath $GitAttributes) { [System.IO.File]::ReadAllText($GitAttributes) } else { '' }
if (Test-Path -LiteralPath $GitAttributes) { Copy-Item -LiteralPath $GitAttributes -Destination (Join-Path $BackupRoot '.gitattributes') -Force }
$AttrLines = @('*.ts text eol=lf','*.tsx text eol=lf','*.js text eol=lf','*.jsx text eol=lf','*.mjs text eol=lf','*.json text eol=lf','*.css text eol=lf','*.md text eol=lf','*.sql text eol=lf')
foreach ($Rule in $AttrLines) {
    if ($AttrText -notmatch ('(?m)^' + [regex]::Escape($Rule) + '\s*$')) { $AttrText += "`r`n$Rule" }
}
[System.IO.File]::WriteAllText($GitAttributes, $AttrText.TrimStart("`r","`n") + "`r`n", $Utf8NoBom)

# Protect local secrets in future Git setups too. Do not inspect or modify .env.local.
$GitIgnore = Join-Path $Project '.gitignore'
$IgnoreText = if (Test-Path -LiteralPath $GitIgnore) { [System.IO.File]::ReadAllText($GitIgnore) } else { '' }
if (Test-Path -LiteralPath $GitIgnore) { Copy-Item -LiteralPath $GitIgnore -Destination (Join-Path $BackupRoot '.gitignore') -Force }
foreach ($Rule in @('.env*','!.env.example','!.env.*.example')) {
    if ($IgnoreText -notmatch ('(?m)^' + [regex]::Escape($Rule) + '\s*$')) { $IgnoreText += "`r`n$Rule" }
}
[System.IO.File]::WriteAllText($GitIgnore, $IgnoreText.TrimStart("`r","`n") + "`r`n", $Utf8NoBom)

# Add an ongoing encoding gate to npm lint and prebuild.
$PackagePath = Join-Path $Project 'package.json'
if (!(Test-Path -LiteralPath $PackagePath)) { throw 'package.json not found.' }
$PackageOriginal = [System.IO.File]::ReadAllText($PackagePath)
try { $Package = $PackageOriginal | ConvertFrom-Json } catch { throw 'package.json is invalid JSON; package scripts were not changed.' }
$Scripts = $Package.scripts
if ($null -eq $Scripts) { throw 'package.json has no scripts object; package scripts were not changed.' }
$ScriptsObject = @{}
foreach ($Property in $Scripts.PSObject.Properties) { $ScriptsObject[$Property.Name] = [string]$Property.Value }

# Write a self-contained source encoding checker using escaped code points (not corrupted literals).
$ScriptsDir = Join-Path $Project 'scripts'
New-Item -ItemType Directory -Path $ScriptsDir -Force | Out-Null
$CheckerPath = Join-Path $ScriptsDir 'check-text-encoding.mjs'
$Checker = @'
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const roots = ["app", "components", "lib", "public", "scripts", "supabase"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".scss", ".html", ".md", ".txt", ".svg", ".yml", ".yaml", ".sql"]);
const cp = (...points) => String.fromCharCode(...points);
const markers = [
  { label: "UTF-8/Windows-1252 punctuation corruption", token: cp(0x00e2, 0x20ac) },
  { label: "misdecoded emoji sequence", token: cp(0x00f0, 0x0178) },
  { label: "replacement-character mojibake", token: cp(0x00ef, 0x00bf, 0x00bd) },
  { label: "Unicode replacement character (original text may be lost)", token: cp(0xfffd) },
  { label: "misdecoded accented e", token: cp(0x00c3, 0x00a9) },
  { label: "misdecoded accented a", token: cp(0x00c3, 0x00a1) },
  { label: "misdecoded accented o", token: cp(0x00c3, 0x00b3) },
  { label: "misdecoded n tilde", token: cp(0x00c3, 0x00b1) },
  { label: "misdecoded middle dot", token: cp(0x00c2, 0x00b7) },
  { label: "misdecoded copyright mark", token: cp(0x00c2, 0x00a9) },
];
const ignored = new Set(["node_modules", ".next", "backups", ".git", "dist", "build", "coverage"]);
const problems = [];
function scan(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(absolute);
    else if (extensions.has(path.extname(entry.name).toLowerCase())) {
      let text;
      try { text = fs.readFileSync(absolute, "utf8"); } catch (error) {
        problems.push(`${path.relative(root, absolute)}: unable to read UTF-8 (${error.message})`);
        continue;
      }
      const lines = text.split(/\r?\n/);
      lines.forEach((line, index) => {
        for (const marker of markers) {
          if (line.includes(marker.token)) {
            problems.push(`${path.relative(root, absolute)}:${index + 1}: ${marker.label}`);
            break;
          }
        }
        if (/[\u0080-\u009f]/u.test(line)) {
          problems.push(`${path.relative(root, absolute)}:${index + 1}: unexpected control character`);
        }
      });
    }
  }
}
for (const dir of roots) scan(path.join(root, dir));
for (const file of ["package.json", "next.config.ts", "next.config.mjs", "tsconfig.json", "eslint.config.mjs", "postcss.config.mjs", ".editorconfig", ".gitattributes"]) {
  const absolute = path.join(root, file);
  if (fs.existsSync(absolute)) {
    let text;
    try { text = fs.readFileSync(absolute, "utf8"); } catch { continue; }
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const marker of markers) {
        if (line.includes(marker.token)) {
          problems.push(`${file}:${index + 1}: ${marker.label}`);
          break;
        }
      }
      if (/[\u0080-\u009f]/u.test(line)) problems.push(`${file}:${index + 1}: unexpected control character`);
    });
  }
}
if (problems.length) {
  console.error("Text-encoding check failed. Repair these source lines before committing/deploying:");
  for (const problem of problems) console.error(` - ${problem}`);
  process.exitCode = 1;
} else {
  console.log("Text-encoding check passed: no known mojibake patterns found in source files.");
}
'@
[System.IO.File]::WriteAllText($CheckerPath, $Checker, $Utf8NoBom)
$ScriptsObject['check:encoding'] = 'node scripts/check-text-encoding.mjs'
$OldLint = if ($ScriptsObject.ContainsKey('lint')) { $ScriptsObject['lint'] } else { 'eslint .' }
if ($OldLint -notmatch 'check:encoding') { $ScriptsObject['lint'] = "$OldLint && npm run check:encoding" } else { $ScriptsObject['lint'] = $OldLint }
$OldPrebuild = if ($ScriptsObject.ContainsKey('prebuild')) { $ScriptsObject['prebuild'] } else { '' }
if ($OldPrebuild -notmatch 'check:encoding') {
    $ScriptsObject['prebuild'] = if ([string]::IsNullOrWhiteSpace($OldPrebuild)) { 'npm run check:encoding' } else { "npm run check:encoding && $OldPrebuild" }
}
$Package.scripts = $ScriptsObject
$PackageBackupPath = Join-Path $BackupRoot 'package.json'
Copy-Item -LiteralPath $PackagePath -Destination $PackageBackupPath -Force
[System.IO.File]::WriteAllText($PackagePath, ($Package | ConvertTo-Json -Depth 100) + "`n", $Utf8NoBom)

# Final scan occurs via the newly installed guard; if unknown patterns remain, do not claim success.
Write-Host "`nSource repair summary: $ChangedCount file(s) repaired." -ForegroundColor Cyan
Write-Host "Changed-file backups: $BackupRoot" -ForegroundColor Cyan
Write-Host "UTF-8 editor rules installed; encoding check added to lint and prebuild." -ForegroundColor Green

Write-Host "`n[1/4] Encoding guard..." -ForegroundColor Cyan
npm.cmd run check:encoding
if ($LASTEXITCODE -ne 0) { throw "Encoding guard found remaining suspicious text. Review messages above; backups are at $BackupRoot" }

Write-Host "`n[2/4] TypeScript..." -ForegroundColor Cyan
npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed. Backups are at $BackupRoot" }

Write-Host "`n[3/4] Lint (includes encoding guard)..." -ForegroundColor Cyan
npm.cmd run lint
if ($LASTEXITCODE -ne 0) { throw "Lint or encoding guard failed. Backups are at $BackupRoot" }

Write-Host "`n[4/4] Production build (prebuild runs encoding guard)..." -ForegroundColor Cyan
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "Production build failed. Backups are at $BackupRoot" }

Write-Host "`nSUCCESS: repairs and prevention checks passed." -ForegroundColor Green
Write-Host "Note: this protects source files. Text already saved in Supabase must be audited separately." -ForegroundColor Yellow
