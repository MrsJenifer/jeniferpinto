import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const required = [
  "app/page.tsx",
  "app/admin/page.tsx",
  "app/admin/content/page.tsx",
  "app/admin/media/page.tsx",
  "app/admin/enquiries/page.tsx",
  "app/api/admin/content/route.ts",
  "app/api/admin/content/versions/route.ts",
  "components/admin/VersionHistory.tsx",
  "components/admin/EnquiryManager.tsx",
  "lib/urls.ts",
  "app/api/admin/media/route.ts",
  "app/api/admin/enquiries/route.ts",
  "app/api/contact/route.ts",
  "app/api/integrations/google/connect/route.ts",
  "app/api/integrations/google/callback/route.ts",
  "app/api/integrations/google/status/route.ts",
  "app/api/integrations/google/files/route.ts",
  "components/admin/GoogleDriveManager.tsx",
  "lib/google-drive.ts",
  "database/migrations/001_initial_schema.sql",
  "docs/SECURITY.md",
  "docs/GOOGLE_DRIVE.md",
  ".env.example",
];
const failures = [];
for (const file of required) {
  try { await access(resolve(root, file)); }
  catch { failures.push(`Missing required file: ${file}`); }
}
const migration = await readFile(resolve(root, "database/migrations/001_initial_schema.sql"), "utf8").catch(() => "");
for (const marker of ["enable row level security", "is_active_admin", "content_versions", "audit_events", "portfolio-assets", "integration_connections", "has_admin_role"]) {
  if (!migration.toLowerCase().includes(marker.toLowerCase())) failures.push(`Database migration is missing expected safeguard/schema marker: ${marker}`);
}
const env = await readFile(resolve(root, ".env.example"), "utf8").catch(() => "");
if (/service[_-]?role[_-]?key\s*=\s*[^\s#]+/i.test(env)) failures.push("A service-role key appears to be hardcoded in .env.example.");
if (/sk-[A-Za-z0-9]{20,}/.test(env)) failures.push("A token-like secret appears in .env.example.");
if (failures.length) {
  console.error("Source verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Source verification passed: ${required.length} required files and core security/schema markers checked.`);
  console.log("This is a repository sanity check, not a substitute for typechecking, builds, integration tests, or a security audit.");
}
