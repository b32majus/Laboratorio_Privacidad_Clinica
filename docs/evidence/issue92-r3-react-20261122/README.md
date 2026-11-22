# REC-12 / #92 — R3 visual real de V4, Sophilux B V1

**Fecha:** 22/11/2026. **Rama:** `work/lab-rec12-r3-react-20261122` en worktree Herdr aislado. **Estado:** **DIA OK LOCAL**, implementación visual verificada con capturas y segundo revisor independiente; no publicada.

## Autoridad

Sil **aprobó expresamente la tercera columna, Propuesta R3**, el 22/11/2026, tras revisar la comparativa maestro Sophilux B V1 (12/10) / V4 en F8 / maqueta R3. La fuente congelada continúa intacta: `docs/design/sophilux-b-v1/ACCEPTED_VISUAL_CONTRACT.md`. El mock en `docs/evidence/issue92-r3-sophilux-maqueta-20261121/` es referencia estética/jerárquica, **no motor ni permiso para simular decisiones clínicas**. Issues #92/#93 no están cerrados.

## Cambios de producto, acotados a cuatro archivos

| Pantalla | Composición implementada | Semántica real preservada |
|---|---|---|
| Revisión | `ReviewWorkspace.tsx`: 24 hallazgos de prueba; Progreso y Filtros co-presentes en **una franja superior** a 1440; debajo documento, hallazgos e inspector en tres columnas; en 375 inspector primero. `sophilux-v1.css` mantiene tokens y estilos de marca. | Filtros activos sin disclosure, ocho métricas, selección, editor, atajos, borradores, marcar manual, Keep con confirmación, foco, navegación y un solo estado canónico. |
| Celdas | `StructuredFreeTextReview.tsx`: tras procesamiento, resumen de 2 celdas / 4 decisiones y acción contextual de reproceso, lista y celda activa tempranas; detalle explicativo después. En móvil inspector activo antes del documento. | Una instancia del revisor de texto para la celda, autoridad de columnas y sesiones, flags/errores, procesamiento solo por acción humana, salida bloqueada si quedan pendientes. |
| Resultado | `ExportStep.tsx` y `sophilux-v1.css`: SingleItem muestra **cabecera/estado** y debajo aviso factual Keep, acción principal, preview Safe a la izquierda y formatos secundarios a la derecha, Confidential separado. Lote/estructurado conservan sus entregables y reciben solo un ajuste de encabezado. | `deriveSingleResultView` proporciona `safeText` canónico, sin recalcularlo. Preview de **texto Safe solo si `ready`** (puede contener un dato conservado por decisión humana); **ningún preview en `needs-attention` ni `blocked`**. Confirmaciones y descargas no cambian. Sin preview inventado para lote o tabla. |

**Decisión de accesibilidad:** los roles, etiquetas y controles existentes se mantienen. En escritorio, el contenedor genérico de hallazgos utiliza `display: contents` para que la franja superior y la lista puedan ocupar áreas diferentes del grid; sus secciones con etiquetas y roles permanecen en el DOM. El tabulador, el modo móvil y el regreso de foco son contratos de los tests; la auditoría ciega independiente examina este punto.

## Evidencia ejecutada contra build Vite de producción, solo datos sintéticos

- **Prueba RED original:** `e2e/rec12-r3-sophilux.spec.ts` en commit local `1aa7a97`, seis escenarios rojos contra la composición V4 anterior; no se cambió el test durante implementación/corrección.
- **Prueba GREEN:** `7/7` recorridos nuevos, dos Viewport 1440/375 de Revisión, dos de Celdas, dos de Resultado ready y uno de needs-attention sin Safe en DOM. Incluye preparación real de 2 celdas, 24 detecciones, original deliberadamente conservado, 0 overflow.
- **Regresión funcional de vecinos:** `16/16` E2E Playwright (suma de 7 nuevos + 9 anteriores) incluyendo documento, lote, structured XLSX y flujo Confidential, bajo el monitor automático de ausencia de red externa.
- **Vitest:** `124/124` en 4 suites (ReviewWorkspace, StructuredFreeTextReview, ExportStep y unmount).
- **Build/Typescript/ESLint/Prettier:** PASS. `check-external-resources.mjs --scope=source`: PASS sobre 85 ficheros runtime, 0 excepciones de red autorizadas. Advertencias conocidas de `pdfjs-dist` (canvas/fuentes en entorno de prueba) y tamaño de chunks; no constituyen pruebas de fuga.
- **Capturas de 7 vistas** en `actual/` (viewport y full a 1440/375, `metrics-*.json`). Test E2E visual `e2e/rec12-r3-visual-capture.spec.ts`: **2/2 PASS**; el origen es una compilación de producción con estado sintético real, no el mock.
- **Seis láminas** `comparaciones/{revision,celdas,resultado}-{1440,375}-comparacion.png`: **maestro aprobado → V4 F8 anterior → V4 R3 actual**. El contenido no es byte a byte idéntico entre prototipo y producto, ni se afirma pixel-perfect. El testigo F8 original no se modificó.

**Límite de medición:** el extractor F8 tradicional mide `.sx-review-findings` como caja 0×0 cuando su wrapper se vuelve `display: contents`. Para evaluar Hallazgos en R3 usar `.sx-r3-findings-first` (captura: comienzo visible a ≈438px con 1440; las zonas documento/inspector comienzan a la misma altura). Esto es una limitación del extractor histórico, no overflow ni desaparición de la lista. Las reglas de no overflow siguen verificadas a 1440/375.

## Uso y límites

Abrir `comparador.html` y luego los PNG/medidas para revisión manual. Si se usa el repositorio, ejecutar:

```bash
npm run typecheck:v4
npx vitest run app-v4/src/review/ReviewWorkspace.test.tsx app-v4/src/structured/StructuredFreeTextReview.test.tsx app-v4/src/export/ExportStep.test.tsx app-v4/src/export/ExportStep.unmount.test.tsx
npm run build
E2E_PORT=4272 npx playwright test e2e/rec12-r3-sophilux.spec.ts e2e/rec05-result.spec.ts e2e/structured-rec04-composed.spec.ts e2e/rec87-batch-result.spec.ts --workers=2
E2E_PORT=4273 npx playwright test e2e/rec12-r3-visual-capture.spec.ts --workers=1
```

**No se ha publicado**: sin push, PR, merge, despliegue ni cierre del #92. R3 todavía incluye dos microajustes de español H-01/PDR-08 y decisión humana de rendimiento GAP-01/PERF-002; R4 acta GO/NO-GO posterior. Sin autorización de uso con datos de pacientes reales.

## Cierre de auditoría DIA M/sensible — 22/11/2026

Se ejecutó una revisión de composición del **producto V4 real** sobre las capturas de Revisión, Celdas y Resultado (1440/375), no solo contra las aserciones de geometría. La primera implementación superaba 7/7 E2E pero aún dejaba Hallazgos debajo de dos tarjetas y el Resultado completo en la columna derecha. Se realizó **un REHACER visual acotado**, manteniendo las pruebas RED: franja de Progreso/Filtros, hero de Resultado con título/estado, advertencia, CTA, preview Safe principal izquierdo y formatos secundarios a la derecha. El ajuste técnico final ordenó en DOM **Safe preview antes de Otros formatos** para lector de pantalla sin cambiar la condición de autorización ni descargas.

**Evidencia final tras el ajuste lector:** 16/16 E2E (7 R3 + 9 regresión), 2/2 escenarios de captura 1440/375, TypeScript y build PASS, Vitest focal final 45/45 y anterior general focal 124/124, ESLint/Prettier/guard externo (85 fuentes) PASS. Ningún archivo de motor, política, confirmación, almacenamiento, red o serializador modificado.

**Segundo revisor ciego GLM-5.3 Flash: VEREDICTO OK.** Sin hallazgos de seguridad, autoridad de export ni fugas de datos. Informó una diferencia de fidelidad **media**: el CTA de copiar continúa **después del aviso Keep** en lugar de estar dentro del hero como la maqueta. Se conserva deliberadamente ese orden del producto previo para no degradar la advertencia de originales conservados antes de la acción, y se deja visible en las capturas para validación humana. Informó un hallazgo **bajo** sobre el DOM de lectura Safe/Formato, **corregido** y retestado; y notas bajas de cobertura (filtro Pendientes no prueba transiciones de estado mixto y blocked sin test nuevo específico, aunque la regla de no-render se verifica en código y hay regresiones de estados bloqueados). No se solicitó otra revisión global después de la corrección acotada.

**Estado:** R3 visual OK LOCAL; no se afirma cierre #92, publicación ni seguridad para datos reales. Siguen pendientes español H-01/PDR-08 y GAP-01/PERF-002 antes de R4.
