# REC-12 #92 · R10 — Privacy storage / deployed headers / CI governance

**Fecha:** 22/11/2026 · **Candidato local:** `R9@19caa85` + R10 sin cambios de producto. **Protocolo:** KairOS DIA, alcance S documental y testigos exclusivamente sintéticos; ningún cambio de motor, permisos, exportador, privacidad o política. **Estado:** `R10_GAP05_GAP07_EVIDENCE_POSITIVE / GAP03_REMAINS_OPEN / NO_GO_ISSUE92_CLOSE`.

## 1. Hechos nuevos y comprobables

| Obligación original | Prueba nueva o vigente contrastada | Disposición R10 y límite |
|---|---|---|
| `REC12-GAP-05` · URL/query/hash sin PHI | **Nuevo** `e2e/rec12-r10-d013-url-persistence.spec.ts`: dos recorridos sobre **V4 de producción** (trabajo de texto y CSV), con datos sintéticos en el trabajo, nunca en la URL; query/hash sin variación inesperada; monitor sin red exterior; recarga no reconstruye el trabajo | **POSITIVO ACOTADO en candidato local**, no prueba exhaustiva de todos los tipos de archivo ni de URL después del futuro despliegue |
| `REC12-GAP-05` · cabeceras del origen | **Nuevo HEAD sin PHI** a `https://laboratorio-privacidad-clinica.onrender.com/` devuelve HTTP 200, `Referrer-Policy: no-referrer`, CSP con `frame-ancestors 'none'` y `connect-src 'self'`, `X-Frame-Options: DENY` | **POSITIVO EN ORIGEN REMOTO OBSERVADO**, no en R10 fusionado. Habrá que volver a comprobar después del despliegue definitivo de #93 |
| `REC12-GAP-07` · persistencia solo con opt-in | **Nuevo** E2E real en texto + CSV: antes/después del trabajo, `localStorage`, `sessionStorage`, nombres de bases IndexedDB y CacheStorage permanecen iguales; recargar pierde el trabajo. `node scripts/ci/check-storage-policy.mjs` y su self-test adversarial **8/8** pasan | **POSITIVO ACOTADO en dos flujos**, sin sistema de recuperación persistente implementado. No activar persistencia silenciosa en el futuro. Comparar nombres de BD no prueba que una base preexistente no cambie; los demás controles dan evidencia complementaria |
| `DISC-02` · diagnosticar errores sin valores sensibles | En el **código actual** `batchSummaryDiagnostic` y `batchSafeDiagnostic` ya usan únicamente `error.code` tipado o el literal `unexpected-error`, nunca `Error.name`/`message`. 3 suites `ExportStep.batchSummaryDiagnostic`, `ExportStep.batchSafe`, `ExportStep.batchConfidential`: **25/25 PASS** | **RIESGO DOCUMENTADO HISTÓRICAMENTE YA CORREGIDO en candidato actual**. Los tests plantan identificadores en nombre/mensaje y verifican cero descargas/ninguna fuga en HTML. No retocar código ni afirmar eliminación de toda fuga posible |
| `REC12-GAP-03` · CodeQL | Run GitHub **44903478279** concluido `success` para `3.0-main@46bce0a`; Secret Scan 44903478292 y CI 44903478299 igual | **POSITIVO REMOTO PARA ESE SHA**, no garantiza R10 local |
| `REC12-GAP-03` · Dependabot | `.github/dependabot.yml` declara actualización semanal de npm/Actions, pero **API de GitHub devuelve** «Dependabot alerts are disabled for this repository». No PRs del bot en el recorte observado | **BLOQUEO REAL DE GOBIERNO**: existe configuración, **no existe evidencia de alertas habilitadas**. No activarlas sin GO explícito ni confundir actualización de dependencias con alertas de vulnerabilidad |
| `REC12-GAP-03` · cobertura del código | `package.json` no contiene `@vitest/coverage-*` ni `c8`/`nyc`; en esta unidad no se ha producido informe de cobertura de líneas/ramas | **PENDIENTE REAL**. 1.569 tests históricos o 25 tests focales no son una métrica de cobertura |
| `REC12-GAP-04` · resaltado sin depender solo del color | **Heredado R9**, `e2e/rec12-r9-noncolor-highlight.spec.ts` 375/1280 y capturas sintéticas, subrayado/ARIA/lista/inspector | **POSITIVO ACOTADO**, no reejecutar por este R10 sin cambio de producto. No significa etiqueta de tipo inline en todas las entidades ni validación manual de lector de pantalla |

Los resultados remotos están en `CONTROLES_REMOTOS_R10.json`, regenerables con `python3 comprobar_controles_remotos.py`. Este script **solo consulta** origen y GitHub, no envía PHI, no modifica configuraciones y no debe usarse para subir/cambiar ramas.

## 2. Ejecuciones realmente realizadas

- `npm run build` **PASS**; `npm run typecheck:v4` **PASS**.
- `E2E_PORT=4340 npx playwright test e2e/rec12-r10-d013-url-persistence.spec.ts --workers=2 --retries=0 --reporter=line`: **2/2 PASS**, sobre build de V4 y origen local, con contextos nuevos de navegador, sin persistencia tras recarga, sin URL/query/hash con datos sintéticos y sin solicitudes externas imprevistas.
- `npx vitest run app-v4/src/export/ExportStep.batchSummaryDiagnostic.test.tsx app-v4/src/export/ExportStep.batchSafe.test.tsx app-v4/src/export/ExportStep.batchConfidential.test.tsx`: **25/25 PASS**; incluye `DISC-02` adversarial y semántica de ambas descargas seguras/confidenciales del lote.
- `node scripts/ci/check-storage-policy.mjs` **PASS**; `node scripts/ci/check-storage-policy.mjs --self-test`: **8/8 controles PASS**, incluidos `localStorage`/`sessionStorage` plantados y limpieza del sandbox.
- `python3 comprobar_controles_remotos.py` **PASS**: HEAD 200 con 5 aserciones; CI/CodeQL/Secret Scan `success` en SHA remoto; alerta Dependabot desactivada reportada; cobertura no medida.
- No se han repetido las 104 auditorías históricas R9 ni modificado ningún test heredado. **Un único test nuevo de navegador y nueva documentación.**

## 3. Límites, prioridad y próximo paso

**A. Positivo para #92 sin inferir GO.** `DISC-02` ya tiene corrección y tests; `GAP-05` cuenta ahora con evidencia real para **origen publicado** y **SPA local de V4**; `GAP-07` tiene evidencia comportamental de no persistencia en texto/CSV más guard ejecutable. No habilitan uso clínico ni certificación universal.

**B. Dos huecos concretos de `GAP-03` siguen abiertos:** las alertas Dependabot están desactivadas según GitHub, y **no existe medición de cobertura de líneas/ramas**. Requieren una unidad específica de gobierno/CI con aceptación humana previa para cambiar GitHub o incorporar nueva instrumentación. No se ha realizado por sorpresa.

**C. Cierre externo de #93:** el `HEAD` correcto del origen remoto es un testigo de la versión publicada el 21/11 y **no** del código R1–R10 aún no fusionado. Después de integración y despliegue autorizado se repiten el HEAD y el smoke funcional, además de resolver `GOV-001` (rama por defecto `main` vs `3.0-main`).

**D. Cierre semántico de #92:** siguen obligaciones de la matriz de 142 filas pendientes de verificación material, G-HP4/G-HP8 (comprensión humana en flujos complejos) y `H-03` tipografía sin supersesión; la deuda de medición V4 `GAP-01` fue aceptada por Sil **solo** como deuda post-recuperación, no como PASS funcional.

**Veredicto:** `R10_FOCAL_POSITIVE / GAP03_NOT_RESOLVED / NO_GO_ISSUE92_CLOSE`. #92 y #93 permanecen abiertos. No se ha hecho push, PR, merge, deploy, cambio de rama por defecto, habilitación de alertas ni instalación de dependencias de cobertura.
