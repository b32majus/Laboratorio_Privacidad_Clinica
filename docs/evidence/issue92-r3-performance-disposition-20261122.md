# REC-12 #92 / R3 — PERF-002 y REC12-GAP-01: evidencias y decisión pendiente

**Fecha:** 22/11/2026. **Estado:** revisión documental y fuente en el worktree `work/lab-rec12-r3-copy-perf-20261122`, sin cambio de rendimiento en producto ni decisión suplida en nombre de Sil. Las fuentes históricas se preservan.

## Dos obligaciones diferentes, no intercambiables

**PERF-002, carga diferida de componentes pesados.** La matriz histórica (`docs/audits/2026-10-recovery-traceability-matrix.md`, §A) dice `VERIFIED_RESOLVED`/no bloqueante, pero el ledger B3 pedía composición específica. El testigo observacional de F5 (`docs/evidence/issue92-f5/INVESTIGACION.md`) usó **navegador real sobre la publicación de Render del 21/11/2026**: PDF.js y su worker aparecieron tras seleccionar PDF; Mammoth tras DOCX; SheetJS tras XLSX; el worker del motor se solicitó al iniciar su trabajo. En la ruta de texto sencilla no se pidieron estos parsers. Fuente actual: `app-v4/src/input/extract.ts` usa import dinámico de Mammoth, `app-v4/src/engine/engine-seam.ts` importa `registry-engine` dinámicamente, `pdfjs-loader` y `xlsx-loader` cargan vendedores propios por demanda.

**Límite:** `app-v4/src/export/batchSafeDeliverables.ts` importa `jszip` y `pdf-lib` de forma estática; también las rutas de exportación DOCX/PDF usan esas dependencias. El entry inicial puede incluir código de exportación. F5 no cronometró arranque, bytes transferidos, heap ni mejoras de splitting. No se puede afirmar «todos los exportadores son lazy» ni dar por necesaria una refactorización sin cuello de botella demostrado.

**REC12-GAP-01, benchmark versionado de rendimiento.** El requisito de origen está en S1 §7 PERF-05 y en `docs/specs/SPEC_V4_QUALITY_SECURITY_DEPLOY.md` §8. Debe haber escenarios repetibles sintéticos de 10/100/500 KB/1 MB y lotes de 1/10/50 documentos, tiempos y respuesta de la interfaz; memoria **cuando sea practicable**; y detecciones sin perder por optimización.

## Lo que ya existe y sí es evidencia

`scripts/benchmarks/engine-bench.mjs` y el corpus con semillas deterministas miden el **núcleo `js/modular-processor.js PrivacyProcessor`**: una ejecución de calentamiento + 3 repeticiones, medianas de tiempo y conteo de entidades. Los informes versionados `benchmarks/baseline-wu0.json` y `benchmarks/final-closeout.json` recogen los siete niveles:

| Escenario sintético | Mediana baseline-wu0 (ms) | Mediana final-closeout (ms) | Detecciones final |
| --- | ---: | ---: | ---: |
| Texto 10 KB | 119,31 | 116,95 | 98 |
| Texto 100 KB | 1.079,20 | 955,32 | 962 |
| Texto 500 KB | 10.110,77 | 8.174,49 | 4.701 |
| Texto 1 MB | 24.638,75 | 22.505,12 | 9.236 |
| 1 documento de 20 KB | 403,61 | 138,23 | 192 |
| 10 documentos de 20 KB | 2.128,93 | 1.438,63 | 1.896 |
| 50 documentos de 20 KB | 9.654,89 | 6.955,53 | 9.433 |

Todos los conteos de detecciones en baseline y final coinciden por escenario. Las medianas son de **ejecuciones históricas, condiciones de máquina no controladas**, no pronóstico de la V4 actual ni garantía de tiempo al usuario. Estos números sirven para demostrar que **no falta todo el benchmark**, pero **no prueban** latencia ni memoria/responsividad del recorrido **React → Worker → revisión → salida**.

## Hueco residual y opciones de cierre

**Estado probado:** `REC12-GAP-01 = NO VERIFICADO`, conservar la fila de la matriz y su falsador. Para cumplir el primer brazo del contrato faltaría un medidor sintético del **flujo V4 compuesto**, al menos en los siete niveles, que reporte latencia visible, ausencia de congelación o latencia del hilo principal (p. ej., long tasks/event-loop lag), y memoria observada cuando sea técnicamente posible, con límites de método y equipo. Un `performance.memory` del navegador únicamente prueba heap de JavaScript del hilo principal y **no** garantiza medir el Worker, por lo que no debe llamarse memoria total del proceso. No establecer nuevos umbrales arbitrarios ni optimizar el motor a ciegas.

**Alternativa expresamente prevista por la matriz §F:** Sil puede **aceptar de forma explícita** esta medición compuesta residual como deuda posterior a la recuperación, reconociendo los benchmarks de núcleo como parciales y sin falsear un PASS. Hasta esa decisión, la deuda sigue abierta y no se puede cerrar #92 por simple anotación.

**Recomendación de prioridad:** no hacer refactor de lazy-loading/exportadores ni alterar motor antes de tener señal de lentitud. Para avanzar el cierre de recuperación, recomendar **aceptación humana de una deuda de medición V4 delimitada**, con dueño y siguiente revisión, siempre que se determine que no bloquea otro criterio contractual de #92; de lo contrario, programar el benchmark observacional con corpus sintético y metodología reproducible. Esta recomendación no constituye aceptación humana ni altera la autoridad de la matriz.

**Acciones efectuadas en esta unidad:** lectura contrastada de fuentes, datos y contratos. No se ejecutó benchmark completo nuevo; no se ha modificado la tabla de resultados histórica ni la fila `REC12-GAP-01`, y no se han cambiado runtime, bundles, CI o políticas.
