import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPublicContent } from "@/lib/public-content";
import { SiteHeader } from "@/components/portfolio/SiteHeader";
import { SiteFooter } from "@/components/portfolio/SiteFooter";
import { safeExternalUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "About",
  description: "Background, education, and professional competencies.",
};

function s(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export default async function AboutPage() {
  const [profiles, education, skills] = await Promise.all([
    getPublicContent("profile", { limit: 1 }),
    getPublicContent("education"),
    getPublicContent("skill", { limit: 6 }),
  ]);

  const profile = profiles[0]?.data ?? {};
  const name = s(profile.name, "Jenifer Pinto");
  const headline = s(profile.headline);
  const intro = s(profile.intro);
  const supportingIntro = s(profile.about_intro_secondary) || s(profile.description);
  const focus = s(profile.career_goal) || headline;
  const focusDescription = s(profile.professional_focus_description);
  const aboutHeading = s(profile.about_heading) || headline || name;
  const profileImage = safeExternalUrl(profile.profile_image_url);
  const introVideo = safeExternalUrl(profile.video_url);
  const approachLabel = s(profile.approach_label);
  const approachValue = s(profile.approach_value);
  const outputLabel = s(profile.output_label);
  const outputValue = s(profile.output_value);
  const highlights = [
    { label: approachLabel, value: approachValue },
    { label: outputLabel, value: outputValue },
  ].filter((item) => item.label.trim() && item.value.trim());

  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero">
          <div className="container">
            <div className="eyebrow">{s(profile.about_eyebrow, "About")}</div>
            <h1 className="page-title">About {name}</h1>
            {headline && <p>{headline}</p>}
          </div>
        </section>

        <section className="section">
          <div className="container about-grid">
            <aside className="about-panel">
              {profileImage && (
                <Image
                  unoptimized
                  src={profileImage}
                  alt={name}
                  width={600}
                  height={720}
                  style={{ width: "100%", maxWidth: 300, maxHeight: 340, objectFit: "cover", borderRadius: 12, marginBottom: 18 }}
                />
              )}
              {introVideo && (
                <video controls preload="metadata" src={introVideo} aria-label={`${name} introduction video`} style={{ width: "100%", maxWidth: 480, marginBottom: 18, borderRadius: 10, background: "#111" }} />
              )}
              {focus && <>
                <div className="eyebrow" style={{ color: "#d8bd82" }}>{s(profile.professional_focus_eyebrow, "Professional focus")}</div>
                <h3>{focus}</h3>
              </>}
              {focusDescription && <p>{focusDescription}</p>}
              {highlights.length > 0 && (
                <div className="about-list">
                  {highlights.map((item) => (
                    <div className="about-item" key={item.label}>
                      <strong>{item.label}</strong>
                      <span>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </aside>

            <div className="about-text">
              <div className="eyebrow">Background</div>
              <h2>{aboutHeading}</h2>
              {intro && <p>{intro}</p>}
              {supportingIntro && supportingIntro !== intro && <p>{supportingIntro}</p>}
              <Link className="btn btn-outline" href="/contact">
                Connect with {name} <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>

        <section className="section section-muted">
          <div className="container">
            <div className="section-heading">
              <div>
                <div className="eyebrow">{s(profile.education_section_eyebrow) || "Education"}</div>
                <h2>{s(profile.education_section_heading) || "Academic background"}</h2>
              </div>
            </div>
            {education.length > 0 ? (
              <div className="content-list">
                {education.map((item) => {
                  const data = item.data;
                  const logo = safeExternalUrl(data.institution_logo_url) || safeExternalUrl(data.image_url);
                  const video = safeExternalUrl(data.video_url);
                  const degree = s(data.degree, s(data.title, "Education record"));
                  const institution = s(data.institution);
                  const specialisation = s(data.specialisation);
                  const start = s(data.start_date);
                  const end = s(data.end_date);
                  return (
                    <article className="content-row" key={item.id} style={{ alignItems: "flex-start" }}>
                      {logo && <Image unoptimized src={logo} alt={institution || degree} width={112} height={112} style={{ width: 72, height: 72, objectFit: "contain", borderRadius: 9, flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3>{degree}</h3>
                        {institution && <p>{institution}{specialisation ? " - " + specialisation : ""}</p>}
                        {s(data.description) && <p>{s(data.description)}</p>}
                        {s(data.grade) && <p>Grade / result: {s(data.grade)}</p>}
                        {video && <video controls preload="metadata" src={video} aria-label={`${degree} education video`} style={{ width: "100%", maxWidth: 560, maxHeight: 320, borderRadius: 10, background: "#111", marginTop: 12 }} />}
                      </div>
                      {(start || end) && <span className="date-label">{start}{start && end ? " - " : ""}{end}</span>}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">No education records are published yet.</div>
            )}
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-heading">
              <div>
                <div className="eyebrow">{s(profile.skills_section_eyebrow) || "Competencies"}</div>
                <h2>{s(profile.skills_section_heading) || "Skills and capabilities"}</h2>
              </div>
              {s(profile.about_skills_intro) && <p>{s(profile.about_skills_intro)}</p>}
            </div>
            {skills.length > 0 ? (
              <div className="skills-grid">
                {skills.map((item, index) => {
                  const data = item.data;
                  const image = safeExternalUrl(data.image_url);
                  const video = safeExternalUrl(data.video_url);
                  return (
                    <article className="skill-card" key={item.id}>
                      {image && <Image unoptimized src={image} alt={s(data.name, "Skill image")} width={640} height={420} style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, marginBottom: 14 }} />}
                      <div className="skill-number">{String(index + 1).padStart(2, "0")}</div>
                      <h3>{s(data.name, "Skill")}</h3>
                      {s(data.description) && <p>{s(data.description)}</p>}
                      {video && <video controls preload="metadata" src={video} aria-label={`${s(data.name, "Skill")} demonstration video`} style={{ width: "100%", maxHeight: 240, borderRadius: 10, background: "#111", marginTop: 12 }} />}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">No skills are published yet.</div>
            )}
            <div style={{ marginTop: 24 }}>
              <Link className="text-link" href="/skills">View all skills <ArrowRight size={15} /></Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
