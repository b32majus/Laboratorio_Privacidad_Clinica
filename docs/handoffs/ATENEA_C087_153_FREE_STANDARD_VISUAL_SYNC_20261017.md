# Laboratorio · sincronización Atenea C-087 (#152 Free + #153 Standard) — unidad de mantenimiento aislada

**Estado: PREPARADO PARA LANZAMIENTO HUMANO. STOP después del candidato; NO se ha ejecutado la sincronización.** Autorización de la responsable: sincronizar agentes/routing y preparar el nuevo contrato Visual/UX para **las próximas unidades limpias**. NO lanzar tickets, Trains ni implementar interfaces como consecuencia de esta actualización. Cora prepara SHA, Bash y prompt; la responsable **lanza OpenCode desde Herdr**.

## 0. Contrato de ejecución cerrado

Cost policy: standard
Risk class: volume
Implementation focus: technical
UI impact: none
Visual authority: NONE
Visual viewport/state: NONE
Visual witness: NONE

Open material product questions: NONE.
Conditional safeguards: NONE (administrative/configuration-only, no rendered UI candidate).
Publication: local candidate + Standards/Spec as required by C-087 → Cora/human; **NO push, PR, merge or deployment**.
Atenea upstream exact: `b32majus/Atenea` `origin/main@13e07aaaedbeeb7d39d0c0a9d15ad03019423239` (PR #152, PR #153 merged and preflight verified 17/oct).
Laboratorio base exact: `b32majus/Laboratorio_Privacidad_Clinica` `origin/3.0-main@fa51dd904f34642d4fa945754eab17222d89e3bd`. **Launch SHA** is the prep/handoff commit atop that base, verified by Cora/operator at launch. Never use the checkout `main@b1c25e9`, an R1/R2/V0 worktree, or an unpinned Atenea branch as source of truth.
Coordinador visible: `atenea-volume` (MiMo 2.6 Flash NaN). Implementador fresco de esta unidad `atenea-implementer-volume` (DeepSeek alias `nan/deepseek-v4-flash` unchanged). Si el proyecto-local role routing/permissions no coincide con su autoridad en el lanzamiento, HUMAN STOP, no arrancar escritor.
No model auto-router, no fallback, no benchmark experimental, no change C-087/Matt.

## 1. Preflight factual ya contrastado (no repetir arqueología)

- Atenea `main` y remoto mismo SHA `13e07aaa...`; checkout limpio. OpenCode v2.0.32.
- En Laboratorio no se detectaron procesos `opencode run`/`opencode serve` activos en la inspección de 20:36, pero hay **worktrees históricos y candidatos**, que nunca se deben tocar. Al ejecutar, reconfirmar solo el estado de la nueva unidad.
- Candidatos protegidos: #92 R1 `665ad0299a462004b6fca675966f469314643ca3`, R2 `9d770755802f70632a7bc3ae848e71466911ca05`, V0 visual read-only `940dd7675a5ef8df90aba70e01f9cabc02fedf92` (evidencias locales `.atl/issue92-v0-evidence-20261017/`). Ninguno integrado por esta tarea. #90/#91 CLOSED; #92/#93 OPEN.
- Un sync anterior existe en `/srv/kairos-lab/qualification/laboratorio-atenea-c087-sync-20261012` y es histórico; **NO** reciclar su checkout/candidato.
- Agentes Standard actuales con modelos ya correctos: volume coordinator MiMo NaN, complex coordinator GLM 5.3 Flash High, implementadores DeepSeek alias y GLM, Standards GPT-6 Luna High, Spec Volume GPT-6 Luna High / Complex GPT-6.1 Sol High.
- Delta concreto al upstream: **10 agentes existentes con contenido distinto** + **4 agentes nuevos**. No hay agentes exclusivos de Laboratorio dentro de `.opencode/agents/` según inventario inicial. La diferencia de contenidos no prueba ausencia de personalizaciones intencionadas; verificar diff antes de reemplazar.

## 2. Fuente upstream — copiar solo archivos canónicos, no reconstruir modelos a mano

Leer del checkout exacto `/srv/kairos-lab/Atenea`: `docs/START_HERE.md`, `docs/CURRENT_DECISIONS.md`, `docs/ATENEA_EXECUTION_ROUTING_V0.md`, `docs/ATENEA_FREE_MODEL_CATALOG_V0.md`, `docs/ATENEA_FREE_PROFILE_V0.md`, `docs/ATENEA_FREE_VISUAL_UX_ROUTING_V1.md`, `docs/ATENEA_STANDARD_VISUAL_UX_ROUTING_V1.md`, `docs/EXECUTION_REQUEST_AND_PREFLIGHT_V1.md`, `docs/PRODUCT_FIDELITY_GATES_V1.md` y `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`; **no copiar encima** de los contratos funcionales o visuales de Laboratorio. Si el coordinador/implementador no puede leer upstream por restricciones de permisos, reportar `INCOMPLETE_AUTHORITY` sin reconstrucciones.

**Allowlist exacta de agentes locales (14 ficheros):**

Actualizaciones Standard desde `/srv/kairos-lab/Atenea/.opencode/agents/`:
- `atenea-volume.md`
- `atenea-complex.md`
- `atenea-implementer-volume.md`
- `atenea-implementer-complex.md`
- `atenea-review-visual-standard.md` (**NUEVO**, Luna High en sesión fresca, lectura de PNG real)

Actualizaciones Free desde la misma ruta:
- `atenea-free.md`
- `atenea-implementer-free.md` (Volume: Space Bunny)
- `atenea-implementer-free-complex.md` (**NUEVO**, GLM 5.3 Flash Free)
- `atenea-review-standards-free.md` (DeepSeek V4.1 Flash Free)
- `atenea-review-spec-free.md` (Volume: GLM 5.3 Flash Free)
- `atenea-review-spec-free-complex.md` (**NUEVO**, Space Bunny Free)
- `atenea-corrector-free-volume.md` (GLM 5.3 Flash Free)
- `atenea-corrector-free-complex.md` (DeepSeek V4.1 Flash Free)
- `atenea-review-visual-free.md` (**NUEVO**, Nemotron 3.5 Super VL Free)

**Para cada archivo:** examinar diff local→upstream; reemplazar por **bytes exactos upstream** solo si ninguna diferencia es una personalización legítima del producto; registrar SHA-256 y motivo. En caso de personalización productiva relevante que no pueda preservarse sin contradicción, HUMAN STOP con diff literal y propuesta, sin sobrescribir. No editar agentes fuera de allowlist (Go/OpenAI experimental/roles comunes no listados). Agentes con modelos ya correctos mantienen exactamente sus ids; alias DeepSeek `nan/deepseek-v4-flash` se conserva, aunque proveedor lo sirva como V4.1 Flash-1017. Muse Spark Free **desaparece de los bindings vigentes**; ninguna sustitución de pago silenciosa.

## 3. Adaptar el receptor sin crear un framework nuevo

Allowlist documental: `docs/ATENEA_EXECUTION_ROUTING_V0.md`, `docs/CHILD_AUTHORITY_CAPSULE_V1.md` y, solo si indispensable para navegación, `docs/START_HERE.md`. Se autoriza **un anexo de integración acotado**, por ejemplo `docs/ATENEA_VISUAL_UX_RECEPTOR_V1.md`, si ayuda a que las futuras unidades tengan autoridad legible sin depender de rutas fuera de su worktree. No reescribir `AGENTS.md`, `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`, `docs/PRODUCT_FIDELITY_GATES_V1.md` ni editar documentación del repositorio Atenea.

Documentar el contrato obligatorio de **7 campos** de handoff para próximas unidades Standard/Free, incluidos trabajos técnicos de UI `none/quality/fidelity` y las pruebas por viewport/state. Separar clasificación **Cora antes de lanzar** del despacho del coordinador; no reclasificación por modelo ni actualización de un Train activo. Los tres revisores Standards, Spec y Visual (cuando aplica) actúan en **sesiones frescas sobre el mismo SHA**. Visual no agrega un tercer presupuesto correctivo: el máximo general sigue en **dos intentos frescos compartidos**. `UI impact: none` ⇒ sin modelo Visual; `quality` ⇒ comparar captura real con reglas aprobadas de diseño/UX; `fidelity` ⇒ **PNG maestro congelado + captura real comparables**. Deben consumirse **píxeles de verdad** por el implementador y el revisor; lectura de JSX/CSS/ruta sola da `INCOMPLETE_VISUAL_EVIDENCE`, no PASS. Ninguna decisión de producto la inventa un agente. Respetar datos sintéticos y las restricciones de envío de imágenes a proveedor.

**Autoridad visual concreta de Laboratorio**, no rediseñar:
- Maestro congelado `docs/design/sophilux-b-v1/laboratorio-sophilux-b-v1.html` SHA256 `58cb8d414c0d842b6fd32bdbe5c9ccf4ad9d155b6317285dddf8b90ec7415774`.
- Contrato `docs/design/sophilux-b-v1/ACCEPTED_VISUAL_CONTRACT.md`, reconciliación `SOPHILUX_B_V1_FUNCTIONAL_RECONCILIATION.md` D1–D4/VF-01…VF-08, maestro PNG `previews/{entrada,revision,lote,estructurado,celdas,comprobacion,resultado}-{1440,375}.png` y `visual-evidence-manifest.json`.
- PRECAUCIÓN: capturas 375 de prototipo tienen ancho renderizado **413 px** por overflow conocido; la APP real a 375 no lo reprodujo en los 11 estados de V0. Fidelidad = composición aprobada + adaptación accesible sin overflow, **no** exigir reproducir el bug del HTML.
- Evidencia de screenshots reales ya ejecutada V0 en worktree separado (44 PNG; 18/18 flujos; 0 peticiones externas), con Entrada/Revisión `DRIFT_OPEN` y otras cinco familias con `ADAPT_APPROVED` condicionadas a estados verificados. NO tocar `.atl/` ni asumir aprobación humana. El próximo ticket visual bajo `fidelity` necesita viewport/estado/imagen aprobado específicos, no un único informe global.
- Los tickets #90/#91 están CLOSED y no se reabren; #92 continúa pendiente de cierre, #93 bloqueado. No iniciar V1/V2/V3 por sincronizar agentes, ni reinterpretar el contrato de siete composiciones como un stepper.

**Si hay conflicto o es necesario cambiar código productivo, pausa HUMAN STOP** y devuelve diff/autoridades a Cora/humana. Este sync no es una revisión visual del producto ni una nueva feature.

## 4. Validación mínima sin crear un Train

Antes y después de cambios: `git rev-parse HEAD`, rama, `git status --porcelain`, remote Atenea main fijo, diff con upstream y `git diff --check`. Evitar efectos sobre ramas/candidatos ajenos.

En checkout Atenea canónico, verificar las **seis pruebas oficiales** ya prescritas en el handoff upstream:
`node tools/check-vnext-authority.mjs`,
`node tools/check-opencode-routing-profiles.mjs`,
`node tools/check-opencode-review-transport.mjs`,
`node tools/check-atenea-reviewer-lifecycle.mjs`,
`node tools/test-free-visual-handoff.mjs`,
`node tools/test-standard-visual-handoff.mjs`.

Si Free se sincroniza: `node tools/check-free-models.mjs` y `node tools/check-free-models.mjs --visual`. Standard: comprobación vigente de disponibilidad/modelo autorizado, **sin invocar un experimento nuevo**. Desde worktree receptor, `opencode debug agents` (PTY si el comando no ofrece salida sin TTY): validar roles y permisos de ambas rutas. El checker `check-standard-visual-handoff.mjs` no acepta esquemas alternativos: este documento tiene `UI impact: none` y referencias `NONE`. Para próximos handoffs de tipo `fidelity`, usar SHA256 real de cada PNG, no hash del HTML o valor marcador. Para Free validar con `check-free-visual-handoff.mjs` usando un handoff Free real, no este Standard.

Si los tests upstream verdes pero faltan modelos/roles reales o media-transporte para un perfil, registrar `INCOMPLETE` de **ese** perfil, no inventar PASS o activar los visual reviewers. Los modelos de Free pueden desaparecer; no hacer fallback. Si fallo de una prueba oficial no es atribuible al cambio receptor, reportarlo y HUMAN STOP; no modificar Atenea.

**Commit:** un único commit de sincronización local con archivos en allowlist y sin source UI/código productivo, con parent exacto del handoff lanzado. No amend/rebase. Revisar Standards+Spec C-087 sobre el candidato cuando corresponda a los archivos de routing. No ejecutar un Visual reviewer para la sincronización: `UI impact: none`.

## 5. Entrega obligatoria y prohibiciones

**READY_FOR_CORA_ATENEA_153_SYNC_RECHECK**, con: repo/worktree/branch, launch SHA/parent/candidate SHA, upstream SHA, inventario exacto de agentes (antes/después hashes), diferenciales locales preservados, docs, pruebas, OpenCode debug resolved role models, rutas design/PNG y captura existente, futuras plantillas y activación en siguiente unidad, conflictos/STOP, status de R1/R2/V0/#90–93 y ausencia de intervención, estado commit/push/PR/merge.

**STOP al entregar.** No abrir otro ticket, no iniciar Visual V1, no cambiar códigos/escenarios E2E, no merge con #92, no PR/push/despliegue, no modificar worktrees activos, no limpiar sesiones ajenas, no actualizar Atenea. Un eventual GO de integración/documentación lo decide la responsable después del veredicto Cora.
