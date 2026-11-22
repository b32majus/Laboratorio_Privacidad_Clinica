# REC-12 #92 · R8 — QA-002: los **13 casos originales SÍ están enumerados**

**22 de noviembre de 2026 · KairOS DIA S, conciliación documental y testigos existentes, sin modificación de producto ni pruebas previas.** Se usa exclusivamente el fichero congelado `docs/audits/2026-09-privacy-functional-code-audit.md`, §6 **P1Q-04**, líneas **363–377**, junto con el candidato V4 local **R7 `19a661c`** y el control R8. GitHub #92/#93 siguen abiertos; sin push, PR, merge, deploy ni datos clínicos reales.

## 1. Rectificación explícita del error de lectura R2/F5/R7

**Hallazgo nuevo de fuente:** R2 (`PARIDAD_QA002.csv:Q18`), F5 y R7 afirmaban que los «13 contratos críticos» carecían de lista canónica. Esa afirmación se **falsa** leyendo la sección **P1Q-04** de la auditoría original: están listados y numerados del 1 al 13, en líneas 365–377. No son inferencias desde una batería posterior. No se reescribe el fichero congelado ni la documentación histórica; esta adenda R8 registra la evidencia correctora y es autoridad posterior para la interpretación de QA-002.

El JSON `SOURCE_TO_E2E_13.json` guarda exactamente el texto y línea del **origen**, el E2E verificable, su cláusula observable y su límite. El proceso R8 comprueba automáticamente **13/13 IDs originales, en orden, y que cada testigo citado aparece en el fichero de prueba vigente**; esto es contabilidad documental, no ejecuta el E2E por sí mismo.

## 2. Conciliación material fuente → testigo sobre V4

| # | Contrato original literal | Testigo V4, comprobación falsable | Disposición |
|---:|---|---|---|
| 01 | paste → process → review → copy | `e2e/rec05-result.spec.ts` — Pega texto sintético largo, crea Job, completa revisión, copia y compara bytes Copiar/TXT | Directa |
| 02 | modificación aparece en salida | `e2e/review-export.spec.ts` — DNI modificado se exige por expectedSafeOutput independiente y bytes Safe TXT | Directa |
| 03 | restore aparece en salida | `e2e/review-export.spec.ts` — Correo restaurado/conservado por decisión explícita aparece en Safe y se advierte | Directa |
| 04 | entidad manual aparece en salida | `e2e/review-export.spec.ts` — Marcado manual de enalapril entra en ReviewSession, se modifica y aparece Safe | Directa |
| 05 | safe export bloqueado con review pendiente | `e2e/review-export.spec.ts` — Revisión pendiente presenta bloqueo del Gate; sólo revisión completada libera salida | Directa |
| 06 | PDF textual | `e2e/pdf.spec.ts` — PDF con capa textual muestra texto exacto del fixture en revisión | Directa |
| 07 | PDF escaneado produce warning | `e2e/pdf.spec.ts` — PDF escaneado sin capa provoca alerta española y no crea Job; fail-closed | Directa |
| 08 | batch con fallo conserva el fallo | `e2e/batch.spec.ts` — PDF corrupto queda visible como Error, bloqueo factual y recuperación de otros ítems | Directa |
| 09 | navegar batch no equivale a revisar | `e2e/batch.spec.ts` — Navegar entre dos documentos deja ambos pendientes; luego aceptar cambia estado | Directa |
| 10 | UNKNOWN estructurado requiere review | `e2e/structured-composed.spec.ts` — UNKNOWN y roles sin resolver muestran 3 pendientes, no existe salida lista previa | Directa |
| 11 | safe export no contiene PII fixture | `e2e/review-export.spec.ts` — Safe TXT no contiene DNI/teléfono/NHC sin autorizar; correo expresamente conservado sí aparece, conforme D-024 | **Con D-024** |
| 12 | confidential export está marcado | `e2e/review-export.spec.ts` — Etiqueta visible Confidencial y cabecera inmutable del artefacto; confirmación antes de descarga | Directa |
| 13 | cero requests de red fuera del origen clínico | `e2e/network-invariant.spec.ts` — Flujo normal con networkRecorder sin violaciones; suite añade falsadores fetch y XHR | Directa |

**Importante sobre el caso 11:** el mandato de 2026-09 «safe export no contiene PII fixture» es **incompatible en su lectura absoluta** con la autoridad humana **D-024** (`docs/shaping/CURRENT_DECISIONS.md`, §D-024, «Canonical Safe payload»), que ordena que un original **deliberadamente conservado por revisión humana** permanezca en los cuatro formatos Safe, acompañado de advertencia factual. El test E2E de `review-export.spec.ts` **rechaza DNI, teléfono y NHC no autorizados**, **conserva exclusivamente el correo aceptado como original**, y verifica que ningún dato ni cabecera de Confidential se mezcla en Safe. Esta es una **interpretación condicionada por una decisión humana posterior**, NO afirmación de que un Safe nunca contiene ningún identificador ni aprobación para compartirlo externamente.

**Caso 3:** el `restored` del dominio se representa como una decisión explícita «Conservar original» con confirmación, no como restauración automática y silenciosa. El mismo E2E verifica el texto original sólo después de la confirmación. **Caso 13:** el test normal registra cero solicitudes inesperadas y los dos tests adversariales con fetch y XHR comprueban que el monitor/CSP detecta intentos plantados. Ambos son testigos acotados, no pruebas de ausencia de toda fuga futura.

## 3. Ejecución realmente realizada R8

**Build** `npm run build` → **PASS** (bundle de la V4 real).

Se ejecutaron los **seis archivos** de la tabla, **juntos**, bajo el harness del proyecto, servidor de Vite del build, datos completamente sintéticos, **2 workers, 0 retries**:

```bash
E2E_PORT=4320 npx playwright test \
  e2e/review-export.spec.ts \
  e2e/pdf.spec.ts \
  e2e/batch.spec.ts \
  e2e/structured-composed.spec.ts \
  e2e/rec05-result.spec.ts \
  e2e/network-invariant.spec.ts --workers=2 --retries=0 --reporter=line
```

**Resultado: 22/22 E2E PASS (1,0 min aprox.), una sola corrida, sin reintentos.** La suite incluye los 13 objetivos de fuente en varias pruebas compartidas; no se miente diciendo 13 tests independientes. Se suman `node scripts/ci/rec12-r4-source-oracle.mjs` **PASS** (206 obligaciones mapeadas a fuente/matriz, inventario solamente) y `node --test scripts/ci/rec12-b3-ledger.test.mjs` **2/2 PASS** (142 IDs existentes), sin inferir 142 equivalencias funcionales. Warnings pdf.js de fuente/canvas opcional se observaron sin fallos; no se ocultaron ni alteró configuración para silenciarlos.

### Qué queda verdadero y qué queda abierto

- **QA-002/P1Q-04 específico:** los **13 casos están enumerados**, los **12 directos** tienen testigos positivos y el **#11** está validado en el sentido vinculante de D-024 (original deliberadamente conservado). No queda correcto el antiguo `NO_ENUMERABLE` de R2-Q18 ni el argumento de R7 «13 sin lista canónica».
- **QA-002 como fila histórica §A** sigue marcada `PARTIAL` hasta conciliación y publicación final de #92; este tramo no reescribe su estado. Las **18 preguntas de R2** eran un inventario ampliado de paridad, **no los 13 casos originales** y no deben sustituirlos.
- **#92 no pasa automáticamente a GO:** faltan revalidación material **142 filas** contra el candidato definitivo, cierre separado de **PDR-01…12**, paridad compuesta más allá del conjunto mínimo QA-002, y evidencia humana de comprensión/fricción de **G-HP4/G-HP8** donde corresponda. El `R4 NO_GO` permanece hasta acreditarlo. La protección remota de GitHub observada en R7 sigue sin probar los commits locales.
- No se ha cambiado motor, configuración de privacidad, React, exportador, tests E2E originales, matrices históricas, estado del issue, políticas ni Worktrees ajenos. Toda evidencia es sintética.

**Veredicto focal:** `R8_QA002_ORIGINAL_13_RECONCILED / NO_GO_ISSUE92_CLOSE` — alcance documental+E2E exacto, no certificado general de recuperación.
