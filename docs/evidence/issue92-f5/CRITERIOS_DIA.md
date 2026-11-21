# REC-12 F5 · Criterios DIA (21/11/2026)

**Estado:** propuesta para validación humana; NO autorizada aún para implementar. Base 3.0-main@739e296; issue #92. QA-002: DIA / OpenCode directo, M/sensible. PERF-002: comprobación de solo lectura primero. No tocar motor, políticas, permisos, exportadores ni datos reales.

## Ocho criterios visibles y verificables

1. **Texto individual.** Un texto sintético largo produce decenas de detecciones. Solo después de revisar todas, Copiar/TXT/DOCX/PDF representan el mismo contenido Safe. Si hay pendientes, la descarga permanece bloqueada.
2. **Original conservado.** Conservar un identificador directo requiere confirmación contextual; Cancelar no altera la decisión. El aviso y el contenido de la salida reflejan la decisión real.
3. **PDF erróneo.** Un PDF escaneado/corrupto informa del fallo en español y no crea un trabajo válido; en lote no se pierde el resto de documentos.
4. **Lote de doce con dos fallos.** Bloqueado antes de recuperar. Al reconocer/retirar errores y revisar diez válidos, el manifiesto CSV, ZIP y PDF consolidado incluyen los mismos documentos preparados, nunca cuerpos retirados.
5. **Confidential deliberado.** Individual, lote y estructurado: primer clic muestra aviso y descarga cero; Cancelar descarga cero; Confirmar descarga una vez, solo con autoridad vigente. Cambio de trabajo/política/sesión invalida confirmaciones antiguas.
6. **Estructurado vinculado.** La autoridad de paciente/visita, UNKNOWN y celdas de texto libre se mantiene de Configuración a salida Safe CSV/XLSX. Una nueva configuración invalida las salidas obsoletas y no mezcla decisiones.
7. **Testigo compuesto, no duplicado.** Añadir únicamente una transición crítica aún sin prueba en la MISMA sesión tras cotejar los 81 E2E actuales con el contrato fuente. Sin datos de pacientes, filtraciones a URL, almacenamiento o red externa. La fuente ejemplifica trece contratos, pero no da un inventario enumerado exacto: no inventar paridad 13/13.
8. **PERF-002 real.** Medir qué módulos pesados se solicitan al abrir un texto sencillo y cuáles aparecen solo al necesitar PDF/DOCX/XLSX/exportar. No descargar parsers ajenos al formato, ni desde dominios externos. Registrar y evaluar el generador PDF/ZIP presente en el bundle inicial antes de intentar separarlo: la especificación dice «cuando sea práctico».

## Secuencia y STOP

Primero prueba reproducible de red y bundles de PERF-002 sin cambiar React. Después escribir un test RED para la transición QA-002 efectivamente ausente. Solo tras aprobación de estos ocho criterios iniciar implementación DIA en Herdr, auditoría única con segundo revisor ciego. Sin GO para push/PR/merge/deploy. #92 permanece abierto; #93 y F3 UX se posponen.
