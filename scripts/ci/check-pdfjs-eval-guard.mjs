import fs from "fs";
import os from "os";
import path from "path";

// Deterministic guard for CVE-2024-4367 (pdf.js): every active getDocument()
// call site must pass isEvalSupported: false (upstream-supported fail-safe for
// the getDocument({ data }) default evaluation path).
//
// Scope: repo-root *.html, everything under js/, and every app-v4 source
// (*.ts/*.tsx/*.js/*.jsx/*.html under app-v4/), EXCLUDING node_modules, lib/
// and app-v4/public/ (vendored/served static bundles), dist/, scripts/ (the
// guard itself), *.d.ts ambient declarations and test files. Vendored pdf.js
// bundles are governed by sha256 (check:vendor), not by this call-site guard.
//
// Usage:
//   node scripts/ci/check-pdfjs-eval-guard.mjs [--root=<dir>]
//   node scripts/ci/check-pdfjs-eval-guard.mjs --self-test

const EXCLUDED_DIRS = new Set(["node_modules", "lib", "dist", "scripts", "public"]);
const TEST_FILE_PATTERN = /(\.test\.|\.spec\.)/;
const TEST_DIR_PATTERN = /^(__tests__|tests?|spec)$/;
const APP_V4_SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".html"]);

function parseArgs(argv) {
  let root = process.cwd();
  let selfTest = false;
  for (const arg of argv) {
    if (arg === "--self-test") {
      selfTest = true;
    } else if (arg.startsWith("--root=")) {
      root = path.resolve(arg.slice("--root=".length));
    }
  }
  return { root, selfTest };
}

function isTestPath(relativeParts, fileName) {
  return (
    TEST_FILE_PATTERN.test(fileName) ||
    relativeParts.some((part) => TEST_DIR_PATTERN.test(part))
  );
}

// Scanned files: top-level *.html at the scan root, every *.js under js/,
// and every app-v4 source (.ts/.tsx/.js/.jsx/.html under app-v4/).
function collectScanFiles(root) {
  const files = [];

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(path.join(root, entry.name));
    }
  }

  const walkSourceTree = (dir, relativeParts, extensions) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkSourceTree(absolute, [...relativeParts, entry.name], extensions);
      } else if (
        extensions.has(path.extname(entry.name).toLowerCase()) &&
        // Ambient declarations cannot contain active call sites.
        !entry.name.endsWith(".d.ts") &&
        !isTestPath(relativeParts, entry.name)
      ) {
        files.push(absolute);
      }
    }
  };

  const jsRoot = path.join(root, "js");
  if (fs.existsSync(jsRoot)) {
    walkSourceTree(jsRoot, [], new Set([".js"]));
  }

  const appV4Root = path.join(root, "app-v4");
  if (fs.existsSync(appV4Root)) {
    walkSourceTree(appV4Root, [], APP_V4_SOURCE_EXTENSIONS);
  }

  return files.sort();
}

// A getDocument( occurrence is treated as a call site unless it is a
// function/method DEFINITION (next non-whitespace after the balanced closing
// paren is "{", e.g. `getDocument(id) {`), which is unrelated to pdf.js.
function findGetDocumentCallSites(text) {
  const callSites = [];
  let index = text.indexOf("getDocument(");
  while (index !== -1) {
    let depth = 0;
    let close = -1;
    for (let i = index + "getDocument".length; i < text.length; i++) {
      const ch = text[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close !== -1) {
      const after = text.slice(close + 1).match(/^\s*(\S)/);
      if (!after || after[1] !== "{") {
        callSites.push({ startIndex: index, closeIndex: close });
      }
    }
    index = text.indexOf("getDocument(", index + 1);
  }
  return callSites;
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

function scanRoot(root) {
  const violations = [];
  for (const filePath of collectScanFiles(root)) {
    const text = fs.readFileSync(filePath, "utf8");
    for (const callSite of findGetDocumentCallSites(text)) {
      const callText = text.slice(callSite.startIndex, callSite.closeIndex + 1);
      if (!/isEvalSupported\s*:\s*false/.test(callText)) {
        violations.push(
          path.relative(root, filePath) +
            ":" +
            lineNumberAt(text, callSite.startIndex) +
            ": getDocument() sin isEvalSupported: false"
        );
      }
    }
  }
  return violations;
}

function fail(violations) {
  console.error("Violaciones del guard CVE-2024-4367 (getDocument sin isEvalSupported: false):");
  for (const violation of violations) {
    console.error("- " + violation);
  }
  process.exit(1);
}

function runSelfTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pdfjs-guard-selftest-"));
  const cases = [];
  try {
    // The scan scope is top-level *.html plus js/, so planted files go under js/.
    const planted = path.join(tempRoot, "js");
    fs.mkdirSync(planted, { recursive: true });
    // Case 1: getDocument WITHOUT isEvalSupported: false -> must be flagged.
    fs.writeFileSync(
      path.join(planted, "bad-call.js"),
      "async function load(buf) {\n  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;\n  return pdf;\n}\n"
    );
    // Case 2: getDocument WITH isEvalSupported: false -> must pass.
    fs.writeFileSync(
      path.join(planted, "good-call.js"),
      "async function load(buf) {\n  const pdf = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;\n  return pdf;\n}\n"
    );
    // Case 3: method DEFINITION named getDocument -> must not be flagged.
    fs.writeFileSync(
      path.join(planted, "definition.js"),
      "class BatchStore {\n  getDocument(id) {\n    return id;\n  }\n}\n"
    );
    // Case 4: whitespace variant of the option -> must pass.
    fs.writeFileSync(
      path.join(planted, "whitespace-variant.js"),
      "async function load(buf) {\n  const pdf = await pdfjsLib.getDocument({ data: buf, isEvalSupported :  false }).promise;\n  return pdf;\n}\n"
    );

    // T06 #10: the scan scope also covers app-v4 sources.
    const appV4Planted = path.join(tempRoot, "app-v4", "src", "input");
    fs.mkdirSync(appV4Planted, { recursive: true });
    // Case 5: app-v4-shaped getDocument call WITHOUT isEvalSupported: false
    // -> must be flagged.
    fs.writeFileSync(
      path.join(appV4Planted, "bad-app-call.ts"),
      "export async function loadPdf(buf: ArrayBuffer) {\n  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;\n  return pdf;\n}\n"
    );
    // Case 6: app-v4-shaped compliant call WITH the flag -> must pass.
    fs.writeFileSync(
      path.join(appV4Planted, "good-app-call.ts"),
      "export async function loadPdf(buf: ArrayBuffer) {\n  const pdf = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;\n  return pdf;\n}\n"
    );
    // Case 7: vendored bundle shape under app-v4/public must stay excluded
    // (governed by check:vendor sha256, not by this call-site guard).
    const vendorPlanted = path.join(tempRoot, "app-v4", "public", "vendor");
    fs.mkdirSync(vendorPlanted, { recursive: true });
    fs.writeFileSync(
      path.join(vendorPlanted, "pdf.min.js"),
      "function getDocument(src) { return { data: src }; }\n"
    );

    const rel = (...parts) => parts.join(path.sep);
    const violations = scanRoot(tempRoot);
    const badViolations = violations.filter((v) => v.startsWith(rel("js", "bad-call.js") + ":"));
    const goodViolations = violations.filter((v) => v.startsWith(rel("js", "good-call.js") + ":"));
    const definitionViolations = violations.filter((v) => v.startsWith(rel("js", "definition.js") + ":"));
    const whitespaceViolations = violations.filter((v) => v.startsWith(rel("js", "whitespace-variant.js") + ":"));
    const badAppViolations = violations.filter((v) =>
      v.startsWith(rel("app-v4", "src", "input", "bad-app-call.ts") + ":")
    );
    const goodAppViolations = violations.filter((v) =>
      v.startsWith(rel("app-v4", "src", "input", "good-app-call.ts") + ":")
    );
    const vendorViolations = violations.filter((v) => v.includes(rel("app-v4", "public", "vendor")));

    cases.push({
      name: "self-test: getDocument sin isEvalSupported: false debe fallar",
      pass: badViolations.length === 1 && badViolations[0].startsWith(path.join("js", "bad-call.js") + ":2:"),
      detail: badViolations.join("; ") || "sin violacion detectada",
    });
    cases.push({
      name: "self-test: getDocument con isEvalSupported: false debe pasar",
      pass: goodViolations.length === 0,
      detail: goodViolations.join("; ") || "ok",
    });
    cases.push({
      name: "self-test: definicion de metodo getDocument no debe marcarse",
      pass: definitionViolations.length === 0,
      detail: definitionViolations.join("; ") || "ok",
    });
    cases.push({
      name: "self-test: variante de espacios en isEvalSupported debe pasar",
      pass: whitespaceViolations.length === 0,
      detail: whitespaceViolations.join("; ") || "ok",
    });
    cases.push({
      name: "self-test: llamada con forma app-v4 sin isEvalSupported: false debe fallar",
      pass:
        badAppViolations.length === 1 &&
        badAppViolations[0].startsWith(rel("app-v4", "src", "input", "bad-app-call.ts") + ":2:"),
      detail: badAppViolations.join("; ") || "sin violacion detectada",
    });
    cases.push({
      name: "self-test: llamada con forma app-v4 con isEvalSupported: false debe pasar",
      pass: goodAppViolations.length === 0,
      detail: goodAppViolations.join("; ") || "ok",
    });
    cases.push({
      name: "self-test: bundle vendido bajo app-v4/public debe quedar excluido del guard",
      pass: vendorViolations.length === 0,
      detail: vendorViolations.join("; ") || "ok",
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  let allPass = true;
  for (const testCase of cases) {
    console.log((testCase.pass ? "PASS" : "FAIL") + ": " + testCase.name);
    if (!testCase.pass) {
      console.error("  detalle: " + testCase.detail);
      allPass = false;
    }
  }
  process.exit(allPass ? 0 : 1);
}

const { root, selfTest } = parseArgs(process.argv.slice(2));

if (selfTest) {
  runSelfTest();
}

const violations = scanRoot(root);
if (violations.length > 0) {
  fail(violations);
}

console.log(
  "OK: todas las llamadas activas a getDocument() pasan isEvalSupported: false (guard CVE-2024-4367)."
);
