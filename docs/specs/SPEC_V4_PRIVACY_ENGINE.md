# SPEC V4 — Privacy engine, policies and processing context

Status: **ACCEPTED**
Scope owner: engine/domain privacy behavior

## 1. Goal

Make the existing local privacy engine testable, composable and policy-driven without discarding its working brownfield logic.

## 2. Target boundaries

```
PrivacyEngine
├── RecognizerRegistry
├── OperatorRegistry
├── PrivacyPolicy
├── ProcessingContext
└── Result/Detection contracts
```

Migration is incremental. Existing detectors/managers may be wrapped first and extracted later.

## 3. Detection contract

Minimum normalized contract:

```ts
type Detection = {
  id: string
  type: PrivacyEntityType
  subtype?: string
  start: number
  end: number
  original: string
  confidence?: number
  source: 'engine' | 'manual'
  reason?: string
  proposed?: string
  requiresReview: boolean
}
```

Offsets are against immutable source text.

## 4. Recognizers

Recognizers answer "what is this?", not "how should it be transformed?".

Initial/legacy categories include:
- person/patient/professional/family;
- identifier (DNI/NIE/NHC/health card/phone/email/etc.);
- date;
- age;
- location;
- privacy-relevant quasi-identifier/suspicious context.

Recognizers may be deterministic regex/dictionary/context logic. Local NER is a later optional capability and must not be introduced before benchmark authority exists.

## 5. Operators

Operators answer "what transformation applies?".

Target operators:
- REDACT;
- REPLACE;
- PSEUDONYMIZE;
- GENERALIZE;
- DATE_SHIFT;
- KEEP (only when policy/user authority permits).

Transformation logic is not hard-coded into recognizers.

## 6. Privacy Policy

A policy maps context/entity to operator + review requirements.

Initial named policies:
- Standard;
- External AI;
- Longitudinal Research;
- Strict.

A worker must not invent mapping semantics that are not defined by its Work Order.

## 7. ProcessingContext

Cross-document consistency lives in an explicit context, not mutable global monkey patches.

Potential context state:
- deterministic/study pseudonym mapping;
- location mapping;
- date-shift seed/offset state;
- policy;
- options needed by compatible legacy managers.

A single document may use a fresh context.
A batch/longitudinal Job may share one context intentionally.

## 8. Age

AGE is a first-class recognizer.

Required examples include:
- "45 años";
- "45 a.";
- pediatric months/weeks;
- extreme ages;
- explicit ranges when present.

Generalization is policy-driven. Example bands are implementation policy, not a universal claim.

## 9. Dates

Do not treat every detected date as an ordered "visit".

Date behavior must support:
- redaction;
- generalization;
- consistent date shifting when longitudinal intervals matter.

Birth date, visit, admission/discharge and future appointment may have different semantics. The engine must not silently destroy chronology under a generic Visit-N abstraction.

## 10. Confidence / low confidence

Confidence controls workflow.

Target behavior:
- high confidence: transform/propose according to policy;
- medium: transform/propose + mandatory review;
- low: remain visible as a candidate requiring/allowing human adjudication.

Candidates must not disappear simply because they fall below a threshold.

## 11. Fail-closed

- input over supported size: explicit blocking/segmentation path, never silent truncation;
- unsupported/unreadable file: explicit error;
- unknown structured privacy classification: review required;
- ambiguous authority: error/STOP rather than guessed safe behavior.

## 12. Pseudonyms

Do not infer gender merely to generate privacy replacements.

Target patient/entity pseudonyms are stable and distinct within intended context (e.g. Patient 1 / stable study token).

Cryptographic/HMAC study IDs are a later bounded capability, not required for the first engine refactor unless a ticket explicitly includes them.

## 13. Terminology

Engine/API names should not claim "anonymized" where behavior is pseudonymization/preparation.

No implementation may present k-anonymity or differential privacy until the actual mathematical mechanism exists.

## 14. Performance boundary

Engine APIs must be callable from a Web Worker and avoid DOM/browser-global coupling.

Precompute normalized dictionary indexes when the performance ticket executes.

Optimization must preserve deterministic regression behavior.
