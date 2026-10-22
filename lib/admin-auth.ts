import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "./config";
import { createClient } from "./supabase/server";

export class AdminAuthError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "AdminAuthError"; }
}
type AuthOptions = { redirectOnFailure?: boolean };

export async function requireAdmin(options: AuthOptions = {}) {
  const shouldRedirect = options.redirectOnFailure !== false;
  const fail = (message: string, status: number): never => {
    if (shouldRedirect) redirect(status === 503 ? "/admin/login?setup=required" : status === 403 ? "/admin/login?unauthorised=1" : "/admin/login");
    throw new AdminAuthError(message, status);
  };
  if (!isSupabaseConfigured()) return fail("Admin authentication is not configured.", 503);
  let supabase;
  try { supabase = await createClient(); }
  catch { return fail("Authentication service is unavailable.", 503); }
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return fail("Authentication is required.", 401);
  const { data: admin, error: adminError } = await supabase.from("admin_users").select("user_id,role,is_active").eq("user_id", user.id).maybeSingle();
  if (adminError || !admin || !admin.is_active) return fail("This account is not authorised to access the admin dashboard.", 403);
  return { user, role: admin.role as string, supabase };
}

export function adminAuthResponse(error: unknown) {
  if (error instanceof AdminAuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}
