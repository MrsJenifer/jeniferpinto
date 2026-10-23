# Final release checklist

Run checks from the repository root, and do not commit until the production build succeeds.

1. `npm run check:encoding`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run verify:source`
5. `npm audit --omit=dev --audit-level=high`
6. `npm run build`
7. Start the production server in a separate terminal with `npm run start`; in another terminal run `powershell -ExecutionPolicy Bypass -File .\scripts\security-ux-audit.ps1 -BaseUrl http://127.0.0.1:3000 -SkipBuild`.
8. Verify `/__portfolio_404_finance_game_test__` returns HTTP 404 while displaying the game; verify answer selection, next question, final score and replay.
9. Verify six viewport widths (320, 360, 390, 768, 1024, 1440) and all public routes; inspect any remaining Axe critical/serious nodes. Responsive pass is not the same as full usability testing.
10. Test authenticated admin behavior and real contact submission in a controlled environment. Do not use live destructive operations as smoke tests.
11. Verify Supabase SQL assertions; run public API tests for unauthenticated 401/403. Separately verify logged-in role/RLS boundaries and the server-only contact secret.
12. Review the full `npm audit` report. The reviewed `braces` finding is in development tooling; do not use `npm audit fix --force` as it may produce incompatible major downgrades. Recheck upstream and document unresolved findings.
13. `powershell -ExecutionPolicy Bypass -File .\scripts\organize-project-tree.ps1` to preview, then add `-Apply` to archive generated reports and backup snapshots outside the repository after confirming the file list.
14. `powershell -ExecutionPolicy Bypass -File .\scripts\verify-project-tree.ps1`, `git diff --check`, `git status --short`, `git diff --stat`, `git diff --cached --name-only`.
15. Inspect the diff. Confirm `.env.local`, secrets, `node_modules`, `.next`, and generated reports aren't staged. Commit and push only after reviewing intended source changes.

## Important caveat

Local tests don't confirm the production deployment, CDN/edge WAF, Vercel project environment values, Supabase dashboard configuration, or the deployed HTTPS HSTS header. Test those separately before calling the site fully release-ready.
