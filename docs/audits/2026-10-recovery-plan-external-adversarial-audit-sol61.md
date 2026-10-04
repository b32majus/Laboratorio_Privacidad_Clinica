# External adversarial recovery-plan audit — Sol 6.1

> Source: user-run read-only Sol 6.1 audit, 2026-10-04.
> Original pasted artifact SHA-256: `6aa65f062a346637daf324ad2e8b1f320733f7d3ebb4063b852aeba7ae4c6381`.
> Import note: line endings / Markdown trailing hard-break whitespace were normalized only; substantive report text is preserved below.

## 1. Verdict

**PASS WITH REQUIRED CHANGES**

La reconstrucción es sustancialmente correcta: el problema diagnosticado existe, V4 conserva una base técnica claramente superior y los 12 Work Orders cubren la mayor parte del recovery real sin caer en restauración nostálgica de legacy.
He podido falsar, sin embargo, la afirmación de que la matriz actual representa ya **todo** el contrato fuente: hay al menos dos obligaciones explícitas de la auditoría UX que no tienen fila/DoD, más una obligación de routing que quedó estrechada sin decisión explícita.
También hay dos dependencias entre REC que deben corregirse para evitar retrabajo, y una afirmación de heritage sobre cabeceras que debe acotarse a Excel.
No hace falta replantear la arquitectura ni aumentar el número de Work Orders, pero **el candidato documental actual no debería publicarse todavía como autoridad definitiva**.

## 2. Material findings

### Finding 1 — La nueva semántica de cierre todavía confía demasiado en que la matriz sea completa

**Severity:** HIGH
**Claim challenged:** REC-12 + la matriz 88+40 impedirán por sí solos otra falsa declaración de paridad.
**Evidence:** la matriz contiene exactamente 88 filas en A y 40 en B, pero una comparación directa contra el freeze UX encuentra obligaciones explícitas que no aparecen en ninguna de esas 128 filas. Por tanto, volver a ejecutar las 128 filas puede producir 128 verdes y seguir omitiendo contrato fuente.
**Consequence:** REC-12 podría volver a cometer el mismo tipo de error que se pretende evitar: verificar exhaustivamente una traducción incompleta del contrato.
**Required change:** REC-12 debe añadir un **source-to-matrix completeness oracle**: antes de aceptar las matrices como cierre, comprobar que cada requisito material de las dos auditorías congeladas y del patrimonio v3 está representado por una fila o por una decisión explícita `DELIBERATELY_SUPERSEDED`. El DoD no debe depender sólo de un número fijo de filas.

---

### Finding 2 — Se perdió la salvaguarda específica de `Keep original` para identificadores directos

**Severity:** HIGH
**Claim challenged:** H-09 / ReviewWorkspace representan completamente la mejora del contrato original de revisión.
**Evidence:** el freeze UX, `UX-10`, dice expresamente:

- renombrar Restaurar como `Mantener original`;
- **confirmación contextual si el dato es identificador directo**;
- explicar que permanecerá en la salida.

V4 sí ha hecho correctamente el primer punto y Privacy Gate muestra después un warning por restored originals. Pero `ReviewWorkspace` ejecuta `Keep original` directamente con un clic y no existe confirmación contextual ni explicación previa para identificadores directos. La obligación tampoco aparece en la matriz ni en REC-09.
**Consequence:** se ha preservado la autoridad del ReviewSession pero no toda la protección UX definida para una decisión que vuelve a introducir PHI en Safe Output.
**Required change:** añadir fila de recovery/target y ampliar **REC-09**: confirmación contextual para direct identifiers + explicación de que el original permanecerá en Safe Output. REC-12 debe tener un E2E explícito para esta decisión.

---

### Finding 3 — Se perdió la confirmación adicional antes de descargar Confidential Audit

**Severity:** HIGH
**Claim challenged:** Safe/Confidential separation actual + REC-04/05/07 representan todo el contrato de exportación objetivo.
**Evidence:** la auditoría UX, en `Export objetivo`, exige para Confidential Audit: separado, marcado como identificable y **“confirmación adicional”**. V4 sí separa físicamente y semánticamente Safe Output y Confidential Audit, pero los handlers de `ExportStep` descargan directamente el artefacto confidencial. No aparece ninguna confirmación equivalente en código, matriz o Recovery Master Plan.
**Consequence:** otra obligación de seguridad de interacción puede quedar fuera aunque todos los serializers, formatos y gates sean correctos.
**Required change:** incorporar esta obligación en los outputs confidenciales de **REC-04, REC-05 y REC-07**, idealmente mediante una interacción común, y comprobarla en REC-12.

---

### Finding 4 — REC-03 tiene una dependencia semántica oculta con REC-02

**Severity:** HIGH
**Claim challenged:** REC-03 puede ejecutarse independientemente de REC-02 tal como sugiere el dependency graph actual.
**Evidence:** REC-03 exige que columnas structured de free text se procesen mediante **el mismo text privacy engine/review semantics**. Actualmente ese engine sólo resuelve `standard` y `strict`; `external-ai` y `longitudinal-research` fallan deliberadamente porque REC-02 todavía debe definir sus mappings. Structured, en cambio, sí permite hoy las cuatro políticas para date/age.
**Consequence:** implementar primero el routing free-text structured obligaría a diseñar alrededor de un motor que todavía no tiene las políticas finales, o a rehacer esa integración después de REC-02.
**Required change:** mantener REC-03 como Work Order, pero hacer que su work unit de **structured free-text → text engine** dependa explícitamente de REC-02. El resto de REC-03 —Study ID, linkage y class→action— sí puede prepararse en paralelo.

---

### Finding 5 — REC-07 debe depender también de REC-05

**Severity:** MEDIUM-HIGH
**Claim challenged:** `REC-06 → REC-07` es dependencia suficiente para batch output parity.
**Evidence:** REC-07 debe generar consolidated safe PDF e individual safe outputs/ZIP. REC-05 es precisamente quien define/restaura los serializers/primitives seguros de TXT/DOCX/PDF derivados de canonical reviewed state.
**Consequence:** ejecutar REC-07 sin REC-05 puede duplicar generación PDF, crear dos autoridades de salida o provocar refactor posterior del batch.
**Required change:** dependency graph: **REC-05 + REC-06 → REC-07**. REC-07 debe componer los primitives seguros del output individual, no inventar una segunda implementación.

---

### Finding 6 — La afirmación de header auto-detection debe acotarse a Excel

**Severity:** MEDIUM
**Claim challenged:** v3 detectaba la cabecera real de “Excel/CSV” antes de V4.
**Evidence:** en `331bcaf…`, `StructuredFileReader.readExcel()` ejecutaba `detectHeaderRow(data)` sobre hasta las primeras 10 filas y podía saltarse filas explicativas. `readCSV()`, en cambio, hacía directamente `headers = parseCSVLine(lines[0], separator)` y `rows = lines.slice(1)`.
**Consequence:** tratar smart header detection de CSV como patrimonio v3 inflaría recovery con una capacidad que no existía.
**Required change:** corregir H-21/auditoría reconciliada para decir explícitamente **Excel/workbook header detection**. REC-04 ya está razonablemente acotado porque su Acceptance habla de workbook; no convertir smart CSV header detection en blocker salvo nueva decisión de producto.

---

### Finding 7 — UX-02 perdió la cláusula de override sin una decisión explícita de supersession

**Severity:** MEDIUM
**Claim challenged:** la recuperación de input/inference está completamente trazada por UX-003 / REC-08.
**Evidence:** la auditoría original pedía un New Privacy Job que infiriese el pipeline “**y permita override cuando sea necesario**”. La matriz conserva la inferencia, pero omite esa segunda cláusula. V4 usa routing determinista y fail-closed, lo que puede ser una solución mejor y más segura, pero no existe una decisión que diga que el override ha sido deliberadamente sustituido.
**Consequence:** el requisito queda perdido por traducción en vez de cerrado conscientemente.
**Required change:** no implementar un selector de override automáticamente. Añadir la obligación a trazabilidad y resolverla explícitamente en REC-08 como una de dos opciones: capacidad acotada con casos legítimos, o `DELIBERATELY_SUPERSEDED` por routing determinista/fail-closed con justificación.

---

### Finding 8 — Quedan marcadores históricos capaces de generar drift documental

**Severity:** MEDIUM
**Claim challenged:** un agente nuevo ya no puede confundirse entre C-083/C-084 o volver al train T01–T25.
**Evidence:** la autoridad de primer nivel está bien reconciliada, pero quedan tres bordes:

- `QUALITY_EXECUTION_PROTOCOL_V1.md` tiene status “HISTORICAL … superseded by C-083” y justo después afirma que la autoridad actual es C-084;
- `TRAIN_V4.md` está marcado correctamente como histórico, pero conserva el heading **“Current accepted checkpoint and next frontier”** y un `NEXT_PREPARED_TRAIN` ya agotado;
- `docs/agents/issue-tracker.md` conserva “as of the C-083 reconciliation”.

No he encontrado, en cambio, ninguna autoridad superior que ordene realmente ejecutar C-083 o T25.
**Consequence:** riesgo bajo para un agente que lea `START_HERE`, pero innecesario para una reconciliación cuyo propósito explícito es impedir drift.
**Required change:** limpiar esos tres marcadores antes de publicación; conservar la evidencia histórica, pero eliminar vocabulario “current/next” donde ya no lo es.

## 3. Missing recovery rows or capabilities

1. **Keep-original direct-identifier safeguard** — obligación de UX-10: confirmación contextual + aviso de que el original permanecerá en la salida. Añadir a target/heritage matrix y REC-09.
2. **Confidential Audit deliberate-download confirmation** — confirmación adicional previa a descargar un artefacto identificable. Añadir como contrato transversal de REC-04/05/07.
3. **Pipeline override / explicit supersession decision** — la cláusula “allow override when necessary” de UX-02 necesita trazabilidad. No recomiendo convertirla automáticamente en feature; debe quedar implementada o explícitamente `DELIBERATELY_SUPERSEDED`.

Las dos primeras son capacidades de recovery claras. La tercera es, como mínimo, una **fila/decisión de recovery obligatoria** aunque la resolución final sea no implementar override.

## 4. Incorrectly included or misclassified recovery items

**Header detection en CSV:** no debe describirse como patrimonio perdido de v3. La capacidad heredada demostrada es **Excel/workbook header-row detection**. V3 CSV usaba siempre la primera fila.

El resto de la clasificación `FUTURE_NOT_RECOVERY` que he contrastado es correcta:

- OCR local;
- NER local;
- FHIR;
- ARX-lite;
- DICOM;
- HMAC / Study IDs criptográficos;
- correspondencia reversible cifrada adicional;
- layout-preserving source-PDF redaction;
- Cloudflare/dedicated-IP/hosting resilience adicional.

Ninguno debe bloquear recovery. Sí deben distinguirse de las capacidades relacionadas que **sí** son recovery: detección fail-closed de PDF escaneado, Study ID determinista dentro del job, Safe PDF generado y separación Safe/Confidential.

Tampoco debe restaurarse la implementación legacy de PDF: era insegura porque podía contener `Original → Transformado`. Debe recuperarse la **capacidad segura**, no el código antiguo.

## 5. REC-01…REC-12 assessment

| REC | Verdict | Keep/Split/Merge/Change | Missing obligations | Dependency/order change |
|---|---|---|---|---|
| REC-01 | **PASS** | Keep | Ninguna material encontrada | Debe seguir primero |
| REC-02 | **PASS** | Keep | Formalizar las cuatro políticas text/document/batch como ya exige el WO | Después de REC-01; pasa a ser prerequisito del subtrabajo free-text de REC-03 |
| REC-03 | **PASS WITH CHANGE** | Keep; no split de WO necesario | Free-text routing debe consumir mappings finales de REC-02 | Study ID/class semantics pueden avanzar; free-text WU **después de REC-02** |
| REC-04 | **PASS WITH CHANGE** | Keep | Confirmación al descargar Confidential XLSX; aclarar que legacy smart-header era Excel | Sigue después de REC-03 |
| REC-05 | **PASS WITH CHANGE** | Keep | Confirmación deliberada de Confidential Audit | Debe preceder a REC-07 |
| REC-06 | **PASS** | Keep | Ninguna material adicional | Puede avanzar en paralelo tras foundation |
| REC-07 | **PASS WITH CHANGE** | Keep | Confirmación Confidential batch artifact; reutilizar output primitives seguros | **REC-05 + REC-06 → REC-07** |
| REC-08 | **PASS WITH REQUIRED DECISION** | Keep | Resolver explícitamente override de pipeline: implementar acotado o supersede | Independiente; decisión debe cerrarse antes de REC-12 |
| REC-09 | **PASS WITH CHANGE** | Keep | Confirmación contextual de Keep original para direct identifiers + explicación de impacto | Después de las superficies funcionales, como ahora |
| REC-10 | **PASS** | Keep | Ninguna material adicional | Después de REC-09 para no traducir superficies transitorias |
| REC-11 | **PASS** | Keep | Ninguna material adicional | Después de REC-10; orden actual sensato |
| REC-12 | **PASS WITH REQUIRED CHANGE** | Keep | Source→matrix completeness oracle; nuevas filas; checks de las nuevas safeguards | Último. Debe depender de todos los REC y no asumir que “88+40” implica completitud |

No recomiendo crear REC-13 ni fusionar Work Orders. Tampoco dividiría REC-03 formalmente: basta con una composición interna que impida ejecutar su WU free-text antes de REC-02.

## 6. Authority/documentation contradictions

La cadena principal está bien reconciliada:

`START_HERE → Recovery Master Plan → recovery audit/matrix → C-084/CURRENT_DECISIONS → ROADMAP/DEBT como estado/evidencia → specs → historical execution`.

Además:

- `DEBT_REGISTER` ya no se presenta como backlog ejecutivo;
- T25 ya no se equipara a full product parity;
- `legacy-retirement` está correctamente rebajado a evidencia histórica de workflow/security replacement;
- C-083 está declarado histórico en `AGENTS.md`/`CONTEXT.md`;
- `CANONICAL_AUTHORITY.md` apunta explícitamente al Recovery entrypoint.

Contradicciones/residuos que corregiría antes de publicar:

1. `QUALITY_EXECUTION_PROTOCOL_V1.md`: metadata “superseded by C-083” frente al cuerpo que dice C-084 actual.
2. `TRAIN_V4.md`: heading “Current accepted checkpoint and next frontier” + `NEXT_PREPARED_TRAIN` dentro de un documento ya marcado histórico.
3. `docs/agents/issue-tracker.md`: referencia temporal a “C-083 reconciliation”.
4. GitHub sigue teniendo `main` como default mientras `3.0-main` es la autoridad canónica; está bien documentado, pero **3.0-main no está protegido**. Esto no invalida recovery, pero REC-12 debe cerrar o dejar explícitamente el handoff humano de governance.

## 7. Claims independently verified

He verificado directamente, sin usar la conversación previa como autoridad:

- El worktree es exactamente `/srv/kairos-lab/qualification/laboratorio-recovery-traceability-20261004`, branch `docs/recovery-traceability-20261004`, HEAD `35d3ae8fc15486bae66d90b00da7a2ccce85fdd3`, limpio. Coincide con el estado solicitado.
- El candidato `35d3ae8…` cambia documentación respecto a `6fb5eb1…`; no modifica código de producto.
- Las dos auditorías congeladas de septiembre son byte-identical entre `e164ca2` y el candidato actual.
- La matriz contiene efectivamente **88** filas A y **40** filas B.
- GitHub `3.0-main` apunta actualmente a `6fb5eb1fb867e022acc68dd2be39b16bd531f27a`; GitHub confirma además que la rama no está protegida.
- Producción carga `createDefaultEngineLoader → Worker → createRegistryEngine()`. No encontré sustitución por un motor distinto.
- `createRegistryEngine()` sigue utilizando el pipeline español: detectores de identificadores, fechas, ubicaciones, nombres/familiares, cuasi-identificadores, scoring, heurísticas y diccionarios, con AGE añadido.
- Los diccionarios españoles siguen presentes y son sustanciales; los recognizers incluyen reglas específicas para DNI/NIE/NHC/teléfono/email, contexto sanitario, hospitales/centros, familiares, profesionales, etc.
- El corpus V4 actual es pequeño: **11 core + 3 adversarial/known-gap**. En core, AGE aparece en 9 casos; NOMBRE, FECHA, UBICACION y SOSPECHOSO sólo en 1 caso cada uno, IDENTIFICADOR en 2. Su propio `config.json` dice que es un regression gate, no un quality grade. La conclusión de REC-01 queda confirmada.
- Structured v3 generaba `ID_ESTUDIO` (`PAC_001…`), configurable por prefijo, y opcionalmente `Visita_Num`.
- V4 usa patient ID para derivar date-shift state pero la disposición `remove` elimina esa columna del Safe dataset y no genera un Study ID sustituto. La regresión longitudinal señalada es real.
- v3 tenía smart header detection en Excel; V4 no la conserva. v3 CSV tampoco la tenía.
- V4 structured export actual ofrece Safe CSV + Confidential TXT; no Safe/Confidential XLSX.
- V4 single/text export actual ofrece Safe TXT + Confidential TXT; no Copy Safe Text, DOCX ni PDF.
- V4 batch declara explícitamente que no existe aún un formato batch Safe Output/Confidential Audit; no hay consolidated PDF, individual PDFs ZIP ni CSV summary.
- v3 sí tenía consolidated PDF, PDFs individuales ZIP y resumen CSV, aunque los PDFs legacy tenían un diseño inseguro y no deben restaurarse literalmente.
- Para text/document/batch, `standard` y `strict` están mapeadas; `external-ai` y `longitudinal-research` fallan tipadamente y aparecen no disponibles. Structured sí resuelve las cuatro políticas para date/age.
- Structured free-text routing está ausente en V4 y correctamente capturado por H-30/REC-03.
- Batch retry/remove/ack UI está ausente y correctamente capturado por REC-06.
- La UI productiva es predominantemente inglesa pese a `lang="es"`; REC-10 es real.
- Existen tokens/ingredientes visuales Sophilux/rose/Inter/Cormorant, pero la composición actual es una workstation bastante utilitaria; la evaluación de REC-11 es razonable.
- OCR, NER, FHIR, ARX-lite, DICOM, HMAC y layout-preserving PDF aparecen en las fuentes como capacidades posteriores, no como paridad requerida.

El worktree seguía limpio al finalizar la auditoría; no he modificado archivos, HEAD, ramas, issues, PRs ni recursos remotos.

## 8. Claims not proven / residual uncertainty

- **Calidad real del motor español:** he confirmado qué motor corre y qué reglas/diccionarios usa, pero el corpus actual es demasiado estrecho para demostrar recall/precision clínica amplia. Es precisamente trabajo de REC-01.
- **Semántica definitiva de External AI y Longitudinal Research en texto:** los operadores existen parcialmente, pero las decisiones por categoría todavía deben cerrarse en REC-02; no las he inventado.
- **Class→action structured definitiva:** el drift está demostrado, pero algunas decisiones de non-date quasi-identifiers necesitan la reconciliación de producto/privacy prevista por REC-03.
- **Pipeline override de UX-02:** no hay evidencia suficiente para afirmar que deba implementarse hoy. Sí hay evidencia suficiente para afirmar que no puede desaparecer sin decisión explícita.
- **Aceptación visual:** puede demostrarse el gap compositivo, pero “Sophilux suficientemente recuperado” requerirá referencias/screenshot acceptance; no es reducible a una prueba textual.
- **Spain/LaLiga/hosting availability:** no forma parte de esta prueba de producto y sigue siendo evidencia operacional externa pendiente.
- **Render smoke final:** corresponde a REC-12 después de publicación.
- No ejecuté suites que pudieran crear build/cache/artifacts dentro del worktree, para respetar el READ-ONLY estricto. Verifiqué implementación, tests existentes, contracts y evidencias estáticas, pero no reclamo haber rerunado el CI completo en esta auditoría.

## 9. Revised recovery count

**Work Orders que mantendría: 12.**

- **Añadiría:** ninguno.
- **Eliminaría:** ninguno.
- **Fusionaría:** ninguno.
- **Dividiría formalmente:** ninguno.
- **Cambiaría:** REC-03, REC-04, REC-05, REC-07, REC-08, REC-09 y REC-12 en scope/acceptance/dependencies, sin alterar su identidad.

Dependency graph revisado, en lo material:

```text
REC-01
  └─> REC-02
        └─> REC-03 free-text routing
             └─> REC-04

REC-03 core Study-ID / class semantics
  └─> REC-04

REC-05 ─┐
        ├─> REC-07
REC-06 ─┘

REC-08
   \
    + REC-02/03/04/05/06/07
                 ↓
              REC-09
                 ↓
              REC-10
                 ↓
              REC-11
                 ↓
              REC-12
```

En trazabilidad, mantendría las **88** filas de debt/hallazgo y ampliaría la heritage/target matrix de **40 a al menos 42** con:

- Keep-original direct-identifier safeguard;
- Confidential Audit deliberate-download confirmation.

Además modificaría la fila que absorbe UX-02 para registrar explícitamente la decisión sobre pipeline override, y corregiría H-21 para acotar heritage de smart header detection a Excel.

Más importante que el número final: REC-12 debe probar que **ninguna obligación fuente material carece de fila**, no sólo que todas las filas existentes están verdes.

## 10. Go / No-Go

```text
Publish documentation reconciliation: NO-GO
Start REC-01: GO
Start implementation beyond REC-01: NO-GO
```

**Antes de publicar la reconciliación:**

1. añadir las dos obligaciones omitidas a la matriz y a sus REC;
2. registrar explícitamente la decisión pendiente sobre pipeline override;
3. corregir H-21 para distinguir Excel de CSV;
4. cambiar el dependency graph para que el free-text de REC-03 espere REC-02 y REC-07 espere REC-05 + REC-06;
5. reforzar REC-12 con source→matrix completeness, no sólo matrix→implementation;
6. limpiar los tres residuos C-083/“current frontier” de documentación histórica.

**REC-01 puede empezar conceptualmente sin replanificación:** su diagnóstico, scope, límites y STOP condition han sobrevivido a la auditoría adversarial. No depende de ninguno de los defectos anteriores y es precisamente el foundation correcto.

**No empezaría REC-02…REC-12 con el plan tal como está escrito ahora.** Primero reconciliaría estas correcciones, publicaría esa versión como autoridad y, a partir de ahí, ejecutaría el recovery conservando los **12 Work Orders**.
