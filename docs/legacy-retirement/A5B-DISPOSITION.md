# A5b disposition — minified vendored bundles (T25 #29)

Status: **FACTUAL RECORD of the retirement boundary for this candidate set.**

- `lib/jszip.min.js`: RETIRED (commit chain A5b-1, native review
  `review-5f09be875c697410` APPROVED + burned; one advisory WARNING about a
  hypothetical CommonJS consumer — no consumer exists outside the retired
  pages). Vendor manifest updated accordingly (19 entries).
- `lib/jspdf.umd.min.js` (364 KB minified) and `lib/mammoth.browser.min.js`
  (636 KB minified): the native review transport CANNOT review their
  deletion — `lens_context_budget_exceeded` for each single-file candidate
  (minified monoliths; immutable candidate evidence is never truncated).
  They remain in the repository, manifest-governed (`check:vendor` green),
  and are UNREFERENCED: the only pages that loaded them were retired in
  A1/A2/A4, so no execution path reaches them (inert bytes).
- Truthful disposition: deletion of these two bundles is deferred to a
  future human-supervised housekeeping work order (or an explicit manual
  review authorization outside the lens transport). Recorded as bounded
  debt; SEC-001's executable-path concern is resolved (nothing loads the
  mammoth bundle), while the inert file removal is deferred.

This file records the boundary honestly; no review was skipped, forced, or
fabricated.
