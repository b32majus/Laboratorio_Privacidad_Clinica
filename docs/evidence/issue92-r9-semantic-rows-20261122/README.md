# REC-12 #92 · R9 — conciliación de 142 obligaciones y falsadores de accesibilidad/atajos

**Fecha:** 22/11/2026 · **Tramo:** KairOS DIA S, evidencia y pruebas sintéticas en worktree Herdr, **sin cambiar React, políticas, motor o formato de exportaciones**. Candidato del producto `R8@3728f0b`. No se ha mezclado en `3.0-main` ni desplegado.

## Resultado exacto, sin confundir contabilidad con semántica

Se ha vuelto a leer el texto literal de las **88 filas A + 42 B + 12 C = 142** de `docs/audits/2026-10-recovery-traceability-matrix.md` y contrastado cada ID con `docs/evidence/issue92-r1-reconciliacion-20261121/EVIDENCIA_POR_FILA.csv`.

El fichero **`MATRIZ_142_R9.csv`** contiene **142/142 filas**, con **objetivo original, número de línea, veredicto histórico, razón histórica, tratamiento R1, rutas vigentes de los testigos y estado de evidencia R9**, sin sobrescribir ni reinterpretar la matriz congelada. Se genera mediante `reconciliar.py` y ofrece un registro reproducible para los tramos posteriores.

**No se afirma 142/142 verificado funcionalmente:** 104 filas mantienen testigos históricos **sin relectura semántica individual en R9**. Sus rutas son válidas pero no prueban por sí solas cada cláusula. Hay **30 filas sin ruta de test R1** (varias son decisiones/documentos de gobernanza, no implica que carezcan de prueba o de documentación); **ninguna ruta de test declarada por R1 está rota**. El resumen reproducible está en `RESUMEN_142_R9.json`.

| Disposición documental R9 | Filas | Significado preciso |
|---|---:|---|
| Testigo previo, no revalidado semánticamente aquí | 104 | NO ascender a PASS nuevo |
| Prueba focal R8 (funcional) | 7 | E2E conjunto previo 22/22 con falsadores concretos |
| Deuda o futuro conservado | 14 | No habilita cambios de producto ni adelanta cierre |
| Control remoto GitHub verificado R7 | 2 | Solo SHA remoto, no candidato local |
| Evidencia parcial de rendimiento/deuda | 1 | No se afirma 100 % lazy ni memoria V4 |
| Decisión humana/ramas pendiente | 1 | No modificar configuración remota |
| Gobierno/publicación #93 | 3 | Requiere origen/ documentación del producto fusionado |
| Visual con aceptación humana previa | 2 | No es prueba universal de todos los estados |
| **UX-013 falsada en R9 contra el registro** | **1** | Atajos están implementados, con pruebas reales |
| Testigo R6 específico | 2 | 32 columnas, inspector primero y una autoridad ID |
| Supersesión humana previa | 2 | Conservar precisión de la decisión, no convertir en implementación |
| Idioma parcial R7 | 2 | F7/F9/R7 acotados, no cobertura universal |
| H-03 tipografía no supersedida | 1 | No atribuir aprobación a la ausencia de decisión |
| **Total** | **142** | **Clasificación conservadora de evidencia, no cierre de funcionalidades** |

## Hallazgos concretos, no una ronda general de auditoría

**1. `UX-013` — registro histórico materialmente desactualizado.** La fila A contiene `OPEN_RECOVERY` / «A/M/K/F + next/previous shortcuts were never implemented». El producto actual `app-v4/src/review/ReviewWorkspace.tsx` **sí maneja** A aceptar, M editar, K conservar con confirmación, F marcar texto seleccionado y **Alt+↓/↑ para pendientes**, con protección de foco, campos de entrada, composición IME, eventos repetidos y confirmaciones abiertas. `ReviewWorkspace.test.tsx` **72/72 PASS** sobre el candidato; `review-productivity.spec.ts` comprueba atajos y no-mutación en V4 real. El cierre de la obligación técnica tiene **testigo positivo concreto**, pero no se reescribe la fila histórica ni se cierra #92 automáticamente.

**2. `REC12-GAP-04` (S2/A11Y-05) — nuevo testigo no dependiente exclusivamente del color.** `e2e/rec12-r9-noncolor-highlight.spec.ts` recorre V4 compilada a **375/1280**, con texto sintético, **cuatro hallazgos reales**, subrayado calculado CSS del segmento marcado, tipo **IDENTIFICADOR** en la etiqueta ARIA y la lista, selección para mostrar en el inspector el mismo tipo y el mismo valor, y ausencia de overflow horizontal. Dos PNG `capturas/noncolor-{375,1280}-full.png` conservan el testigo renderizado. El primer intento RED fue un **error del oráculo propio** (esperaba literalmente «DNI» cuando el motor da «IDENTIFICADOR»), no un fallo productivo; se corrigió el test **antes** de su aceptación y repitió. **Alcance:** el tipo se reconoce sin color mediante etiqueta/lista/inspector después de seleccionar el fragmento; la evidencia **no** demuestra que cada tipo esté escrito junto a cada resaltado sin interacción ni accesibilidad universal en todos los lectores de pantalla. No se modifica la semántica visual aprobada.

**3. `CI-001` y `GOV-002` — información congelada obsoleta en parte.** El R7 verificó en GitHub que `3.0-main` **está protegida** con controles requeridos y que la ejecución 44903478299 del CI remoto pasó `npm test` completo sobre `3.0-main@46bce0a`. Las frases originales «CI no ejecuta `npm test`» y «3.0-main no protegida» ya no describen el estado remoto observado. No extrapolar a R8/R9 locales ni a configuraciones futuras.

**4. `QA-002` — fuente original ahora conocida.** R8 reabrió P1Q-04 de septiembre y encontró sus **13 casos numerados**; 12 tienen testigo directo y el caso #11 está subordinado a la decisión humana D-024 de original deliberadamente conservado. Esto rectifica la tesis previa «no enumerables» de R2/F5/R7. No es un PASS universal de 142 filas.

**5. `PERF-002` — no equiparar módulos lazy existentes con rendimiento compuesto probado.** La matriz A afirma `VERIFIED_RESOLVED` para parsers/exportadores lazy, mientras R3/R5 encontraron que el núcleo de benchmark tiene mediciones por tamaño pero no la responsividad/memoria integral de React+Worker y no todos los exportadores están probados lazy. Solo `REC12-GAP-01` de **medición residual** fue aceptada por Sil como deuda **post-recuperación**, sin convertir faltantes funcionales en PASS.

**6. Deudas que NO se deben cerrar por arrastre:** `GOV-001` rama por defecto todavía `main` vs `3.0-main`; `DOC-001`, `HOST-001/002` pertenecen al cierre de gobierno/publicación #93; `H-03` (JetBrains Mono) sigue como target gap no supersedido; `H-01/PDR-08` tienen testigos de estados españoles R7 **no exhaustivos**. `REC12-GAP-07` exige no persistencia silenciosa; código y D-013 apuntan a memoria solo pero R9 no lo declara universalmente comprobado.

## Comprobaciones realmente ejecutadas

- `npm run build`: **PASS**, candidato V4 real.
- `npx vitest run app-v4/src/review/ReviewWorkspace.test.tsx`: **72/72 PASS**, atajos, edición, confirmación, teclado e inhibiciones.
- `E2E_PORT=4331 npx playwright test e2e/rec12-r9-noncolor-highlight.spec.ts e2e/review-productivity.spec.ts --workers=2 --retries=0 --reporter=line`: **5/5 PASS**, 375/1280 y navegación de revisión en aplicación compilada.
- `python3 docs/evidence/issue92-r9-semantic-rows-20261122/reconciliar.py`: **142/142 registros únicos**, secciones 88/42/12, 0 testigos rotos, archivo de objetivos literales y recuentos exactos.
- R8 (misma app, sin cambios de runtime R9) conservó **22/22 E2E** sobre los 13 críticos originales; R7 confirmó protección/CI de la rama remota. **No se ha vuelto a lanzar `npm test` global** únicamente por documentación y un nuevo test de lectura.

## Qué falta antes de `GO` de #92

**El estado honesto sigue siendo `NO_GO_ISSUE92_CLOSE`.** R9 ha **materializado las 142 cláusulas como entradas verificables**, pero **104 no tienen un nuevo dictamen semántico R9**. Se deben cerrar con evidencia directa o con una disposición humana explícita; no dar prioridad indiscriminada a los 104: empezar por los marcados **blocker/partial/STALE** y los siete addenda §F (fuera de las 142 filas), conservar deuda/futuro cuando exista decisión aceptada, y dejar decisiones de tipografía/orden de trabajo a Sil. Para `G-HP4/G-HP8`, la evaluación de comprensión de la experiencia completa requiere comprobación humana de un escenario concreto y no se deduce de una captura o el DOM.

**Siguiente unidad pequeña:** revisión dirigida de filas **`UX-013`, `GOV-001/002`, `CI-001`, `PERF-002`, `H-03` y addenda `REC12-GAP-03/04/05/07`**, sustituyendo las referencias históricas vagas por testigos falsables o decisión humana allí donde aplique. No alterar matriz/contratos congelados, no inventar aprobación de nuevas obligaciones, ni hacer push/PR/merge/deploy.

**Veredicto R9:** `R9_142_ROWS_CLASSIFIED / UX013_WITNESSED / GAP04_POSITIVE_SCOPED / NO_GO_ISSUE92_CLOSE`.
