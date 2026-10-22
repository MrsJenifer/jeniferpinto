import { Suspense } from "react";
import LoginForm from "@/components/admin/LoginForm";
export default function AdminLoginPage() {
  return <Suspense fallback={<main className="admin-login-wrap"><section className="admin-login"><p>Loading secure sign-in…</p></section></main>}><LoginForm /></Suspense>;
}
