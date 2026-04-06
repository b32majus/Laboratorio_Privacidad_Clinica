import fs from "fs";
import path from "path";

const repoRoot = process.cwd();
const forbiddenPatterns = [
  "localStorage.setItem('clinicalText'",
  'localStorage.setItem("clinicalText"',
  "localStorage.getItem('clinicalText'",
  'localStorage.getItem("clinicalText"',
  "localStorage.setItem('batchResults'",
  'localStorage.setItem("batchResults"',
  "localStorage.getItem('batchResults'",
  'localStorage.getItem("batchResults"'
];

const allowedFiles = new Set([
  path.normalize("js/shared/app-session.js"),
  path.normalize("scripts/ci/check-storage-policy.mjs")
]);

function getAllFiles(dir) {
  const output = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...getAllFiles(absolute));
    } else {
      output.push(absolute);
    }
  }
  return output;
}

const files = getAllFiles(repoRoot).filter((f) => {
  return (
    f.endsWith(".html") ||
    f.endsWith(".js") ||
    f.endsWith(".mjs") ||
    f.endsWith(".md")
  );
});

const violations = [];

for (const filePath of files) {
  const relPath = path.normalize(path.relative(repoRoot, filePath));
  if (allowedFiles.has(relPath)) continue;

  const content = fs.readFileSync(filePath, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (content.includes(pattern)) {
      violations.push({ file: relPath, pattern });
    }
  }
}

if (violations.length > 0) {
  console.error("Violaciones de politica de almacenamiento sensible:");
  for (const violation of violations) {
    console.error("- " + violation.file + " -> " + violation.pattern);
  }
  process.exit(1);
}

console.log("OK: politica de almacenamiento sensible verificada.");
