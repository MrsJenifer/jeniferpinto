import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getPublicContentBySlug } from "@/lib/public-content";
import { SiteHeader } from "@/components/portfolio/SiteHeader";
import { SiteFooter } from "@/components/portfolio/SiteFooter";
import { safeExternalUrl } from "@/lib/urls";

function s(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublicContentBySlug("article", slug);
  return {
    title: article ? s(article.data.title, "Finance article") : "Article not found",
    description: article ? s(article.data.summary, s(article.data.description, "Finance and business insight by Jenifer Pinto.")) : "Finance and business insight by Jenifer Pinto.",
  };
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getPublicContentBySlug("article", slug);
  if (!article) notFound();

  const data = article.data;
  const title = s(data.title, s(data.name, "Finance article"));
  const imageUrl = safeExternalUrl(data.image_url);
  const videoUrl = safeExternalUrl(data.video_url);
  const category = s(data.category, "Finance insight");
  const date = s(data.published_date, s(data.publish_date, s(data.date)));
  const body = s(data.article_body, s(data.body, s(data.content, s(data.description, "The author has not added the full article text yet."))));
  const paragraphs = body.split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean);

  return <>
    <SiteHeader />
    <main>
      <section className="page-hero article-detail-hero">
        <div className="container">
          <Link className="text-link article-back-link" href="/articles"><ArrowLeft size={14} /> All articles</Link>
          <div className="eyebrow article-detail-kicker">{category}{date ? ` · ${date}` : ""}</div>
          <h1 className="page-title">{title}</h1>
          {s(data.summary) && <p>{s(data.summary)}</p>}
        </div>
      </section>
      <section className="section">
        <div className="container article-detail-layout">
          <article className="article-content">
            {imageUrl && <Image unoptimized src={imageUrl} alt={title} width={1400} height={800} style={{ display: "block", width: "100%", maxHeight: 520, objectFit: "cover", borderRadius: 14, marginBottom: 30 }} />}
            {videoUrl && <video controls preload="metadata" src={videoUrl} aria-label={`${title} video`} style={{ display: "block", width: "100%", maxHeight: 520, borderRadius: 12, background: "#111", marginBottom: 28 }} />}
            {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            {s(data.source_note) && <p className="article-source-note">Source note: {s(data.source_note)}</p>}
            {safeExternalUrl(data.external_url) && <p><a className="text-link" href={safeExternalUrl(data.external_url)!} target="_blank" rel="noopener noreferrer">Read the related source <ArrowUpRight size={14} /></a></p>}
            <div className="article-bottom-nav"><Link className="text-link" href="/articles"><ArrowLeft size={14} /> Back to articles</Link></div>
          </article>
          <aside className="detail-aside article-aside"><div className="eyebrow">More to explore</div><h2>Continue learning.</h2><p>Browse applied finance case studies and the skills used to investigate financial and business questions.</p><Link className="btn btn-outline" href="/projects">Explore projects <ArrowUpRight size={14} /></Link><Link className="btn btn-outline" href="/skills" style={{ marginTop: 8 }}>View skills <ArrowUpRight size={14} /></Link></aside>
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
