# Sophilux B V1 × Laboratorio V4 — reconciliación visual-funcional

> **STATUS: PROPUESTA DE RECONCILIACIÓN PARA APROBACIÓN HUMANA (2026-10-12).**
> Comparación **READ-ONLY** sobre `origin/3.0-main@34cd303486ef7aa697c738a66a3b52ce56d98940`, posterior a #85 y al PR #117. El HTML/CSS/JS visual ya aprobado **no se modifica**. Este documento **no** es una nueva auditoría general, una revisión de seguridad, una verificación de cumplimiento 88+42+12, un Train, ni autorización para #90/#91.
>
> **Objeto exacto:** las **7 vistas aprobadas** de Sophilux B V1, no «32 pantallas»: «32» es la densidad del caso sintético de **columnas Structured**. Se inspeccionaron el prototipo `docs/design/sophilux-b-v1/{app.js,index.html,styles.css,ACCEPTED_VISUAL_CONTRACT.md}`, `HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`, reconciliación final del 5/oct y consumidores reales de V4 citados abajo. No se infieren capacidades de controles simulados ni se inspecciona código fuera de los consumidores afectados.
>
> **Regla de autoridad:** la estética y la composición aprobadas son vinculantes; los comportamientos simulados NO lo son. La privacidad, políticas, datos, accesibilidad, decisiones humanas y permisos de salida los determinan V4 y sus contratos canónicos, nunca la demo. En una contradicción: **conservar el comportamiento seguro y adaptar su representación visual**, sin alterar el HTML original. Cualquier cambio material de composición vuelve a decisión humana antes de ejecutar.

## 1. Resultado ejecutivo

- **7/7 vistas:** la identidad editorial, distribución y jerarquía son aprovechables. No hace falta rediseñar desde cero ni nueva exploración estética.
- **4 discrepancias visual-funcionales importantes que requieren reconocer una adaptación** (§3): entrada real/contexto de sesión; recuperación de error en Lote; controles reales de Review; Resultado según material y estado. No representan bugs demostrados del dominio.
- **2 discrepancias de representación fuertemente regladas** (§3): estados previos de Structured (hoja/cabecera/fecha/Study ID) y carácter **opcional, no ceremonial**, de la comprobación de privacidad.
- **1 discrepancia puramente responsive comprobada**: el prototipo original tiene ancho de documento **413 px en viewport de 375 px** por header; se registra y cierra en #91 sin modificar el aprobado.
- **1 prohibición transversal:** ni las pestañas de siete vistas, ni cifras inventadas, ni botones de «listo/bloqueado», ni acciones, formatos o rutas simuladas son autoridades. Los estados reales solo surgen de Job, ReviewSession, configuración y readiness.
- **Ningún cambio de dominio requerido** por este contraste. Las adaptaciones propuestas pueden resolverse en #90 (copy) y #91 (presentación y consumidores directos) preservando la autoridad; #92 prueba el producto integrado.

### Terminología de clasificación

`COINCIDE` = capacidad real encaja en la composición. `ADAPTAR` = respetar identidad visual y cambiar disposición/contexto de un consumidor real. `FALTA REPRESENTAR` = estado/acción real que no aparece en la V1 demostrativa. `SOLO DEMO` = nunca trasplantar ni usar para readiness.

## 2. Matriz de reconciliación de las siete vistas

| Vista y ancla del prototipo | Lo que sí existe en V4 y queda protegido | Diferencia concreta en V1 | Disposición vinculable | Ticket |
|---|---|---|---|---|
| **V1 Entrada** — `app.js:49–70`; selector texto/archivos, hero, «Crear trabajo» y detalles de política | `App.tsx:177–185,264–273,930–1018,1760+`: borrador vacío, exclusión texto↔archivos; ejemplos sintéticos, portapapeles con error Ctrl+V, drop/select, creación/errores, sesión en memoria, `Nuevo trabajo` y `Borrar sesión` distintos, política visible condicionada al job | El ejemplo aparece **precargado**; «Archivos» simula un fichero y deriva directamente a Lote; se omite portapapeles, varios ejemplos y borrado deliberado. No todos los archivos forman lote: documento singular o Structured necesitan routing real | **ADAPTAR:** conservar hero y tarjeta en dos columnas; inicio real **vacío**; ejemplo, portapapeles y drag/select en disclosure/acciones secundarias contextualizadas; CTA solo crea con entrada válida, sin ruta fija. Política actual descubierta siempre; Nuevo ≠ Borrar | #90 copy; #91 composición |
| **V2 Revisión** — `app.js:72–85`; documento/hallazgos/inspector y acciones aceptar/modificar/conservar | `ReviewWorkspace.tsx`: resaltados, selección sincronizada desde documento/lista, filtros, siguiente/previo pendiente, marcado manual sin offsets visibles, edición sin perder borrador, confirmación contextual para conservar original según tipo, estado de decisiones; `App.tsx:547–628,1356–1445` controla Result/Gate y procedencia | Demo solo muestra 5 detecciones, una propuesta de sustitución **readonly**, ninguna selección manual, filtros, navegación densa o confirmación Keep; botón «Comprobar privacidad» incondicional; convierte cualquier click en decisión sin validación | **FALTA REPRESENTAR:** alojar filtros/contexto, marcado manual, reemplazo editable, restaurar/deshacer, confirmación deliberada y borrador sin guardar dentro de la misma composición tres áreas; preservar CTA solo cuando navegación real esté autorizada. No autodecisión | #90/#91; #92 estados |
| **V3 Lote** — `app.js:86–94`; cola / documento / acciones | `BatchReviewView.tsx` y callbacks `App.tsx:1057–1078`: estados por ítem, filtros Todos/Necesitan atención/En curso/Listos/Retirados, recuperación de error con reintento **solo si existe contexto y es reintentable**, retirada con confirmación, reconocimiento de error distinto de resolución, persistencia de incidencia retirada para trazabilidad, lectura/procesado, sesiones exitosas independientes | Demo **selecciona** un fichero de error y dibuja un «documento seleccionado» con «Reintentar» genérico; el producto **no permite revisar** un ítem sin sesión y el reintento no siempre existe. Faltan retirados/reconocidos/en curso y estados de cola vacía | **ADAPTAR MATERIALMENTE:** mantener cola + panel contextual. Para error sin sesión, el contexto muestra causa/acciones permitidas **en la propia fila** o panel de incidencia, pero nunca simula Review. «Reintentar» solo si autoridad disponible; «Retirar» confirma; «Reconocer» no hace «Listo». Selección visual de contexto ≠ sesión activa | #91; copy #90 |
| **V4 Estructurado** — `app.js:95–104`; 32 filas / 4 campos / inspector y Study ID | `StructuredConfigureWorkspace.tsx`, `App.tsx:665–738,1034–1056,1150–1161`: desde #85 tabla comparativa con `columnIndex`, clases/acciones efectivas bloqueadas/permitidas, datos y bloqueos reales, identificador paciente único, rol de fecha, prefijo/visita Study-ID, hoja y cabecera explícitas en XLSX multihoja, readiness fail-closed | Demo presenta tabla **siempre** (aunque puede faltar selección de hoja/cabecera); el desplegable ofrece acciones no permitidas por clase y al cambiar «Desconocida» a cualquier otra clase asigna «Conservar» automáticamente (**peligroso si se copia**). Prefijo Study ID es readonly, no presenta rol fecha ni errores de autoridad | **FALTA REPRESENTAR** preconfiguración hoja/cabecera; inspector debe usar `allowedActions` / `actionLocked`, explícita autoridad paciente, rol de fecha y errores de prefijo; fila y bloqueos derivan de V4, jamás estado «Definido» calculado por la demo. Mantener el grid aprobado de cuatro campos y el inspector como composición dominante | #91; texto #90 |
| **V5 Texto libre en celdas** — `app.js:105–112`; lista/foco de celda/decisión | `StructuredFreeTextReview.tsx` + `ReviewWorkspace.tsx`: subtask **solo con columnas `process-as-text`**, ejecución real de análisis de celdas explícita, selección de celda, detección, mantener decisiones y vuelta a Configure, errores de ejecución/Review; sin Review ceremonial cuando no hay celdas | Demo siempre muestra tres celdas precargadas, no proceso pendiente/fallido; «Sustituir», «Modificar» y «Conservar» aparecen como simples botones sin consentimiento/validación. Paso simulado disponible en barra para cualquier tipo | **ADAPTAR:** renderizar solo con tarea real y con estados pendientes/ejecución/fallo/decisiones. Reutilizar inspector de Revisión, recibos y autoridad real; próxima acción regresa a Configuración o a lo autorizado, nunca avanza a output por simulación | #91/#90 |
| **V6 Comprobación de privacidad** — `app.js:113–119`; panel estado y botón seguir | `PrivacyGate.tsx` con `derivePrivacyGateView`: hechos de política, pendientes, errores, advertencias de originales conservados, por lote y Structured; `App.tsx:1119–1127,1430+`: acceso contextual, no fase obligatoria en el recorrido ordinario | «Ejemplo listo/bloqueado» permite alternar hechos falsos; política «Estándar» fija; todos los materiales reciben el mismo checklist. Diseño V1 presenta gate como **paso con ceremonial editorial**, pero autoridad del 5/oct A-03 dice que la *regla* de privacidad no exige fase ni vocabulario obligatorio | **ADAPTAR SIN BORRAR LA VISTA:** usar la composición como **comprobación contextual opcional** cuando se visita, no «paso 6» ni requisito universal. Derivar política, motivos, avisos y navegación del job actual. CTA no disponible ⇒ no prometer que continúa; no permitir Gate sin Structured configurado | #90 idioma; #91 presentación |
| **V7 Resultado** — `app.js:120–126`; ready / needs-attention, copy CTA, texto, advertencia, Confidential | `ExportStep.tsx`: por texto/documento cuatro representaciones **de un solo Safe payload**, DOCX/PDF/TXT/copia según material; Batch ZIP de Safe PDF individuales primaria + PDF consolidado y CSV resumen secundarios; Structured CSV/XLSX Safe y Confidential TXT/XLSX, primacía práctica XLSX; warnings de original conservado, blocked/needs-attention/ready, confirmación explícita Confidential separada y guards async | Demo presenta **siempre «Copiar texto preparado»** y preview texto, solo dos estados, confidencial condicionado al ejemplo listo; contradice A-08 (no Copy universal). El texto «Ahora sí. Con confianza.» junto con 1 original conservado puede sugerir aval de privacidad más fuerte de lo demostrado | **ADAPTAR MATERIALMENTE:** misma estética de hero + estado + preview/contexto + panel secundario + zona Confidential, pero **contenido y primaria por material**; aviso «original conservado» perceptible en el mismo primer viewport que estado/CTA, lenguaje no certificador. Estados blocked/needs-attention/ready distintos y per-item en Lote; Confirm/Cancel en Confidential, no acción directa | #91; copy #90; #92 paridad |

### Distinciones funcionales transversales que prevalecen sobre la demo

- El modelo de navegación del producto es **añadir → preparar/revisar lo necesario → Resultado**; no un stepper de 7 fases. La barra negra `prototype-nav` es instrumento de revisión y está **prohibida** en V4.
- `session.navigate` / `isStepAccessible` / ReviewSession / `structuredPreparation` / `derivePrivacyGateView` / `deriveSingleResultView` y derivaciones Batch/Structured son autoridad; la demo no. Nada puede producir una «salida lista» por click de prueba.
- Result puede ofrecerse como **vista de necesidades/bloqueo sin autorizar descargas** donde la navegación legítima lo permite. Para trabajo de texto/documento, la procedencia de visita depende de Job/política/ReviewSession actual; cambio real de política no resucita una CTA vieja. Para Structured, configuración inválida bloquea vuelta a output. Para Batch, el Result y la disponibilidad de cada artefacto no son la misma autoridad.
- **Confidential no es un formato Safe** ni descarga de un solo click. Primera petición revela advertencia; Confirm explícito produce a lo sumo una descarga y Cancel ninguna, condicionado a autoridad actual y sin reusar consentimiento entre trabajos/estados.
- La fuente V1 usa etiquetas de acciones simuladas pero no enlaza con el modelo real: «Conservar» no sustituye el review humano ni vale para Unknown; «Reintentar» no sana archivos no reintentables; cambiar política nunca conserva indebidamente una revisión inválida.
- Local-first/no persistencia real, ciclo de vida de borrar trabajo y CTA destructivas accesibles y separadas; no introducir métricas de anonimización, cumplimiento, score ni afirmaciones de seguridad que el producto no puede certificar.

## 3. Reconciliación prescriptiva por diferencia material

| ID / gravedad | Superficie y ajuste visual mínimo | Estado visible y continuidad que #91 debe preservar | Evidencia mínima que prueba cierre |
|---|---|---|---|
| **VF-01 · importante** | **Entrada + shell:** mantener el hero/tarjeta, pero mostrar borrador vacío, acciones de ejemplos/portapapeles/arrastre, tipos según fichero real; lugar discreto para política y «Borrar sesión» separado | Caso nuevo → texto o archivos → crear; feedback de archivo incompat., mixto, portapapeles denegado; cambio de política invalida según autoridad, sin segundo landing | 1280/1440 + 375 con estado inicial y un error; E2E Input existentes |
| **VF-02 · importante** | **Review:** conservar documento prominente + lista + inspector; añadir acción manual (sin offsets), filtros y navegación, editor de reemplazo, keep-original explícito y aviso no guardado sin ocupar banda permanente | Detección → editar/confirmar → avance o corrección → Result; con 24+ hallazgos, foco/selección y estado siguen perceptibles, sin autocompletar | Captura primera pantalla poblada 24+, focused Review tests y E2E de Result/keep/manual existentes |
| **VF-03 · importante** | **Lote:** unificar vista de selección y recuperación: fila error con nombre/causa y acciones válidas; si no hay sesión, panel derecho es detalle de incidencia, no revisión ficticia; sin «Reintentar» falso | Procesado/pendiente/listo/error/reintento/retirado/reconocido; error individual no destruye otro éxito; filtros incluyen retirados y progreso | Testigo de 12 documentos con errores mixtos; reutilizar Batch specs existentes |
| **VF-04 · importante** | **Structured:** conservar tabla dominante e inspector, añadir variantes de selección hoja/cabecera previas y selección/rol fecha, bloqueos reales y opciones Study-ID reales, ocultar acciones no permitidas | XLSX multihoja → elegir hoja → decidir cabecera → 32 columnas → override permitido → estado/bloqueos/Study-ID → tarea de texto libre solo si real → Resultado autorizado | E2E REC-04+#85 y testigo 32 columnas 1280/375; nunca prueba demo fake ready |
| **VF-05 · importante** | **Celdas:** misma familia visual de revisión pero con subtask real, estados de engine y regreso a columnas | Configured process-as-text → ejecutar → seleccionar celda → decidir/editar → siguiente; salida bloqueada si algo pendiente; sin texto libre omitir vista | Reusar Structured FreeText/Composed E2E (estado con y sin celdas) |
| **VF-06 · importante** | **Comprobación:** representación de hechos de privacidad si se visita, no puerta universal ni toggle «ready/bloqueado»; evitar introducir un nuevo stepper por copiar la demo | Acceso cuando corresponde → warnings/reasons reales → corregir donde hay tarea o continuar si autorizado; regresos a la pantalla significativa (Configure si Structured sin celdas) | Reusar PrivacyGate y tests de navegación #84/#85; solo screenshot si cambia materialmente la composición |
| **VF-07 · CRÍTICA PARA JERARQUÍA** | **Resultado:** una plantilla visual con variantes texto/documento/batch/structured y tres estados diferenciados; avisos co-visibles + Confidential apartado | Texto: copiar; documento: representación documental apropiada; lote: ZIP primaria y PDF/CSV secundarios; tablas: XLSX principal y CSV alterno. Cambios de política, pendientes y kept-original no generan falsa salida; Confirm/Cancel real | Capturas result ready + needs-attention + kept-original en 1280/375 y E2E por material ya existentes, agregando solo un test consumidor ausente |
| **VF-08 · RESPONSIVE CONOCIDA** | **Header a 375 px:** reflujo de logo / «Nuevo trabajo» / ayuda, sin duplicar barra negra de demo | Ancho documento <= viewport, foco y acción principal disponibles; tabla Structured puede desplazarse *dentro* de región etiquetada | Un testigo 375 px real para Entrada y Structured, con scrollWidth comprobado |

**No equivale a pedir ocho Trains.** Son ocho condiciones de aceptación **dentro de los dos tickets existentes** #90 y #91. VF-07 no autoriza ampliar exportación ni revisar serializers; solo composición y presentación.

## 4. Estados materiales — cobertura visual compacta (NO 32 mockups)

Los siguientes son **estados de producto** cuya representación debe componerse usando **las siete plantillas aprobadas**, sin pedir nuevas pantallas separadas. Se comprueban solo los casos que cambian próxima acción, advertencia o disponibilidad:

| Familia | Estados que materialmente alteran pantalla/acción | Prioridad de representación |
|---|---|---|
| Entrada | Sin trabajo ni borrador; texto sintético; archivo singular; varios archivos; CSV/XLSX; mix inválido; denegación portapapeles | Alta |
| Review texto/doc | Sin ReviewSession tras política; detecciones pendientes/resueltas; cambio de decisión; borrador sin guardar; marcado manual; original conservado con advertencia | Alta |
| Lote | Lectura/en cola; requiere revisión; completado; fallido recuperable; fallo sin reintento; reconocido; retirado; sin documentos viables | Alta |
| Structured | Hoja por seleccionar; cabecera ambigua; tabla 32 cols; Unknown; quasi sin tratamiento; rol fecha; Patient ID ausente/seleccionado; Study-ID inválido; texto libre necesario / no-op omitido | Alta |
| Texto libre | Sin ejecutar; ejecutando; error; detecciones pendientes; revisión completa; columnas cambiadas que dejan sin celda elegible | Alta |
| Privacy check | Pendientes reales; error/fallo de lote; originales conservados; output bloqueado; completo; no todos los ítems evaluables | Alta |
| Resultado | Single ready/needs-attention/blocked; doc/bytes; batch artefactos disponibles/no disponibles independientemente; Structured CSV/XLSX; aviso de originales conservados; Confidential cancel/confirm; cambio política invalida | **Máxima** |
| Shell transversal | Nuevo trabajo frente a borrar sesión, trabajo actual, política actual disponible por tipo, 375 px responsive, ayuda bajo demanda | Alta |

**No se generan automáticamente 32 variantes ni 40 nuevas suites.** Para cada una bastan las pruebas/capturas *existentes* que ya demuestren el consumidor, y solo los testigos de composición que cambian materialmente. #92 conserva la matriz de completitud exhaustiva, no esta etapa.

## 5. Contrato de interacción transferible a implementación

Para CADA elemento visual con capacidad real registrar: **hecho de entrada** → **acción ofrecida (incluida condición de disponibilidad)** → **estado/feedback inmediato** → **siguiente acción legítima**. Cuatro ejemplos críticos:

1. `Modificar clase de Structured`: columna/plan actuales → elegir solo clase/acción permitida → tabla e inspector muestran hechos efectivos, bloqueos recalculados y columna aún seleccionada → siguiente pendiente o revisión real. **NUNCA** cambiar Unknown a Keep por un setter de maqueta.
2. `Error de lote`: entrada fallida sin ReviewSession → fila de error seleccionable para *detalle contextual*, nunca para decisión inexistente → reintento solo si permitido / retirada confirmada / reconocimiento sin resolver → cola con ítems exitosos intactos.
3. `Resultado con original conservado`: ReviewSession actual legitima navegación → aviso de dato deliberadamente conservado junto al estado y acción → Safe solo si autorizado, y no hay certificación de anonimato → regresar a corregir o elegir salida permitida.
4. `Comprobación opcional`: persona solicita hechos de política (o enlace contextual) → estado real de pendientes, errores y disponibilidad → corregir / continuar solo según autoridad; nunca usar como séptima parada obligatoria.

## 6. Reparto real de responsabilidades

**#90 — texto y semántica de lectura (sin refactor funcional)**

- Glosario de interfaz coherente: `Nuevo trabajo` / `Borrar sesión`; `Revisión`, `Hallazgos`, `Pendiente`, `Conservar original` (con implicación explícita), `Columna`, `Tratamiento efectivo`, `Comprobación de privacidad` cuando sea etiqueta visible, `Resultado`, `Preparado` / `Necesita atención` / `Bloqueado`; `Auditoría confidencial` separada.
- Traducción de los consumidores reales: headers, ayudas, filtros, tooltips, errores accionables, `aria-label`, estados, nombres/etiquetas de descargas; conservar nombres técnicos internos `PrivacyGate`, `Unknown`, `Study-ID` donde son **identificadores/proveniencia**, no vocabulario de paciente. El nombre interno `privacy-gate` no obliga a una etiqueta inglesa como norma visible de producto. Si un contrato técnico exige literalmente la etiqueta «Privacy Gate», diferenciar oráculo de texto legible y pedir decisión si hay choque no reparable mediante tests acotados.
- Mantener «trabajo local» como afirmación comprobada, sin extrapolar «anónimo», «seguro al 100 %», aprobación ética o conformidad regulatoria.
- No introducir estados «Listo» ficticios ni desactivar UI legítima para simplificar la traducción.

**#91 — composición aprobada con consumidores reales**

- Implementar la arquitectura visual **siete composiciones** en pantallas operativas existentes. Reutilizar el código React/TSX real; no incrustar el JS de demostración ni reescribir modelos.
- Aplicar todas las adaptaciones VF-01…08 con **el menor cambio material**; preservar la posición dominante de datos y acciones actuales, incluso con más controles que la maqueta.
- Capturar el **primer punto utilizable** de cada composición cambiada, no esperar al final de un Train entero: Entrada nueva, Review 24+, Batch 12, Structured 32, FreeText con 3 células, Checkpoint real, Resultado ready/needs-attention; mobile 375 para afectadas. Una captura NO implica nuevas pruebas automatizadas si los consumidores existentes la avalan.
- Respetar contraste, foco, navegación con teclado, trabajo largo, no color-only, safe/confidential, y **no overflow global**. Las capturas V1 son **referencia de identidad**, no equivalencia pixel a pixel ni fuente de datos ficticios.

**#92 — test de integridad del producto**

- Verificar como estaba planificado la correspondencia de fuentes de decisiones y requisitos y recorridos E2E compuestos, incluidas las familias de estado; NO considerar la maqueta con datos sintéticos prueba de salida segura.

## 7. Decisión humana necesaria para congelar ESTE contrato (no para reabrir la estética)

La aprobación de V1 ya cubre tipografías, composición general, color, jerarquía y espíritu Sophilux. **Lo único pendiente es ratificar que las adaptaciones funcionales obligatorias mantengan esa misma composición**:

- **D1 — Revisión:** filtros, marcado manual, borrador editable y conservar-original se alojan como controles **contextuales** de los tres paneles, sin construir cuarta pantalla ni ocupar el documento.
- **D2 — Lote:** un error conserva su fila/estado; el panel de la derecha pasa a **detalle de incidencia** cuando no hay sesión activa, con acciones permitidas y sus confirmaciones.
- **D3 — Resultado:** la hero/tarjeta/advertencia/Confidential de V1 son el **sistema visual común**; la acción principal y la zona central se adaptan al material y al estado verdadero. Se conserva advertencia visible con originales mantenidos, no se certifica anonimato.
- **D4 — Comprobación/Structured:** la vista de privacidad es contextual y opcional; hoja/cabecera pre-tabla se muestra solo cuando faltan decisiones; las siete vistas **no** implican siete pasos obligatorios.

**Propuesta de aprobación humana en una frase:** «Apruebo la reconciliación VF-01…VF-08 y D1…D4; se mantiene Sophilux B V1 como identidad, y los elementos funcionales se incorporan según el modelo real, sin copiar simulaciones».

Hasta esa ratificación: **READY_FOR_HUMAN_RECONCILIATION_APPROVAL**, no una nueva autoridad canónica. No hay prueba de bloqueo técnico del dominio ni necesidad de volver a auditar. Tras aprobación, versionar **este documento** como contrato complementario con link desde `HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`, en un PR solo documental; después preparar #90 desde la rama canónica. No seleccionar ni lanzar #90/#91 por adelantado.

## 8. Rutas de fuente y prueba para implementador/revisor

| Tipo | Rutas existentes más relevantes |
|---|---|
| Diseño visual aprobado | `docs/design/sophilux-b-v1/{index.html,styles.css,app.js,laboratorio-sophilux-b-v1.html,ACCEPTED_VISUAL_CONTRACT.md,previews/,visual-evidence-manifest.json}` |
| Producto aceptado | `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` §6–§10, `docs/audits/2026-10-product-design-reconciliation-final.md` A-01…A-10 |
| Shell/entrada/continuidad | `app-v4/src/App.tsx` (InputStep, TaskActionBar, policy control, structured navigation); `app-v4/src/useJobSession.ts` |
| Texto/manual | `app-v4/src/review/ReviewWorkspace.tsx` y `review-domain` |
| Lote | `app-v4/src/review/BatchReviewView.tsx`, Batch result en `export/ExportStep.tsx` |
| Structured/hoja/fecha/Study ID | `app-v4/src/structured/StructuredConfigureWorkspace.tsx`; opciones y estado en bridge |
| Texto libre | `app-v4/src/structured/StructuredFreeTextReview.tsx` |
| Comprobación | `app-v4/src/privacy-gate/PrivacyGate.tsx` / `privacyGateModel.ts` |
| Salidas | `app-v4/src/export/ExportStep.tsx` / Single, Batch, Structured, Confirm |
| Evidencia ya disponible (sin recenso) | `e2e/structured-rec04-composed.spec.ts`, `e2e/structured-composed.spec.ts`, `e2e/structured.spec.ts`, `e2e/ux-closeout-shell.spec.ts`, `e2e/review-export.spec.ts`, `e2e/rec05-result.spec.ts` y suites Batch existentes |

**No se autoriza:** modificar `domain/job.ts`, `useJobSession.ts`, clasificador, mappings de políticas, ReviewSession, manejo de PHI, exportadores/serializadores, generación de bytes, consentimiento Confidential, builds/tooling ni protocolo Atenea por razón de «coincidencia visual». Si un cambio de producto REAL necesita alterarlos, documentar contradicción exacta y HUMAN STOP.
