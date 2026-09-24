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
| PRIV-002 | P0 | Export | Separar Safe Output y Confidential Audit | OPEN |
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
| FILE-001 | P1 | Input | Corregir/eliminar soporte `.doc` | OPEN |
| FILE-002 | P1 | PDF | Detectar PDFs escaneados/sin text layer | OPEN |
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
| ARCH-004 | P1 | Core | Separar Recognizers de Operators/Policies | OPEN |
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
| SEC-001 | P1 | Dependencies/Security | mammoth 1.12.0 vendido/declarado (`lib/mammoth.browser.min.js`, byte-idéntico al bundle browser de npm 1.12.0; dependencia declarada `^1.12.0`) depende de/incluye una línea antigua de `@xmldom/xmldom` con avisos de seguridad vigentes en 2026. Existen advisories; NO se ha demostrado explotabilidad en el uso que hace este producto. Remediación diferida al trabajo de document-adapters (V4/T06 #10), que debe evaluar la actualización del stack DOCX; la actualización amplia queda explícitamente fuera del alcance del pase correctivo. | OPEN |
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
| UX-006 | P0 | Export UX | No mostrar/habilitar Safe Export antes de completar Privacy Gate | OPEN |
| UX-007 | P2 | Content | Sustituir disclaimer rojo permanente por aviso contextual | OPEN |
| UX-008 | P1 | Policy UX | Sustituir Strict Mode opaco por Privacy Policies explicables | OPEN |
| UX-009 | P1 | Review | Consolidar cards/action bar/modal en un único Entity Inspector | OPEN |
| UX-010 | P1 | Responsive | Diseñar layouts desktop/tablet/mobile para superficies operativas | OPEN |
| UX-011 | P1 | Accessibility | Corregir contraste del primary operativo y estados de foco | OPEN |
| UX-012 | P1 | Accessibility | Hacer tooltips/actions accesibles por teclado y touch | OPEN |
| UX-013 | P2 | Review | Añadir shortcuts de revisión y navegación de pendientes | OPEN |
| UX-014 | P1 | Review | Convertir low-confidence/descartados en workflow visible | OPEN |
| UX-015 | P1 | Structured | Rediseñar configuración de columnas como classification workspace | OPEN |
| UX-016 | P1 | Session | Mostrar job/policy/local-only/clear session persistentemente en app shell | OPEN |
| ARCH-009 | P1 | Frontend | Migración incremental a SPA Vite + TypeScript + React | PLANNED |
| ARCH-010 | P1 | Frontend | Mantener core detrás de adapter durante migración; no big-bang rewrite | PLANNED |
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
