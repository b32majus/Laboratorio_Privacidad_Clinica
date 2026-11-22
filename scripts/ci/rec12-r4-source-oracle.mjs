#!/usr/bin/env node
/**
 * REC-12 / #92 R4: deterministic source→matrix inventory sanity check.
 * IMPORTANT: verifies enumerated IDs and trace pointers, NOT behavioral recovery.
 * Stage-A's semantic reconciliation remains the human-reviewed README authority.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = process.cwd();
const text = (path) => readFileSync(`${root}/${path}`, "utf8");
const stage = text("docs/evidence/issue92-source-completeness/README.md");
const matrix = text("docs/audits/2026-10-recovery-traceability-matrix.md");
const ledger = JSON.parse(text("docs/evidence/issue92-b3/ledger.json"));
const r1 = text("docs/evidence/issue92-r1-reconciliacion-20261121/EVIDENCIA_POR_FILA.csv");

function section(start, end) {
  assert.ok(stage.includes(start) && stage.includes(end), "missing Stage A boundary");
  return stage.split(start, 2)[1].split(end, 2)[0];
}
function unique(items, expected, context) {
  assert.equal(items.length, expected, `${context} source count`);
  assert.equal(new Set(items).size, expected, `${context} duplicate`);
}
const known = new Set(
  [...matrix.matchAll(/^\| `([A-Z0-9]+(?:-[A-Z0-9]+)+)` \|/gm)].map((m) => m[1])
);
assert.equal(known.size, 151, "canonical 142 rows plus DISC-01/02 plus REC12-GAP-01..07");
// Section inventories: source ordering 98+54+42+12 = 206.
function materialRows(kind, start, end, expected) {
  const lines = section(start, end)
    .split("\n")
    .filter((line) => line.startsWith(`| ${kind}-`));
  const ids = lines.map((line) => /^\| ([^|]+) \|/.exec(line)?.[1]);
  assert.ok(ids.every(Boolean));
  unique(ids, expected, kind);
  for (const line of lines) {
    assert.match(line, /ROW|SUPERSEDED/, `${kind}: no classified row`);
    const pointers = [...line.matchAll(/`([A-Z0-9]+(?:-[A-Z0-9]+)+)`/g)].map((x) => x[1]);
    const recognized = pointers.some((pointer) => known.has(pointer));
    const grouped =
      line.startsWith("| S1-OPEN-04 |") &&
      line.includes("§A/§B rows group") &&
      line.includes("`FUNC-*`");
    const scope =
      line.startsWith("| S1-OPEN-08 |") &&
      line.includes("Matrix §D scope ruling") &&
      line.includes("FUTURE");
    assert.ok(recognized || grouped || scope, `missing trace ref: ${line.slice(0, 90)}`);
  }
  return ids.length;
}
const s1 = materialRows("S1", "## 2. Source 1", "## 3. Source 2", 98);
const s2 = materialRows("S2", "## 3. Source 2", "## 4. Source 3", 54);
const s3Block = section("## 4. Source 3", "## 5. Source 4");
const s4Block = section("### 5.1 PDR", "### 5.2 HPD");
const s3 = [...s3Block.matchAll(/^\| `(H-\d+)` \|/gm)].map((x) => x[1]);
const s4 = [...s4Block.matchAll(/^\| `(PDR-\d+)` \|/gm)].map((x) => x[1]);
unique(s3, 42, "S3 heritage");
unique(s4, 12, "S4 PDR");
for (const id of [...s3, ...s4]) assert.ok(known.has(id), `unmapped ${id}`);
assert.equal(s1 + s2 + s3.length + s4.length, 206);
// Matrix's three frozen sections and B3 ledger/R1 reconciliation must match exactly.
const bounds = ["## A.", "## B.", "## C.", "## D."].map((x) => matrix.indexOf(x));
assert.ok(bounds.every((n) => n >= 0));
const idsBySection = ["A", "B", "C"].map((_, i) =>
  [...matrix.slice(bounds[i], bounds[i + 1]).matchAll(/^\| `([A-Z]+-\d+)` \|/gm)].map((x) => x[1])
);
for (let i = 0; i < 3; i++) unique(idsBySection[i], [88, 42, 12][i], ["A", "B", "C"][i]);
assert.equal(ledger.rows.length, 142);
const ledgerIds = ledger.rows.map((row) => `${row.section}:${row.id}`);
unique(ledgerIds, 142, "B3 ledger");
const r1Ids = [...r1.matchAll(/^([ABC]),([^,]+),/gm)].map((x) => `${x[1]}:${x[2]}`);
unique(r1Ids, 142, "R1 evidence per row");
const canonicalIds = idsBySection.flatMap((arr, i) => arr.map((id) => `${"ABC"[i]}:${id}`));
assert.deepEqual(new Set(ledgerIds), new Set(canonicalIds), "B3 coverage != canonical rows");
assert.deepEqual(new Set(r1Ids), new Set(canonicalIds), "R1 coverage != canonical rows");
const gapIds = [...known].filter((id) => /^REC12-GAP-\d\d$/.test(id));
unique(gapIds, 7, "GAP §F");
for (let n = 1; n <= 7; n++) assert.ok(known.has(`REC12-GAP-0${n}`));
for (let n = 1; n <= 2; n++) assert.ok(known.has(`DISC-0${n}`));
console.log(
  "REC-12 R4 SOURCE_ORACLE PASS: Stage A S1 98 + S2 54 + S3 42 + S4 12 = 206 material IDs; frozen matrix A 88 + B 42 + C 12 = 142, B3 ledger/R1 all match; F seven gaps + E two debts; source pointers present. NOT a proof of behavioral/semantic recovery."
);
