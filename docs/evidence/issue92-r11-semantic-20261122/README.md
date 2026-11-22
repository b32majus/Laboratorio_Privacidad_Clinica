# REC-12 #92 · R11 · Revalidación SEMÁNTICA individual 142/142 y disposición final acotada

**22 de noviembre de 2026.** KairOS/DIA; sin datos reales, ningún merge, Render ni cierre ficticio de issue. PR #141, base revisada por cuatro especialistas en solo lectura **`8e1fa978ef1f5589ee2632c9c1fa5a6f0efa9680`**; parches focales locales posteriores integrados en esta rama hasta **`bb7567a`** (dos textos españoles, BIFF8 .xls, edad revisada CSV/XLSX, test touch). Este expediente conserva revisión base y adjudicaciones posteriores por separado; un resultado de pruebas de otro SHA no certifica por sí mismo éste.

## 1. Contabilidad de fuentes, sin rebajar contratos

- `node scripts/ci/rec12-r4-source-oracle.mjs`: **PASS**; 206 obligaciones originales (S1 98, S2 54, S3 42, S4 12), 204 referenciadas y 2 con supersesión explícita. Las 7 §F siguen sujetas a verificación/deuda, no «desaparecen» por mapearse.
- `node --test scripts/ci/rec12-b3-ledger.test.mjs`: **2/2 PASS**, originales §A **88**, §B **42**, §C **12**: **142 IDs únicos exactos**. Se mantienen los ficheros de auditoría históricos, sus veredictos originales y R9 como fotografías temporales.
- R11 utiliza **cuatro revisiones independientes de solo lectura de cada fila**, basadas en la formulación literal, código productivo y aserciones de tests y sus límites: `INPUT_A1/A2/B/C.json`, `TASK_*.md`, `AUDIT_*.json`. Ninguna fila puede obtener PASS solo por presencia de una ruta.
- `consolidar.py` verifica exactitud y completitud de las 142 claves, referencias a ficheros y líneas reales. `ADJUDICACIONES_CORA.json` añade en otra columna 16 rectificaciones basadas en código/CI/decisiones previas: no reescribe lo que dictaminaron los revisores. Los 11 avisos iniciales de citas incompletas se conservan transparentemente en el resumen; el falso «no hay pruebas de anclas DOM falsas» se desmiente con 13 casos adversariales reales en `ReviewWorkspace.test.tsx:916-992`.

## 2. Clasificación consolidada del candidato reparado (no equivalencia a certificación universal)

| Dictamen documentado | Nº | Significado exacto |
|---|---:|---|
| `SEMANTIC_PASS` | **106** | Código y aserciones ejecutables del requisito en alcance (incluye nuevos testigos BIFF8 y touch). |
| `STRUCTURAL_PASS` | **9** | Hechos verificables de arquitectura, configuración, entrega de auditoría, protección de rama o CI; no todos requieren un test de interacción. |
| `VISUAL_HUMAN_APPROVED_SCOPED` | **1** | H-02: Sophilux R3 previamente aprobado e implementado, no aprobación futura de cualquier estado. |
| `SUPERSEDED` | **2** | Sustitución anterior documentada; no funcionalidades recuperadas mediante simulación. |
| `FUTURE` | **10** | Futuro explícitamente fuera de alcance de recuperación. |
| `GOVERNANCE_93` | **5** | GOV-001/003, DOC-001, HOST-001/002; no se cuentan como fallos del producto ni se cierran sin release. |
| `ACCEPTED_NONBLOCKING_TARGET_GAP` | **1** | H-03 JetBrains Mono: retención sin implementación **aceptada expresamente el 13/10**, no sustituida por silencio. |
| `PARTIAL` | **8** | Obligaciones que no pueden recibir PASS literal sin cierre técnico o decisión humana. |
| **Total** | **142** | Sin omisiones ni nuevos tests artificiales por cada una de las 104 filas antes históricas. |

**No declarar «134/142 cerradas» como certificación**: los estados tienen distinta naturaleza y el cierre contractual exige también evidencia G-HP humana y remedios exactos.

## 3. Las ocho excepciones *verdaderas*, no 22 defectos

| ID | Hecho demostrado | Parte no cumplida literalmente / decisión siguiente |
|---|---|---|
| `FUNC-007` | `ReviewWorkspace.tsx:676-734` valida anclas contiguas y texto contra la sesión; `ReviewWorkspace.test.tsx:916-992` ya prueba 13 intentos de manipulación que fallan cerrados. | La auditoría original prohibía *toda* derivación de offsets desde DOM; la captura manual todavía lee anclas tras validarlas. Decisión: aceptar desviación técnica acotada (con pruebas de integridad) o refactorizar el capturador. **No afirmar que falta test adversarial.** |
| `STRUCT-003` | Autoridad CSV consolidada única, soporta comillas/multilínea; falsador contra parser por líneas en `csv.test.ts`. | Sigue siendo un parser propio y no una librería consolidada externa. Aceptar equivalencia funcional probada o sustituir con regresión íntegra. |
| `ARCH-003` | Contexto explícito y tests entre Jobs aíslan el engine V4. | Managers singleton internos del núcleo JS siguen existiendo. Aceptar deuda técnica aislada o refactorizar con pruebas de no cruce. |
| `ARCH-005` | `ReviewSession` contiene detecciones ricas y decisiones completas. | `Job.detections` conserva forma mínima. Aprobar `ReviewSession` como autoridad única y actualizar contrato, o enriquecer `Job`. |
| `PERF-002` | Lectores DOCX/PDF/XLSX cargan bajo demanda; el build funciona y la experiencia representativa pasa E2E. | Algunas bibliotecas exportadoras siguen en el bundle inicial (chunk ~971 kB, aviso de Vite). Deuda de medición compuesta GAP-01 aceptada NO autoriza automáticamente este incumplimiento de lazy load. Medir impacto o aprobar excepción arquitectónica acotada. |
| `CODE-002` | Aplicación React V4 escrita en TS, núcleo heredado protegido por interfaces TS y pruebas. | `js/` legacy no está tipado íntegramente con JSDoc/`@ts-check`; decisión de deuda heredada o completar tipado. |
| `H-01` y `PDR-08` | Español profesional positivo en F7/F9/R7. **R11 corrige dos literales restantes**: guía estructurada «Compara/puedes» y ayuda del portapapeles «puedes». Tests RED→GREEN. | La matriz aún reclama garantía de estados raros, errores no conocidos, ARIA/descargas. Debe haber barrido dirigido suficiente o aceptación humana explícita del alcance, no inventar exhaustividad infinita. |

La aceptación funcional **G-HP4/G-HP8** sigue siendo un requisito **separado** de la matriz de 142: cuenta de acciones/contextos reales y comprensión por persona de Result/Safe/Confidential. Guía objetiva `ACEPTACION_HUMANA_GHP.md`. No ha sido aprobada aún.

## 4. Siete addenda de fuente §F

Ver `ADDENDA_R11.md`. Resumen: GAP01 deuda *únicamente* medición V4 aceptada; GAP02 DICOM futuro; GAP03 CodeQL GREEN, cobertura y Dependabot pendientes #93; GAP04 subrayado/ARIA positivos acotados; GAP05 URL sin contenido en dos Jobs y cabeceras **del último SHA desplegado** pendientes #93; GAP06 `Edad_Num` `keep` se retiene por decisión humana D-021 (CSV/XLSX comprobados en E2E real) mientras DOB-role banding sigue siendo su propio contrato; GAP07 no persistencia silenciosa acreditada en flujos texto/estructurado.

## 5. Pruebas realmente ejecutadas y límites de SHA

- Sobre RC1 `8e1fa97`: **todos** los checks remotos PASS (`validate`, `e2e`, `Analyze`, `CodeQL`, `Secret Scan`), `GITHUB_GATE_SNAPSHOT.txt`, `3.0-main` protegida y default aún `main`; source oracle + B3 PASS en R11.
- R11 posterior: `StructuredConfigureWorkspace.test.tsx` **RED 1/25 → GREEN 25/25**, y `App.input-start.test.tsx` **RED 1/32 → GREEN 32/32**, sin cambios de semántica; `intake.test.ts` 17/17 PASS con XLS BIFF8 real; E2E `structured-rec04-composed.spec.ts` **2/2 PASS** con Safe CSV y XLSX, edad 34/34/41 exacta y Confidential doble confirmación; `rec12-r11-touch-operability.spec.ts` **1/1 PASS** con `hasTouch:true` y `tap` real; build PASS, TypeScript PASS en suites modificadas. Solo datos sintéticos, 0 reintentos.
- CI remote sobre el **HEAD posterior R11** debe ejecutarse después de publicar estos commits en el PR. Si falla, NO heredar verde del SHA anterior. Se ha visto aviso Vite de bundle pesado, no fallo del build.
- QA-002: los **13 casos originales** enumerados y verificados con 22/22 E2E en R8 (caso 11 condicionado a D-024) y resto de flujos compuestos RC1 103/103 E2E. No hay 13 tests totalmente separados; los testigos se comparten. Persisten límites de cobertura no universal declarados en el documento R8.

## 6. Dictamen contractual frente a los seis criterios de #92

1. **Fuente→matriz:** **PASS** 206/206, punteros trazados y decisiones de supersesión.
2. **Reverificación A+B+C:** **142/142 revisadas y adjudicadas**, con 8 PARTIAL materiales explícitos y 5 transferencias justas a #93. No equivale a PASS total.
3. **PDR-01…12:** **11 con prueba focal PASS, PDR-08 PARTIAL**; no afirmar 12/12 aprobados.
4. **E2E compuesto:** evidencia **positiva representativa** del contrato original y exportaciones, incluidas confirmaciones Safe/Confidential. No sustituye comprensión humana ni garantiza combinaciones no probadas.
5. **Motor español REC-01:** testigos positivos y `npm test` remoto RC1 verde; regresión del HEAD final pendiente del nuevo CI.
6. **G-HP1…10:** densidades y funcionamiento positivo, pero **G-HP4/G-HP8 SIN ACEPTACIÓN HUMANA**; no dar PASS universal.

**Resultado R11:** `SOURCE_COMPLETE / ALL_142_SEMANTICALLY_ADJUDICATED / 8_MATERIAL_PARTIAL / HUMAN_GHP4_GHP8_PENDING / NO_GO_TO_CLOSE_ISSUE92`. No hay 104 fallos de implementación ni 104 nuevas pruebas necesarias. La siguiente intervención útil es adjudicación explícita de los 8 límites y sesión humana de los tres flujos, **no una quinta auditoría general**.

## 7. Reproducción

```bash
node scripts/ci/rec12-r4-source-oracle.mjs
node --test scripts/ci/rec12-b3-ledger.test.mjs
python3 docs/evidence/issue92-r11-semantic-20261122/consolidar.py
```
La matriz `MATRIZ_142_R11.csv` conserva `r11_status` literal de auditores y `curated_status` separado. `RESUMEN_R11.json` incluye los 142 IDs por disposición, advertencias conservadas y SHA. Ningún fichero histórico se reescribe. Próximo trabajo #93 **solo después** de aprobar REC-12 y obtener GO expreso de release; Render autodeploy al fusionar `3.0-main`.
