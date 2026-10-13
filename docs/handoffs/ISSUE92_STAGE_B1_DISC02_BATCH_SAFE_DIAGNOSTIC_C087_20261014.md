# Issue #92 / REC-12 — Etapa B1 · seguridad de diagnósticos batch Safe (DISC-02)

Estado: PREPARED_FOR_ATTENDED_C087_EXECUTION · 2026-10-14. Primer resultado verificable de Etapa B, no closeout de #92. La Etapa A (mapeo 206 obligaciones) fue publicada en PR #123; el problema está expresamente registrado en docs/audits/2026-10-recovery-traceability-matrix.md §E, fila DISC-02. Sin cambios estéticos/UI de composición.

## Fixed point y ruta
- Repositorio: b32majus/Laboratorio_Privacidad_Clinica.
- Rama: work/issue92-stageb1-disc02-c087-20261014.
- Base canónica fija: `origin/3.0-main@00211b081de49ec3e9ed2c83ebce41fda2fe8132`. El worktree arranca con el commit documental `60f4bc81ba812809a7c7ac59127a4eac1c6ac73b` encima de esa base; Cora emitirá un segundo commit exclusivamente de afinado de handoff. El **launch HEAD** es el SHA final exacto que entregue Cora, NO el HEAD canónico ni el commit documental anterior; comprobar `git rev-parse HEAD`, rama, base como ancestro y árbol limpio antes de escribir. El candidato del implementador se crea encima, sin amend/rebase/reset.
- issue #92 permanece OPEN. No inicio de #93 ni publicación/despliegue.
- Atenea C-087: `cost_policy=standard` (default), `risk_class=complex` (riesgo de privacidad), coordinador visible `atenea-complex`; implementador `atenea-implementer-complex`; revisiones `atenea-review-standards` y `atenea-review-spec-complex`; corrector fresco, si procede, `atenea-corrector-complex`. Sin cambios de perfil/modelo, fallback ni segunda revisión ritual.
- La preparación de este documento no autoriza al coordinador a seleccionar otro frontier, cambiar modelos ni explorar nuevos tickets.

## Resultado exacto aceptado
Un error inesperado durante las descargas batch Safe (resumen CSV, ZIP Safe de PDFs individuales y PDF consolidado) nunca propaga Error.name ni Error.message arbitrarios a atributos DOM, texto visible o logs. En cambio, conserva únicamente un código fijo de diagnóstico sin datos de origen, igual que la ruta Confidential ya corregida.

Prueba negativa imprescindible: un Error con name y message adulterados que incluyan sendos centinelas sintéticos tipo DNI_SENTINEL y NOMBRE_SINTETICO no debe aparecer en texto/atributos del documento ni en logs de la ruta; descargas creadas = 0. Mensaje español factual y estado error deben permanecer. Los errores tipados BatchSummaryError y BatchSafeDeliverablesError conservan sus códigos cerrados preexistentes, y los éxitos/primacía Safe ZIP, cancelación y guards de autoridad actual no cambian.

## Superficie de código autorizada
- app-v4/src/export/ExportStep.tsx: funciones batchSummaryDiagnostic y batchSafeDiagnostic; comentarios JSDoc de estas dos funciones solamente. Sustituir exactamente las ramas que devuelven `error.name` y los fallbacks no tipados por el literal `unexpected-error`, como se especifica abajo. Mantener la selección actual de códigos tipados, sin abrir nuevas categorías.
- app-v4/src/export/ExportStep.batchSummaryDiagnostic.test.tsx: añadir oráculo adversarial para rechazo inesperado CSV con Error.name/Error.message centinela; conservar el test previo de código tipado y cero descarga.
- app-v4/src/export/ExportStep.batchSafe.test.tsx: reutilizar mocks y fixtures para cubrir fallo inesperado en ZIP y PDF consolidado con nombre/mensaje centinela; conservar tests positivos previos y comportamiento de descarga cero. Si el harness existente no permite estos dos fallos sin modificar su estructura, STOP con impedimento exacto; NO ampliar a helpers compartidos o tests externos sin decisión Cora.
- No modificar rutas distintas de esos tres archivos; ninguna dependencia, CSS, UX, engine, almacenamiento, privacidad doctrinal, estado de job ni código de Confidential.

## Prescripción adicional C-087: causa, edición exacta y testigos

**Causa comprobada, sin reclamar fuga real:** en `app-v4/src/export/ExportStep.tsx`, `batchSummaryDiagnostic` (aprox. línea 690) y `batchSafeDiagnostic` (aprox. línea 714) contienen `if (error instanceof Error) return error.name`. `Error.name` es modificable y sin longitud/contenido restringidos; se convierte en `setDiagnostic` y en los atributos `data-batch-summary-diagnostic` y `data-batch-safe-diagnostic` del DOM para CSV, ZIP o PDF consolidado. La implementación Confidential ya cierra correctamente el caso; no tocarla.

**Edición literal de los cuerpos (solo en `ExportStep.tsx`), dejando idénticas las ramas de errores tipados:**

```ts
function batchSummaryDiagnostic(error: unknown): string {
  if (error instanceof BatchSummaryError) return error.code;
  return "unexpected-error";
}

function batchSafeDiagnostic(error: unknown): string {
  if (error instanceof BatchSafeDeliverablesError) return error.code;
  if (error instanceof BatchSummaryError) return error.code;
  return "unexpected-error";
}
```

Actualizar exclusivamente los dos JSDoc que hoy afirman que `Error.name` es seguro. Nunca almacenar `Error.message`, `String(error)` o cualquier string del error inesperado. No modificar handlers ni `batchConfidentialDiagnostic`.

**Tests exactos, reutilizando infraestructura existente:**

- `ExportStep.batchSummaryDiagnostic.test.tsx`: su `vi.mock("./batchResultModel", ...)` **actualmente siempre lanza un BatchSummaryError**. Añadir un control mínimo `vi.hoisted` que haga lanzar un `Error` con `name: "NOMBRE_SINTETICO_CSV_SENTINEL"` y `message: "DNI_SENTINEL_CSV"` solo en un nuevo test, y restablecerlo después. Mantener sin cambios la aserción existente `BATCH_SUMMARY_NOT_AUTHORIZED`. Con `readyBatchJob()`, pulsar `Descargar resumen seguro (.csv)`; comprobar cero `URL.createObjectURL`, texto español de error y `data-batch-summary-diagnostic="unexpected-error"`; ambos centinelas ausentes de `document.documentElement.outerHTML` (el riesgo afecta **atributos**, no solo textContent).
- `ExportStep.batchSafe.test.tsx`: usar sus controles existentes `zipGate.suspend` y `consolidatedGate.suspend` (no inventar mocks). Dos tests independientes con `readyTwo()`, `captureDownloads()` y `<ExportStep job={job} review={null} batchSessions={sessions} />`. Inyectar `Promise.reject(Object.assign(new Error("DNI_SENTINEL_SAFE"), { name: "NOMBRE_SINTETICO_SAFE" }))` para cada builder; pulsar respectivamente `Descargar documentos seguros (.zip)` y `Descargar PDF consolidado del lote (.pdf)`; drenar con `flushAsyncWork()` existente. Afirmar cero descargas, mensaje de fallo factual del respectivo botón, `data-batch-safe-diagnostic="unexpected-error"` y ausencia de ambos centinelas en `document.documentElement.outerHTML`. Conservar las pruebas positivas y de obsolescencia/unmount existentes; cleanup de gates y downloads ya disponible.
- `ExportStep.batchConfidential.stale.test.tsx`: testigo existente read-only de que el código fijo `unexpected-error` y el aislamiento Confidential siguen funcionando. No modificar este archivo.

| Superficie y riesgo conocido | Propiedad / falsación | Evidencia mínima |
| --- | --- | --- |
| CSV Safe y atributo diagnóstico | No se refleja un `Error.name` con datos sintéticos; falsaría encontrar centinela en DOM | Un test adversarial nuevo y el test original de código tipado |
| ZIP y PDF Safe y atributo diagnóstico | Cero bytes y diagnóstico fijo ante excepción inesperada; falsaría un nombre arbitrario o una descarga | Dos testigos adversariales con gates existentes más positivos que ya están en `batchSafe.test.tsx` |
| Códigos tipados y errores visibles | No perder códigos tipados ni mensajes/fallos veraces | Reutilizar casos existentes, sin debilitarlos |
| Asincronía/disposal y Confidential | No cambiar autoridad de descargas, no contaminar Confidential | Tests ya existentes en esos dos archivos; **no hay que añadir E2E transversal** por un cambio limitado a dos funciones puras |

**Comandos focalizados desde raíz, durante writer phase:**

```bash
npx vitest run app-v4/src/export/ExportStep.batchSummaryDiagnostic.test.tsx app-v4/src/export/ExportStep.batchSafe.test.tsx app-v4/src/export/ExportStep.batchConfidential.stale.test.tsx
npm run typecheck:v4
npx eslint app-v4/src/export/ExportStep.tsx app-v4/src/export/ExportStep.batchSummaryDiagnostic.test.tsx app-v4/src/export/ExportStep.batchSafe.test.tsx
npx prettier --check app-v4/src/export/ExportStep.tsx app-v4/src/export/ExportStep.batchSummaryDiagnostic.test.tsx app-v4/src/export/ExportStep.batchSafe.test.tsx
git diff --check
```

Preferir rojo primero en los nuevos tests, después cambio literal y verde. Los testigos existentes asíncronos de `batchSafe.test.tsx` ya cumplen el control transversal; no campaña de tests E2E ni suite completa opcional. Una observación negativa material exige corrección prescriptiva o HUMAN STOP aun cuando otros checks estén verdes. Exactamente una ronda canónica Standards y Spec sobre candidato fijo (sin omitirse), corrector fresco si surge un hallazgo, 2 intentos máximo. Al finalizar STOP en `READY_FOR_CORA`: no push/PR/merge/despliegue/#92 cierre ni B2. Si un test requiere tocar una cuarta ruta, informar impedimento con evidencia y HUMAN STOP.

## Orden operativo y pruebas
1. Preflight: SHA, parent, rama, árbol limpio; abortar ante deriva.
2. Confirmar las dos ramas vulnerables leyendo únicamente estos consumidores y los dos tests listados. Defecto ya trazado en DISC-02; no repetir auditoría ni reconstruir historia.
3. Añadir evidencia negativa primero y confirmar fallo con el candidato original (cuando sea viable), después cambio mínimo y retest.
4. Evidencia focal: Vitest de los dos archivos afectados + test batchConfidential.stale para la asimetría protegida. Ejecutar typecheck/format-check/diff --check y solo E2E directo del Result batch si se afecta su contrato, sin repetir toda la suite de forma rutinaria en writer.
5. Candidato único, cambios restringidos, revisión canónica Standards + Spec (una sola) mediante coordinador atenea-complex. Hallazgos => corrector fresco y prescriptivo conforme a C-087, máximo dos intentos.
6. Devolver SHA exacto, diffstat, pruebas PASS/FAIL y veredictos a Cora. HUMAN STOP: no push, PR, merge, despliegue ni cierre de #92 hasta autoridad humana posterior.

## Qué NO prueba B1
No prueba toda la Etapa B, ni la paridad de 88 + 42 + 12 filas, ni la calidad de exportaciones estructuradas (REC12-GAP-06), ni la prueba compuesta E2E final. Tras cerrar B1, #92 exige verificar el resto de la matriz y los recorridos reales con datos sintéticos. No dar por resuelto DISC-02 hasta que sus fallos adversariales y los caminos positivos queden verificados.

## Autoridad
AGENTS.md; CODING_STANDARDS.md; docs/START_HERE.md; docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md solo para preservar interacción; docs/ATENEA_EXECUTION_ROUTING_V0.md; docs/audits/2026-10-recovery-traceability-matrix.md §E DISC-02; docs/evidence/issue92-source-completeness/README.md §6.1 y §7; GitHub issue #92. Consultar solo las secciones materiales; no cargar el corpus completo.
