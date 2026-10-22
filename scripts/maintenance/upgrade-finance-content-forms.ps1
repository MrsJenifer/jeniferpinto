$ErrorActionPreference = "Stop"
Set-Location "C:\Projects\jenifer-finance-portfolio"

$ContentFile = ".\components\admin\ContentManager.tsx"
$ExperienceFile = ".\app\experience\page.tsx"
$EducationFile = ".\app\education\page.tsx"

foreach ($File in @($ContentFile, $ExperienceFile, $EducationFile)) {
    if (!(Test-Path -LiteralPath $File -PathType Leaf)) {
        throw "Required source file not found: $File. No files changed."
    }
}

$Content = Get-Content -LiteralPath $ContentFile -Raw
$Experience = Get-Content -LiteralPath $ExperienceFile -Raw
$Education = Get-Content -LiteralPath $EducationFile -Raw

# Add the reusable structured-field schema.
$ConfigMarker = 'function val(d:Record<string,unknown>,k:string){const v=d[k];return typeof v==="string"?v:""}'
if (!$Content.Contains($ConfigMarker)) {
    throw "Could not locate ContentManager field-helper marker. No files changed."
}
if ($Content.Contains('const structuredFields: Partial<Record<ContentType, StructuredField[]>>')) {
    throw "Structured fields already appear to be installed. No files changed."
}

$FieldConfig = @'
type StructuredField = {
  key: string;
  label: string;
  kind?: "text" | "url" | "textarea";
  placeholder?: string;
  wide?: boolean;
};

const structuredFields: Partial<Record<ContentType, StructuredField[]>> = {
  experience: [
    { key: "organisation", label: "Company / organisation", placeholder: "Company or employer name" },
    { key: "type", label: "Employment type", placeholder: "Full-time, internship, contract, freelance" },
    { key: "location", label: "Location", placeholder: "City, country or Remote" },
    { key: "start_date", label: "Start date", placeholder: "e.g. Jan 2025 or 2025-01" },
    { key: "end_date", label: "End date", placeholder: "e.g. Oct 2025, or Present for a current role" }
  ],
  education: [
    { key: "institution", label: "Institution / university", placeholder: "School, college or university" },
    { key: "start_date", label: "Start date", placeholder: "e.g. 2022 or Aug 2022" },
    { key: "end_date", label: "Graduation / end date", placeholder: "e.g. 2026 or May 2026" },
    { key: "grade", label: "Grade / GPA (optional)", placeholder: "Optional; enter only if appropriate" }
  ],
  skill: [
    { key: "evidence_url", label: "Evidence / portfolio URL", kind: "url", placeholder: "https://..." }
  ],
  certification: [
    { key: "issuer", label: "Issuing organisation", placeholder: "Certification provider" },
    { key: "issue_date", label: "Issue date", placeholder: "e.g. Oct 2026" },
    { key: "expiry_date", label: "Expiry date (optional)", placeholder: "Leave blank if it does not expire" },
    { key: "credential_id", label: "Credential ID (optional)", placeholder: "Certificate / credential identifier" },
    { key: "verification_url", label: "Credential verification URL", kind: "url", placeholder: "https://..." }
  ],
  project: [
    { key: "difficulty", label: "Level / difficulty", placeholder: "Beginner, intermediate or advanced" },
    { key: "external_url", label: "Project URL", kind: "url", placeholder: "https://..." },
    { key: "problem", label: "Business problem / objective", kind: "textarea", wide: true },
    { key: "methodology", label: "Methodology and assumptions", kind: "textarea", wide: true },
    { key: "findings", label: "Findings / results", kind: "textarea", wide: true },
    { key: "recommendations", label: "Recommendations", kind: "textarea", wide: true },
    { key: "limitations", label: "Limitations and data disclosure", kind: "textarea", wide: true }
  ]
};

'@
$Content = $Content.Replace($ConfigMarker, $ConfigMarker + "`r`n" + $FieldConfig.TrimEnd())

# Add the structured form state.
$StateMarker = 'const [tools,setTools]=useState("");'
if (!$Content.Contains($StateMarker)) {
    throw "Could not locate ContentManager state marker. No files changed."
}
$Content = $Content.Replace($StateMarker, $StateMarker + 'const [fields,setFields]=useState<Record<string,string>>({});')

# Replace edit() and buildData() with implementations that load/save structured fields.
$FunctionPattern = '(?s)function edit\(i:ContentItem\)\{.*?return base;\}'
$NewFunctions = @'
function edit(i: ContentItem) {
  const d = i.data || {};
  setSelected(i);
  setTitle(val(d, "title") || val(d, "name") || val(d, "degree") || val(d, "headline"));
  setSlug(i.slug);
  setSummary(val(d, "summary") || val(d, "intro"));
  setDescription(val(d, "description") || val(d, "bio"));
  setCategory(val(d, "category") || val(d, "specialisation"));
  setTools(Array.isArray(d.tools) ? d.tools.join(", ") : "");
  setPublished(i.is_published);
  setSortOrder(i.sort_order);
  setFeatured(Boolean(d.featured));

  const typeFields = structuredFields[i.content_type] || [];
  const nextFields: Record<string, string> = {};
  for (const field of typeFields) {
    const value = d[field.key];
    nextFields[field.key] = typeof value === "string" ? value : "";
  }
  // Older experience records may use company instead of organisation.
  if (i.content_type === "experience" && !nextFields.organisation) {
    nextFields.organisation = val(d, "company");
  }
  setFields(nextFields);

  const known = [
    "title", "name", "degree", "summary", "intro", "description", "bio",
    "category", "specialisation", "tools", "featured",
    ...typeFields.map((field) => field.key),
    ...(i.content_type === "experience" ? ["company"] : [])
  ];
  const rest = Object.fromEntries(Object.entries(d).filter(([key]) => !known.includes(key)));
  setExtra(JSON.stringify(rest, null, 2));
  setSiteTitle(val(d, "site_title"));
  setSiteDescription(val(d, "site_description"));
  setHeroTitle(val(d, "home_hero_title"));
  setSelectedTitle(val(d, "home_selected_title"));
  setSelectedIntro(val(d, "home_selected_intro"));
  setAboutTitle(val(d, "home_about_title"));
  setSkillsTitle(val(d, "home_skills_title"));
  setStepsTitle(val(d, "home_steps_title"));
  setCtaTitle(val(d, "home_cta_title"));
  setFooterTagline(val(d, "footer_tagline"));
  setJsonMode(false);
  setNotice("");
  setBad(false);
}

function buildData() {
  let rest: Record<string, unknown>;
  try {
    rest = JSON.parse(extra || "{}");
    if (!rest || Array.isArray(rest) || typeof rest !== "object") {
      throw new Error("Additional data must be a JSON object.");
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Additional data must be valid JSON.");
  }

  const base: Record<string, unknown> = { ...rest };
  const primary = type === "profile" || type === "skill" || type === "certification"
    ? "name"
    : type === "education"
      ? "degree"
      : "title";

  if (title.trim()) base[primary] = title.trim();
  if (summary.trim()) base[type === "profile" ? "intro" : "summary"] = summary.trim();
  if (description.trim()) base.description = description.trim();
  if (category.trim()) base[type === "education" ? "specialisation" : "category"] = category.trim();
  if (type === "project") {
    base.tools = tools.split(",").map((value) => value.trim()).filter(Boolean);
    base.featured = featured;
  }

  // Structured fields are saved using the keys consumed by the public pages.
  // Empty structured fields are omitted, allowing an editor to clear old values.
  for (const field of structuredFields[type] || []) {
    const value = (fields[field.key] || "").trim();
    if (value) base[field.key] = value;
  }

  if (type === "site_settings") {
    Object.assign(base, {
      site_title: siteTitle.trim(),
      site_description: siteDescription.trim(),
      home_hero_title: heroTitle.trim(),
      home_selected_title: selectedTitle.trim(),
      home_selected_intro: selectedIntro.trim(),
      home_about_title: aboutTitle.trim(),
      home_skills_title: skillsTitle.trim(),
      home_steps_title: stepsTitle.trim(),
      home_cta_title: ctaTitle.trim(),
      footer_tagline: footerTagline.trim()
    });
  }
  return base;
}
'@
$FunctionRegex = [regex]::new($FunctionPattern)
if (!$FunctionRegex.IsMatch($Content)) {
    throw "Could not locate the existing edit/buildData functions. No files changed."
}
$Content = $FunctionRegex.Replace($Content, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $NewFunctions.Trim() }, 1)

# Reset structured values whenever New / Clear is clicked.
$ClearMarker = 'setSelected(null);setTitle("");setSlug("");setSummary("");setDescription("");setCategory("");setTools("");'
if (!$Content.Contains($ClearMarker)) {
    throw "Could not locate the Clear/New form reset marker. No files changed."
}
$Content = $Content.Replace($ClearMarker, $ClearMarker + 'setFields({});')

# Replace generic title label with section-specific wording.
$OldTitleLabel = '{type==="profile"||type==="skill"?"Name":"Title"}'
$NewTitleLabel = '{type==="profile"||type==="skill"||type==="certification"?"Name":type==="education"?"Degree / qualification":type==="experience"?"Job title":"Title"}'
if (!$Content.Contains($OldTitleLabel)) { throw "Could not find the title label. No files changed." }
$Content = $Content.Replace($OldTitleLabel, $NewTitleLabel)

# Give the common description field the right meaning for each content type.
$OldDescriptionLabel = '<label htmlFor="description">Long description / methodology</label>'
$NewDescriptionLabel = '<label htmlFor="description">{type==="experience"?"Responsibilities and achievements":type==="education"?"Additional education details":type==="project"?"Project overview / description":type==="certification"?"Certification notes":"Long description / methodology"}</label>'
if (!$Content.Contains($OldDescriptionLabel)) { throw "Could not find the description label. No files changed." }
$Content = $Content.Replace($OldDescriptionLabel, $NewDescriptionLabel)

$OldSummaryLabel = '{type==="profile"?"Professional introduction":"Summary / short description"}'
$NewSummaryLabel = '{type==="profile"?"Professional introduction":type==="project"?"Executive summary":"Summary / short description"}'
if (!$Content.Contains($OldSummaryLabel)) { throw "Could not find the summary label. No files changed." }
$Content = $Content.Replace($OldSummaryLabel, $NewSummaryLabel)

$OldCategoryBlock = '{type!=="profile"&&<div className="field"><label htmlFor="category">Category / specialisation</label>'
$NewCategoryBlock = '{(type==="project"||type==="education"||type==="skill"||type==="achievement"||type==="article"||type==="testimonial")&&<div className="field"><label htmlFor="category">{type==="education"?"Specialisation / field of study":type==="project"?"Project category":type==="skill"?"Skill category":"Category / specialisation"}</label>'
if (!$Content.Contains($OldCategoryBlock)) { throw "Could not find the category field block. No files changed." }
$Content = $Content.Replace($OldCategoryBlock, $NewCategoryBlock)

# Render each content type's configured fields after the common fields.
$UiMarker = '}{type==="site_settings"&&<>'
$StructuredUi = @'
}{(structuredFields[type] || []).map((field) => (
  <div className={`field${field.wide || field.kind === "textarea" ? " field-full" : ""}`} key={field.key}>
    <label htmlFor={`structured-${field.key}`}>{field.label}</label>
    {field.kind === "textarea" ? (
      <textarea
        id={`structured-${field.key}`}
        value={fields[field.key] || ""}
        onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
        rows={3}
      />
    ) : (
      <input
        id={`structured-${field.key}`}
        type={field.kind === "url" ? "url" : "text"}
        value={fields[field.key] || ""}
        onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
        placeholder={field.placeholder}
        maxLength={field.kind === "url" ? 2048 : 500}
      />
    )}
  </div>
))}{type==="site_settings"&&<>
'@
if (!$Content.Contains($UiMarker)) { throw "Could not find the structured-field render insertion point. No files changed." }
$Content = $Content.Replace($UiMarker, $StructuredUi)

# Make the Experience page display location and correct its garbled punctuation.
$OldExperienceInfo = '<p>{s(x.data.organisation,s(x.data.company,"Organisation to be added"))} · {s(x.data.type,"Experience")}</p>'
$NewExperienceInfo = '<p>{s(x.data.organisation,s(x.data.company,"Organisation to be added"))}{s(x.data.type) ? ` · ${s(x.data.type)}` : ""}{s(x.data.location) ? ` · ${s(x.data.location)}` : ""}</p>'
if (!$Experience.Contains($OldExperienceInfo)) { throw "Could not locate the Experience company/type row. No files changed." }
$Experience = $Experience.Replace($OldExperienceInfo, $NewExperienceInfo)

$OldExperienceIntro = 'Employment, internships, projects, and other relevant professional experiences”clearly distinguished and factually supported.'
$NewExperienceIntro = 'Employment, internships, and other relevant professional experiences, clearly distinguished and factually supported.'
if ($Experience.Contains($OldExperienceIntro)) {
    $Experience = $Experience.Replace($OldExperienceIntro, $NewExperienceIntro)
}
$OldExperienceDate = '<span className="date-label">{s(x.data.start_date)}{s(x.data.end_date)?` “ ${s(x.data.end_date)}`:""}</span>'
$NewExperienceDate = '<span className="date-label">{s(x.data.start_date)}{s(x.data.end_date) ? ` - ${s(x.data.end_date)}` : ""}</span>'
if (!$Experience.Contains($OldExperienceDate)) { throw "Could not locate the Experience date label. No files changed." }
$Experience = $Experience.Replace($OldExperienceDate, $NewExperienceDate)

# Correct the same date separator on the Education page.
$OldEducationDate = '<span className="date-label">{s(x.data.start_date)}{s(x.data.end_date)?` “ ${s(x.data.end_date)}`:""}</span>'
$NewEducationDate = '<span className="date-label">{s(x.data.start_date)}{s(x.data.end_date) ? ` - ${s(x.data.end_date)}` : ""}</span>'
if (!$Education.Contains($OldEducationDate)) { throw "Could not locate the Education date label. No files changed." }
$Education = $Education.Replace($OldEducationDate, $NewEducationDate)
$OldEducationDescription = '<p>{s(x.data.description)}</p></div><span className="date-label">'
$NewEducationDescription = '<p>{s(x.data.description)}</p>{s(x.data.grade) && <p>Grade / GPA: {s(x.data.grade)}</p>}</div><span className="date-label">'
if (!$Education.Contains($OldEducationDescription)) { throw "Could not locate the Education description block. No files changed." }
$Education = $Education.Replace($OldEducationDescription, $NewEducationDescription)

# All source matches have been verified. Back up before writing any file.
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$FilesToWrite = @(
    @{ Path = $ContentFile; Text = $Content },
    @{ Path = $ExperienceFile; Text = $Experience },
    @{ Path = $EducationFile; Text = $Education }
)
$Backups = @{}
foreach ($Entry in $FilesToWrite) {
    $Backup = "$($Entry.Path).backup-structured-forms-$Stamp"
    Copy-Item -LiteralPath $Entry.Path -Destination $Backup
    $Backups[$Entry.Path] = $Backup
}

try {
    foreach ($Entry in $FilesToWrite) {
        Set-Content -LiteralPath $Entry.Path -Value $Entry.Text -Encoding utf8
        Write-Host "Updated: $($Entry.Path)" -ForegroundColor Green
    }

    Write-Host "`nRunning TypeScript validation..." -ForegroundColor Cyan
    npm.cmd run typecheck
    if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed." }

    Write-Host "`nRunning lint..." -ForegroundColor Cyan
    npm.cmd run lint
    if ($LASTEXITCODE -ne 0) { throw "Lint validation failed." }

    Write-Host "`nRunning production build..." -ForegroundColor Cyan
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Production build failed." }
}
catch {
    Write-Warning "Validation failed. Restoring the three original files from their backups."
    foreach ($Entry in $FilesToWrite) {
        Copy-Item -LiteralPath $Backups[$Entry.Path] -Destination $Entry.Path -Force
    }
    throw
}

Write-Host "`nStructured content forms installed; all checks passed." -ForegroundColor Green
Write-Host "Backups created:" -ForegroundColor Cyan
$Backups.GetEnumerator() | ForEach-Object { Write-Host ("  {0} -> {1}" -f $_.Key, $_.Value) }
