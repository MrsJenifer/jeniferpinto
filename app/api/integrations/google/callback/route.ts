import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { decryptTokens, encryptTokens, getGoogleConnection, googleOAuthConfigured, type GoogleTokens } from "@/lib/google-drive";
export const runtime = "nodejs";
function redirect(req: NextRequest, status: string) { const url = new URL("/admin/media", req.url); url.searchParams.set("drive", status); const response = NextResponse.redirect(url); response.cookies.set("google_drive_oauth_state", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/api/integrations/google" }); response.cookies.set("google_drive_pkce_verifier", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/api/integrations/google" }); return response; }
export async function GET(req: NextRequest) {
  const auth = await requireAdmin({ redirectOnFailure: false }).catch(() => null);
  if (!auth) return redirect(req, "login_required");
  if (!["owner", "administrator"].includes(auth.role)) return redirect(req, "not_authorized");
  if (!googleOAuthConfigured()) return redirect(req, "not_configured");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("google_drive_oauth_state")?.value;
  if (!state || !expected || state.length > 256 || state !== expected) return redirect(req, "invalid_state");
  if (req.nextUrl.searchParams.get("error")) return redirect(req, "cancelled");
  const code = req.nextUrl.searchParams.get("code");
  const verifier = req.cookies.get("google_drive_pkce_verifier")?.value;
  if (!verifier || verifier.length < 43 || verifier.length > 128) return redirect(req, "invalid_state");
  if (!code || code.length > 4096) return redirect(req, "invalid_code");
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: process.env.GOOGLE_REDIRECT_URI!, grant_type: "authorization_code", code_verifier: verifier }), cache: "no-store", signal: AbortSignal.timeout(15000) });
    const tokenBody: unknown = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok || !tokenBody || typeof tokenBody !== "object" || typeof (tokenBody as {access_token?:unknown}).access_token !== "string") return redirect(req, "token_exchange_failed");
    const tokens = tokenBody as GoogleTokens;
    const prior = await getGoogleConnection(auth.user.id).catch(() => null);
    if (!tokens.refresh_token && prior) {
      tokens.refresh_token = decryptTokens(prior.encrypted_tokens).refresh_token;
    }
    if (!tokens.refresh_token) return redirect(req, "missing_refresh_token");
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    const userInfo: unknown = await userResponse.json().catch(() => null);
    const email = userInfo && typeof userInfo === "object" && typeof (userInfo as {email?:unknown}).email === "string" ? (userInfo as {email:string}).email : null;
    const scopes = typeof tokens.scope === "string" ? tokens.scope.split(" ").filter(Boolean) : [];
    const expiry = new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000).toISOString();
    const supabase = auth.supabase;
    const { error } = await supabase.from("integration_connections").upsert({ user_id: auth.user.id, provider: "google_drive", encrypted_tokens: encryptTokens({ ...tokens, expiry_date: Date.now() + (Number(tokens.expires_in) || 3600) * 1000 }), account_email: email, scopes, expires_at: expiry, updated_at: new Date().toISOString() }, { onConflict: "user_id,provider" });
    if (error) throw error;
    await supabase.from("audit_events").insert({ actor_id: auth.user.id, action: "integration.google_drive.connected", target_type: "integration_connection", target_id: auth.user.id, outcome: "success" });
    return redirect(req, "connected");
  } catch (e) {
    console.error("google_drive.oauth.callback.failed", e instanceof Error ? e.message : "unknown");
    return redirect(req, "connection_failed");
  }
}
