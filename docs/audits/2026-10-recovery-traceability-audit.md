# Auditoría de trazabilidad de recuperación — 2026-10-04

> Estado: **AUDITORÍA MAESTRA DE RECUPERACIÓN — read-only sobre producto; documentación local aún no publicada**
> Producto original auditado: `3.0-main@331bcaf4a624659c77823a0c4b427d46347ea104`
> Freeze pre-refactor: `e164ca2`
> V4 actual auditada: `3.0-main@6fb5eb1fb867e022acc68dd2be39b16bd531f27a`
> Matriz exhaustiva: `docs/audits/2026-10-recovery-traceability-matrix.md`
> Plan derivado: `docs/RECOVERY_MASTER_PLAN_2026-10.md`

## 1. Pregunta de auditoría

La pregunta no es si T01–T25 terminó ni si la V4 tiene tests verdes. La pregunta es:

> **¿La V4 conserva, corrige o mejora el producto que teníamos y el producto objetivo que definieron las auditorías pre-refactor, o se perdió contrato de producto al traducir auditoría → specs → Work Orders → pruebas de paridad?**

La respuesta es: **se conservó y mejoró una gran parte de la plataforma técnica, pero la definición de paridad se estrechó y permitió retirar la v3 antes de recuperar completamente producto, idioma, formatos, ciertas semánticas estructuradas y la identidad visual objetivo.**

Esto no justifica volver a v3. Justifica recuperar el contrato perdido sobre la plataforma V4.

## 2. Genealogía reconstruida

El repositorio conserva una cadena clara de decisiones el 20 de septiembre de 2026:

1. `842bd38` — auditoría integral de privacidad, funcionalidad, arquitectura, código y calidad;
2. `8be557a` — registro de deuda;
3. `8e1126e` — roadmap pre-refactor;
4. `f3b2a04` — auditoría UX/UI y modelo de producto;
5. `8a841e1` — arquitectura objetivo;
6. integración de auditorías/roadmap;
7. `e164ca2` — **freeze pre-refactor audits, debt and roadmap**.

Ese freeze contenía **88** entradas de deuda/hallazgo: 9 P0, 56 P1, 10 P2 y 13 P3.

La auditoría integral afirmaba explícitamente que el núcleo modular era aprovechable y **no requería una reescritura desde cero**. Entre las fortalezas a preservar figuraban el motor `js/core`, local-first, diccionarios/heurísticas deterministas, revisión humana y el módulo estructurado CSV/Excel.

La auditoría UX definía el destino como una sola aplicación/workspace y, además, daba una dirección visual y de producto concreta. Su decisión final incluía literalmente:

> “Rediseñar primero las pantallas objetivo y después comenzar la migración.”

## 3. Qué debía corregirse, no perderse

La v3 tenía defectos graves que justificaban la migración:

- lo revisado podía no coincidir con lo copiado/exportado;
- PDF/batch podían mezclar originales con artefactos llamados anonimizados;
- batch podía afirmar revisión humana inexistente;
- AGE no existía en texto libre;
- fechas de significado distinto podían colapsarse a “visitas”;
- review dependía de DOM/datasets/storage;
- `.doc` se anunciaba sin parser real;
- scan PDF podía producir vacío sin señal suficiente;
- PHI aparecía en logs;
- batch podía ocultar fallos y desbordar sessionStorage;
- consistency dependía de monkey patch;
- structured tenía `UNKNOWN → KEEP`, doble patient-ID authority, CSV débil, inferencia por primera fila, fechas/edades defectuosas y primera hoja Excel;
- faltaban corpus/metrics/E2E/calidad estática/gobernanza de supply chain.

La mayoría de estas correcciones sí están materialmente mejor en V4 y **no deben deshacerse**.

Pero la v3 también tenía capacidades útiles que no eran el bug:

- aplicación clínica en español;
- ejemplos precargados;
- botón Pegar;
- revisión visual con acciones explícitas;
- Copiar Texto;
- PDF de informe;
- batch con estado/progreso y formatos de salida;
- structured CSV/XLSX con Study ID, visitas y correspondencia;
- identidad visual Sophilux/stone/rose;
- ergonomía de una herramienta ya reconocible como producto.

La migración debía sustituir las implementaciones inseguras sin eliminar la capacidad útil.

## 4. Dónde se estrechó el contrato

### 4.1 Auditoría → roadmap: todavía coherente

El roadmap original mantenía una Fase 0.5 de **Product shell and migration scaffold** que exigía:

- app shell SPA;
- design tokens operativos accesibles;
- Job model + flujo;
- adapter al engine existente;
- Worker boundary;
- preview deployment;
- smoke de hosting;
- **mantener legacy disponible hasta alcanzar paridad E2E**.

La auditoría UX había definido esa app como una **clinical privacy workstation**, no como un microsite, y pedía conservar calidez, stone, personalidad Sophilux y rose-gold como firma.

### 4.2 Roadmap → specs: primera pérdida de precisión

`SPEC_V4_APP_AND_REVIEW.md` conserva bien el flujo, ReviewSession, Privacy Gate, responsive y accesibilidad. Sin embargo:

- la dirección visual rica del audit queda reducida a requisitos genéricos;
- Safe Output pasa a decir que **“may support TXT/DOCX/PDF/XLSX depending on job type”**;
- la paridad de migración se formula como deterministic/E2E parity sin una matriz feature-by-feature de idioma, formatos, branding y affordances.

Ese “may” convirtió capacidades concretas ya existentes o explícitamente objetivo en opcionales.

### 4.3 Specs → Work Orders: segunda pérdida de precisión

Ejemplos verificables:

- T04 absorbía `UX-005 — único sistema visual`, pero su aceptación comprobaba shell/Job/top bar/responsive, no identidad visual;
- T07 absorbía UX de teclado, pero no fijó el vocabulario de shortcuts de la auditoría;
- T08 ordenó explícitamente **no ampliar el ticket a full legacy exporter parity for every file format**;
- T25 permitía retirar legacy tras CI/E2E y ausencia de dependencias de las rutas antiguas, sin una matriz de paridad de producto.

### 4.4 T25: “paridad” terminó significando reemplazo de flujo

La evidencia de retirada A1–A5 demuestra que existían reemplazos V4 para Review, Batch, Structured e Input. Eso es válido.

Pero A3 reconoce literalmente que el módulo jsPDF legacy se retiró y que **“no PDF generation exists in the V4 clinical origin”**. Pese a ello, el bloque se consideró evidencia de paridad.

Éste es el punto donde la palabra **paridad** dejó de significar “el producto conserva la capacidad” y pasó a significar “existe un workflow V4 que ocupa su lugar”.

## 5. Qué trabajo V4 es patrimonio y debe conservarse

La auditoría actual no soporta una vuelta a v3. Deben preservarse como base:

- ReviewSession/ReviewDecision como autoridad;
- composición final desde source offsets, no DOM;
- RegistryEngine, RecognizerRegistry y OperatorRegistry;
- motor/diccionarios españoles originales como base, no reescritos por cambiar de framework;
- AGE y semántica explícita de fechas;
- ProcessingContext para pseudónimos/fechas cross-document;
- pseudónimos de paciente deterministas y sin inferencia de género;
- low-confidence queue;
- Safe Output / Confidential Audit separados;
- Privacy Gate factual;
- fail-closed para review incompleto, oversized input, extracción y structured Unknown;
- parser/normalización Excel mejorados, selección de hoja y profiling multi-muestra;
- Web Worker;
- local-only/no-network/CSP;
- Vite + TypeScript + React;
- responsive y accesibilidad V4;
- CI, CodeQL, vendor governance y suite determinista existente.

La recuperación debe construirse **encima** de esto.

## 6. Hallazgos principales de recuperación

### R-F1 — Idioma de producto perdido, motor español preservado

La UI V4 está predominantemente en inglés aunque `app-v4/index.html` declara `lang="es"`.

Esto es una regresión de producto, pero no implica que el motor se haya anglicanizado. El engine productivo carga los recognizers/diccionarios españoles preservados y el live Render fue probado con narrativa clínica sintética española compleja, detectando nombre, edad, DNI, NHC, teléfono, email, Cáceres, dirección, profesional, hospital, fecha, familiar y profesión.

**Veredicto:** localización perdida; engine español preservado. La garantía formal de calidad del engine sigue siendo insuficiente (R-F2).

### R-F2 — QA-001 cerró infraestructura, no calidad lingüística profunda

El corpus V4 declara la taxonomía completa, pero sus anotaciones efectivas son aproximadamente:

- EDAD: 16;
- IDENTIFICADOR: 4;
- NOMBRE: 1;
- FECHA: 1;
- UBICACION: 1;
- SOSPECHOSO: 1.

La propia config dice que el corpus es intencionadamente pequeño y que es un **regression gate, not a quality grade**.

**Veredicto:** excelente infraestructura de regresión, cierre demasiado amplio de la intención original de QA-001. Es obligatorio REC-01.

### R-F3 — Structured pierde `ID_ESTUDIO` y puede perder vínculo longitudinal en la salida

Éste es el hallazgo de mayor gravedad de producto encontrado en la reconciliación.

La v3 generaba:

- `ID_ESTUDIO` determinista dentro del job (`PAC_001…`);
- `Visita_Num` opcional;
- correspondencia original ↔ Study ID;
- métricas de pacientes/visitas.

La auditoría UX objetivo mostraba expresamente:

`NHC → Identifier → Replace with Study ID`.

La spec V4 aceptada exige en structured export:

> deterministic study IDs/mappings within the Job context.

La V4 actual, sin embargo, mapea `identifier → remove`. La columna patient-ID se usa como autoridad para el desplazamiento de fechas y después se elimina del Safe dataset. El Confidential artifact registra la retirada, no un Study ID sustituto.

**Impacto:** un dataset longitudinal puede conservar fechas desplazadas por paciente pero perder la clave no identificativa que permite unir las filas de ese mismo paciente.

**Veredicto:** regresión material / incumplimiento de spec. REC-03 prioritario.

### R-F4 — Structured class→action quedó semánticamente incompleto

La UX objetivo proponía ejemplos como:

- patient ID → Study ID;
- birth date → age band;
- center → pseudonymize;
- free text → process as text;
- unknown → review required.

La V4 actual usa un mapeo genérico:

- identifier → remove;
- quasi-identifier → generalize;
- sensitive → codify;
- insensitive → keep;
- unknown → review-required.

Además, `generalize` sin date role carece de operador productivo y bloquea export. No existe routing productivo de columna free-text al text engine.

**Veredicto:** la taxonomía está bien construida, la semántica productiva necesita reconciliación explícita. REC-03.

### R-F5 — Structured perdió auto-detección Excel/workbook de la fila real de cabeceras

La v3 escaneaba hasta las primeras 10 filas de Excel para detectar una fila de cabeceras plausible y saltar metadatos explicativos, una capacidad diseñada para exportaciones hospitalarias. La auditoría externa confirmó que **v3 CSV no tenía esta capacidad**: ya usaba la primera fila como cabecera, por lo que smart CSV header detection no es patrimonio de recuperación.

V4:

- CSV: primer record = headers;
- Excel: primera fila del rango = headers.

La selección de hoja, serial dates, nulls y profiling son mejores, pero esa capacidad concreta se perdió.

**Veredicto:** regresión funcional de ingestión. REC-04.

### R-F6 — Structured perdió XLSX de salida y correspondencia

V3: Safe/processed XLSX + correspondence XLSX.
V4: Safe CSV + Confidential TXT.

La separación semántica V4 es superior, pero los formatos de trabajo hospitalarios se degradaron.

**Veredicto:** recuperar XLSX sobre la arquitectura segura. REC-04.

### R-F7 — Single output perdió Copy y PDF

V3 tenía `Copiar Texto` e `Informe de Seudonimización` PDF. El PDF antiguo era inseguro porque podía contener mapping/originales.

V4 sólo ofrece Safe TXT + Confidential TXT para texto/documento.

**Veredicto:** no restaurar el PDF legacy; restaurar Copy/Safe PDF (y DOCX si se mantiene el target aceptado) derivados exclusivamente del canonical final state. REC-05.

### R-F8 — Batch es más correcto pero funcionalmente incompleto

V4 arregló lo difícil: fallos visibles, no fake review, per-document ReviewSession, shared context.

Faltan capacidades objetivo/producto:

- retry/remove/acknowledge explícitos en UI;
- consolidated Safe PDF;
- individual Safe outputs ZIP;
- summary CSV;
- batch-wide Confidential artifact.

El E2E actual incluso fija explícitamente que un batch completo **no tiene formato de salida aceptado**.

**Veredicto:** dos Work Orders separados: REC-06 workflow y REC-07 outputs.

### R-F9 — Text policies están a medio implementar

`external-ai` y `longitudinal-research` existen como conceptos y funcionan en structured. En text/document/document-batch son **known-but-unmapped** y aparecen como no disponibles.

Los operadores de date generalize/date shift ya existen; el producto no los selecciona para esos job kinds.

**Veredicto:** deuda semántica/producto real, no sólo copy. REC-02.

### R-F10 — UX de entrada perdió ergonomía pequeña pero útil

No se encuentran equivalentes productivos de:

- ejemplos Urgencias/Quirúrgico/Historia Clínica;
- botón explícito Pegar.

La inferencia de Job y los adapters V4 son mejores.

**Veredicto:** recuperar conveniencia sin tocar dominio. REC-08.

### R-F11 — App IA y shortcuts quedaron fuera del closeout

La auditoría/spec incluían New Job / Workspace / Policies / Help y shortcuts candidatos A/M/K/F + siguiente/anterior.

V4 tiene New Job, step navigation y policy guidance, pero no una IA dedicada Workspace/Policies/Help ni shortcuts de revisión.

**Veredicto:** target gap conocido, REC-09.

### R-F12 — Identidad visual: tokens preservados, contrato visual perdido

V4 **sí conserva**:

- `primary #b88a7f`;
- `primary-dark #966a60`;
- superficies cálidas;
- Inter y Cormorant locales;
- uso de rose/surface tokens en componentes.

Por tanto no es correcto decir que “se borró toda la estética”.

Lo que no sobrevivió fue el contrato de diseño de la auditoría: clinical privacy workstation, Sophilux, stone/rose, densidad profesional, semántica cromática y referencias visuales como acceptance. Tampoco se adoptó JetBrains Mono para datos técnicos.

El resultado puede usar tokens correctos y seguir sintiéndose como un scaffold funcional.

**Veredicto:** paridad visual parcial, REC-11.

### R-F13 — Gobierno/documentación siguen diciendo verdades distintas

El registro vivo contiene varias filas OPEN que ya están implementadas (por ejemplo New Privacy Job, policy guidance, persistent job/policy facts y Privacy Gate) y varias filas DONE cuyo cierre es más estrecho que la intención original (QA-001 es el ejemplo más claro).

Además:

- GitHub default branch sigue siendo `main`;
- remote HEAD sigue `main`;
- la autoridad clínica que usamos es `3.0-main`;
- GitHub API confirma que `3.0-main` **no está protegida**.

**Veredicto:** no usar `DEBT_REGISTER` actual como mapa de ejecución hasta REC-12.

## 7. Reconciliación de los 88 hallazgos

La matriz adjunta reconcilia **88/88** filas del freeze, sin contarlas a pelo por su estado documental actual.

Patrón general:

- gran parte de P0/P1 técnico está realmente resuelta o mejorada;
- varias entradas OPEN están obsoletas;
- varias entradas DONE son técnicamente ciertas pero no equivalen a una garantía de producto completa;
- los P3 de OCR/NER/FHIR/ARX/etc. siguen siendo futuro y no deben confundirse con recuperación;
- los gaps de producto más graves ni siquiera se veían bien contando el debt register, porque eran **capacidades existentes**, no “deuda”.

Por eso se añade una segunda matriz de **40 capacidades de producto/herencia/target**.

## 8. Qué significa esto respecto al trabajo de las últimas dos semanas

### Trabajo que NO hay que tirar

No hay evidencia para revertir:

- dominio ReviewSession;
- arquitectura registry/operator;
- hardening de input/structured;
- Worker;
- Safe/Audit split;
- low-confidence;
- Gate;
- local-only/security;
- test/CI base;
- responsive/accessibility;
- Render Static.

Ese trabajo constituye la plataforma sobre la que recuperar el producto.

### Trabajo que sí hay que considerar incompleto

No se puede seguir usando “T01–T25 completado” como sinónimo de “producto recuperado”.

T01–T25 completó una **migración técnica y de integridad**. No completó paridad total de:

- idioma;
- outputs;
- structured semantics/linkage;
- input ergonomics;
- batch deliverables;
- IA/productivity;
- visual identity.

## 9. Nuevo plan cerrado conocido

La matriz deriva **12 Work Orders conocidos**:

1. `REC-01 SPANISH-ENGINE-ASSURANCE-01`
2. `REC-02 TEXT-POLICY-COMPLETION-01`
3. `REC-03 STRUCTURED-SEMANTICS-RECOVERY-01`
4. `REC-04 STRUCTURED-IO-OUTPUT-PARITY-01`
5. `REC-05 SINGLE-OUTPUT-PARITY-01`
6. `REC-06 BATCH-WORKFLOW-PARITY-01`
7. `REC-07 BATCH-OUTPUT-PARITY-01`
8. `REC-08 INPUT-PRODUCTIVITY-PARITY-01`
9. `REC-09 APP-IA-REVIEW-PRODUCTIVITY-01`
10. `REC-10 SPANISH-LOCALIZATION-01`
11. `REC-11 VISUAL-SYSTEM-RECOVERY-01`
12. `REC-12 RECOVERY-CLOSEOUT-01`

El detalle, dependencias y aceptación están en `docs/RECOVERY_MASTER_PLAN_2026-10.md`.

## 10. Orden de prioridad

El orden no debe ser “lo más visible primero”.

Prioridad recomendada:

1. **REC-01**: probar que el motor español merece confianza;
2. **REC-02 / REC-03**: cerrar semántica de policy y structured, especialmente Study ID;
3. **REC-04 / REC-05 / REC-06 / REC-07**: recuperar capacidades productivas y formatos;
4. **REC-08 / REC-09**: ergonomía e IA;
5. **REC-10**: traducir superficies ya estabilizadas;
6. **REC-11**: cerrar identidad visual sobre superficies finales;
7. **REC-12**: demostrar paridad real y reparar debt/docs/governance.

Esto reduce retrabajo: no traducir ni pulir visualmente una pantalla que luego cambia por recuperar semántica/producto.

## 11. Nueva Definition of Recovery

A partir de esta auditoría, **Recovery Complete** significa:

- las 88 filas del freeze están reconciliadas por evidencia;
- las 40 filas de producto/herencia/target están reconciliadas por evidencia;
- cada capacidad está PRESERVED, RESOLVED, IMPROVED o DELIBERATELY SUPERSEDED;
- ningún formato/acción/idioma/identidad visual desaparece silenciosamente bajo la etiqueta “workflow parity”;
- los outputs seguros derivan de las autoridades V4;
- el benchmark español es un quality gate serio, no sólo un smoke/regression corpus;
- el live Render coincide con esa matriz;
- roadmap, debt register, specs, default/canonical branch y CI cuentan la misma verdad.

Sólo entonces la recuperación de la aplicación está cerrada.

## 12. External adversarial reconciliation — Sol 6.1 (2026-10-04)

A read-only independent adversarial audit was executed against documentation candidate `35d3ae8fc15486bae66d90b00da7a2ccce85fdd3`, the original v3 fixed point and the current V4 code. Full evidence is preserved in `docs/audits/2026-10-recovery-plan-external-adversarial-audit-sol61.md`. Verdict: **PASS WITH REQUIRED CHANGES**.

The external audit did **not** require a new architecture, a REC-13, or a replan. It independently verified the material engine/Study-ID/output/policy/visual findings and kept all 12 Recovery Work Orders. It found three source-contract gaps in the translation layer and two dependency corrections:

- frozen UX-10 direct-identifier `Keep original` confirmation/explanation → added as H-41 and REC-09 acceptance;
- frozen Export additional confirmation for identifiable Confidential Audit → added as H-42 and REC-04/05/07 acceptance;
- frozen input inference “allow override when necessary” → UX-003 reopened as PARTIAL and REC-08 must implement bounded override or explicitly supersede it (D-019);
- REC-03 free-text routing now depends on REC-02 final text-policy mappings;
- REC-07 now depends on REC-05 safe single-output primitives **and** REC-06 batch workflow;
- H-21 heritage corrected to Excel/workbook smart-header detection only; v3 CSV used first-row headers.

Most importantly, REC-12 no longer treats a fixed row count as a completeness proof. Closeout begins with **source→matrix completeness** against both frozen audits and material v3 heritage; only then may matrix→implementation verification close recovery.
