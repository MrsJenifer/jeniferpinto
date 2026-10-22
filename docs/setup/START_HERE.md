# Start here — Jenifer Pinto Finance Portfolio

## 1. Requirements

- Node.js 22 LTS (or a supported Node.js release for the selected Next.js version)
- npm
- A Supabase account for persistent content and administrator authentication

## 2. Run on Windows

Open PowerShell in the project folder. If PowerShell blocks `npm.ps1` under your execution policy, use `npm.cmd` as shown below; do not weaken the machine-wide execution policy just to run npm:

```powershell
Copy-Item .env.example .env.local
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

Without Supabase configuration, public pages use sample portfolio content. The admin login will remain disabled; demo content is not saved persistently.

## 3. Configure Supabase

1. Create a new Supabase project for development.
2. In Supabase Project Settings, copy the project URL and publishable key into `.env.local`.
3. In Supabase SQL Editor, review and run `database/migrations/001_initial_schema.sql`.
4. In Supabase Authentication, create Jenifer's administrator account and verify the email address.
5. Copy the account's Auth user UUID.
6. In SQL Editor, run the following after replacing the placeholder UUID:

```sql
insert into public.admin_users(user_id, role, is_active)
values ('REPLACE_WITH_AUTH_USER_UUID', 'owner', true);
```

7. Restart `npm run dev` and sign in at `http://localhost:3000/admin/login`.
8. Open **All content → Site settings** and update the website copy. Open **Profile** and replace the sample profile information. Replace sample project content before sharing the site publicly.

Never put a service-role key into a `NEXT_PUBLIC_` variable or commit `.env.local`.

## 4. Useful admin routes

- `/admin` — dashboard
- `/admin/content` — create/edit/publish profile, projects, skills, education, experience, certifications, achievements, articles, testimonials, and site settings
- `/admin/media` — upload approved public portfolio assets and copy their URLs
- `/admin/enquiries` — view contact messages and update enquiry status

## 5. Current integration status

- Supabase Auth, database-backed content routes, and Storage require a configured Supabase project and runtime verification.
- Google Drive OAuth, file search, and import routes are implemented but require Google Cloud credentials and end-to-end testing before production use. Follow `docs/GOOGLE_DRIVE.md`.
- Distributed rate limiting, CAPTCHA, malware scanning, production monitoring, backup restoration tests, and a full security test suite remain pre-launch tasks.

## 6. Checks

```powershell
npm.cmd run verify:source
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

`verify:source` checks required files and key schema markers. It is not a substitute for a successful typecheck/build, integration tests, or an independent security review.
