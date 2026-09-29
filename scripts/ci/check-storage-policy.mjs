import fs from "fs";
import os from "os";
import path from "path";

// Storage-policy guard.
//
// Two independent rules:
//
// 1. LEGACY rule (unchanged since T06): the historic sensitive-payload
//    patterns (clinical text / batch results) must not appear in repository
//    sources, with the documented legacy whitelist.
// 2. V4 PRODUCTION rule (T17 #21 SD-10a, debt BATCH-002): no V4 production
//    source under `app-v4/src` may reference `sessionStorage` or
//    `localStorage` at all. The scan covers `.ts`/`.tsx`, EXCLUDING `*.test.*`
//    files and the `app-v4/src/testing` directory; a violation exits non-zero
//    naming file + line.
//
// `--self-test` runs a deterministic in-process oracle: known-good production
// file passes, a planted `sessionStorage` reference fails, the test/testing
// exclusions hold, the legacy rules still fire, and the real repository stays
// clean. It exits 0 only when every case behaves as expected.
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

const LEGACY_EXTENSIONS = [".html", ".js", ".mjs", ".md"];
const V4_SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const V4_STORAGE_TOKENS = ["sessionStorage", "localStorage"];
const V4_TEST_FILE_PATTERN = /\.test\.(ts|tsx)$/;

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

/** Legacy sensitive-payload patterns (whitelist preserved exactly). */
function collectLegacyViolations(rootDir) {
  const files = getAllFiles(rootDir).filter((file) =>
    LEGACY_EXTENSIONS.some((extension) => file.endsWith(extension))
  );

  const violations = [];
  for (const filePath of files) {
    const relPath = path.normalize(path.relative(rootDir, filePath));
    if (allowedFiles.has(relPath)) continue;

    const content = fs.readFileSync(filePath, "utf8");
    for (const pattern of forbiddenPatterns) {
      if (content.includes(pattern)) {
        violations.push({ file: relPath, pattern });
      }
    }
  }
  return violations;
}

/**
 * V4 production storage scan (T17 #21 SD-10a): ANY sessionStorage/localStorage
 * reference in app-v4/src production sources. Test files and the dedicated
 * app-v4/src/testing helper directory are excluded (they legitimately spy on
 * storage to prove it stays empty).
 */
function collectV4StorageViolations(rootDir) {
  const v4Src = path.join(rootDir, "app-v4", "src");
  if (!fs.existsSync(v4Src)) return [];

  const violations = [];
  for (const filePath of getAllFiles(v4Src)) {
    const relParts = path.relative(rootDir, filePath).split(path.sep);
    const inTestingDir =
      relParts.length >= 3 &&
      relParts[0] === "app-v4" &&
      relParts[1] === "src" &&
      relParts[2] === "testing";
    if (inTestingDir) continue;
    if (!V4_SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) continue;
    if (V4_TEST_FILE_PATTERN.test(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf8").split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      for (const token of V4_STORAGE_TOKENS) {
        if (lines[lineIndex].includes(token)) {
          violations.push({
            file: relParts.join("/"),
            line: lineIndex + 1,
            token
          });
        }
      }
    }
  }
  return violations;
}

function reportViolations(legacyViolations, v4Violations) {
  if (legacyViolations.length > 0) {
    console.error("Violaciones de politica de almacenamiento sensible:");
    for (const violation of legacyViolations) {
      console.error("- " + violation.file + " -> " + violation.pattern);
    }
  }
  if (v4Violations.length > 0) {
    console.error(
      "Violaciones de almacenamiento en fuentes de produccion V4 (app-v4/src, sin tests ni testing/):"
    );
    for (const violation of v4Violations) {
      console.error("- " + violation.file + ":" + violation.line + " -> " + violation.token);
    }
  }
}

/**
 * Deterministic self-test (QUALITY §3.5): known-good + planted violation +
 * exclusions + legacy rules + real repo. Runs entirely in a throwaway sandbox
 * under the OS temp dir and cleans up afterwards. Returns 0 only on success.
 */
function runSelfTest() {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "check-storage-policy-selftest-"));
  const cases = [];
  const addCase = (name, pass, detail) => cases.push({ name, pass, detail });

  const writeCase = (caseName, files) => {
    const caseRoot = path.join(sandboxRoot, caseName);
    for (const [relativePath, content] of Object.entries(files)) {
      const absolute = path.join(caseRoot, relativePath);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, content, "utf8");
    }
    return caseRoot;
  };

  try {
    // Case 1: known-good production-style file passes.
    {
      const caseRoot = writeCase("case-01-clean", {
        "app-v4/src/domain/clean.ts": `export const value = 1;\n`
      });
      const violations = collectV4StorageViolations(caseRoot);
      addCase(
        "case-01 clean production file passes",
        violations.length === 0,
        violations.map((v) => `${v.file}:${v.line}:${v.token}`).join("; ") || "ok"
      );
    }

    // Case 2: planted sessionStorage reference fails, naming file + line.
    {
      const caseRoot = writeCase("case-02-planted-session", {
        "app-v4/src/leak/leak.ts":
          'export function leak(): void {\n  sessionStorage.setItem("x", "y");\n}\n'
      });
      const violations = collectV4StorageViolations(caseRoot);
      const expectedFile = "app-v4/src/leak/leak.ts";
      const pass =
        violations.length === 1 &&
        violations[0].file === expectedFile &&
        violations[0].line === 2 &&
        violations[0].token === "sessionStorage";
      addCase(
        "case-02 planted sessionStorage reference fails with file+line",
        pass,
        violations.map((v) => `${v.file}:${v.line}:${v.token}`).join("; ") || "clean (unexpected)"
      );
    }

    // Case 3: planted localStorage reference fails.
    {
      const caseRoot = writeCase("case-03-planted-local", {
        "app-v4/src/leak/leak.ts":
          'export function leak(): void {\n  localStorage.setItem("x", "y");\n}\n'
      });
      const violations = collectV4StorageViolations(caseRoot);
      addCase(
        "case-03 planted localStorage reference fails",
        violations.length === 1 && violations[0].token === "localStorage",
        violations.map((v) => `${v.file}:${v.line}:${v.token}`).join("; ") || "clean (unexpected)"
      );
    }

    // Case 4: *.test.* files are excluded (they spy on storage legitimately).
    {
      const caseRoot = writeCase("case-04-test-file", {
        "app-v4/src/leak/leak.test.ts":
          'expect(window.sessionStorage.length).toBe(0);\nconst spy = vi.spyOn(window.localStorage, "setItem");\n'
      });
      const violations = collectV4StorageViolations(caseRoot);
      addCase(
        "case-04 *.test.* files are excluded",
        violations.length === 0,
        violations.map((v) => `${v.file}:${v.line}:${v.token}`).join("; ") || "ok"
      );
    }

    // Case 5: the app-v4/src/testing directory is excluded.
    {
      const caseRoot = writeCase("case-05-testing-dir", {
        "app-v4/src/testing/helpers.ts":
          'export const spies = [sessionStorage, localStorage];\n'
      });
      const violations = collectV4StorageViolations(caseRoot);
      addCase(
        "case-05 app-v4/src/testing is excluded",
        violations.length === 0,
        violations.map((v) => `${v.file}:${v.line}:${v.token}`).join("; ") || "ok"
      );
    }

    // Case 6: the legacy sensitive-payload rule still fires.
    {
      const caseRoot = writeCase("case-06-legacy", {
        "js/legacy-session.js":
          'function persist(text) {\n  localStorage.setItem(\'clinicalText\', text);\n}\n'
      });
      const violations = collectLegacyViolations(caseRoot);
      const pass =
        violations.length >= 1 &&
        violations.some((v) => v.pattern.startsWith("localStorage.setItem('clinicalText'"));
      addCase(
        "case-06 legacy sensitive-payload pattern still fails",
        pass,
        violations.map((v) => `${v.file} -> ${v.pattern}`).join("; ") || "clean (unexpected)"
      );
    }

    // Case 7: a clean legacy file passes.
    {
      const caseRoot = writeCase("case-07-legacy-clean", {
        "js/legacy-clean.js": "export const value = 1;\n"
      });
      const violations = collectLegacyViolations(caseRoot);
      addCase(
        "case-07 clean legacy file passes",
        violations.length === 0,
        violations.map((v) => `${v.file} -> ${v.pattern}`).join("; ") || "ok"
      );
    }

    // Case 8: the real repository satisfies both rules.
    {
      const legacy = collectLegacyViolations(repoRoot);
      const v4 = collectV4StorageViolations(repoRoot);
      const detail = [...legacy.map((v) => `${v.file} -> ${v.pattern}`), ...v4.map((v) => `${v.file}:${v.line}:${v.token}`)];
      addCase(
        "case-08 real repo is clean for both rules",
        legacy.length === 0 && v4.length === 0,
        detail.join("; ") || "ok"
      );
    }
  } finally {
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  }

  let allPass = true;
  console.log("Self-test de check-storage-policy.mjs:");
  for (const testCase of cases) {
    if (!testCase.pass) allPass = false;
    console.log(`  [${testCase.pass ? "PASS" : "FAIL"}] ${testCase.name}`);
    if (!testCase.pass) console.log(`         ${testCase.detail}`);
  }

  let residue = false;
  try {
    fs.accessSync(sandboxRoot);
    residue = true;
  } catch {
    // Expected: sandbox removed.
  }
  if (residue) {
    allPass = false;
    console.log("  [FAIL] temp-residue: sandbox directory still exists after cleanup");
  } else {
    console.log("  [PASS] temp-residue: sandbox eliminado, sin residuos");
  }

  if (!allPass) {
    console.error("SELF-TEST: FALLO (al menos un caso no se comporto como se esperaba)");
    return 1;
  }
  console.log("SELF-TEST: OK (todos los casos se comportaron como se esperaba)");
  return 0;
}

if (process.argv.includes("--self-test")) {
  process.exit(runSelfTest());
}

const legacyViolations = collectLegacyViolations(repoRoot);
const v4Violations = collectV4StorageViolations(repoRoot);
reportViolations(legacyViolations, v4Violations);

if (legacyViolations.length > 0 || v4Violations.length > 0) {
  process.exit(1);
}

console.log(
  "OK: politica de almacenamiento sensible verificada (legacy + V4 app-v4/src sin sessionStorage/localStorage)."
);
