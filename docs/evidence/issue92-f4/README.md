# REC-12 · F4: reconciliación de testigos existentes y triage de 23 pendientes (§92)

Fecha: 2026-11-21. Estado: `EVIDENCE_REUSE_LOCALLY_VERIFIED / NOT_FINAL_RECOVERY_PASS`.
**Base exacta:** GitHub `3.0-main@6880082271a3f18719497930f4ee29d1596b6d6c`.
Sin modificaciones de React, engine, tests, flujo clínico ni exportadores. No es auditoría de privacidad ni autorización de despliegue. Los tests usan datos sintéticos.

## 1. Hallazgo clave — DISC-02 ya cuenta con testigo adversarial en la base

La matriz congelada §E y el README B3 documentaban DISC-02 como precondición abierta y describían ausentes los testigos adversariales `Error.name`. La lectura del **código integrado** muestra que:
- `app-v4/src/export/ExportStep.tsx:693–696`: `batchSummaryDiagnostic` preserva solo `BatchSummaryError.code` tipado; cualquier otro fallo queda `unexpected-error`.
- `app-v4/src/export/ExportStep.tsx:718–721`: `batchSafeDiagnostic` preserva solo `BatchSafeDeliverablesError.code` tipado; inesperados `unexpected-error`.
- `app-v4/src/export/ExportStep.batchSummaryDiagnostic.test.tsx`: un `Error` inesperado recibe `name=NOMBRE_SINTETICO_CSV_SENTINEL` y mensaje sintético; prueba ninguna descarga (`URL.createObjectURL` cero), aviso español, `data-batch-summary-diagnostic=unexpected-error` y ausencia de ambos sentinel en `document.documentElement.outerHTML`.
- `app-v4/src/export/ExportStep.batchSafe.test.tsx`: tests separados para rechazo asíncrono en ZIP y PDF consolidado con `name=NOMBRE_SINTETICO_SAFE` y mensaje sensible sintético; en ambos hay 0 descargas, aviso español, código fijo en DOM y no hay sentinels en `outerHTML`.
- `scripts/ci/check-external-resources.mjs --scope=source` rechaza las llamadas `console.*` de runtime; `--self-test` contiene un caso plantado `src-console`. El testigo dinámico cubre DOM y bytes; el guard estático de origen cubre logs; **no** sustituye una auditoría global de canales de error/logs.

### Ejecución real local — 21/11/2026

| Comprobación | Resultado |
|---|---|
| `vitest run` las suites `ExportStep.batchSummaryDiagnostic`, `ExportStep.batchSafe`, `registry-engine` y `legacy-engine` | **4/4 ficheros; 102/102 tests PASS** |
| `node scripts/ci/check-external-resources.mjs --scope=source` | **PASS**, 85 archivos runtime, regla no-console activa |
| `node scripts/ci/check-external-resources.mjs --self-test` | **19/19 casos de violación/limpieza PASS** (incluye `src-console`), limpieza de sandbox OK |
| `node --test scripts/ci/rec12-b3-ledger.test.mjs` | **2/2 PASS**, 142 identidades y referencias verificadas |
| Ausencia en árbol de rutas de `review.html`, `review-ui.js`, `batch-review-legacy`, `batch-structured-legacy`; ausencia de `alert()` directo en `app-v4/src` sin tests | **Sin coincidencias** por árbol y lectura de origen; comprobación manual, **no gate nuevo** |

Advertencias PDF.js en jsdom: fuente estándar LiberationSans y `canvas` opcional no disponibles; la suite **terminó verde**. No afirmar equivalencia visual PDF por esas pruebas.

**Disposición propuesta:** `DISC-02: TESTIGO ADVERSARIAL EXISTENTE + GATE ESTÁTICO EJECUTADOS`. Esta evidencia contradice la descripción antigua “no ejecutado” del B3, pero **no se modifica el ledger histórico ni se cambia el riesgo a PASS general**; integrar la conciliación final en #92 y confirmar en CI Node20 para el commit que realmente se publique.

## 2. Triage específico de los 23 PENDING_COMPOSED (ledger B3 original sin modificar)

| ID(s) | F4: evidencia real / próximo control | Disposición prudente |
|---|---|---|
| `PRIV-003` | El guard no-console del runtime ya existe, fue ejecutado y se auto-prueba con violación plantada. No equivale a examinar todos los errores del navegador | `WITNESS_REUSED_SCOPE_LIMITED` |
| `BATCH-004` | En `registry-engine.test.ts` y `legacy-engine.test.ts` se comparan referencias y `Reflect.ownKeys` de `AsignadorSustitutos` tras procesar; ambas suites ejecutadas en F4 | `WITNESS_REUSED` |
| `ARCH-007`, `ARCH-008` | Las rutas legacy de Revisión y lote no están presentes en el árbol de V4; los recorridos V4 existen; ausencia comprobada pero no gate permanente | `STATIC_OBSERVED` |
| `CODE-003` | No aparece `alert()` directo en fuente runtime V4 fuera de tests; sin checker duradero | `STATIC_OBSERVED` |
| `CODE-001` | Prettier, ESLint y TypeScript en scripts y workflow; ver ejecución F4 y CI del SHA | `EXISTING_GATES` |
| `ARCH-009`, `ARCH-010` | Arquitectura Vite/React/TS y adaptador legacy (no big-bang) se constatan en código; no son invariantes funcionales que se demuestren mediante un E2E adicional | `ARCHITECTURAL_REVIEW` |
| `QA-002` | Suite compuesta para todos los materiales con errores y recuperación todavía incompleta | `COMPOSED_REQUIRED` |
| `CI-001` | Se verificó el hueco: 13/18 subcomandos de `npm test` en el workflow anterior; la rama F4 propone ejecutar la cadena **completa una vez** y mantener E2E y las autopruebas extra. Aún sin ejecución del nuevo workflow en GitHub | `CI_FIX_LOCAL_PENDING_REMOTE` |
| `PERF-002` | Falta test de carga diferida de parsers/exportadores; no inferirlo por lectura | `TEST_REQUIRED` |
| `GOV-001`, `GOV-002`, `GOV-003`, `DOC-001` | Documentos/topología/default branch/protección y especificación final deben reconciliarse con autoridad real | `#93_GOVERNANCE` |
| `UX-001`, `UX-002`, `UX-007` | Experiencia SPA + origen clínico + avisos contextuales; parte es comprobación renderizada y parte requiere evidencia HTTP | `UI_HOST_PROOF_REQUIRED` |
| `HOST-001`, `HOST-002` | Separación de orígenes, política de cabeceras y despliegue final no pueden declararse completos desde configuración | `#93_DEPLOYMENT` |
| `H-01`, `PDR-08` | Barrido completo de español profesional en estados críticos pendiente; no basta REC-10 ni el 28/28 del corpus | `LANGUAGE_QA_REQUIRED` |
| `H-03` | JetBrains Mono no aparece instalado/importado; obligación tipográfica de fuente y autoridad UX, no bloque de seguridad clínica | `VISUAL_DEBT / HUMAN_DECISION` |

**Conteo:** 23 filas cubiertas por clasificación F4 sin reescribir etiquetas de B3. Nota: DISC-02 es sección E, **fuera** de las 142 filas y fuera de los 23.

## 3. Orden recomendado tras esta reconciliación

1. **CI-001:** propuesta local lista; **no afirmar cierre hasta PR + GitHub Actions Node20 en verde**. Antes, revisar el diff único del workflow y verificar los checks de rama protegida.
2. **PERF-002 + QA-002:** testigos reproducibles de lazy-load y recorrido compuesto con errores/recuperación (material sintético, preservando autoridades).
3. **H-01/PDR-08 + UX/host:** QA de español real por estados, acceso SPA y privacidad de origen.
4. **GAP-01/GAP-03:** benchmarks escalados + coverage/Dependabot con cifras reales o decisión humana expresa de deuda.
5. **#93:** conciliación documental y publicación definitiva después de demostrar #92. **Recomposición visual F3** tras ese cierre, conforme a decisión del 14/10, salvo GO humano específico contrario.

**Bloqueadores no resueltos:** cierre conjunto de #92; DISC-02 solo con evidencia local sobre SHA actual; validación por CI Node20 y publicación futuras; decisiones humanas pendientes y dos posibles secretos históricos sin autenticar (separado, sin exponer).

## 4. CI-001 — corrección de cobertura de gates, solo candidata local

De los **18** subcomandos encadenados por `npm test`, el workflow previo ejecutaba **13**. Los cinco ausentes eran `test:benchmarks`, `test:perf-core`, `bench:engine:selftest`, `check:headers:selftest` y `check:preview:selftest`.

La **única modificación de CI** en F4 sustituye duplicaciones parciales de validate por `npm test` **después de `npm run build`**. Se mantienen el smoke de entrypoints, los cuatro self-tests adversariales (`check:external:selftest`, `check:pdfjs:selftest`, `check:storage:selftest`, `check:release-qa:selftest`), Prettier, TypeScript, ESLint y el **job `e2e` Playwright** separado. No se tocan los nombres de jobs ni las protecciones de rama.

**Comprobación exacta sobre el código sin modificar:** `npm run build && npm test` **EXIT 0**, `91/91` suites Vitest y `1557/1557` tests; benchmark-selftest 7/7 y ground truth 28/28 incluidos. El tiempo local conjunto fue ~96 s, con Node 24. El conjunto completo de cuatro autopruebas adversariales adicionales terminó **EXIT 0** (incluida una violación de almacenamiento plantada). `npm run format:check:v4`, `npm run lint:v4` y `npm run typecheck:v4` también **EXIT 0**. El YAML de Actions se analizó con PyYAML: exactamente un paso `npm test`, los cuatro selftests y el job E2E intacto.

**Pendiente para cierre:** ejecutar ese nuevo workflow en GitHub Actions con Node20 tras autorización de push/PR; conservar resultados y auditar que la sustitución no omite ningún gate material. Esta evidencia local no suplanta el job remoto ni garantiza el mismo resultado en Node20.
