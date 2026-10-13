# Issue #92 / REC-12 — Etapa B1 · seguridad de diagnósticos batch Safe (DISC-02)

Estado: PREPARED_FOR_ATTENDED_C087_EXECUTION · 2026-10-14. Primer resultado verificable de Etapa B, no closeout de #92. La Etapa A (mapeo 206 obligaciones) fue publicada en PR #123; el problema está expresamente registrado en docs/audits/2026-10-recovery-traceability-matrix.md §E, fila DISC-02. Sin cambios estéticos/UI de composición.

## Fixed point y ruta
- Repositorio: b32majus/Laboratorio_Privacidad_Clinica.
- Rama: work/issue92-stageb1-disc02-c087-20261014.
- Parent canónico obligatorio: origin/3.0-main = 00211b081de49ec3e9ed2c83ebce41fda2fe8132.
- issue #92 permanece OPEN. No inicio de #93 ni publicación/despliegue.
- Atenea C-087, cost_policy=standard (valor por defecto), risk_class=complex por integridad de datos clínicos en errores y exportaciones.
- La preparación de este documento no autoriza al coordinador a seleccionar otro frontier, cambiar modelos ni explorar nuevos tickets.

## Resultado exacto aceptado
Un error inesperado durante las descargas batch Safe (resumen CSV, ZIP Safe de PDFs individuales y PDF consolidado) nunca propaga Error.name ni Error.message arbitrarios a atributos DOM, texto visible o logs. En cambio, conserva únicamente un código fijo de diagnóstico sin datos de origen, igual que la ruta Confidential ya corregida.

Prueba negativa imprescindible: un Error con name y message adulterados que incluyan sendos centinelas sintéticos tipo DNI_SENTINEL y NOMBRE_SINTETICO no debe aparecer en texto/atributos del documento ni en logs de la ruta; descargas creadas = 0. Mensaje español factual y estado error deben permanecer. Los errores tipados BatchSummaryError y BatchSafeDeliverablesError conservan sus códigos cerrados preexistentes, y los éxitos/primacía Safe ZIP, cancelación y guards de autoridad actual no cambian.

## Superficie de código autorizada
- app-v4/src/export/ExportStep.tsx: funciones batchSummaryDiagnostic y batchSafeDiagnostic; comentarios JSDoc de estas dos funciones solamente. Sustituir la rama que devuelve error.name para errores inesperados y el fallback no tipado por un código fijo y sin contenido (preferir 'unexpected-error' por coherencia con batchConfidentialDiagnostic). Mantener la selección actual de códigos tipados, sin abrir nuevas categorías.
- app-v4/src/export/ExportStep.batchSummaryDiagnostic.test.tsx: añadir oráculo adversarial para rechazo inesperado CSV con Error.name/Error.message centinela; conservar el test previo de código tipado y cero descarga.
- app-v4/src/export/ExportStep.batchSafe.test.tsx: reutilizar mocks y fixtures para cubrir fallo inesperado en ZIP y PDF consolidado con nombre/mensaje centinela; conservar tests positivos previos y comportamiento de descarga cero. Si el harness existente no permite estos dos fallos sin modificar su estructura, STOP con impedimento exacto; NO ampliar a helpers compartidos o tests externos sin decisión Cora.
- No modificar rutas distintas de esos tres archivos; ninguna dependencia, CSS, UX, engine, almacenamiento, privacidad doctrinal, estado de job ni código de Confidential.

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
