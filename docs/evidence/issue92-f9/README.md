# REC-12 F9 · Español profesional: errores, salidas y trazabilidad

**Estado:** candidato local KairOS DIA M/sensible; GO de Sil a los ocho criterios F9, NO a push, PR, merge o despliegue. Base canónica `3.0-main@c615a9d` + F8 local `37373b0` (se mantienen las 7 capturas reales/14 referencias de F8). Datos sintéticos, prohibidos PHI y cambios de reglas.

## RED → GREEN (testigos verdaderamente nuevos)

- Baseline F9: build PASS, 64/64 unitarios vecinos y 5/5 E2E PASS. Logs `/tmp/lab-rec12-f9-baseline-*.log`.
- Testigo escrito ANTES del cambio, commit `dec4f54`: seis pruebas de los retornos de `localizeDomainErrorMessage`, dos expectativas de rechazo de Entrada, una de remedio de Lote y **cuatro recorridos E2E reales** en `e2e/rec12-f9-spanish-error-states.spec.ts`: extensión no admitida, PDF corrupto/bloqueo en lote, columna Structured desconocida/bloqueo, Resultado Safe vs Confidential con cancelación sin descarga y confirmación legítima. **RED previo: 8/70 unitarios fallidos y 3/4 E2E fallidos exclusivamente por textos anteriores**; restante 62/70 y 1/4 PASS. No hubo cambios a los tests nuevos después del RED.
- Expectativas históricas que cambiaban solo el tratamiento verbal: `90fc2a9` corrige 3 expectativas antiguas; `f2f3449` corrige dos encabezados exactos del E2E XLSX `structured-rec04-composed.spec.ts` («Seleccione»→«Selecciona»), sin retirar assertions de selección de hoja, cabecera, campos, Safe CSV/XLSX ni autorización Confidential. El intento de cambiar adicionalmente un rechazo fuera del contrato en `10fb722` se revirtió íntegramente mediante `4e55cec` (ningún efecto neto).
- Implementación por `opencode-go/deepseek-v4.1-flash`, panel Herdr propio ya cerrado: **cinco ficheros productivos, 34 líneas añadidas y 34 eliminadas, solo literales**: `App.tsx` (errores de inicio/portapapeles y ayudas), `presentation/domain-message-labels.ts` (retornos españoles), `privacy-gate/PrivacyGate.tsx` (un aviso), `privacy-gate/privacyGateModel.ts` (cuatro VALORES españoles de remedios Lote; claves inglesas intactas), `structured/StructuredConfigureWorkspace.tsx` (instrucciones de hoja/cabecera/Unknown). Condiciones, regresos, estado, regex, identificadores, exportadores, permisos y privacidad sin cambios.

## Gates y falsación

- Implementador: TypeScript, ESLint, Prettier y build PASS; 70/70 unitarios focales, E2E F9 4/4 PASS.
- Auditor local: TypeScript, ESLint, Prettier PASS; primer `npm test` **1566/1567** por timeout 5s del antiguo `App.test` Lote listo, sin error de aserción; **test aislado PASS en 4,38 s sin tocar test**, y repetición en máquina más libre **92/92 suites, 1567/1567 PASS**. Logs `/tmp/lab-rec12-f9-audit-npmtest{,-retry}.log` y `/tmp/lab-rec12-f9-isolated-batch-unit.log`.
- Primer E2E ampliado (seis specs): **22/24 PASS**, dos fallos de selector `Seleccione una hoja` (desactualizado tras copy); después de corregir SOLO esos dos nombres, reejecución XLSX **2/2 PASS sin retries**. Logs `/tmp/lab-rec12-f9-audit-e2e.log` y `/tmp/lab-rec12-f9-xlsx-recheck.log`. Repetición final de los **24 escenarios**, `--retries=0`, terminó 24/24 PASS, sin reintentos. Log: /tmp/lab-rec12-f9-audit-e2e-final.log.
- Nunca inferir cobertura universal de idioma de un corpus del motor. No se borró ninguna comprobación de seguridad ni se incrementaron tiempos de prueba.

## Matriz H-01/PDR-08 y límites

- Matriz `docs/audits/2026-10-recovery-traceability-matrix.md`: H-01 cambia de `LOST` con afirmación obsoleta «V4 predominantemente inglesa» a **`PARTIAL`, blocker Yes**, testigos REC-10 #90/PR120, F7 #139, F8 y F9; PDR-08 actualiza el texto histórico pero continúa **blocker Yes**, `VERIFICATION_PENDING`. **#92 y #93 NO cerrados.**
- Quedan dos expresiones formalizadas fuera del contrato de este slice: `App.tsx:430` «Use una sola entrada…» (test propio) y `policy-guidance.ts:58` «Cree un trabajo…» (E2E propio). También hay fallos raros, nombres accesibles y descargas no recorridas: no decir «español exhaustivo» ni `VERIFIED_RESOLVED`.
- F8 documenta tres desviaciones visuales en Revisión/Celdas/Resultado que NO se cambian con F9. Orden de Sil: **#92 → #93 → correcciones UX**, salvo GO distinto.

**Publicación F9 y F8 pendientes de un GO posterior**. Todo se mantiene en el worktree Herdr F9, sin push/PR/merge/deploy ni tocar el checkout principal.


## Cierre de auditoría único KairOS DIA (21/11/2026)

- **Cora GPT-6, auditora independiente:** OK ACOTADO, **0 REHACER**. Diff de cinco módulos solo literales, test F9 4/4, npm test 92/92 suites con 1567/1567 y E2E ampliados 24/24; sin cambios de autorización, salida ni condiciones. Diff fuente de producto antes/después de la auditoría idéntico mediante cmp; git diff --check PASS.
- **GLM-5.3 Flash, revisor ciego de otra familia que DeepSeek y GPT-6:** **SIN HALLAZGOS PRODUCTIVOS**, test de mapping 6/6 PASS y examen adversarial de errores, XSS de nombres de archivos sintéticos, claves técnicas y Safe/Confidential. Dos notas BAJAS de proceso: concordancia adicional usa/dirige en frases ya editadas aunque no enumeradas palabra a palabra en el encargo (coherente con el trato aprobado); tres aserciones antiguas y dos nombres XLSX fueron actualizados por el DISEÑADOR, en commits explícitos, sin retirar ni relajar reglas de error/privacidad. Una sola auditoría; ninguna segunda revisión.
- **No se reivindica** cobertura exhaustiva de traducción: H-01 PARTIAL, PDR-08 VERIFICATION_PENDING con bloqueos Yes. Issues #92 y #93 siguen abiertos. Worktree F9 permanece LOCAL, no se ha publicado.
