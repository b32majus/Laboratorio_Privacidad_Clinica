# Issue #92 · REC-12 · B2 / GAP-06 — reconciliación de tests con la decisión humana D-021 (Atenea C-087)

**Estado:** READY_TO_LAUNCH / HUMAN-AUTHORIZED TEST-ONLY CORRECTION · 2026-10-14. **No ejecución ni publicación anticipada.**

## Punto fijo, autoridad y objetivo

- Repositorio `b32majus/Laboratorio_Privacidad_Clinica`; base canónica `origin/3.0-main@297f8144d33db6aebd33be26c245655bb2cee4f5`; rama `work/issue92-gap06-test-reconcile-c087-20261014`. No reutilizar el worktree rojo antiguo como escritura.
- Esta rama conserva **ordenadamente**: commit de decisión humana `b7b2fc0bb07df4c656511dcb85e4109dead82fd7` (solo D-021 y matriz §F); commit testigo rojo `443f34e8927ad0a7a53d342a0e677767fe082d63` (los B2 tests originalmente falsadores); y un commit local posterior que contiene este handoff. **Launch HEAD = SHA completo que indique Cora** al entregar el bash; comprobar árbol limpio, ancestros, branch y base remota antes de trabajar. Sin amend/rebase/reset ni modificación de commits históricos.
- Autoridad **superior y local**: `docs/shaping/CURRENT_DECISIONS.md`, sección «D-021 clarification — explicit numeric ages in structured tables (HUMAN-RATIFIED 2026-10-14)», y `docs/audits/2026-10-recovery-traceability-matrix.md`, «REC12-GAP-06 — later human adjudication». La política ratificada prevalece sobre las aserciones originales rojas de B2. Las reglas T19 para `birth`, D-020 texto, D-022 escalares y el resto de D-021 continúan idénticos.
- Atenea C-087: `cost_policy=standard`, `risk_class=complex` por verificación de política de privacidad. Agente visible `atenea-complex`, writer `atenea-implementer-complex`, Standards `atenea-review-standards` y Spec `atenea-review-spec-complex` en revisión canónica única sobre el candidato fijo; `atenea-corrector-complex` fresco si hay hallazgo prescriptivo. Sin fallback ni cambio de modelo.
- **Resultado:** los dos tests B2 previamente rojos deben convertirse en oráculos **positivos y estrictos** de la conservación exacta de edades numéricas configuradas como `insensitive/keep`, en Safe CSV **y** Safe XLSX bajo `external-ai`. El caso A debe seguir demostrando nacimiento `birth` → bandas T19 en los bytes reales. No se modifican los exportadores, la transformación, UI ni los contratos de privacidad.

## Causa comprobada / edición exacta

**Causa del FAIL:** los dos tests B del archivo `app-v4/src/structured/structured-export.test.tsx` añadidos en B2 (tras el describe `ExportStep — structured Safe exports under external-ai (REC12-GAP-06)`) emplean `expect.soft(...).not.toBe(...)` para impedir que `Edad_Num` conserve 34,35,41 y que sus celdas XLSX sigan siendo de tipo `"n"`. Eran expectativas deliberadamente rojas bajo la interpretación anterior de GAP-06; la responsable humana ha ratificado explícitamente **la conservación** de esos valores en ambas exportaciones. **No existe en este resultado un defecto productivo de esa retención**. Los tests registraron un conflicto real con el antiguo requisito de auditoría, no deben borrarse ni maquillarse en la historia.

**Único archivo editable:** `app-v4/src/structured/structured-export.test.tsx`, **exclusivamente el nuevo bloque de B2** (docstring/descripciones/comentarios y las nueve aserciones del caso B). Conservar helpers existentes, fixture `GAP06_EDAD_GRID`, `externalAiEdadNumInput`, `jobFor(...,"external-ai")`, redacción de Case A, captureDownloads, SheetJS gobernado, cleanup, configuraciones y pruebas anteriores.

Ediciones literales prescriptivas, preservando los mensajes de test por fila:

1. Test `case B — Safe CSV Edad_Num cells under external-ai (material witness)`: renombrarlo a `case B — Safe CSV retains explicitly kept numeric ages under external-ai`. Sustituir en las **tres** aserciones de celda `expect.soft(rows[1][1]...).not.toBe("34")`, `rows[2][1]...not.toBe("35")` y `rows[3][1]...not.toBe("41")` por `...toBe("34")` / `...toBe("35")` / `...toBe("41")` respectivamente. Mantener header, `PAC_001` repetido, `PAC_002`, trabajo `external-ai`, tipo de archivo y ninguna descarga Confidential. No sustituir por `not.toContain`, no validar por substring global.
2. Test `case B — Safe XLSX Edad_Num typed cells under external-ai (material witness)`: renombrarlo a `case B — Safe XLSX retains typed numeric ages under external-ai`. En las **tres** aserciones de tipo `workbook.cell("Data","B2"/"B3"/"B4")?.t`, sustituir `.not.toBe("n")` por `.toBe("n")`. En las **tres** de valor correspondientes, sustituir `.not.toBe(34/35/41)` por `.toBe(34/35/41)`. No convertir números a strings ni apuntar a otra columna/hoja. Mantener comprobaciones de cabeceras, identidad pseudonimizada y lectura de **bytes XLSX reales**.
3. Actualizar comentarios de docstring y los comentarios `MATERIAL WITNESS`/`deliberately FALSIFYING` de ambos tests para explicar positivamente la decisión humana del 14/oct, **sin borrar que el commit `443f34e` registró y reprodujo originalmente el rojo**. El Case A de nacimiento T19 sigue exactamente igual y debe quedar en verde.
4. No eliminar ni aflojar los dos casos B para obtener PASS. El PASS debe demostrar edad exacta por **cada fila/columna**, carácter numérico del XLSX, y la coherencia de la política externa Job/plan/preparación. La retención exacta no se presenta como prueba de anonimización ni como permiso para compartir esos datos fuera del entorno controlado.

## Testigos: riesgo real, falsación y evidencia mínima

| Superficie/consumidor | Propiedad a verificar y falsación | Evidencia |
| --- | --- | --- |
| `configuration.ts` D-021 keep → `transform-plan.ts` → `transformed-dataset.ts` | Una edad numérica ya existente con `keep` permanece EXACTA en Safe; falsaría banda/supresión o cambio de dato por el perfil `external-ai` | CSV Case B: columnas/filas con `"34","35","41"` exactos |
| `ExportStep.tsx` → `xlsx-export.ts` (XLSX Safe) | No se modifica tipo o valor de un escalar `keep`; falsaría `"34"` en vez de número 34, u otra columna/fila | XLSX Case B: hoja `Data`, columna B, B2/B3/B4 con `t="n"` y valores numéricos 34/35/41 |
| `date-age-policy.ts` T19 → ambos formatos reales | Una fecha de nacimiento con rol `birth` bajo `external-ai` sí se transforma a franja por fecha de visita | Case A existente (CSV/XLSX: `60–69 años` / `40–49 años`), **sin modificaciones** |
| Ids/permiso/confidential/async del exportador | Nunca introducir capacidad nueva ni modificar llamadas productivas; tests anteriores siguen defendiendo guards | 13 tests previos de `structured-export.test.tsx` + test focal de T19; sin nuevas suites |

## Ejecución proporcional y STOP

1. Coordinador verifica SHA/branch/árbol/autoridad local. Implementador fresco realiza **solo** las sustituciones precedentes y fija un único commit acotado encima del handoff. Un test antiguo rojo y una política nueva no justifican otro diagnóstico ni rediseño de T19/D-021.
2. Writer corre, desde raíz, una vez:
   ```bash
   npx vitest run app-v4/src/structured/structured-export.test.tsx app-v4/src/structured/date-age-policy.test.ts app-v4/src/structured/output-preparation.test.ts
   npm run typecheck:v4
   npx eslint app-v4/src/structured/structured-export.test.tsx
   npx prettier --check app-v4/src/structured/structured-export.test.tsx
   git diff --check
   ```
   El rojo histórico (2 failed / 51 passed) permanece acreditado por el commit original, no se reejecuta como segunda campaña. Si `node_modules` falta en el worktree, se permite `npm ci` desde lockfile existente, **sin cambios de lockfile/dependencias**.
3. Candidato fijo: único review canónico Standards + Spec Complex, nunca duplicado ni pospuesto. Hallazgo concreto => corrector fresco y prescriptivo según C-087 (máximo 2 intentos). Una observación negativa material no se anula por otras pruebas verdes. Hallazgo material fuera del alcance => HUMAN STOP.
4. Cora revisa SHA, parent, diff, pruebas, estándares y política. La autoridad humana decide por separado si publicar los documentos ratificados y la corrección de tests. **Sin push, PR, merge, deploy, cierre del issue #92 ni arranque de B3** por esta ejecución.

**Entrega:** `READY_FOR_CORA` con SHA exacto, parent, cambios completos (doc/rojo/handoff/test verde), 2 casos B verificados en bytes, Case A intacto, validadores y Standards+Spec. En caso de bloqueo: `READY_FOR_CORA_HUMAN_STOP_GAP06` con evidencia.
