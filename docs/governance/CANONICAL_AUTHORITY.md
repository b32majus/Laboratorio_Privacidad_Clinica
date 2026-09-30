# Canonical repository governance (T25 #29)

Status: **CURRENT**

## 1. Canonical branch

- The canonical integration branch is **`3.0-main`** (the repository default).
- This train's work branch is `work/overnight-t22-t25-20260930`, based on
  `3.0-main@758acf6546b6c579e1882c743477a04d1cb96f90` (T21 #25, PR #45).
- Renaming the branch or changing the GitHub default branch is a REMOTE,
  human-owned action (see §4) — the branch NAME is historical, not a version
  claim: the product generation is V4 (see `README.md`, §Version).

## 2. Version alignment (GOV-003)

| Surface | Value |
|---|---|
| Product generation / user-facing version | **v4.0** (`README.md`) |
| `package.json` `version` | **4.0.0** |
| Runtime (`PrivacyProcessor.getVersion()`) | `4.0.0-modular` (already 4.0.0) |
| Specs | `docs/specs/SPEC_V4_*.md` (accepted V4 authority) |

Historical version narratives (v1/v3) in `README.md` are preserved as
history, clearly separated from the current v4.0 section.

## 3. Required checks / CI gates (documented authority)

Enforced in-repo (`.github/workflows/ci.yml`) and locally via `npm test`:

1. `check:links` — no broken local HTML references;
2. `check:storage` (+ self-test) — no sessionStorage/localStorage in
   production sources;
3. `check:external` (+ self-test) — zero unexpected external runtime
   resources on the clinical origin;
4. `check:vendor` — vendored lib/fonts byte integrity (sha256 manifest);
5. `check:pdfjs` (+ self-test) — `isEvalSupported: false` guard
   (CVE-2024-4367);
6. `check:smoke` — end-to-end anonymization smoke;
7. `check:positioning` — no unsupported claims on every user-visible
   surface;
8. `test:domain` — ReviewSession contract tests;
9. `test:privacy-eval` + `check:privacy-eval` — ground-truth precision/
   recall gates (100/100 thresholds enforced);
10. `test:benchmarks` + `bench:engine:selftest` — benchmark corpus
    determinism and coverage gate (T22);
11. `check:headers:selftest` + `check:preview:selftest` — deployment
    header/config oracle self-tests (T24);
12. `test:v4` — 850 vitest unit/integration tests;
13. `test:e2e` — Playwright critical contracts against the production
    build; `test:e2e:preview` — the same under the deployed headers;
14. `typecheck:v4`, `lint:v4`, `format:check:v4`;
15. CodeQL (`.github/workflows/codeql.yml`).

## 4. Remote governance actions — human-owned handoff (GOV-002)

The following require GitHub repository permissions that unattended
execution does not hold; they are recorded as the publication/governance
handoff and remain open until the human performs or authorizes them:

- enable branch protection on `3.0-main` with the required checks above;
- confirm/enforce the default branch;
- any ruleset/reviewer-settings mutation.

No remote mutation was performed during the train (no branch deletion, no
force-push, no settings change), per the LOCAL_ONLY execution boundary.
