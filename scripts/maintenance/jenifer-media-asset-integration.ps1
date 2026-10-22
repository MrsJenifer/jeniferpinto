$ErrorActionPreference = "Stop"
Set-Location "C:\Projects\jenifer-finance-portfolio"

# This patch connects the existing media library + imported Google Drive assets
# to portfolio content and adds MP4/WebM support with server-side signature checks.
$script:PatchFiles = @{}
$script:OriginalFiles = @{}

function Replace-Required {
    param([string]$Path, [string]$Old, [string]$New, [string]$Description)
    $current = $script:PatchFiles[$Path]
    if ($null -eq $current -or !$current.Contains($Old)) {
        throw "Patch precondition failed for '$Path' ($Description). No files have been written."
    }
    $script:PatchFiles[$Path] = $current.Replace($Old, $New)
}

function Replace-RegexRequired {
    param([string]$Path, [string]$Pattern, [string]$Replacement, [string]$Description)
    $current = $script:PatchFiles[$Path]
    if ($null -eq $current -or ![regex]::IsMatch($current, $Pattern)) {
        throw "Patch precondition failed for '$Path' ($Description). No files have been written."
    }
    $token = "__PATCH_REPLACEMENT_" + [Guid]::NewGuid().ToString("N") + "__"
    $updated = [regex]::Replace($current, $Pattern, $token, 1)
    $script:PatchFiles[$Path] = $updated.Replace($token, $Replacement)
}

$TargetPaths = @(
    "components\admin\MediaManager.tsx",
    "components\admin\ContentManager.tsx",
    "components\admin\GoogleDriveManager.tsx",
    "app\api\admin\media\route.ts",
    "app\api\integrations\google\files\route.ts",
    "components\portfolio\SiteHeader.tsx",
    "components\portfolio\ProjectCard.tsx",
    "app\page.tsx",
    "app\about\page.tsx",
    "app\experience\page.tsx",
    "app\education\page.tsx",
    "app\skills\page.tsx",
    "app\projects\[slug]\page.tsx"
)

foreach ($relative in $TargetPaths) {
    if (!(Test-Path -LiteralPath $relative -PathType Leaf)) {
        throw "Required file not found: $relative. No files have been changed."
    }
    $script:OriginalFiles[$relative] = Get-Content -LiteralPath $relative -Raw -Encoding UTF8
    $script:PatchFiles[$relative] = $script:OriginalFiles[$relative]
}

# ---------------------------------------------------------------------------
# Media upload UI: image/video previews and 50 MB uploads.
# ---------------------------------------------------------------------------
$script:PatchFiles["components\admin\MediaManager.tsx"] = @'
"use client";

import { adminFetch } from "@/lib/admin-fetch";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Upload, FileText, Image as ImageIcon, RefreshCw, Copy, Trash2, Video } from "lucide-react";

type Asset = {
  id: string;
  original_name: string;
  storage_path: string;
  public_url: string | null;
  mime_type: string;
  size_bytes: number;
  alt_text: string | null;
  created_at: string;
};

function fmt(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export function MediaManager() {
  const [items, setItems] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await adminFetch("/api/admin/media", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load media.");
      setItems(body.items || []);
      setError(false);
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Unable to load media.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Async load populates the authenticated media library after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("alt_text", alt);
      const response = await adminFetch("/api/admin/media", {
        method: "POST",
        body: form,
      }, 120000);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Upload failed.");
      setMessage("File uploaded to the media library. Open Content Management to attach it to a portfolio entry.");
      setFile(null);
      setAlt("");
      const input = document.getElementById("media-file");
      if (input instanceof HTMLInputElement) input.value = "";
      await load();
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Asset) {
    if (!confirm(`Delete "${item.original_name}"? Assets referenced by content cannot be deleted.`)) return;
    setMessage("");
    setError(false);
    try {
      const response = await adminFetch(`/api/admin/media?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Delete failed.");
      setMessage(body.warning || "Asset deleted.");
      await load();
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("URL copied.");
      setError(false);
    } catch {
      setMessage("Could not copy the URL. Select and copy it manually.");
      setError(true);
    }
  }

  return <>
    <section className="admin-panel">
      <div className="admin-panel-head">
        <h2>Upload asset</h2>
        <button type="button" className="btn btn-outline" onClick={() => { setLoading(true); setMessage(""); setError(false); void load(); }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {message && <div className={`admin-alert${error ? " error" : ""}`} role="status">{message}</div>}
      <form onSubmit={upload}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="media-file">Image, video, or document</label>
            <input id="media-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf,.docx,.xlsx,.pptx" onChange={event => setFile(event.target.files?.[0] || null)} required />
            <span className="small-muted">Maximum 50 MB. Images, MP4/WebM videos, PDF, DOCX, XLSX, and PPTX are supported.</span>
          </div>
          <div className="field">
            <label htmlFor="alt-text">Alt text / accessible description</label>
            <input id="alt-text" value={alt} onChange={event => setAlt(event.target.value)} maxLength={250} placeholder="Describe the image; optional for videos and documents" />
          </div>
        </div>
        {file && <p className="small-muted" aria-live="polite">Selected: {file.name} ({fmt(file.size)})</p>}
        <button className="btn btn-primary" disabled={busy || !file}><Upload size={14} />{busy ? "Uploading…" : "Upload to media library"}</button>
      </form>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-head"><h2>Stored assets</h2><span className="small-muted">{items.length} file(s)</span></div>
      {loading ? <p className="small-muted">Loading media…</p> : items.length ? <div className="media-grid">
        {items.map(item => <article className="media-card" key={item.id}>
          <div className="media-preview">
            {item.public_url && item.mime_type.startsWith("image/") ?
              <Image unoptimized src={item.public_url} width={400} height={220} alt={item.alt_text || item.original_name} style={{ height: 125, width: "100%", objectFit: "cover" }} /> :
              item.public_url && item.mime_type.startsWith("video/") ?
                <video src={item.public_url} controls preload="metadata" aria-label={item.original_name} style={{ width: "100%", maxHeight: 160, background: "#111" }} /> :
                item.mime_type.startsWith("video/") ? <Video size={27} /> : <FileText size={27} />}
          </div>
          <strong>{item.original_name}</strong>
          <small>{item.mime_type} · {fmt(item.size_bytes)}</small>
          {item.public_url && <button type="button" className="btn btn-outline" style={{ width: "100%", marginTop: 10, padding: "7px 8px" }} onClick={() => void copy(item.public_url!)}><Copy size={13} /> Copy public URL</button>}
          <button type="button" className="btn btn-outline" style={{ width: "100%", marginTop: 7, padding: "7px 8px" }} onClick={() => void remove(item)}><Trash2 size={13} /> Delete asset</button>
        </article>)}
      </div> : <div className="empty-state"><ImageIcon size={23} /><p>No media yet. Upload an image, video, résumé, or project deliverable, or import one from Google Drive.</p></div>}
    </section>
    <p className="small-muted">Uploaded files and Google Drive imports use the public portfolio asset library. Publish only files you have permission to share; never upload confidential or private documents.</p>
  </>;
}
'@

# Add 50 MB MP4/WebM support and signature validation to direct uploads.
Replace-RegexRequired "app\api\admin\media\route.ts" 'const MAX_BYTES=10\*1024\*1024;' 'const MAX_BYTES=50*1024*1024;' 'increase media upload bound'
Replace-Required "app\api\admin\media\route.ts" '"image/gif","application/pdf"' '"image/gif","video/mp4","video/webm","application/pdf"' 'allow MP4/WebM media upload'
Replace-Required "app\api\admin\media\route.ts" 'if (mime === "image/gif") return starts(0x47, 0x49, 0x46, 0x38) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61;' 'if (mime === "image/gif") return starts(0x47, 0x49, 0x46, 0x38) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61; if (mime === "video/mp4") return bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70; if (mime === "video/webm") return starts(0x1a, 0x45, 0xdf, 0xa3);' 'validate MP4/WebM file signatures'
Replace-Required "app\api\admin\media\route.ts" 'between 1 byte and 10 MB' 'between 1 byte and 50 MB' 'update upload size message'
Replace-Required "app\api\admin\media\route.ts" 'Use JPEG, PNG, WebP, GIF, PDF, DOCX, XLSX, or PPTX.' 'Use JPEG, PNG, WebP, GIF, MP4, WebM, PDF, DOCX, XLSX, or PPTX.' 'update allowlist error'

# Google Drive imports use the same public asset library and now allow videos up to 50 MB.
Replace-Required "app\api\integrations\google\files\route.ts" 'const MAX_BYTES = 10 * 1024 * 1024;' 'const MAX_BYTES = 50 * 1024 * 1024;' 'increase Drive import bound'
Replace-Required "app\api\integrations\google\files\route.ts" '"image/gif", "application/pdf"' '"image/gif", "video/mp4", "video/webm", "application/pdf"' 'allow video file imports'
Replace-Required "app\api\integrations\google\files\route.ts" 'if (mime === "image/gif") return starts(0x47,0x49,0x46,0x38) && (bytes[4]===0x37 || bytes[4]===0x39) && bytes[5]===0x61;' 'if (mime === "image/gif") return starts(0x47,0x49,0x46,0x38) && (bytes[4]===0x37 || bytes[4]===0x39) && bytes[5]===0x61; if (mime === "video/mp4") return bytes.length >= 12 && bytes[4]===0x66 && bytes[5]===0x74 && bytes[6]===0x79 && bytes[7]===0x70; if (mime === "video/webm") return starts(0x1a,0x45,0xdf,0xa3);' 'validate imported video signatures'
Replace-Required "app\api\integrations\google\files\route.ts" '10 MB import limit' '50 MB import limit' 'update bounded import messages'

# Update Google Drive UI messaging and allow longer imports.
Replace-Required "components\admin\GoogleDriveManager.tsx" 'const r = await adminFetch("/api/integrations/google/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: file.id, alt_text: file.name }) });' 'const r = await adminFetch("/api/integrations/google/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: file.id, alt_text: file.name }) }, 120000);' 'increase Drive import request timeout'
Replace-Required "components\admin\GoogleDriveManager.tsx" 'Imports are limited to 10 MB and approved image/PDF/Office formats.' 'Imports are limited to 50 MB and approved image/video/PDF/Office formats (MP4 and WebM video).' 'update Drive UI size note'

# Enhance ContentManager with authenticated asset selection for profile, logo, projects and all content types.
Replace-Required "components\admin\ContentManager.tsx" 'import { adminFetch } from "@/lib/admin-fetch";' 'import { adminFetch } from "@/lib/admin-fetch";import Image from "next/image";' 'add image preview import'
Replace-RegexRequired "components\admin\ContentManager.tsx" '  wide\?: boolean;\r?\n};' '  wide?: boolean; media?: "image" | "video" | "document"; };' 'add media field metadata'
$MediaDefinitions = @'
const mediaFields: Partial<Record<ContentType, StructuredField[]>> = {
  profile: [
    { key: "profile_image_url", label: "Profile picture", kind: "url", media: "image", placeholder: "Choose uploaded media or paste a URL" },
    { key: "video_url", label: "Introduction video", kind: "url", media: "video" },
    { key: "resume_url", label: "Résumé / CV document", kind: "url", media: "document" }
  ],
  project: [
    { key: "cover_image_url", label: "Project cover image", kind: "url", media: "image" },
    { key: "video_url", label: "Project demo / walkthrough video", kind: "url", media: "video" }
  ],
  experience: [
    { key: "company_logo_url", label: "Company logo", kind: "url", media: "image" },
    { key: "image_url", label: "Experience image", kind: "url", media: "image" },
    { key: "video_url", label: "Experience video", kind: "url", media: "video" }
  ],
  education: [
    { key: "institution_logo_url", label: "Institution logo", kind: "url", media: "image" },
    { key: "image_url", label: "Education image", kind: "url", media: "image" },
    { key: "video_url", label: "Education video", kind: "url", media: "video" }
  ],
  skill: [
    { key: "image_url", label: "Skill / evidence image", kind: "url", media: "image" },
    { key: "video_url", label: "Skill demonstration video", kind: "url", media: "video" }
  ],
  certification: [
    { key: "certificate_image_url", label: "Certificate image", kind: "url", media: "image" },
    { key: "video_url", label: "Certificate / learning video", kind: "url", media: "video" }
  ],
  achievement: [
    { key: "image_url", label: "Achievement image", kind: "url", media: "image" },
    { key: "video_url", label: "Achievement video", kind: "url", media: "video" }
  ],
  article: [
    { key: "image_url", label: "Article cover image", kind: "url", media: "image" },
    { key: "video_url", label: "Article video", kind: "url", media: "video" }
  ],
  testimonial: [
    { key: "image_url", label: "Testimonial image", kind: "url", media: "image" },
    { key: "video_url", label: "Testimonial video", kind: "url", media: "video" }
  ],
  site_settings: [
    { key: "logo_url", label: "Portfolio logo", kind: "url", media: "image", placeholder: "Select your logo from the media library" }
  ]
};

function fieldsForType(contentType: ContentType): StructuredField[] {
  return [...(structuredFields[contentType] || []), ...(mediaFields[contentType] || [])];
}

type MediaAssetOption = {
  id: string;
  original_name: string;
  public_url: string | null;
  mime_type: string;
  alt_text: string | null;
};

export function ContentManager(){
'@
Replace-Required "components\admin\ContentManager.tsx" 'export function ContentManager(){' $MediaDefinitions 'add reusable media fields and asset type'
Replace-Required "components\admin\ContentManager.tsx" 'const [footerTagline,setFooterTagline]=useState("");' 'const [footerTagline,setFooterTagline]=useState("");const [mediaAssets,setMediaAssets]=useState<MediaAssetOption[]>([]);const [mediaLoading,setMediaLoading]=useState(false);const [mediaError,setMediaError]=useState("");' 'add media library state'
$LoadMediaFunction = @'
const loadMediaAssets = useCallback(async () => {
  setMediaLoading(true);
  try {
    const response = await adminFetch("/api/admin/media", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Could not load the media library.");
    setMediaAssets(body.items || []);
    setMediaError("");
  } catch (error) {
    setMediaError(error instanceof Error ? error.message : "Could not load the media library.");
  } finally {
    setMediaLoading(false);
  }
}, []);

const load = useCallback(async (t: ContentType = type) => {
'@
Replace-Required "components\admin\ContentManager.tsx" 'const load = useCallback(async (t: ContentType = type) => {' $LoadMediaFunction 'add media loader'
Replace-Required "components\admin\ContentManager.tsx" 'useEffect(() => { void load(type); }, [load, type]);' 'useEffect(() => { void load(type); }, [load, type]); useEffect(() => { void loadMediaAssets(); }, [loadMediaAssets]);' 'load media assets in the editor'
Replace-Required "components\admin\ContentManager.tsx" 'const typeFields = structuredFields[i.content_type] || [];' 'const typeFields = fieldsForType(i.content_type);' 'hydrate all structured and media fields'
Replace-Required "components\admin\ContentManager.tsx" 'for (const field of structuredFields[type] || []) {' 'for (const field of fieldsForType(type)) {' 'save all media field values'
Replace-Required "components\admin\ContentManager.tsx" '{(structuredFields[type] || []).map((field) => (' '{fieldsForType(type).map((field) => (' 'render all media field inputs'
$MediaPickerSnippet = @'
        maxLength={field.kind === "url" ? 2048 : 500}
      />
      {field.media && (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <select
            aria-label={`Choose ${field.label} from the media library`}
            value=""
            onChange={(event) => {
              const asset = mediaAssets.find((candidate) => candidate.public_url === event.target.value);
              if (asset?.public_url) setFields((current) => ({ ...current, [field.key]: asset.public_url || "" }));
            }}
          >
            <option value="">Choose uploaded {field.media}…</option>
            {mediaAssets.filter((asset) => {
              if (!asset.public_url) return false;
              if (field.media === "image") return asset.mime_type.startsWith("image/");
              if (field.media === "video") return asset.mime_type.startsWith("video/");
              return asset.mime_type === "application/pdf" || asset.mime_type.includes("openxmlformats-officedocument");
            }).map((asset) => <option key={asset.id} value={asset.public_url || ""}>{asset.original_name}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-outline" style={{ padding: "6px 8px" }} onClick={() => void loadMediaAssets()} disabled={mediaLoading}><RefreshCw size={12} />{mediaLoading ? "Refreshing…" : "Refresh media library"}</button>
            {mediaError && <span className="small-muted">{mediaError}</span>}
          </div>
          {fields[field.key] && field.media === "image" && <Image unoptimized src={fields[field.key] || ""} alt="Selected media preview" width={640} height={360} style={{ width: "100%", maxWidth: 320, maxHeight: 180, objectFit: "contain", borderRadius: 8 }} />}
          {fields[field.key] && field.media === "video" && <video controls preload="metadata" src={fields[field.key] || ""} style={{ width: "100%", maxWidth: 460, maxHeight: 260, background: "#111", borderRadius: 8 }} />}
          {fields[field.key] && field.media === "document" && <a className="text-link" href={fields[field.key] || "#"} target="_blank" rel="noopener noreferrer">Open selected document</a>}
          <span className="small-muted">Uploaded files and imported Google Drive assets appear here. You can also paste a public URL in the field above.</span>
        </div>
      )}
'@
Replace-RegexRequired "components\admin\ContentManager.tsx" 'maxLength=\{field\.kind === "url" \? 2048 : 500\}\r?\n\s*/>' $MediaPickerSnippet 'render media picker and preview'

# Public header reads the editable site logo, with a text fallback.
$script:PatchFiles["components\portfolio\SiteHeader.tsx"] = @'
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getPublicContent } from "@/lib/public-content";
import { safeExternalUrl } from "@/lib/urls";

function str(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }

export async function SiteHeader() {
  const [profiles, settingsRows] = await Promise.all([
    getPublicContent("profile", { limit: 1 }),
    getPublicContent("site_settings", { limit: 1 }),
  ]);
  const profile = profiles[0]?.data || {};
  const settings = settingsRows[0]?.data || {};
  const name = str(profile.name, "Jenifer Pinto");
  const logoUrl = safeExternalUrl(settings.logo_url);

  return <header className="site-header"><div className="container header-inner">
    <Link href="/" className="brand" aria-label={`${name} portfolio home`}>
      {logoUrl ? <Image unoptimized src={logoUrl} width={36} height={36} alt={`${name} logo`} style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 8 }} /> : <span className="brand-mark">J</span>}
      <span>{name}</span>
    </Link>
    <nav className="nav-links" aria-label="Main navigation">
      <Link href="/about">About</Link><Link href="/projects">Projects</Link><Link href="/skills">Skills</Link><Link href="/experience">Experience</Link><Link href="/education">Education</Link>
    </nav>
    <div className="nav-actions"><Link className="btn btn-outline" href="/contact">Contact</Link><Link className="btn btn-primary" href="/projects">Explore work <ArrowUpRight size={14}/></Link></div>
  </div></header>;
}
'@

# Project cards use the chosen cover image instead of the decorative placeholder.
$script:PatchFiles["components\portfolio\ProjectCard.tsx"] = @'
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ContentItem } from "@/lib/types";
import { safeExternalUrl } from "@/lib/urls";

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function items(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

export function ProjectCard({ item }: { item: ContentItem }) {
  const data = item.data;
  const tags = items(data.tools).slice(0, 3);
  const cover = safeExternalUrl(data.cover_image_url) || safeExternalUrl(data.image_url);
  const title = text(data.title, item.slug.replaceAll("-", " "));
  return <article className="project-card">
    <div className="project-cover">
      {cover ? <Image unoptimized src={cover} alt={text(data.image_alt, `${title} cover image`)} width={900} height={560} style={{ width: "100%", height: "100%", minHeight: 180, objectFit: "cover", display: "block" }} /> : <><span className="cover-kicker">Finance case study</span><div className="cover-window" aria-hidden="true">{[1, 2, 3, 4, 5].map(number => <span key={number} className="cover-bar" />)}</div></>}
    </div>
    <div className="project-body"><div className="project-category">{text(data.category, "Finance project")}</div><h3>{title}</h3><p>{text(data.summary, text(data.description, "A practical finance and analytics case study."))}</p><div className="tag-list">{tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div><Link className="text-link" href={`/projects/${item.slug}`}>View case study <ArrowUpRight size={14}/></Link></div>
  </article>;
}
'@

# Show optional profile introduction video on the homepage.
Replace-Required "app\page.tsx" ':<div className="portrait-placeholder" aria-label="Profile photo placeholder">JP</div>}<div className="photo-label">' ':<div className="portrait-placeholder" aria-label="Profile photo placeholder">JP</div>}{safeExternalUrl(p.video_url) && <video controls preload="metadata" src={safeExternalUrl(p.video_url)!} aria-label="Profile introduction video" style={{ width: "100%", marginTop: 12, borderRadius: 10, background: "#111" }} />}<div className="photo-label">' 'render selected profile video'

# About page: render optional profile image and video with the profile narrative.
Replace-Required "app\about\page.tsx" 'import type { Metadata } from "next";' 'import type { Metadata } from "next";import Image from "next/image";' 'add Image to about page'
Replace-Required "app\about\page.tsx" 'import { ArrowRight } from "lucide-react";' 'import { ArrowRight } from "lucide-react";import { safeExternalUrl } from "@/lib/urls";' 'add safe URL helper to about page'
Replace-Required "app\about\page.tsx" '<div className="about-panel"><div className="eyebrow" style={{color:"#d8bd82"}}>Professional focus</div>' '<div className="about-panel">{safeExternalUrl(p.profile_image_url) && <Image unoptimized src={safeExternalUrl(p.profile_image_url)!} alt={s(p.name,"Jenifer Pinto")} width={600} height={720} style={{width:"100%",maxWidth:300,maxHeight:340,objectFit:"cover",borderRadius:12,marginBottom:18}} />}{safeExternalUrl(p.video_url) && <video controls preload="metadata" src={safeExternalUrl(p.video_url)!} aria-label="Profile introduction video" style={{width:"100%",maxWidth:480,marginBottom:18,borderRadius:10,background:"#111"}} />}<div className="eyebrow" style={{color:"#d8bd82"}}>Professional focus</div>' 'display profile media on about page'

# Replace Experience page with a media-aware presentation while preserving the same public data keys.
$script:PatchFiles["app\experience\page.tsx"] = @'
import type { Metadata } from "next";
import Image from "next/image";
import { getPublicContent } from "@/lib/public-content";
import { SiteHeader } from "@/components/portfolio/SiteHeader";
import { SiteFooter } from "@/components/portfolio/SiteFooter";
import { safeExternalUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Experience" };
function s(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }

export default async function ExperiencePage() {
  const rows = await getPublicContent("experience");
  return <><SiteHeader/><main>
    <section className="page-hero"><div className="container"><div className="eyebrow">Professional journey</div><h1 className="page-title">Experience</h1><p>Employment, internships, and other relevant professional experiences, clearly distinguished and factually supported.</p></div></section>
    <section className="section"><div className="container">{rows.length ? <div className="content-list">{rows.map(item => {
      const data = item.data;
      const imageUrl = safeExternalUrl(data.company_logo_url) || safeExternalUrl(data.image_url);
      const videoUrl = safeExternalUrl(data.video_url);
      const title = s(data.title, "Role to be added");
      return <article className="content-row" key={item.id} style={{ alignItems: "flex-start" }}>
        {imageUrl && <Image unoptimized src={imageUrl} alt={s(data.organisation, s(data.company, `${title} image`))} width={112} height={112} style={{ width: 88, height: 88, objectFit: "contain", borderRadius: 10, flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}><h3>{title}</h3><p>{s(data.organisation, s(data.company, "Organisation to be added"))}{s(data.type) ? ` · ${s(data.type)}` : ""}{s(data.location) ? ` · ${s(data.location)}` : ""}</p><p>{s(data.description)}</p>{videoUrl && <video controls preload="metadata" src={videoUrl} aria-label={`${title} video`} style={{ width: "100%", maxWidth: 560, maxHeight: 320, borderRadius: 10, background: "#111", marginTop: 12 }} />}</div>
        <span className="date-label">{s(data.start_date)}{s(data.end_date) ? ` – ${s(data.end_date)}` : ""}</span>
      </article>;
    })}</div> : <div className="empty-state">No experience records have been published yet. Add verified experience through the admin dashboard.</div>}</div></section>
  </main><SiteFooter/></>;
}
'@

# Replace Education page with image/video rendering for education, credentials and achievements.
$script:PatchFiles["app\education\page.tsx"] = @'
import type { Metadata } from "next";
import Image from "next/image";
import { getPublicContent } from "@/lib/public-content";
import { SiteHeader } from "@/components/portfolio/SiteHeader";
import { SiteFooter } from "@/components/portfolio/SiteFooter";
import { safeExternalUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Education & Certifications" };
function s(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }

export default async function EducationPage() {
  const [education, certifications, achievements] = await Promise.all([
    getPublicContent("education"), getPublicContent("certification"), getPublicContent("achievement")
  ]);
  return <><SiteHeader/><main>
    <section className="page-hero"><div className="container"><div className="eyebrow">Learning & development</div><h1 className="page-title">Education & credentials</h1><p>Academic qualifications and credentials relevant to a finance career.</p></div></section>
    <section className="section"><div className="container"><div className="section-heading"><div><div className="eyebrow">Academic background</div><h2>Education</h2></div></div>
      {education.length ? <div className="content-list">{education.map(item => {
        const data = item.data;
        const imageUrl = safeExternalUrl(data.institution_logo_url) || safeExternalUrl(data.image_url);
        const videoUrl = safeExternalUrl(data.video_url);
        return <article className="content-row" key={item.id} style={{ alignItems: "flex-start" }}>
          {imageUrl && <Image unoptimized src={imageUrl} alt={s(data.institution, "Institution image")} width={112} height={112} style={{ width: 88, height: 88, objectFit: "contain", borderRadius: 10, flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}><h3>{s(data.degree, s(data.title, "Degree"))}</h3><p>{s(data.institution)} {s(data.specialisation) ? `· ${s(data.specialisation)}` : ""}</p><p>{s(data.description)}</p>{s(data.grade) && <p>Grade / GPA: {s(data.grade)}</p>}{videoUrl && <video controls preload="metadata" src={videoUrl} aria-label="Education video" style={{ width: "100%", maxWidth: 560, maxHeight: 320, borderRadius: 10, background: "#111", marginTop: 12 }} />}</div>
          <span className="date-label">{s(data.start_date)}{s(data.end_date) ? ` – ${s(data.end_date)}` : ""}</span>
        </article>;
      })}</div> : <div className="empty-state">Add verified education details in the admin dashboard.</div>}
    </div></section>
    <section className="section section-muted"><div className="container"><div className="section-heading"><div><div className="eyebrow">Professional learning</div><h2>Certifications</h2></div></div>
      {certifications.length ? <div className="content-list">{certifications.map(item => {
        const data = item.data;
        const imageUrl = safeExternalUrl(data.certificate_image_url) || safeExternalUrl(data.image_url);
        const videoUrl = safeExternalUrl(data.video_url);
        const verifyUrl = safeExternalUrl(data.verification_url);
        return <article className="content-row" key={item.id} style={{ alignItems: "flex-start" }}>
          {imageUrl && <Image unoptimized src={imageUrl} alt={s(data.name, s(data.title, "Certificate image"))} width={160} height={120} style={{ width: 112, height: 84, objectFit: "contain", borderRadius: 8, flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}><h3>{s(data.name, s(data.title, "Certification"))}</h3><p>{s(data.issuer, "Issuing organisation to be added")}</p>{verifyUrl && <a className="text-link" href={verifyUrl} target="_blank" rel="noopener noreferrer">Verify credential ↗</a>}{videoUrl && <video controls preload="metadata" src={videoUrl} aria-label="Certification or learning video" style={{ display: "block", width: "100%", maxWidth: 560, maxHeight: 320, borderRadius: 10, background: "#111", marginTop: 12 }} />}</div>
          <span className="date-label">{s(data.issue_date)}</span>
        </article>;
      })}</div> : <div className="empty-state">No certifications have been published yet.</div>}
    </div></section>
    {achievements.length > 0 && <section className="section"><div className="container"><div className="section-heading"><div><div className="eyebrow">Recognition</div><h2>Achievements</h2></div></div><div className="content-list">{achievements.map(item => {
      const imageUrl = safeExternalUrl(item.data.image_url);
      const videoUrl = safeExternalUrl(item.data.video_url);
      return <article className="content-row" key={item.id} style={{ alignItems: "flex-start" }}>
        {imageUrl && <Image unoptimized src={imageUrl} alt={s(item.data.title, "Achievement image")} width={112} height={112} style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}><h3>{s(item.data.title, "Achievement")}</h3><p>{s(item.data.description)}</p>{videoUrl && <video controls preload="metadata" src={videoUrl} aria-label="Achievement video" style={{ width: "100%", maxWidth: 560, maxHeight: 320, borderRadius: 10, background: "#111", marginTop: 12 }} />}</div>
      </article>;
    })}</div></div></section>}
  </main><SiteFooter/></>;
}
'@

# Replace Skills page with media-aware skill cards.
$script:PatchFiles["app\skills\page.tsx"] = @'
import type { Metadata } from "next";
import Image from "next/image";
import { getPublicContent } from "@/lib/public-content";
import { SiteHeader } from "@/components/portfolio/SiteHeader";
import { SiteFooter } from "@/components/portfolio/SiteFooter";
import { safeExternalUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Skills & Competencies" };
function s(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }

export default async function SkillsPage() {
  const skills = await getPublicContent("skill");
  return <><SiteHeader/><main>
    <section className="page-hero"><div className="container"><div className="eyebrow">Capabilities</div><h1 className="page-title">Skills & competencies</h1><p>Finance and analytics capabilities should be presented honestly and supported by work samples wherever possible.</p></div></section>
    <section className="section"><div className="container"><div className="skills-grid">{skills.map((item, index) => {
      const imageUrl = safeExternalUrl(item.data.image_url);
      const videoUrl = safeExternalUrl(item.data.video_url);
      const evidenceUrl = safeExternalUrl(item.data.evidence_url);
      return <article className="skill-card" key={item.id}>
        {imageUrl && <Image unoptimized src={imageUrl} alt={s(item.data.name, "Skill image")} width={640} height={420} style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, marginBottom: 14 }} />}
        <div className="skill-number">{String(index + 1).padStart(2, "0")}</div><h3>{s(item.data.name, "Finance skill")}</h3><p>{s(item.data.description)}</p>
        {evidenceUrl && <a className="text-link" href={evidenceUrl} target="_blank" rel="noopener noreferrer">View evidence ↗</a>}
        {videoUrl && <video controls preload="metadata" src={videoUrl} aria-label={`${s(item.data.name, "Skill")} demonstration video`} style={{ width: "100%", maxHeight: 240, borderRadius: 10, background: "#111", marginTop: 12 }} />}
      </article>;
    })}</div></div></section>
  </main><SiteFooter/></>;
}
'@

# Add project media to the project details page.
Replace-Required "app\projects\[slug]\page.tsx" 'import Link from "next/link";' 'import Link from "next/link";import Image from "next/image";' 'add project Image import'
Replace-Required "app\projects\[slug]\page.tsx" '  const deliverables = arr(data.deliverables).map(record);' '  const deliverables = arr(data.deliverables).map(record); const coverImage = safeExternalUrl(data.cover_image_url) || safeExternalUrl(data.image_url); const videoUrl = safeExternalUrl(data.video_url);' 'prepare project media URLs'
$ProjectDetailMedia = @'
          <article className="detail-body">
            {coverImage && <Image unoptimized src={coverImage} alt={str(data.title, "Project cover image")} width={1400} height={850} style={{ width: "100%", maxHeight: 520, objectFit: "cover", borderRadius: 14, marginBottom: 24 }} />}
            {videoUrl && <video controls preload="metadata" src={videoUrl} aria-label="Project demonstration video" style={{ display: "block", width: "100%", maxHeight: 520, borderRadius: 12, background: "#111", marginBottom: 24 }} />}
            <p>{str(data.description)}</p>
'@
Replace-RegexRequired "app\projects\[slug]\page.tsx" '          <article className="detail-body">\r?\n\s*<p>\{str\(data\.description\)\}</p>' $ProjectDetailMedia 'render project cover and video'

# Change the Drive import completion copy from corrupted punctuation to reliable ASCII.
$script:PatchFiles["components\admin\GoogleDriveManager.tsx"] = [regex]::Replace($script:PatchFiles["components\admin\GoogleDriveManager.tsx"], 'setNotice\(`Imported.*? into the media library\.`\);', [System.Text.RegularExpressions.MatchEvaluator]{ param($match) 'setNotice(`Imported "${b.item.original_name}" into the media library. Available in Content Management media pickers.`);' }, 1)

# ---------------------------------------------------------------------------
# The asset fields need to serialize even when records are edited repeatedly.
# mediaFields values are fed through fieldsForType in edit, buildData and JSX above.
# ---------------------------------------------------------------------------

# Ensure all transforms are valid before writing anything.
foreach ($relative in $TargetPaths) {
    if ([string]::IsNullOrWhiteSpace($script:PatchFiles[$relative])) {
        throw "Refusing to write empty file: $relative"
    }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path (Get-Location).Path "backups\media-asset-integration-$stamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
foreach ($relative in $TargetPaths) {
    $destination = Join-Path $backupRoot $relative
    $parent = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    Copy-Item -LiteralPath $relative -Destination $destination
}

try {
    foreach ($relative in $TargetPaths) {
        Set-Content -LiteralPath $relative -Value $script:PatchFiles[$relative] -Encoding utf8
    }
} catch {
    foreach ($relative in $TargetPaths) {
        $saved = Join-Path $backupRoot $relative
        if (Test-Path -LiteralPath $saved) { Copy-Item -LiteralPath $saved -Destination $relative -Force }
    }
    throw
}

Write-Host "`nMedia integration patch applied." -ForegroundColor Green
Write-Host "Backups: $backupRoot" -ForegroundColor Cyan
Write-Host "`nRunning TypeScript validation..." -ForegroundColor Cyan
npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw "TypeScript failed. Backup preserved at $backupRoot" }
Write-Host "`nRunning lint..." -ForegroundColor Cyan
npm.cmd run lint
if ($LASTEXITCODE -ne 0) { throw "Lint failed. Backup preserved at $backupRoot" }
Write-Host "`nRunning production build..." -ForegroundColor Cyan
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "Production build failed. Backup preserved at $backupRoot" }
Write-Host "`nAll validations passed. Next, test the Media Library, Google Drive import, content media pickers, and public pages in the browser." -ForegroundColor Green
