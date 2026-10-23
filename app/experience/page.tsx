import type { Metadata } from "next";
import Image from "next/image";
import { getPublicContent } from "@/lib/public-content";
import { SiteHeader } from "@/components/portfolio/SiteHeader";
import { SiteFooter } from "@/components/portfolio/SiteFooter";
import { safeExternalUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";
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
        <span className="date-label">{s(data.start_date)}{s(data.end_date) ? ` – ${s(data.end_date)}` : data.current_role === true ? " – Present" : ""}</span>
      </article>;
    })}</div> : <div className="empty-state">No experience records have been published yet. Add verified experience through the admin dashboard.</div>}</div></section>
  </main><SiteFooter/></>;
}
