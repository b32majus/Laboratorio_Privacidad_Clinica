# Issue #80 — Cora integrated audit correction #2 (FINAL) — C-087

Status: **AUTHORIZED_BOUNDED_CORRECTION / LOCAL_ONLY**

## Execution identity and budget

- Issue: **#80 — [REC-08] Direct human input start: examples, Pegar and quiet routing**.
- Canonical preparation fixed point: `efb57c21987aac6a9914c82ea577a9838ee708fb`.
- Last audited product candidate: **`a9b8809dda329652cb39d2fc2a61c1c18c1e5c91`**.
- This correction handoff is a documentary child of that candidate. The **fixed correction execution anchor** is the sealed HEAD supplied explicitly in the operator launch prompt.
- Route: **cost_policy=go; risk_class=complex; visible coordinator=`atenea-go`**.
- Authorized worker: **one fresh `atenea-corrector-go-complex`** (`opencode-go/deepseek-v4.1-flash`), a different model from the Muse Go writer.
- **Correction attempt #2 of 2 maximum.** Attempt #1 closed the original Spec F1/F2. No attempt #3.
- Already completed: writer, **exactly one** canonical Standards + Spec review, correction #1, Cora's independent integrated audit.
- No writer restart, no canonical Standards/Spec re-review, no new discovery or model fallback.
- **Publication: LOCAL_ONLY** — no push/PR/merge/issue mutation/deploy.

## Sole scope: close two Cora audit findings

### CORA-80-01 — late Clipboard read overwrites a newer draft

**Location observed:** `app-v4/src/App.tsx`, `InputStep.handlePaste` calling the existing local `readTextFromClipboard()` helper.

Cora's independent **production-build Chromium** witness:
1. Start “Pegar desde el portapapeles”, leave `navigator.clipboard.readText()` pending.
2. While waiting, type `TEXTO NUEVO ESCRITO POR EL USUARIO` in the textarea.
3. Resolve the pending clipboard promise with `LECTURA ANTIGUA DEL PORTAPAPELES`.
4. The current candidate incorrectly replaces the user's newer text with the old clipboard response.

**Required correction:** the pending clipboard operation may fill the draft only if the draft still holds the same user authority it had when the read started. A later user edit (typing, example selection or other draft replacement) revokes that response's ability to write. No silent overwrite. Successful current reads still fill the ordinary pasted-text draft, without creating/submitting a Job. Permission denial or unavailable clipboard still shows the accepted Spanish Ctrl+V fallback without exposing raw errors. Do not add a new storage/network route or a second clipboard authority. The exact stale-invalidation mechanism is implementation-owned.

**Required falsifiable evidence:**
- A controllable pending `readText()`: user edits textarea, then old read resolves → final draft remains the user's newer text.
- A pending `readText()`: user chooses a synthetic example, then old read resolves → final draft remains the selected example.
- A non-stale successful read still populates the draft, without creating a Job.
- Denial/unavailable clipboard remains Spanish, shows Ctrl+V and exposes no raw platform exception or network/storage side effect.
- Preserve the other accepted input controls, jobs and policies.

### CORA-80-02 — non-file drop erases staged files

**Location observed:** `app-v4/src/App.tsx`, `InputStep` files card `onDrop`.

Cora's independent **production-build Chromium** witness:
1. Select `sintetico.txt`; UI shows `1 archivo seleccionado`.
2. Dispatch a drop with plain text in `DataTransfer` but **zero files**.
3. The current candidate transforms `dataTransfer.files` to `[]` and replaces the staged selection, silently losing `sintetico.txt`.

**Required correction:** a drop without files must not replace, clear or reorder an existing staged file selection. Real non-empty file drops still converge on the canonical selection path, preserve ordering, and are subsequently subject to the same fail-closed routing/format checks as ordinary file selection. Do not expand accepted formats, silently drop unsupported inputs or add a second Job/extension classifier. Exact event-handling mechanism is implementation-owned.

**Required falsifiable evidence:**
- Stage `sintetico.txt` via selection; drop text-only `DataTransfer` (zero files) → original file remains staged, same count/name/order and no Job creation.
- Valid non-empty file drop still stages the exact files in order; selection and drop still converge.
- Mixed document+structured and legacy `.doc` stay refused.
- Reproduce at least the original negative case in a real/browser-capable interaction witness (not just a static attribute assertion).

## Authority and prohibited scope

- Keep the original accepted hardening handoff `docs/handoffs/ISSUE80_DIRECT_INPUT_START_C087_HARDENED_20261007.md` authoritative for all unchanged product decisions.
- D-019 is explicitly **HUMAN-RATIFIED `DELIBERATELY_SUPERSEDED`**: no generic pipeline override.
- Preserve `inferJobKind`, `createJob`, `ReviewSession`, policy IDs/semantics, extraction authority and accepted formats `.txt,.pdf,.docx,.csv,.xls,.xlsx`; `.doc` remains unsupported.
- Preserve synthetic example contents from `ejemplos/*.json`, Safe/Confidential outputs, policy guidance, warning/confirmation, and work under #81–#85 / REC-10 / REC-11.
- No dependency additions/upgrades.
- **Conditional product-fidelity safeguards**: input representation/cardinality preservation ACTIVE; a changed shared seam gets only its known relevant consumer regression; adversarial pending-async/non-file-drop witnesses ACTIVE; rendered composed-product check applies only to the two affected input interactions.
- **Open material product questions: NONE**. This is a correctness correction, not shaping.

## Execution and evidence budget

- Dispatch **exactly one fresh** Go Complex corrector. Do not invoke implementer or fresh Standards/Spec reviewers.
- Add tests that would fail at `a9b8809` before the fix for the two concrete adversaries; show they pass after.
- Reuse `app-v4/src/App.input-start.test.tsx`, the browser `e2e/input-start.spec.ts` and existing focused tests before inventing new fixtures.
- Run focused tests for Pegar/drop and affected App input behavior; `typecheck:v4`, lint/format on affected sources. A focused production-build browser witness for the two original adversaries is required.
- Do not spend the corrector phase on a full repository suite or full E2E suite without a concrete change-induced reason.
- Report changed-file inventory, test results, real-browser negative evidence, final SHA, and clean tree.
- Report each Cora finding as **closed with evidence** or **not closed**. Do not assert GO on behalf of Cora.

## Hard STOP

- If one/both findings cannot be closed within this attempt, return **HUMAN STOP**, no further correction dispatch.
- STOP on new material product/privacy/architecture decisions, authority conflict, model unavailability/material incapability, broad scope expansion, or publication pressure.
- Any new independent sibling defect discovered outside the exact two findings is reported, not silently absorbed.

**Return one bounded C-087 closeout, `Publication: LOCAL_ONLY`, then STOP for Cora's final integrated re-audit.**
