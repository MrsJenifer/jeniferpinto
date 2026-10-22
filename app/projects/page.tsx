import type { Metadata } from "next";import { SiteHeader } from "@/components/portfolio/SiteHeader";import { SiteFooter } from "@/components/portfolio/SiteFooter";import { ProjectCard } from "@/components/portfolio/ProjectCard";import { getPublicContent } from "@/lib/public-content";
export const metadata:Metadata={title:"Finance Projects",description:"Financial modelling, analysis, forecasting, and dashboard case studies."};
export default async function ProjectsPage(){const projects=await getPublicContent("project");return <><SiteHeader/><main><section className="page-hero"><div className="container"><div className="eyebrow">Applied finance</div><h1 className="page-title">Finance project library</h1><p>Explore structured case studies with a clear question, documented assumptions, an analytical approach, findings, and limitations.</p></div></section><section className="section"><div className="container">{projects.length?<div className="project-grid">{projects.map(x=><ProjectCard key={x.id} item={x}/>)}</div>:<div className="empty-state">No published projects yet. Publish a project from the admin dashboard.</div>}</div></section></main><SiteFooter/></>}



