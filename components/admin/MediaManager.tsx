"use client";

import { adminFetch } from "@/lib/admin-fetch";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Upload, FileText, Image as ImageIcon, RefreshCw, Copy, Trash2, Video } from "lucide-react";

type Asset = {
  id: string;
  original_name: string;
  storage_path: string;
  public_url: string | null;
  mime_type: string;
  size_bytes: number;
  alt_text: string | null;
  created_at: string;
};

function fmt(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export function MediaManager() {
  const [items, setItems] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await adminFetch("/api/admin/media", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load media.");
      setItems(body.items || []);
      setError(false);
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Unable to load media.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Async load populates the authenticated media library after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("alt_text", alt);
      const response = await adminFetch("/api/admin/media", {
        method: "POST",
        body: form,
      }, 120000);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Upload failed.");
      setMessage("File uploaded to the media library. Open Content Management to attach it to a portfolio entry.");
      setFile(null);
      setAlt("");
      const input = document.getElementById("media-file");
      if (input instanceof HTMLInputElement) input.value = "";
      await load();
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Asset) {
    if (!confirm(`Delete "${item.original_name}"? Assets referenced by content cannot be deleted.`)) return;
    setMessage("");
    setError(false);
    try {
      const response = await adminFetch(`/api/admin/media?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Delete failed.");
      setMessage(body.warning || "Asset deleted.");
      await load();
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("URL copied.");
      setError(false);
    } catch {
      setMessage("Could not copy the URL. Select and copy it manually.");
      setError(true);
    }
  }

  return <>
    <section className="admin-panel">
      <div className="admin-panel-head">
        <h2>Upload asset</h2>
        <button type="button" className="btn btn-outline" onClick={() => { setLoading(true); setMessage(""); setError(false); void load(); }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {message && <div className={`admin-alert${error ? " error" : ""}`} role="status">{message}</div>}
      <form onSubmit={upload}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="media-file">Image, video, or document</label>
            <input id="media-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf,.docx,.xlsx,.pptx" onChange={event => setFile(event.target.files?.[0] || null)} required />
            <span className="small-muted">Maximum 50 MB. Images, MP4/WebM videos, PDF, DOCX, XLSX, and PPTX are supported.</span>
          </div>
          <div className="field">
            <label htmlFor="alt-text">Alt text / accessible description</label>
            <input id="alt-text" value={alt} onChange={event => setAlt(event.target.value)} maxLength={250} placeholder="Describe the image; optional for videos and documents" />
          </div>
        </div>
        {file && <p className="small-muted" aria-live="polite">Selected: {file.name} ({fmt(file.size)})</p>}
        <button className="btn btn-primary" disabled={busy || !file}><Upload size={14} />{busy ? "Uploading…" : "Upload to media library"}</button>
      </form>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-head"><h2>Stored assets</h2><span className="small-muted">{items.length} file(s)</span></div>
      {loading ? <p className="small-muted">Loading media…</p> : items.length ? <div className="media-grid">
        {items.map(item => <article className="media-card" key={item.id}>
          <div className="media-preview">
            {item.public_url && item.mime_type.startsWith("image/") ?
              <Image unoptimized src={item.public_url} width={400} height={220} alt={item.alt_text || item.original_name} style={{ height: 125, width: "100%", objectFit: "cover" }} /> :
              item.public_url && item.mime_type.startsWith("video/") ?
                <video src={item.public_url} controls preload="metadata" aria-label={item.original_name} style={{ width: "100%", maxHeight: 160, background: "#111" }} /> :
                item.mime_type.startsWith("video/") ? <Video size={27} /> : <FileText size={27} />}
          </div>
          <strong>{item.original_name}</strong>
          <small>{item.mime_type} · {fmt(item.size_bytes)}</small>
          {item.public_url && <button type="button" className="btn btn-outline" style={{ width: "100%", marginTop: 10, padding: "7px 8px" }} onClick={() => void copy(item.public_url!)}><Copy size={13} /> Copy public URL</button>}
          <button type="button" className="btn btn-outline" style={{ width: "100%", marginTop: 7, padding: "7px 8px" }} onClick={() => void remove(item)}><Trash2 size={13} /> Delete asset</button>
        </article>)}
      </div> : <div className="empty-state"><ImageIcon size={23} /><p>No media yet. Upload an image, video, résumé, or project deliverable, or import one from Google Drive.</p></div>}
    </section>
    <p className="small-muted">Uploaded files and Google Drive imports use the public portfolio asset library. Publish only files you have permission to share; never upload confidential or private documents.</p>
  </>;
}
