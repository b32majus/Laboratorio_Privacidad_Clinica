# Issue #106 — REC-08 / CORA-80-03 — stale Pegar vs file selection

Status: **READY_TO_LAUNCH** after fixed-point verification
Date: **2026-10-10**
Authority: [GitHub #106](https://github.com/b32majus/Laboratorio_Privacidad_Clinica/issues/106), separately human-authorized 2026-10-10.
Original blocked parent: [#80](https://github.com/b32majus/Laboratorio_Privacidad_Clinica/issues/80).

## Execution contract — NEW bounded unit, NOT correction #3

- Cost policy: **go** (human-selected for the REC-08 work lineage).
- Risk class: **complex** (temporal user-intent/async ordering and repeated semantic failure).
- Visible coordinator: **`atenea-go`**.
- Ordinary **`/implement`** for new issue #106: one fresh **`atenea-implementer-go`** / Muse writer, then **one canonical** independent Qwen Standards + Luna High Spec review, and only if needed issue-#106-specific fresh correction(s), max two per C-087.
- **DO NOT** invoke a third corrector for issue #80; that correction budget is exhausted.
- Accepted implementation starting SHA: **`b32fcc2d6fc029cb8f4ac5058c98dde01fccb323`** (clean, unmerged #80 product candidate).
- Worktree: `/srv/kairos-lab/qualification/laboratorio-issue106-cora80-03-stale-paste-go-20261010`.
- Branch: `work/issue106-cora80-03-stale-paste-go-20261010`.
- Fixed **pre-implementation** SHA: the single handoff/preparation commit at HEAD supplied by Cora's exact operator launch prompt.
- Canonical upstream provenance at preparation: `origin/3.0-main@04f1a351ad2a81a223e3019b2510f349ca74d974`.
- **Publication: LOCAL_ONLY** — no push/PR/merge/issue mutation/deploy by OpenCode.

## WHAT — only CORA-80-03

Cora independently reproduced this exact failed interleaving in a production build / Chromium:

1. Start `Pegar desde el portapapeles`; browser `readText()` is pending.
2. Select `sintetico.txt` via the canonical picker while the read is pending.
3. Resolve the **older** clipboard promise with `RESPUESTA ANTIGUA DEL PORTAPAPELES`.
4. Current incorrect behavior: selected file stays staged **and** old clipboard text is added; `Crear trabajo` then wrongly refuses mixed input.

**Accepted fixed behavior:** the newer file selection **invalidates the older pending clipboard result**. When the old promise resolves, the textarea remains empty, the chosen TXT remains staged unchanged, and clicking `Crear trabajo` produces a normal **Document job**. No Job may be created by the old paste, and no false mixed-input refusal may appear.

This exact boundary also applies to a **real nonempty file drop** that replaces the staged selection while clipboard read is pending. A zero-file drop remains ignored.

## WHERE / REUSE — sealed patch recipe

Do not investigate repository topology. The source and two test seams are already known:

1. `app-v4/src/App.tsx` → `InputStep` at the existing `draftRevisionRef` / `draftTextRef` / `handlePaste` logic.
2. `app-v4/src/App.input-start.test.tsx` → existing `deferred<string>()`, `stubClipboardRead`, `pegarButton()`, picker and `createButton()` helpers.
3. `e2e/input-start.spec.ts` → existing deferred clipboard `page.addInitScript`, `selectFiles(page, ...)`, and production `vite preview` fixture.

**Prescriptive minimal change — use this algorithm exactly unless it is mechanically impossible:**

In `InputStep`, adjacent to:

```ts
const draftRevisionRef = useRef(0);
const draftTextRef = useRef(props.draftText);
draftTextRef.current = props.draftText;
```

add:

```ts
const draftFilesRef = useRef(props.draftFiles);
draftFilesRef.current = props.draftFiles;
```

In `handlePaste`, snapshot before `setPasteBusy(true)`:

```ts
const authorityFiles = draftFilesRef.current;
```

Then after `await readTextFromClipboard()`, extend the **same existing** accepted authority predicate:

```ts
const draftStillHoldsCallerAuthority =
  draftRevisionRef.current === authorityRevision &&
  draftTextRef.current === authorityText &&
  draftFilesRef.current === authorityFiles;
```

If false, the existing `return` discards old bytes. The unchanged `finally` restores `pasteBusy=false`. Do not change the successful/current clipboard behavior or permission-denial Ctrl+V fallback.

**Why this is correct in the current source:** `handleDraftFiles(files)` already performs `setDraftFiles(files)`; real picker selection uses `Array.from(event.target.files)`, and nonempty drop uses `Array.from(event.dataTransfer.files)`. Both supply fresh array identity. Zero-file drop is ignored before invoking `onFilesDropped`. The snapshot detects selection **even if the text itself stays unchanged**. Selection A→B→A by user still has changed array identity. Neither files nor text need to be read or copied.

Never add a route selector, a second file store, new revision state machine, timers/polling, a network request, a new extension classifier, or a new Clipboard helper.

## PROOF — exact RED→GREEN plan

**First author tests only and show they fail against the old guard (`b32fcc2`). Then apply the three-source-line-sized product patch.**

A. **Component adversary: picker supersedes clipboard** (`App.input-start.test.tsx`).
- `read = deferred<string>()`; `stubClipboardRead(() => read.promise)`; `render(<App />)`.
- Click `pegarButton()`, then `fireEvent.change` on the existing file input with one `new File(['nota sintética'], 'sintetico.txt')`.
- Assert `1 archivo seleccionado` and empty textarea **before** resolution.
- `read.resolve('RESPUESTA ANTIGUA DEL PORTAPAPELES')`.
- **Wait until Pegar is enabled again** before the final assertion; do not accidentally pass an assertion made while the read is still pending.
- Assert textarea remains empty, selected item remains `sintetico.txt`, and shell says `No job yet`.
- Click `createButton()`, await shell text `Document job`; assert no mixed-mode `role=alert`.

B. **Production Chromium browser adversary** (`e2e/input-start.spec.ts`).
- Reuse the existing `page.addInitScript` pending `navigator.clipboard.readText` stub from CORA-80-01.
- Click Pegar; use **`selectFiles(page,{name:'sintetico.txt',mimeType:'text/plain',buffer:Buffer.from('NOTA SINTÉTICA')})`** before resolving.
- Confirm 1 staged file and empty textarea.
- Resolve stale read with `page.evaluate` using `__resolveClipboardRead`.
- **Wait for the Pegar button `aria-busy='false'`** (not only a premature textarea assertion).
- Assert empty textarea + one exact staged file; click Crear trabajo; await `banner` contains `Document job`; no mixed-refusal alert.
- This browser test must fail in the old candidate and pass after the code fix.

C. **Nonempty-drop variation**, smallest reuse of the existing DataTransfer/DragEvent fixture.
- Start pending paste; dispatch one accepted `.txt` file drop into `section[aria-labelledby='select-files-heading']`; resolve paste.
- Wait until paste finished; assert no stale text, exact file names/order preserved.
- Do not add a general async interaction matrix.

D. **Preservation evidence:** rerun existing CORA-80-01 typed, type→undo, example, non-stale Pegar, denied permission; CORA-80-02 zero-file + real-file drops; and accepted mixed/.doc fail-closed oracles. Use focused `vitest` + `e2e/input-start.spec.ts` + `typecheck:v4`, lint/format of changed source, diff check. Full suites default to publication.

No extra test framework, dependencies or unrelated snapshot regeneration.

## DO NOT TOUCH — explicit prohibition

Allowed implementation files: **only** `App.tsx` (`InputStep` guard), `App.input-start.test.tsx`, `e2e/input-start.spec.ts`.

Preserve byte-for-byte: `app-v4/src/domain/job.ts`, `app-v4/src/input/extract.ts`, `app-v4/src/output/clipboard.ts`, `app-v4/src/policy-guidance.ts`, `app-v4/src/useJobSession.ts`, `package.json`, `package-lock.json`; unchanged supported formats `.txt,.pdf,.docx,.csv,.xls,.xlsx`, legacy `.doc` unsupported; synthetic examples, Safe/Confidential output, privacy/policy/ReviewSession/pseudonym semantics, D-019 human-ratified supersession.

No #81–#85, REC-10 localization, REC-11 visual work, refactor of input modality, new UX message or persistent storage.

## Conditional safeguards and STOP

- **Known temporal interleaving: ACTIVE** — pending clipboard read vs later file picker/drop.
- **Representation fidelity: ACTIVE** — exact cardinality/ordering and supported file identity must survive.
- **Adversarial browser witness: ACTIVE** — production-build interaction must demonstrate cancellation of stale write **after awaited work has settled**, and successful ordinary Document-job creation.
- **Affected shared seam: INPUTSTEP ONLY** — do not perform a repo-wide consumer survey. If a needed change affects shared domain/clipboard state, HUMAN STOP.
- **Open material product questions: NONE.** The human already accepted the product outcome on 2026-10-10.
- HUMAN STOP if the prescribed local seam fails, model/binding is missing, required RED→GREEN is inconclusive, a new material issue emerges, or any forbidden modification is necessary.
- One new ticket lifecycle and canonical Standards+Spec; at most two finding-scoped correction attempts **for #106 only**.

## Closeout

Report fixed anchor, candidate SHA, changed-file inventory, focused RED→GREEN witnesses (including awaited/settled browser result), targeted regression status, one canonical Standards + Spec verdict, any bounded correction count, tree cleanliness, and **LOCAL_ONLY**. Then **STOP for Cora integrated read-only audit**. Do not publish or merge and do not close #80 or #106.
