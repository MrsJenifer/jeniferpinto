import type { Metadata } from "next";
import "./globals.css";
import { getPublicContent } from "@/lib/public-content";

function str(v: unknown, fallback: string) { return typeof v === "string" && v.trim() ? v : fallback; }
export async function generateMetadata(): Promise<Metadata> {
  const [profiles, settingsRows] = await Promise.all([getPublicContent("profile", { limit: 1 }), getPublicContent("site_settings", { limit: 1 })]);
  const profile = profiles[0]?.data || {};
  const settings = settingsRows[0]?.data || {};
  const name = str(profile.name, "Jenifer Pinto");
  const title = str(settings.site_title, `${name} | MBA Finance Portfolio`);
  const description = str(settings.site_description, `A professional portfolio of finance projects, financial analysis, education, and skills by ${name}.`);
  return { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"), title: { default: name, template: name }, description, openGraph: { title, description, type: "website" }, robots: { index: true, follow: true } };
}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

