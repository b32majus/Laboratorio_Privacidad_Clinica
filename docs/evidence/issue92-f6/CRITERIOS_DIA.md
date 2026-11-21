# REC-12 F6 · Paridad Safe individual en una sola sesión

**Estado:** siete criterios RATIFICADOS por GO humano (21/11/2026). Autorizada ejecución local con DIA; no publicación. KairOS DIA / OpenCode directo, M/sensible por tratar reglas de contenido clínico, pero **solo con datos sintéticos**. Fuente GitHub `3.0-main@28f9ced9e7466e27d285240bff67b2a4122b15db`, issue #92.

## Siete criterios de aceptación (observables)

1. **Un solo trabajo y unas solas decisiones.** Partiendo de un texto sintético con DNI, teléfono, correo y NHC, se revisan los cuatro hallazgos una única vez. Se modifica el DNI, se aceptan las retiradas de teléfono/NHC y se conserva deliberadamente el correo tras confirmarlo. No se calculan ni fuerzan decisiones desde el test.
2. **Resultado preparado y aviso veraz.** Antes de completar todas las decisiones, las salidas Safe permanecen bloqueadas. Al quedar listo, el aviso visible indica que se conservó deliberadamente un original; no se presenta como garantía absoluta de anonimización.
3. **Copiar y TXT.** Desde ese mismo Resultado, Copiar deposita el texto preparado en el portapapeles y Descargar TXT produce **exactamente los mismos caracteres**, no solo una cadena de tamaño parecido.
4. **DOCX real.** El DOCX descargado se abre con el lector Mammoth ya utilizado por los tests del proyecto. Tras la única normalización aprobada de fin de línea (CR/CRLF → LF y terminadores de párrafo), su texto coincide **exactamente** con Copiar/TXT; no basta comprobar que el ZIP OOXML es válido.
5. **PDF real.** El PDF descargado se lee con el pdf.js existente sobre los bytes descargados. Su contenido corresponde al mismo texto Safe, permitiendo **solo** normalizar el espacio en blanco que pdf.js introduce en saltos y envolturas de línea. No basta contar páginas ni comprobar el nombre del archivo.
6. **Originales y confidencialidad.** El correo conservado aparece en las cuatro salidas porque así se decidió; no se encuentran DNI original, teléfono ni NHC. La sustitución del DNI sí aparece. Ninguna salida Safe contiene encabezados ni correspondencias Confidential. Todas estas afirmaciones se hacen contra una expectativa independiente derivada de la muestra sintética, no únicamente comparando una salida con otra.
7. **Prueba que realmente detecte errores, sin regresiones.** El oráculo debe fallar al sustituir temporalmente un marcador esperado o quitar contenido, restaurarse inmediatamente y pasar junto a los E2E vecinos y el gate TypeScript. Reutilizar el lector PDF de F5 en una pieza común de **test**, sin duplicarlo; no modificar la aplicación ni el motor. Si aparece una discrepancia real del producto, detenerse y documentarla antes de ampliar alcance.

## Ejecución tras la aprobación

**Ruta preferida:** ampliar el test E2E actual de original conservado en `e2e/rec05-result.spec.ts`, compartiendo el helper de lectura PDF con `e2e/rec87-batch-result.spec.ts` mediante `e2e/harness/`, sin otro recorrido completo. Precheck `npm run build`, `npm run typecheck:v4`, E2E vecinos; luego test RED/verde con bytes de Playwright, Prettier y revisión ciega GLM dentro de una única auditoría DIA.

**STOP:** ningún dato real, secreto, cambio en React/engine/exportadores/políticas, ni descarga Confidential adicional, ni push/PR/merge/despliegue. Sil ha ratificado los siete criterios para implementación y auditoría **solo locales**. La publicación exige otro GO.
