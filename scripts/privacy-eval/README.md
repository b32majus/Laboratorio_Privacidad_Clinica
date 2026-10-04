# Ground-truth privacy regression harness (V4/T02)

Versioned synthetic annotated corpus plus a deterministic evaluator for privacy
detections, per `docs/specs/SPEC_V4_QUALITY_SECURITY_DEPLOY.md` §1 (Ground-truth
privacy corpus) and GitHub issue #6 (`[V4/T02]`).

All corpus content is **synthetic**. Cases 001–004 map the pre-existing synthetic
examples in `ejemplos/*.json` (already committed to this repository); no real PHI
is used anywhere.

## Run

```bash
npm run test:privacy-eval   # unit tests for the matching/metrics logic
npm run check:privacy-eval  # evaluate the legacy engine against the corpus (CI gate)
npm run check:privacy-eval:v4  # evaluate the productive V4 engine + AGE (CI gate)
```

## V4 ground-truth gate (HARDEN-02 WU-A; FUNC-008/QA-001)

The legacy evaluator above runs `js/modular-processor.js`, whose taxonomy has
no AGE category, so it cannot supply deterministic ground-truth evidence for
the V4 age generalization. The companion gate
`app-v4/src/engine/ground-truth/` evaluates the REAL productive V4 engine
(`createRegistryEngine`) over a versioned synthetic annotated V4 corpus,
**reusing this directory's matching and metrics logic verbatim** (no metric
fork). It covers the full `RECOGNIZER_CATEGORIES` taxonomy plus AGE, asserts
exact AGE spans and accepted banded output, and carries planted falsation
that proves the gate can fail. The legacy corpus and evaluator remain in
place (useful regression coverage); the V4 gate is an additive CI step.

The evaluator prints a deterministic JSON report (no timestamps, session ids or
random values) plus a one-line summary. Exit code `0` = gate pass; `1` = gate
fail **or** invalid corpus/config (fail-closed, D-009).

### Coverage contract (REC-01 WU-A)

`coverage.json` declares, per top-level type, the meaningful slices that must
have machine-visible support plus a minimum distinct-case floor, and the
language/style slices the corpus as a whole must exhibit. `evaluateV4GroundTruth`
reports per-type/per-slice support (derived F1 included) and fails closed
(`report.pass === false`) when a declared unit has zero support or a type
collapses below the floor; unknown slices/styles and malformed manifests raise
the typed `V4GroundTruthError`. Coverage is not a precision/recall threshold and
does not modify `config.json`.

The REC-01 WU-B expanded corpus declares every required unit, so the coverage
dimension is green (`failures: [] / pass: true`). Narrowing the manifest is
fail-closed: a type/slice/style that the corpus still exercises but
`coverage.json` no longer declares is a coverage failure, so a required
declaration cannot disappear silently (REC-01 F1).

Options: `--corpus-dir=<dir>` (default `scripts/privacy-eval/corpus`),
`--config=<file>` (default `scripts/privacy-eval/config.json`),
`--report=<file>` (also write the JSON report to a file).

## Corpus schema

Each case file (JSON, UTF-8):

| Field            | Meaning                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `schema_version` | Corpus schema version (currently `1`).                                    |
| `corpus_version` | Must match `manifest.json`.                                               |
| `case_id`        | Unique identifier.                                                        |
| `tier`           | `core` (gates CI) or `adversarial` (reported as known gaps, never gates). |
| `source`         | Provenance (mapped example or original synthetic text).                   |
| `text`           | Synthetic clinical text.                                                  |
| `annotations`    | Ground-truth expectations, independent of recognizer code.                |

Annotation fields: `label`, `entity_type`, `value`, optional `note`.

### Labels

- `MUST_REMOVE` — spec bucket "MUST_REMOVE / transform": the span must be
  detected and transformed. Satisfied **only** by an entity detection; if it
  merely appears on the low-confidence flagged surface it counts as missed and
  is reported under `flagged_only`.
- `MUST_KEEP` — false-positive expectation: any detection covering that value
  is reported as `must_keep_violation`. Clinical content that must never be
  flagged.
- `MUST_FLAG_FOR_REVIEW` — the span must be surfaced for human review: satisfied
  by an entity detection **or** by the low-confidence flagged surface
  (decision D-008: low-confidence candidates remain visible, never silent).

### Taxonomy

Entity types follow the privacy-engine detection categories: `NOMBRE`,
`IDENTIFICADOR`, `FECHA`, `UBICACION`, `SOSPECHOSO`.

## Matching rules (deterministic)

1. Text comparison normalizes case, diacritics and whitespace.
2. Phase 1 (exact): each positive annotation (`MUST_REMOVE`,
   `MUST_FLAG_FOR_REVIEW`) first claims a detection whose normalized text is
   exactly equal and whose entity type matches.
3. Phase 2 (containment): unmatched annotations may claim a detection by
   normalized containment. This tolerates honorifics (`Dr. Juan Martínez
Sánchez` covers `Juan Martínez Sánchez`) and partial spans (`654 321 987`
   inside `+34 654 321 987`).
4. Undetected positive annotations → false negatives. If a `MUST_REMOVE` value
   only appears in the flagged surface → false negative plus `flagged_only`
   entry.
5. Unmatched entity detections → false positives
   (`must_keep_violation` or `unexpected_detection`).
6. Unmatched flagged (low-confidence) items are reported under
   `unmatched_flagged` but are **not** false positives: they never remove the
   value from the output and must not inflate precision penalties.

## Metrics and gate

Per entity type and overall: `precision = TP/(TP+FP)`,
`recall = TP/(TP+FN)`, `false_negative_rate = FN/(TP+FN)`. TP/FN are attributed
by annotation entity type; FP by detection type.

`config.json` pins the current baseline of the gated core tier. The corpus is
small by design, so a single regression is visible (any dropped or spurious
detection fails the gate). The evaluator fail-closes if an entity type appears
in the gated corpus without configured thresholds (taxonomy drift cannot hide
regressions).

## Adversarial tier

Cases `901`/`902` are the required adversarial false-negative fixtures:
obfuscated identifier formats and contextual quasi-identifiers that the current
engine misses. They are evaluated and reported (`adversarial` section of the
report) but do **not** gate CI: the corpus must remain a known passing corpus
today, and promoting adversarial annotations into the gated tier is a
privacy-engine decision under a separate ticket, not a harness decision.

Case `100` is the false-positive guard in the gated tier: clinical content with
no identifiers, where any detection fails CI.

## Resolved gap

The quasi-identifier phrase `único paciente` in the mapped example 004 is now
surfaced. REC-01 corrected the singularity cue boundary so the accented /
sentence-initial form matches, so case `004` now carries the
`MUST_FLAG_FOR_REVIEW` expectation in the gated tier and case `902` records
the resolution. The cue detection was narrowed, not weakened: ordinary
accented clinical text (`Ácido úrico…`, `Tratamiento único…`) is still not
flagged.
