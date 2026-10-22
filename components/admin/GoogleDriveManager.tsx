"use client";
import { adminFetch } from "@/lib/admin-fetch";
import { useCallback, useEffect, useState } from "react";
import { Cloud, RefreshCw, Search, Download, ExternalLink, Unplug } from "lucide-react";
import { safeExternalUrl } from "@/lib/urls";
type Status = { configured: boolean; connected: boolean; account_email?: string | null; error?: string };
type DriveFile = { id: string; name: string; mimeType: string; size: string | null; webViewLink: string | null; modifiedTime: string | null; importable: boolean };
const driveMessages: Record<string,string> = { connected: "Google Drive connected successfully.", login_required: "Sign in again before connecting Google Drive.", not_authorized: "Only an owner or administrator can connect Google Drive.", not_configured: "Google Drive server configuration is incomplete.", invalid_state: "Google sign-in verification failed. Try connecting again.", cancelled: "Google Drive connection was cancelled.", invalid_code: "Google did not return a valid authorisation code.", token_exchange_failed: "Google authorisation failed. Check the OAuth redirect URI and client settings.", missing_refresh_token: "Google did not issue a refresh token. Disconnect the app in your Google Account settings and connect again.", connection_failed: "Google Drive connection failed. Check server logs and OAuth settings." };
export function GoogleDriveManager() {
  const [status, setStatus] = useState<Status | null>(null); const [files, setFiles] = useState<DriveFile[]>([]); const [query, setQuery] = useState(""); const [loading, setLoading] = useState(false); const [fileLoadStarted, setFileLoadStarted] = useState(false); const [busyId, setBusyId] = useState(""); const [notice, setNotice] = useState(""); const [failed, setFailed] = useState(false);
  const loadStatus = useCallback(async () => {
    try {
      const r = await adminFetch("/api/integrations/google/status", { cache: "no-store" });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Could not check Google Drive status.");
      setStatus(b);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Status check failed.";
      setFailed(true);
      setNotice(message);
      // Keep configuration failure distinct from an unreachable status endpoint.
      setStatus({ configured: true, connected: false, error: message });
    }
  }, []);
  const loadFiles = useCallback(async (search: string) => {
    try {
      const r = await adminFetch(`/api/integrations/google/files?q=${encodeURIComponent(search)}`, { cache: "no-store" });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Could not list Drive files.");
      setFiles(b.files || []);
      setFileLoadStarted(true);
    } catch (e) {
      setFailed(true);
      setNotice(e instanceof Error ? e.message : "Could not list Drive files.");
      setFileLoadStarted(true);
    } finally {
      setLoading(false);
    }
  }, []);
  // Intentional async OAuth-status fetch on mount; result updates state after network completion.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const drive = params.get("drive");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStatus().then(() => {
      if (drive && driveMessages[drive]) setNotice(driveMessages[drive]);
      if (drive && drive !== "connected") setFailed(true);
    });
  }, [loadStatus]);
  // Intentional async Drive-file fetch after the OAuth status request completes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (status?.connected) void loadFiles(""); }, [status?.connected, loadFiles]);
  async function importFile(file: DriveFile) { setBusyId(file.id); setNotice(""); setFailed(false); try { const r = await adminFetch("/api/integrations/google/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: file.id, alt_text: file.name }) }, 120000); const b = await r.json(); if (!r.ok) throw new Error(b.error || "Import failed."); setNotice(`Imported "${b.item.original_name}" into the media library. Available in Content Management media pickers.`); } catch (e) { setFailed(true); setNotice(e instanceof Error ? e.message : "Import failed."); } finally { setBusyId(""); } }
  async function disconnect() { if (!confirm("Disconnect Google Drive from this portfolio? Existing imported files will remain in the media library.")) return; setNotice(""); setFailed(false); try { const r = await adminFetch("/api/integrations/google/status", { method: "DELETE" }); const b = await r.json(); if (!r.ok) throw new Error(b.error || "Disconnect failed."); setStatus(old => old ? { ...old, connected: false, account_email: null } : old); setFiles([]); setFileLoadStarted(false); setNotice("Google Drive disconnected. Imported files remain available."); } catch (e) { setFailed(true); setNotice(e instanceof Error ? e.message : "Disconnect failed."); } }
  return <section className="admin-panel"><div className="admin-panel-head"><h2><Cloud size={16} style={{ display: "inline", marginRight: 7 }}/>Google Drive</h2><button type="button" className="btn btn-outline" onClick={() => { const wasConnected = status?.connected ?? false; setLoading(wasConnected); setNotice(""); setFailed(false); void loadStatus().then(() => { if (wasConnected) void loadFiles(query); }); }}><RefreshCw size={13}/> Refresh status</button></div>
    {notice && <div className={`admin-alert${failed ? " error" : ""}`} role="status">{notice}</div>}
    {!status ? <p className="small-muted">Checking integration status…</p> : status.error ? <div className="empty-state"><Cloud size={24}/><p>{status.error}</p><button type="button" className="btn btn-outline" onClick={() => { setStatus(null); setNotice(""); setFailed(false); void loadStatus(); }}>Retry status check</button></div> : !status.configured ? <div className="empty-state"><Cloud size={24}/><p>Google Drive is not configured yet. Add the OAuth client ID, secret, redirect URI, and 32-byte base64 encryption key to the server environment, then restart the application.</p></div> : !status.connected ? <><p className="small-muted">Connect an authorised Google account to search its permitted files and import approved assets into managed portfolio storage.</p><a className="btn btn-primary" href="/api/integrations/google/connect"><Cloud size={14}/> Connect Google Drive</a></> : <><div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 14 }}><p className="small-muted">Connected account: <strong>{status.account_email || "Google account"}</strong></p><button className="btn btn-outline" type="button" onClick={() => void disconnect()}><Unplug size={13}/> Disconnect</button></div><form className="admin-toolbar" onSubmit={e => { e.preventDefault(); setLoading(true); setNotice(""); setFailed(false); void loadFiles(query); }}><input aria-label="Search Google Drive files" placeholder="Search Drive files…" value={query} onChange={e => setQuery(e.target.value)}/><button className="btn btn-primary" disabled={loading}><Search size={13}/> Search</button><button className="btn btn-outline" type="button" onClick={() => { setQuery(""); setLoading(true); setNotice(""); setFailed(false); void loadFiles(""); }}><RefreshCw size={13}/> Show recent</button></form>{(loading || (status.connected && !fileLoadStarted)) ? <p className="small-muted" style={{ marginTop: 14 }}>Loading Drive files…</p> : files.length ? <div className="content-list" style={{ marginTop: 15 }}>{files.map(file => <article className="content-row" key={file.id}><div style={{ minWidth: 0, flex: 1 }}><h3>{file.name}</h3><p>{file.mimeType}{file.size ? ` · ${(Number(file.size) / 1024 / 1024).toFixed(2)} MB` : ""}{file.modifiedTime ? ` · Updated ${new Date(file.modifiedTime).toLocaleDateString()}` : ""}</p>{file.webViewLink && safeExternalUrl(file.webViewLink) && <a className="text-link" href={safeExternalUrl(file.webViewLink)} target="_blank" rel="noopener noreferrer">Open in Drive <ExternalLink size={12}/></a>}</div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{file.importable ? <button type="button" className="btn btn-outline" disabled={busyId === file.id} onClick={() => void importFile(file)}><Download size={13}/>{busyId === file.id ? "Importing…" : "Import asset"}</button> : <span className="small-muted">Link only</span>}</div></article>)}</div> : <div className="empty-state">No files found. Try a different search term.</div>}<p className="small-muted" style={{ marginTop: 12 }}>Imports are limited to 50 MB and approved image/video/PDF/Office formats (MP4 and WebM video). Imported files are stored in the public portfolio bucket, so import only assets you intend to publish.</p></>}
  </section>;
}

