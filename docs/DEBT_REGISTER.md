# Registro de deuda — Laboratorio de Privacidad Clínica

> Registro vivo. No borrar deuda al implementarla: marcarla como resuelta y enlazar PR/commit para conservar trazabilidad.

## Convenciones

- **P0**: riesgo de salida incorrecta, fuga de datos, promesa material falsa o pérdida de integridad.
- **P1**: fiabilidad, arquitectura o calidad que debe resolverse antes de ampliar producto.
- **P2**: deuda mantenible sin riesgo inmediato, pero que penaliza evolución.
- **P3**: mejora de producto / oportunidad.

Estados: `OPEN`, `PLANNED`, `IN_PROGRESS`, `DONE`, `WONT_DO`.

## Deuda activa

| ID | Prioridad | Área | Descripción | Estado |
|---|---|---|---|---|
| PRIV-001 | P0 | Runtime | Eliminar JavaScript/recursos de terceros del origen clínico | OPEN |
| PRIV-002 | P0 | Export | Separar Safe Output y Confidential Audit. RESUELTA (V4/T08 #12): servicios puros separados en app-v4/src/output (safe-output.ts: buildSafeOutput fail-closed sobre la autoridad ReviewSession T01, sin campos estructurales para correspondencias/notas/valores de auditoría; confidential-audit.ts + confidential-audit-serializer.ts: artefacto aparte marcado kind "confidential-audit"/confidential:true con línea CONFIDENTIAL y mapeo original↔reemplazo autorizado). Superficies UI duales e independientes en app-v4/src/export/ExportStep.tsx (safe-output.txt vs confidential-audit.txt, nunca una descarga combinada). Oráculo adversarial estructural (no por substring) en los tests de cada servicio; separación probada incluyendo fixtures con notas de revisor y texto legítimo con la palabra "note". Los originales conservados por decisión restaurada permanecen en Safe Output como decisión humana explícita y se exponen como aviso factual en el Privacy Gate. Legado *_anonimizado.pdf no reutilizado como autoridad V4. | DONE |
| FUNC-001 | P0 | Review | Derivar export/copy de la versión realmente revisada | OPEN |
| FUNC-002 | P0 | Batch | No marcar documento revisado por navegar/exportar | OPEN |
| FUNC-003 | P0 | Detection | Implementar detector/operador de edad en texto libre | OPEN |
| COPY-001 | P0 | Positioning | Eliminar claims de k-anonimato y privacidad diferencial no implementados | OPEN |
| FUNC-004 | P0 | Core | Sustituir truncado silencioso >1 MB por bloqueo explícito | OPEN |
| FUNC-005 | P1 | Dates | Diferenciar semántica/política de fechas; diseñar date shifting | OPEN |
| ARCH-001 | P1 | State | Crear ReviewSession como única fuente de verdad | OPEN |
| ARCH-002 | P1 | Review | Sacar estado de review de DOM/datasets | OPEN |
| FUNC-006 | P1 | Review | Evitar pérdida de progreso al añadir entidades manuales | OPEN |
| FUNC-007 | P1 | Review | Eliminar reconstrucción frágil de offsets desde DOM | OPEN |
| FILE-001 | P1 | Input | Corregir/eliminar soporte `.doc`. RESUELTA (V4/T06 #10): la superficie de entrada V4 no soporta `.doc` — `extractFile` devuelve un fallo tipado explícito `unsupported-format` con mensaje que nombra los tipos soportados (TXT, PDF, DOCX), y `.doc` no se anuncia en el atributo `accept` del input de archivos. La ruta legacy `.doc`→Mammoth permanece en el código legacy hasta el Work Order de retirada legacy (T25). | DONE |
| FILE-002 | P1 | PDF | Detectar PDFs escaneados/sin text layer. RESUELTA (V4/T06 #10): el adaptador PDF V4 (pdf.js vendido same-origin, `getDocument` con `isEvalSupported: false`, guard `check:pdfjs`) devuelve un fallo tipado explícito `pdf-no-text-layer` cuando un PDF estructuralmente válido no produce texto extraíble — nunca un éxito vacío silencioso. La detección legacy permanece sin cambios hasta el Work Order de retirada legacy (T25). | DONE |
| PRIV-003 | P1 | Logging | Eliminar logs de PHI/resultados | OPEN |
| BATCH-001 | P1 | Batch | Mantener documentos fallidos dentro del estado del batch | OPEN |
| BATCH-002 | P1 | Storage | Eliminar dependencia de sessionStorage para batch grande | OPEN |
| BATCH-003 | P1 | Consistency | ProcessingContext compartido y consistencia real entre documentos | OPEN |
| BATCH-004 | P1 | Code | Eliminar monkey patch de AsignadorSustitutos | OPEN |
| STRUCT-001 | P1 | Structured | UNKNOWN debe requerir revisión, no KEEP | OPEN |
| STRUCT-002 | P1 | Structured | Unificar autoridad de patient ID | OPEN |
| STRUCT-003 | P1 | CSV | Sustituir parser CSV artesanal | OPEN |
| STRUCT-004 | P1 | Profiling | Inferir columnas con muestra distribuida, no una fila | OPEN |
| STRUCT-005 | P1 | Dates | No mantener VISIT_DATE exacta por defecto en perfiles externos | OPEN |
| STRUCT-006 | P1 | Dates | Edad en fecha de visita, no edad actual | OPEN |
| STRUCT-007 | P1 | Excel | Selección de hoja | OPEN |
| STRUCT-008 | P1 | Excel | Normalizar seriales de fecha Excel | OPEN |
| STRUCT-009 | P1 | Coding | No codificar valores vacíos | OPEN |
| COPY-002 | P1 | Terminology | Usar seudonimizado/preparado salvo anonimización demostrable | OPEN |
| ARCH-003 | P1 | Core | Sustituir singletons mutables por engine/context instanciable | OPEN |
| ARCH-004 | P1 | Core | Separar Recognizers de Operators/Policies. RESUELTA (V4/T11 #15): frontera de registro materialmente implementada y consumida por el camino V4 real. `app-v4/src/engine/recognizer-registry.ts` + `legacy-recognizers.ts`: contratos de observación normalizada (solo "what is this?", sin transformed ni elección de operador), registro con fallo tipado `unknown-recognizer`/duplicados/malformados (D-009), adaptadores que envuelven el pipeline legacy de detección (D-003, sin reescritura) con oráculo de paridad bit-comparable vs Processor.process, oráculo de cobertura de taxonomía legacy con planted-omission que puede fallar, y oráculo de pureza (reconocimiento nunca resetea/muta managers de transformación). `operator-registry.ts` + `legacy-operators.ts`: contratos de operador ("what transformation applies?"), REDACT/PSEUDONYMIZE/DATE_TRANSFORM/GENERALIZE/KEEP espejo exacto de transformEntity aceptado, fallo tipado `unknown-operator` sin fallback silencioso, oráculos de paridad por categoría (ambos perfiles modoEstricto), pureza de estado y planted-violation. `policy.ts`: lookup headless puro con perfiles standard/strict (autoridad legacy modoEstricto + mapeo categoría→operador legacy) y fallo tipado para políticas sin mapeo aceptado. `registry-engine.ts`: motor V4 compuesto reconocimiento→política→operadores (nunca llama Processor.process), con paridad vs createLegacyEngine, invarianza de reconocimiento bajo cambio de operador/política (aceptación 1), fallos tipados de claves desconocidas y round-trip de ProcessingContext; cableado real en `review-domain.ts` (sin código muerto). Revisión nativa por unidad: review-340ad1f7f83a7b0e, review-970e0ac663819613, review-d4dda0995362d322, review-c9e6f359738cc727, review-a2f1b5e978558b14, review-ca481631d9c01f72 (correction_required, preservado como evidencia; ver reslice en odd/tasks/t11-recognizer-operator-registry.md), review-4ff4e586db53459b, review-cefa6aa795f293c0 — todas APPROVED + acknowledged/burned. Deuda nueva truthful: `scoring.descartadas` del legacy no se reproduce en el motor compuesto (no derivable por el contrato de observación WU1; sin consumidor V4); restaurarla requiere exponer observaciones descartadas en una unidad futura. | DONE |
| ARCH-005 | P1 | Contracts | Definir Detection contract | OPEN |
| ARCH-006 | P1 | Contracts | Definir ReviewDecision contract | OPEN |
| ARCH-007 | P1 | UI | Eliminar duplicación review.html / review-ui.js | OPEN |
| ARCH-008 | P1 | Legacy | Retirar batch-review-legacy y batch-structured-legacy | OPEN |
| CI-001 | P1 | CI | Ejecutar check:positioning/npm test en GitHub Actions | OPEN |
| CI-002 | P1 | CI | Check de cero recursos externos en origen clínico | OPEN |
| QA-001 | P1 | Tests | Corpus ground-truth y métricas precision/recall/FNR | OPEN |
| QA-002 | P1 | E2E | Suite Playwright de flujos críticos | OPEN |
| QA-003 | P1 | Security | E2E network privacy invariant | OPEN |
| PERF-001 | P1 | Performance | Web Worker para engine/batch | OPEN |
| PERF-002 | P2 | Performance | Lazy-load de parsers y exportadores | OPEN |
| PERF-003 | P2 | Performance | DictionaryIndex normalizado precomputado | OPEN |
| PERF-004 | P2 | Performance | Resolver conflictos por intervalos | OPEN |
| SUPPLY-001 | P1 | Dependencies | Build reproducible o vendor manifest con hashes/versiones. RESUELTA (T23, commit 1ccec6a): vendor manifest de lib/ y fonts/ con version/fuente/sha256 + check determinista `check:vendor` en CI; dependencias V4 reproducibles desde package-lock.json. | DONE |
| SEC-001 | P1 | Dependencies/Security | mammoth 1.12.0 vendido/declarado (`lib/mammoth.browser.min.js`, byte-idéntico al bundle browser de npm 1.12.0; dependencia declarada `^1.12.0`) depende de/incluye una línea antigua de `@xmldom/xmldom` con avisos de seguridad vigentes en 2026. RESUELTA para el runtime V4 (V4/T06 #10), con residual acotado a legacy. Ruta V4 efectiva: mammoth 1.12.0 de npm empaquetado por Vite (import dinámico, solo DOCX); `@xmldom/xmldom` actualizado dentro de rango 0.8.12 → 0.8.15 (solo lockfile; satisface el rango declarado `^0.8.6` por mammoth; NO es una actualización amplia). Advisories que afectan a 0.8.12: GHSA-j759-j44w-7fr8 / CVE-2026-41672 (inyección XML en serialización de comentarios), GHSA-F6WW-3GGP-FR8H / CVE-2026-41674 (inyección XML en serialización de DocumentType), GHSA-27p8-2357-5qqv (inyección de nombre DocType), GHSA-c7q8-3ch8-vqpv (inyección de PI target), GHSA-x4fp-j954-r2f4 (ReDoS de end-tag, CWE-1333), más DoS por recursión no controlada — todos parcheados en 0.8.13–0.8.15. Alcance por evidencia, sin claim de explotabilidad: los advisories de inyección en serialización requieren serializar con XMLSerializer un DOM no confiable; `mammoth.extractRawText` no re-serializa XML no confiable hacia la salida del producto. El DoS de parseo es alcanzable en principio desde un DOCX malicioso = DoS de CPU local del cliente (app local-first: el usuario parsea su propio archivo), sin ruta de exfiltración. Estado: OPEN con remediación V4 completa — la ruta V4 está remediada (mammoth 1.12.0 + `@xmldom/xmldom` 0.8.15; `npm audit` actual no reporta xmldom), pero la deuda NO puede cerrarse globalmente mientras persista el residual legacy ejecutable: `input.html` y `batch.html` cargan `lib/mammoth.browser.min.js` y el código legacy aún llama `mammoth.extractRawText` sobre esa pila antigua. Propietario de la retirada/eliminación del residual: T25 (retirada legacy), que debe eliminar o actualizar el bundle vendido; no se reescribe/actualiza la pila Mammoth legacy en esta corrección. | OPEN |
| SEC-002 | P1 | Dependencies/Security | pdfjs-dist 3.11.174 vendido (`lib/pdf.min.js`) afectado por CVE-2024-4367 en la ruta por defecto de `getDocument({ data })`. Mitigado en todas las llamadas activas con `isEvalSupported: false` (pase correctivo; guard determinista `check:pdfjs` en CI). La actualización a una release de PDF.js parcheada queda como deuda abierta para un ticket acotado futuro. | OPEN |
| CODE-001 | P2 | Quality | ESLint + Prettier. RESUELTA (T23, commit 1ccec6a): prettier 3.9.9 fijado, scripts `format:v4` / `format:check:v4` y step de CI "Check V4 formatting". | DONE |
| CODE-002 | P2 | Types | TypeScript o JSDoc + @ts-check | OPEN |
| CODE-003 | P2 | Errors | Sustituir alert() por errores/estados de UI | OPEN |
| GOV-001 | P1 | Governance | Consolidar rama canónica | OPEN |
| GOV-002 | P1 | Governance | Branch protection y CI required | OPEN |
| GOV-003 | P1 | Versioning | Unificar versión README/package/runtime | OPEN |
| DOC-001 | P1 | Docs | Actualizar especificación técnica a arquitectura real | OPEN |
| UX-001 | P1 | UX | Auditoría completa SPA/app-shell y navegación | DONE |
| UX-002 | P1 | Journey | Eliminar doble landing index → app antes del workspace | OPEN |
| UX-003 | P1 | Journey | Unificar entrada en New Privacy Job con inferencia por tipo de input | OPEN |
| UX-004 | P1 | Batch | Integrar batch como capacidad natural, eliminar framing Premium/Activar | OPEN |
| UX-005 | P1 | Design System | Unificar texto/documentos/batch/structured en un único sistema visual | OPEN |
| UX-006 | P0 | Export UX | No mostrar/habilitar Safe Export antes de completar Privacy Gate. RESUELTA (V4/T08 #12): el paso privacy-gate (app-v4/src/privacy-gate) muestra el estado factual y el mensaje bloqueado explícito mientras queden decisiones obligatorias pendientes; el paso export (app-v4/src/export/ExportStep.tsx) deshabilita Safe Output con la razón tipada (role=alert) hasta canFinalize; Job.outputs.safeOutputReady solo es true cuando la sesión finaliza (useJobSession deriva del gate T01). Navegación export bloqueada por el gate dominio review-incomplete (T04/T07) y probada end-to-end en App.test.tsx (flujo completo pendiente/completo). | DONE |
| UX-007 | P2 | Content | Sustituir disclaimer rojo permanente por aviso contextual | OPEN |
| UX-008 | P1 | Policy UX | Sustituir Strict Mode opaco por Privacy Policies explicables | OPEN |
| UX-009 | P1 | Review | Consolidar cards/action bar/modal en un único Entity Inspector. RESUELTA (V4/T07 #11): el workspace de revisión V4 usa un único Entity Inspector (panel derecho con original, propuesta, tipo/subtipo, confianza, contexto, controles de decisión y nota); no existen cards, action bar ni modal flotante en la superficie V4 (SPEC_V4_APP_AND_REVIEW.md §5: "no floating action bar"). Las superficies legacy (review.html / js/shared/review-ui.js) permanecen como evidencia de compatibilidad hasta el Work Order de retirada legacy (T25). | DONE |
| UX-010 | P1 | Responsive | Diseñar layouts desktop/tablet/mobile para superficies operativas. PARCIAL (V4/T07 #11): la superficie de revisión V4 usa un grid responsive (tres paneles en desktop, apilado en tablet/móvil) con document surface, filtros/progreso e inspector accesibles sin hover-only ni color-only; las demás superficies operativas (configuración avanzada, privacy gate, export, batch/structured) siguen pendientes de sus tickets. | OPEN |
| UX-011 | P1 | Accessibility | Corregir contraste del primary operativo y estados de foco. RESUELTA (V4/T07 #11): las superficies V4 (shell T06 + workspace de revisión T07) usan primary-dark #966a60 para acciones operativas (4,63:1 sobre blanco, AA para texto normal según la paleta Tailwind compilada de app-v4/tailwind.config.cjs) y anillos focus-visible en todos los controles. Las superficies legacy permanecen hasta T25. | DONE |
| UX-012 | P1 | Accessibility | Hacer tooltips/actions accesibles por teclado y touch. RESUELTA (V4/T07 #11): el workspace de revisión V4 no usa tooltips hover-only ni controles de solo icono; toda acción tiene etiqueta visible (y aria-label cuando el nombre accesible lo requiere), es operable por teclado/touch y muestra foco visible. Superficies legacy pendientes hasta T25. | DONE |
| UX-013 | P2 | Review | Añadir shortcuts de revisión y navegación de pendientes. ABIERTA (V4/T07 #11): la revisión V4 es completamente operable por teclado (controles nativos con foco visible), pero no existe autoridad aceptada que especifique atajos dedicados de revisión o navegación de pendientes (SPEC_V4_APP_AND_REVIEW.md §5 no los define); no se inventa un vocabulario de atajos sin spec. | OPEN |
| UX-014 | P1 | Review | Convertir low-confidence/descartados en workflow visible | OPEN |
| UX-015 | P1 | Structured | Rediseñar configuración de columnas como classification workspace | OPEN |
| UX-016 | P1 | Session | Mostrar job/policy/local-only/clear session persistentemente en app shell | OPEN |
| ARCH-009 | P1 | Frontend | Migración incremental a SPA Vite + TypeScript + React | PLANNED |
| ARCH-010 | P1 | Frontend | Mantener core detrás de adapter durante migración; no big-bang rewrite | PLANNED |
| ARCH-011 | P2 | Export/Audit | Detecciones con requiresReview=false pueden producir en Confidential Audit entradas de mapeo con status "pending" mientras trace.pending=0 y canFinalize=true (la semántica de decisión para detecciones de revisión opcional no está definida). No alcanzable por el adaptador V4 actual (T05/T06 defaults requiresReview=true); detectada como observación no bloqueante en la auditoría de promoción de PR #39. RESUELTA (V4/T11 #15 WU4): `js/domain/review-session.js` añade `getEffectiveStatus` como derivación única del estado de decisión (decisión almacenada; `pending` si requiresReview y sin decidir, fail-closed; `not-required` factual si la política marcó revisión no requerida y no hay decisión humana — NUNCA "accepted" silencioso), sin cambiar ninguna semántica T01 existente (getDecision, getPendingDetections, canFinalize, getProgress, getFinalText, defaults requiresReview=true de T05/T06 intactos). `app-v4/src/output/confidential-audit.ts` consume esa autoridad y `isConfidentialAudit` valida coherencia estructural: entradas "pending" del mapeo === trace.pending, y canFinalize ⇔ pending=0; la derivación antigua contradictoria y las mentiras de trace (canFinalize=true con pendings, recuento falso) se rechazan fail-closed con planted cases que demuestran que el oráculo puede discrepar. Serializer refleja el estado factualmente. Oracle determinista: requiresReview=true sin decidir mantiene "pending", MANDATORY_REVIEW_PENDING y canFinalize=false (fail-closed sin cambios). Revisión nativa: review-35a0367af1a60d01 APPROVED + acknowledged/burned (revisión consumida sha256:b72731462e3828c9a0b3ee953730745d1cec714b7b16b0d80c58d87675f9041d). | DONE |
| HOST-001 | P0 | Origins | Separar marketing/docs y aplicación clínica en orígenes distintos | OPEN |
| HOST-002 | P1 | Deploy | Adoptar target estático con security headers; Render Static recomendado para fase actual | PLANNED |
| HOST-003 | P1 | Availability | Evaluar riesgo LaLiga/bloqueo IP compartida por proveedor antes de producción clínica | OPEN |
| HOST-004 | P2 | Experiment | Test controlado de Cloudflare durante ventanas de partido antes de reconsiderarlo | OPEN |
| HOST-005 | P2 | Resilience | Definir fallback a origen/IP propia si la disponibilidad clínica lo exige | OPEN |
| PRODUCT-001 | P3 | Dates | Date shifting consistente | OPEN |
| PRODUCT-002 | P3 | Identity | Pseudónimos deterministas sin inferir género | OPEN |
| PRODUCT-003 | P3 | Policy | Perfiles de política de privacidad | OPEN |
| PRODUCT-004 | P3 | Review | Bandeja de candidatos low-confidence/descartados | OPEN |
| PRODUCT-005 | P3 | UX | Privacy Gate final | OPEN |
| PRODUCT-006 | P3 | Structured | Clasificación Identifier/Quasi/Sensitive/Insensitive | OPEN |
| PRODUCT-007 | P3 | Risk | ARX-lite: unicidad/equivalence classes | OPEN |
| PRODUCT-008 | P3 | Extensibility | Recognizer plugins y diccionarios institucionales | OPEN |
| PRODUCT-009 | P3 | NLP | NER local opcional | OPEN |
| PRODUCT-010 | P3 | OCR | OCR local | OPEN |
| PRODUCT-011 | P3 | Interop | FHIR JSON adapter | OPEN |
| PRODUCT-012 | P3 | PDF | Reconstrucción/redacción manteniendo layout | OPEN |
| PRODUCT-013 | P3 | Research | Correspondencia cifrada opcional / HMAC study IDs | OPEN |


## Observaciones de auditoría post-T03

Estas observaciones no bloquearon T03/PR #33, pero deben permanecer trazables hasta resolverse en el momento de implementación adecuado. No crear deuda duplicada: cada observación se vincula a un ID existente.

| Observación | Deuda propietaria | Evidencia T03 | Momento recomendado | Estado |
|---|---|---|---|---|
| T03-AUDIT-001 | `SUPPLY-001` (T23 #27) | En una reproducción limpia de PR #33, `npm run build` regeneró el `css/tailwind.generated.css` legacy con un SHA-256 distinto al fichero commiteado, aunque el build terminó correctamente. T03 no modifica ese artefacto legacy. RESUELTA (T23, commit 1ccec6a + verificación correctiva posterior): rebuild limpio de `css/tailwind.generated.css` produce SHA-256 `49613e5e66383f26d1bea58467c0243d2b186c7da660d642e93681860978a8d9`, que coincide con el artefacto commiteado; la verificación final se re-ejecuta tras todos los cambios correctivos. | Resolver en T23/reproducibilidad de dependencias y CI, o antes si un ticket convierte la limpieza post-build o ese artefacto generado en requisito de aceptación. | DONE |
| T03-AUDIT-002 | `CODE-001` | T03 incorpora ESLint para `app-v4`, pero Prettier continúa sin estar configurado; por tanto `CODE-001` queda solo parcialmente abordada. RESUELTA (T23, commit 1ccec6a): prettier 3.9.9 fijado con `format:v4` / `format:check:v4` y step de CI "Check V4 formatting", completando `CODE-001` (ver arriba). | Incorporar formatter cuando se consolide la superficie TS/React y antes de que el volumen de componentes haga costosa una normalización masiva; no bloquear por sí sola un Work Order funcional anterior. | DONE |

Cierre de estas observaciones: actualizar primero el ID propietario (`SUPPLY-001` / `CODE-001`) y conservar esta evidencia histórica enlazando el PR/commit que las resuelva.

## Deuda ya identificada en la primera auditoría y absorbida por este registro

El registro anterior incluye explícitamente:
- límites de origen y MailerLite;
- PDFs con originales;
- falsa certificación de review;
- local-first no enforced;
- positioning CI no ejecutado;
- lenguaje legal contradictorio;
- monkey patch de batch;
- benchmark insuficiente;
- desalineación de ramas/docs/versiones;
- legacy duplicado;
- truncado;
- supply chain vendorizado;
- CSP/origin hardening;
- terminología anonimización vs seudonimización.

No eliminar estas entradas al crear issues: cada issue debe enlazar el ID de deuda correspondiente.
