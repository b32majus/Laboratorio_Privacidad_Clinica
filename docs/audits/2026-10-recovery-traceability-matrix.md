# Recovery traceability matrix — frozen 88 + product heritage

> Audit date: 2026-10-04
> Original audited product: `3.0-main@331bcaf4a624659c77823a0c4b427d46347ea104`
> Frozen pre-refactor authority: `e164ca2`
> Current V4 authority: `3.0-main@6fb5eb1fb867e022acc68dd2be39b16bd531f27a`
> This is a recovery traceability artifact, not a replacement for the frozen audits.

## Verdict vocabulary

- **VERIFIED_RESOLVED / VERIFIED_IMPROVED** — current implementation materially satisfies or improves the frozen requirement.
- **STALE_REGISTER_RESOLVED** — current debt row is stale; live/current code already satisfies the requirement.
- **PARTIAL** — important pieces exist but the frozen requirement is not fully satisfied.
- **OPEN_RECOVERY** — known work required before product recovery can close.
- **OPEN_GOVERNANCE / OPEN_OPERATIONS** — real work, but not itself a user-facing recovery feature.
- **FUTURE_NOT_RECOVERY** — explicitly later capability; must not inflate the recovery ticket count.

## A. Frozen 88 debt/hallazgo rows reconciled against current V4

| ID | P | Frozen objective | Current register | Audit verdict | Recovery blocker | Follow-up | Evidence / rationale |
|---|---:|---|---|---|:---:|---|---|
| `PRIV-001` | P0 | Eliminar JavaScript/recursos de terceros del origen clínico | DONE | **VERIFIED_RESOLVED** | No | — | Clinical V4 build is app-v4-only; Render CSP/no-network gates prohibit third-party runtime. |
| `PRIV-002` | P0 | Separar Safe Output y Confidential Audit | DONE | **VERIFIED_IMPROVED** | No | — | Safe Output and Confidential Audit are separate services/surfaces and structurally tested. |
| `FUNC-001` | P0 | Derivar export/copy de la versión realmente revisada | DONE | **VERIFIED_IMPROVED** | No | — | ReviewSession final text is canonical authority for single text/document export. |
| `FUNC-002` | P0 | No marcar documento revisado por navegar/exportar | DONE | **VERIFIED_RESOLVED** | No | — | Batch navigation never marks review complete; explicit per-item completion is tested. |
| `FUNC-003` | P0 | Implementar detector/operador de edad en texto libre | DONE | **VERIFIED_RESOLVED** | No | REC-01 | AGE recognizer/operator exists; REC-01 (SPANISH-ENGINE-ASSURANCE-01) demonstrated it on the expanded gated corpus: EDAD per-type precision 1 / recall 1 / FNR 0 / F1 1 (tp 18, fp 0, fn 0) with adult/abbreviated/pediatric/boundary slices machine-visible and exact-span/exact-band goldens green. |
| `COPY-001` | P0 | Eliminar claims de k-anonimato y privacidad diferencial no implementados | DONE | **VERIFIED_RESOLVED** | No | — | Active V4 claims gates prohibit k-anonymity/differential-privacy/anonymity certification wording. |
| `FUNC-004` | P0 | Sustituir truncado silencioso >1 MB por bloqueo explícito | DONE | **VERIFIED_RESOLVED** | No | — | Oversize input is typed fail-closed; no silent truncation in V4. |
| `FUNC-005` | P1 | Diferenciar semántica/política de fechas; diseñar date shifting | OPEN | **VERIFIED_RESOLVED** | No | — | Date roles + generalize/shift operators already existed; REC-02 completed the text/document/batch policy semantics behind the single engine table (`external-ai` → `v4.date-generalize`, `longitudinal-research` → `v4.date-shift` with one consistent Job-scoped offset). Evidence: `engine/policy.ts`, `engine/initial-processing-context.ts`, `policy-guidance.ts` + oracles (commit d188963). |
| `ARCH-001` | P1 | Crear ReviewSession como única fuente de verdad | DONE | **VERIFIED_IMPROVED** | No | — | ReviewSession is the review authority. |
| `ARCH-002` | P1 | Sacar estado de review de DOM/datasets | DONE | **VERIFIED_RESOLVED** | No | — | Review state is no longer DOM/dataset authority. |
| `FUNC-006` | P1 | Evitar pérdida de progreso al añadir entidades manuales | DONE | **VERIFIED_RESOLVED** | No | — | Manual detections live in ReviewSession without discarding prior decisions. |
| `FUNC-007` | P1 | Eliminar reconstrucción frágil de offsets desde DOM | DONE | **VERIFIED_RESOLVED** | No | — | Canonical source offsets drive composition; no DOM offset reconstruction. |
| `FILE-001` | P1 | Corregir/eliminar soporte `.doc` | DONE | **VERIFIED_RESOLVED** | No | — | Legacy .doc is not advertised/supported; DOCX is explicit. |
| `FILE-002` | P1 | Detectar PDFs escaneados/sin text layer | DONE | **VERIFIED_IMPROVED** | No | — | Scanned/no-text-layer PDFs fail explicitly; E2E covers it. |
| `PRIV-003` | P1 | Eliminar logs de PHI/resultados | DONE | **VERIFIED_RESOLVED** | No | — | No active PHI logging path found in V4; no remote error/analytics runtime. |
| `BATCH-001` | P1 | Mantener documentos fallidos dentro del estado del batch | DONE | **VERIFIED_IMPROVED** | No | REC-06 | Failed batch items remain visible. Missing user-facing retry/remove/ack controls are heritage/UX gaps handled in REC-06. |
| `BATCH-002` | P1 | Eliminar dependencia de sessionStorage para batch grande | DONE | **VERIFIED_RESOLVED** | No | — | Active batch state is memory-resident in SPA, not sessionStorage shuttle. |
| `BATCH-003` | P1 | ProcessingContext compartido y consistencia real entre documentos | DONE | **VERIFIED_IMPROVED** | No | — | Explicit ProcessingContext threads cross-document pseudonym/date state. |
| `BATCH-004` | P1 | Eliminar monkey patch de AsignadorSustitutos | DONE | **VERIFIED_RESOLVED** | No | — | V4 batch path does not monkey-patch AsignadorSustitutos. |
| `STRUCT-001` | P1 | UNKNOWN debe requerir revisión, no KEEP | DONE | **VERIFIED_RESOLVED** | No | — | UNKNOWN is Review Required / export blocker. |
| `STRUCT-002` | P1 | Unificar autoridad de patient ID | DONE | **VERIFIED_RESOLVED** | No | REC-03 | Single patient-ID authority exists; its output semantics are incomplete and handled separately in REC-03. |
| `STRUCT-003` | P1 | Sustituir parser CSV artesanal | DONE | **PARTIAL** | No | Post-recovery debt | Multiline CSV bug is fixed, but V4 still owns a custom parser rather than the consolidated parser requested by the frozen audit. |
| `STRUCT-004` | P1 | Inferir columnas con muestra distribuida, no una fila | DONE | **VERIFIED_IMPROVED** | No | — | Column profiler samples distributed non-empty values, not only row 1. |
| `STRUCT-005` | P1 | No mantener VISIT_DATE exacta por defecto en perfiles externos | DONE | **VERIFIED_RESOLVED** | No | — | Structured policy no longer defaults visit date to exact KEEP for External AI. |
| `STRUCT-006` | P1 | Edad en fecha de visita, no edad actual | DONE | **VERIFIED_RESOLVED** | No | — | Structured birth date derives age at event/visit where relevant. |
| `STRUCT-007` | P1 | Selección de hoja | DONE | **VERIFIED_IMPROVED** | No | — | Explicit sheet selection is required; multi-sheet fixture exists. |
| `STRUCT-008` | P1 | Normalizar seriales de fecha Excel | DONE | **VERIFIED_RESOLVED** | No | — | Excel date serial normalization is explicit. |
| `STRUCT-009` | P1 | No codificar valores vacíos | DONE | **VERIFIED_RESOLVED** | No | — | Blank/null values remain absence; not codified. |
| `COPY-002` | P1 | Usar seudonimizado/preparado salvo anonimización demostrable | OPEN | **STALE_REGISTER_RESOLVED** | No | — | Active V4 uses prepared/pseudonymized/factual terminology and explicitly forbids anonymity claims. |
| `ARCH-003` | P1 | Sustituir singletons mutables por engine/context instanciable | OPEN | **PARTIAL** | No | Post-recovery debt | Legacy core still contains mutable singleton modules; V4 isolates/seeds/reconciles them behind explicit context/worker seams. |
| `ARCH-004` | P1 | Separar Recognizers de Operators/Policies | DONE | **VERIFIED_RESOLVED** | No | — | RecognizerRegistry and OperatorRegistry/policy separation exist. |
| `ARCH-005` | P1 | Definir Detection contract | OPEN | **PARTIAL** | No | Post-recovery debt | Rich recognizer/review contracts exist, but Job Detection in domain/job.ts remains a minimal placeholder rather than the frozen full Detection contract. |
| `ARCH-006` | P1 | Definir ReviewDecision contract | OPEN | **STALE_REGISTER_RESOLVED** | No | — | ReviewDecision is explicit, typed through declarations/facade and authoritative in review-session.js. |
| `ARCH-007` | P1 | Eliminar duplicación review.html / review-ui.js | DONE (branch-local; handoff de revisión) | **VERIFIED_RESOLVED** | No | — | Legacy review page/UI duplication retired; V4 ReviewWorkspace is canonical. |
| `ARCH-008` | P1 | Retirar batch-review-legacy y batch-structured-legacy | DONE (branch-local; handoff de revisión) | **VERIFIED_RESOLVED** | No | — | Legacy batch review/structured pages retired after V4 replacement. |
| `CI-001` | P1 | Ejecutar check:positioning/npm test en GitHub Actions | OPEN | **PARTIAL** | No | REC-12 | GitHub Actions runs check:positioning and major gates, but not the literal full npm test chain. |
| `CI-002` | P1 | Check de cero recursos externos en origen clínico | DONE | **VERIFIED_RESOLVED** | No | — | CI enforces no unexpected external resources in V4. |
| `QA-001` | P1 | Corpus ground-truth y métricas precision/recall/FNR | DONE | **VERIFIED_IMPROVED** | No | — | REC-01 expanded the gated V4 corpus to 35 core + 4 adversarial cases. Core annotations: EDAD 22, IDENTIFICADOR 15, SOSPECHOSO 12, FECHA 8, UBICACION 7, NOMBRE 5 (≥5 distinct cases per type). Every top-level type on the core gate is precision 1 / recall 1 / FNR 0 / F1 1 over the real `createRegistryEngine()`; the added `coverage.json` contract reports nonzero support for every declared slice and no collapsed type. Thresholds remain `1 / 1 / 0` in `config.json` (unchanged). This is a materially broadened synthetic assurance/regression corpus, not a universal Spanish quality grade. |
| `QA-002` | P1 | Suite Playwright de flujos críticos | DONE | **PARTIAL** | Yes | REC-12 | Critical Playwright suite exists, but original parity cases for copy/PDF/batch outputs cannot be covered until those capabilities are restored. |
| `QA-003` | P1 | E2E network privacy invariant | DONE | **VERIFIED_RESOLVED** | No | — | Browser no-network invariant + planted violation tests exist. |
| `PERF-001` | P1 | Web Worker para engine/batch | DONE | **VERIFIED_RESOLVED** | No | — | Production engine runs behind a Web Worker. |
| `PERF-002` | P2 | Lazy-load de parsers y exportadores | DONE | **VERIFIED_RESOLVED** | No | — | Heavy engine/parsers are lazy/dynamic where designed. |
| `PERF-003` | P2 | DictionaryIndex normalizado precomputado | DONE | **VERIFIED_RESOLVED** | No | — | DictionaryIndex cache/precomputation exists. |
| `PERF-004` | P2 | Resolver conflictos por intervalos | DONE | **VERIFIED_RESOLVED** | No | — | Conflict resolution performance work landed with deterministic tests. |
| `SUPPLY-001` | P1 | Build reproducible o vendor manifest con hashes/versiones | DONE | **VERIFIED_RESOLVED** | No | — | Vendor manifest, provenance/hash checks and dependency governance exist. |
| `CODE-001` | P2 | ESLint + Prettier | DONE | **VERIFIED_RESOLVED** | No | — | ESLint + Prettier gates exist for V4. |
| `CODE-002` | P2 | TypeScript o JSDoc + @ts-check | OPEN | **PARTIAL** | No | Post-recovery debt | V4 is TypeScript; preserved legacy core remains JavaScript behind typed adapters/declarations. |
| `CODE-003` | P2 | Sustituir alert() por errores/estados de UI | DONE | **VERIFIED_RESOLVED** | No | — | Active V4 uses typed errors/UI states; legacy alert surfaces retired. |
| `GOV-001` | P1 | Consolidar rama canónica | DONE (documental; acción remota = handoff humano) | **PARTIAL** | No | REC-12 | Canonical authority is documented as 3.0-main, but GitHub default branch/remote HEAD is still main. |
| `GOV-002` | P1 | Branch protection y CI required | OPEN (handoff humano documentado) | **OPEN_GOVERNANCE** | No | REC-12 | GitHub API confirms 3.0-main is not protected. |
| `GOV-003` | P1 | Unificar versión README/package/runtime | DONE | **VERIFIED_RESOLVED** | No | — | package/README V4 version aligned at 4.0. |
| `DOC-001` | P1 | Actualizar especificación técnica a arquitectura real | OPEN | **OPEN_GOVERNANCE** | No | REC-12 | Documentation/debt authority needs final rewrite against recovered product. |
| `UX-001` | P1 | Auditoría completa SPA/app-shell y navegación | DONE | **VERIFIED_RESOLVED** | No | — | Original UX/app-shell audit exists and remains authority evidence. |
| `UX-002` | P1 | Eliminar doble landing index → app antes del workspace | OPEN | **STALE_REGISTER_RESOLVED** | No | — | Clinical Render serves the SPA workspace directly; marketing root is not part of the clinical dist. |
| `UX-003` | P1 | Unificar entrada en New Privacy Job con inferencia por tipo de input | OPEN | **PARTIAL** | Yes | REC-08 | New Privacy Job infers text/document/batch/structured, but the frozen UX direction also required pipeline override when necessary. REC-08 must either implement a bounded legitimate override or record `DELIBERATELY_SUPERSEDED` by deterministic/fail-closed routing with explicit rationale. |
| `UX-004` | P1 | Integrar batch como capacidad natural, eliminar framing Premium/Activar | DONE | **VERIFIED_RESOLVED** | No | — | Batch is a normal Job kind; Premium framing removed. |
| `UX-005` | P1 | Unificar texto/documentos/batch/structured en un único sistema visual | OPEN | **PARTIAL** | Yes | REC-11 | Shared component/token system exists, including rose/stone primitives, but the intended Sophilux clinical-workstation visual identity and finish were not carried through as an acceptance contract. |
| `UX-006` | P0 | No mostrar/habilitar Safe Export antes de completar Privacy Gate | DONE | **VERIFIED_RESOLVED** | No | — | Safe export is gated by factual readiness/ReviewSession. |
| `UX-007` | P2 | Sustituir disclaimer rojo permanente por aviso contextual | OPEN | **STALE_REGISTER_RESOLVED** | No | — | V4 does not use permanent red disclaimer as the operational hierarchy. |
| `UX-008` | P1 | Sustituir Strict Mode opaco por Privacy Policies explicables | OPEN | **STALE_REGISTER_RESOLVED** | No | — | Policy guidance explains all four policies per job kind from the engine/structured authorities; REC-02 completed the text/document/batch mapping, so no policy is opaque or left "unmapped". Evidence: `policy-guidance.ts` + `policy-guidance.test.ts`/`App.policy.test.tsx` (commit d188963). |
| `UX-009` | P1 | Consolidar cards/action bar/modal en un único Entity Inspector | DONE | **VERIFIED_RESOLVED** | No | — | Single Entity Inspector replaces fragmented legacy card/action/modal model. |
| `UX-010` | P1 | Diseñar layouts desktop/tablet/mobile para superficies operativas | OPEN | **VERIFIED_IMPROVED** | No | — | Responsive V4 flows are tested at 375/768/1280; mobile explicit inspector route added. |
| `UX-011` | P1 | Corregir contraste del primary operativo y estados de foco | DONE | **VERIFIED_RESOLVED** | No | REC-11 | Accessible darker rose token/focus states exist; visual closeout will preserve contrast. |
| `UX-012` | P1 | Hacer tooltips/actions accesibles por teclado y touch | DONE | **VERIFIED_RESOLVED** | No | — | Core controls are keyboard/touch accessible; no hover-only essential action in audited V4 flows. |
| `UX-013` | P2 | Añadir shortcuts de revisión y navegación de pendientes | OPEN | **OPEN_RECOVERY** | Yes | REC-09 | Review is keyboard-operable but dedicated A/M/K/F + next/previous shortcuts were never implemented. |
| `UX-014` | P1 | Convertir low-confidence/descartados en workflow visible | DONE | **VERIFIED_IMPROVED** | No | — | Low-confidence candidates are a first-class review queue/filter and gate fact. |
| `UX-015` | P1 | Rediseñar configuración de columnas como classification workspace | DONE | **VERIFIED_IMPROVED** | No | REC-03 | Classification workspace exists; productive structured semantics (Study ID/free text/generalize) remain incomplete under REC-03. |
| `UX-016` | P1 | Mostrar job/policy/local-only/clear session persistentemente en app shell | OPEN | **STALE_REGISTER_RESOLVED** | No | — | Job, policy, local-only fact and clear-session action are persistent in current shell. |
| `ARCH-009` | P1 | Migración incremental a SPA Vite + TypeScript + React | PLANNED | **STALE_REGISTER_RESOLVED** | No | — | V4 SPA is Vite + TypeScript + React. |
| `ARCH-010` | P1 | Mantener core detrás de adapter durante migración; no big-bang rewrite | PLANNED | **STALE_REGISTER_RESOLVED** | No | — | Core was wrapped/adapted rather than big-bang rewritten. |
| `HOST-001` | P0 | Separar marketing/docs y aplicación clínica en orígenes distintos | OPEN | **PARTIAL** | No | REC-12 | Clinical Render dist is third-party-free and distinct from repo-root marketing surface; final external-origin topology should be recorded explicitly. |
| `HOST-002` | P1 | Adoptar target estático con security headers; Render Static recomendado para fase actual | DONE | **VERIFIED_RESOLVED** | No | — | Render Static with security headers is live. |
| `HOST-003` | P1 | Evaluar riesgo LaLiga/bloqueo IP compartida por proveedor antes de producción clínica | OPEN | **OPEN_OPERATIONS** | No | Post-recovery operations | Spain/LaLiga multi-tenant availability risk has not been fully operationally closed. |
| `HOST-004` | P2 | Test controlado de Cloudflare durante ventanas de partido antes de reconsiderarlo | OPEN | **FUTURE_NOT_RECOVERY** | No | Post-recovery operations | Cloudflare experiment is optional and not required to recover product parity. |
| `HOST-005` | P2 | Definir fallback a origen/IP propia si la disponibilidad clínica lo exige | OPEN | **FUTURE_NOT_RECOVERY** | No | Post-recovery operations | Dedicated-IP/VPS fallback is resilience planning, not recovery parity. |
| `PRODUCT-001` | P3 | Date shifting consistente | MISSING | **VERIFIED_RESOLVED** | No | — | Text/document/batch Longitudinal Research now shifts dates through one consistent Job-scoped offset that preserves ordering/intervals (structured already did). Evidence: `engine/initial-processing-context.ts`, `useJobSession.test.tsx` longitudinal oracles, Playwright `e2e/policy-guidance.spec.ts` (commit d188963). |
| `PRODUCT-002` | P3 | Pseudónimos deterministas sin inferir género | DONE | **VERIFIED_IMPROVED** | No | — | Patient pseudonyms are deterministic and gender-free within context. |
| `PRODUCT-003` | P3 | Perfiles de política de privacidad | OPEN | **VERIFIED_RESOLVED** | No | — | All four accepted policies now have deterministic text/document/batch mappings (plus structured); availability derives from the engine/structured authorities and guidance states the actual behavior. Evidence: `engine/policy.ts`, `policy-guidance.ts` + oracles (commit d188963). |
| `PRODUCT-004` | P3 | Bandeja de candidatos low-confidence/descartados | DONE | **VERIFIED_RESOLVED** | No | — | Low-confidence queue delivered. |
| `PRODUCT-005` | P3 | Privacy Gate final | OPEN | **STALE_REGISTER_RESOLVED** | No | — | Privacy Gate exists and was UX-closed in #63/#64. |
| `PRODUCT-006` | P3 | Clasificación Identifier/Quasi/Sensitive/Insensitive | DONE | **VERIFIED_RESOLVED** | No | REC-03 | Five-class structured taxonomy exists; class-to-productive-action parity is a separate REC-03 concern. |
| `PRODUCT-007` | P3 | ARX-lite: unicidad/equivalence classes | OPEN | **FUTURE_NOT_RECOVERY** | No | Future | ARX-lite risk analysis was explicitly a later capability, not v3 parity. |
| `PRODUCT-008` | P3 | Recognizer plugins y diccionarios institucionales | OPEN | **FUTURE_NOT_RECOVERY** | No | Future | Institutional dictionaries/plugin recognizers are future extensibility, not baseline recovery. |
| `PRODUCT-009` | P3 | NER local opcional | OPEN | **FUTURE_NOT_RECOVERY** | No | Future | Local NER was explicitly optional/later. |
| `PRODUCT-010` | P3 | OCR local | OPEN | **FUTURE_NOT_RECOVERY** | No | Future | Local OCR was explicitly later; current scan detection correctly fails closed. |
| `PRODUCT-011` | P3 | FHIR JSON adapter | OPEN | **FUTURE_NOT_RECOVERY** | No | Future | FHIR adapter was explicitly later. |
| `PRODUCT-012` | P3 | Reconstrucción/redacción manteniendo layout | OPEN | **FUTURE_NOT_RECOVERY** | No | REC-05 | Layout-preserving PDF redaction is future; REC-05 restores safe PDF report/export without claiming layout-preserving redaction. |
| `PRODUCT-013` | P3 | Correspondencia cifrada opcional / HMAC study IDs | OPEN | **FUTURE_NOT_RECOVERY** | No | Future | Encrypted/HMAC study IDs are future; deterministic in-job Study IDs required by current structured spec are REC-03 and do not require HMAC. |

## B. Product heritage / target matrix — capabilities that the debt table alone cannot protect

| Ref | Capability | Original / target contract | Current V4 | Verdict | Recovery blocker | Ticket |
|---|---|---|---|---|:---:|---|
| `H-01` | Product language | Entire v3 clinical UI was Spanish. | Current V4 visible UI/copy is predominantly English while `lang="es"`. | **LOST** | Yes | REC-10 |
| `H-02` | Sophilux visual identity | Warm stone/rose-gold, Sophilux personality, polished editorial heritage. | V4 retains rose/surface tokens and local Inter/Cormorant but composition is utilitarian; no full visual acceptance contract survived. | **PARTIAL** | Yes | REC-11 |
| `H-03` | Professional technical typography | UX audit proposed JetBrains Mono for IDs/technical values. | V4 uses Tailwind default `font-mono`; JetBrains Mono is not installed/imported. | **TARGET_GAP** | No | REC-11 |
| `H-04` | Preloaded clinical examples | Urgencias, Informe Quirúrgico, Historia Clínica example cards. | No equivalent product examples found in V4 Input. | **LOST** | Yes | REC-08 |
| `H-05` | Paste convenience | Explicit `Pegar` clipboard button. | Text area exists; no explicit clipboard-paste action. | **LOST** | No | REC-08 |
| `H-06` | Manual text input | Paste/type free text. | Preserved as pasted-text Job. | **PRESERVED** | No | — |
| `H-07` | TXT/PDF/DOCX input | Single clinical document extraction. | Preserved and improved with typed failures/no-text-layer handling. | **IMPROVED** | No | — |
| `H-08` | Legacy .doc claim | UI claimed .doc though parser was DOCX-only. | Removed from supported formats; correct intentional non-parity. | **CORRECTLY_REMOVED** | No | — |
| `H-09` | Review highlights + accept/modify/restore | Human review actions over detected spans. | Preserved and moved into authoritative ReviewSession/Entity Inspector. | **IMPROVED** | No | — |
| `H-10` | Manual missed-entity marking | Select missed PHI and categorize it. | Preserved through selection + Add manual detection; mobile route improved. | **IMPROVED** | No | — |
| `H-11` | Copy reviewed text | `Copiar Texto` action in review. | No clipboard copy of canonical Safe Output in V4. | **LOST** | Yes | REC-05 |
| `H-12` | Single-document PDF report | `Informe de Seudonimización` via jsPDF. | No PDF generation in V4. Old report was unsafe because it mixed originals/mappings, so format must be restored with Safe/Audit separation. | **LOST_NEEDS_SAFE_REDESIGN** | Yes | REC-05 |
| `H-13` | Safe TXT | Text result export/shareable text. | V4 Safe Output `.txt` exists and is stricter. | **IMPROVED** | No | — |
| `H-14` | Batch multi-document processing | Multiple TXT/PDF/DOCX with progress/status. | Preserved as native Job; failed documents remain visible. | **IMPROVED** | No | REC-06 |
| `H-15` | Cross-document consistency | Optional maintain-consistency behavior. | V4 uses explicit shared ProcessingContext in batch; no monkey patch. | **IMPROVED** | No | — |
| `H-16` | Batch retry/remove/error acknowledgement | UX audit target explicitly required retry/remove/process/review-required/acknowledge. | Domain has retry semantics/remedies; Review UI lacks deliberate retry/remove/ack controls. | **TARGET_GAP** | Yes | REC-06 |
| `H-17` | Batch consolidated PDF | One PDF with all documents/index. | No batch Safe Output format exists in V4. | **LOST** | Yes | REC-07 |
| `H-18` | Batch individual PDFs ZIP | Per-document PDFs packaged as ZIP. | No batch output format exists in V4. | **LOST** | Yes | REC-07 |
| `H-19` | Batch CSV summary | Batch summary CSV. | No batch-wide output exists in V4. | **LOST** | Yes | REC-07 |
| `H-20` | Structured CSV/XLS/XLSX input | Tabular clinical data ingestion. | Preserved; parser/date/sheet semantics materially hardened. | **IMPROVED** | No | — |
| `H-21` | Hospital-export Excel/workbook header auto-detection | v3 Excel scanned up to the first 10 rows and skipped explanatory metadata to find the real header; v3 CSV already used its first row as headers. | V4 Excel uses the worksheet first row and therefore lost the workbook smart-header capability; CSV remains first-record semantics. | **LOST** | Yes | REC-04 |
| `H-22` | Multi-sheet behavior | v3 effectively used first sheet; audit required selection. | V4 explicitly lists/selects sheet and fails closed on missing selection. | **IMPROVED** | No | — |
| `H-23` | Patient → Study ID | v3 generated `ID_ESTUDIO` (`PAC_001…`); UX target said Identifier → Replace with Study ID; accepted V4 spec requires deterministic study IDs/mappings. | Current structured plan maps Identifier → remove; patient-ID column is used for shift authority then dropped from Safe dataset. | **MATERIAL_REGRESSION** | Yes | REC-03 |
| `H-24` | Longitudinal row linkage | Study ID + optional `Visita_Num` kept rows linkable per patient. | Per-patient date shifting exists, but Safe export lacks generated Study ID and therefore can lose patient linkage. | **PARTIAL_REGRESSION** | Yes | REC-03 |
| `H-25` | Configurable Study-ID prefix | v3 allowed prefix such as `PAC`. | No equivalent current product control. | **LOST** | No | REC-04 |
| `H-26` | Optional `Visita_Num` | v3 could emit sequential visit number per patient. | No equivalent current product output/control. | **LOST** | No | REC-04 |
| `H-27` | Structured validation/stats | v3 surfaced warnings/errors, unique patients, visits/averages. | V4 has stronger fail-closed structural blockers, but unique-patient/visit summary facts are not surfaced equivalently. | **PARTIAL** | No | REC-04 |
| `H-28` | Structured Safe XLSX | v3 produced analysis-ready `.xlsx`. | V4 safe structured output is `.csv` only. | **LOST** | Yes | REC-04 |
| `H-29` | Structured correspondence XLSX | v3 produced separate `.xlsx` correspondence. | V4 Confidential structured artifact is `.txt`; separation improved but spreadsheet format lost. | **LOST** | Yes | REC-04 |
| `H-30` | Structured free-text processing | UX/spec target allowed a free-text column to route through the same text privacy engine. | No productive routing found; free-text-like columns fall through classification/review rather than text-engine processing. | **TARGET_GAP** | Yes | REC-03 |
| `H-31` | Structured class→action semantics | UX target illustrated Study ID, date/age handling, center pseudonymization, free-text processing. | Current generic mapping is identifier→remove, quasi→generalize, sensitive→codify; generic generalize without a date role is unsupported. Requires explicit product reconciliation, not silent assumption. | **SEMANTIC_DRIFT** | Yes | REC-03 |
| `H-32` | Four Privacy Policies | Audit target Standard / External AI / Longitudinal Research / Strict. | All four are visible and work in structured; after REC-02 all four also resolve text/document/batch mappings, and guidance explains the actual per-family behavior. | **IMPROVED** | No | — |
| `H-33` | Text date shifting | Audit/product candidate required consistent date shifting for longitudinal use. | Longitudinal Research text/document/batch now selects the consistent Job-scoped date-shift operator; ordering/intervals are preserved across documents (unit + browser evidence). | **IMPROVED** | No | — |
| `H-34` | Low-confidence workflow | Target improvement, not v3 parity. | Delivered as visible queue/filter and gate fact. | **NEW_IMPROVEMENT** | No | — |
| `H-35` | Privacy Gate | Target improvement, not v3 parity. | Delivered and UX-closed. | **NEW_IMPROVEMENT** | No | — |
| `H-36` | App IA: Workspace / Policies / Help | Target audit/spec minimal nav. | No dedicated Workspace/Policies/Help navigation; only New Job/Clear session + step nav. | **TARGET_GAP** | Yes | REC-09 |
| `H-37` | Review productivity shortcuts | Target A/M/K/F and next/previous shortcuts. | Native controls keyboard-operable; no dedicated shortcuts found. | **TARGET_GAP** | Yes | REC-09 |
| `H-38` | Responsive app | Original v3 weak; target required desktop/tablet/mobile. | V4 is materially improved and tested at 375/768/1280. | **NEW_IMPROVEMENT** | No | — |
| `H-39` | Local-first clinical runtime | v3 principle existed but marketing script shared origin risk. | V4 clinical dist is static, same-origin-only, CSP/no-network guarded, Worker-based. | **NEW_IMPROVEMENT** | No | — |
| `H-40` | Spanish engine quality proof | Original engine/dictionaries were Spanish; audit demanded per-type precision/recall/FNR. | Engine remains Spanish; REC-01 demonstrates per-type precision/recall/FNR plus declared-slice coverage on the productive `createRegistryEngine()` pipeline over 35 core + 4 adversarial synthetic cases. The committed corpus is a deterministic assurance/regression gate, not a universal Spanish quality grade. | **IMPROVED** | No | REC-01 |
| `H-41` | Keep-original direct-identifier safeguard | Frozen UX-10 requires `Mantener original` plus contextual confirmation for a direct identifier and an explanation that the original will remain in Safe Output. | V4 has the `Keep original` decision and a later Privacy Gate warning, but the review action itself executes without the required contextual confirmation/explanation. | **TARGET_GAP** | Yes | REC-09 |
| `H-42` | Deliberate Confidential Audit download | Frozen Export UX requires the identifiable Confidential Audit to be separate, clearly marked and require an additional confirmation before download. | V4 separates Safe and Confidential artifacts, but current export handlers download Confidential Audit directly without the additional deliberate-confirmation interaction. | **TARGET_GAP** | Yes | REC-04/REC-05/REC-07 |

## C. Recovery blockers derived from the two matrices

The blocker set is intentionally narrower than every OPEN/P3 debt row. Advanced OCR/NER/FHIR/ARX/DICOM/layout-preserving PDF work remains future capability unless it is separately accepted. Known recovery blockers cluster into twelve bounded work orders defined in `docs/RECOVERY_MASTER_PLAN_2026-10.md`.
