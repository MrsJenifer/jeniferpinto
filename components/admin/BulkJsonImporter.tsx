"use client";

import { useState } from "react";
import { Plus, Upload, Trash2 } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import type { ContentType } from "@/lib/types";

type Props = {
  contentType: ContentType;
  existingSlugs: string[];
  nextSortOrder: number;
  onImported: () => void | Promise<void>;
};

type JsonRecord = Record<string, unknown>;

const labels: Record<ContentType, string> = {
  profile: "Profile",
  project: "Finance project",
  skill: "Skill",
  experience: "Experience",
  education: "Education",
  certification: "Certification",
  achievement: "Achievement",
  article: "Article",
  testimonial: "Testimonial",
  site_settings: "Site settings",
};

function isPlainRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

function primaryKey(contentType: ContentType): string {
  if (contentType === "profile" || contentType === "skill" || contentType === "certification") return "name";
  if (contentType === "education") return "degree";
  return "title";
}

function exampleFor(contentType: ContentType): string {
  const primary = primaryKey(contentType);
  const common: JsonRecord = {
    [primary]: "Example " + labels[contentType] + " one",
    summary: "Replace this with a short summary.",
    description: "Replace this with the full description.",
  };
  if (contentType === "experience") Object.assign(common, { organisation: "Example organisation", start_date: "2025-01", end_date: "", current_role: true });
  if (contentType === "education") Object.assign(common, { institution: "Example institution", specialisation: "Finance", start_date: "2024", end_date: "2026", currently_studying: false });
  if (contentType === "certification") Object.assign(common, { issuer: "Example issuer", issue_date: "2026-01", certificate_file_url: "" });
  if (contentType === "project") Object.assign(common, { category: "Financial Analysis", tools: ["Excel", "Power BI"], featured: false, cover_image_url: "", video_url: "" });
  if (contentType === "skill") Object.assign(common, { category: "Finance & Analytics" });
  return JSON.stringify([
    { data: { ...common }, is_published: false, sort_order: 0 },
    { data: { ...common, [primary]: "Example " + labels[contentType] + " two" }, is_published: false, sort_order: 1 },
  ], null, 2);
}

export function BulkJsonImporter({ contentType, existingSlugs, nextSortOrder, onImported }: Props) {
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [report, setReport] = useState("");
  const [reportError, setReportError] = useState(false);

  async function importJson() {
    setBusy(true);
    setProgress("");
    setReport("");
    setReportError(false);

    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error("The JSON is invalid. Check the quotes, commas, and brackets.");
      }

      const records: unknown[] | null = Array.isArray(parsed)
        ? parsed
        : isPlainRecord(parsed) && Array.isArray(parsed.items) ? parsed.items : null;
      if (!records) throw new Error('Use a JSON array, or an object containing an "items" array.');
      if (records.length < 1) throw new Error("Add at least one record to import.");
      if (records.length > 100) throw new Error("Import a maximum of 100 records at a time.");

      const usedSlugs = new Set(existingSlugs);
      const issues: string[] = [];
      const createdSlugs: string[] = [];
      const primary = primaryKey(contentType);

      for (let index = 0; index < records.length; index++) {
        const row = records[index];
        const rowNumber = index + 1;
        setProgress("Saving record " + rowNumber + " of " + records.length + "…");

        if (!isPlainRecord(row)) {
          issues.push("Record " + rowNumber + ": expected a JSON object.");
          continue;
        }
        if (row.id) {
          issues.push("Record " + rowNumber + ": bulk import creates new records only; remove the id field.");
          continue;
        }
        if (row.content_type && row.content_type !== contentType) {
          issues.push("Record " + rowNumber + ": content_type must match the selected section (" + contentType + ").");
          continue;
        }

        const nested = isPlainRecord(row.data) ? row.data : {};
        const metadata = new Set(["id", "content_type", "slug", "data", "is_published", "published", "sort_order"]);
        const flatData = Object.fromEntries(Object.entries(row).filter(([key]) => !metadata.has(key)));
        const data: JsonRecord = { ...flatData, ...nested };
        const candidate = data[primary] ?? data.title ?? data.name ?? data.degree ?? data.headline;
        const title = typeof candidate === "string" ? candidate.trim() : "";
        const slugSeed = typeof row.slug === "string" && row.slug.trim() ? row.slug : title;
        let slug = slugify(slugSeed);
        if (!slug) {
          issues.push("Record " + rowNumber + ": provide a title/name/degree/headline or a slug.");
          continue;
        }

        const baseSlug = slug;
        let suffix = 2;
        while (usedSlugs.has(slug)) slug = baseSlug + "-" + suffix++;
        usedSlugs.add(slug);

        const isPublished = typeof row.is_published === "boolean"
          ? row.is_published
          : typeof row.published === "boolean" ? row.published : false;
        const sortOrder = typeof row.sort_order === "number" && Number.isInteger(row.sort_order) && row.sort_order >= 0
          ? row.sort_order : nextSortOrder + index;

        try {
          const response = await adminFetch("/api/admin/content", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content_type: contentType,
              slug,
              data,
              is_published: isPublished,
              sort_order: sortOrder,
            }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "Save failed.");
          createdSlugs.push(slug);
        } catch (error) {
          issues.push("Record " + rowNumber + " (" + slug + "): " + (error instanceof Error ? error.message : "Save failed."));
        }
      }

      if (createdSlugs.length) await onImported();
      if (issues.length) {
        setReportError(true);
        setReport("Created " + createdSlugs.length + " of " + records.length + " record(s).\n\nIssues:\n- " + issues.join("\n- "));
      } else {
        setReport("Successfully created " + createdSlugs.length + " record(s) in " + labels[contentType] + ".\nNew records are drafts unless is_published is set to true in each item.\n\nCreated slugs:\n- " + createdSlugs.join("\n- "));
        setJson("");
      }
    } catch (error) {
      setReportError(true);
      setReport(error instanceof Error ? error.message : "Bulk import failed.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <h2>Bulk JSON import</h2>
      <span className="small-muted">{labels[contentType]}</span>
    </div>
    <p className="small-muted">Add up to 100 records at once. Paste a JSON array or an object with an <code>items</code> array. Each record is saved through the existing authenticated Admin API. Existing records are never overwritten; failed rows are reported while successful rows remain saved.</p>
    <div className="field field-full">
      <label htmlFor="bulk-json-import">JSON records (maximum 100)</label>
      <textarea id="bulk-json-import" className="json-editor" value={json} onChange={(event) => setJson(event.target.value)} placeholder={exampleFor(contentType)} rows={12} spellCheck={false} />
    </div>
    {progress && <p className="small-muted" role="status">{progress}</p>}
    <div className="admin-toolbar" style={{ marginTop: 12 }}>
      <button type="button" className="btn btn-primary" disabled={busy || !json.trim()} onClick={() => void importJson()}><Upload size={14}/>{busy ? "Importing…" : "Import JSON"}</button>
      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setJson(exampleFor(contentType))}><Plus size={14}/>Load example</button>
      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => { setJson(""); setReport(""); setReportError(false); }}><Trash2 size={14}/>Clear</button>
    </div>
    {report && <pre className={"admin-alert" + (reportError ? " error" : "")} role="status" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginTop: 12 }}>{report}</pre>}
  </section>;
}
