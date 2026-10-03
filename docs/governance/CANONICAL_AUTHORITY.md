# Canonical repository governance (T25 #29)

Status: **CURRENT**

## 1. Canonical branch

- The canonical V4 integration and Render deployment branch is **`3.0-main`**.
- Current accepted V4 checkpoint at the C-083 reconciliation: `3.0-main@0a7faa40da61d4bae80efe81ca0043d3627be669` (PR #50).
- GitHub's repository **default branch is still `main`** as of 2026-10-03. Do not infer the V4 execution base from the GitHub default; `main` is not the canonical V4 integration/deploy authority.
- Changing the GitHub default branch, renaming branches or deleting remote branches is a REMOTE, human-owned action (see §4). The `3.0-main` name is historical; the product generation is V4.

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
2. `check:storage` + `check:storage:selftest` — no sessionStorage/localStorage in production sources, with planted-violation falsation wired into CI;
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
12. `test:v4` — V4 vitest unit/integration suite (do not pin a stale test-count claim here);
13. `test:e2e` — Playwright critical contracts against the production
    build; `test:e2e:preview` — the same under the deployed headers;
14. `typecheck:v4`, `lint:v4`, `format:check:v4`;
15. CodeQL (`.github/workflows/codeql.yml`).

## 4. Remote governance actions — human-owned handoff (GOV-002)

The following require GitHub repository permissions that unattended
execution does not hold; they are recorded as the publication/governance
handoff and remain open until the human performs or authorizes them:

- enable branch protection on `3.0-main` with the required checks above;
- decide whether/when to change the GitHub default branch from `main` to the canonical V4 branch;
- any ruleset/reviewer-settings mutation.

No remote mutation was performed during the train (no branch deletion, no
force-push, no settings change), per the LOCAL_ONLY execution boundary.
