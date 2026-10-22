# Jenifer Pinto â€” MBA Finance Portfolio

A Next.js application starter for a recruiter-focused MBA Finance portfolio with database-backed content, admin access, a reusable media library, project case studies, and a Supabase/PostgreSQL foundation.

> **Honest implementation status:** The public portfolio pages and initial admin/content/media workflow are implemented in code. Supabase, production Auth, storage, email delivery, and live Google Drive access require environment setup and tests in your own accounts. Do not consider the project production-ready until the checklist in `docs/SECURITY.md` is complete.

## Technology

- Next.js App Router and React
- TypeScript
- Tailwind CSS import plus a custom responsive design system
- Supabase Auth, PostgreSQL, Storage, and RLS
- Zod for server-side request validation

## Run locally

For a step-by-step Windows setup, see [`START_HERE.md`](./docs/setup/START_HERE.md).

Prerequisites: Node.js compatible with the selected Next.js release and npm.

PowerShell on Windows (using `npm.cmd` avoids PowerShell's `npm.ps1` execution-policy issue):

```powershell
Copy-Item .env.example .env.local
npm.cmd install
npm.cmd run dev
```

macOS/Linux:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. Without Supabase environment values, the public website uses clearly labelled demo content and the login/admin functions remain disabled. Demo-mode content is read-only; it does not masquerade as persistent editing.

## Configure Supabase

1. Create a new Supabase project.
2. Copy the project URL and publishable key to `.env.local`.
3. Open SQL Editor and run `database/migrations/001_initial_schema.sql`.
4. In Supabase Auth, create an owner user and verify its email.
5. Obtain that user's Auth UUID. In the SQL Editor, run the following after replacing the placeholder:

```sql
insert into public.admin_users(user_id, role, is_active)
values ('REPLACE_WITH_AUTH_USER_UUID', 'owner', true);
```

6. Restart the application and sign in at `/admin/login`.
7. Immediately update the seeded placeholder profile/project information with genuine details.
8. Verify row-level security and storage bucket policies before publication.

Do not put a service-role key into a `NEXT_PUBLIC_` variable. This application uses the publishable key with the logged-in user's cookie session and relies on RLS.

## Content management

The admin content screen supports collection selection, search, create, update, publish/unpublish, delete, and best-effort content snapshots/audit events. The admin enquiry screen supports viewing contact messages and updating their status. Common fields are exposed as structured form fields; additional type-specific fields can be edited in the additional JSON fields area. Use valid JSON objects only. The backend also validates content type, slug shape, and data shape.

The media library supports upload, listing, URL copying, and guarded deletion for images, PDFs, DOCX, XLSX, and PPTX under a 10 MB limit. Uploads are checked against basic file signatures as well as the declared MIME type. Public URLs are used only for files deliberately stored in the public portfolio bucket; do not upload private documents there. A refined asset picker that attaches media records directly to every project/profile field remains a follow-up implementation item.

## Google Drive

The Google Drive OAuth, file search, and import flows are implemented in code. They require a configured Google Cloud OAuth client, server-side encryption key, database migration, and end-to-end verification before being treated as production-ready. The current Drive scope is broad read-only access and may require Google OAuth verification for public production use. See `docs/GOOGLE_DRIVE.md`.

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run start
```

## Main routes

- `/` portfolio homepage
- `/about` profile
- `/projects` project catalogue
- `/projects/[slug]` project case study
- `/skills` skills
- `/experience` experience
- `/education` education and certifications
- `/contact` contact form
- `/privacy` starter privacy notice
- `/admin/login` administrator login
- `/admin` dashboard
- `/admin/content` content CRUD
- `/admin/media` media library

## Deployment

1. Create separate development, preview, and production Supabase projects.
2. Apply migrations in each project only after reviewing them.
3. Set environment variables in the hosting platform.
4. Configure Auth site URL and redirect URLs for each environment.
5. Configure domain, HTTPS, security headers, request limits, monitoring, backups, and storage policies.
6. Run all checks and end-to-end/security tests.
7. Verify public pages, admin role checks, private data boundaries, upload permissions, and error handling against the deployed site.

## Known follow-up work before a production claim

- Automated unit/integration/e2e/security tests need to be written and executed against a configured environment.
- A distributed rate limiter and CAPTCHA should protect public contact submissions; the included in-memory limiter is only a basic development safeguard.
- Google Drive OAuth, token encryption, search, import, and disconnect are implemented but still require end-to-end verification against a real Google Cloud project.
- Content snapshots and audit events are written best-effort by the content mutation API, and the admin editor exposes version restore for existing records. Confirm these workflows against your configured RLS policies.
- Media deletion checks current content JSON for references; expand this if you add dedicated attachment/reference tables. Direct asset field integration remains a follow-up.
- Admin enquiry management is implemented; configurable retention workflows should be added.
- Basic file signature checks are implemented; configure malware scanning and strengthen content-disposition handling for downloadable files.
- Replace the starter privacy statement with a reviewed notice that matches real operations.

## Dependency audit note

Do not run `npm audit fix --force` just to clear an ESLint/Next.js development-tooling finding; npm may propose a breaking downgrade of `eslint-config-next`. Review `npm audit` and `npm audit --omit=dev` separately. The `braces` high-severity advisory currently has no published patched release, according to the upstream package/advisory information checked on 2026-10-22. Track the advisory and re-evaluate after an upstream fix is released. This note is not a claim that a security review is complete.

