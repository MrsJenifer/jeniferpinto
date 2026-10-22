import Link from "next/link";
import {
  ArrowUpRight,
  Award,
  BriefcaseBusiness,
  FileText,
  FolderKanban,
  GraduationCap,
  Image as ImageIcon,
  LayoutDashboard,
  Mail,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { getContent } from "@/lib/content";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

const sections = [
  {
    title: "Profile",
    description: "Edit the professional headline, biography, contact details, social links and résumé URL.",
    href: "/admin/content?type=profile",
    action: "Edit profile",
    icon: UserRound,
  },
  {
    title: "Finance projects",
    description: "Create case studies, update project details, manage drafts and publish completed work.",
    href: "/admin/content?type=project",
    action: "Manage projects",
    icon: FolderKanban,
  },
  {
    title: "Experience",
    description: "Maintain professional experience, internships, responsibilities and achievements.",
    href: "/admin/content?type=experience",
    action: "Manage experience",
    icon: BriefcaseBusiness,
  },
  {
    title: "Education",
    description: "Update qualifications, institutions, study periods and academic details.",
    href: "/admin/content?type=education",
    action: "Manage education",
    icon: GraduationCap,
  },
  {
    title: "Skills",
    description: "Maintain finance skills, tools, competencies and professional expertise.",
    href: "/admin/content?type=skill",
    action: "Manage skills",
    icon: Wrench,
  },
  {
    title: "Certifications",
    description: "Manage professional certifications, courses and credential records.",
    href: "/admin/content?type=certification",
    action: "Manage certifications",
    icon: Award,
  },
  {
    title: "All content",
    description: "Open the central content manager to find and maintain portfolio records.",
    href: "/admin/content",
    action: "Browse all content",
    icon: Settings,
  },
  {
    title: "Media & Drive",
    description: "Access the media library for images and documents, and available Drive tools.",
    href: "/admin/media",
    action: "Open media library",
    icon: ImageIcon,
  },
  {
    title: "Contact enquiries",
    description: "Review messages received through the website and manage response status.",
    href: "/admin/enquiries",
    action: "Review enquiries",
    icon: Mail,
  },
];

export default async function AdminPage() {
  const auth = await requireAdmin();

  const [projects, skills, certs, enquiries] = await Promise.all([
    getContent("project", { publishedOnly: false }),
    getContent("skill", { publishedOnly: false }),
    getContent("certification", { publishedOnly: false }),
    auth.supabase
      .from("contact_enquiries")
      .select("id", { count: "exact", head: true }),
  ]);

  const metrics = [
    {
      label: "Finance projects",
      value: projects.length,
      note: "Published and draft records",
      href: "/admin/content?type=project",
      icon: FolderKanban,
    },
    {
      label: "Skills",
      value: skills.length,
      note: "Portfolio competencies",
      href: "/admin/content?type=skill",
      icon: Wrench,
    },
    {
      label: "Certifications",
      value: certs.length,
      note: "Credential records",
      href: "/admin/content?type=certification",
      icon: Award,
    },
    {
      label: "Contact enquiries",
      value: enquiries.error ? "—" : (enquiries.count ?? 0),
      note: enquiries.error ? "Unable to load count" : "Messages received",
      href: "/admin/enquiries",
      icon: Users,
    },
  ];

  return (
    <AdminShell
      email={auth.user.email || "Administrator"}
      role={auth.role}
    >
      <div className="admin-dashboard">
        <div className="admin-dashboard-heading">
          <div>
            <p className="small-muted">PORTFOLIO WORKSPACE</p>
            <h1>Dashboard overview</h1>
            <p className="subtitle">
              Manage Jennifer&apos;s professional portfolio from one place.
            </p>
          </div>
          <Link className="text-link" href="/" target="_blank" rel="noopener noreferrer">
            View live website <ArrowUpRight size={15} />
          </Link>
        </div>

        <div className="admin-metrics">
          {metrics.map(({ label, value, note, href, icon: Icon }) => (
            <Link className="metric-card dashboard-metric-link" href={href} key={label}>
              <span className="dashboard-metric-label">
                <Icon size={17} aria-hidden="true" />
                {label}
              </span>
              <strong>{value}</strong>
              <small>{note}</small>
            </Link>
          ))}
        </div>

        <section className="admin-panel dashboard-sections">
          <div className="admin-panel-head">
            <div>
              <h2>Portfolio management</h2>
              <p className="small-muted">
                Choose a section below to view, add or edit its records.
              </p>
            </div>
            <Link className="text-link" href="/admin/content">
              All content <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="steps dashboard-section-grid">
            {sections.map(({ title, description, href, action, icon: Icon }) => (
              <Link className="step-card dashboard-section-card" href={href} key={title}>
                <span className="dashboard-section-icon">
                  <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="text-link">
                  {action} <ArrowUpRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Workspace essentials</h2>
              <p className="small-muted">
                Keep your portfolio accurate, secure and up to date.
              </p>
            </div>
          </div>

          <div className="content-list">
            <div className="content-row">
              <div>
                <h3>
                  <ShieldCheck
                    size={16}
                    style={{ display: "inline", marginRight: 7 }}
                  />
                  Security and access
                </h3>
                <p>
                  Keep administrator access restricted and review database
                  policies. Never expose passwords or provider keys.
                </p>
              </div>
              <span className="small-muted">Protected access</span>
            </div>

            <div className="content-row">
              <div>
                <h3>
                  <FileText
                    size={16}
                    style={{ display: "inline", marginRight: 7 }}
                  />
                  Content quality
                </h3>
                <p>
                  Keep project descriptions, qualifications, dates and
                  supporting documents accurate and up to date.
                </p>
              </div>
              <Link className="text-link" href="/admin/content?type=project">
                Review projects <ArrowUpRight size={14} />
              </Link>
            </div>

            <div className="content-row">
              <div>
                <h3>
                  <LayoutDashboard
                    size={16}
                    style={{ display: "inline", marginRight: 7 }}
                  />
                  Public portfolio
                </h3>
                <p>
                  Preview the live website after saving and publishing your
                  changes.
                </p>
              </div>
              <Link
                className="text-link"
                href="/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open website <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
