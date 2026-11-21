# REC-12 F6 · Investigación de cobertura existente (2026-11-21)

**Base verificada:** b32majus/Laboratorio_Privacidad_Clinica, `3.0-main@28f9ced9e7466e27d285240bff67b2a4122b15db`; PR #137 MERGED, CI postmerge y despliegues automáticos confirmados, issues #92/#93 OPEN, cero PR abiertos al inicio. F6 usa worktree independiente creado por Herdr desde el SHA canónico, no el worktree F5 con cierre documental local.

## Qué existe

| Obligación parcial | Prueba fuente | Lagunas |
|---|---|---|
| 24 detecciones, revisión, Copiar vs TXT en un mismo Result | `e2e/rec05-result.spec.ts`, primer test | No descarga DOCX ni PDF en esa misma sesión |
| Un documento TXT de entrada genera DOCX real | `e2e/rec05-result.spec.ts`, segundo test | Comprueba la firma ZIP/OOXML, no el texto descargado vs Safe |
| Un original conservado por decisión explícita y aviso | `e2e/rec05-result.spec.ts`, cuarto test; `e2e/review-export.spec.ts` móvil/desktop | Compara solo TXT con originales y eliminaciones, no Copiar/DOCX/PDF |
| Reglas de formato y lectura real DOCX | `app-v4/src/output/docx-builder.test.ts` | Usa Mammoth `extractRawText` y `normalizeDocxRawText`; es test de builder, no UI única |
| PDF real e incompatibilidades WinAnsi | `app-v4/src/output/pdf-builder.test.ts` | Usa pdf.js y compara contenido normalizado; otra suite, no bytes de la descarga de UI |
| Lectura del PDF real E2E, anticontaminación y falsación | `e2e/rec87-batch-result.spec.ts` (F5, merge #137) | Testigo de LOTE, no de cuatro formatos de una misma sesión individual |
| Estado blocked/needs-attention y PDF-only failure | `e2e/rec05-result.spec.ts`, tercer/sexto test | Ya testificado; no duplicar salvo vínculo indispensable para el testigo |

## Comportamiento real documentado en código

- `e2e/harness/flows.ts:completeReview` modifica DNI a `[DNI-REVISADO]`, **conserva explícitamente** correo y acepta eliminación de teléfono y NHC en un trabajo real.
- `app-v4/src/export/ExportStep.tsx` llama a `buildSafeDocxBytes(requested.safeText)` y `buildSafePdfBytes(requested.safeText)`, y revalida el contexto antes de operaciones del portapapeles. Compartir el mismo argumento en código **no sustituye la prueba de bytes descargados** que pide F6.
- `docx-builder.ts`: el formato DOCX permite texto Unicode y `normalizeDocxRawText` reconstruye exactamente LF a partir del texto Mammoth; comparar semántica con bytes reales del DOCX.
- `pdf-builder.ts`: PDF usa fuente Helvetica/WinAnsi, rechaza caracteres no representables. pdf.js extrae texto con espacios sintetizados y reflujo; la paridad admitirá solo colapso de whitespace; las restricciones de espacios exactos siguen cubiertas por oráculos de streams del unit test.
- `e2e/rec87-batch-result.spec.ts` contiene lector pdf.js con `Buffer → Uint8Array` y supresión TS conocida para el worker sin tipos. Si se hace reutilizable, mover con **igual semántica** a `e2e/harness/pdf-readback.ts` e importar en ambas specs; ninguna dependencia nueva.
- Las cuatro salidas text/document material ya existen; F6 no propone rediseñarlas. La zona Confidential es independiente y no debe confundirse con Safe.

## Decisión de diseño

La ruta más barata es **un único recorrido reforzado**, el de original conservado en `rec05-result.spec.ts`, reusando la preparación `completeReview`. Exigir una expectativa independiente concreta (`REVIEW_FIXTURE_TEXT` con DNI modificado, teléfono/NHC retirados, correo original conservado) y comprobar **Copiar/TXT exactamente**, **DOCX leído con Mammoth exactamente tras la normalización contractual**, **PDF leído con pdf.js y whitespace normalizado**. Evitar «son iguales entre sí» como único oráculo: cuatro salidas idénticamente erróneas no cumplirían privacidad.

No se ha identificado un bug funcional de producción. La falta actual es **de evidencia E2E compuesta de correspondencia entre cuatro artefactos individuales**. Una prueba RED por contenido erróneo, restaurada, demuestra que el test detecta discrepancias. El bloque de QA-002 sigue PARTIAL incluso cuando este testigo se complete: los demás criterios de REC-12 necesitan conciliación propia.

**Estado del diseño inicial (histórico):** los criterios estaban pendientes de GO cuando se escribió esta sección. Posteriormente se ratificaron y la ejecución local quedó auditada OK, según la sección de resultados inferior. No afirmar paridad 13/13 ni REC-12 PASS.

## Línea base ejecutada en F6, sin tocar producto ni E2E

21/11/2026, trabajo desde worktree Herdr F6 a `3.0-main@28f9ced`. `npm ci` PASS (368 dependencias), `npm run build` PASS (aviso Vite de tamaño de chunk no bloqueante), `npm run typecheck:v4` PASS. `E2E_PORT=4214 npx playwright test e2e/rec05-result.spec.ts e2e/review-export.spec.ts --workers=2 --reporter=line` = **8/8 PASS, sin retries**; incluyó original conservado, fallo PDF solo, Gate bloqueado, Copy vs TXT, DOCX básico y confirmación Confidential. El código del producto es el ya publicado, no se ha editado ningún test. Logs de evidencia local `/tmp/lab-rec12-f6-deps.log`, `/tmp/lab-rec12-f6-build.log`, `/tmp/lab-rec12-f6-typecheck.log`, `/tmp/lab-rec12-f6-baseline-e2e.log`.

**Punto exacto de mejora:** E2E de `rec05-result.spec.ts` «a deliberately kept original ...» valida hoy únicamente TXT frente a originales excluidos/conservados. No verifica DOCX/PDF reales contra ese mismo Safe en la misma sesión. La nueva prueba F6 debe ampliar ese test, no crear uno de cero.

**STOP de diseño original (ya superado):** se exigió GO explícito a `CRITERIOS_DIA.md` antes de lanzar el testigo. Sil lo dio después de esta investigación. Ese GO **no autoriza publicar**.

## Ejecución aprobada F6 · evidencia y límites (21/11/2026)

Sil ratificó los siete criterios de `CRITERIOS_DIA.md` con GO explícito para **implementación local**, no publicación. Vía KairOS DIA OpenCode directo, M/sensible por criterios de privacidad sobre datos exclusivamente sintéticos.

**Contrato RED bloqueado por diseñadora (Cora, commit `f533363`):** ampliación del E2E individual de original conservado `e2e/rec05-result.spec.ts` (una sesión) para:
- calcular el Safe esperado independientemente del artefacto desde `REVIEW_FIXTURE_TEXT` con DNI sustituido, teléfono y NHC suprimidos y correo conscientemente mantenido;
- comparar Copiar y TXT exactamente con ese Safe; descargar DOCX y leerlo realmente con Mammoth y normalización contractual de párrafos; descargar PDF real y leerlo con pdf.js permitiendo solo reflujo de whitespace;
- detectar identidad original y correspondencia Confidential no autorizada en cualquiera de las cuatro salidas, y conservar el aviso humano.
- Stub inicial `e2e/harness/pdf-readback.ts:extractPdfText` devolvía vacío. Con TypeScript y Prettier verdes, el test RED falló **exactamente en paridad PDF**: esperado el Safe completo vs recibido cadena vacía; Copiar/TXT/DOCX habían pasado antes de esa aserción. Evidencia `/tmp/lab-rec12-f6-red-e2e.log`; no se cambió el test desde ese commit.

**Implementación (DeepSeek V4.1 Flash / OpenCode Go en panel propio Herdr, 0 delegaciones):** solo `e2e/harness/pdf-readback.ts` (stub → lector pdf.js real de bytes descargados) y `e2e/rec87-batch-result.spec.ts` (importa el lector compartido y elimina su duplicado local). El constructor y las políticas del producto no cambiaron. El ejecutor pasó typecheck/prettier y Playwright **9/9**. El panel propio fue cerrado al terminar.

**Auditoría única DIA (Cora, segundo ciego GLM-5.3 Flash / otra familia, solo lectura):** confirmó alcance de los dos ficheros y detectó 3 observaciones. (1) **Hallazgo confirmado y corregido en el mismo cierre:** pdf.js puede separar un identificador entre runs (`12345678 A`), y el E2E histórico del lote usaba `not.toContain("12345678A")`; las dos aserciones de ausencia en ZIP y PDF consolidado ahora quitan whitespace **solo al buscar DNI original**, detectando también DNI fragmentado. La equivalencia exacta del nuevo E2E individual contra expectativa independiente ya impedía que ese contenido extra pasara. (2) Cache de promesa pdf.js puede conservar un rechazo de carga: limitación antigua y solo de test que produce **FAIL**, no PASS falso; no se cambió por no duplicar ni refactorizar el lector. (3) Chequeos nominales `CONFIDENTIAL` case-sensitive: la **igualdad completa con Safe esperado** del nuevo test individual detectaría una cabecera inesperada independientemente de mayúsculas; queda como límite de otras verificaciones nominales. Ninguno exige cambio productivo. Sin segunda auditoría ni otra familia después de la única revisión; **0 REHACER**. El revisor no modificó el repo.

**Verificaciones:** implementador 9/9 E2E; auditor en reejecución independiente preajuste 9/9 E2E, TypeScript PASS, ESLint PASS, Prettier PASS y `npm test` **91/91 suites, 1557/1557 tests PASS**. Tras el refuerzo de ausencia DNI: prueba sintética de identificador fragmentado (cotejo sin espacios) PASS, Prettier PASS, TypeScript PASS y nueva reejecución E2E **9/9 PASS**, sin retries; `git diff --check` PASS. La advertencia opcional de PDF.js `canvas`/fuentes en Node existía previamente; no cambia la semántica Safe. Logs locales `/tmp/lab-rec12-f6-{auditor-npmtest,auditor-all-e2e,after-review-e2e,after-review-typecheck,reviewer-20261121}.log` (todos en el VPS, sin datos reales).

**Límites y próxima decisión:** esto prueba una transición individual adicional pero **QA-002 sigue PARTIAL y #92 abierto** hasta reconciliar otros estados/PDR-08/G-HP. No hay push, PR, merge, deploy ni cierre de issues para F6; se precisa GO específico de publicación con CI remoto obligatorio. No confundir estos PASS locales con GitHub CI para este candidato.
