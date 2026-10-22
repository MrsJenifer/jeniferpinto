import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { googleOAuthConfigured } from "@/lib/google-drive";
export const runtime = "nodejs";
export async function GET() {
  const auth = await requireAdmin({ redirectOnFailure: false }).catch(() => null);
  if (!auth) return NextResponse.json({ error: "Administrator authentication is required." }, { status: 401 });
  if (!["owner", "administrator"].includes(auth.role)) return NextResponse.json({ error: "Only an owner or administrator can connect Google Drive." }, { status: 403 });
  if (!googleOAuthConfigured()) return NextResponse.json({ error: "Google Drive is not configured. Add the Google OAuth client and token encryption key to the server environment." }, { status: 503 });
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: process.env.GOOGLE_REDIRECT_URI!, response_type: "code", scope: "openid email https://www.googleapis.com/auth/drive.readonly", access_type: "offline", prompt: "consent", include_granted_scopes: "true", state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set("google_drive_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/api/integrations/google" });
  response.cookies.set("google_drive_pkce_verifier", verifier, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/api/integrations/google" });
  return response;
}
