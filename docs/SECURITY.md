# Security checklist

## Before deployment

- [ ] Apply SQL migrations in the correct Supabase project and environment.
- [ ] Create the owner using Supabase Auth; do not enable public admin registration.
- [ ] Add the owner's exact Auth UUID to `public.admin_users` with `role='owner'` and `is_active=true` using a privileged SQL session.
- [ ] Confirm anonymous users can read published content only.
- [ ] Confirm no anonymous access to drafts, enquiries, media metadata, audit records, or version snapshots.
- [ ] Verify the storage policies and bucket visibility. `portfolio-assets` is a public bucket only for files expressly intended for public display/download. Store private documents in a separate private bucket.
- [ ] Configure request-level rate limiting and CAPTCHA for public forms. The in-memory rate limiter in this starter is process-local and unsuitable as a production distributed rate limiter.
- [ ] Restrict upload types and sizes, run file signature checks and malware scanning where feasible.
- [ ] Add automated tests for authorization and RLS.
- [ ] Set HTTPS and appropriate security headers at the hosting layer.
- [ ] Configure backups and test restoration.
- [ ] Configure an error-reporting service without leaking private content or secrets.
- [ ] Complete a privacy review and replace the starter privacy notice.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run build`, integration tests, and an external security review.

## Important limitations in this starter

- Content update/delete routes attempt to write version snapshots and audit events. Verify that logging works with the configured Supabase RLS policies; version-write failures are logged and do not block a content save.
- Media deletion checks current content JSON for matching public URLs or storage paths before removing an asset. Review this check if new attachment/reference tables are added.
- The basic contact-form rate limiter uses in-memory state and must be replaced by a distributed/edge limiter for production.
- Google Drive OAuth, file search, import, token refresh, and disconnect routes are implemented but have not been verified against a real Google Cloud project.
- The admin editor provides restore for existing records; deleted records cannot currently be restored through the UI.
- Enquiry status management is available in the admin UI.
- Malware scanning is not enabled by default.
- The starter privacy notice is not legal advice and requires review.
## Dependency audit note (reviewed 2026-10-22)

The project may report the `braces` advisory GHSA-vfj7-8cjw-p6xm through the Next.js ESLint development-tooling dependency chain. At the time of review, public package/advisory results indicate that a patched `braces` release is not available. Do not run `npm audit fix --force` merely to clear this finding: npm may propose downgrading `eslint-config-next` to a different major version. Keep the lockfile, review `npm audit` after dependency updates, and re-evaluate this advisory when upstream publishes a fix. This note is not a waiver or proof of exploitability; determine the production dependency tree with `npm audit --omit=dev` and document both results.
