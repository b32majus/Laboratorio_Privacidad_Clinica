# SPEC V4 — Application shell, Job model, review and export

Status: **ACCEPTED**
Scope owner: product shell + review domain

## 1. Goal

Replace the legacy multi-page navigation model with one static SPA that owns a Job from input through export, while preserving existing privacy engine behavior behind an adapter during migration.

## 2. User flow

Canonical flow:

```
Input → Configure → Review → Privacy Gate → Export
```

The browser must not navigate to separate review/batch/structured pages as part of the V4 flow.

Input infers job family:
- pasted text → text;
- one compatible document → document;
- multiple compatible documents → batch;
- CSV/XLS/XLSX → structured.

## 3. Job contract

Minimum domain shape:

```ts
type Job = {
  id: string
  kind: 'text' | 'document' | 'document-batch' | 'structured'
  source: JobSource
  policyId: PrivacyPolicyId
  status: JobStatus
  processing: ProcessingState
  detections: Detection[]
  review: ReviewState
  warnings: JobWarning[]
  errors: JobError[]
  outputs: OutputAvailability
}
```

Sensitive source content is memory-resident by default.

UI state (selected panel/entity/filter/drawer) is separate from domain state.

## 4. Review contract

`ReviewSession` owns:
- immutable source text;
- normalized detections with stable session IDs;
- explicit review decisions;
- manual detections anchored to source offsets;
- progress;
- preview;
- final text.

Required statuses:
- pending;
- accepted;
- modified;
- restored / keep-original;
- manual detection represented by detection source, not a DOM-only mutation.

The exact final text is calculated from source offsets and decisions. Never reconstruct final state from rendered HTML.

### Export gate

`getFinalText()` / equivalent safe-output API must fail while mandatory review remains pending.

A restored original is an explicit completed decision but must remain visible in Privacy Gate warnings.

## 5. Review UX

Desktop:
- left: filters/progress/types;
- center: document/data surface;
- right: entity inspector.

Entity inspector shows:
- original;
- proposed replacement;
- type/subtype;
- confidence;
- detection reason/context when available;
- decision controls;
- notes.

No floating action bar is required in target design.

Low-confidence candidates are a first-class filter/work queue.

Manual detection must be discoverable via visible action and text selection.

## 6. Privacy Gate

Before export, show factual state:
- treated direct identifiers;
- pending mandatory decisions;
- low-confidence candidates;
- manual detections;
- kept originals/restores;
- file/extraction errors;
- policy used.

Do not show a global "privacy score", "safe percentage", GDPR certification, or anonymity claim.

## 7. Export contract

Two independent surfaces:

### Safe Output
Derived from final reviewed domain state only.
May support TXT/DOCX/PDF/XLSX depending on job type.

Must not contain:
- trace mappings;
- original values solely for audit;
- reviewer notes;
- confidential correspondence.

### Confidential Audit
Separate action, separate file, strong warning.
May contain original↔replacement mapping and decision trace.

## 8. App shell

Persistent top-level facts:
- current Job name/type;
- current Privacy Policy;
- local-only processing indicator phrased as a verifiable fact;
- clear sensitive session action;
- review progress when relevant.

Minimal nav:
- New Job;
- Workspace;
- Policies;
- Help.

Do not persist a PHI-bearing job history by default.

## 9. Responsive/accessibility

Desktop is primary professional surface but the workflow must remain functional on tablet/mobile.

Requirements:
- keyboard-operable actions;
- visible focus;
- AA contrast for normal operational text;
- semantic labels/aria for icon-only controls;
- no hover-only essential information;
- no color-only status;
- layouts adapt rather than rely on fixed 18rem sidebars + `h-screen overflow-hidden`.

## 10. Migration acceptance

Legacy pages remain until V4 equivalents have deterministic/E2E parity.

Legacy removal is a separate ticket.

The first shell PR must not simultaneously rewrite recognizers or change detection semantics.
