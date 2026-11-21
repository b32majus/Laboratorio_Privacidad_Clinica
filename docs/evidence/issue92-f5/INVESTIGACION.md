# F5 · Evidencia de partida y huecos reales

**Base:** GitHub 3.0-main@739e2964b31b603c9f96d0fe8834348a9a45abd2. Solo lectura de fuente y artefactos locales del producto idéntico (F4 no cambió React). Matriz: docs/audits/2026-10-recovery-traceability-matrix.md; contratos: docs/specs/SPEC_V4_QUALITY_SECURITY_DEPLOY.md §7, docs/evidence/issue92-source-completeness/README.md §2.5–2.6 y issue #92.

## PERF-002: conflicto de clasificación, no fallo clínico demostrado

- **Matriz §A:** PERF-002 = VERIFIED_RESOLVED, P2, no blocker; justificación histórica: motor y parsers lazy/dynamic. **B3 ledger:** PENDING_COMPOSED porque no hay test específico de carga diferida. Conservar ambas autoridades hasta prueba, no modificar ledger histórico.
- **DOCX:** app-v4/src/input/extract.ts usa import dinámico de mammoth. Bundle Vite local del producto en F4: fragmento dinámico index-UUJZqNMr.js de 406247 bytes.
- **Motor:** engine-seam.ts usa import dinámico de registry-engine; bundle de motor separado de 98438 bytes, y worker 109281 bytes.
- **PDF:** pdfjs-loader.ts inyecta /vendor/pdf.min.js bajo demanda. **Excel:** xlsx-loader.ts inyecta /vendor/xlsx.full.min.js bajo demanda. Ambos desde mismo origen.
- **Exportadores:** ExportStep.tsx importa pdf-builder, batchSafeDeliverables y docx-builder de forma estática. El entry dist/assets/index-C3t5Ef_Q.js mide 968534 bytes y contiene cadenas de pdf-lib/jszip/PDFDocument. No se ha medido tráfico de navegador ni mejora de carga por dividirlo. El texto literal de la especificación es “Load heavy parsers/exporters only for the relevant job type where practical”. **No fingir que TODOS los exportadores son lazy ni asumir que el refactor deba hacerse antes de #92.**
- Nombres hash/tamaños corresponden a build local F4 y pueden cambiar en otro entorno; no son umbrales ni medidas de memoria, CPU o velocidad. Próximo testigo con requests realmente recibidas por navegador y decisión documentada.

## QA-002: lo que ya está testificado sin reconstruirlo

| Superficie | Testigos existentes |
|---|---|
| Individual y salidas Safe/Confidential | e2e/rec05-result.spec.ts; e2e/review-export.spec.ts |
| PDF normal y escaneado | e2e/pdf.spec.ts |
| Lote 12, dos fallos, salida bloqueada y recuperación | e2e/rec87-batch-result.spec.ts; e2e/batch.spec.ts |
| Estructurado, hojas/visitas/CSV-XLSX/Confidential | e2e/structured-rec04-composed.spec.ts; e2e/structured-composed.spec.ts |
| Red/URL/almacenamiento | e2e/network-invariant.spec.ts; e2e/rec12-b3-witness.spec.ts |
| Navegación/decisiones y Gate | e2e/ux-closeout-shell.spec.ts; e2e/gate-export-ux.spec.ts |

La procedencia de Stage A S1-Q-04 pide E2E de 13 contratos críticos, pero la fuente accesible presenta ejemplos, **no los trece casos numerados uno a uno**. La presencia de 81 E2E en el último CI no prueba por sí sola cobertura compuesta total; buscar primero la transición concreta ausente, no escribir tests decorativos. QA-002 sigue PARTIAL/bloqueante.

## Precondición para implementar

Sil ratifica los ocho criterios de CRITERIOS_DIA.md. Preparar test RED reproducible del hueco real; si los E2E actuales ya prueban el recorrido entero, marcar evidencia reutilizada sin cambios de aplicación. Las correcciones visuales F3 y #93 continúan subordinadas al cierre real de #92. Sin push/PR/merge/deploy en este tramo.

## Evidencia adicional · navegador real Render (21/11/2026)

Recorridos Playwright Chromium headless aislados, origen https://laboratorio-privacidad-clinica.onrender.com/ (versión del producto @739e296), contextos nuevos y archivos del repositorio exclusivamente sintéticos. Se registraron **rutas de peticiones de scripts**, no datos ni contenido de pacientes. Todos los HTTP iniciales fueron 200 y todos los hosts observados fueron laboratorio-privacidad-clinica.onrender.com:

| Acción / contexto nuevo | JS en carga fría | JS adicional al utilizar el formato |
|---|---|---|
| Solo abrir la aplicación | /assets/index-C3t5Ef_Q.js | ninguno |
| Seleccionar PDF real sintético y crear trabajo | mismo entry | /vendor/pdf.min.js, /vendor/pdf.worker.min.js, /assets/engine.worker-DffSZCuz.js |
| Seleccionar DOCX sintético y crear trabajo | mismo entry | /assets/index-UUJZqNMr.js (Mammoth), /assets/engine.worker-DffSZCuz.js |
| Seleccionar XLSX sintético generado con biblioteca vendorizada 0.20.2 | mismo entry | /vendor/xlsx.full.min.js |

**Alcance:** confirma carga bajo demanda de PDF.js, Mammoth, SheetJS y worker en esos recorridos de la versión publicada; no mide bytes transferidos, latencia de red, rendimiento percibido ni memoria. El entry inicial sigue conteniendo generadores de PDF/ZIP según el bundle examinado, por lo que no se afirma lazy-loading completo de exportación. Los hash de chunks son específicos de esta publicación. No se hicieron descargas de resultados clínicos ni pruebas con datos reales. El testigo fue observacional, ejecutado manualmente por código Playwright temporal; para un gate permanente hay que versionarlo y añadir falsación con peticiones anticipadas.

## Rectificación tras lectura completa del E2E de lote (sin crear tests nuevos)

La prueba e2e/rec87-batch-result.spec.ts NO se detiene en el manifiesto Safe: sus líneas de cierre recorren en la **misma sesión** 12 documentos (2 fallidos retirados) → Result bloqueado → recuperación → CSV/ZIP/PDF seguros → auditoría confidencial en zona separada → cero descargas tras primer clic/Cancelar → una descarga tras Confirmar → retorno a Revisión sin perder decisiones. En particular, los tests de single Confidential de e2e/rec05-result.spec.ts y structured Confidential TXT/XLSX de e2e/structured-rec04-composed.spec.ts también existen. Por eso el criterio F5 no obliga a escribir nuevas pruebas de esas rutas; las usa como testigos existentes.

**Decisión de diseño:** no hay todavía un hueco concreto demostrablemente ausente que justifique modificar lógica o repetir estos tests. La siguiente unidad QA-002 debe primero montar una tabla de paridad por **obligación comprobable**, separando «cubierta en un test compuesto», «cubierta solo de modo aislado», «faltan estados/densidad» y «deuda aceptada»; crear test RED solo para un hueco confirmado. Esta evidencia evita que el 81/81 de E2E se presente erróneamente como «13/13» o recuperación global.
