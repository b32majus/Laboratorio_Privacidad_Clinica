# REC-12 #92 · R3 — Maqueta de fidelidad Sophilux B V1

**Fecha:** 21/11/2026. **Estado:** MAQUETA_LISTA_PARA_APROBACION / TODAVÍA NO APROBADA.
**Fuente visual:** Sophilux B V1 aprobada el 12/10/2026, con D1–D4/VF-01…08 ratificados; fotografías F8 del producto con densidad realista.
**Rama local:** work/lab-rec12-r3-sophilux-mock-20261121, encadenada después de R1/R2/R2-01/R3 (NO publicada en 3.0-main).

## Cómo abrir

1. **Abrir comparador.html primero.** Muestra maestro aprobado → V4 real F8 → propuesta R3, en escritorio 1440×900 y móvil 375×800. Sus seis imágenes de comparación están en **comparaciones/**.
2. **Abrir maqueta.html** para alternar Revisión / Celdas / Resultado. En Resultado cambiar los escenarios Listo / Pendiente / Bloqueado desde la barra oscura superior. Esa barra es **solo instrumentación del prototipo**, no navegación de V4.
3. La maqueta y el comparador se abren directamente como archivos locales, sin servidor. La carpeta aislada contiene CSS, JavaScript y capturas. Cuando se abre en el VPS se usan las fuentes locales Inter/Cormorant; si se descarga la carpeta a un lugar sin las fuentes del repositorio, el HTML recurre a tipografías de sistema y las capturas mantienen la representación exacta. **No se distribuyen archivos de fuentes.**
4. Las referencias originales Sophilux del comparador tienen estados de ejemplo (5 hallazgos / 3 celdas). V4/F8 y R3 usan ejemplos de más volumen. La comparación es **de jerarquía, no pixel-perfect de contenido**.

## Tres propuestas acotadas

| Vista | Cambio compositivo | Contratos preservados para React |
| --- | --- | --- |
| **Revisión** | Documento dominante + Hallazgos inmediatamente visibles + decisión contextual. Progreso compacto y filtros/marcado en contexto; 24 detecciones ficticias y selección vinculada al inspector. | Decisiones por hallazgo, sin autovalidación, foco, marcado manual, borrador, Keep con confirmación, corrección y feedback. En esta maqueta las acciones son inertes. |
| **Celdas** | Lista de 2 celdas, contenido activo y su inspector; en móvil, inspector primero con fila y columna identificadas; 4 detecciones pendientes, reprocesar contextual. | Solo ruta real process-as-text, estado de motor, autoridad de columnas, validación y regreso a configuración. |
| **Resultado** | Hero editorial más compacto con estado y CTA del material; aviso de original conservado junto al CTA; preview **solo del Safe preparado en Listo**; zona Confidential claramente separada. | Ninguna certificación de anonimato, ningún CTA universal en lote/tablas, ningún preview con originalText ni correspondencias Confidential, ningún resultado no autorizado. |

**Contenido Safe ilustrativo:** placeholders completamente ficticios y contacto-demo@ejemplo.invalid como muestra de un dato **conservado por decisión deliberada**. El aviso recuerda que la salida puede incluir ese dato y exige verificar su destino. Es una maqueta del caso texto; otros materiales conservan su acción principal real (documento, ZIP en lote, XLSX en tablas).

**No funciona como aplicación:** no crea trabajos, acepta decisiones, confirma Keep, procesa el motor, calcula Safe, genera archivos ni contacta servidores. Pulsar controles de cuerpo solo muestra un aviso. Los selectores de pantalla, escenario y hallazgo sí funcionan para examinar la composición.

## Testigos renderizados

Ejecutado el script **capture.cjs** sobre Chromium/Playwright con origen local, sin datos clínicos reales. Capturas en **capturas/**; medidas por estado en **capturas/medidas.json**. Se han comprobado **10/10 escenarios** (Revisión, Celdas, Resultado Listo, Pendiente y Bloqueado, cada uno a 1440 y 375).

- **Sin overflow global:** anchura total de documento igual a 1440 o 375, respectivamente.
- **Acciones a 375×800:** opciones de Revisión empiezan a **y=512**, decisiones de Celdas a **y=501**; CTA principal de Resultado Listo **y=387** y advertencia de Keep **y=605**. Todas aparecen en el primer viewport.
- **Safe en DOM solo cuando se permite ilustrativamente:** un preview en Listo; **cero texto Safe, cero contacto conservado y cero botones de descarga habilitados** en Pendiente/Bloqueado. No se infiere protección universal del producto real a partir del prototipo.
- **24 detecciones de Revisión** en la lista y documento sintético: al seleccionar la número 24, inspector y texto marcado señalan el mismo dato; la lista mantiene su desplazamiento.
- **Cero peticiones externas y cero errores de script** en las escenas. Los nueve archivos de imagen del comparador cargan correctamente. La barra de navegación y el aviso ante botones inertes se comprobaron en ambos anchos.
- **Maestro congelado intacto:** sophilux-base.css es una copia exacta de styles.css aprobado, SHA256 **34494b376bc5ba89c58c6e4d0f32c23bdc22873a62b5b252103d6cae037a3bd3**. maqueta.css solo añade redistribución, reutilizando los tokens originales. No se tocó ningún archivo del maestro.

## Regeneración

Con Node, Playwright y Python Pillow en un checkout del repositorio:

    node docs/evidence/issue92-r3-sophilux-maqueta-20261121/capture.cjs
    python3 docs/evidence/issue92-r3-sophilux-maqueta-20261121/comparar.py

El primer comando verifica escenarios y crea capturas. El segundo combina capturas ya versionadas del maestro, V4/F8 y R3; nunca modifica las fuentes. Para **abrir los HTML o PNG ya generados** no hace falta instalar nada.

## Pendiente de decisión de Sil

El GO recibido autorizó **crear esta maqueta**, no aprobar todavía su implantación. Para pasar a React hay que aprobar explícitamente la distribución de cada vista, el criterio móvil inspector primero y los límites de Safe/Confidential. Después se podrá implementar por KairOS DIA, con tests de recorrido, captura fiel de cada estado y auditoría única independiente.

**Estado:** READY_FOR_HUMAN_VISUAL_DECISION. #92/#93 siguen abiertos. Sin cambios en app-v4, motor, políticas, exportadores, permisos, ni datos de pacientes. Sin push, PR, merge o despliegue. La deuda H-01/PDR-08 y GAP-01 rendimiento continúa en el documento R3 previo.
