import { Suspense } from "react";import { requireAdmin } from "@/lib/admin-auth";import { AdminShell } from "@/components/admin/AdminShell";import { ContentManager } from "@/components/admin/ContentManager";
export const dynamic="force-dynamic";
export default async function AdminContentPage(){const auth=await requireAdmin();return <AdminShell email={auth.user.email||"Administrator"} role={auth.role}><Suspense fallback={<p>Loading content editor…</p>}><ContentManager/></Suspense></AdminShell>}
