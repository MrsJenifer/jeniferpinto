import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export type GoogleTokens = { access_token: string; refresh_token?: string; token_type?: string; scope?: string; expires_in?: number; expiry_date?: number };
export type GoogleConnection = { user_id: string; encrypted_tokens: string; account_email: string | null; scopes: string[]; expires_at: string | null };

function encryptionKey(): Buffer {
  const encoded = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error("Google Drive token encryption is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}
export function encryptTokens(tokens: GoogleTokens): string {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(tokens), "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}
export function decryptTokens(value: string): GoogleTokens {
  const [ivValue, tagValue, ciphertextValue] = value.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error("Stored Google Drive credentials are invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const text = Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
  const tokens: unknown = JSON.parse(text);
  if (!tokens || typeof tokens !== "object" || typeof (tokens as GoogleTokens).access_token !== "string") throw new Error("Stored Google Drive credentials are invalid.");
  return tokens as GoogleTokens;
}
export function googleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_TOKEN_ENCRYPTION_KEY);
}
export async function getGoogleConnection(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("integration_connections").select("user_id,encrypted_tokens,account_email,scopes,expires_at").eq("user_id", userId).eq("provider", "google_drive").maybeSingle();
  if (error) throw error;
  return data as GoogleConnection | null;
}
export async function getAccessToken(connection: GoogleConnection): Promise<{ token: string; connection: GoogleConnection }> {
  const tokens = decryptTokens(connection.encrypted_tokens);
  const expiry = tokens.expiry_date ?? (connection.expires_at ? new Date(connection.expires_at).getTime() : 0);
  if (expiry > Date.now() + 60_000) return { token: tokens.access_token, connection };
  if (!tokens.refresh_token) throw new Error("Google Drive access expired. Disconnect and reconnect the account.");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: tokens.refresh_token, grant_type: "refresh_token" }), cache: "no-store", signal: AbortSignal.timeout(15000) });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== "object" || typeof (result as {access_token?:unknown}).access_token !== "string") throw new Error("Google Drive token refresh failed. Reconnect the account if this continues.");
  const refreshed = result as GoogleTokens;
  const merged: GoogleTokens = { ...tokens, ...refreshed, refresh_token: tokens.refresh_token, expiry_date: Date.now() + (Number(refreshed.expires_in) || 3600) * 1000 };
  const updated: GoogleConnection = { ...connection, encrypted_tokens: encryptTokens(merged), expires_at: new Date(merged.expiry_date!).toISOString() };
  const supabase = await createClient();
  const { error } = await supabase.from("integration_connections").update({ encrypted_tokens: updated.encrypted_tokens, expires_at: updated.expires_at, updated_at: new Date().toISOString() }).eq("user_id", connection.user_id).eq("provider", "google_drive");
  if (error) throw error;
  return { token: merged.access_token, connection: updated };
}
export async function googleApi(url: string, accessToken: string, init: RequestInit = {}) {
  return fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(20000) });
}
