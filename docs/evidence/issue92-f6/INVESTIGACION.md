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

**Estado:** propuesta de criterios pendiente de GO específico antes de ejecutar implementador. No afirmar paridad 13/13 ni REC-12 PASS.

## Línea base ejecutada en F6, sin tocar producto ni E2E

21/11/2026, trabajo desde worktree Herdr F6 a `3.0-main@28f9ced`. `npm ci` PASS (368 dependencias), `npm run build` PASS (aviso Vite de tamaño de chunk no bloqueante), `npm run typecheck:v4` PASS. `E2E_PORT=4214 npx playwright test e2e/rec05-result.spec.ts e2e/review-export.spec.ts --workers=2 --reporter=line` = **8/8 PASS, sin retries**; incluyó original conservado, fallo PDF solo, Gate bloqueado, Copy vs TXT, DOCX básico y confirmación Confidential. El código del producto es el ya publicado, no se ha editado ningún test. Logs de evidencia local `/tmp/lab-rec12-f6-deps.log`, `/tmp/lab-rec12-f6-build.log`, `/tmp/lab-rec12-f6-typecheck.log`, `/tmp/lab-rec12-f6-baseline-e2e.log`.

**Punto exacto de mejora:** E2E de `rec05-result.spec.ts` «a deliberately kept original ...» valida hoy únicamente TXT frente a originales excluidos/conservados. No verifica DOCX/PDF reales contra ese mismo Safe en la misma sesión. La nueva prueba F6 debe ampliar ese test, no crear uno de cero.

**STOP ratificación:** sin el «GO» explícito a `CRITERIOS_DIA.md` no se escribe ni ejecuta el nuevo testigo. El GO a continuar la investigación no se considera autorización para alterar comportamiento clínico o publicar.
