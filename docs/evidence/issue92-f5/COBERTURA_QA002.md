# REC-12 F5 · Mapa de testigos compuestos QA-002

**Fuente**: issue #92 y Stage A S1-Q-04; matriz 2026-10-recovery-traceability-matrix.md; criterios F5 ratificados por GO humano el 21/11/2026. **No es una certificación 13/13**: la fuente describe trece contratos críticos, pero en el material inspeccionado no hay lista cerrada de los 13 para asignar uno a uno sin inventarlos.

| Obligación verificable | Testigo de producto real integrado | Lo que todavía no prueba |
|---|---|---|
| Texto sintético largo, decenas de decisiones, Copiar y TXT Safe | e2e/rec05-result.spec.ts (24 detecciones, comparación de bytes Copiar/TXT) | DOCX y PDF no se comparan en ese mismo recorrido a Copiar/TXT |
| Original directo conservado con confirmación, aviso factual y Safe | e2e/rec05-result.spec.ts; e2e/review-export.spec.ts; e2e/review-productivity.spec.ts | El caso de original conservado no compara las cuatro representaciones en una única sesión |
| PDF textual frente a escaneado y corrupto | e2e/pdf.spec.ts; e2e/batch.spec.ts | No todos los formatos inválidos están emparejados con recuperación |
| Lote 12 con dos errores, recuperar y conservar decisiones | e2e/rec87-batch-result.spec.ts, e2e/batch.spec.ts | Lógica de contenido de las dos salidas PDF no comparada en misma sesión antes de F5 |
| Lote CSV/ZIP/Consolidado Safe y Confidential confirmado una vez | e2e/rec87-batch-result.spec.ts: 1 flujo completo | ZIP: diez ficheros no vacíos; consolidado: páginas >10. **Hueco F5 concreto:** cuerpos PDF no confrontados entre sí tras lectura real |
| Individual/batch/estructurado Confidential cancel/confirm | e2e/rec05-result.spec.ts; e2e/rec87-batch-result.spec.ts; e2e/structured-rec04-composed.spec.ts | Invalidación asíncrona por cambio de autoridad se prueba focalmente en Vitest, no en un único E2E compuesto de las tres ramas |
| Estructurado: hoja, cabecera, columna UNKNOWN, visitas, texto libre, CSV+XLSX | e2e/structured-rec04-composed.spec.ts; e2e/structured-composed.spec.ts; e2e/structured.spec.ts | Densidad de docenas de columnas y cambios simultáneos de política/selección requieren recheck G-HP |
| Procesado sin red externa ni PHI en URL o storage | e2e/network-invariant.spec.ts; e2e/rec12-b3-witness.spec.ts | Suite cubre invariantes en flujos seleccionados, no prueba universal de todas las vistas |
| PERF-002: pdf.js, Mammoth y SheetJS lazy | Playwright observacional F5 real Render (INVESTIGACION.md) | Sin gate persistente, memoria/latencia ni separación de pdf-lib/jszip del bundle inicial |

## Unidad seleccionada con GO humano

**Solo fortalecer el E2E existente del lote**: extraer con pdf.js el texto de los diez PDF ZIP y del consolidado y probar correspondencia de contenido Safe, sin fuente identificable, sin PDF de errores retirados y sin descargas adicionales. Contrato ya ejecutado en baseline F5: build PASS, E2E original 1/1 PASS. El incremento del test debe fallar si desaparece/sustituye un cuerpo PDF, no limitarse a repetir recuentos de páginas o archivos. Si el producto actual cumple, evidencia GREEN sin cambio de runtime, y se conserva QA-002 PARTIAL hasta evaluar todos los demás criterios de #92.

## Autoridad y cuidado

No alterar la matriz histórica ni B3; los antiguos PASS de implementación no equivalen a integridad de REC-12. El ejecutor F5 solo modifica e2e/rec87-batch-result.spec.ts en OpenCode, bajo encargo externo de DIA. KairOS audita tras ejecutar pruebas. No se publican cambios sin GO nuevo.

## Resultado de implementación y única auditoría DIA (21/11/2026)

**GO ratificó los ocho criterios**; implementador OpenCode Go / DeepSeek V4.1 Flash en panel propio de Herdr. Su único diff de código es e2e/rec87-batch-result.spec.ts (+128/−4): lectura de bytes reales con pdf.js de 10 ZIP Safe y consolidado, marcadores únicos 01…10, texto seguro, sin DNI/nombres/errores retirados, paridad normalizada por espacios. Conserva recuentos CSV, ZIP, PDF, Confidential y 4 descargas. **Ningún cambio en React, motor, exportadores, políticas ni datos.**

**Baseline** antes de tocar el test: build PASS; E2E lote 1/1 PASS. **Tras ampliar el oráculo:** Prettier PASS, git diff --check PASS, E2E focal 1/1 PASS. **Prueba de falsación real:** desplazar transitoriamente el ordinal esperado +1 provoca FAIL con esperado «batch 02» frente al texto extraído «batch 01»; restituido el ordinal, E2E 1/1 PASS. El error inicial Buffer vs Uint8Array de pdf.js fue corregido por el implementador antes de auditoría, sin cambio productivo. **Rerun independiente** con puerto aislado de nueve recorridos vecinos (e2e/rec05-result, e2e/rec87-batch-result, e2e/structured-rec04-composed): **9/9 PASS, 0 retries**. Warnings de font/canvas opcional de pdf.js en Node no son fallos del artefacto ni de privacidad.

**Auditoría única:** Cora/GPT-6, veredicto **OK dentro de F5, NO cierre de QA-002**. Segundo revisor ciego opencode-go/glm-5.3-flash, solo lectura y distinto del implementador/auditor. Tres hallazgos menores **confirmados como límites no bloqueantes**, ninguna corrección exigida: (1) los nombres de errores no cubren todos los mensajes teóricos sin filename; la ruta real usa nombre y el Safe solo deriva de ReviewSession, (2) los dos errores sintéticos quedan al final; este E2E no prueba ordinal original tras retiradas intermedias — existe unidad Vitest de indexación, pero no testigo compuesto aquí, (3) cache del helper pdf.js/worker global no se limpia dentro de este proceso E2E; un import fallido hace fallar el test, no induce falso PASS. Una observación adicional de contaminación entre cuerpos del ZIP está mitigada por cuentas exactas y paridad del consolidado. **0 REHACER, 3 límites de reviewer consignados, sin segunda auditoría.**

**Alcance honesto:** QA-002 continúa **PARTIAL/blocker #92** por paridad integral restante (p. ej., cuatro representaciones individuales en una misma sesión, densidad G-HP y cierre de la matriz PDR). PERF-002 conserva el testigo observacional Render PDF/DOCX/XLSX lazy de INVESTIGACION.md, **no** gate CI ni refactor del generador PDF/ZIP inicial. La rama F5 queda local hasta GO específico de push/PR/merge; no se ha ejecutado CI remoto de F5 ni desplegado nada.
