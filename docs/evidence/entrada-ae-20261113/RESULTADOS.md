# Entrada A–E — prueba local del producto real (13/11/2026)

**Estado:** implementación A–E original realizada; **única auditoría DIA completada como REHACER** sobre a6bdb69 (CTA Archivos móvil). Corrección acotada en rama aislada, RED→GREEN y suite E2E Entrada PASS; falta el GO visual humano y NO hay push/PR/merge/deploy/cierre de issues.

**Base original:** `c98db57acea0c4d0a00e64fbf34fa32fd51fc8a5`; implementación auditada `a6bdb694fac92ee86a646c963c742883611c7fee` en `/srv/kairos-lab/qualification/laboratorio-entrada-ae-cora-direct-20261113`; corrección sobre el commit documental `dc3222bd446df1a2e7dfc81d2eff6b8926f1d267`, rama `fix/lab-entrada-ae-cta-375-20261113`, worktree `/srv/kairos-lab/qualification/laboratorio-entrada-ae-cora-cta-fix-20261113`. La base ya conserva byte idéntico el helper #129 (`e2e/harness/flows.ts`) sin overlay C-088. Referencia humana aprobada `docs/design/sophilux-b-v1/ENTRADA_V1_AE_VISUAL_APPROVAL_20261018.md` y los cuatro PNG bajo `docs/design/sophilux-b-v1/fine-proposal-20261018/`, sin alterar sus bytes.

## Cambio visible autorizado

- **A:** h2 Entrada «¿Qué vamos a revisar?» y microcabecera «Nuevo trabajo».
- **B:** eliminación de dos párrafos redundantes; restricción factual «Texto o archivos, no ambos» en pie, con el error tipado original preservado.
- **C:** textarea real protagonista con ejemplo sintético, portapapeles a un lado en escritorio y debajo de etiqueta en móvil, ayuda de ejemplos tras textarea, sin tocar la autoridad del borrador. Dos etiquetas HTML nativas asociadas conservan «Pegar texto» como parte del nombre accesible y añaden la frase visible del mock.
- **D:** pie marfil separado con una sola CTA real Crear trabajo; no se omiten errores ni estado de lectura de lote.
- **E:** guía contextual dentro de la tarjeta con `details/summary` cerrado inicialmente; cuatro políticas idénticas siguen derivando de `POLICY_IDS`/`buildPolicyGuidance`. La sección global factual de «Política de privacidad» sigue operable, fuera de la tarjeta.

**Sin cambio:** dominio, engine, privacidad, `useJobSession.ts`, descargas, política real, archivos, persistencia, dependencias, configuración, texto original de encabezado editorial y diseño aprobado. Sin PHI; fixtures sintéticos y red externa prohibida en los testigos Playwright.

## Pruebas del candidato local

| Gate | Observación |
| --- | --- |
| Vitest focal `App.test.tsx App.input-start.test.tsx App.policy.test.tsx` | **110/110 PASS**, después del ajuste final de etiquetas |
| Vitest completo `npm run test:v4` Node 24.15.0 | **1555/1555 PASS**, 91 archivos, antes de un último ajuste puramente de asociación de etiquetas; el foco/E2E posteriores cubrieron ese ajuste |
| Playwright `e2e/input-start.spec.ts`, `policy-guidance`, `ux-closeout-shell`, `gate-export-ux`, `rec05-result` | **52/52 PASS** sobre build V4 definitivo; puerto aislado 4198, 2 workers, cero retries; fixture auto no-network |
| CSS visual | El candidato original tenía Archivos CTA bottom=812,75 (NO PASS primer viewport); corregido con padding exclusivo de móvil, test RED sobre original y GREEN tras corrección |
| Typecheck, ESLint, Prettier, build V4 y `git diff --check` | PASS; tests localizados de corrección `17/17` E2E Entrada y prueba geométrica RED→GREEN, logs VPS `/tmp/lab-entrada-ae-cta-*-20261113.log` |

El Vitest completo imprime `JobModelError invalid-processing-transition` ya documentado en #92/R1. **No se clasifica como resuelto por el PASS de pruebas**; corresponde a otro trabajo, fuera de este cambio. El build avisa del tamaño de chunks, sin fallo.

## Capturas de producto REAL, Chromium, con SHA256

| Estado | Archivo | SHA256 |
| --- | --- | --- |
| Texto 1440×900 | `entrada-ae-texto-1440.png` | `e652b216485487708c224d00c55ea919030d18cc725ef4ee7208e001dad047ff` |
| Archivos 1440×900 | `entrada-ae-archivos-1440.png` | `ed903b6916828f1c9d30101aaffcde33788d404474ba5c4d9c130e421f9a1a35` |
| Texto 375×800 | `entrada-ae-texto-375.png` | `c3a4d3133cd786c46b57ca3d55ae4a595d47a5f693d17edbaff076840c79e5db` |
| Archivos 375×800 (corregida) | `entrada-ae-archivos-375.png` | `c1a355dc1090a77acf3d5152d6e16513a877a81bc8c6f4285447355695bc1727` |

Las capturas corresponden al producto V4 con sus controles reales, no a la maqueta HTML; las diferencias de cabecera global y controles de privacidad reales respecto al mock no se falsean ni ocultan.

**Auditoría DIA cerrada con único REHACER sobre a6bdb69:** agente OpenAI principal confirmó CTA Archivos móvil bottom=812,75>800 (12,75 px fuera); GLM independiente verificó alcance y registró dos observaciones bajas: comentario de etiquetas accesibles no exacto y full Vitest anterior al ajuste final de labels. El principal corroboró que NO bloquean. Logs externos (no artefactos Git): `/tmp/lab-entrada-ae-dia-veredicto-final-20261113.log` y `/tmp/lab-entrada-ae-dia-second-glm-20261113.log`. Ninguno es firma humana.

**Corrección acotada (sin segunda auditoría):** CSS de dropzone Archivos SOLO a <=600px (`padding:22px 14px`→`12px 14px`), test Playwright nuevo de CTA completa en 375×800 y captura real de Archivos móvil regenerada. La prueba propia dio RED sobre base (`Expected <=800; Received 812.75`, log `/tmp/lab-entrada-ae-cta-red-20261113.log`) y GREEN tras el CSS (log `/tmp/lab-entrada-ae-cta-green-20261113.log`). E2E Entrada final **17/17 PASS**; 3 capturas no afectadas permanecen byte-idénticas. No se atribuye a los auditores revisión de este commit correctivo.

**Siguiente puerta:** revisión visual humana del React corregido y GO de publicación separado; no cierre automático #129 ni REC-12. La intermitencia `invalid-processing-transition` sigue abierta fuera de este ajuste.

## Adenda de integración local — 13/11/2026

Sil respondió «Go» al checkpoint de aprobación visual del React real corregido; este GO no autoriza publicación. En una rama NUEVA desde `origin/3.0-main@5787671`, el código de producto y los 8 testigos originales se trasladaron byte por byte del candidato corregido. Se excluyeron capturas históricas .atl, parches y handoffs de ejecución no canónicos.

La primera ejecución del E2E global reveló 12 llamadas directas al input oculto en 6 suites antiguas (modo inicial Texto). Se sustituyó exclusivamente la preparación por el helper ya aprobado `selectFiles(page, files)` del #129; testigos, aserciones, bloqueos y fixtures sin cambios. La primera batería se detuvo tras registrar los fallos de preparación; la batería corregida pasó **77/77** sin retries con no-network, build V4 real y puerto aislado. `npm test` de la rama preparada pasó, con **1555/1555** Vitest (91 ficheros), además de los checks del repositorio; typecheck/lint/format/build PASS.

Logs: `/tmp/lab-entrada-ae-integration-npm-test-20261113.log`, `/tmp/lab-entrada-ae-integration-playwright-fixed-20261113.log`. Esta adenda es evidencia de INTEGRACIÓN local posterior, no un segundo dictamen independiente ni un GO de push/PR/merge/deploy. La intermitencia histórica `invalid-processing-transition` sigue sin resolver y no debe confundirse con la suite verde.
