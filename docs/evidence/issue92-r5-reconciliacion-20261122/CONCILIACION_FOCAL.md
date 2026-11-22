# REC-12 #92 · R5 — Conciliación focal de evidencia material, sin reauditar R4

**22/11/2026 · KairOS DIA fase de investigación/conciliación · candidato `67112b7` · solo datos sintéticos.**
**Resultado:** `R5_PARTIAL_MATERIAL_RECONCILIATION / NO_GO_ISSUE92_CLOSE`. No modifica producto, pruebas, reglas, políticas, motores, matrices congeladas ni estados de GitHub. La decisión humana de GAP-01 permanece en la adenda §F de R4.

## 1. Objetivo y prueba focal realmente ejecutada

R4 dejó un `NO-GO` por **pruebas materiales insuficientemente conciliadas**, no por un fallo nuevo demostrado del motor. En R5 **no se repiten** los 1.569 tests ni los 47 E2E, y no se reabre la auditoría DIA de R3. Se contrastan los puntos concretos que pueden cambiar las conclusiones de #92: D-021/GAP-06, densidad de 32 columnas, CI/CodeQL y los PDR/G-HP.

- **GAP-06 / D-021, evidencia positiva actual:** `npx vitest run app-v4/src/structured/structured-export.test.tsx -t 'REC12-GAP-06'`: **3/3 PASS** (otros 12 tests de la misma suite no seleccionados). Case A comprueba **bytes Safe CSV + XLSX** bajo `external-ai`: fecha de nacimiento transformada a banda de edad **al momento de la visita**, y no fecha/mes de nacimiento. Case B comprueba exactamente `Edad_Num` **34, 35, 41** como valor textual en CSV y como **número de tipo n** en XLSX, solo para columna con `insensitive/keep`. Los tres tests **ya existían y estaban reconciliados en el código**; el relato de R4 «conciliación test-only pendiente» está desfasado para esta parte. Decisión humana vinculante `docs/shaping/CURRENT_DECISIONS.md` D-021, 14/10/2026. `external-ai` es perfil local; conservar edades no acredita anonimización ni permiso de comunicación fuera del entorno. **No reabrir cambios de semántica.**
- **32 columnas reales, no una simple promesa:** `e2e/rec12-r3-visual-capture.spec.ts:166–225` construye CSV sintético de **32 columnas**, verifica `Columnas: 32`, **19 pendientes** y **32 filas en la tabla de clasificación**. Ese test fue ejecutado **2/2 PASS en R3** sobre la V4 React real (1440/375); `docs/evidence/issue92-r3-react-20261122/actual/metrics-{1440,375}.json` y PNG están versionados. En el candidato posterior, `git diff 62bc619..67112b7 -- app-v4/src` confirma que solo cambiaron las **dos frases de App y policy-guidance**: estructura y estilos de esta tabla no se modificaron. No se ha vuelto a ejecutar el capturador en R5 (para no sobrescribir las capturas probatorias de R3); no declarar una nueva ejecución 2/2 en este tramo.
- **Medida de jerarquía a 375 px:** `metrics-375.json` indica `scrollWidth=375` (sin overflow), tabla empieza en **y≈1.111 px** e inspector en **y≈2.847 px**; a 1440, tabla e inspector empiezan ambos en **y≈507 px**. Examen de la captura real `estructurado-375-viewport.png`: arriba hay cabecera + política + largo texto explicativo + resumen de 32 columnas/19 pendientes y bloqueos; **la clasificación/inspector no aparece en el primer viewport de 800 px**. La ausencia de desbordamiento no resuelve **G-HP1 y G-HP5** en ese estado. **Hallazgo visual de priorización, no fallo del motor, no modificación no autorizada de UX.**
- **CI y CodeQL remotos, no solo configuración:** `.github/workflows/ci.yml` tiene `npm test`, build y TypeScript, y run GitHub Actions `44903478299` **SUCCESS** en `3.0-main@46bce0a` (21/11); `codeql.yml` run `44903478279` **SUCCESS** en el mismo SHA. `.github/dependabot.yml` programa npm + GitHub Actions semanalmente, **sin prueba aquí de PR/alertas ni de cobertura medida**. **Ningún CI remoto ha probado todavía los commits locales R2/R3/R4/R5.**
- **R4 ya acreditó en su alcance:** `npm test` 92/92 suites, 1.569/1.569 Vitest; `check:privacy-eval` legacy y `check:privacy-eval:v4` 28/28; E2E conjuntos 46/47 + un timeout a 30 s en texto largo, **mismo caso aislado PASS 16,3 s**. Se preserva esa incidencia sin nuevas repeticiones.

## 2. Los doce PDR: qué está demostrado y qué sigue abierto

Aquí `TESTIGO_ACOTADO` significa que **existe y se ejecutó el testigo indicado**, no que la obligación universal ni la fila histórica se declaren cerradas. `DECISIÓN` exige aprobación humana si cambia el diseño o la autoridad. La matriz §C está congelada salvo las adendas ya autorizadas; no sobrescribir su estado.

| PDR | Contraste material sobre candidato | Disposición R5 |
|---|---|---|
| 01 · Sin fases ceremoniales | `ux-closeout-shell.spec.ts` pasó en R4 para tipos de trabajo; se evita landing extra y se aterriza en tarea cuando corresponde. | `TESTIGO_ACOTADO`; no se infiere todos los estados posibles. |
| 02 · Revisión para decidir a densidad real | R3 muestra 24 detecciones y editor/inspector a 1440/375; `rec05-result:156` PASS aislado, timeout 30 s bajo 3 workers. | `TESTIGO_ACOTADO`; límite carga y corrección de casos raros. |
| 03 · Marcado manual sin offsets | `review-export.spec.ts` R4 2/2 desktop/móvil PASS; selección, pendiente, confirmación y retorno de foco. | `TESTIGO_ACOTADO` respaldado por #81/#82. |
| 04 · Comparación de columnas con inspector | 32 columnas/19 pendientes renderizadas en R3, 375/1440; en móvil inspector real a y≈2.847 px tras tabla larga. | `DECISIÓN_VISUAL_PENDIENTE_375` para G-HP1/5; el mecanismo de clasificación no está roto. |
| 05 · Lote como cola recuperable | `rec87-batch-result.spec.ts` R4 PASS: 12 documentos, 2 fallos, retirada/recuperación y salidas. | `TESTIGO_COMPUESTO`. |
| 06 · Resultado como final humano | `rec05-result` y `rec87-batch-result` R4 PASS en casos ready/needs-attention/blocked y acción por material. | `TESTIGO_COMPUESTO`. |
| 07 · Guía de políticas discreta | `ux-closeout-shell.spec.ts` y `App.policy.test.tsx`, 375/1280; la corrección local de texto mantiene disclosure/availability. | `TESTIGO_ACOTADO`. |
| 08 · Español profesional | REC-10/F7/F9 y dos microcorrecciones R3; errores principales/ARIA seleccionados en español, sin barrido total de todos los estados y errores de fichero. | `VERIFICATION_PENDING`, no UI predominantemente inglesa. |
| 09 · Jerarquía visual funcional | Sophilux B V1 maestro aprobado; R3 Revisión/Celdas/Resultado implementadas y contrastadas a 1440/375, tercera columna autorizada por Sil. | `ACEPTACIÓN_VISUAL_R3`, sin extrapolar a Estructurado-32 móvil. |
| 10 · Evidencia con densidad real | 24 hallazgos, 32 columnas, 12 documentos+2 fallos, texto largo. En R3 móvil Estructurado pospone tarea; R4 timeout conjunto de alto volumen. | `TESTIGO_DENSIDAD_PARCIAL` + `DECISIÓN_VISUAL_PENDIENTE`. |
| 11 · Feedback y corrección | `review-export`, `rec05-result`, `batch`, `structured-composed` cubren feedback y retorno sin borrar trabajo ajeno en casos representativos. | `TESTIGO_ACOTADO` para recorridos ejercitados; no todas las excepciones. |
| 12 · Safe/Confidential asimétricos | `rec05-result`, `rec87-batch-result` y `structured-rec04-composed` comprueban acciones deliberadas, cancelación sin descarga, Safe separado. R3 solo previsualiza Safe `ready`. | `TESTIGO_COMPUESTO`; ninguna salida se califica de anonimización garantizada. |

## 3. Los diez gates G-HP aplicables

| Gate | Conclusión R5 | Límite concreto restante |
|---|---|---|
| G-HP1 · Tarea predominante | **Pendiente en Estructurado móvil con 32 columnas**; R3 corrigió Revisión/Celdas/Resultado | Tarea tras intro/resumen y scroll largo; requiere decisión humana visual antes de redistribuir |
| G-HP2 · Sin fase vacía | **Testificado** por recorridos `ux-closeout-shell` | No afirmar universalidad de estados no visitados |
| G-HP3 · Lenguaje de dominio humano | **Testificado parcialmente** en español y rutas principales | Variantes excepcionales/ARIA/file-errors no exhaustivas |
| G-HP4 · Fricción rutinaria | **Sí hay testigo explícito** `rec05-result:156` (1 transición Review→Result, 1 acción principal); el R4 previo no debe decir «ningún conteo» | No hay comparación de coste entre todos los tipos de trabajo |
| G-HP5 · Densidad | **Real probada**: 24 hallazgos/32 columnas/12 documentos con 2 fallos | Móvil de Estructurado: orientación por decidir; timeout bajo concurrencia no ignorado |
| G-HP6 · Feedback | **Testificado** en copia, fallo PDF, revisión y lote | No todos los errores asíncronos imaginables |
| G-HP7 · Corrección | **Testificado** en Review/lote/estructurado, cambios de política invalidan review obsoleta | Comodidad y recorrido a volumen alto de 32 columnas no demostrado |
| G-HP8 · Comprensión de Resultado | **R3 visual aprobada y estados observados** | No existe evaluación humana específica de comprensibilidad real en casos complejos; no inferirla de un selector visible |
| G-HP9 · Separación Safe/Confidential | **Testificado funcionalmente** en los tres materiales, confirmaciones independientes y cancelación | Revisión visual humana de los demás estados si se exige cierre integral |
| G-HP10 · Recorrido completo | **Varios E2E compuestos por tipo de material** (correcto: los tipos son mutuamente excluyentes) | Una ejecución conjunta R4 tuvo 1 timeout de 47; no falsear conjunto 47/47 |

## 4. 23 filas antiguamente pendientes de R1 — prioridades reales, no repetir 142 tests

R1 `EVIDENCIA_POR_FILA.csv` tiene **100 testigos reutilizados + 1 específico**, **14 deudas posteriores**, **2 supersesiones**, **2 pendientes de aceptación visual** (H-02 y UX-005) y **23 antiguos `PENDING_COMPOSED` reclasificados en siete grupos**. La conciliación es semántica y no cambia la fila congelada por comprobar solo sus rutas:

| Grupo de R1 | IDs | Situación precisa tras R5 |
|---|---|---|
| 9 ingeniería / CI con testigos recientes | BATCH-004; ARCH-007; ARCH-008; ARCH-009; ARCH-010; CI-001; CODE-001; CODE-003; UX-002 | Recorridos y CI actuales aportan evidencia, **incluido CI GitHub verde `44903478299`** para la rama remota. Falta reconciliar fila vs cláusulas concretas antes de pasar a `VERIFIED` sobre candidato final local. |
| 6 gobierno/documentación/hosting | GOV-001; GOV-002; GOV-003; DOC-001; HOST-001; HOST-002 | Separar pruebas técnicas actuales del **cierre formal #93** (CI required, branch protection, documentación final, origen/headers definitivos). No marcar PASS por la existencia del fichero. |
| 2 privacidad/paridad | PRIV-003; QA-002 | R2 analizó **10 canales** y **18 preguntas**, R2-01 corrigió dos catches XLSX, y R4 ejerció flujo compuesto con límites. **No 13/13** ficticios ni «cero fugas posibles». |
| 2 idioma | H-01; PDR-08 | Mejorado y cubierto en casos principales, **no universalmente verificado**. No repetir correcciones R3 ya correctas. |
| 2 UX | UX-001; UX-007 | App-shell y estados testificados; aviso contextual y jerarquía en casos representativos. No confundir documentación de la pantalla con aceptación G-HP de toda su densidad. |
| 1 rendimiento mecanismo | PERF-002 | PDF.js/Mammoth/SheetJS/Worker diferidos en F5; **pdf-lib/jszip estáticos** en exportación; la aceptación humana GAP-01 de mediciones V4 no equivale automáticamente a `PERF-002 VERIFIED_RESOLVED`. No refactorizar sin prueba de cuello de botella. |
| 1 tipografía | H-03 | JetBrains Mono propuesto históricamente no está instalado, aunque Inter/Cormorant están aceptadas; conservar como `TARGET_GAP` sin inventar supersesión humana ni bloquear rediseño de fondo. |

H-02 y UX-005, los **dos pendientes visuales fuera de esos 23**, tienen la decisión de identidad Sophilux y mejoras R3 aprobadas; deben vincularse a las capturas **reales** del producto (no solo al mock) y conservar la excepción de Estructurado móvil si se pretende afirmar recuperación integral.

## 5. Addenda §F, estado sin falsear evidencia

- `GAP-01`: **deuda de medición compuesta aceptada por Sil** el 22/11. No implica motor rápido, ni aceptación de otros GAP.
- `GAP-02`: DICOM **FUTURE_NOT_RECOVERY**.
- `GAP-03`: CodeQL **tiene runs reales SUCCESS**, uno en SHA remoto `46bce0a` / run `44903478279`; Dependabot semanal **configurado**, pero actividad/estado y medición de **coverage** no acreditados. Gobierno #93 condicionado al cierre #92.
- `GAP-04`: identificación textual no cromática, E2E Chromium 375/1280 **PASS** R4 en su alcance.
- `GAP-05`: URL sin datos clínicos E2E **PASS** R4; B3 documenta captura de headers HTTPS Render 18/11. Falta smoke **del origen/publicación definitiva** en #93; no atribuir esa captura previa a la nueva V4 aún no desplegada.
- `GAP-06`: **3/3 PASS reejecutados en R5** con bytes CSV/XLSX y T19/D-021; obligación original **nítidamente supersedida SOLO para edad numérica con `keep`**; sigue prohibido extrapolar que esos datos son anónimos.
- `GAP-07`: sin persistencia silenciosa en testigo R4, **PASS acotado**; si se implementa recuperación futura exige opt-in/expiración/borrado.

### Comparador visual para la decisión humana

Abrir `docs/evidence/issue92-r5-reconciliacion-20261122/comparador-estructurado-movil.html`: tres columnas **Sophilux (estilo aprobado, estado distinto)** → **U4 con 32 columnas** → **V4 R3 con 32 columnas**, con selector de captura de primer viewport / página completa. Las cinco imágenes son copias de evidencia existente, de **solo datos sintéticos** y empaquetadas con el HTML para que la carpeta funcione por sí sola. No son una nueva maqueta aprobada ni sustituyen los tests ni el contrato de producto.

## 6. Conclusión y único paso de diseño que merece nueva intervención

**No volver a realizar un REC-12 global ni recrear un corpus nuevo por inercia.** Se ha localizado un **posible bloqueo de jerarquía de producto, visible y pendiente de decisión humana**: en Estructurado móvil, la lectura de 32 columnas sitúa la tarea e inspector muy abajo, a diferencia del escritorio. La medida por sí sola no demuestra que toda la interacción sea inutilizable. **Propuesta próxima DIA Diseño (sin React aún):** maqueta acotada a jerarquía de **Estructurado 32 columnas en 375 px** (tarea/columna activa, inspector/decisión accesible, lista y bloqueo preservados); comparación con V4 real y fuente Sophilux antes de tocar código. No debe cambiar clases/políticas, confirmaciones, IDs, tipos, selección/foco ni exportadores. Sil valida ese diseño visual antes de una implementación sensible.

**Siguen abiertos**: cierre material de filas relevantes `#92` (sin 142 PASS ficticios), H-01/PDR-08 por estados extremos, fricción/usabilidad G-HP y verificación de publicación gobernada `#93`. `R4 NO-GO` se mantiene. Se recomienda probar primero el ajuste visual focal por contrato de diseño, en vez de lanzar otra auditoría ciega larga que vuelva a leer lo ya verificado. No se ha pedido ni obtenido autorización de publicación/cierre o despliegue.
