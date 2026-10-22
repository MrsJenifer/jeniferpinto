"use client";
import { adminFetch } from "@/lib/admin-fetch";import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";import { useSearchParams } from "next/navigation";import { contentTypes } from "@/lib/validation";import type { ContentItem, ContentType } from "@/lib/types";import { VersionHistory } from "./VersionHistory";import { Save, Plus, Trash2, Pencil, RefreshCw, Eye, EyeOff } from "lucide-react";
const labels:Record<ContentType,string>={profile:"Profile",project:"Finance project",skill:"Skill",experience:"Experience",education:"Education",certification:"Certification",achievement:"Achievement",article:"Article",testimonial:"Testimonial",site_settings:"Site settings"};
function slugify(s:string){return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,120)}
function val(d:Record<string,unknown>,k:string){const v=d[k];return typeof v==="string"?v:""}
type StructuredField = {
  key: string;
  label: string;
  kind?: "text" | "url" | "textarea";
  placeholder?: string;
  wide?: boolean; media?: "image" | "video" | "document"; };

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

export function ContentManager(){const search=useSearchParams();const [type,setType]=useState<ContentType>((contentTypes.includes(search.get("type") as ContentType)?search.get("type"):"project") as ContentType);const [items,setItems]=useState<ContentItem[]>([]);const [selected,setSelected]=useState<ContentItem|null>(null);const [title,setTitle]=useState("");const [slug,setSlug]=useState("");const [summary,setSummary]=useState("");const [description,setDescription]=useState("");const [category,setCategory]=useState("");const [tools,setTools]=useState("");const [fields,setFields]=useState<Record<string,string>>({});const [published,setPublished]=useState(false);const [sortOrder,setSortOrder]=useState(0);const [featured,setFeatured]=useState(false);const [extra,setExtra]=useState("{}");const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");const [bad,setBad]=useState(false);const [query,setQuery]=useState("");const [jsonMode,setJsonMode]=useState(false);const [siteTitle,setSiteTitle]=useState("");const [siteDescription,setSiteDescription]=useState("");const [heroTitle,setHeroTitle]=useState("");const [selectedTitle,setSelectedTitle]=useState("");const [selectedIntro,setSelectedIntro]=useState("");const [aboutTitle,setAboutTitle]=useState("");const [skillsTitle,setSkillsTitle]=useState("");const [stepsTitle,setStepsTitle]=useState("");const [ctaTitle,setCtaTitle]=useState("");const [footerTagline,setFooterTagline]=useState("");const [mediaAssets,setMediaAssets]=useState<MediaAssetOption[]>([]);const [mediaLoading,setMediaLoading]=useState(false);const [mediaError,setMediaError]=useState("");
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
  try {
    const res = await adminFetch(`/api/admin/content?type=${encodeURIComponent(t)}`, { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Could not load content.");
    setItems(body.items || []);
    setBad(false);
  } catch (error) {
    setBad(true);
    setNotice(error instanceof Error ? error.message : "Could not load content.");
  } finally {
    setLoading(false);
  }
}, [type]);
// Intentional async data-fetching effect; state updates occur after the network request.
// eslint-disable-next-line react-hooks/set-state-in-effect
useEffect(() => { void load(type); }, [load, type]); useEffect(() => { void loadMediaAssets(); }, [loadMediaAssets]);
function clear(){setSelected(null);setTitle("");setSlug("");setSummary("");setDescription("");setCategory("");setTools("");setFields({});setPublished(false);setSortOrder(items.length);setFeatured(false);setExtra("{}");setJsonMode(false);setSiteTitle("");setSiteDescription("");setHeroTitle("");setSelectedTitle("");setSelectedIntro("");setAboutTitle("");setSkillsTitle("");setStepsTitle("");setCtaTitle("");setFooterTagline("");setNotice("");setBad(false)}
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

  const typeFields = fieldsForType(i.content_type);
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
  for (const field of fieldsForType(type)) {
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
async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setNotice("");setBad(false);try{const data=buildData();const finalSlug=slugify(slug||title||type);if(!finalSlug)throw new Error("A slug is required.");const payload={...(selected?{id:selected.id}:{}),content_type:type,slug:finalSlug,data,is_published:published,sort_order:sortOrder};const r=await adminFetch("/api/admin/content",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const b=await r.json();if(!r.ok)throw new Error(b.error||"Could not save item.");setNotice("Content saved successfully.");setLoading(true);await load(type);if(b.item)edit(b.item); }catch(e){setBad(true);setNotice(e instanceof Error?e.message:"Could not save content.");}finally{setBusy(false)}}
async function remove(i:ContentItem){if(!confirm(`Delete “${val(i.data,"title")||val(i.data,"name")||i.slug}”? This cannot be undone.`))return;try{const r=await adminFetch(`/api/admin/content?id=${encodeURIComponent(i.id)}`,{method:"DELETE"});const b=await r.json();if(!r.ok)throw new Error(b.error||"Could not delete item.");if(selected?.id===i.id)clear();setNotice("Content deleted.");setLoading(true);await load(type);}catch(e){setBad(true);setNotice(e instanceof Error?e.message:"Could not delete item.")}}
async function togglePublish(i: ContentItem) {
  const nextPublished = !i.is_published;
  setBusy(true);
  setNotice("");
  setBad(false);

  try {
    const r = await adminFetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: i.id,
        content_type: i.content_type,
        slug: i.slug,
        data: i.data,
        is_published: nextPublished,
        sort_order: i.sort_order
      })
    });

    const b = await r.json();
    if (!r.ok) {
      throw new Error(
        b.error || (nextPublished
          ? "Could not publish content."
          : "Could not move content to draft.")
      );
    }

    setNotice(nextPublished
      ? "Content published successfully."
      : "Content moved to draft.");
    await load(type);
  } catch (e) {
    setBad(true);
    setNotice(
      e instanceof Error ? e.message : "Could not update publication status."
    );
  } finally {
    setBusy(false);
  }
}
const filtered=useMemo(()=>items.filter(i=>`${i.slug} ${JSON.stringify(i.data)}`.toLowerCase().includes(query.toLowerCase())),[items,query]);return <><h1>Content management</h1><p className="subtitle">Edit, publish, and maintain the content shown on the public website.</p>{notice&&<div className={`admin-alert${bad?" error":""}`} role="status">{notice}</div>}<section className="admin-panel"><div className="admin-panel-head"><h2>Content collection</h2><button className="btn btn-outline" onClick={()=>{setLoading(true);setNotice("");setBad(false);void load();}}><RefreshCw size={14}/> Refresh</button></div><div className="admin-toolbar"><select value={type} onChange={e=>{clear();setLoading(true);setType(e.target.value as ContentType)}} aria-label="Content type">{contentTypes.map(t=><option key={t} value={t}>{labels[t]}</option>)}</select><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search content…" aria-label="Search content"/><button className="btn btn-primary" onClick={clear}><Plus size={14}/> New {labels[type].toLowerCase()}</button></div><div className="admin-table-wrap" style={{marginTop:15}}>{loading?<p className="small-muted">Loading content…</p>:filtered.length?<table className="admin-table"><thead><tr><th>Content</th><th>Slug</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(i=><tr key={i.id}><td><strong>{val(i.data,"title")||val(i.data,"name")||val(i.data,"degree")||val(i.data,"headline")||i.slug}</strong><small>{val(i.data,"summary")||val(i.data,"description")||labels[i.content_type]}</small></td><td>{i.slug}</td><td><span className={`pill${i.is_published?"":" draft"}`}>{i.is_published?"Published":"Draft"}</span></td><td><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><button className="btn btn-outline" style={{padding:"6px 8px"}} onClick={()=>edit(i)} aria-label="Edit"><Pencil size={13}/></button><button className="btn btn-outline" style={{padding:"6px 8px"}} onClick={()=>void togglePublish(i)} disabled={busy} aria-label={i.is_published?"Unpublish":"Publish"} title={i.is_published?"Move to draft":"Publish publicly"}>{i.is_published?<><EyeOff size={13}/> Unpublish</>:<><Eye size={13}/> Publish</>}</button><button className="btn btn-outline" style={{padding:"6px 8px"}} onClick={()=>remove(i)} aria-label="Delete"><Trash2 size={13}/></button></div></td></tr>)}</tbody></table>:<div className="empty-state">No records found. Create a new item or adjust the search.</div>}</div></section><VersionHistory key={selected?.id ?? "new"} itemId={selected?.id??null} onRestored={(item)=>{edit(item);setNotice("Previous version restored.");setBad(false);void load(type);}}/><section className="admin-panel"><div className="admin-panel-head"><h2>{selected?"Edit content":"Create content"}</h2><button className="btn btn-outline" onClick={()=>setJsonMode(v=>!v)}>{jsonMode?"Structured editor":"Additional JSON fields"}</button></div><form onSubmit={save}><div className="form-grid"><div className="field"><label htmlFor="title">{type==="profile"||type==="skill"||type==="certification"?"Name":type==="education"?"Degree / qualification":type==="experience"?"Job title":"Title"}</label><input id="title" value={title} onChange={e=>{setTitle(e.target.value);if(!selected)setSlug(slugify(e.target.value));}} placeholder={type==="profile"?"Jenifer Pinto":"Content title"} required/></div><div className="field"><label htmlFor="slug">URL slug</label><input id="slug" value={slug} onChange={e=>setSlug(slugify(e.target.value))} required maxLength={120}/></div><div className="field"><label htmlFor="sort-order">Display order</label><input id="sort-order" type="number" min="0" max="100000" value={sortOrder} onChange={e=>setSortOrder(Math.max(0,Math.min(100000,Number(e.target.value)||0)))}/><span className="small-muted">Lower numbers appear first within the section.</span></div><div className="field field-full"><label htmlFor="summary">{type==="profile"?"Professional introduction":type==="project"?"Executive summary":"Summary / short description"}</label><textarea id="summary" value={summary} onChange={e=>setSummary(e.target.value)} rows={3}/></div><div className="field field-full"><label htmlFor="description">{type==="experience"?"Responsibilities and achievements":type==="education"?"Additional education details":type==="project"?"Project overview / description":type==="certification"?"Certification notes":"Long description / methodology"}</label><textarea id="description" value={description} onChange={e=>setDescription(e.target.value)} rows={4}/></div>{(type==="project"||type==="education"||type==="skill"||type==="achievement"||type==="article"||type==="testimonial")&&<div className="field"><label htmlFor="category">{type==="education"?"Specialisation / field of study":type==="project"?"Project category":type==="skill"?"Skill category":"Category / specialisation"}</label><input id="category" value={category} onChange={e=>setCategory(e.target.value)}/></div>}{type==="project"&&<div className="field"><label htmlFor="tools">Tools (comma-separated)</label><input id="tools" value={tools} onChange={e=>setTools(e.target.value)} placeholder="Excel, Power BI, Financial Modelling"/></div>}{fieldsForType(type).map((field) => (
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
      <><input
        id={`structured-${field.key}`}
        type={field.kind === "url" ? "url" : "text"}
        value={fields[field.key] || ""}
        onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
        placeholder={field.placeholder}
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
    </>)}
  </div>
))}{type==="site_settings"&&<><div className="field field-full"><label htmlFor="site-title">Browser / SEO title</label><input id="site-title" value={siteTitle} onChange={e=>setSiteTitle(e.target.value)} maxLength={160}/></div><div className="field field-full"><label htmlFor="site-description">SEO description</label><textarea id="site-description" value={siteDescription} onChange={e=>setSiteDescription(e.target.value)} rows={2} maxLength={320}/></div><div className="field field-full"><label htmlFor="hero-title">Homepage hero heading</label><input id="hero-title" value={heroTitle} onChange={e=>setHeroTitle(e.target.value)} maxLength={180}/></div><div className="field"><label htmlFor="selected-title">Featured projects heading</label><input id="selected-title" value={selectedTitle} onChange={e=>setSelectedTitle(e.target.value)}/></div><div className="field"><label htmlFor="about-title">About section heading</label><input id="about-title" value={aboutTitle} onChange={e=>setAboutTitle(e.target.value)}/></div><div className="field field-full"><label htmlFor="selected-intro">Featured projects introduction</label><textarea id="selected-intro" value={selectedIntro} onChange={e=>setSelectedIntro(e.target.value)} rows={2}/></div><div className="field"><label htmlFor="skills-title">Skills section heading</label><input id="skills-title" value={skillsTitle} onChange={e=>setSkillsTitle(e.target.value)}/></div><div className="field"><label htmlFor="steps-title">Process section heading</label><input id="steps-title" value={stepsTitle} onChange={e=>setStepsTitle(e.target.value)}/></div><div className="field"><label htmlFor="cta-title">Closing CTA heading</label><input id="cta-title" value={ctaTitle} onChange={e=>setCtaTitle(e.target.value)}/></div><div className="field"><label htmlFor="footer-tagline">Footer tagline</label><input id="footer-tagline" value={footerTagline} onChange={e=>setFooterTagline(e.target.value)}/></div></>}{jsonMode&&<div className="field field-full"><label htmlFor="extra">Additional data (JSON object)</label><textarea className="json-editor" id="extra" value={extra} onChange={e=>setExtra(e.target.value)} rows={10} spellCheck={false}/><span className="small-muted">Advanced fields retain links, experience dates, certification information, deliverables, and other section-specific data.</span></div>}</div><div style={{display:"flex",gap:18,flexWrap:"wrap",margin:"6px 0 20px"}}><label style={{fontSize:12,display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/><span>{published?<><Eye size={13} style={{display:"inline"}}/> Publish publicly</>:<><EyeOff size={13} style={{display:"inline"}}/> Keep as draft</>}</span></label>{type==="project"&&<label style={{fontSize:12,display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={featured} onChange={e=>setFeatured(e.target.checked)}/> Feature on homepage</label>}</div><div className="admin-toolbar"><button className="btn btn-primary" disabled={busy}><Save size={14}/>{busy?"Saving…":"Save content"}</button><button type="button" className="btn btn-outline" onClick={clear}>Clear form</button></div></form></section><p className="small-muted">Content actions are validated server-side. Publishing makes the record available to public pages; review personal information and document permissions before publishing.</p></>}





