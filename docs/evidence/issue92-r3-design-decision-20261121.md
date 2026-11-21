# REC-12 / #92 · R3 — decisión de fidelidad Sophilux, idioma y rendimiento

**Fecha:** 21/11/2026 · **Estado:** PROPUESTA DE DECISIÓN HUMANA / DIA DISEÑAR, SIN IMPLEMENTACIÓN · **Candidato local base:** `work/lab-rec12-r2-01-xlsx-error-guard-20261121@489ef0b`; V4 integrada `3.0-main@46bce0a8f8a25ac5c18c41b2303ae2c785246ddd`, sin publicar cadena R1-R2-R2-01.

## Autoridades contrastadas, no sustituidas
- `docs/design/sophilux-b-v1/ACCEPTED_VISUAL_CONTRACT.md` (12/10: 7 vistas aprobadas, adaptación D1-D4/VF-01…08, maestro congelado).
- `docs/design/sophilux-b-v1/SOPHILUX_B_V1_FUNCTIONAL_RECONCILIATION.md` (prioridad de decisiones reales, privacidad y navegación sobre simulación del prototipo).
- `docs/design/sophilux-b-v1/IMPLEMENTATION_FIDELITY_REGISTER_20261014.md` (acuerdo posterior **#92 → #93 → recomposición UX**, salvo obstáculo material y excepción humana acotada).
- `docs/evidence/issue92-f8/README.md`, `COMPARADOR_F8.html`, `actual/`, `referencias/` y `actual/metrics-{1440,375}.json` (comparación de capturas reales contra maestro, 26 capturas de 7 vistas + 14 referencias; baseline F8 `c615a9d`).
- `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` §8 (G-HP1…10), `docs/evidence/issue92-f7/INVESTIGACION.md`; `gh issue view 92` (seis criterios de aceptación originales), `docs/evidence/issue92-f8/H01_PDR08_STATE_LEDGER.md`.
- `docs/audits/2026-10-recovery-traceability-matrix.md` REC12-GAP-01; `docs/specs/SPEC_V4_QUALITY_SECURITY_DEPLOY.md` §7–8 y `scripts/benchmarks/engine-bench.mjs`.

## A. Las tres desviaciones visuales, mismo estado sintético/viewport

| Pantalla | Evidencia comparada | Importancia en #92 | Delta mínimo propuesto para un futuro mockup humano |
|---|---|---|---|
| **Revisión 1440** | Maestro: documento dominante + hallazgos compactos + decisión en el primer espacio de trabajo. V4: documento e inspector visibles; Progreso y Filtros preceden a Hallazgos dentro de columna central, empujando las decisiones de la cola hacia abajo. Captura F8 real: documento aprox. x61, y288, ancho 626; columna de hallazgos x701, ancho 309. | **G-HP1 / G-HP5**: el usuario puede ver el texto y actuar en inspector, pero pierde visión de cola con 24 hallazgos; la funcionalidad E2E no prueba prominencia. | Mantener **tres zonas** y proporciones Sophilux; subir Hallazgos justo después del título de zona, convertir Progreso a línea compacta y Filtros en control contextual, sin ocultar marcado manual, borradores, navegación, confirmación Keep, accesibilidad y foco. Eliminar cajas redundantes solo si no son autoridad de estado. |
| **Celdas 1440/375** | Maestro: lista de celdas, contenido activo e inspector inmediatos. V4: explicación de flujo, indicadores, reproceso y otro título «Revisión» ocupan espacio antes de los elementos decisionales. En F8 a 375px, cola empieza y≈747; panel activo y≈915; documento y≈1764. Sin overflow global. | **G-HP1 / G-HP5**: el estado procesado se ve, pero el trabajo real se localiza tarde en móvil. | Identificar celda y decisión actual antes de la explicación extensa; convertir cuatro contadores en resumen compacto; colocar `Reprocesar` como acción contextual visible y preservar sus condiciones; reducir repetición de encabezados sin retirar errores ni feedback. En 375, conservar la prioridad del inspector para la celda activa y acceso claro a la lista. |
| **Resultado 1440/375** | Maestro: estado + acción contextual + vista previa preparada + advertencia cercana, con Confidential aparte. V4: tarjeta hero izquierda solo editorial; derecha concentra aviso de original conservado, texto de disponibilidad y botones. No hay preview material de Safe. En 375, el CTA queda por debajo del aviso. | **G-HP8 / G-HP9**: funcionalmente el estado, botón y zona Confidential están distinguibles en pruebas, pero falta fidelidad compositiva y la comprensión visual no ha sido validada con humano. | Recuperar una zona de vista previa **solo del Safe autorizado**, `ready` y por material: texto Safe para texto/documento, manifest/datos no identificativos en lote/estructurado; jamás fuente clínica, `originalText` ni correspondencias Confidential. Mantener aviso de original conservado perceptible junto al estado/CTA y auditoría separada; no usar claims de confianza/anónimo ni introducir botones de demo. |

**No se ha reimplementado ni medido un nuevo diseño en esta unidad.** El contrato ratificado no autoriza trasladar acción principal o cambiar contenido por criterio del implementador. La geometría F8 indica scrollWidth=viewport a 1440/375, prueba de no overflow en esos estados, no de aceptación G-HP ni de la calidad visual. La corrección R2-01 tocó solo catches de error XLSX, no composición; F8 sigue siendo referente válido de la jerarquía normal, no una captura exacta de todos los errores post-R2.

## B. Español profesional H-01 / PDR-08

**No reaparece una UI predominantemente inglesa.** REC-10/F7/F9 ya abarcaron textos principales y errores. La clasificación histórica H-01 LOST por «UI mayoritariamente inglesa» no describe el producto visto y debe conciliarse contra hechos, sin convertirla automáticamente en PASS exhaustivo.

El código actual contiene al menos dos frases formales visibles y concretas aún no armonizadas con el tono de instrucciones en segunda persona:
- `app-v4/src/App.tsx:430`: «**Use una sola entrada** por trabajo: texto pegado o archivos, no ambos.» → propuesta **«Usa una sola entrada por trabajo: texto pegado o archivos, no ambos.»**.
- `app-v4/src/policy-guidance.ts:58`: «**Cree un trabajo** para ver qué políticas están disponibles para su tipo.» → propuesta **«Crea un trabajo para ver qué políticas están disponibles para ese tipo.»**.

El anterior registro F8 también citaba «Revise el texto» y «Consulte la disponibilidad»; se comprobaron las fuentes actuales y **ya no se deben citar como fallos vigentes**: `App.tsx:168` ahora dice «Revisa...», y los cambios de F7/F9 cubren estados de error seleccionados. Restan variantes raras, ARIA y nombres de archivo no barridos en su totalidad. Una futura unidad **DIA pequeña y acotada de copy/test** debe preservar causa de error, permisos y bloqueo; no rehacer traducción general, no prometer totalidad.

## C. Rendimiento PERF-002 / REC12-GAP-01

**Dos obligaciones distintas:**
- PERF-002 (lazy-load): F5 verificó por tráfico real Render que pdf.js, Mammoth y SheetJS se cargan bajo demanda y que el worker es diferido. Aun así, pdf-lib/jszip exportadores están en entry inicial; no declarar lazy completo. Matriz histórica afirma PERF-002 VERIFIED_RESOLVED mientras B3 lo deja PENDING_COMPOSED; la reconciliación debe decir «testigo observacional parcial, sin refactor obligatorio».
- GAP-01 (benchmarks): sí existen **artefactos versionados previos** `benchmarks/baseline-wu0.json` y `benchmarks/final-closeout.json`: **cuatro tamaños 10/100/500KB/1MB y 1/10/50 documentos con tiempos**, tres repeticiones y recuento de detecciones, ejecutados sobre el núcleo `js/modular-processor.js PrivacyProcessor`. Es incorrecto decir que no existe *ningún* benchmark versionado. Pero estos reportes **no** prueban la latencia del flujo V4 compuesto en Web Worker, memoria ni respuesta de interfaz. Por ello **NO cumplen por sí solos** toda la obligación GAP-01 y no justifican marcarla verificada; el script tampoco mide memoria/responsividad. El benchmark del núcleo incluye medianas variables y no es un umbral universal.
- **Decisión pendiente:** añadir medidor específico V4 (UI/responsividad + memoria cuando práctica) con las siete dimensiones/tamaños o aceptar explícitamente la parte faltante como deuda post-recuperación según la matriz, manteniendo límites. Se recomienda **deuda limitada, aceptada por humano** para no abrir refactor de rendimiento sin cuello de botella observado; conservar los reportes reales ya existentes como evidencia parcial.

## D. Problema de secuencia que debe resolver la responsable

El acuerdo humano de 14/10 establece **#92 → #93 → recomposición UX**. Pero el sexto criterio explícito de #92 exige que recorridos con densidad real **satisfagan G-HP1–10**, no solo que Playwright vea elementos. Las tres diferencias afectan especialmente a G-HP1/5/8. Por tanto:

- **Ruta recomendada: excepción mínima previa a #92.** Autorizar solo **fidelidad funcional de jerarquía** de Revisión, Celdas y Resultado con una maqueta HTML/Sophilux aprobada y capturas de los mismos estados 1440/375 antes de tocar React. Esto completa la prueba material G-HP en el marco de #92; **no autoriza un rediseño general**. Después #93, y recomposición UX restante como estaba acordado.
- **Ruta de máxima fidelidad al orden original:** no cambiar nada visual antes de #93; **#92 continúa OPEN** y, por dependencia, #93 no debe cerrarse como si #92 estuviera completo. Para alterar la dependencia o declarar G-HP supeditado a deuda hace falta una supersesión/decisión humana explícita y compatible con la autoridad de #92; **documentar una deuda sin más no equivale a cumplir el criterio**.

**No se ha elegido ninguna de esas rutas en nombre de Sil.** La frase «siguiente» autoriza continuar el análisis, no reinterpretar la aprobación de orden anterior.

## E. Ocho criterios propuestos para el siguiente tramo de diseño, SOLO SI HAY GO

1. La maqueta parte de la **fuente Sophilux B V1 aprobada** (no V2 libre) y mantiene sus tokens, estilo editorial y variaciones por material.
2. Revisión con **24 hallazgos**: documento prominente, lista de hallazgos y decisión co-presentes en 1440; filtros/progreso secundarios, sin perder ninguna función real o regla de foco.
3. Celdas con **2 celdas reales y 4 decisiones**: celda actual y sus decisiones identificables sin leer un muro previo; continuidad y acceso en 375.
4. Resultado `ready` con `Keep original`: advertencia, estado, CTA y **preview Safe** visibles y relacionados en 1440/375, Confidential explícitamente aparte.
5. En `blocked` / `needs-attention`, **ningún preview de datos** que no esté autorizado; no mostrar fuente ni correspondencia Confidential ni atribuir anonimización.
6. No copiar botones, siete pestañas, datos, CTA universal ni simulaciones del prototipo como si fueran semántica real.
7. Evidencia humana del mismo estado con maestro/aplicación/maqueta en 1440 y 375; sin nuevas unidades de revisión repetitivas ni prometer pixel-perfect.
8. **Fase diseño primero**: aprobar HTML/CSS/screenshot; solo después DIA implementación con test de recorrido, comprobación geométrica y auditoría única independiente. Nada de modificar motores, políticas, exportadores, datos reales o sesión original Herdr.

**Estado:** WAIT_HUMAN_DECISION. #92 sigue abierto, #93 subordinado. Sin cambios de código, tests, aprobaciones, servidor, publicación o documentación de autoridad congelada.
