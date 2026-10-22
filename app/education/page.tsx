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
          <div style={{ flex: 1, minWidth: 0 }}><h3>{s(data.name, s(data.title, "Certification"))}</h3><p>{s(data.issuer, "Issuing organisation to be added")}</p>{verifyUrl && <a className="text-link" href={verifyUrl} target="_blank" rel="noopener noreferrer">Verify credential â†—</a>}{videoUrl && <video controls preload="metadata" src={videoUrl} aria-label="Certification or learning video" style={{ display: "block", width: "100%", maxWidth: 560, maxHeight: 320, borderRadius: 10, background: "#111", marginTop: 12 }} />}</div>
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
