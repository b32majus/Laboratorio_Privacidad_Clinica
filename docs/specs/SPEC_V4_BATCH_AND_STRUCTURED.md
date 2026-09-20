# SPEC V4 — Batch and structured data

Status: **ACCEPTED**
Scope owner: multi-document + tabular workflows

## 1. Batch as a Job

Batch is not a separate premium application.

A batch Job owns every selected input with an explicit state:

```
queued | reading | processing | review-required | completed | error
```

A failed item remains visible in the batch and contributes to Privacy Gate readiness.

## 2. Storage

Do not serialize large original + processed + entities payloads into `sessionStorage` to move between pages.

Target V4 keeps active Job state in memory inside the SPA.

IndexedDB/job recovery is not part of the baseline migration unless separately specified.

## 3. Cross-document consistency

Shared consistency uses `ProcessingContext`.

No monkey-patching singleton methods.

Failure must not leave mutated global behavior for subsequent documents.

## 4. Document formats

Baseline supported:
- TXT;
- DOCX;
- text-bearing PDF.

Legacy `.doc` must not be advertised as supported unless a real parser/conversion path is implemented.

PDF extraction that yields no/insufficient text must report likely scan/no text layer. OCR is a later capability.

## 5. Structured classification

Every column is assigned one of:
- Identifier;
- Quasi-Identifier;
- Sensitive;
- Insensitive;
- Unknown / Review Required.

UNKNOWN is not KEEP.

The UI may propose a class/action with confidence, but the human must be able to review/change it.

## 6. Single patient ID authority

There is exactly one selected patient-ID column authority for a structured Job.

Do not maintain an independent global selector and separate conflicting per-column PATIENT_ID semantics.

## 7. Column profiling

Inference must sample multiple non-empty values distributed through the column, not only the first data row.

Expose:
- inferred type/class;
- confidence/evidence sufficient for review.

## 8. CSV

Use a consolidated parser that supports valid quoted multiline fields and delimiter escaping.

Do not maintain a line-splitting parser as production authority.

## 9. Excel

Requirements:
- sheet selection or explicit selected sheet;
- proper Excel serial-date normalization;
- preserve null/blank values as absence;
- do not CODIFY an empty value into a category.

## 10. Dates and age in structured data

A birth date converted to age uses the clinically relevant reference date when a visit/event date exists.

For external sharing, age/date transformation remains policy-driven (e.g. band/generalize/shift).

VISIT_DATE must not default to exact KEEP under an External AI policy.

## 11. Free-text columns

A structured free-text field can be routed through the text privacy engine using the same policy/ReviewSession concepts.

## 12. ARX-lite risk layer

Target later capability:
- quasi-identifier combinations;
- unique combinations/equivalence classes;
- factual risk indicators.

Do not label simple generalization as k-anonymity.

The first structured hardening ticket need not implement full risk analysis; classification foundations come first.

## 13. Export

Safe structured output and confidential correspondence are separate files.

Structured export must preserve:
- row ordering unless explicitly changed;
- empty values;
- typed values where practical;
- deterministic study IDs/mappings within the Job context.
