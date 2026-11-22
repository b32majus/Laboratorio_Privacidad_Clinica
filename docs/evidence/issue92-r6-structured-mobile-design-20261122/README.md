# REC-12 #92 · R6 — propuesta visual móvil de Estructurado (32 columnas)

**Fecha:** 22/11/2026. **Fase:** KairOS DIA **Diseñar**, trabajo **M/sensible** por proximidad a decisiones de privacidad/identificación, **SIN implementación de producto ni autorización humana de esta nueva composición**. Base local `acf77d7` de R5, rama `work/lab-rec12-r6-structured-mobile-design-20261122`.

## Qué abrir

1. **`comparador.html`** — tres columnas: maestro Sophilux B V1 aprobado **solo como referencia de estilo en otro estado** → captura real de V4 R3 con **32 columnas/19 pendientes** → captura de la propuesta R6 en ese mismo escenario. Alterna primer viewport (375×800) y páginas completas.
2. **`maqueta.html`** — propuesta HTML/CSS offline con navegación **solo de selección visual** entre 32 columnas. No cambia clase, rol, acción, paciente ID, preparación, descargas, motor o permisos.
3. **`capturas/`** — 375×800, 320×760 y 1440×900 (este último muestra exclusivamente una demostración móvil centrada, **no una nueva propuesta desktop**), versiones full a 375 y 320; `metrics-*.json` con medidas reproducibles. `comparaciones/` contiene montajes de primer viewport y completo.
4. **`capture.cjs`** y **`comparar.py`** — reproducibilidad de capturas y comparaciones, solo sintéticos, sin servidor ni contacto externo. No incluir/distribuir fuentes tipográficas: el CSS usa la pila/fallback Sophilux.

En el VPS, el directorio íntegro está bajo `/srv/kairos-lab/qualification/laboratorio-rec12-r6-structured-mobile-design-20261122/docs/evidence/issue92-r6-structured-mobile-design-20261122/`.

## Diagnóstico y objetivo medible

**La captura REAL anterior** (`../issue92-r3-react-20261122/actual/metrics-375.json`) sitúa tabla Estructurado en **y≈1.110,875**, inspector de columna en **y≈2.846,875** con 375 px de ancho, sin overflow. La fuente del dominio sí contiene comparación de cuatro campos, 32 filas, selección, inspector de clase/rol/acción, autoridad de ID de paciente única y comprobación bloqueada. El problema de R5 era de **prioridad/alcance de la decisión** en móvil, NO fallo de motor.

**La propuesta R6**, siempre con **32 columnas/19 pendientes** y **Fecha_Visita seleccionada**, sitúa el panel de decisión en **y≈448,1 px** y el selector de clasificación en **y≈627,1 px** a 375. A 320, selector en **y≈683,2** y cuerpo scrollWidth igual a viewport, sin overflow. Se gana acceso temprano a la decisión de la columna activa; la tabla completa sigue disponible con cuatro campos y scroll horizontal local. La tabla ahora empieza cerca de y≈1.183 px: **no se ha pretendido adelantar la tabla, sino el inspector y la decisión**.

## Nueve criterios propuestos para validación humana antes de cualquier React

1. En móvil poblado, **la decisión activa, su clasificación, tratamiento efectivo, rol y primer selector** deben estar dentro del primer viewport de 800 px, sin exigir recorrer las 32 filas antes de decidir.
2. Estado global factual: **32 columnas / 19 pendientes / salida bloqueada** y motivo del bloqueo co-visibles. Nunca mostrar «Listo» o salida descargable mientras haya pendientes.
3. Existe **una sola autoridad de identificación del paciente** y un único selector real (visible y alcanzable); el resumen superior solo indica si está seleccionada, no crea otro estado.
4. La comparación de **cuatro campos por columna** y la lista completa de 32 se conservan; scroll horizontal **dentro de región etiquetada**, sin overflow horizontal del documento.
5. Seleccionar columna desde tabla o siguiente pendiente debe **sincronizar el único inspector** y conservar el foco/correcciones; cambiar solo la selección nunca clasifica automáticamente ni reduce pendientes.
6. El control de **clase** puede mostrar las clases del dominio; los controles de **acción y fecha** deben derivarse de `allowedActions` / `actionLocked` / rol explícito en código real, sin copiar opciones falsas ni convertir `unknown` en `keep`. En la maqueta la acción está **deshabilitada** para evitar fingir opciones autorizadas.
7. Revisión de estados `unknown`, fecha con rol explícito, autoridad de paciente no seleccionada, bloqueos y casos resueltos: la salida solo cambia por callbacks existentes y el usuario encuentra siempre un siguiente paso legítimo.
8. La composición **desktop ya aceptada** y las demás seis vistas no deben alterarse. La propuesta R6 es **solo móvil** y **solo Estructurado**; preservar identidad Sophilux B V1, paleta/tokens y componentes existentes.
9. Antes de cierre funcional: E2E real a 375/320 y 1440, navegación teclado/lectores de pantalla, estado/foco, 32 columnas, rol fecha, paciente ID, bloqueo y regresión estructurada CSV/XLSX; sin datos reales, ni red/storage inesperados.

Los criterios son **una propuesta**; requieren validación explícita de Sil para la fase DIA M/sensible de implementar. No se asume GO por haber dicho «continúa» al diseño.

## Qué es demostración, no autoridad de producto

- `maqueta.js` tiene 32 nombres de columnas, 19 marcas pendientes y datos de clasificación **ilustrativos** (no una reproducción byte a byte del estado clínico). La **imagen real R3**, no JS de maqueta, es el testigo previo de esos conteos.
- Los selects de clasificación y rol se restauran al valor anterior al intentar cambiarlos; la acción se muestra como valor vigente en un select **deshabilitado**. No hay procesamiento, persistencia, exportación, cambios de estado, redes, fuentes descargadas, ni datos de pacientes.
- Los botones para navegar entre pendientes y filtrar por pendientes son **propuestas de navegación visual**, no funcionalidades del producto aceptadas. Podrían implementarse reutilizando **el estado canónico** y selectors existentes, nunca una segunda sesión ni duplicados de decisiones.
- Las tres explicaciones de bloqueo del original se compactan en un mensaje explícito que conserva que hay 17 columnas sin resolver + las dos fechas sin transformación aceptada. Debe verificarse al implementar que **todas las razones reales del dominio siguen renderizadas y accesibles**, sin sustituirlas por un contador inventado.
- La referencia Sophilux del comparador es **otro estado del prototipo**: en ella aparece otra autoridad y otro número de pendientes. No es comparativa pixel-perfect ni contrato para copiar acciones del prototipo.
- La autoridad visual aprobada `docs/design/sophilux-b-v1/ACCEPTED_VISUAL_CONTRACT.md` y la funcional `SOPHILUX_B_V1_FUNCTIONAL_RECONCILIATION.md`, VF-04 y VF-08, **siguen superiores**.

## Validación ejecutada

`NODE_PATH=<worktree con Playwright>/node_modules node capture.cjs` — **3/3 escenarios 375/320/1440 PASS**: 32 filas visibles, selección contextual sincronizada, filtro 19/32 reversible, ninguna clasificación guardada, ausencia de preview/exportación, `scrollWidth==viewport` en los 3 casos, sin solicitudes externas ni errores JS.

`comparador.html` verificado con Chromium a **375 y 1440: 2/2 PASS** — imagen inicial y vista full cargan, botones alternan correctamente, sin red externa.

No se han ejecutado tests de React/V4 porque **no se ha modificado código de producto**. La auditoría DIA M de código y el segundo revisor pertenecerán a la implementación, **solo si Sil valida el diseño**.

**Publicación:** SIN push, PR, merge, despliegue, cierre #92/#93 o cambio de rama remota. R4 NO-GO sigue aplicando hasta cerrar los seis criterios de recuperación.
