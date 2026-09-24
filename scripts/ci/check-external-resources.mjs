/**
 * Deterministic CI check: V4 clinical runtime privacy boundary.
 *
 * Enforces the no-network invariant of the V4 CLINICAL RUNTIME ONLY
 * (SPEC_V4_QUALITY_SECURITY_DEPLOY.md §2 "Network privacy invariant", §3
 * "Production logging"; CURRENT_DECISIONS.md D-014 "Clinical origin";
 * CONTEXT.md §6/§7). It deliberately scans ONLY app-v4 sources and the
 * built V4 dist output, and NEVER scans legacy/marketing pages
 * (index.html, js/**, css/**, *.html at repo root): the security boundary
 * must not depend on same-origin marketing code (CONTEXT.md §7).
 *
 * CI ORDERING: the CI workflow runs this check AFTER "Build V4 app" and
 * BEFORE "Typecheck V4 app", so dist/ exists there and the built-output
 * scan is exercised. Locally, if dist/ is absent the script prints an
 * informational line and still validates sources (exit 0).
 *
 * Scans:
 *   a) Third-party runtime denylist tokens (case-insensitive).
 *   b) Remote-loading constructs in app-v4 source files.
 *   c) Absolute http(s)/protocol-relative loading references plus denylist
 *      tokens in built dist output (comments stripped before matching;
 *      string literals preserved).
 *   d) No-PHI-console invariant: any console.* call in app-v4/src runtime
 *      files (excluding *.test.* and *.d.ts).
 *
 * Plain Node ESM, zero dependencies (house style: check-storage-policy.mjs).
 * Deterministic: no network I/O, no timers.
 */
import fs from "fs";
import path from "path";

const repoRoot = process.cwd();

/**
 * Allowlist of explicitly-authorized exceptions. Intentionally EMPTY: any
 * future exception must be an explicit, documented product/security decision
 * (D-014) and be added here as "<repo-relative-path>:<rule-or-token>".
 * Example (NOT active): "app-v4/src/vendor/shim.ts:new WebSocket(".
 */
const ALLOWED_EXCEPTIONS = new Set([]);

/** Third-party runtime denylist tokens (case-insensitive substrings). */
const DENYLIST_TOKENS = [
  "mailerlite",
  "googletagmanager",
  "gtag(",
  "google-analytics",
  "analytics.js",
  "hotjar",
  "clarity.ms",
  "sentry",
  "intercom",
  "mailchimp",
  "segment.io",
  "cdn.jsdelivr",
  "unpkg.com",
  "cdnjs",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "gravatar"
];

/**
 * Remote-loading constructs flagged in app-v4 SOURCE files
 * (.ts/.tsx/.js/.jsx/.css/.html under app-v4/, excluding node_modules and
 * *.test.* files). Matched per line, case-insensitive, on comment-stripped
 * content.
 */
const REMOTE_LOADING_PATTERNS = [
  { id: "src-http", regex: /\bsrc\s*=\s*["']?https?:\/\//i },
  { id: "href-http", regex: /\bhref\s*=\s*["']?https?:\/\//i },
  { id: "css-url-http", regex: /url\(\s*["']?https?:\/\//i },
  { id: "css-import-http", regex: /@import\s+(?:url\(\s*)?["']?https?:\/\//i },
  { id: "fetch-http", regex: /\bfetch\(\s*["'`]https?:\/\//i },
  { id: "xhr-open-http", regex: /\.open\(\s*["'][A-Za-z]+["']\s*,\s*["'`]https?:\/\//i },
  { id: "xmlhttprequest-http", regex: /\bXMLHttpRequest\b[^\n]{0,200}["'`]https?:\/\//i },
  { id: "sendbeacon", regex: /navigator\s*\.\s*sendBeacon\s*\(/i },
  { id: "websocket", regex: /\bnew\s+WebSocket\s*\(/i },
  { id: "serviceworker-register", regex: /navigator\s*\.\s*serviceWorker\s*\.\s*register\s*\(/i },
  { id: "dynamic-import-http", regex: /\bimport\s*\(\s*["'`]https?:\/\//i },
  { id: "static-import-http", regex: /\bimport\s+[^;\n]*?\bfrom\s*["'`]https?:\/\//i }
];

/**
 * Absolute http(s) OR protocol-relative (//host) references in loading
 * positions, for BUILT dist output. Matched per line on comment-stripped
 * content so bundled license comments carrying plain URLs do not cause
 * false positives, while real loading references (kept inside string
 * literals) still match.
 */
const DIST_LOADING_PATTERNS = [
  { id: "dist-src-remote", regex: /\bsrc\s*=\s*["']?(?:https?:)?\/\//i },
  { id: "dist-href-remote", regex: /\bhref\s*=\s*["']?(?:https?:)?\/\//i },
  { id: "dist-css-url-remote", regex: /url\(\s*["']?(?:https?:)?\/\//i },
  { id: "dist-css-import-remote", regex: /@import\s+(?:url\(\s*)?["']?(?:https?:)?\/\//i }
];

/** No-PHI-console invariant (SPEC §3): any console.* call in runtime code. */
const CONSOLE_PATTERN =
  /\bconsole\s*\.\s*(?:log|error|warn|info|debug|trace|dir|dirxml|table|group|groupCollapsed|groupEnd|time|timeEnd|timeLog|timeStamp|count|countReset|assert|profile|profileEnd|clear)\s*\(/i;

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".html"]);
const DIST_EXTENSIONS = new Set([".html", ".js", ".css"]);

// ---------------------------------------------------------------------------
// CLI scope flags: --scope=source, --scope=dist. Default: both (dist only
// when present).
// ---------------------------------------------------------------------------
let scope = "all";
for (const arg of process.argv.slice(2)) {
  if (arg === "--scope=source" || arg === "--scope=dist") {
    scope = arg.slice("--scope=".length);
  } else {
    console.error("Uso: node scripts/ci/check-external-resources.mjs [--scope=source|--scope=dist]");
    process.exit(2);
  }
}

function getAllFiles(dir, extensionSet) {
  const output = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...getAllFiles(absolute, extensionSet));
    } else if (extensionSet.has(path.extname(entry.name).toLowerCase())) {
      output.push(absolute);
    }
  }
  return output;
}

function isTestFile(relativePath) {
  return /\.test\.(ts|tsx|js|jsx|mjs|css|html)$/.test(relativePath);
}

/**
 * Strip /*...*​/ and //... comments from JS/TS/CSS-family content while
 * KEEPING STRING LITERALS INTACT (loading references live inside string
 * literals) and preserving every newline so file:line stays accurate.
 * Handles template-literal interpolation `${ ... }` via a context stack.
 */
function stripCodeComments(content) {
  let out = "";
  // Stack frames: { type: "code" } | { type: "string", quote }
  //             | { type: "interpolation", braceDepth }
  const stack = [{ type: "code" }];

  const top = () => stack[stack.length - 1];

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = i + 1 < content.length ? content[i + 1] : "";
    const frame = top();

    if (frame.type === "interpolation") {
      out += ch;
      if (ch === "{") frame.braceDepth += 1;
      if (ch === "}") {
        if (frame.braceDepth === 0) stack.pop();
        else frame.braceDepth -= 1;
      }
      continue;
    }

    if (frame.type === "string") {
      out += ch;
      if (ch === "\\") {
        if (next !== "") {
          out += next;
          i++;
        }
        continue;
      }
      if (ch === frame.quote) stack.pop();
      continue;
    }

    // frame.type === "code"
    if (ch === "/" && next === "/") {
      // Line comment: skip to end of line, keep the newline.
      while (i < content.length && content[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (ch === "/" && next === "*") {
      // Block comment: skip to closing marker, keep newlines.
      out += "  ";
      i += 2;
      while (i < content.length && !(content[i] === "*" && content[i + 1] === "/")) {
        if (content[i] === "\n") out += "\n";
        i++;
      }
      i++; // consume "*"; the loop's i++ consumes "/"
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      stack.push({ type: "string", quote: ch });
      out += ch;
      continue;
    }
    if (ch === "$" && next === "{" && stack.some((f) => f.type === "string" && f.quote === "`")) {
      stack.push({ type: "interpolation", braceDepth: 0 });
      out += ch;
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Strip <!-- ... --> comments from HTML content, preserving newlines, and
 * strip code comments inside inline <script>/<style> bodies. HTML text is
 * NOT run through the JS quote tracker (apostrophes in prose would corrupt
 * it); `//`-style comments are not valid in raw HTML anyway.
 */
function stripHtmlComments(content) {
  let withoutBlocks = content.replace(    /<!--[\s\S]*?-->/g,
    (match) => match.replace(/[^\n]/g, " ")
  );
  const stripBlock = (text) => {
    return text.replace(
      /(<script\b[^>]*>)([\s\S]*?)(<\/script>)|(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
      (full, scriptOpen, scriptBody, scriptClose, styleOpen, styleBody, styleClose) => {
        if (scriptOpen) return scriptOpen + stripCodeComments(scriptBody) + scriptClose;
        return styleOpen + stripCodeComments(styleBody) + styleClose;
      }
    );
  };
  return stripBlock(withoutBlocks);
}

/** Strip comments according to file family, preserving line structure. */
function stripCommentsFor(relativePath, content) {
  if (relativePath.endsWith(".html")) return stripHtmlComments(content);
  return stripCodeComments(content);
}

function collectLineViolations(relativePath, content, patterns) {
  const violations = [];
  const lines = content.split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    for (const pattern of patterns) {
      const match = pattern.regex.exec(line);
      if (match) {
        const snippet = line.trim().slice(0, 100);
        violations.push({
          file: relativePath,
          line: lineIndex + 1,
          rule: pattern.id,
          snippet
        });
      }
    }
  }
  return violations;
}

function collectTokenViolations(relativePath, content) {
  const violations = [];
  const lines = content.split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lowerLine = lines[lineIndex].toLowerCase();
    for (const token of DENYLIST_TOKENS) {
      if (lowerLine.includes(token)) {
        const snippet = lines[lineIndex].trim().slice(0, 100);
        violations.push({
          file: relativePath,
          line: lineIndex + 1,
          rule: `token:${token}`,
          snippet
        });
      }
    }
  }
  return violations;
}

function isAllowed(violation) {
  return ALLOWED_EXCEPTIONS.has(`${violation.file}:${violation.rule}`);
}

function dedupe(violations) {
  const seen = new Set();
  return violations.filter((violation) => {
    const key = `${violation.file}:${violation.line}:${violation.rule}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const violations = [];
let sourceFilesScanned = 0;
let distFilesScanned = 0;
let distInfoLine = "dist: 0 archivos escaneados";

// ---------------------------------------------------------------------------
// Source scope: app-v4 sources (tokens + remote-loading constructs + console).
// ---------------------------------------------------------------------------
if (scope === "all" || scope === "source") {
  const appV4Dir = path.join(repoRoot, "app-v4");
  const sourceFiles = getAllFiles(appV4Dir, SOURCE_EXTENSIONS).map((absolute) =>
    path.relative(repoRoot, absolute).split(path.sep).join("/")
  );

  const remoteScanFiles = sourceFiles.filter((f) => !isTestFile(f));
  const consoleScanFiles = sourceFiles.filter(
    (f) =>
      (f.startsWith("app-v4/src/") || f.startsWith("app-v4\\src\\")) &&
      (f.endsWith(".ts") || f.endsWith(".tsx")) &&
      !/\.d\.ts$/.test(f) &&
      !isTestFile(f)
  );

  for (const relativePath of remoteScanFiles) {
    const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
    const stripped = stripCommentsFor(relativePath, content);
    violations.push(...collectTokenViolations(relativePath, stripped));
    violations.push(...collectLineViolations(relativePath, stripped, REMOTE_LOADING_PATTERNS));
  }
  sourceFilesScanned = remoteScanFiles.length;

  for (const relativePath of consoleScanFiles) {
    const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
    const stripped = stripCommentsFor(relativePath, content);
    violations.push(...collectLineViolations(relativePath, stripped, [
      { id: "console-call", regex: CONSOLE_PATTERN }
    ]));
  }
}

// ---------------------------------------------------------------------------
// Dist scope: built V4 output at repo-root dist/ (gitignored). Scanned only
// when present; CI runs this check after the build so it is exercised there.
// ---------------------------------------------------------------------------
if (scope === "all" || scope === "dist") {
  const distDir = path.join(repoRoot, "dist");
  if (fs.existsSync(distDir)) {
    const distFiles = getAllFiles(distDir, DIST_EXTENSIONS).map((absolute) =>
      path.relative(repoRoot, absolute).split(path.sep).join("/")
    );
    for (const relativePath of distFiles) {
      const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
      const stripped = stripCommentsFor(relativePath, content);
      violations.push(...collectTokenViolations(relativePath, stripped));
      violations.push(...collectLineViolations(relativePath, stripped, DIST_LOADING_PATTERNS));
    }
    distFilesScanned = distFiles.length;
    distInfoLine = `dist: ${distFilesScanned} archivos escaneados`;
  } else {
    distInfoLine =
      "dist: no existe (se omite el escaneo de salida construida; en CI este check corre despues del build)";
  }
} else {
  distInfoLine = "dist: omitido por --scope=source";
}

const reportable = dedupe(violations).filter((violation) => !isAllowed(violation));

if (reportable.length > 0) {
  console.error("Violaciones de invariantes de red/privacidad del runtime clinico V4:");
  for (const violation of reportable) {
    console.error(
      "- " + violation.file + ":" + violation.line + " -> " + violation.rule + ": " + violation.snippet
    );
  }
  process.exit(1);
}

console.log(
  "OK: runtime clinico V4 sin recursos externos inesperados. " +
    "Fuente: " + sourceFilesScanned + " archivos escaneados (tokens: " + DENYLIST_TOKENS.length +
    ", patrones remotos: " + REMOTE_LOADING_PATTERNS.length + ", console.*: si), " +
    distInfoLine + ", allowlist: " + ALLOWED_EXCEPTIONS.size + " excepciones autorizadas."
);
