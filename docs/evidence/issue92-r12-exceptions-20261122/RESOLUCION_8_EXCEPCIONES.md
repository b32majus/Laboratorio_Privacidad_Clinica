# REC-12 · R12 · Resolución aprobada de las 8 excepciones

**Decisión humana:** 22/11/2026, Sil aprueba expresamente la propuesta completa: **corregir STRUCT-003; corregir y verificar H-01 y PDR-08 de manera conjunta; aceptar con límites expresos FUNC-007, ARCH-003, ARCH-005, PERF-002 y CODE-002**. También autoriza dejar registrado para reanudarlo rápidamente. No se autoriza merge de `3.0-main`, despliegue de Render, manejo de datos clínicos reales ni certificación de seguridad.

**Autoridades:** origen y texto de requisitos en `docs/audits/2026-10-recovery-traceability-matrix.md` (líneas A36, A46, A54, A56, A66, A71, B118, C174); los **142 dictámenes R11** y testigos en `../issue92-r11-semantic-20261122/MATRIZ_142_R11.csv`, que **no se reescriben**; decisiones originales en `docs/shaping/CURRENT_DECISIONS.md`; historia detallada en `docs/evidence/issue92-r11-semantic-20261122/README.md`. El presente documento es la autoridad *posterior* para la **disposición de las ocho excepciones**, sin fingir que la literalidad original se implementó cuando se aceptó una equivalencia o deuda.

## Índice ejecutivo (para recuperar en menos de 2 minutos)

| ID | Resolución APROBADA | Estado técnico a acreditar | ¿Qué cambia ahora? | ¿Qué la reabre? |
|---|---|---|---|---|
| `FUNC-007` | **Equivalencia técnica acotada** | Aceptada con 13 falsadores previos | No refactor DOM por requisito puramente literal | Modificar selección/render/anclas o demostrar offset incorrecto, marca fuera de fuente, corrupción de ReviewSession |
| `STRUCT-003` | **Corrección obligatoria, NO aceptar deuda** | PENDIENTE hasta E2E/CI verde | Parser consolidado CSV y no-guess en ambiguos | Cualquier CSV válido interpreta separador equivocado, columna sobrante silenciada, quote parcial aceptado |
| `ARCH-003` | **Deuda técnica aislada** | Aceptada con contratos de aislamiento vigentes | No reescribir core legado | Cambio en managers/worker/contexto, paralelismo, contaminación entre Jobs o pseudónimos inconsistentes |
| `ARCH-005` | **Equivalencia de contrato y autoridad** | Aceptada: `ReviewSession` es autoridad | No duplicar Detection en Job | Nuevo consumidor confía en `Job.detections` o hay desajuste entre Job/revisión/resultados |
| `PERF-002` | **Deuda de lazy-load delimitada** | Aceptada sin llamar «lazy» a exportadores | No optimizar sin medición | Fallo perceptible en inicio/móvil, métricas por encima de presupuesto aprobado, ampliación de exportadores |
| `CODE-002` | **Deuda de tipado del JS legado** | Aceptada con fachada tipada TS/CI | No reescritura global del núcleo | Cambios en JS heredado sin tipos/test de contrato o errores de shape, ampliación sustancial del core |
| `H-01` | **Corrección + barrido dirigido** | PENDIENTE hasta evidencia final de idioma | Corregir imperativos/localizar rechazos claves | Nueva UI, código de error, ARIA, tooltip, flujo/idioma formal que escape al barrido |
| `PDR-08` | **Mismo cierre técnico y testigos que H-01** | PENDIENTE hasta cobertura dirigida | No duplicar arreglos ni suites | Nuevo estado o interacción con lenguaje inglés/formal, comprensión humana insatisfactoria |

**Interpretación de estados:** `ACEPTADA_CON_LIMITES` no es `SEMANTIC_PASS` literal ni cumplimiento normativo; `CORRECCION_PENDIENTE` no es cierre. Ninguna de las cinco aceptaciones elimina el riesgo ni la obligación de reevaluarlo ante su disparador.

## Fichas completas · contrato, porqué, evidencia, reapertura

### 1. FUNC-007 · Selección manual de texto y offsets de DOM

**Literal original:** «Eliminar reconstrucción frágil de offsets desde DOM». El estado canónico, las decisiones y el texto final NO dependen de DOM: `ReviewSession` es autoridad. Sin embargo `selectionOffsets` y `boundaryOffset` en `app-v4/src/review/ReviewWorkspace.tsx` traducen una selección humana sobre el DOM renderizado a offsets de texto fuente.

**Decisión:** aceptar equivalencia técnica **exclusivamente** porque el capturador verifica segmentos contiguos, offsets y texto completo contra `session.originalText` y rechaza anclas falsificadas/obsoletas. **No afirmar que se ha eliminado todo acceso a offsets desde DOM.** No introducir una reconstrucción paralela ni cambiar el algoritmo de selección en esta tanda.

**Testigos y falsador:** `app-v4/src/review/ReviewWorkspace.test.tsx` adversariales de anclas fabricadas, modificadas, selección externa/DOM mutado (13 casos ya existentes); `app-v4/src/review/review-domain.test.ts` para añadir marcado sin perder decisiones; E2E `review-productivity.spec.ts`. Criterio continuo: si falla una ancla, la acción no crea detección ni altera sesión; la selección válida crea el span correcto.

**Disparador de reapertura:** cualquier modificación de DOM, textos decorativos o accesibilidad dentro de la fuente, nuevo editor enriquecido o fallo de integridad/offset. En ese caso priorizar refactor a mapeo de fuente inmutable con pruebas RED; ninguna reducción de controles por comodidad.

### 2. STRUCT-003 · Parser CSV consolidado, crítico para integridad

**Literal original:** «Sustituir parser CSV artesanal». El parser actual en `app-v4/src/structured/csv.ts` era propio y `detectCsvDelimiter` elegía carácter según conteo en *todo* el texto. **Defecto reproducido** con datos sintéticos:
`id,nota\nSYN-001,observación; control; revisión; consulta` → antes inventaba separador `;` y rompía columnas.
`id;nota\nSYN-002;TA, FC, IMC, HbA1c, glucosa` → antes elegía coma.
Es daño de integridad, no cuestión estética ni solo deuda.

**Decisión:** sustituir **la autoridad de parseo** por `csv-parse/browser/esm/sync` (paquete `csv-parse` MIT, versión fijada por lock, sin terceros en tiempo de ejecución); detectar separador por cabecera + consistencia de registros, no puntuación de las notas; rechazar interpretaciones verdaderamente ambiguas, no adivinar; mantener multiline/escaped quotes, espacios, nulls, header y orden; fallar tipado ante filas sobrantes, quoting inválido, entrada vacía; mantener límites de tamaño y la propagación `readStructuredFile`.

**Incidente de selección de librería (R12):** la primera implementación basada en Papa Parse pasó 49 tests pero fue rechazada por `npm run check:external`: el bundle incluía `XMLHttpRequest` (regla `dist-xmlhttprequest`). **No se relajó el control**. Se autorizó dentro del mismo alcance usar la variante browser ESM pura de `csv-parse`, que debe superar build + privacy guard; NO atribuir su éxito antes de tener evidencia del gate.

**Pruebas obligatorias:** `app-v4/src/structured/csv.test.ts` con coma, punto y coma, tab, multiline, doble quote, vacío `""`, CRLF/LF, BOM, ambigüedad y fila sobrante; `intake.test.ts` del adaptador real; `professional-spanish-f9.test.ts` para explicación de fallos; Playwright de entrada y vista comparativa sobre al menos los dos falsadores, con inspección del número y nombre de columnas; CI completa después de integrar. Evidencia de corrección a añadir al cumplir el gate (commit SHA y E2E reales). **No dar por cerrado hasta verde final.**

**Disparador de reapertura:** delimitadores con signos en observaciones, CSV reales válidos detectados incorrectamente, anomalía de celdas/filas, silencios de columnas adicionales o parser que admita registros incompletos. Cambios del motor/parser, del contrato de ingesta o CSV writer exigen tests de ida y vuelta.

### 3. ARCH-003 · Managers singleton dentro del core heredado

**Literal:** «Sustituir singletons mutables por engine/context instanciable». `js/core/managers/AsignadorSustitutos.js` sigue exportando estado mutable (mapas y contadores). V4 usa `ProcessingContext` explícito, reset/seed/reconciliación bajo worker y casos de aislamiento.

**Decisión:** deuda de refactor **aceptada pero no resuelta** en el core heredado. Mantener el aislamiento efectivo de V4, la consistencia pseudónimos/fechas entre documentos y el fail-closed de batch; NO hacer una reescritura big-bang, ni declarar inexistentes los singletons. No ampliar usos directos de managers legacy.

**Testigos:** `app-v4/src/engine/registry-engine.test.ts` (fresh vs shared y contexto serializado), `app-v4/src/engine/legacy-engine.ts` (seed/snapshot), `app-v4/src/engine/worker/`; test de pseudónimos entre documentos. **Disparador:** cualquier concurrencia, paralelismo en workers, recarga, cambio de managers o contaminación detectada. Si se abre, migrar estado por instancia con tests diferenciando fresh/shared y lotes fallidos, no simplificar mediante un reset global sin pruebas.

### 4. ARCH-005 · Contrato único de Detection

**Literal:** «Definir Detection contract». `app-v4/src/domain/job.ts` conserva `Detection` mínimo `{id,categoryId,confidence}`, declarado placeholder y `Job.detections` se inicializa `[]`. El contrato rico que usa V4 (spans, original, confianza, decisión y razones) vive en `js/domain/review-session.js` y la fachada `app-v4/src/review/review-domain.ts`.

**Decisión:** se acepta formalmente `ReviewSession.detections` como **única autoridad real de detecciones** para UI, Privacy Gate, export y auditoría. El espejo mínimo del Job NO es un contrato alternativo; no rellenarlo desde la UI ni ofrecerlo como evidencia clínica. La duplicación sería más peligrosa que retirar el placeholder posteriormente.

**Testigos:** `app-v4/src/useJobSession.ts` (ReviewSession por Job, salidas derivadas), `app-v4/src/review/review-domain.test.ts`, `e2e/review-export.spec.ts` y batch. **Disparador:** cualquier consumidor de `Job.detections` fuera del inicializador o nuevo API que lo exponga; entonces retirarlo o diseñar proyección derivada explícita, jamás dos autoridades mutables.

### 5. PERF-002 · Carga diferida de exportadores

**Literal:** «Lazy-load de parsers y exportadores». Los lectores DOCX/PDF/XLS/XLSX y el motor se activan bajo demanda; `app-v4/src/export/ExportStep.tsx` importa builders/entregables, mientras `batchSafeDeliverables.ts` importa `jszip`/`pdf-lib` de forma estática.

**Decisión:** aceptar deuda acotada de importación/carga de exportadores; **no afirmar que son todos lazy**. La deuda de medición React+Worker `REC12-GAP-01` se aceptó previamente y es **distinta**: no utilizarla para declarar PERF-002 solucionado. No reorganizar bundles ahora sin baseline ni beneficio observable.

**Testigos:** `docs/evidence/issue92-r3-performance-disposition-20261122.md` y `npm run build`; `app-v4/src/export/ExportStep.tsx`, `batchSafeDeliverables.ts`. **Disparador:** medición de inicio/render/móvil desfavorable, umbral de rendimiento acordado y superado, dependencia nueva significativa, adopción operativa con usuarios. Reabrir con benchmark de ruta V4 y plan de splitting, manteniendo integridad/confirmaciones de descargas.

### 6. CODE-002 · Tipado en núcleo legacy

**Literal:** «TypeScript o JSDoc + @ts-check». `app-v4/src` es TS y `npm run typecheck:v4` forma parte del gate. El núcleo conservado `js/` sigue JS sin cobertura integral de `@ts-check`; hay declaraciones/adaptadores de borde TS.

**Decisión:** deuda heredada aceptada, sin declarar migrado el core. Mantener typecheck y pruebas; a partir de ahora, si se modifica comportamiento de `js/`, añadir contrato de tipos/validación precisamente en los módulos tocados y sus tests de interfaz (sin barrer automáticamente 22 archivos).

**Testigos:** `tsconfig.json`, `app-v4/src/engine/legacy-modules.d.ts`, `legacy-engine.ts`, GitHub `validate`. **Disparador:** ampliación o refactor del core, cambio de esquema de resultados o errores por tipos incorrectos, adopción de nuevas APIs JS. Reabrir en unidades verticales, no exigir migración total de golpe.

### 7. H-01 · Español del producto completo

**Literal:** lenguaje del producto; R11 probó español en superficies principales F7/F9 pero no todos los casos de error, ARIA y ayudas. Se corrigieron textos de guía y portapapeles en R11 y después el imperativo visible `elija` → `elige` en aviso de exportación bloqueada con test 25/25.

**Decisión:** corrección y barrido dirigido de las superficies reales y casos relevantes: Input, Configure, Review, Privacy Gate y Result; estado listo/bloqueado/error, ARIA, tooltips, descargas Safe/Confidential, fallos de lectura y mensajes de CSV nuevos. No traducir identificadores técnicos ni texto del paciente. Mantener segunda persona y acción concreta, sin inventar promesas de anonimato.

**Testigos:** `e2e/rec12-f7-language.spec.ts`, `e2e/rec12-f9-spanish-error-states.spec.ts`, `app-v4/src/presentation/domain-message-labels.ts`, `professional-spanish-f9.test.ts` y test de aviso `StructuredConfigureWorkspace.test.tsx`. **Disparador:** nueva pantalla, mensaje, exportador, fallo runtime o idioma mixto descubierto. Cierre solo tras barrido dirigido y checks del HEAD final, no «100 % de todas las futuras cadenas».

### 8. PDR-08 · Español profesional coherente como principio de diseño

**Literal:** «Spanish professional language is a foundation from the first reworked surface». Comparte las mismas rutas y pruebas de H-01, no es una segunda capa de traducción.

**Decisión:** **cierre en una sola ejecución junto con H-01**, acreditando además que cada mensaje comunica qué sucedió y la siguiente acción comprensible, con tratamiento «tú» coherente, accesibilidad razonable y denominación del artefacto Safe/Confidential sin confusión. Mantener `PDR-08` como ID separado en matriz para auditoría histórica (NO fusionar ni borrar la fila).

**Disparador:** que un usuario no entienda el mensaje o que nueva interacción suponga cambio de voz/idioma. El juicio humano G-HP4/G-HP8 **no queda cubierto** por localizar textos: requiere tres recorridos observados conforme `../issue92-r11-semantic-20261122/ACEPTACION_HUMANA_GHP.md`.

## Cadena de decisión, entrega y auditoría

- **Base original:** PR #141 `40781aedc15c2835b036ce5517155f1755a21d80` con CI 92 suites/1572 unit y 114 E2E PASS. **No es el SHA de las correcciones R12**.
- **R12 (se irá completando al acabar):** aprobar arquitectura de las ocho en este documento; corregir CSV en DIA M sensible (sin PHI); ejecutar unidad + E2E; revisión única de implementación con segundo revisor ciego de otra familia; corregir idioma con tests dirigidos; gate remoto del SHA final.
- **Dictamen final de #92 distinto de la decisión de estas ocho:** 206/206 requisitos de origen y 142/142 conciliados en R11. Para cerrar #92 aún exigen aprobación funcional humana **G-HP4/G-HP8** sobre densidad/flujo/Result/Safe/Confidential, documentada en el expediente R11; y criterios de origen que no se puedan sustituir por aceptación arquitectónica sin evidencia.
- **No modificar el histórico:** matriz R11 y DEBT_REGISTER original no se reescriben ni eliminan. Registrar los resultados posteriores por enlace a esta disposición y commits verificables. #93 controla governance, publicación, headers, cobertura/Dependabot; no está incluido en la aprobación de estas ocho excepciones.

## Cómo recuperar el hilo sin repetir trabajo

1. Leer **esta tabla** y la ficha del ID concreto; seguir el disparador y testigo. No volver a auditar 142 obligaciones.
2. Consultar `HANDOFF.md` y el [issue #92](https://github.com/b32majus/Laboratorio_Privacidad_Clinica/issues/92), PR #141 y SHA vigente; no dar por actual el estado de un SHA anterior.
3. Si la excepción fue aceptada: comprobar que el alcance y los testigos siguen vigentes; no reabrir si no hay disparador nuevo. Si fue corrección obligatoria: localizar el commit, la regresión y el gate.
4. Antes de producción real: auditoría externa independiente en el gate previamente acordado, validación organizativa/legal adicional (tratamiento de datos sanitarios) y autorización expresa. Ningún `PASS` de CI sustituye ese trámite.
