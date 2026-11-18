# REC-12 · Etapa B3 — registro de evidencia por fila (#92)

**Estado:** contabilidad de evidencia completa (142/142 filas de matriz), **no** un veredicto funcional de producto. Ninguna fila de este registro autoriza publicación, ni declara cumplimiento, seguridad, anonimato o readiness clínica. El cierre solo puede obtenerse tras ejecución y revisión independientes.

**Base de producto declarada:** `184acc6d36b4e97a86bd6ba4153c92525a0135f0` (`source_sha` en `ledger.json`). **Autoridades:** GitHub #92; contrato `docs/evidence/issue92-b3/CONTRACT.md`; fuente Stage A `docs/evidence/issue92-source-completeness/README.md`; matriz `docs/audits/2026-10-recovery-traceability-matrix.md` §A/§B/§C/§E/§F; decisiones `docs/shaping/CURRENT_DECISIONS.md`; autoridad visual `docs/design/sophilux-b-v1/ACCEPTED_VISUAL_CONTRACT.md` y su registro de fidelidad. **GO humano:** solo implementación + QA local, sin publicación.

## 1. Qué es y qué no es este registro

- **Es** una contabilidad ejecutable: cada una de las 142 filas congeladas de la matriz (88 §A + 42 §B + 12 §C) tiene una entrada con `section`, `id`, `disposition`, `reason` específica de su obligación y `evidence` con rutas reales del repositorio.
- **No es** una afirmación de comportamiento recuperado. Una etiqueta describe **calidad de evidencia disponible**, no un veredicto de producto.
- **No existe** etiqueta `PASS`. Un test citado no cierra su fila: solo aporta una faceta concreta inspeccionada.
- **No altera** conteos de matriz, decisiones (D-013, D-019, D-020, D-021, D-023), engine, privacidad, export, tests, checks, fixtures ni documentos canónicos.

El test de integridad `scripts/ci/rec12-b3-ledger.test.mjs` es inmutable y exige: IDs exactos congelados, 142 filas sin duplicados, `source_sha` exacto, disposiciones de la lista cerrada, `reason` no vacía y **toda ruta de evidencia existente**.

## 2. Aritmética de fuentes (sin alterar conteos)

| Conjunto | Conteo | Estado en este registro |
|---|---:|---|
| Obligaciones materiales Stage A (S1 98 + S2 54 + S3 42 + S4 12) | **206** | invariante |
| Checkpoint histórico Stage A | 197 ROW + 2 SUPERSEDED + 7 GAP = **206** | preservado como histórico |
| Tras adjudicación humana 2026-10-13 | 204 ROW + 2 SUPERSEDED + 0 sin mapear = **206** | siete obligaciones siguen **no verificadas o fuera de alcance** (§6) |
| Matriz §A / §B / §C | **88 / 42 / 12 = 142** | filas exactas del ledger, sin renumeración |
| Matriz §E post-review | **2** (`DISC-01`, `DISC-02`) | fuera de 142; solo nota en este README |
| Matriz §F addendum | **7** (`REC12-GAP-01..07`) | fuera de 142; solo nota en este README |

La corrección **F3 de Stage A** (no confundir con **F3 visual** de fidelidad) de la revisión documental se mantiene vigente: la no-paridad `.doc` **no** es una supersesión humana; es la alternativa sancionada por la propia auditoría congelada (P1-05: retirar o parsear correctamente) y queda en `FILE-001` / `H-08`, sin cargar supersesión.

## 3. Distribución de disposiciones (derivada del propio ledger)

| Disposición | Filas |
|---|---:|
| `EXISTING_WITNESS_REUSE` | 100 |
| `PENDING_COMPOSED` | 23 |
| `POST_RECOVERY_DEBT` | 14 |
| `PENDING_HUMAN` | 2 |
| `HUMAN_SUPERSEDED` | 2 |
| `TARGETED_WITNESS` | 1 |
| **Total** | **142** |

`TARGETED_WITNESS` queda en 1 por `BATCH-002` (testigo B3 de no persistencia) y no significa PASS universal: el testigo B3 nuevo (`e2e/rec12-b3-witness.spec.ts`) prueba las obligaciones §F `REC12-GAP-04`, `REC12-GAP-05` y `REC12-GAP-07`, que **no** son filas de las 142. Se cita solo como faceta adicional en `BATCH-002` (ausencia de almacenamiento silencioso) y `UX-011` (identificación no cromática), sin declarar PASS ni cierre de fila.

## 4. Método de correlación

1. Leer la matriz real y extraer las 142 filas con el mismo criterio del test (encabezados `## A.`…`## D.`).
2. Inspeccionar únicamente testigos materialmente pertinentes (E2E Playwright, Vitest, contratos `node --test` y checks de CI) y asignar una ruta **solo** si prueba al menos una faceta concreta de esa fila.
3. Regla estricta del contrato: toda fila §A/§B que no pueda correlacionarse a test material permanece `PENDING_COMPOSED`, aunque la matriz diga `VERIFIED_RESOLVED`.
4. En §C se conservan los testigos existentes con su matiz de densidad, privacidad, UX y visual; una fila §C no se usa para compensar una laguna §A/§B.
5. `HUMAN_SUPERSEDED` solo con decisión humana trazable y ruta de autoridad: `UX-016` (HPD V1 / D-023) y `H-36` (D-023). No se usa para `.doc`, que es no-paridad sancionada por la auditoría, no supersesión.

## 5. Lecturas honestas por bloque

- **§A (88):** la mayoría se apoya en oráculos deterministas reales (engine, ReviewSession, estructurado, export, checks de CI). Siguen `PENDING_COMPOSED` propiedades que no tienen test material: logs de PHI (`PRIV-003`), ausencia de monkey patch (`BATCH-004`), retirada de código legacy (`ARCH-007`/`ARCH-008`), cadena CI completa (`CI-001`), lazy-load (`PERF-002`), `alert()` (`CODE-003`), gobernanza/documentación (`GOV-001..003`, `DOC-001`), topologías de origen/headers (`HOST-001`, `HOST-002`) y aviso contextual (`UX-007`).
- **Deuda explícita declarada (`POST_RECOVERY_DEBT`, 14):** `STRUCT-003`, `ARCH-003`, `ARCH-005`, `CODE-002` y las capacidades futuras `HOST-003..005`, `PRODUCT-007..013`. No se completan por inferencia.
- **§B (42):** 38 filas se vinculan a testigos concretos tras reconocer los atajos probados; `H-01` (idioma global) y `H-03` (tipografía Mono) requieren prueba/decisión, `H-36` es supersesión humana y `H-02` exige contraste visual humano. Un testigo reutilizado no cierra por sí solo su fila.
- **`PENDING_HUMAN` en §A:** solo `UX-005`, porque la coherencia del sistema visual en siete superficies exige comparación renderizada en igual estado/viewport y decisión humana; las capturas existentes no sustituyen esa comparación.
- **§C (12):** once con testigo E2E/unitario existente; `PDR-08` permanece `PENDING_COMPOSED` porque el barrido exhaustivo del español actual no está demostrado en todos los estados.

## 6. Fidelidad visual, estado F3/Entrada A–E y las 7 vistas

- **Entrada A–E:** el GO visual local y capturas de 13/11 fueron anteriores a publicación; el PR #130 se integró en `3.0-main` el 14/11 y se desplegó automáticamente. El hecho de estar publicada **no prueba** por sí solo la fidelidad visual actual frente al maestro aceptado ni cierra Revisión. Fuentes: `docs/evidence/entrada-ae-20261113/RESULTADOS.md` y PR #130.
- **El registro de fidelidad histórico sigue `DRIFT_OPEN`** para *Entrada · control de modalidad*, *Revisión · superficie dominante* y *Revisión · continuidad cognitiva* (`docs/design/sophilux-b-v1/IMPLEMENTATION_FIDELITY_REGISTER_20261014.md`). Lote, Estructurado, Celdas, Comprobación y Resultado figuran allí como `NOT_CHECKED` histórico, no como PASS.
- **Las 7 vistas solo son comparables con capturas del mismo estado y viewport.** Las capturas de `docs/evidence/issue91-u*/` (1440/375) y las de Entrada A–E ofrecen dimensiones de referencia, pero NO prueban automáticamente el mismo estado poblado ni una comparación ya realizada; mezclar estados vacíos/poblados o viewports distintos no es comparación válida.
- **Contraste:** `e2e/gate-export-ux.spec.ts` mide pares de texto cambiados contra el fondo compuesto y `e2e/policy-guidance.spec.ts` hace lo propio en su superficie; ninguna de esas mediciones cubre las **7 vistas Sophilux completas**. El contraste de las 7 vistas queda pendiente y **no** se declara PASS. Tampoco se decide aquí rediseño alguno: la prioridad aceptada es función y privacidad (#92) antes de recomposición UX.
- La deuda de fidelidad se mantiene como `LAB_SOPHILUX_B_V1_FIDELITY_DEBT_OPEN`; este registro no la cierra ni la reabre.

## 7. Evidencia por GAP (§F, fuera de las 142)

| GAP | Obligación | Estado real en B3 | Falta |
|---|---|---|---|
| GAP-01 | Benchmarks versionados 10/100/500 KB/1 MB; 1/10/50 documentos; latencia, memoria, responsividad | **Pendiente.** `scripts/benchmarks/engine-bench.mjs` existe como mecanismo, sin artefacto versionado por niveles | Benchmark versionado o decisión humana de deuda post-recuperación |
| GAP-02 | DICOM como horizonte lejano | `FUTURE_NOT_RECOVERY` trazable en §F; sin implementación | Nada para cierre; solo falsable si se reclama capacidad DICOM |
| GAP-03 | CodeQL, Dependabot/Renovate, cobertura | CodeQL **sí tiene ejecución verificada**: postmerge PR #134 run `44204705304` SUCCESS sobre `184acc6`; Dependabot configurado, sin prueba de estado/ejecución; medición real de cobertura pendiente | Estado real de dependencia + coverage; documentar en #93 |
| GAP-04 | Identificación de tipo no cromática | Testigo nuevo `e2e/rec12-b3-witness.spec.ts` ejecutado **2/2 PASS** a 375/1280: tipo textual visible en lista, etiqueta accesible y subrayado real con filtro grayscale, con capturas sintéticas | Comparación humana visual completa y CI Node20 del testigo nuevo pendientes |
| GAP-05 | Sin PHI en URL/query/hash y cabeceras del origen clínico | Testigo compuesto B3 URL **PASS**; inspección HTTPS viva de Render el 18/11 devolvió HTTP 200 con `Referrer-Policy: no-referrer`, CSP `frame-ancestors 'none'` y `X-Frame-Options: DENY` | Smoke final #93 sobre publicación definitiva; no extrapolar a otros orígenes |
| GAP-06 | Edad en export estructurado fuera del entorno controlado | D-021 humana preserva `Edad_Num` exacto con `keep` (34/35/41) en CSV y XLSX; DOB derivada conserva banda por T19. Testigos actuales `structured-export.test.tsx` ejecutados **15/15 PASS** en B3, sin cambios de política | Trazar decisión y evidencia en cierre #92, no rehacer tests positivos ni alterar D-021 |
| GAP-07 | Recuperación local opt-in, nunca persistencia silenciosa | Testigo compuesto B3 **PASS**: `localStorage`, `sessionStorage` e `IndexedDB` sin claves clínicas y ninguna restauración tras recarga; `check:storage` incluido en `npm test` | Alcance de las otras tecnologías de persistencia y futura opt-in si se introduce, no declarar certificación general |

## 8. G-HP1–10: testigos actuales y huecos no falsificados

| Gate | Testigo actual | Hueco no falsificado |
|---|---|---|
| G-HP1 Primacía de tarea | `e2e/input-start.spec.ts` (tarea visible y antes que la guía, 375/1280); `e2e/ux-closeout-shell.spec.ts` | Primacía en estados poblados de todas las superficies |
| G-HP2 Sin no-op | `e2e/ux-closeout-shell.spec.ts` (Configure honesto, aterrizaje directo en Revisión para lote) | Recorrido compuesto completo sin destino ceremonial en todos los estados |
| G-HP3 Firewall de lenguaje | E2E de arranque/revisión usan vocabulario humano; copy prohibido por `check:positioning` | Barrido exhaustivo de todo texto visible |
| G-HP4 Fricción rutinaria | `e2e/ux-closeout-shell.spec.ts` recorre un flujo por tipo de Job | Conteo explícito de acciones/cambios de contexto no publicado |
| G-HP5 Densidad realista | 24 detecciones y narrativa larga (`rec05-result`), 12 documentos (`batch`, `rec87-batch-result`), 32 columnas (evidencia #85) | Densidad visual de Revisión bajo deuda de fidelidad |
| G-HP6 Feedback de acción | `rec05-result` (copiar/PDF fallido), `batch` (retry/ack), confirmaciones | Cobertura de todas las acciones ordinarias |
| G-HP7 Corrección | `rec05-result` (volver a revisión pendiente), `batch` (filtros preservan decisiones) | Corrección en Estructurado a volumen alto |
| G-HP8 Comprensión del Resultado | `rec05-result` ready/needs-attention, `rec87-batch-result` blocked | Comprensión medida con personas (no ejecutada) |
| G-HP9 Safe/Confidencial | `rec05-result` y `ExportStep.batchConfidential` (confirmación deliberada, cero descargas al cancelar) | Discriminación visual de las 7 vistas |
| G-HP10 Recorrido compuesto | `ux-closeout-shell`, `structured-composed`, `structured-rec04-composed`, `rec87-batch-result` | Recorrido único end-to-end de todos los materiales con fallos y recuperación |

Ninguna fila de esta tabla se convierte en PASS por existir el testigo: se requiere ejecución y revisión independientes.

## 9. Puntos de atención que no se reclasifican

- **H-01 (idioma español):** el enunciado «mayoritariamente inglesa» procede de la matriz antigua y **no está demostrado en el producto actual** posterior a REC-10. Hay testigos españoles parciales, pero el barrido compuesto completo de copy permanece `PENDING_COMPOSED`.
- **UX-013 / H-37 (atajos de revisión):** el código y `e2e/review-productivity.spec.ts` sí ejercitan A/M/K/F y Alt+Flecha sobre el Review actual. El «no implementado» de la matriz es obsoleto; ambas filas pasan a `EXISTING_WITNESS_REUSE`, sin declarar paridad global de UX.
- **GOV-002 (protección de rama):** GitHub API consultada el 18/11 confirma `strict=true`, `enforce_admins=true` y checks requeridos `validate`, `e2e`, `Analyze (javascript-typescript)`, `Secret Scan (gitleaks)`. La afirmación antigua de «no protegida» es documentalmente obsoleta; #93 deberá reconciliar matriz/docs. No se han cambiado permisos.
- **DISC-01:** cerrado canónicamente por #79/#88/#89 según §E; se cita como contexto, no se recuenta.
- **DISC-02 (diagnósticos Safe de lote):** deuda de endurecimiento abierta como precondición de REC-12. Existe una prueba de diagnóstico acotada (`ExportStep.batchSummaryDiagnostic.test.tsx`), pero el cierre exige el testigo adversarial con `Error.name` sensible plantado y ausencia demostrada en DOM/logs, **no ejecutado en esta fase**.
- **Privacidad:** no se afirma anonimato, cumplimiento ni seguridad. Safe sigue siendo preparado/seudonimizado, no anónimo.

## 10. Gate español real

El gate de español es ejecutable, no un recuento de E2E:

```
npm run check:privacy-eval
npm run check:privacy-eval:v4
```

**EJECUTADOS en B3 (Node 24 local):** `check:privacy-eval` PASS, corpus v1.0.0 de 7 casos con TP=38, FP=0, FN=0 (precision 100%, recall 100%, FNR 0% solo en ese corpus); `check:privacy-eval:v4` **28/28 PASS**. No implican precisión universal en lenguaje clínico.

## 11. Evidencia ejecutada en esta fase

| Comprobación | Resultado |
|---|---|
| `node --test scripts/ci/rec12-b3-ledger.test.mjs` | **2/2 PASS** (IDs, 142 filas, rutas existentes, ausencia de estados PASS injustificados) |
| Prettier: registro y README B3; testigo E2E y checker | **PASS** |

Además se ejecutaron `npm run build` PASS, `npm test` PASS (**1.557/1.557 Vitest**), Playwright completo **81/81 PASS sin reintentos** (77 existentes + 4 B3), `npm run typecheck:v4` PASS, `npm run lint:v4` PASS, `check:privacy-eval` PASS, `check:privacy-eval:v4` 28/28 PASS y `structured-export.test.tsx` 15/15 PASS. Todo en Node24 local; Node20 oficial y publicación requieren GO por separado.

## 12. Limitaciones y prioridades siguientes

1. **Contabilidad ≠ verificación.** 142/142 filas contabilizadas con grados de evidencia; no 142/142 verificado funcionalmente.
2. **Prioridad conservada:** función y privacidad (#92) antes de recomposición UX; #93 gobernanza/publicación después y solo con sus dependencias.
3. **Pendientes que requieren trabajo separado:** GAP-01 benchmarks o decisión de deuda, GAP-03 Dependabot real y coverage, cierre visual humano F3 (Revisión y vistas restantes), validación de idiomas por superficie, recorrido compuesto restante, DISC-02 `Error.name` adversarial y conciliación documental #93. GAP-05 cabeceras/URL focal y GAP-06 D-021 ya cuentan con testigos positivos en B3, sin que eso cierre #92.
4. **STOP funcional:** si una ejecución futura detecta un defecto real, se registra y se detiene; no se toca lógica, engine, privacidad ni export desde este registro.

## 13. Cómo comprobar

```
node --test scripts/ci/rec12-b3-ledger.test.mjs
./node_modules/.bin/prettier --check docs/evidence/issue92-b3/ledger.json docs/evidence/issue92-b3/README.md
```

El contrato (`docs/evidence/issue92-b3/CONTRACT.md`) y el test de integridad son inmutables; este registro no los modifica.
