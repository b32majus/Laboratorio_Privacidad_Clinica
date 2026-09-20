# SPEC V4 — Quality, security, performance and deployment

Status: **ACCEPTED**
Scope owner: engineering assurance + runtime boundary

## 1. Required quality layers

### Unit/contract
Recognizer/operator/domain-state behavior.

### Ground-truth privacy corpus
Versioned synthetic cases with labels:
- MUST_REMOVE / transform;
- MUST_KEEP;
- MUST_FLAG_FOR_REVIEW.

Track at minimum:
- precision;
- recall;
- false-negative rate;
- metrics by entity type.

### E2E
Playwright must cover critical user contracts:
- paste/process/review/export;
- modified decision appears in final output;
- restored original appears only when explicitly kept;
- manual detection affects final output;
- mandatory pending review blocks safe export;
- text PDF extraction;
- scanned/no-text PDF explicit warning;
- batch failure remains visible;
- navigation does not equal review completion;
- structured unknown requires review;
- safe export contains no raw fixture PII;
- confidential audit is distinctly labelled;
- network invariant.

## 2. Network privacy invariant

Clinical runtime should be self-contained.

CI/E2E must fail on unexpected outbound runtime requests.

Target CSP is intentionally restrictive, compatible with:
- application assets from self;
- data/blob only where explicitly required;
- no arbitrary `connect-src`;
- no third-party scripts/frames.

Exact CSP is implemented/tested by the security/deploy ticket.

## 3. Production logging

No PHI/PII console logs.

Diagnostic errors must carry enough non-sensitive context to troubleshoot.

## 4. Static quality

Target:
- TypeScript;
- ESLint;
- Prettier;
- build/typecheck in CI;
- CodeQL;
- dependency update automation where appropriate.

Do not add tools merely for badge value; they must protect accepted contracts.

## 5. Supply chain

Browser runtime dependencies must be reproducible from declared package dependencies or covered by an explicit vendor manifest with version/source/hash.

`npm audit` is not evidence for copied libraries that are outside package management.

## 6. Web Worker

Heavy privacy processing must be callable off the main UI thread.

The worker boundary must use serializable domain contracts and must not weaken review/privacy semantics.

## 7. Loading/performance

Load heavy parsers/exporters only for the relevant job type where practical.

Precompute normalized dictionary indexes.

Replace per-character overlap tracking only when benchmark/evidence justifies the change.

## 8. Benchmark

Maintain repeatable synthetic performance scenarios:
- 10 KB;
- 100 KB;
- 500 KB;
- 1 MB or supported maximum;
- 1 / 10 / 50 document jobs where supported.

Record wall time and responsiveness; memory metrics when practical.

No optimization may silently reduce detection coverage.

## 9. Render Static target

Deploy only static build output.

No Render server/worker/function processes clinical data.

Required deployment properties:
- custom domain/TLS capable;
- security headers;
- SPA fallback;
- preview deployment;
- no analytics on clinical origin.

## 10. Spain availability

Hosting availability is an operational requirement separate from privacy correctness.

Cloudflare is not canonical until tested using synthetic content:
- multiple Spanish ISP paths where available;
- during LaLiga blocking windows;
- documented result/fallback.

This experiment is not an unattended product-code ticket because timing/network vantage may require human/operational coordination.

## 11. Delivery

CI gates implementation checkpoints.

Atenea may publish normal non-force ticket checkpoints/PR state according to the Work Order.

Final merge remains human.
