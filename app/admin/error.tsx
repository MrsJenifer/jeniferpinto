"use client";
import { useEffect } from "react";
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("admin.route.error", { message: error.message, digest: error.digest }); }, [error]);
  return <main style={{ minHeight: "55vh", display: "grid", placeItems: "center", padding: 24, background: "#f5f7fa" }}>
    <section style={{ width: "min(520px,100%)", padding: 28, border: "1px solid #e5eaf0", borderRadius: 16, background: "white" }}>
      <p style={{ color: "#9b6b2e", fontSize: 11, fontWeight: 800, letterSpacing: ".12em" }}>WORKSPACE ERROR</p>
      <h1 style={{ margin: "10px 0", fontSize: 25, color: "#192b40" }}>This section could not load</h1>
      <p style={{ color: "#748195", fontSize: 13, lineHeight: 1.7 }}>The page encountered an unexpected error. Retry once. If it continues, check the server terminal and browser Network panel for the failing request.</p>
      {error.digest && <p style={{ color: "#748195", fontSize: 11 }}>Reference: {error.digest}</p>}
      <button type="button" onClick={reset} style={{ marginTop: 10, padding: "10px 15px", border: 0, borderRadius: 9, background: "#192b40", color: "white", fontWeight: 650, cursor: "pointer" }}>Try again</button>
    </section>
  </main>;
}
