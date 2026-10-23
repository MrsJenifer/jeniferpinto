import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Award } from "lucide-react";
import { getPublicContent } from "@/lib/public-content";
import { SiteHeader } from "@/components/portfolio/SiteHeader";
import { SiteFooter } from "@/components/portfolio/SiteFooter";
import { safeExternalUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Achievements & Recognition",
  description: "Academic milestones, professional recognition, and selected finance project outcomes from Jenifer Pinto.",
};

function s(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }

export default async function AchievementsPage() {
  const achievements = await getPublicContent("achievement");

  return <>
    <SiteHeader />
    <main>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow">Milestones & recognition</div>
          <h1 className="page-title">Achievements</h1>
          <p>Academic milestones, professional recognition, and selected outcomes from applied finance and analytics work.</p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          {achievements.length ? <div className="content-list">
            {achievements.map((item) => {
              const data = item.data;
              const title = s(data.title, s(data.name, "Achievement"));
              const imageUrl = safeExternalUrl(data.image_url);
              const videoUrl = safeExternalUrl(data.video_url);
              const evidenceUrl = safeExternalUrl(data.evidence_url) || safeExternalUrl(data.verification_url);
              const organisation = s(data.organisation, s(data.issuer, s(data.institution)));
              const date = s(data.achievement_date, s(data.date, s(data.issue_date, s(data.issued_date))));
              const category = s(data.category, s(data.type));

              return <article className="content-row achievement-card" key={item.id}>
                {imageUrl ? <Image unoptimized src={imageUrl} alt={`${title} image`} width={160} height={120} style={{ width: 108, height: 88, objectFit: "contain", borderRadius: 10, flexShrink: 0 }} /> : <div className="achievement-mark" aria-hidden="true"><Award size={25} /></div>}
                <div className="achievement-main">
                  {category && <div className="project-category">{category}</div>}
                  <h3>{title}</h3>
                  {organisation && <p className="achievement-issuer">{organisation}</p>}
                  {s(data.description) && <p>{s(data.description)}</p>}
                  {videoUrl && <video controls preload="metadata" src={videoUrl} aria-label={`${title} video`} style={{ display: "block", width: "100%", maxWidth: 560, maxHeight: 320, borderRadius: 10, background: "#111", marginTop: 12 }} />}
                  {evidenceUrl && <a className="text-link" href={evidenceUrl} target="_blank" rel="noopener noreferrer">View evidence <ArrowUpRight size={14} /></a>}
                </div>
                {date && <span className="date-label">{date}</span>}
              </article>;
            })}
          </div> : <div className="empty-state">No achievements have been published yet. Add verified milestones from the admin dashboard.</div>}
          <div className="editorial-next-links">
            <Link className="text-link" href="/education">View education & certifications <ArrowUpRight size={14} /></Link>
            <Link className="text-link" href="/projects">Explore finance projects <ArrowUpRight size={14} /></Link>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
