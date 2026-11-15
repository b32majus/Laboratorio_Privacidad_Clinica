# REC-12 · #92 · R1/F1 — Preparación de autoridad y criterios aceptados

**Estado: CRITERIOS APROBADOS POR SIL / DOCUMENTACIÓN PREPARADA / NO READY_TO_LAUNCH.**
Fecha 2026-11-14. GO humano: aprobar estos criterios y preparar la autoridad para el traslado seguro de R1. **No** GO de ejecución R1 ni de despliegue. Un segundo GO de 14/11 autoriza publicar solo la autoridad documental: KairOS integrado y Laboratorio por PR sin merge productivo.

## Situación verificada

- Canonical producto `3.0-main@b3ffdc66206feff1cde4cfbd47787b44c80b78c3`. CI post-merge run `43605902086` exit SUCCESS pero el log incluye **18 líneas** con firmas `invalid-processing-transition`/`Uncaught [JobModelError` (no 18 errores distintos). F1 no resuelto.
- El R1 local `665ad0299a462004b6fca675966f469314643ca3` recoge 4 commits de trabajo `724cb2c`, `04fc01e`, `ea4f355`, `665ad02`. Dos correctores normales (2/2 consumidos) más la corrección final de un solo uso en el último commit. **El viejo permiso excepcional no se reutiliza**: su acta original procede de Atenea `d60db5e`, históricamente local y no publicado. La disposición actual de consumo del permiso se integró en KairOS mediante PR #161; no afirmar ratificación efectiva ni lanzamiento histórico regularizado retroactivamente.
- El código actual y `665ad02` difieren en `useJobSession.ts` unas 312 líneas; el parche de solo 4 líneas no aplica. Hay diferencias en tests, por lo que copiar todo el fichero o hacer cherry-pick sin análisis está prohibido. La composición del producto actual manda.
- KairOS `main@e327136e7b3b87be6d1f2453e685dfec27dad7d9` conserva presupuesto C-087 de dos correctores. La disposición documental actual (`atenea/AGENTS.md` y `docs/exceptions/LAB92_R1_HISTORIC_EXCEPTION_AND_TRANSFER_20261114.md`) fue integrada por [PR #161](https://github.com/b32majus/KairOS_Protocol/pull/161). Ya es autoridad canónica en KairOS, **pero este documento del Laboratorio no será canónico hasta su propio merge autorizado**.
- R2 `9d770755` es otra unidad separada, test-only; no incorporarlo con R1.

## Contrato funcional ratificado por Sil (7 criterios)

1. Un motor asíncrono que termina antes del commit React **produce un éxito legítimo**, sin `invalid-processing-transition` ni `Uncaught` en consola/stderr; éxito observable, no solo `exit 0`.
2. Un motor que falla temprano **deja el fallo tipado original** y jamás instala ReviewSession falsa ni exportables preparados.
3. Reset, Job reemplazado o policy cambiada mientras existe await **descarta el resultado stale** sin alterar los nuevos datos ni autorizar exportaciones.
4. Un begin diferido no puede degradar un `succeeded` ya instalado a `running`; dos intentos simultáneos no duplican la sesión y retry tras fallo es posible cuando la UI refleja el fallo.
5. No se alteran semántica clínica, transiciones puras de `domain/job.ts`, políticas, engine, batch, structured, Safe/Confidential, red ni datos reales para lograr verde. Solo fixtures sintéticos.
6. Oráculo focal contra producto actual con **ausencia explícita de `Uncaught invalid-processing-transition`**, test de error rápido, stale/authority, interleaving y pruebas relevantes bajo el Node usado por CI. Typecheck, lint, Prettier y E2E afectado sin retries y fixture no-network.
7. R2 espera que ambas filas PDF lleguen de veras a `Error` antes de estado final; no elimina aserciones, no introduce `waitForTimeout` ni aumenta timeout arbitrariamente; su implementación y publicación serán independientes de R1.

## Puerta de ejecución (NO concedida aún)

- **No declarar la excepción histórica disponible.** En el traslado no hay nuevos «correctores #3» ni un presupuesto reiniciado. Cualquier adaptación sustantiva nueva que el candidato `665ad02` no soporte → HUMAN STOP para nuevo alcance aprobado, no parche improvisado.
- Primera etapa: **KairOS completada** en PR #161. Laboratorio: autorizado publicar esta propuesta en un PR documental; queda pendiente merge en `3.0-main` porque dispara Render y GitHub Pages, despliegues no incluidos en este GO.
- Segunda etapa: elegir un protocolo **solo para el tramo de código** (DIA M/sensible atendido si el contrato y el port son acotados; Metis si el port resulta grande/de riesgo), establecer `launch SHA` limpio desde `3.0-main`, hacer preflight de compatibilidad, y obtener **GO humano de lanzamiento distinto del GO de preparación**. Sin manipular sesiones Herdr existentes.
- Tercera etapa: prueba adversarial RED sobre base real, candidato compuesto mínimo y único, auditoría independiente de los cambios que efectivamente se realicen con segundo revisor para M/sensible; la historia 2026 no sustituye esa auditoría, ni autoriza publicación.
- Publicación de producto requiere PR y checks obligatorios (`validate`, `e2e`, CodeQL, Gitleaks) verdes; merge y posibles despliegues Render/Pages necesitan permiso humano propio. #92/#93 abiertos.

**No se han ejecutado nuevos correctores ni cambiado producto en esta preparación.**
