import fs from "fs";
import path from "path";

const repoRoot = process.cwd();
const htmlFiles = fs
  .readdirSync(repoRoot)
  .filter((name) => name.endsWith(".html"));

const localRefRegex = /(src|href)\s*=\s*"([^"]+)"/gi;
const missing = [];

function isExternalRef(ref) {
  return (
    ref.startsWith("http://") ||
    ref.startsWith("https://") ||
    ref.startsWith("data:") ||
    ref.startsWith("#") ||
    ref.startsWith("mailto:") ||
    ref.startsWith("tel:")
  );
}

for (const htmlFile of htmlFiles) {
  const fullPath = path.join(repoRoot, htmlFile);
  const content = fs.readFileSync(fullPath, "utf8");
  let match;

  while ((match = localRefRegex.exec(content)) !== null) {
    const rawRef = match[2].trim();
    if (!rawRef || isExternalRef(rawRef)) continue;
    const normalizedRef = rawRef.split("?")[0].split("#")[0];
    if (!normalizedRef) continue;
    const resolved = path.resolve(path.dirname(fullPath), normalizedRef);
    if (!fs.existsSync(resolved)) {
      missing.push({ file: htmlFile, ref: rawRef });
    }
  }
}

if (missing.length > 0) {
  console.error("Referencias rotas encontradas:");
  missing.forEach((item) => {
    console.error("- " + item.file + " -> " + item.ref);
  });
  process.exit(1);
}

console.log("OK: referencias locales HTML verificadas.");
