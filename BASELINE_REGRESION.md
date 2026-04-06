# Baseline Funcional y Checklist de Regresión

## Contrato congelado del procesador
La salida funcional mínima debe contener:
- `processed`
- `entities`
- `stats`
- `sessionId`

## Flujo 1: Texto clínico
1. `app.html` -> seleccionar `Texto clínico`.
2. `input.html`:
   - entrada manual
   - carga TXT/PDF/DOCX
   - ejemplo precargado
3. `review.html`:
   - render con highlights
   - acciones de revisión (aceptar/restaurar/modificar)
   - exportación copiar/PDF

## Flujo 2: Batch documentos
1. `batch.html`:
   - carga múltiple de TXT/PDF/DOCX
   - progreso y estados
   - consistencia de mapeo opcional
2. revisión:
   - `batch.html?mode=review` (embebe `batch-review-legacy.html`)
3. export:
   - PDF consolidado
   - PDFs individuales
   - CSV resumen

## Flujo 3: Batch estructurado
1. `batch.html?mode=structured` (embebe `batch-structured-legacy.html`)
2. `batch-structured-legacy.html`:
   - lectura CSV/XLSX
   - sugerencia de tipos/acciones por columna
   - validación longitudinal
   - export anon + correspondencia

## Validaciones de seguridad y sesión
- No uso directo de `localStorage` para `clinicalText` ni `batchResults`.
- Existe botón global `Borrar sesion`.
- Render de texto clínico sin ejecución de HTML embebido.
