import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { EnquiryManager } from "@/components/admin/EnquiryManager";
export const dynamic = "force-dynamic";
export default async function EnquiriesPage() {
  const auth = await requireAdmin();
  return <AdminShell email={auth.user.email || "Administrator"} role={auth.role}><h1>Contact enquiries</h1><p className="subtitle">Review recruiter and professional messages, then track each enquiry through its response lifecycle.</p><EnquiryManager /></AdminShell>;
}
