# REC-12 #92 · R7 — Conciliación focal MATERIAL posterior a R6

**22 de noviembre de 2026** · KairOS DIA (tramo S para copia visible, y reconciliación documental con fuente real) · **sin publicación, sin uso clínico, sin modificaciones del motor**. Esta es una **adenda nueva**: no reabre R4, no reescribe la matriz congelada y no inventa una auditoría universal de las 142 filas.

## Alcance exacto

El usuario aprobó ejecutar la siguiente unidad de #92 tras completar R6. Se han contrastado el contrato literal de GitHub #92 y la evidencia conservada (R1/R2/R4/R5/R6), las seis limitaciones de Stage A, la matriz A/B/C y los estados reales de GitHub. El blanco funcional acotado fue **H-01/PDR-08**: dos frases visibles de error y resultado en rutas reales; además se corrigió un tercer imperativo de un fallback defensivo. **No se tocaron clases clínicas, protección, Safe, Confidential, roles, acciones, exportadores, IDs, red, Worker ni arquitectura.**

### 1. Fuente→matriz y el límite NO-negociable

- `node scripts/ci/rec12-r4-source-oracle.mjs` **PASS**: **206** obligaciones S1 98 + S2 54 + S3 42 + S4 12, **204 con ROW y 2 SUPERSEDED** identificados por Stage A; 7 addenda §F y 2 deudas §E adicionales; matriz base **88 A + 42 B + 12 C = 142** IDs. Este comando verifica inventario/punteros, **no equivalencia semántica de 206 cláusulas ni recuperación funcional de 142 filas**.
- `node --test scripts/ci/rec12-b3-ledger.test.mjs` **2/2 PASS**: ledger B3 y R1 contienen exactamente los 142 IDs, sin enlaces de test inexistentes. Sigue sin certificar contenido ni último SHA de cada test.
- `EXCEPCIONES_23.csv` confronta por nombre, sin perder ninguna, **las 23 antiguas `PENDING_COMPOSED`** del R1: 9 técnicas/CI; 6 gobierno/hosting; 2 privacidad/paridad; 2 idioma; 2 UX; 1 rendimiento; 1 tipografía. Cada registro distingue testigo concreto, limitación y afirmación que NO debe declararse PASS. No es un dictamen nuevo de 142/142.

### 2. Evidencia nueva de gobierno remoto (respecto a registros históricos)

La consulta reproducible del **22/11/2026** se guarda en `github-remote-20261122.json`, obtenida de la API GitHub y `gh run view`, repo `b32majus/Laboratorio_Privacidad_Clinica`. No modifica protección ni la rama:

| Afirmación concreta | Resultado remoto observado | Consecuencia honesta |
|---|---|---|
| `GOV-002`: protección de la rama canónica de trabajo | `3.0-main protected=true`, `enforcement_level=everyone`; required checks **validate / e2e / Analyze (javascript-typescript) / Secret Scan (gitleaks)** | **La afirmación histórica «no protegida» está desfasada**. Este control remoto hoy existe; no valida por sí mismo la publicación de nuestros commits locales. |
| `CI-001`: CI completo | `.github/workflows/ci.yml` tiene paso literal **`npm test`** y la ejecución **44903478299** `success`, `validate` y `e2e` completados en `46bce0a8f8a25ac5c18c41b2303ae2c785246ddd` | Hay **testigo positivo real** de ejecutar el gate completo **en ese SHA remoto**. No atribuirlo al candidato local R7. |
| CodeQL / Secret Scan | Runs **44903478279 / 44903478292**, `success`, mismo SHA remoto | Positivo para esos runs, **no** evidencia de cobertura universal ni ausencia de vulnerabilidades. |
| `GOV-001`: rama por defecto | La API devuelve **`default_branch: main`** | **Sigue pendiente** alinear gobernanza/canon `3.0-main` o documentar una decisión explícita, por procedimiento de #93; NO modificar sin GO específico. |
| `GOV-003` / `HOST-001/002` / `DOC-001` | Versiones locales y topología/headers previos tienen referencias documentales | El humo final del origen publicado, documentación final y merge de toda la cadena quedan para #93; no declarar que ya se desplegó R7. |

**Precisión temporal:** los resultados remotos son de `3.0-main@46bce0a` el 21/11, consultados el 22/11; el repositorio local usa commits posteriores y NO tiene PR abierto. Esta consulta no creó ni cambió ninguna configuración remota.

### 3. Evidencia nueva H-01/PDR-08: RED→GREEN de dos recorridos reales

El test RED de diseño (commit congelado **`7ea1ba7`**) es `e2e/rec12-r7-rare-spanish.spec.ts`, sobre el **Vite build de V4** y solo sintéticos. Inicialmente **2/2 FAIL precisamente por el texto formal**:

| Superficie real | Antes (en resultado/alerta) | Después | Invariante |
|---|---|---|---|
| Entrada · permiso de portapapeles denegado | «**Pegue** con Ctrl+V…» | «**Pega** con Ctrl+V…» | Error visible ARIA, borrador sin modificar, **no crea Job**; fallback Ctrl+V intacto |
| Resultado estructurado · CSV/XLSX Safe + auditoría separada | «**Descargue** solo el que su destino…» | «**Descarga** solo el que su destino…» | Dos destinos independientes, sin generar/descargar confidencial automáticamente |
| Paso no disponible `StepUnavailableState` · fallback textual | «**Vuelva** a un paso disponible…» | «**Vuelve** a un paso disponible…» | Solo texto del estado defensivo, sin cambios de navegación; no se fabricó una ruta para activarlo |

El implementador DeepSeek V4.1 Flash (perfil **`atenea-implementer-volume`** directo en panel de Herdr) realizó **3 sustituciones de literales en 2 archivos** (`app-v4/src/App.tsx` y `app-v4/src/export/ExportStep.tsx`). Inicialmente el agente coordinador `atenea-volume` detectó `edit:deny` y PARÓ sin escribir; se relanzó con el perfil **implementador autorizado**, no se saltó ningún permiso. Sin delegación, sin modificar tests ni políticas.

La batería F7/F9 previa **7/7 PASS** (idioma principal, fallo PDF de lote, entrada inválida, bloqueos de estructurado, Confidential y cancelación). Tras la corrección, F7+F9+R7 **9/9 PASS**, `typecheck`, `build`, `lint`, `prettier`, `diff --check` PASS. Auditoría independiente Cora sobre diff limitada a esos literales; los testigos ejecutados por Cora se registran en el cierre local.

**Alcance de la frase:** H-01/PDR-08 quedan **mejorados y corroborados en estos estados**; no «todos los errores raros, ARIA, tooltips, idiomas y archivos del producto». El marcador serializado `CONFIDENTIAL — INTERNAL AUDIT ARTIFACT` es una **constante de artefacto CONFIDENTIAL con tests exactos** (`output/confidential-audit-serializer.ts`); no se tradujo ni reinterpretó por una regla de estilo de pantalla.

### 4. #92 y G-HP tras R6 + R7

| Aceptación literal #92 | Estado justificable en este candidato local |
|---|---|
| **#1** Source→matrix oracle primero | **INVENTARIO/PUNTEROS PASS**, equivalencia material de 206 obligaciones **NO** establecida universalmente. Las seis advertencias originales Stage A persisten en sus ámbitos. |
| **#2** Re-verificación completa 88+42 | **PENDIENTE MATERIAL**. R1 tiene 142/142 referencias, R7 identifica específicamente las 23 excepciones históricas; ninguna enumeración de rutas equivale a 142 cláusulas verificadas contra el SHA local. |
| **#3** PDR-01…PDR-12 con pruebas | **PARCIAL**; R5 mantiene correspondencia específica 12/12, R6 mejora PDR-04 (32 columnas móvil) y R7 mejora PDR-08, pero no se sustituyen decisiones humanas/estados raros por PASS ficticios. |
| **#4** Paridad compuesta de acciones, formatos, lotes, Keep y dos Confidential | **TESTIGOS POSITIVOS PARCIALES** R2/R4/R6: R4 46/47 en corrida conjunta, caso aislado PASS; R6 12/12 regresiones. R7 9/9 idioma en nuevos estados. QA-002 del origen citaba «13 críticos» **sin lista canónica**, no se puede inventar 13/13. |
| **#5** Gate motor español REC-01 sobre productivo | **PASS heredado en R4/R6**, 1.569 Vitest y corpus V4; **R7 solo cambia tres textos y no ha alterado el motor**. No afirmar sensibilidad/especificidad universales. |
| **#6** Densidad real y diez G-HP | **PARCIAL POSITIVO**. R6 ahora demuestra decisión/selector temprano en 375 y 320 con 32 columnas/19 pendientes, sin overflow, más R3 24 hallazgos y lote 12/2; **G-HP8 de comprensión humana compleja y G-HP4 de fricción completa no pasan por una captura, y G-HP10 no implica un recorrido con materiales incompatibles simultáneamente**. |

**Disposiciones pendientes específicas:** `PERF-002` no es el PASS de responsividad/memoria V4: únicamente `REC12-GAP-01` quedó aceptado como deuda posterior por Sil; `H-03` (JetBrains Mono sugerido vs `font-mono`) no está supersedido por silencio; `GOV-001` no está resuelto; `QA-002` sigue sin índice canónico de 13. R6 y R7 no alteran decisiones clínicas. Ver `EXCEPCIONES_23.csv`.

## Veredicto que este tramo puede sostener

**`R7_FOCAL_POSITIVE / NO_GO_ISSUE92_CLOSE`**: avance real en dos falsadores de PDR-08, en gobierno/CI actual y en enlaces materiales, sin prueba global que autorice #92. La aplicación **no** se declara recuperada/completa, certificada para uso real, ni apta para alojar datos clínicos sin controles de despliegue. #92 y #93 siguen abiertos hasta resolver sus criterios y publicar por vías autorizadas.

Próxima acción eficiente: **no repetir F7/F9/R6 ni recuentos 142**; completar las cláusulas materialmente no probadas de `QA-002` y las filas residuales de #92 con un testigo falsable por cláusula (o un cierre humano `DELIBERATELY_SUPERSEDED` cuando proceda), y después #93 gobernanza/publicación. No push, PR, merge, despliegue o cambio de rama por defecto sin autorización explícita.
