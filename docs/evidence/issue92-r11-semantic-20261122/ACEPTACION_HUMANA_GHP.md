# REC-12 · comprobación humana acotada que falta antes de cerrar #92

**Candidato:** `RC1@8e1fa97`, todavía no mezclado ni desplegado. **Estado:** SIN VALIDAR POR PERSONA. Este documento es una guía de prueba, no una aceptación inventada. Datos exclusivamente sintéticos. No usar el origen en producción actual para atribuir conclusiones a RC1.

## Tres recorridos, sin repetir la auditoría general

| Recorrido real sobre RC1 | Qué observar y anotar | Gate |
|---|---|---|
| **Revisión texto** con unas 24 detecciones, mezcla aceptar/modificar/conservar y una marca manual por selección | ¿Se identifica inmediatamente la decisión siguiente? ¿Hay transiciones de pantalla o cambios de contexto prescindibles? Anotar **número de acciones, transiciones y ayudas requeridas** desde crear Job hasta poder consultar Result; comprobar que corregir una decisión no borra las otras. | G-HP4, G-HP5, G-HP6, G-HP7, G-HP10 |
| **Tabla estructurada** con 32 columnas y al menos 19 pendientes, escritorio y móvil de 375 px | ¿Se entiende comparación clasificación/tratamiento/estado? ¿Está localizable el inspector activo sin recorrer contenido accesorio? ¿La navegación conserva correctamente la selección y permite corregir? Anotar momentos de confusión y ayudas necesarias. | G-HP1, G-HP3, G-HP4, G-HP5, G-HP7 |
| **Lote con 12 documentos y 2 errores**, tras reconocer o resolver fallidos; Result preparado y Result bloqueado | Sin explicar «Privacy Gate», preguntar: ¿qué falta?, ¿puedo compartir ahora?, ¿qué archivo usaría?, ¿dónde aparecen los originales?, ¿qué sucede si elijo conservar un identificador?, ¿para qué sirve la confirmación Confidential? Observar si puede distinguir **Safe** de **Confidential** sin confusión, y si entiende la acción apropiada siguiente. | G-HP4, G-HP6, G-HP8, G-HP9, G-HP10 |

**Registro requerido tras prueba:** fecha, commit, quién observó, tarea completa sí/no, cuenta de acciones/transiciones donde aplique, dudas concretas observadas, corrección puntual o aceptación motivada. No inventar un número mínimo de clicks ni un tiempo máximo no aprobados; identificar solo fricción evitable comprobada.

**Pruebas técnicas existentes (no sustituyen esta prueba):** `e2e/review-productivity.spec.ts` (24), `e2e/rec12-r6-structured-mobile.spec.ts` (32/19), `e2e/rec87-batch-result.spec.ts` (12/2), `e2e/rec05-result.spec.ts` (Safe/Confidencial), `e2e/rec12-r3-sophilux.spec.ts` (jerarquía). La aprobación visual Sophilux R3 anterior tampoco equivale a esta validación de comprensión en recorridos compuestos.
