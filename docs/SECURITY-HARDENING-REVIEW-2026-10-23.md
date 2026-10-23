# Security, UX and mobile-readiness review — 23 October 2026

## Scope and confidence

This was a source-code review of the accessible `MrsJenifer/jeniferpinto` GitHub `main` tree (commit `500e304abfceb7a065224ce13cee8137a060fa1d`), plus a review of the package-lock versions and existing smoke-test script. It did **not** execute the app on the owner's Windows machine, access production secrets, query their live Supabase project, run the deployed site through a browser, or perform a penetration test. Local-only uncommitted changes must be retested after applying the patch.

## Confirmed findings

### High — public contact writes bypass the app's in-memory limiter

The existing `/api/contact` route uses a process-local `Map` for rate limits, while the initial Supabase migration grants anonymous insert access through the `Anyone can submit contact enquiry` policy. A caller can therefore call the Supabase REST endpoint directly with the public publishable/anon key and bypass this application-level limiter. A process-local map also does not give consistent limits across serverless instances and can grow as new keys arrive.

**Remediation in this pack:** the contact endpoint switches to a server-only service-role client; migration `003_contact_security_hardening.sql` drops the public insert policy and revokes `INSERT` from `PUBLIC`, `anon`, and `authenticated`; an atomic Postgres RPC enforces five requests per ten-minute window per hashed client address. Raw IP addresses are not stored in the rate-limit table. The service-role key is server-only and must never use a `NEXT_PUBLIC_` prefix.

### Medium — contact payload handling and origin checks

The previous route parsed JSON before imposing a body-size limit, and it did not check the browser `Origin`. The honeypot was validated with `max(0)`, so bots that filled it did not reach the intended silent-discard path.

**Remediation in this pack:** a bounded 8 KiB body reader, JSON content-type/UTF-8 checks, same-origin validation, and a honeypot schema that allows a filled value to be silently discarded.

### Medium — incomplete browser security header set

The prior configuration already sent `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, and a restrictive `Permissions-Policy`, and disabled the `X-Powered-By` header. It did not send HSTS or a CSP policy.

**Remediation in this pack:** add HSTS and a deliberately non-blocking `Content-Security-Policy-Report-Only` policy. Review the policy against real production browser reports before enforcing it; this report-only policy is not an XSS prevention guarantee. HSTS should be checked on the final HTTPS host.

## Positive security controls observed

- Admin pages and API routes use a server-side `requireAdmin` check that validates the Supabase user and an active `admin_users` record. Authorization is not delegated solely to `proxy.ts`.
- The initial migration enables RLS on the core public tables and provides separate admin/public policies. Apply the new migration and run the accompanying SQL assertions against the actual production Supabase database; code inspection alone does not prove the deployed grants/policies match.
- The media upload route has a 50 MiB per-file cap, MIME allowlist, signature checks for supported formats, and random storage paths.
- Google Drive OAuth uses state and PKCE; stored OAuth tokens are encrypted with AES-256-GCM. Keep the encryption key server-side and back it up securely.
- React renders content as text rather than injecting raw HTML in the reviewed public pages. If rich article HTML/Markdown is added later, sanitize it before rendering.

## Dependency observations

The accessible lockfile reports `next@16.4.2`, `react@19.3.1`, `react-dom@19.3.1`, and `sharp@0.35.5`. Those versions are above the fixed versions listed for several recent Next.js/React advisories examined during this review, including the Next.js 16.4.1 fix for the October 2026 App Router `use cache` RCE advisory. This is **not** a declaration that the full dependency tree is clean: run `npm audit --omit=dev` and `npm audit` locally against the exact current lockfile and review each result. The repository's existing security note also calls out a `braces`/ESLint development dependency advisory; do not use `npm audit fix --force` blindly.

## Required deployment steps for the contact fix

1. Apply `database/migrations/003_contact_security_hardening.sql` in the correct Supabase project via SQL Editor. Do not rerun the initial schema migration.
2. Configure `SUPABASE_SERVICE_ROLE_KEY` as a server-side secret in local `.env.local` and the hosting provider's environment. Never commit it, paste it into chat, or name it `NEXT_PUBLIC_*`. It bypasses RLS.
3. Re-deploy only after the SQL migration and environment variable are configured. The contact endpoint intentionally fails closed with HTTP 503 when its server-side secret/rate-limit RPC is unavailable.
4. Run `database/tests/003_security_assertions.sql`. It throws if core RLS is missing, public roles still have contact insert privileges, or the rate-limit table/RPC is exposed.
5. Run `npm run build`, then `scripts/security-ux-audit.ps1`. Install the browser test dependencies as described in the pack README to run responsive and Axe accessibility checks.
6. In the hosting control plane, add edge/WAF rate limiting and bot protection to `/api/contact` as defense in depth. App-side database rate limiting does not replace platform-level traffic controls.

## UX and mobile test coverage added

The Playwright suite checks route responses and page-level horizontal overflow at 320, 360, 390, 768, 1024, and 1440 CSS-pixel widths. It also checks navigation links, contact-form controls, admin login at narrow width, and critical/serious Axe WCAG 2.1 A/AA findings. The suite has **not yet been run in the target local environment**; its results must be captured from the user's machine.

## Not claimed as verified

- The exact permissions and deployed RLS state in Supabase.
- Google Drive OAuth callback against the real Google Cloud project.
- Logged-in owner/editor role separation end to end.
- Upload tests against the real bucket and hosting body-size limits.
- Real mobile Safari/Chrome behaviour on physical devices.
- Current npm audit output for the local working tree.
- A third-party penetration test or formal security certification.

## External references checked on 23 October 2026

- Next.js GHSA-673q-mjm6-r5xr: https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr (critical issue affects Next.js 16.0.0 through 16.4.0; patched in 16.4.1).
- Next.js GHSA-vcvr-r3jv-pc5j: https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j (patched in 16.3.6 for the documented `next/og` ImageResponse case).
- React react-server-dom GHSA-wx67-qw84-cm4g: https://github.com/react/react/security/advisories/GHSA-wx67-qw84-cm4g (affected React Server DOM versions through the listed 19.2.7 range; patched 19.2.8).
- Supabase RLS and grants documentation: https://supabase.com/docs/guides/database/postgres/row-level-security (RLS policies must be paired with explicit table grants/revokes; RLS alone does not remove grants).
- OWASP HTTP response headers cheat sheet: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
