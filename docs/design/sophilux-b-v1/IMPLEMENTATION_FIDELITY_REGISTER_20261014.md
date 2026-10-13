# Laboratorio · Sophilux B V1 — trazabilidad de composición y deuda de fidelidad

**Fecha:** 2026-10-14. **Estado:** \`HUMAN_REPORTED_DESIGN_DRIFT / RECORD_ONLY\`. Registro de acuerdos humanos y observaciones, **no es** un nuevo mockup congelado, ticket ejecutable ni autorización para modificar V4. Conservar la prioridad actual: #92 REC-12 Etapa B funcional y de privacidad; #93 después de #92.

## 1. Hecho verificado: el maestro SÍ estaba versionado

La responsable reenvió el 2026-10-13 el archivo local \`laboratorio-sophilux-b-propuesta-v1(1).html\`. Su SHA-256 fue verificado de forma directa:

\`58cb8d414c0d842b6fd32bdbe5c9ccf4ad9d155b6317285dddf8b90ec7415774\`

**Coincide exactamente** con la huella que el repositorio ya reconoce como original aprobado:

- **Maestro autónomo e inmutable:** [\`docs/design/sophilux-b-v1/laboratorio-sophilux-b-v1.html\`](laboratorio-sophilux-b-v1.html).
- **Fuentes separadas:** [\`index.html\`](index.html), [\`styles.css\`](styles.css), [\`app.js\`](app.js).
- **Aprobación humana, alcance y SHA:** [\`ACCEPTED_VISUAL_CONTRACT.md\`](ACCEPTED_VISUAL_CONTRACT.md).
- **Reconciliación visual-funcional D1–D4 y VF-01…VF-08:** [\`SOPHILUX_B_V1_FUNCTIONAL_RECONCILIATION.md\`](SOPHILUX_B_V1_FUNCTIONAL_RECONCILIATION.md).
- **14 capturas originales de 7 vistas en 1440 y 375:** [\`visual-evidence-manifest.json\`](visual-evidence-manifest.json) y [\`previews/\`](previews/).

El \`README.md\` y \`CONTRATO_VISUAL_BORRADOR.md\` originales conservan su texto histórico «no aprobado»; **la aceptación posterior del 12/oct prevalece** y los originales no se reescriben.

**Diagnóstico documental correcto:** no se perdió el maestro; existía incluso un contrato vinculante. Se observa una brecha de fidelidad entre **composición aprobada** y **producto mostrado**. Sin trazar todos los handoffs no atribuir de forma categórica la causa a que un agente no leyó el archivo, a la implementación o a una revisión concreta.

## 2. Qué es autoridad y qué no

**Aprobado el 12/oct:** identidad Sophilux B y siete composiciones con sus adaptaciones funcionales explícitas. El maestro no es una «inspiración» que el implementador pueda rediseñar libremente. \`styles.css\` contiene tokens, componentes, proporciones de columnas y responsive; \`app.js\` presenta estados de demostración que NO son permisos reales.

**Superior al mock:** \`docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md\`, la reconciliación aprobada, engine/domain/privacidad, decisiones humanas seguras, accesibilidad y capacidad real de cada material. Si una adaptación funcional obliga a desviar composición, describirla y obtener aprobación humana; no sustituir silenciosamente la pantalla.

**No aprobado aún:** una nueva composición «Sophilux V2», cambios específicos de código, ratios revisados o la conclusión de que las siete vistas actuales fallan. La persona responsable ha descrito fricción y ha aprobado **documentarla, priorizar funcionalidad y rediseñar después**, no reabrir #91 ni dar GO de implementación de UX.

## 3. Comparación preliminar de dos vistas realmente observadas

Procedencia: comparación conversacional humana sobre capturas de la herramienta V4 visible el 13/oct con el HTML aprobado; se registran como **\`REPORTED + SCREENSHOT_OBSERVED\`**, NO como auditoría completa de componentes ni prueba visual automatizada reproducible. Los paths de implementación son puntos futuros de inspección, no evidencia de causa.

| Vista / criterio | Referencia aprobada (12/oct) | Observación actual comunicada (13–14/oct) | Disposición |
| --- | --- | --- | --- |
| Entrada · control de modalidad | Una tarjeta operativa con selector alternativo **Texto clínico / Archivos y tablas**, no ambos paneles simultáneos (\`inputView\`; \`styles.css .intake-switch\`) | La captura V4 muestra entradas competidoras distribuidas en varios cuadros, con menos anchura útil de texto | \`DRIFT_OPEN\`; determinar impacto de D1 y flujo de archivos real antes de cambiar |
| Entrada · primer espacio útil | Intención editorial + tarea inmediata visible en escritorio; el prototipo todavía incluye gran bienvenida | La persona señala que la bienvenida ocupa demasiado espacio para trabajar. **La petición de ocultarla/reducirla una vez cumplida su función es posterior al V1**, no una regla originalmente congelada | \`EVOLUTION_REPORTED\`; decidir diseño de estados *sin trabajo / trabajo activo* en futura revisión humana |
| Entrada · ejemplos | El prototipo enseña la acción \`Usar ejemplo sintético\` sin entrar en otro recorrido; la reconciliación admitía varios ejemplos en ayuda contextual | La persona identifica la ocultación actual de ejemplos como fricción; quiere opciones de ejemplo accesibles durante el arranque | \`EVOLUTION_REPORTED\`; explicitar nueva jerarquía en próximo diseño, sin falsificar aceptación de 12/oct |
| Revisión · superficie dominante | \`review-grid\` de documento amplio + lista compacta de hallazgos + decisión contextual. Ratio de referencia \`1.48fr / .7fr / .78fr\`; barra de progreso horizontal subordinada | En la captura actual el documento queda comprimido y coexiste con varias cajas de vista previa, filtros y métricas; las superficies compiten por atención | \`DRIFT_OPEN\`; comparación real mismo estado/viewport pendiente |
| Revisión · continuidad cognitiva | El documento se lee de forma continua con entidades resaltadas y se relaciona con lista y decisión | La persona percibe demasiados cambios de foco, cajas y una sensación de interfaz «apegotonada» poco invitadora | \`DRIFT_OPEN\`; comprobar tamaño real de texto, lectura, selección y orden de foco, sin presuponer bug clínico |
| Lote, Estructurado, Celdas, Comprobación, Resultado | Existen cinco vistas aprobadas y reconciliación funcional individual | **No contrastadas en esta revisión** | \`NOT_CHECKED\`, no inferir PASS ni FAIL |

**Importante:** se aprobó en \`SOPHILUX_B_V1_FUNCTIONAL_RECONCILIATION.md\` que la versión productiva incorporara herramientas reales ausentes en el prototipo (filtros, marcado manual, confirmaciones, errores, hoja/cabecera, estados). Esto **no autorizaba automáticamente** convertir el documento en tarjeta secundaria ni sustituir la jerarquía de trabajo por métricas.

## 4. Prioridad aceptada el 14/oct: primero función, después composición

1. **#92 Etapa B:** evidencia real de paridad y privacidad con casos sintéticos/no-PHI; identificar qué capacidades ya funcionan y qué defectos o ausencias hay. Ni la Etapa A documental ni un mockup verde prueban paridad funcional.
2. **Reparaciones funcionales demostradas:** solo los huecos concretos; no rediseño simultáneo por defecto.
3. **#93:** gobernanza/documentación/publicación al cumplir sus dependencias y garantías. No introducir datos clínicos reales hasta que las garantías aplicables estén validadas.
4. **Recomposición UX después:** partir del maestro aprobado, mantener identidad/tokens, recuperar superficie operativa y validar cada vista con HTML/CSS y aceptación humana antes de cambiar React/CSS de producción.
5. **Excepción razonada:** si una fricción de composición bloquea o invalida una prueba funcional, registrar el obstáculo y autorizar **un arreglo mínimo acotado**, no un reskin.

El rechazo humano de la composición actual es **evidencia de experiencia** válida, no «prueba» de que toda la aplicación no funciona. No atribuirlo a características personales ni desacreditar la observación.

## 5. Preparación futura, NO autorizada como ticket hoy

### Sistema de diseño que se puede derivar

| Capa | Fuente V1 concreta | Resultado técnico futuro |
| --- | --- | --- |
| Tokens | \`styles.css :root\`: \`--canvas\`, \`--paper\`, \`--rose\`, \`--rose-deep\`, \`--ink\`, \`--line\`, \`--sage\`, \`--red\`, \`--rounded\`, \`--serif\`, \`--sans\` | Mapeo a variables CSS de producción, contraste y estados; no recodificar paleta por pantalla |
| Componentes | \`.btn\`, \`.panel\`, \`.tag\`, \`.form-*\`, \`.pane-header\`, \`.decision-option\`, \`.compact-alert\` | Inventario/variantes existentes, reutilizar lo que ya funciona y suplir solo lo que falta |
| Layouts | \`.intro-grid\`, \`.intake-switch\`, \`.review-grid\`, \`.batch-grid\`, \`.structured-grid\`, \`.cell-grid\`, \`.result-grid\` y media queries | Contratos **por pantalla y estado**, no solo tema de marca |
| Interacción visual | \`app.js\` selector, hallazgos, inspector, cola, columna, estados de salida | Comparar modelo mental; **NO copiar** simuladores o permisos/semánticas inventadas |

La implementación existente podría reutilizar parte de estos recursos. Este documento **no afirma** haber auditado qué componentes están efectivamente compartidos.

### Contrato mínimo del próximo ticket visual

Para cada pantalla material, citar maestro exacto/commit, contrato visual y reconciliación, operación real, delta aprobado, zonas/proporciones y primer viewport, responsive, consumidores, criterios verificables y capturas del mismo estado y viewport. Estados posibles: \`MATCH\`, \`ADAPT_APPROVED\`, \`DRIFT_OPEN\`, \`NOT_CHECKED\`.

Puntos de inspección conocidos: \`app-v4/src/App.tsx\`, \`app-v4/src/review/ReviewWorkspace.tsx\`, \`app-v4/src/visual/sophilux-v1.css\`; el implementador no debe recibir únicamente el token/CSS como autoridad.

**Recheck humano:** vista compuesta con texto clínico sintético de longitud significativa y docenas de hallazgos, no solo el tema de color, test pequeño o captura vacía; comprobar documento → detección → decisión → siguiente y espacio de trabajo antes/después de crear el trabajo.

**Gobernanza de proyecto:** ver \`docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md\`, \`docs/PRODUCT_FIDELITY_GATES_V1.md\` y la práctica transversal propuesta en Atenea \`docs/DESIGN_AUTHORITY_TO_IMPLEMENTATION_FIDELITY_V1.md\`. Esta última no sustituye reglas C-087 ni añade revisores.

## 6. Stop / cierre

Este registro **no cierra** la divergencia, no deshace la aprobación histórica ni modifica comportamiento. Un futuro cierre visual exige cotejo renderizado, clasificación de las diferencias, adaptación humana donde corresponda y evidencia sobre el producto real. Mientras tanto: \`LAB_SOPHILUX_B_V1_FIDELITY_DEBT_OPEN\`.
