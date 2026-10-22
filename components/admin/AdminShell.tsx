"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ExternalLink, Menu } from "lucide-react";
import { LogoutButton } from "./LogoutButton";
import styles from "./AdminShell.module.css";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
];

export function AdminShell({ children, email, role }: { children: React.ReactNode; email: string; role: string }) {
  const pathname = usePathname();
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/admin" className={styles.brand} aria-label="Jenifer Finance admin home">
        <span className={styles.brandMark}>JP</span><span><strong>Jenifer Pinto</strong><small>PORTFOLIO STUDIO</small></span>
      </Link>
      <div className={styles.navCaption}>WORKSPACE</div>
      <nav className={styles.nav} aria-label="Admin navigation">
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(href + "/");
          return <a key={label} href={href} className={`${styles.navLink} ${active ? styles.active : ""}`} aria-current={active ? "page" : undefined}>
            <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{active && <span className={styles.activeDot} />}
          </a>;
        })}
      </nav>
      <div className={styles.sidebarBottom}>
        <div className={styles.secure}><span className={styles.secureDot} />Secure workspace <span className={styles.role}>{role}</span></div>
        <Link href="/" target="_blank" rel="noopener noreferrer" className={styles.viewSite}><ExternalLink size={15}/> View live website</Link>
        <div className={styles.sidebarLogout}><LogoutButton /></div>
      </div>
    </aside>
    <div className={styles.main}>
      <header className={styles.topbar}>
        <div className={styles.mobileBrand}><Menu size={17}/> <strong>Portfolio Studio</strong></div>
        <div className={styles.breadcrumb}><span>Workspace</span><span className={styles.crumbSlash}>/</span><strong>{pathname === "/admin" ? "Dashboard" : pathname.startsWith("/admin/content") ? "Content management" : pathname.startsWith("/admin/media") ? "Media & Drive" : pathname.startsWith("/admin/enquiries") ? "Enquiries" : "Admin"}</strong></div>
        <div className={styles.account}><span className={styles.avatar}>{(email || "A").slice(0,1).toUpperCase()}</span><span className={styles.email}>{email}</span></div>
      </header>
      <main className={styles.content}>{children}</main>
      <footer className={styles.footer}>Portfolio Studio <span>•</span> Changes are saved to your portfolio database when you save an item.</footer>
    </div>
  </div>;
}







