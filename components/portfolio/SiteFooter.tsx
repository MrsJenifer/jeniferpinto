import Link from "next/link";
import { getPublicContent } from "@/lib/public-content";
function str(v:unknown,f=""){return typeof v==="string"?v:f}
export async function SiteFooter(){const [profiles,settingsRows]=await Promise.all([getPublicContent("profile",{limit:1}),getPublicContent("site_settings",{limit:1})]);const name=str(profiles[0]?.data.name,"Jenifer Pinto");const tagline=str(settingsRows[0]?.data.footer_tagline,"Finance · Analysis · Business Insight");return <footer className="footer"><div className="container footer-inner"><span>© {new Date().getFullYear()} {name}. All rights reserved.</span><div className="footer-links"><Link href="/privacy">Privacy</Link><Link href="/contact">Contact</Link><Link href="/admin/login">Admin</Link></div><span>{tagline}</span></div></footer>}

