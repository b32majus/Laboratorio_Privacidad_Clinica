# PR #141 · cierre acotado de vulnerabilidades de Vitest · 22/11/2026

## Alcance

Base de candidato `e1db88b` (`3.0-main@46bce0a` permanece publicado), worktree exclusivo `laboratorio-pr141-vitest4-closure-20261122` bajo KairOS DIA. Se actualiza **solo la herramienta de pruebas** `vitest` desde `^3.2.4` a `4.1.12` exacta y los transitivos de desarrollo necesarios. No se modifican componentes React, motor, políticas, exportadores, tests, CI, CSP ni `render.yaml`. La revisión independiente ha comprobado que el diff del lockfile se limita a entradas marcadas `dev: true`; ninguna dependencia de producción cambia.

## Riesgo y solución

En el candidato previo, `npm audit` incluía tres avisos residuales: dos críticos y uno moderado en `vitest`, `tinypool`, `@vitest/mocker`. Con Vitest 4.1.12 la auditoría COMPLETA reporta **0** avisos y `npm audit --omit=dev` reporta **0**. `npm audit fix --force` ofrecía Vitest 5.1.1, incompatible con el Node 20 actual de CI; se descartó. Vitest 4.1.12 declara Node `^20.0.0 || ^22.0.0 || >=24.0.0`. La compatibilidad declarada se confirmará además por CI real en GitHub Node 20 sobre el SHA integrado.

## Evidencia local reproducida (datos sintéticos)

- `npm install --save-dev --save-exact vitest@4.1.12 --package-lock-only --ignore-scripts --no-fund`: lock actualizado y auditoría 0.
- `npm ci --ignore-scripts --no-fund`: PASS, 361 paquetes instalados y 0 vulnerabilidades.
- `npm run typecheck:v4`, `npm run lint:v4`, `npm run format:check:v4`: PASS.
- `npm test`: **92/92 suites, 1.569/1.569 pruebas PASS** usando Vitest 4.1.12.
- `npm run build`: PASS, solo aviso no bloqueante previo sobre tamaños de chunk.
- `E2E_PORT=4351 npx playwright test e2e/pdf.spec.ts e2e/batch.spec.ts e2e/structured.spec.ts --workers=2 --retries=0 --reporter=line`: **9/9 PASS**, sin reintentos.
- Revisor independiente GLM-5.3 Flash: **OK**, sin hallazgos bloqueantes; revisión ciega del diff, compatibilidad de engines, workflows, reproducibilidad y registros anteriores. Log local `/tmp/lab-pr141-vitest4-review-20261122.log`.

## Límites y autoridad

- `npm audit=0` no demuestra por sí solo ausencia de riesgos de privacidad, ni da equivalencia clínica universal.
- La revisión funcional de RC1 y sus obligaciones #92 no cambia con esta actualización exclusiva de herramientas. El criterio contractual de cierre de #92 requiere decisión/evidencia material y no se cierra por arrastre.
- No habilitar Dependabot, cambiar rama por defecto, fusionar PR o desplegar sin la correspondiente autorización humana. Render tiene autoDeploy desde `3.0-main`: el merge requiere control específico.
- La deuda aceptada anteriormente se limita a medición de rendimiento compuesta post-recuperación; no incluye requisitos clínicos ni privacidad.
