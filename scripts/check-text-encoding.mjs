import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const roots = ["app", "components", "lib", "public", "scripts", "supabase"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".scss", ".html", ".md", ".txt", ".svg", ".yml", ".yaml", ".sql"]);
const cp = (...points) => String.fromCharCode(...points);
const markers = [
  { label: "UTF-8/Windows-1252 punctuation corruption", token: cp(0x00e2, 0x20ac) },
  { label: "misdecoded emoji sequence", token: cp(0x00f0, 0x0178) },
  { label: "replacement-character mojibake", token: cp(0x00ef, 0x00bf, 0x00bd) },
  { label: "Unicode replacement character (original text may be lost)", token: cp(0xfffd) },
  { label: "misdecoded accented e", token: cp(0x00c3, 0x00a9) },
  { label: "misdecoded accented a", token: cp(0x00c3, 0x00a1) },
  { label: "misdecoded accented o", token: cp(0x00c3, 0x00b3) },
  { label: "misdecoded n tilde", token: cp(0x00c3, 0x00b1) },
  { label: "misdecoded middle dot", token: cp(0x00c2, 0x00b7) },
  { label: "misdecoded copyright mark", token: cp(0x00c2, 0x00a9) },
];
const ignored = new Set(["node_modules", ".next", "backups", ".git", "dist", "build", "coverage"]);
const problems = [];
function scan(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(absolute);
    else if (extensions.has(path.extname(entry.name).toLowerCase())) {
      let text;
      try { text = fs.readFileSync(absolute, "utf8"); } catch (error) {
        problems.push(`${path.relative(root, absolute)}: unable to read UTF-8 (${error.message})`);
        continue;
      }
      const lines = text.split(/\r?\n/);
      lines.forEach((line, index) => {
        for (const marker of markers) {
          if (line.includes(marker.token)) {
            problems.push(`${path.relative(root, absolute)}:${index + 1}: ${marker.label}`);
            break;
          }
        }
        if (/[\u0080-\u009f]/u.test(line)) {
          problems.push(`${path.relative(root, absolute)}:${index + 1}: unexpected control character`);
        }
      });
    }
  }
}
for (const dir of roots) scan(path.join(root, dir));
for (const file of ["package.json", "next.config.ts", "next.config.mjs", "tsconfig.json", "eslint.config.mjs", "postcss.config.mjs", ".editorconfig", ".gitattributes"]) {
  const absolute = path.join(root, file);
  if (fs.existsSync(absolute)) {
    let text;
    try { text = fs.readFileSync(absolute, "utf8"); } catch { continue; }
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const marker of markers) {
        if (line.includes(marker.token)) {
          problems.push(`${file}:${index + 1}: ${marker.label}`);
          break;
        }
      }
      if (/[\u0080-\u009f]/u.test(line)) problems.push(`${file}:${index + 1}: unexpected control character`);
    });
  }
}
if (problems.length) {
  console.error("Text-encoding check failed. Repair these source lines before committing/deploying:");
  for (const problem of problems) console.error(` - ${problem}`);
  process.exitCode = 1;
} else {
  console.log("Text-encoding check passed: no known mojibake patterns found in source files.");
}