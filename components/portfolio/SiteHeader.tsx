import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getPublicContent } from "@/lib/public-content";
import { safeExternalUrl } from "@/lib/urls";

function str(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }

export async function SiteHeader() {
  const [profiles, settingsRows] = await Promise.all([
    getPublicContent("profile", { limit: 1 }),
    getPublicContent("site_settings", { limit: 1 }),
  ]);
  const profile = profiles[0]?.data || {};
  const settings = settingsRows[0]?.data || {};
  const name = str(profile.name, "Jenifer Pinto");
  const logoUrl = safeExternalUrl(settings.logo_url);

  return <header className="site-header"><div className="container header-inner">
    <Link href="/" className="brand" aria-label={`${name} portfolio home`}>
      {logoUrl ? <Image unoptimized src={logoUrl} width={36} height={36} alt={`${name} logo`} style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 8 }} /> : <span className="brand-mark">J</span>}
      <span>{name}</span>
    </Link>
    <nav className="nav-links" aria-label="Main navigation">
      <Link href="/about">About</Link><Link href="/projects">Projects</Link><Link href="/skills">Skills</Link><Link href="/experience">Experience</Link><Link href="/education">Education</Link>
    </nav>
    <div className="nav-actions"><Link className="btn btn-outline" href="/contact">Contact</Link><Link className="btn btn-primary" href="/projects">Explore work <ArrowUpRight size={14}/></Link></div>
  </div></header>;
}
