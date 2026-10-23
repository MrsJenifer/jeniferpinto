import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ChartNoAxesCombined } from "lucide-react";
import { SiteHeader } from "@/components/portfolio/SiteHeader";
import { SiteFooter } from "@/components/portfolio/SiteFooter";
import { Finance404Game } from "@/components/portfolio/Finance404Game";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="not-found-main">
        <section className="container not-found-layout" aria-labelledby="not-found-title">
          <div className="not-found-copy">
            <div className="eyebrow"><ChartNoAxesCombined size={14} aria-hidden="true" /> ERROR 404 · OUT OF BALANCE</div>
            <p className="not-found-number" aria-hidden="true">404</p>
            <h1 id="not-found-title">This page didn’t make the balance sheet.</h1>
            <p className="not-found-description">The page may have moved, or the link might be off by a decimal place. Let’s get you back on track.</p>
            <div className="not-found-actions">
              <Link className="btn btn-primary" href="/"><ArrowLeft size={15} aria-hidden="true" /> Back to home</Link>
              <Link className="btn btn-outline" href="/projects">Explore finance projects <ArrowUpRight size={15} aria-hidden="true" /></Link>
            </div>
          </div>
          <Finance404Game />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}