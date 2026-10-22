import { NextResponse } from "next/server";
import { adminAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { decryptTokens, getGoogleConnection, googleOAuthConfigured } from "@/lib/google-drive";
export const runtime = "nodejs";
export async function GET() {
  try {
    const auth = await requireAdmin({ redirectOnFailure: false });
    if (!["owner", "administrator"].includes(auth.role)) return NextResponse.json({ configured: googleOAuthConfigured(), connected: false, error: "Only an owner or administrator can manage Google Drive." }, { status: 403 });
    const connection = await getGoogleConnection(auth.user.id);
    return NextResponse.json({ configured: googleOAuthConfigured(), connected: Boolean(connection), account_email: connection?.account_email ?? null, scopes: connection?.scopes ?? [] });
  } catch (e) {
    const auth = adminAuthResponse(e); if (auth) return auth;
    console.error("google_drive.status.failed", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "Unable to check Google Drive connection status." }, { status: 500 });
  }
}
export async function DELETE() {
  try {
    const auth = await requireAdmin({ redirectOnFailure: false });
    if (!["owner", "administrator"].includes(auth.role)) return NextResponse.json({ error: "Only an owner or administrator can disconnect Google Drive." }, { status: 403 });
    const connection = await getGoogleConnection(auth.user.id);
    if (connection) {
      try { const tokens = decryptTokens(connection.encrypted_tokens); const token = tokens.refresh_token || tokens.access_token; await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }), cache: "no-store", signal: AbortSignal.timeout(10000) }); } catch (e) { console.error("google_drive.revoke.failed", e instanceof Error ? e.message : "unknown"); }
    }
    const { error } = await auth.supabase.from("integration_connections").delete().eq("user_id", auth.user.id).eq("provider", "google_drive");
    if (error) throw error;
    await auth.supabase.from("audit_events").insert({ actor_id: auth.user.id, action: "integration.google_drive.disconnected", target_type: "integration_connection", target_id: auth.user.id, outcome: "success" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const auth = adminAuthResponse(e); if (auth) return auth;
    console.error("google_drive.disconnect.failed", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "Unable to disconnect Google Drive." }, { status: 500 });
  }
}
