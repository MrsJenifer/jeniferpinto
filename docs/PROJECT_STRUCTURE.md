# Project structure and ownership

Keep Next.js route files inside `app/`; do not move routes into `src/` or rename paths without changing route tests and links. Keep shared UI in `components/`, server-side data/auth helpers in `lib/`, and public-only assets in `public/`.

```text
app/                         Next.js App Router pages, route handlers, global CSS
  api/                       Server endpoints; every admin route checks authorization
  admin/                     Private admin UI routes
  projects/[slug]/           Dynamic project detail route
components/
  admin/                     Admin UI, forms, media, login and dashboard
  portfolio/                 Public UI, header/footer, cards, contact, 404 game
lib/
  supabase/                  Browser, server and privileged server-only clients
  admin-auth.ts              Server authorization guard
  public-content.ts          Published content retrieval
  validation.ts              Zod input schemas
database/
  migrations/                Ordered SQL migrations; apply deliberately per environment
  tests/                     SQL assertions and policy checks
docs/                        Security review, provider setup, project structure and release notes
scripts/                     Safe local maintenance, source checks and audit scripts
tests/e2e/                   Playwright browser, responsive, accessibility and 404 game tests
public/                      Static assets only; never put secrets or private documents here
```

## Keep the working tree clean

- Do not retain `*.backup-*`, `*.bak`, `*.before-*`, `*.old` or `*.orig` snapshots inside `app/`, `components/`, `lib/`, `scripts/`, `database/`, `docs/` or `public/`. Use `scripts/organize-project-tree.ps1 -Apply` to copy them outside the repository, verify SHA-256 hashes, then remove the copies from the source tree.
- Keep `node_modules/` and `.next/` local and ignored. Don't archive or commit them.
- Keep Playwright `test-results/`, `playwright-report/`, coverage reports, and audit output outside version control. The security audit report is stored under `%LOCALAPPDATA%\JeniferFinancePortfolio\AuditReports` so Playwright cannot clear it.
- `.env.local` and production credentials are never committed. The service-role/secret key must remain server-only and its value must never be included in logs or diagnostic output.
- Keep `database/migrations/` and `database/tests/` separate. Never rerun the initial schema migration against an existing live database; apply only the intended new migration after reviewing it.
- Preserve route URLs. Public sections live at `/`, `/about`, `/projects`, `/skills`, `/experience`, `/education`, `/achievements`, `/articles`, `/contact`; unknown paths render the custom finance 404.
