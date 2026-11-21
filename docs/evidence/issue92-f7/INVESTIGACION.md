# REC-12 F7 · Investigación observacional H-01/PDR-08 y G-HP1…10 (21/11/2026)

**Autoridad, alcance y método.** GitHub `b32majus/Laboratorio_Privacidad_Clinica`, rama `3.0-main@4a649fdba442f7a246d02fa81ba15d09efb318a8` (PR #138 integrado, postmerge CI y despliegues PASS); #92 y #93 OPEN, sin PR simultáneo. El worktree F7 se creó **mediante Herdr** desde `origin/3.0-main`, aislado de Sil, F3–F6. Se leyeron `ARRANQUE.md`, `PROTOCOLOS.md`, `dia/README.md` y `HERDR.md`.

Fuentes que **no se sustituyen por inferencias**: `docs/audits/2026-10-recovery-traceability-matrix.md` H-01, PDR-08/PDR-10; `docs/evidence/issue92-source-completeness/README.md` §8; `docs/evidence/issue92-b3/README.md` §8–10; `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` §8 G-HP1–10; GitHub issue #90 CLOSED / PR #120 MERGED (15 E2E independientes, 114 unitarios de componente en su candidato), issue #92 OPEN. El viejo H-01 `LOST` dice «V4 mayoritariamente inglés»; fuente Stage A lo califica **obsoleto y pendiente de re-verificación** posterior a REC-10. PDR-08 conserva un testigo parcial y necesita closeout exhaustivo; no confundir un PR mergeado con PASS del producto completo.

## 1. Barrido de interfaz publicado: muestra real, no traducción automática

Playwright Chromium contra `https://laboratorio-privacidad-clinica.onrender.com/`, con entradas exclusivamente sintéticas y lectura de DOM visible + atributos accesibles; script de inspección **temporal fuera del repo** `/tmp/lab-rec12-f7-surface-probe-20261121.cjs`, datos `/tmp/lab-rec12-f7-live-surface-audit.json`. Estados navegados: Entrada vacía; Revisión con cuatro hallazgos; Comprobación de privacidad bloqueada por pendientes; Lote dos documentos; Estructurado siete columnas con bloqueos; Celdas antes de procesar; y, mediante un segundo recorrido, Comprobación preparada y Resultado preparado con correo sintético **deliberadamente conservado**. En los estados navegados `lang=es`; no se vieron encabezados principales ni botones en inglés del inventario REC-10 anterior. Las etiquetas accesibles inspeccionadas también estaban en español. `/tmp/lab-rec12-f7-dense-audit.json` contiene medidas de 24 y 32 (ver abajo). Confirmación de `Conservar original` en español: `Cancelar` / `Sí, conservar original`. Un recorrido de Lote corrupto se capturó aún `En curso`: **NO prueba** el mensaje final del fallo; el intento de forzar PDF no llegó a Result y **NO se usa** como evidencia de estado final.

**Hallazgos de copy acotados y reproducidos en código vivo:**
- `app-v4/src/review/BatchReviewView.tsx:401` usa «**Revise** cada documento del lote…» y `app-v4/src/review/ReviewWorkspace.tsx:649` usa «**Revisa** cada dato…». No rompe la revisión, pero alterna tratamiento de segunda persona sin motivo. Propuesta: mantener `Revisa` por consistencia, previo criterio humano.
- `app-v4/src/privacy-gate/PrivacyGate.tsx:278–288`: seis ramificaciones de copy (error/singular/plural) dicen «**antes de que confíe en esta revisión**». La copia es gramaticalmente ambigua y poco operativa en un punto de decisión clínica. Propuesta: expresar error o cantidad pendiente de forma factual sin alterar los cálculos (ver CRITERIOS_DIA.md).
- Se encontraron **cadenas inglesas en comentarios, expresiones regulares de mensajes internos y estados de máquina**; eso no significa UI inglesa. Mantener códigos técnicos estables y evitar buscar/reemplazar globalmente.

**Conclusión H-01:** el estado del producto observado **no respalda** que la interfaz actual sea «mayoritariamente inglesa»; la clasificación histórica `LOST` debe reconciliarse con REC-10 y pruebas de estado. Sin embargo, un barrido de una muestra de pantallas NO es prueba exhaustiva de errores, tooltips, nombres de ficheros, estados de accesibilidad ni de ausencia universal de cadenas inglesas. **No se ha cambiado la matriz** en F7 y no se declara H-01/PDR-08 globalmente cerrados.

## 2. Densidad G-HP5 y jerarquía G-HP1 medida en la aplicación real

Segundo script Playwright `/tmp/lab-rec12-f7-dense-probe-20261121.cjs` y datos `/tmp/lab-rec12-f7-dense-audit.json` (solo rutas temporales del VPS, no evidencias de pacientes). Elementos realmente renderizados y posiciones verticales del documento relativo a viewport de 800 px; los top mayores que 800 px implican scroll necesario. Ningún caso observado tuvo desbordamiento horizontal del documento.

| Estado real sintético | Viewport | Contenido | Overflow horizontal | Próxima acción/posición top aprox |
|---|---|---|---|---|
| Revisión alta densidad | 1440×800 | 24 detecciones, narrativa sintética | 0 px | `Comprobación de privacidad` en 2120 px |
| Revisión alta densidad | 375×800 | 24 detecciones | 0 px | `Comprobación de privacidad` en 4073 px; el inspector móvil se presenta antes del documento conforme adaptación aprobada |
| Estructurado | 1440×800 | 32 filas de columnas en comparativa | 0 px | `Comprobación de privacidad` en 2442 px |
| Estructurado | 375×800 | 32 filas | 0 px | `Comprobación de privacidad` en 3452 px |
| Comprobación preparada | 1280×800 | 4 decisiones completas | 0 px | `Ir al resultado` en 948 px |
| Resultado preparado | 1280×800 | aviso de original conservado | 0 px | TXT en 552 px, DOCX en 610, PDF en 668; zona Confidential en 827 px |

Los valores son **mediciones de un DOM/viewport concretos**, no objetivos aprobados ni benchmarks de tiempo; las acciones de privacidad al final de tareas densas pueden estar justificadas. Lo que queda abierto es si la jerarquía y la capacidad de retomar orientan bien al profesional, **no** si hay overflow. En F3 la fidelidad de Revisión/Celdas/Resultado sigue pendiente de contraste humano; no volver a la maqueta original a ciegas ni reordenar la adaptación móvil del inspector. El prototipo Sophilux B V1 y el acuerdo D1–D4/VF-01–08 preservan funciones reales por encima del dibujo.

## 3. Estado de los diez gates G-HP (sin inflar cobertura)

| Gate | Evidencia reutilizada, comprobada en fuente | Límite que sigue sin resolverse |
|---|---|---|
| G-HP1 Primacía de tarea | Entrada real y Revisión 24; E2E `input-start`, `ux-closeout-shell` | Aprobación humana de jerarquía en estados poblados |
| G-HP2 Sin no-op | `ux-closeout-shell` y acceso directo a Revisión/Celdas cuando corresponde | No inferir todos los caminos a partir de un caso |
| G-HP3 Lenguaje humano | siete superficies reales observadas en español; PR #120; `check:positioning` existe | No equivale a barrido de errores/ARIA/file names exhaustivo |
| G-HP4 Fricción rutinaria | `rec05-result` cuenta explícitamente 1 transición Review→Result y acción preparada | Falta comparación de coste de contexto en otros tipos de Job |
| G-HP5 Densidad | 24 hallazgos, 32 columnas renderizadas, y E2E de lote 12 con 2 fallos | Alcanzabilidad efectiva sin perder orientación y contraste visual/humano |
| G-HP6 Feedback | `rec05-result`, `batch`, confirmación Keep-original | Otros errores y acciones pendientes |
| G-HP7 Corrección | `rec05-result`, `batch`, `structured-composed` | Corrección de estructura con volumen alto |
| G-HP8 Comprensión | Result ready/blocked observados en E2E, Resultado ready inspeccionado | Comprensión humana no medida, no declarar PASS cualitativo |
| G-HP9 Safe/Confidential | Testigos de consentimiento; Result real muestra zonas separadas | Discriminación visual humana de siete vistas/F3 |
| G-HP10 Recorrido compuesto | E2E `ux-closeout-shell`, `structured-rec04-composed`, `rec87-batch-result` y F6 individual | No fabricar un único recorrido artificial que combine Job tipos mutuamente excluyentes |

**Decisión de secuencia:** no lanzar refactor visual de Revisión/Celdas/Resultado sin decisión humana vinculada a F3. Primero cerrar H-01/PDR-08 con testigo de copy/ARIA de estados y dos correcciones pequeñas; después emitir una ficha separada de fidelidad/densidad F3 que permita decidir el cambio visual con capturas iguales de viewport/estado. G-HP no pasa globalmente por este barrido.

## 4. Motor español: evidencia separada de la interfaz

Ejecutados otra vez sobre el producto fuente V4 del PR #138 (el worktree F6 tiene solo documento adicional): `npm run check:privacy-eval` **PASS** en corpus 1.0.0 de **7 casos** (TP 38, FN 0, FP 0, precisión/recall 100% solo para ese corpus); `npm run check:privacy-eval:v4` **28/28 PASS**. Logs en `/tmp/lab-rec12-f7-spanish-engine-v3.log` y `...-v4.log`. Estos gates verifican rendimiento del **motor** para el corpus comprometido, **no** localización UI ni precisión universal.

**Resultado F7 hasta aquí:** investigación de solo lectura, observaciones reproducibles y criterios de siguiente cambio. **No** cambios de app, tests, matriz, motor, privacidad, workflows, permisos, UX aprobado, PR ni despliegue. Criterios DIA pendientes de ratificación de Sil antes de implementación M/sensible; no prometer cierre completo de #92.

## 5. Implementación local aprobada + auditoría DIA única (21/11/2026)

Sil ratificó los ocho criterios de `CRITERIOS_DIA.md` con GO para **implementar y auditar localmente**; no autorizó push, PR, merge o deploy. Rama F7 desde `3.0-main@4a649fd`, solo datos sintéticos. KairOS DIA M/sensible con vía OpenCode directo (implementador DeepSeek V4.1 Flash, auditor Cora GPT-6 y segundo revisor ciego GLM-5.3 Flash, otra familia).

**Línea base antes de tocar el producto:** `npm ci` 368 paquetes PASS, `npm run build` PASS, `npm run typecheck:v4` PASS, pruebas unitarias vecinas `PrivacyGate.test.tsx`+`BatchReviewView.test.tsx` **58/58 PASS**, E2E vecinos `rec05-result`+`ux-closeout-shell` **18/18 PASS**. Logs VPS `/tmp/lab-rec12-f7-baseline-*.log`. Mismo worktree, sin alterar tests base.

**Contrato RED del diseñador** congelado en commit `0d7597fbfcacf50b9fda877a9dd707d68ff9cdc7`:
- Tres unitarios nuevos `PrivacyGate.test.tsx`: singular, plural y error de procesamiento contra Job+ReviewSession reales, bloqueos veraces.
- Un unitario nuevo `BatchReviewView.test.tsx`: imperativo coherente sin cambiar la cola.
- Tres E2E nuevos `e2e/rec12-f7-language.spec.ts`: Entrada→Revisión pendiente→Comprobación→Resultado; Lote; Estructurado→Celdas, con etiquetas de rol y `lang=es`.
- Con producto sin cambios, TypeScript/Prettier PASS, **cuatro unitarios RED** exclusivamente por literales anteriores, **dos E2E RED** exclusivamente por literales anteriores y **un E2E estructurado PASS**. Logs `/tmp/lab-rec12-f7-red-unit.log`, `-red-e2e.log`; no se editaron tests para ponerlos en verde.

**Implementación OpenCode** en panel visible propio de Herdr, cerrada tras resultado: SOLO `app-v4/src/privacy-gate/PrivacyGate.tsx` (dos `hasJobErrors`, dos singular, dos plural) y `app-v4/src/review/BatchReviewView.tsx` (un `Revise`→`Revisa`). Diff fuente **7 inserciones, 7 supresiones**, únicamente literales; ternarios, precedencia de causas, datos, políticas, permisos, roles, estilos y exportadores idénticos. Tests del diseñador intactos. Logs `/tmp/lab-rec12-f7-implementer-20261121.log`. Ejecutó typecheck, formato, unitarios **62/62**, build y E2E nuevo **3/3** PASS.

**Auditoría única DIA, resultado: OK ACOTADO de implementación**, sin REHACER:
- Cora verificó diff 2 TSX, test inmutable, `git diff --check`, TypeScript PASS, ESLint PASS, Prettier PASS, suite `npm test` **91/91 suites y 1.561/1.561 pruebas PASS**, E2E de seis specs con copy, privacidad, estructurado, lote y salida **37/37 PASS** sin reintentos. Adicionalmente se reejecutó el E2E completo `rec87-batch-result.spec.ts` de **12 documentos (10 TXT + 2 fallos de lectura)** **1/1 PASS**, sin modificarse el test. Logs `/tmp/lab-rec12-f7-auditor-{typecheck,lint,prettier,npmtest,e2e,12doc}.log`.
- GLM revisor ciego: `62/62` unitarios, E2E F7 `3/3`, `review-productivity` `3/3` (24 hallazgos, 375/1280/1440), TypeScript PASS, `check:privacy-eval` PASS corpus 7 y `check:privacy-eval:v4` **28/28**, sin hallazgos de lógica, permisos/Confidential, fuga, accesibilidad ni falso PASS. Confirmó que `Job.errors` procede de `failProcessing`, por lo que «error de procesamiento» corresponde al origen. Panel ciego cerrado sin tocar archivos.
- Observación confirmada **BAJA, FUERA DEL ALCANCE**: `App.tsx:168` todavía dice «Revise el texto...» y `PrivacyGate.tsx:293` «Consulte...». La consistencia Revisión/Lote sí se cerró, pero no se afirma una uniformidad global de tratamiento; corregir otros textos precisaría otro alcance y criterios.
- Observación **COBERTURA PARCIAL (G-HP5/F3)**: los nuevos tests no hacen medición visual humana. El revisor afirmó equivocadamente que «no existía» test del lote 12/2 ni prueba de 32 columnas: se contrastó contra `e2e/rec87-batch-result.spec.ts:95` (10+2, ejecutado PASS), `e2e/batch.spec.ts:383` (12 docs), `docs/evidence/issue91-u4/README.md` (32 columnas reales) y los scripts/medidas de F7 §2 (24 hallazgos y 32 columnas a 375/1440, sin desbordamiento, posiciones de CTA registradas). La limitación válida es que ausencia de overflow + fotos + testigos funcionales **no acreditan jerarquía/entendibilidad visual humana**. Mantener G-HP1/5/8/9 pendiente del contraste F3 aceptado, sin retocar CSS ni React.
- Pruebas de motor, no de localización UI: `check:privacy-eval` PASS (TP 38/FN0/FP0, corpus 7) y `check:privacy-eval:v4` **28/28 PASS** verificadas también por revisor. Nunca extrapolar precisión universal.

**Cierre semántico HONESTO:** F7 deja los dos ajustes de copy con DIA OK local; no certifica barrido de todos los errores/nombres accesibles/artefactos, y no cambia la matriz H-01 (registro obsoleto) ni PDR-08, QA-002 global, #92, #93. Su reconciliación requiere evidencia de estados completa y revisión de la autoridad humana; G-HP de densidad y jerarquía requiere contraste visual explícito. No hay push/PR/merge/deploy F7. Próximo paso es solicitar GO específico para publicar solo estos cambios auditados; después continuar REC-12 por bloques restantes, no confundir publicar F7 con cerrar el issue.
