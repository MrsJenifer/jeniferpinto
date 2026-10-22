import type { Metadata } from "next";
import Link from "next/link";import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileDown } from "lucide-react";
import { SiteHeader } from "@/components/portfolio/SiteHeader";
import { SiteFooter } from "@/components/portfolio/SiteFooter";
import { getPublicContentBySlug } from "@/lib/public-content";
import { safeExternalUrl } from "@/lib/urls";

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicContentBySlug("project", slug);
  return {
    title: item ? str(item.data.title, "Finance project") : "Project not found",
    description: item ? str(item.data.summary) : "Finance project case study.",
  };
}

export default async function ProjectDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getPublicContentBySlug("project", slug);
  if (!item) notFound();
  const data = item.data;
  const deliverables = arr(data.deliverables).map(record); const coverImage = safeExternalUrl(data.cover_image_url) || safeExternalUrl(data.image_url); const videoUrl = safeExternalUrl(data.video_url);

  return <>
    <SiteHeader />
    <main>
      <section className="page-hero">
        <div className="container">
          <Link className="text-link" href="/projects"><ArrowLeft size={14} /> Back to project library</Link>
          <div className="eyebrow" style={{ marginTop: 25 }}>{str(data.category, "Finance case study")} · {str(data.difficulty, "Project")}</div>
          <h1 className="page-title">{str(data.title, item.slug)}</h1>
          <p>{str(data.summary)}</p>
          <div className="tag-list" style={{ marginTop: 20 }}>
            {arr(data.tools).map((tool, index) => <span className="tag" key={`${String(tool)}-${index}`}>{String(tool)}</span>)}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container project-detail">
          <article className="detail-body">
            {coverImage && <Image unoptimized src={coverImage} alt={str(data.title, "Project cover image")} width={1400} height={850} style={{ width: "100%", maxHeight: 520, objectFit: "cover", borderRadius: 14, marginBottom: 24 }} />}
            {videoUrl && <video controls preload="metadata" src={videoUrl} aria-label="Project demonstration video" style={{ display: "block", width: "100%", maxHeight: 520, borderRadius: 12, background: "#111", marginBottom: 24 }} />}
            <p>{str(data.description)}</p>
            <h2>Business problem</h2><p>{str(data.problem, "Add the specific business question this project aims to address.")}</p>
            <h2>Methodology</h2><p>{str(data.methodology, "Document the dataset, validation steps, formulas, and assumptions used for the analysis.")}</p>
            <h2>Findings</h2><p>{str(data.findings, "Add findings supported by the source data and calculations.")}</p>
            <h2>Recommendations</h2><p>{str(data.recommendations, "Connect recommendations to the analysis and explain the limitations.")}</p>
            <h2>Limitations and disclosure</h2><p>{str(data.limitations, "Disclose whether the data is simulated, public, or authorised for use. State important limitations.")}</p>
            {deliverables.length > 0 && <>
              <h2>Deliverables</h2>
              <div className="content-list">
                {deliverables.map((deliverable, index) => {
                  const url = safeExternalUrl(deliverable.url);
                  return <div className="content-row" key={`${String(deliverable.title ?? "deliverable")}-${index}`}>
                    <div><h3>{str(deliverable.title, "Project file")}</h3><p>{str(deliverable.description, "Supporting project deliverable")}</p></div>
                    {url ? <a className="text-link" href={url} target="_blank" rel="noopener noreferrer"><FileDown size={14} /> Open file</a> : <span className="small-muted">No valid download link configured</span>}
                  </div>;
                })}
              </div>
            </>}
          </article>
          <aside className="detail-aside">
            <h3>Project overview</h3>
            <p><strong>Category</strong><br />{str(data.category, "Finance")}</p>
            <p><strong>Difficulty</strong><br />{str(data.difficulty, "Not specified")}</p>
            <p><strong>Tools</strong><br />{arr(data.tools).map(String).join(", ") || "Not specified"}</p>
            {safeExternalUrl(data.external_url) && <a className="btn btn-outline" href={safeExternalUrl(data.external_url)} target="_blank" rel="noopener noreferrer">Open project link <ExternalLink size={14} /></a>}
            <p style={{ marginTop: 22 }}>Educational case studies are not a substitute for professional financial advice.</p>
          </aside>
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}




