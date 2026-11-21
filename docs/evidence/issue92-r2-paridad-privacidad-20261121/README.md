# REC-12 #92 · R2 — Paridad funcional QA-002 y canales PRIV-003

**Fecha:** 21/11/2026. **Autoridad de producto:** `3.0-main@46bce0a8f8a25ac5c18c41b2303ae2c785246ddd`. **Base documental encadenada:** R1 commit local `d5edbc5`. **Método:** lectura de contratos, código y pruebas existentes, sin alterar el runtime, sin datos clínicos reales y sin nuevos E2E.

## Resultado

- `PARIDAD_QA002.csv`: **18 preguntas verificables**, cada una con testigo o límite expreso; **no** representan «18/18 PASS» ni sustituyen los «13 críticos» originales, que no están enumerados en una lista canónica.
- `CANALES_PRIV003.csv`: **10 canales/aspectos de exposición**, con testigos concretos y límites.
- Lo crítico de las salidas está ampliamente testificado: F5 lee PDF de lote reales y compara cuerpos; F6 comprueba en una misma sesión Copiar, TXT, DOCX y PDF contra un Safe esperado independiente; el flujo de `Keep original` se confirma explícitamente (la prueba individual F6 conserva correo, y `review-export.spec.ts` verifica una confirmación de identificador directo); el contenido Confidential queda separado y requiere confirmación humana en individual, estructurado y lote.
- El punto pendiente **material y localizado** es el tratamiento de errores inesperados al generar **XLSX estructurado Safe y XLSX de auditoría confidencial**. Es una **ruta de presentación no acotada, confirmada estáticamente**, no una fuga clínica observada ni un envío a terceros.

## Hallazgo R2-01 — Mensaje bruto de excepción en los dos XLSX estructurados

1. `app-v4/src/export/ExportStep.tsx:432–460`: el `catch` de `handleDownloadSafeXlsx` asigna `error.message` directamente al estado `xlsxError` cuando recibe cualquier `Error`, no solo errores con código seguro.
2. `app-v4/src/export/ExportStep.tsx:467–508`: `handleConfirmConfidential`, en su rama XLSX, hace exactamente lo mismo en la zona `confidential`.
3. `app-v4/src/export/ExportStep.tsx:579–582,671–674`: ambos textos se dibujan en `<p role="alert">` tras pasar por `localizeDomainErrorMessage`.
4. `app-v4/src/presentation/domain-message-labels.ts`: el mapeador traduce frases conocidas y **devuelve intacto cualquier texto desconocido**, incluido un mensaje de excepción arbitrario.
5. Las pruebas de `app-v4/src/export/ExportStep.unmount.test.tsx` sí cubren desmontaje durante los await de ambos XLSX, y las de `structured-rec04-composed.spec.ts` cubren descargas positivas y confirmaciones. **No se ha localizado una prueba adversarial de Error.message sintético en esos dos fallos de generación.**
6. Contraste: `ExportStep.batchSafe.test.tsx`, `ExportStep.batchSummaryDiagnostic.test.tsx` y `ExportStep.batchConfidential.stale.test.tsx` **sí** prueban que los fallos inesperados de lote se reducen a códigos cerrados sin volcar nombres/mensajes en DOM.

**Interpretación:** la cadena `Error.message → estado → mapeador con fallback → DOM` está presente. Una excepción que contuviera un identificador sintético lo expondría en el DOM de alerta. No se afirma que SheetJS haya emitido información de pacientes en uso real, que exista una captura externa ni que el DOM esté enviado a terceros. Es una vía de endurecimiento coherente con el precedente DISC-02, separada de los logs propiamente dichos de PRIV-003.

**Estado R2-01:** `CODE_PATH_CONFIRMED / DYNAMIC_NEGATIVE_WITNESS_PENDING`. **STOP para cambios de privacidad hasta aprobación de criterios**.

## Qué sí está protegido de forma verificable

| Área | Evidencia y alcance |
| --- | --- |
| Consola runtime | `check-external-resources --scope=source`: **85 archivos V4 PASS**, prohíbe `console.*` en fuente runtime. No garantiza trazabilidad de todas las librerías de terceros empaquetadas. |
| Tráfico externo | `network-invariant.spec.ts` con auto-fixture en toda la suite E2E; falsadores fetch/XHR plantados detectados. No se extrapola a todos los eventos futuros posibles. |
| URL y persistencia | `rec12-b3-witness.spec.ts`: ausencia de datos sintéticos en query/hash y sin claves clínicas en localStorage/sessionStorage/IndexedDB tras un recorrido. No certifica todo futuro mecanismo de almacenamiento. |
| Exportaciones Safe/Confidential | `rec05-result`, `rec87-batch-result`, `structured-rec04-composed`: lectura real de documentos, ausencia de originales no autorizados, conservación explícita cuando aprobada, confirmación Confidencial separada. |
| Fallos de lote | Regresión DISC-02 existente: `Error.name` y `Error.message` plantados no deben aparecer en DOM ni producir descargas. |
| Error de lector Excel al importar | `structured/intake.ts` puede conservar causas/nombres en mensajes destinados a UI. No se mezcla con R2-01: requiere analizar intencionalidad de nombres de archivos y errores de lectura antes de cambiar copy. |

**No se declara:** 142/142 verificados, 13/13 casos críticos, ausencia universal de fugas, anonimización, cumplimiento normativo ni aptitud para usar datos clínicos reales.

## Una única corrección focal sugerida (DIA M/sensible)

**Propuesta de criterios para aceptación humana previa a implementación:**

1. Un fallo imprevisto al producir XLSX Safe muestra un aviso comprensible y **cero descargas**.
2. Un fallo imprevisto al producir XLSX Confidential después de confirmación muestra un aviso comprensible y **cero descargas**.
3. En ambos casos, aunque `Error.name` y `Error.message` contengan un identificador sintético plantado, **ninguno aparece en el DOM** (texto ni atributos), logs ni artefactos.
4. Los errores conocidos solo muestran mensajes públicos estables; ninguna excepción desconocida se convierte en diagnóstico no tipado.
5. Las salidas XLSX exitosas mantienen byte/contenido y jerarquía Safe/Confidential; el estado de revisión y la confirmación deliberada siguen siendo autoridad.
6. Si cambia el trabajo, su preparación o se desmonta el componente durante el `await`, ningún resultado obsoleto se descarga ni se informa falsamente como éxito.
7. Una prueba negativa debe fallar sobre la base actual por el sentinela expuesto y pasar después de la corrección, sin cambiar su aserción.
8. Mantener intactos motor clínico, transformaciones, políticas, red, persistencia, estructura visual, mensajes de otras zonas y worktrees ajenos.

**Implementación todavía NO autorizada ni realizada.** Se recomienda un único test adversarial de ambas rutas y una corrección localizada de presentación. No ampliar a todas las excepciones de entrada sin prueba de un riesgo adicional.

## Verificaciones realizadas en R2

- `node --test scripts/ci/rec12-b3-ledger.test.mjs`: **2/2 PASS** (contabilidad B3 intacta).
- `node scripts/ci/check-external-resources.mjs --scope=source`: **PASS** (85 archivos runtime, ausencia de consola inesperada), sin escaneo dist en este comando.
- Validación automática de las matrices: **18/18 QA y 10/10 canales de privacidad**, IDs sin duplicados y todas las rutas citadas existentes en el checkout de R2.
- Sin nueva suite Vitest/Playwright: CI ya verificó el mismo SHA en F8+F9; esta unidad es lectura y localización, **no prueba dinámica de R2-01**.

## Siguiente límite operativo

R2 queda conciliada como diagnóstico: un riesgo técnico concreto pendiente de prueba/corrección, sin defectos demostrados en los PDF/ZIP del lote ni en el contenido Safe normalmente descargado. **No se puede cerrar #92** mientras el riesgo de mensaje no acotado permanezca sin resolver o descartar con falsador y mientras R3 (visual, idioma residual y benchmark) carezca de decisión humana.

R3 y R4 solo después de respetar el STOP de R2-01; #93 sigue subordinado a #92. No realizar push/PR/merge/deploy ni cambiar el issue por este informe.

---

## Adenda posterior (21/11/2026) · R2-01 corregido y auditado LOCALMENTE

Esta adenda actualiza el estado operativo del hallazgo que arriba figuraba como pendiente, **sin modificar la evidencia histórica del diagnóstico**. Sil dio GO expreso a los ocho criterios de R2-01 para implementar y auditar *solo localmente*.

- Worktree Herdr nuevo: `/srv/kairos-lab/qualification/laboratorio-rec12-r2-01-xlsx-error-guard-20261121`, rama `work/lab-rec12-r2-01-xlsx-error-guard-20261121` sobre R2 local. Contrato RED propio del diseñador en commit `a0da94e`: dos tests añadidos a `ExportStep.unmount.test.tsx`, **2 fallos esperados** sobre la base, 5 casos anteriores PASS; ambos fallos por muestra de sentinela de error sintético en DOM.
- Ejecutó DeepSeek V4.1 Flash como IMPLEMENTADOR directo DIA en panel de Herdr. Un solo fichero de producción modificado: `app-v4/src/export/ExportStep.tsx` (dos catch). Safe XLSX y Confidential XLSX ya no consultan `Error.name/message`; generan texto público fijo y comprueban autoridad vigente para no pintar errores de trabajos caducados. La rama TXT del catch compartido recibe texto seguro propio para no etiquetar mal el formato, sin cambiar la descarga de éxito.
- Las dos pruebas RED pasaron a **GREEN** sin cambiar sus expectativas; testigos de fallo verifican **0 descargas** y ausencia de `Error.name` y `Error.message` sintéticos en DOM completo. El control estático sigue prohibiendo console.* en el código runtime. No se ha probado una fuga clínica real.
- Auditor Cora reejecutó sobre el candidato: **build PASS; 5 suites Vitest / 76 tests PASS; 9/9 E2E Playwright PASS** (documento, lote y estructurado, puerto aislado); **TypeScript, ESLint, Prettier, check:external source (85 archivos) y git diff --check PASS**. Advertencias conocidas de fuentes pdf.js y tamaño del bundle sin fallos.
- Revisor ciego `opencode-go/glm-5.3-flash`, solo lectura, independiente de DeepSeek y auditor: **sin hallazgos bloqueantes**. Observación baja: un doble clic Safe podría provocar dos descargas, comportamiento *preexistente*, fuera del contrato R2-01; no se abrió cadena adicional.
- **Veredicto de auditoría DIA: OK LOCAL de R2-01; 0 REHACER.** Sin push, PR, merge, deploy ni cierre #92; hasta publicación del candidato esta corrección **NO está integrada en `3.0-main`**. Mantener pendientes R3 (fidelidad visual, idioma residual, rendimiento) y R4 acta de #92; no declarar uso con PHI.
