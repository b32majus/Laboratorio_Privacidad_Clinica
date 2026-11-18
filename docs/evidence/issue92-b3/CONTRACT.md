# REC-12 #92 · B3 — Contrato de evidencia por fila (GO humano 2026-11-18)

**Protocolo:** KairOS DIA M/sensible, OpenCode directo. **Autoridad:** GitHub #92, contrato fuente `docs/evidence/issue92-source-completeness/README.md` Stage A (206 obligaciones: 204 ROW + 2 SUPERSEDED) y `docs/audits/2026-10-recovery-traceability-matrix.md` A/B/C; decisiones `docs/shaping/CURRENT_DECISIONS.md`; autoridad visual aprobada `docs/design/sophilux-b-v1/ACCEPTED_VISUAL_CONTRACT.md`; rama productiva SHA `184acc6d36b4e97a86bd6ba4153c92525a0135f0`. GO humano **solo implementación + QA local, sin publicación**.

Los 7 criterios aprobados: (1) las 88+42+12 filas vinculadas a pruebas reales con estado honesto; (2) reutilizar E2E ya existentes; (3) completar pruebas específicas de identificación no cromática, URL PHI y persistencia; (4) D-021 CSV/XLSX según decisión; (5) gate español y G-HP1–10 densidad; (6) contraste pendiente de 7 vistas Sophilux sin declarar falso PASS ni decidir rediseños; (7) STOP funcional si se detecta defecto, sin tocar lógica, engine, privacy ni export.

**Salida exigida:** `docs/evidence/issue92-b3/ledger.json` con exactamente 142 objetos (ID de A/B/C sin renumeración, `section`, `id`, `disposition`, `reason`, `evidence`), y `docs/evidence/issue92-b3/README.md` que documente hitos, limitaciones, conteos derivados, prioridades por prueba y fuentes. SHA exacto. El test de integridad `node --test scripts/ci/rec12-b3-ledger.test.mjs` es inmutable.

**Etiquetas de disposición de EVIDENCIA (no verdictos de producto):**
- `EXISTING_WITNESS_REUSE`: test fuente específico inspeccionado y pertinente; no declarar cierre global de fila. Exige ruta .test/.spec/.mjs real.
- `TARGETED_WITNESS`: test B3 nuevo específico y pertinente; PASS aún pendiente de QA/CI hasta que el auditor lo registre; cita `e2e/rec12-b3-witness.spec.ts`.
- `PENDING_COMPOSED`: falta una comprobación del comportamiento/estado final en producto; puede citar docs/tests parciales, sin aprobar.
- `PENDING_HUMAN`: requiere comparación/elección humana, nunca marcar como aprobado.
- `POST_RECOVERY_DEBT`: deuda explícita fuera de cierre según autoridad, no completar por inferencia.
- `HUMAN_SUPERSEDED`: requisito desplazado CON decisión humana trazable y ruta de autoridad.
No existe etiqueta `PASS`: el cierre se obtiene solo tras ejecución/revisión independiente.

**Regla estricta:** toda fila §A y §B que no pueda correlacionarse a test material se queda `PENDING_COMPOSED`, aunque matriz fuente diga `VERIFIED_RESOLVED`. En §C (PDR) conservar pruebas existentes y matiz de densidad, privacidad, UX, visual. Se pueden agrupar explicaciones por tipo, pero cada `reason` debe referirse a su obligación concreta, no texto idéntico inventado.

**Puntos mínimos de README:** fuente Stage A 206, 142 filas matriz A/B/C + 2 DISC + 7 GAP sin alterar sus conteos, estado F3 Revisión DRIFT_OPEN histórico vs Entrada A-E implementada, las 7 vistas comparables solo con capturas de igual estado/viewport; GAP-01 benchmark pendiente, GAP-03 coverage y Dependabot pendiente, GAP-04 testigo B3, GAP-05 live headers observados parcialmente + nuevo E2E, GAP-06 edad D-021 exact 34/35/41 keep en CSV/XLSX y DOB band, GAP-07 sin persistencia silenciosa, H-01 y UX-013/H-37 no reclasificar por PR cerrado, GOV-002 matriz stale (API actual sí protege), DISC-02 diagnostics Safe pendientes. G-HP1–10: matriz de tests actuales y huecos no falsificados. Gate español real: `npm run check:privacy-eval` + `npm run check:privacy-eval:v4`; no sustituir por recuento de E2E. No afirmar porcentajes si no se ejecutaron.
