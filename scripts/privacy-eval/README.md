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
npm run check:privacy-eval  # evaluate the engine against the corpus (CI gate)
```

The evaluator prints a deterministic JSON report (no timestamps, session ids or
random values) plus a one-line summary. Exit code `0` = gate pass; `1` = gate
fail **or** invalid corpus/config (fail-closed, D-009).

Options: `--corpus-dir=<dir>` (default `scripts/privacy-eval/corpus`),
`--config=<file>` (default `scripts/privacy-eval/config.json`),
`--report=<file>` (also write the JSON report to a file).

## Corpus schema

Each case file (JSON, UTF-8):

| Field | Meaning |
| --- | --- |
| `schema_version` | Corpus schema version (currently `1`). |
| `corpus_version` | Must match `manifest.json`. |
| `case_id` | Unique identifier. |
| `tier` | `core` (gates CI) or `adversarial` (reported as known gaps, never gates). |
| `source` | Provenance (mapped example or original synthetic text). |
| `text` | Synthetic clinical text. |
| `annotations` | Ground-truth expectations, independent of recognizer code. |

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

## Known gap tracked explicitly

The quasi-identifier phrase `único paciente` in the mapped example 004 is not
surfaced by the current engine. Per fail-closed discipline it is neither
annotated into the gated tier (which would require recognizer semantics changes
— out of scope for T02) nor marked `MUST_KEEP` (which would contradict its
privacy meaning). It is recorded in the notes of cases `004` and `902`.
