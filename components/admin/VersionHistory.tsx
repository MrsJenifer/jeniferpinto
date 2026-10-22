"use client";
import { adminFetch } from "@/lib/admin-fetch";
import { useCallback, useEffect, useState } from "react";
import { History, RotateCcw, RefreshCw } from "lucide-react";
import type { ContentItem } from "@/lib/types";
type Version = { id: string; created_at: string; snapshot: { slug?: string; data?: Record<string, unknown>; is_published?: boolean } };
export function VersionHistory({ itemId, onRestored }: { itemId: string | null; onRestored: (item: ContentItem) => void }) {
  const [items, setItems] = useState<Version[]>([]); const [loading, setLoading] = useState(false); const [hasLoaded, setHasLoaded] = useState(false); const [busy, setBusy] = useState(""); const [message, setMessage] = useState(""); const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    if (!itemId) return;
    try {
      const r = await adminFetch(`/api/admin/content/versions?id=${encodeURIComponent(itemId)}`, { cache: "no-store" });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Unable to load history.");
      setItems(b.items || []);
      setFailed(false);
    } catch (e) {
      setFailed(true);
      setMessage(e instanceof Error ? e.message : "Unable to load history.");
    } finally {
      setHasLoaded(true);
      setLoading(false);
    }
  }, [itemId]);
  // Intentional async history fetch when the selected content record changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (itemId) void load(); }, [itemId, load]);
  async function restore(version: Version) { if (!confirm(`Restore the saved version from ${new Date(version.created_at).toLocaleString()}? The current version will first be saved to history.`)) return; setBusy(version.id); setMessage(""); setFailed(false); try { const r = await adminFetch("/api/admin/content/versions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version_id: version.id }) }); const b = await r.json(); if (!r.ok) throw new Error(b.error || "Restore failed."); onRestored(b.item); setMessage("Previous version restored."); await load(); } catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : "Restore failed."); } finally { setBusy(""); } }
  if (!itemId) return <div className="admin-panel"><div className="admin-panel-head"><h2><History size={15} style={{ display: "inline", marginRight: 7 }}/>Version history</h2></div><p className="small-muted">Save a content record first to view and restore previous versions.</p></div>;
  return <section className="admin-panel"><div className="admin-panel-head"><h2><History size={15} style={{ display: "inline", marginRight: 7 }}/>Version history</h2><button type="button" className="btn btn-outline" onClick={() => { setLoading(true); setMessage(""); setFailed(false); void load(); }}><RefreshCw size={13}/> Refresh</button></div>{message && <div className={`admin-alert${failed ? " error" : ""}`} role="status">{message}</div>}{loading || !hasLoaded ? <p className="small-muted">Loading versions…</p> : items.length ? <div className="content-list">{items.map(v => { const data = v.snapshot?.data || {}; const label = String(data.title || data.name || data.degree || v.snapshot?.slug || "Saved version"); return <div className="content-row" key={v.id}><div><h3>{label}</h3><p>{new Date(v.created_at).toLocaleString()} · {v.snapshot?.is_published ? "Published" : "Draft"}</p></div><button type="button" className="btn btn-outline" disabled={busy === v.id} onClick={() => void restore(v)}><RotateCcw size={13}/>{busy === v.id ? "Restoring…" : "Restore"}</button></div>; })}</div> : <div className="empty-state">No earlier versions have been saved for this item yet.</div>}<p className="small-muted" style={{ marginTop: 12 }}>The current version is saved before restoration. Deleted records cannot be restored from this screen.</p></section>;
}
