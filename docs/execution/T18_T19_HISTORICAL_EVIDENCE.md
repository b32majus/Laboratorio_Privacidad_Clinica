# T18 #22 / T19 #23 — historical evidence reconciliation (factual only)

Status: **HISTORICAL FACTUAL RECORD — NOT CURRENT PLANNING AUTHORITY**
Owner debt: `DOC-002` (issue #43, A5)  
Scope: factual record only — **no retrospective evidence reconstruction**

## Fact

`odd/tasks/` preserves execution-evidence documents for T08, T11, T12, T13,
T14, T15, T16, T17 and T20. It contains **no task document for T18 #22 and no
task document for T19 #23**. Those documents never existed; they are not
missing copies and will not be reconstructed here. This note records that
absence explicitly instead of fabricating history.

## Durable record that does exist

The accepted delivery for T18 #22 and T19 #23 is preserved by the real commits
and the real native-Gentle review lineages below (all commits are ancestors of
the canonical `3.0-main` lineage through PR #42):

| Ticket | Commit | Subject |
|---|---|---|
| T18 #22 | `dd8b5ec` | `feat(structured): consolidated CSV parser with quoted multiline fields` |
| T18 #22 | `852c564` | `feat(structured): distributed column profiling, fail-closed classification, single patient-ID authority and blank-preserving codification` |
| T18 #22 | `38209d1` | `feat(structured): Excel adapter with explicit sheet selection and serial-date normalization over governed same-origin SheetJS` |
| T18 #22 | `772304b` | `docs(debt): reconcile STRUCT-001/002/003/004/007/008/009 as resolved by V4/T18 #22` |
| T19 #23 | `2069585` | `feat(structured): date/age semantics primitives with age-at-event on the visit date and per-patient shift state` |
| T19 #23 | `28be710` | `feat(structured): accepted date/age policy mapping with per-patient longitudinal shift and fail-closed review dispositions` |
| T19 #23 | `2de7c7e` | `docs(debt): record non-blocking advisory findings from native Gentle review of T19 #23 WU-A/WU-B` |

Native-Gentle review lineages for T19 #23 (recorded in `docs/DEBT_REGISTER.md`
rows `STRUCT-010`/`STRUCT-011`):

- `review-a3f65f99fbe19ded` — T19 #23 WU-A, APPROVED + acknowledged/burned;
- `review-344d43e246e3772d` — T19 #23 WU-B, APPROVED + acknowledged/burned.

Durable work-order and provenance references: GitHub #22 (T18), #23 (T19) and
#43 (post-PR #42 promotion-audit debt, section A5), plus the debt rows
`STRUCT-001`–`STRUCT-009` and `STRUCT-005`/`STRUCT-006` for the delivered
semantics.

## Explicit non-claims

This note does not create, summarise or imply an `odd/tasks/t18-*.md` or
`odd/tasks/t19-*.md` artifact. It adds no retrospective evidence, no invented
review lineage and no reconstructed execution log. It only points at the
commits, review lineages and issues that already exist.
