# Guía de Operación

## 1. Flujo operativo recomendado
1. Abrir `app.html`.
2. Elegir `Texto clínico` o `Datos estructurados`.
3. Si el caso es sensible (enfermedad rara/cargo público), activar `Modo estricto`.
4. Procesar y revisar resultados manualmente.
5. Exportar salida anonimizada.
6. Pulsar `Borrar sesion` al terminar.

## 2. Política de privacidad operativa
- Los datos sensibles se guardan en sesión efímera del navegador (`sessionStorage`) mientras dura el trabajo.
- No se deben mantener pestañas con datos clínicos abiertas tras finalizar.
- El botón global `Borrar sesion` elimina artefactos sensibles de la sesión.
- Mantener revisión humana antes de cualquier intercambio con IA externa.
- El `Modo estricto` reduce riesgo residual pero no sustituye revisión del DPO/comité.

## 3. Límites de uso recomendados
- Texto libre: dividir notas excesivamente largas para revisión más segura.
- Batch documentos: validar tamaño y formato antes del procesamiento.
- Batch estructurado: revisar sugerencias de columna y warnings longitudinales.
- Si se activan reglas estrictas, comprobar legibilidad clínica de la salida final.

## 4. Matriz de navegadores
- Soportado y validado: Chrome, Edge, Firefox (versiones actuales).
- Recomendado para uso clínico: Chrome/Edge con políticas corporativas activas.
- Revalidar tras actualizaciones mayores de navegador.

## 5. Checklist de despliegue GitHub Pages
1. Ejecutar validaciones de CI.
2. Verificar rutas públicas:
   - `index.html`
   - `app.html`
   - `input.html`
   - `review.html`
   - `batch.html`
3. Verificar puentes de compatibilidad:
   - `batch-structured.html`
   - `batch-review.html`
4. Probar botón `Borrar sesion` en flujos de texto y batch.
5. Confirmar exportación PDF/CSV/XLSX.
6. Verificar carga local de `pdf.min.js`, `pdf.worker.min.js`, `mammoth.browser.min.js` y `jszip.min.js`.
7. Verificar carga local de `css/tailwind.generated.css`, `css/local-fonts.css` y tipografías en `fonts/`.

## 6. Incidencias y recuperación
- Si una vista queda sin datos de sesión, volver al flujo desde `app.html`.
- Si falla lectura de archivo, validar extensión y tamaño.
- Si una exportación falla, refrescar y reprocesar el documento.
