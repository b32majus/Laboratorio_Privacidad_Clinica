/** Executable source-row accounting, NOT automatic proof of recovered behavior. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const source = readFileSync(
  resolve(root, "docs/audits/2026-10-recovery-traceability-matrix.md"),
  "utf8"
);
const ledgerPath = resolve(root, "docs/evidence/issue92-b3/ledger.json");
const patterns = [/^## A\./m, /^## B\./m, /^## C\./m, /^## D\./m];
const boundaries = patterns.map((p) => source.search(p));
assert(boundaries.every((x) => x >= 0));
function rows(a, b) {
  return source
    .slice(boundaries[a], boundaries[b])
    .split("\n")
    .map((line) => /^\| `([^`]+)` \|/.exec(line)?.[1])
    .filter(Boolean);
}
const canonical = { A: rows(0, 1), B: rows(1, 2), C: rows(2, 3) };
const expected = { A: 88, B: 42, C: 12 };
const testWitnessSuffix = /\.(?:(?:test|spec)\.(?:[cm]?[jt]sx?)|mjs)$/;
test("B3 has exactly the frozen source IDs; counts alone are not a verdict", () => {
  for (const section of Object.keys(expected)) {
    assert.equal(canonical[section].length, expected[section], section);
    assert.equal(new Set(canonical[section]).size, expected[section], section);
  }
});
test("B3 ledger accounts for EVERY frozen row; evidence refs exist and unsupported PASS forbidden", () => {
  // A name containing ".spec." is not necessarily an actual spec file.
  assert.ok(testWitnessSuffix.test("e2e/rec12-b3-witness.spec.ts"));
  assert.ok(testWitnessSuffix.test("scripts/ci/check-storage-policy.mjs"));
  assert.equal(testWitnessSuffix.test("docs/spoof.spec.backup"), false);
  assert.equal(testWitnessSuffix.test("docs/spoof.test.ts.backup"), false);
  assert.ok(existsSync(ledgerPath), "B3 ledger has not been created");
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  assert.equal(ledger.source_sha, "184acc6d36b4e97a86bd6ba4153c92525a0135f0");
  assert.ok(Array.isArray(ledger.rows));
  assert.equal(ledger.rows.length, 142);
  const ids = new Set();
  const classes = new Set([
    "EXISTING_WITNESS_REUSE",
    "TARGETED_WITNESS",
    "PENDING_COMPOSED",
    "PENDING_HUMAN",
    "POST_RECOVERY_DEBT",
    "HUMAN_SUPERSEDED",
  ]);
  for (const row of ledger.rows) {
    assert.ok(["A", "B", "C"].includes(row.section));
    assert.ok(canonical[row.section].includes(row.id), `unrecognized ${row.id}`);
    const key = `${row.section}:${row.id}`;
    assert.ok(!ids.has(key), `duplicate ${key}`);
    ids.add(key);
    assert.ok(classes.has(row.disposition), `invalid evidence status: ${key}`);
    assert.ok(
      typeof row.reason === "string" && row.reason.trim().length > 14,
      `missing reason ${key}`
    );
    assert.ok(Array.isArray(row.evidence), `missing evidence array ${key}`);
    for (const witness of row.evidence) {
      assert.ok(typeof witness === "string" && witness.includes("/"));
      assert.ok(!witness.includes(".."));
      assert.ok(existsSync(resolve(root, witness)), `missing witness ${key}: ${witness}`);
    }
    if (row.disposition === "TARGETED_WITNESS" || row.disposition === "EXISTING_WITNESS_REUSE") {
      assert.ok(row.evidence.length > 0, `claimed witness without evidence ${key}`);
      assert.ok(
        row.evidence.some((f) => testWitnessSuffix.test(f)),
        `claimed witness is only documentation: ${key}`
      );
    }
    if (row.disposition === "HUMAN_SUPERSEDED") {
      assert.ok(
        row.evidence.some((f) => /CURRENT_DECISIONS|reconciliation|MATRIX|matrix/i.test(f)),
        `supersession without explicit authority ${key}`
      );
    }
  }
  assert.equal(ids.size, 142);
});
