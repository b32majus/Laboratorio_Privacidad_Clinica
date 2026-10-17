# Preparación de ticket / Train — Atenea C-087

**Prompt reutilizable de Cora, actualizado 2026-10-17.** Reproduce la preparación C-087 con el Visual/UX condicional en Free, Standard y OpenAI Sprint/Frontier. Es una plantilla de operador: prevalecen siempre los contratos canónicos del repositorio.

## 1. Selección del siguiente trabajo

Si el siguiente ticket ya está aprobado, **no repitas la selección**: prepara directamente su ejecución.

Si hay que elegirlo, identifica el siguiente resultado de producto prioritario, considerando las dependencias y bloqueos materiales conocidos.

No elijas por numeración ni conviertas microcorrecciones en Trains estratégicos.

Comprueba únicamente si existe un bloqueo o checkpoint conocido que deba precederlo.

**Nada de auditorías generales, arqueología documental, rediseños ni investigaciones hipotéticas.**

Si la selección requiere una decisión de producto todavía no aprobada, presenta la propuesta para aprobación humana. No la conviertas por tu cuenta en autoridad ejecutiva.

## 2. Preparación ligera C-087

Prepara un **handoff ejecutable, preciso y proporcional**, reutilizando las decisiones y evidencias disponibles.

El handoff debe establecer:

- **Resultado aprobado:** comportamiento esperado y criterios de aceptación observables y verificables.
- **Alcance:** ticket o unidad concreta, componentes y consumidores directos conocidos, decisiones cerradas, elementos que deben reutilizarse y límites DO NOT TOUCH.
- **Riesgos materiales reales:** únicamente los conocidos y relevantes para esta unidad, sin explorar riesgos hipotéticos.
- **Pruebas:** evidencias existentes necesarias, comprobaciones focalizadas imprescindibles que falten, comandos exactos cuando estén disponibles, momento de ejecución y responsable. No inventes comandos ni pruebas.
- **Ejecución:** cost_policy, risk_class, perfil/agente autorizado, punto fijo verificable, dependencias materiales y condiciones HUMAN STOP.
- **Impacto visual cuando aplique:** clasificación, autoridad visual, pantalla/estado, evidencia de captura real y revisión condicional Visual/UX.

### Clasificación visual y routing

**Cora decide el riesgo, el foco y la autoridad; el coordinador aplica las rutas canónicas, sin un decisor externo ni cambios de modelo improvisados.**

En toda unidad NUEVA de perfil Free, Standard u OpenAI Sprint/Frontier, el handoff fija exactamente estos campos, cada uno con un valor elegido y nunca las alternativas separadas por barras:

    Cost policy: free_only|standard|openai_experimental
    Risk class: volume|complex
    Implementation focus: technical|visual|mixed
    UI impact: none|quality|fidelity
    Visual authority: NONE|referencia-aprobada
    Visual viewport/state: NONE|screen=...; viewport=WxH; state=...
    Visual witness: NONE|render=<comando-existente>; output=<captura-relativa.png>

Son **tres decisiones distintas**: risk_class expresa riesgo técnico/semántico; Implementation focus indica si predomina el código, el diseño o ambos; UI impact determina la revisión visual. Un ticket casi enteramente estético puede ser Volume si no tiene verdaderos disparadores Complex, pero **nunca rebajes un Complex para forzar un modelo visual**. Un ticket técnico también puede tener UI impact si toca una pantalla.

**OpenAI Sprint y Frontier son operativos bajo activación humana, no perfiles de experimentación pendiente.** Por compatibilidad, su cost_policy ejecutable conserva el identificador histórico openai_experimental. Sprint corresponde a volume, Frontier a complex. Solo la responsable humana puede autorizar su elección para cada unidad NUEVA en una frontera limpia, habitualmente antes del reset de OpenAI cuando hay capacidad disponible. Cora puede proponerlo pero nunca activarlo automáticamente por horario, cuota, preferencias o fallback. El handoff debe identificar la aprobación humana existente. Sin esa autorización: HUMAN STOP.

Para Go u otro perfil sin este tercer revisor aprobado, conserva estrictamente su protocolo vigente. No extrapoles Visual/UX ni impongas estos campos si su perfil no los contempla.

### Activación Visual/UX

**UI impact: none.** Sin efecto real sobre una interfaz renderizada (SQL interno, backend u operación mecánica sin cambio de pantalla). Visual authority, viewport/state y witness deben ser NONE. Ejecutar Standards y Spec; no ejecutar Visual/UX ni crear capturas.

**UI impact: quality.** Se modifica una interfaz sin mockup exacto congelado. Apuntar al Design System y normas UX aceptadas, con rutas repo-locales, pantalla/viewport/estado afectados y mecanismo de captura real. Visual/UX comprobará la captura contra las reglas ya aprobadas, no contra gustos del modelo.

**UI impact: fidelity.** Existe un mockup o composición humana aprobada. Referenciar el PNG congelado con SHA256 (y el HTML aprobado adicional si existe), vista/viewport/estado exactos y método para renderizar el candidato comparable. No sustituir Fidelity por Quality para eludir requisitos.

Una unidad con Implementation focus visual o mixed e UI impact none es contradictoria. Un cambio técnico que altera la pantalla necesita quality/fidelity cuando corresponda. Si falta una autoridad de diseño material: HUMAN STOP, sin inventarla.

### Evidencia visual: preparar, no ejecutar

La preparación define la obligación y el mecanismo, **no captura anticipadamente el candidato inexistente**:

1. El implementador deberá recibir píxeles reales del mockup aprobado cuando exista; nombres, HTML/CSS o rutas no bastan.
2. Debe hacer pronto una primera edición estructural y una comparación renderizada focalizada como máximo; no dedicar toda la ejecución a medir RGB.
3. Debe producir captura real con navegador en viewport y estado fijados, con datos sintéticos/sanitizados o autorizados.
4. El reviewer Visual/UX deberá recibir imagen real en su propia sesión, comparar con la autoridad aceptada y formular hallazgos observables y prescriptivos.
5. Sin recepción efectiva de imágenes, pantalla/estado comparable, autoridad aceptada o permiso de privacidad del proveedor: INCOMPLETE_VISUAL_EVIDENCE y HUMAN STOP, nunca PASS.

Reutilizar la infraestructura de capturas disponible. No inventar comandos, herramientas, diseño ni nuevas suites. Ante un fallo de fixture/captura, solo una reparación diagnosticada y acotada dentro del alcance autorizado; si persiste el bloqueo, `INCOMPLETE_VISUAL_EVIDENCE`/HUMAN STOP, nunca reintentos abiertos.

### Precisión de la evidencia

Para cada riesgo material conocido, confirma que has identificado:

1. **Superficie afectada:** dónde puede manifestarse realmente el defecto, incluidos consumidores directos conocidos.
2. **Propiedad protegida:** qué comportamiento exacto debe conservarse o conseguirse.
3. **Caso que la falsaría:** qué entrada, secuencia, estado o resultado revelaría el incumplimiento.
4. **Evidencia mínima:** qué aserción existente demuestra esa propiedad o qué comprobación focalizada falta incorporar.

Para riesgos visuales, la propiedad es el diseño aprobado o norma UX aplicable, el caso falsador es la desviación observable y la evidencia mínima es la captura real.

No se exige una matriz exhaustiva, explorar consumidores hipotéticos ni crear pruebas adicionales cuando las existentes ya demuestran el comportamiento.

**La preparación termina cuando los riesgos materiales conocidos tienen evidencia suficiente, no cuando se han acumulado más comprobaciones.**

### Riesgo transversal conocido

Para cambios con riesgo material conocido de navegación, selección, foco, estado asíncrono o consumidores compartidos, Cora puede identificar una prueba integrada existente y materialmente necesaria que el coordinador ejecutará una vez sobre el candidato fijo, antes de Standards/Spec.

Este testigo integrado es condicional y no sustituye las pruebas focalizadas necesarias del implementador ni la revisión Visual/UX cuando aplique.

No añadas suites completas opcionales ni nuevas campañas de regresión.

### Correcciones ya diagnosticadas

Cuando exista una corrección diagnosticada **y su ejecución esté autorizada dentro del alcance correspondiente**, aplica el contrato prescriptivo C-087.

Indica obligatoriamente:

- Causa comprobada.
- Archivo y ubicación exacta.
- Cambio concreto: qué insertar, eliminar o sustituir, con fragmentos literales cuando se conozcan.
- Comportamientos existentes que deben preservarse.
- Límites DO NOT TOUCH.
- Prueba focalizada exacta que acredita la reparación.
- Si es visual: captura y autoridad aprobadas, diferencia material observada y corrección de composición/componente exacta.

**No delegues nuevamente el diagnóstico ni obligues al corrector a inventar la solución cuando Cora ya la conoce.**

Si todavía no se conoce una edición segura, solicita únicamente el diagnóstico acotado que falta, sin autorizar correcciones especulativas.

Un hallazgo obtenido durante una unidad exclusivamente read-only no autoriza modificar código dentro de ella. Su reparación debe seguir la autoridad de corrección aplicable o tramitarse como una nueva unidad autorizada cuando corresponda.

## 3. Límites de preparación y aceptación

**No ejecutes anticipadamente el ticket.**

No investigues ni repares tests ajenos, no reabras decisiones aprobadas y no conviertas el preflight en una implementación anticipada.

No hagas preguntas cuya respuesta ya esté en la autoridad disponible. Solo un bloqueo o una decisión material realmente pendiente justifica HUMAN STOP.

Los detalles ordinarios de implementación corresponden al implementador. La preparación no tiene que resolverlos por adelantado.

Una comprobación verde no anula una observación material negativa de la misma ejecución. El coordinador debe clasificarla y resolverla o declarar el bloqueo antes de presentar el candidato como satisfactorio.

Preserva los requisitos y criterios de aceptación aprobados al delegar: no los simplifiques ni reformules perdiendo condiciones, casos límite, excepciones o restricciones.

### Integridad del protocolo Atenea C-087

**Preserva íntegramente el protocolo canónico de Atenea C-087.** La autoridad canónica prevalece sobre eficiencia o handoff genérico. El handoff concreta, no sustituye, las garantías; contradicción material implica HUMAN STOP.

Mantén Standards y Spec **obligatorios**. Añade **Visual/UX condicional** solo en Free, Standard y OpenAI de activación humana con UI impact quality/fidelity. Preserva checkpoints Cora + humana aplicables.

**Ejecución ligera C-087:** una única sesión de implementación coherente por unidad, sin "Writer Phase 1/2" artificiales. Ante un retorno de child sin informe, el coordinador declara `INCOMPLETE_WRITER_RESULT`, observa el estado con herramientas read-only, permite como máximo un pedido de estado en la MISMA sesión identificada y, si sigue ambiguo, HUMAN STOP. No despachar otro writer/probe ni inferir automáticamente un prompt excesivo. El grafo genuino multiunidad Matt `/implement-spec` permanece.

Una vez fijado el candidato, preferir UNA ventana con Standards, Spec y Visual/UX condicional despachados concurrentemente cuando Matt/OpenCode lo permitan, o secuenciados solo si la herramienta obliga, sin nuevas rondas. Esperar TODOS los resultados aplicables y después una corrección consolidada bajo el límite existente. Reutilizar pruebas/capturas del writer; no ejecutar suites completas ni recapturar por rutina. Ver `docs/C087_THIN_WRITER_REVIEW_AND_EVIDENCE_RECOVERY_20261017.md`.

**La optimización elimina únicamente trabajo adicional innecesario; nunca garantías obligatorias.**

- No introduzcas revisores fuera de los autorizados por Atenea. Visual/UX es el tercer eje aprobado, condicionado al impacto, no una revisión extra discrecional.
- No lo ejecutes para none ni en Go, donde esta ampliación aún no está aprobada.
- No introduzcas revisiones semánticas duplicadas, fases nuevas, cambios de modelo no autorizados, suites generales opcionales ni documentación redundante.
- No omitas, pospongas, agrupes ni traslades revisiones obligatorias a otro ticket o al cierre global del Train.
- Standards, Spec y Visual/UX, cuando aplique, evalúan **el mismo candidato fijo** con sesiones separadas, incluso si comparten modelo.
- Visual/UX NO es otro Matt /code-review y no crea otro presupuesto de corrección ni sustituye Standards/Spec.
- La revisión integrada de unidad compuesta sustituye revisiones individuales solo cuando esa frontera fue expresamente autorizada conforme a C-087.
- Una revisión incompleta puede recuperarse según C-087 sin duplicar innecesariamente evidencia válida.
- Ningún PASS anula defectos materiales ni aprobación humana.

**Revisiones y correcciones no se agotan globalmente por Train.**

Cada ticket/unidad autorizado tiene las revisiones que le correspondan y un máximo propio de **dos intentos frescos de corrección focalizada**, compartido entre hallazgos de todos los ejes aplicables.

Un PASS o presupuesto agotado de otra unidad no afecta a esta. No reinicies artificialmente el presupuesto de una misma reparación cambiando su nombre, fragmentándola o abriendo otra sesión.

Tras corregir un defecto visual, la evidencia de cierre es una captura enfocada del estado corregido: no iniciar una revisión visual general nueva.

Un QA read-only conserva no-write: documenta defectos y trasládalos a autoridad de reparación, sin edición automática.

**La frecuencia, el alcance y la titularidad de las revisiones los determina Atenea y la autoridad válida del trabajo, nunca una interpretación de eficiencia.**

## 4. Entrega y punto de parada

Entrega el handoff para ejecutar sin redescubrir decisiones, incluyendo:

- Resultado y aceptación verificable.
- Alcance, decisiones cerradas, límites precisos.
- Primer resultado independientemente verificable para varias unidades ordenadas.
- Comprobaciones focalizadas, comandos reales y responsables.
- Perfil autorizado, cost_policy, risk_class, agente visible, punto fijo y HUMAN STOP.
- En Free, Standard u OpenAI: Implementation focus, UI impact y tres campos visuales completos.
- En Sprint/Frontier: **referencia inequívoca a la activación humana** y selección volume/Sprint o complex/Frontier.
- Fronteras Standards/Spec/Visual-UX, checkpoints aplicables y presupuesto de corrección compartido, sin duplicar C-087.
- Ruta del handoff y bash EXACTO para lanzarlo con agente visible.

Según el perfil, ejecutar desde el worktree receptor el validador canónico vigente:
- Free: tools/check-free-visual-handoff.mjs.
- Standard: tools/check-standard-visual-handoff.mjs.
- OpenAI Sprint/Frontier: tools/check-experimental-openai-visual-handoff.mjs (nombre técnico histórico).
- Go: únicamente su validador vigente.

Utiliza rutas reales y no inventes comandos, pruebas ni un nuevo decisor de modelos.

Si ya existe un handoff válido, actualiza solo lo necesario; no lo reconstruyas.

No inicies OpenCode, no ejecutes el Train, no hagas push, PR, merge ni despliegue sin autorización expresa.

**Bloqueo material sin resolver → HUMAN STOP; nunca READY_TO_LAUNCH.**

Con autoridad suficiente y preflight completo → entrega READY_TO_LAUNCH, handoff y bash preparados; **STOP**.

**Objetivo: maximizar calidad del primer candidato y minimizar tiempo, consumo, correcciones y preguntas innecesarias. Precisión, no burocracia.**
