import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ContentItem } from "@/lib/types";
import { safeExternalUrl } from "@/lib/urls";

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function items(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

export function ProjectCard({ item }: { item: ContentItem }) {
  const data = item.data;
  const tags = items(data.tools).slice(0, 3);
  const cover = safeExternalUrl(data.cover_image_url) || safeExternalUrl(data.image_url);
  const title = text(data.title, item.slug.replaceAll("-", " "));
  return <article className="project-card">
    <div className="project-cover">
      {cover ? <Image unoptimized src={cover} alt={text(data.image_alt, `${title} cover image`)} width={900} height={560} style={{ width: "100%", height: "100%", minHeight: 180, objectFit: "cover", display: "block" }} /> : <><span className="cover-kicker">Finance case study</span><div className="cover-window" aria-hidden="true">{[1, 2, 3, 4, 5].map(number => <span key={number} className="cover-bar" />)}</div></>}
    </div>
    <div className="project-body"><div className="project-category">{text(data.category, "Finance project")}</div><h3>{title}</h3><p>{text(data.summary, text(data.description, "A practical finance and analytics case study."))}</p><div className="tag-list">{tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div><Link className="text-link" href={`/projects/${item.slug}`}>View case study <ArrowUpRight size={14}/></Link></div>
  </article>;
}
