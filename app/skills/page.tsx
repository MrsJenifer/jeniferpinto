import type { Metadata } from "next";
import Image from "next/image";
import { getPublicContent } from "@/lib/public-content";
import { SiteHeader } from "@/components/portfolio/SiteHeader";
import { SiteFooter } from "@/components/portfolio/SiteFooter";
import { safeExternalUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";
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
        {evidenceUrl && <a className="text-link" href={evidenceUrl} target="_blank" rel="noopener noreferrer">View evidence</a>}
        {videoUrl && <video controls preload="metadata" src={videoUrl} aria-label={`${s(item.data.name, "Skill")} demonstration video`} style={{ width: "100%", maxHeight: 240, borderRadius: 10, background: "#111", marginTop: 12 }} />}
      </article>;
    })}</div></div></section>
  </main><SiteFooter/></>;
}
