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
| SUPPLY-001 | P1 | Dependencies | Build reproducible o vendor manifest con hashes/versiones | OPEN |
| CODE-001 | P2 | Quality | ESLint + Prettier | OPEN |
| CODE-002 | P2 | Types | TypeScript o JSDoc + @ts-check | OPEN |
| CODE-003 | P2 | Errors | Sustituir alert() por errores/estados de UI | OPEN |
| GOV-001 | P1 | Governance | Consolidar rama canónica | OPEN |
| GOV-002 | P1 | Governance | Branch protection y CI required | OPEN |
| GOV-003 | P1 | Versioning | Unificar versión README/package/runtime | OPEN |
| DOC-001 | P1 | Docs | Actualizar especificación técnica a arquitectura real | OPEN |
| UX-001 | P1 | UX | Auditoría completa SPA/app-shell y navegación | PLANNED |
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
