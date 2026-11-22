# REC-12 #92 · R1: conciliación de evidencias por fila

**Fecha:** 21/11/2026. **Base de producto:** `3.0-main@46bce0a8f8a25ac5c18c41b2303ae2c785246ddd`. **Tipo:** investigación/documentación KairOS DIA; no ejecución de recuperación ni certificación de privacidad. **Estado:** R1 documentado, #92 abierto.

## 1. Resultado y método

La fuente Stage A inventaría **206 obligaciones materiales**, de las cuales 204 tienen correspondencia de fila y dos fueron supersedidas por decisión humana. El registro B3 contiene **142 IDs únicos (88 A, 42 B, 12 C)**, pero fue construido sobre `184acc6`, anterior a las integraciones F4–F9.

El archivo `EVIDENCIA_POR_FILA.csv` reconcilia **las 142 filas, una por ID**, conservando la disposición original B3 y añadiendo un tratamiento actual, las referencias B3, las referencias pertinentes de F4–F9, las rutas de pruebas que siguen presentes y las rutas de pruebas que han cambiado desde la fuente B3. Se verificó por script que hay 142 filas, sin duplicados ni pendientes omitidos, y que todas las rutas incluidas existen en `3.0-main`.

**Límite fundamental:** una ruta de prueba existente o una CI verde acredita que existe y se ejecuta un testigo; no demuestra automáticamente que todas las facetas de la obligación se cumplan. Este documento NO transforma 142 rutas en 142 estados PASS ni modifica las matrices congeladas.

## 2. Clasificación exacta

| Procedencia / destino | Filas | Lectura correcta |
| --- | ---: | --- |
| EXISTING_WITNESS_REUSE | 100 | Testigos enlazados, pertinencia material aún sujeta al cierre #92 |
| TARGETED_WITNESS | 1 | BATCH-002, evidencia específica de no persistencia |
| POST_RECOVERY_DEBT | 14 | Deuda explícitamente posterior, no nueva funcionalidad REC-12 |
| HUMAN_SUPERSEDED | 2 | Sustituciones respaldadas por decisiones humanas |
| PENDING_HUMAN | 2 | UX-005 y H-02: misma aceptación visual Sophilux |
| Antiguos PENDING_COMPOSED, ahora clasificados | 23 | 9 evidencias F4/CI, 6 de #93, 2 QA/privacidad, 2 idioma, 2 UX, 1 rendimiento, 1 tipografía |
| **Total** | **142** | **Ninguna fila recibe PASS por contabilidad** |

Los 23 IDs se distribuyen sin duplicados: **9** BATCH-004, ARCH-007, ARCH-008, CI-001, CODE-001, CODE-003, ARCH-009, ARCH-010, UX-002; **6** GOV-001, GOV-002, GOV-003, DOC-001, HOST-001, HOST-002; **2** QA-002 y PRIV-003; **2** H-01 y PDR-08; **2** UX-001 y UX-007; **1** PERF-002; **1** H-03.

## 3. Evidencia nueva que evita repetir desarrollo

- **F4:** los errores imprevistos de Safe lote ya se transforman en el código fijo `unexpected-error`; el problema DISC-02 ya estaba corregido en PR #126. Sus pruebas adversariales y el control no-console están documentados. F4 también verifica ausencia de rutas legacy, monkey patch y `alert()` de runtime, y corrige posteriormente CI-001.
- **F5:** `e2e/rec87-batch-result.spec.ts` lee los PDF reales del ZIP y del consolidado y compara contenido Safe en un lote de 12 con dos fallos. No es un test nuevo pendiente.
- **F6:** `e2e/rec05-result.spec.ts` comprueba en una sesión la correspondencia de Copiar, TXT, DOCX y PDF con una expectativa independiente, incluyendo identificador deliberadamente conservado y DNI fragmentado. No hace falta replicar ese recorrido.
- **F7–F9:** pruebas de idioma y estados de error en `e2e/rec12-f7-language.spec.ts` y `e2e/rec12-f9-spanish-error-states.spec.ts`; H-01 sigue parcial, PDR-08 pendiente de verificación exhaustiva. Quedan dos imperativos formales conocidos y estados raros/ARIA no barridos.
- **F8:** comparador de siete vistas Sophilux, a 1440 y 375 px, confirma tres diferencias de composición en Revisión, Celdas y Resultado. No constituye aceptación humana.
- **CI actual:** `.github/workflows/ci.yml` ejecuta el `npm test` completo, los self-tests de seguridad, TypeScript, lint, Prettier y Playwright E2E. La CI verde del SHA integrado ya se documentó durante la publicación F8+F9. Esta unidad no relanza suites para simular valor adicional.

## 4. Qué queda para decidir realmente

**R2, QA-002:** reconstruir una tabla material de *entrada → revisión/Keep → error/recuperación → salida Safe/Confidential* con cada testigo compuesto existente. Las dimensiones mínimas: texto/archivo, estructurado, lote; original conservado o no; formato Copiar/TXT/DOCX/PDF, CSV/XLSX, ZIP/PDF consolidado; confirmación Confidencial individual y de lote; cancelación, fallo y recuperación. Si aparece una transición realmente sin protección, diseñar solo ese test falsador. La fuente menciona 13 casos críticos sin identificadores enumerados; no inventar una certificación 13/13.

**R2, PRIV-003:** separar canales consola, DOM de diagnósticos, URL, almacenamiento, red externa, descargas y posibles errores. Relacionar testigos actuales y describir límites. El checker no-console del código clínico no demuestra ausencia universal de exposición. Ante un bug de privacidad confirmado: STOP, criterios humanos y tarea acotada.

**R3, tres decisiones humanas:** (a) corregir las tres diferencias visuales antes de cerrar #92 o aceptar una excepción explícita manteniendo el bloqueo visual sin fingir el criterio cumplido; (b) corregir los dos imperativos y medir qué cobertura adicional de estados raros se exige para cerrar idioma; (c) ejecutar benchmark versionado GAP-01/PERF-002 o conservar deuda posterior por autorización expresa. La tipografía H-03 conserva su tratamiento histórico no bloqueante.

**R4:** resolver los seis criterios originales de #92 en un acta única contra SHA definitivo: fuentes, 142 filas, PDR-01–12, paridad E2E, motor español, G-HP1–10. Si queda un bloqueo original sin evidencia ni supersesión válida, #92 permanece OPEN con causa concreta. Después se aborda #93; DICOM/OCR/FHIR y demás extensiones no se introducen como requisitos REC-12.

## 5. Restricciones y estado operativo

No se ha modificado React, motor, políticas, exportadores, tests, matriz histórica, ledger B3, servicios, infraestructura, protección de ramas ni issues. No se utilizan datos de pacientes. La aplicación no se declara apta para datos clínicos reales ni se afirma anonimización o cumplimiento normativo. Este tramo es exclusivamente documental, con trabajo local; **no hay push/PR/merge/deploy ni autorización para cerrar #92**.

**Siguiente paso recomendado:** R2, una comprobación acotada de QA-002 y PRIV-003 aprovechando E2E y guardarraíles existentes; detenerse únicamente si aparece un fallo material.