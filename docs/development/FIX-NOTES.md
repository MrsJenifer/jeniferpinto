# Source fixes applied (2026-10-22)

This update addresses the errors reported after applying the prior source package:

- `app/projects/[slug]/page.tsx` imports `getContentBySlug` from `lib/content.ts`, where it is actually exported, instead of importing the unused `getContent`.
- The data-fetching effects in `ContentManager`, `EnquiryManager`, `GoogleDriveManager`, `MediaManager`, and `VersionHistory` now have targeted ESLint comments. They intentionally initiate asynchronous requests whose state updates occur after the response. This is not a blanket disabling of the rule.

## Verify locally

Run `npm.cmd run typecheck`, `npm.cmd run lint`, then `npm.cmd run build`. The archive was prepared from source; the full Next.js build must be verified on the Windows project with dependencies installed.

Do not run `npm.cmd audit fix --force` blindly. Review the complete audit and resolve vulnerable dev dependencies without downgrading the Next.js 16 lint configuration.
