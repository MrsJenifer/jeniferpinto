import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Newspaper } from "lucide-react";
import { getPublicContent } from "@/lib/public-content";
import { SiteHeader } from "@/components/portfolio/SiteHeader";
import { SiteFooter } from "@/components/portfolio/SiteFooter";
import { safeExternalUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Articles & Finance Insights",
  description: "Finance, financial analysis, banking, markets, and business insight articles by Jenifer Pinto.",
};

function s(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }

export default async function ArticlesPage() {
  const articles = await getPublicContent("article");

  return <>
    <SiteHeader />
    <main>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow">Notes, analysis & perspective</div>
          <h1 className="page-title">Articles & insights</h1>
          <p>Thoughtful writing on finance, financial analysis, banking, markets, and the business questions behind the numbers.</p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          {articles.length ? <div className="article-grid">
            {articles.map((item) => {
              const data = item.data;
              const title = s(data.title, s(data.name, "Finance article"));
              const imageUrl = safeExternalUrl(data.image_url);
              const category = s(data.category, "Finance insight");
              const date = s(data.published_date, s(data.publish_date, s(data.date)));
              const excerpt = s(data.summary, s(data.excerpt, s(data.description, "Open this article to read the full insight.")));
              return <article className="article-card" key={item.id}>
                {imageUrl ? <Link href={`/articles/${item.slug}`} className="article-cover"><Image unoptimized src={imageUrl} alt={title} width={900} height={520} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></Link> : <div className="article-cover article-cover-placeholder" aria-hidden="true"><Newspaper size={35} /></div>}
                <div className="article-body">
                  <div className="article-meta"><span className="project-category">{category}</span>{date && <span>{date}</span>}</div>
                  <h2><Link href={`/articles/${item.slug}`}>{title}</Link></h2>
                  <p>{excerpt}</p>
                  <Link className="text-link" href={`/articles/${item.slug}`}>Read article <ArrowRight size={14} /></Link>
                </div>
              </article>;
            })}
          </div> : <div className="articles-empty">
            <div className="articles-empty-icon"><Newspaper size={26} /></div>
            <h2>Finance insights are on the way.</h2>
            <p>Published articles added through the admin dashboard will appear here. Create an Article record with a title, summary, and article body or description, then publish it.</p>
            <Link className="btn btn-outline" href="/contact">Connect with Jenifer <ArrowUpRight size={14} /></Link>
          </div>}
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
