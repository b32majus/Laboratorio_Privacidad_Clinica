# Auditoría integral 2026-09 — Privacidad, funcionalidad, arquitectura, código y calidad

> Estado: auditoría pre-refactor.  
> Rama de referencia auditada: `3.0-main` (`331bcaf4a624659c77823a0c4b427d46347ea104`).  
> Objetivo: capturar la deuda completa antes de introducir cambios funcionales o de arquitectura.

## 1. Resumen ejecutivo

El proyecto tiene un núcleo de procesamiento modular aprovechable y no requiere una reescritura desde cero. La principal deuda está en la aplicación que envuelve ese núcleo: múltiples fuentes de verdad (DOM, `processingResult`, `sessionStorage`), lógica duplicada entre páginas y módulos legacy, exportaciones con semántica insegura, gobernanza de ramas/versiones ambigua y una suite de pruebas insuficiente para validar una herramienta de privacidad clínica.

La prioridad no debe ser añadir nuevas capacidades hasta cerrar primero la integridad del producto: lo revisado debe coincidir con lo exportado, las salidas compartibles no deben contener originales, la aplicación no debe afirmar técnicas que no implementa y el comportamiento ante incertidumbre debe ser fail-closed.

## 2. Fortalezas existentes que deben preservarse

- Motor modular en `js/core/` con detectores, managers, scoring, heurísticas y procesador central.
- Procesamiento local-first en navegador como principio de producto.
- `SafeRender` para escapar contenido clínico antes de construir highlights.
- Migración de datos sensibles desde `localStorage` a `sessionStorage` mediante `AppSession`.
- Botón global de borrado de sesión.
- Separación correcta, en el módulo estructurado, entre salida seudonimizada y tabla de correspondencia confidencial.
- CI existente con checks de enlaces, almacenamiento y smoke tests.
- Diccionarios locales y heurísticas deterministas auditables.
- Flujo de revisión humana ya planteado en UX, aunque su estado interno deba rediseñarse.
- Módulo estructurado CSV/Excel con análisis de columnas, validación longitudinal y exportador independiente.

## 3. Hallazgos P0 — integridad, privacidad y seguridad funcional

### P0-01 — Script de terceros en el mismo origen que la sesión clínica

`3.0-main/index.html` carga MailerLite desde `assets.mailerlite.com`. Al ejecutarse en el mismo origen que la aplicación, ese JavaScript tiene capacidad técnica para acceder al almacenamiento del origen, incluyendo `sessionStorage` cuando exista una sesión clínica abierta.

No se afirma que MailerLite exfiltre datos; el problema es que la arquitectura le concede esa capacidad.

**Corrección requerida**
- Separar marketing y aplicación clínica en orígenes distintos.
- Cero JavaScript/iframes/recursos de terceros en el origen clínico.
- CSP restrictiva.
- Check CI que falle ante cualquier dependencia de red no autorizada.

### P0-02 — PDFs denominados anonimizados contienen originales

`js/export/pdf-report.js`, `review.html` y `js/batch-exporter.js` incluyen tablas `Original → Transformado`. En batch, incluso los PDFs individuales con nombres de tipo `*_anonimizado.pdf` pueden contener los identificadores originales.

**Corrección requerida**
Separar físicamente:
1. **SAFE OUTPUT**: únicamente texto/datos finales revisados, sin original, mapeo ni notas internas.
2. **CONFIDENTIAL AUDIT / TRACE**: correspondencias, decisiones, originales y trazabilidad, claramente marcado como confidencial.

### P0-03 — La revisión visual no coincide con el texto copiado/exportado

`review.html` y `js/shared/review-ui.js` permiten modificar/restaurar/añadir entidades, pero el botón Copiar usa `processingResult.processed`, generado antes de la revisión.

Por tanto, la pantalla puede mostrar una versión revisada y exportar/copiar otra.

**Corrección requerida**
- Introducir `ReviewSession` como fuente de verdad.
- Derivar siempre `finalText` desde `originalText + detections + reviewDecisions`.
- Todos los exportadores deben consumir exclusivamente `finalText`.

### P0-04 — Batch puede afirmar revisión humana no realizada

`saveCurrentDocState()` marca `reviewed = true` al cambiar de documento o exportar, sin comprobar decisiones sobre entidades. El PDF consolidado afirma "Revisión humana de cada documento".

**Corrección requerida**
- Estados explícitos: `PENDING / IN_REVIEW / COMPLETED`.
- `COMPLETED` solo si todas las decisiones obligatorias están resueltas.
- Bloqueo de exportación segura si quedan decisiones pendientes.
- Eliminar lenguaje de certificación no verificable.

### P0-05 — La edad no se anonimiza en texto libre

`detectFechas()` no detecta edades. Frases como `45 años` pueden permanecer intactas aunque la guía y los PDFs declaren que se detectan/generalizan edades.

**Corrección requerida**
Nuevo recognizer `AGE` para:
- edad explícita;
- edad contextual;
- pediátrica (meses/semanas);
- edades extremas;
- rangos.

Operadores de generalización configurables.

### P0-06 — El producto declara k-anonimato y privacidad diferencial sin implementarlos

`review.html` usa "Generalización (K-anonimato)" y `funcionamiento.html` explica "Privacidad Diferencial", pero no existen equivalence classes, k, l-diversity, t-closeness, epsilon/delta ni mecanismos de ruido.

**Corrección requerida**
Eliminar estos claims hasta que exista implementación real. Describir exactamente las técnicas presentes: detección, supresión, sustitución, seudonimización, generalización y/o date shifting.

### P0-07 — Truncado silencioso de textos >1 MB

`Processor.process()` trunca a 1.000.000 de caracteres con `console.warn`, pudiendo dejar identificadores sin analizar en la cola del documento.

**Corrección requerida**
Fail closed: bloquear y pedir dividir el documento o procesar por chunks explícitos. Nunca devolver una salida aparentemente completa a partir de un original truncado.

## 4. Hallazgos P1 — funcionalidad y fiabilidad

### P1-01 — Fechas semánticamente distintas se convierten en "visitas"

`preprocessFechas()` agrupa fechas sin distinguir nacimiento, consulta, ingreso, alta o cita futura. Puede destruir significado clínico.

**Mejora**
Políticas de fecha:
- `GENERALIZE`
- `SHIFT_CONSISTENT`
- `REDACT`

Preferir date shifting consistente cuando se necesite preservar intervalos longitudinales.

### P1-02 — Estado de revisión distribuido entre DOM, objetos y storage

Hoy conviven:
- `processingResult.entities`
- spans `#entity-n`
- `card.dataset.reviewed/action/notes`
- `sessionStorage`

Esto causa drift y pérdida de decisiones.

**Corrección**
`ReviewSession` + `ReviewDecision` como único estado autoritativo. El DOM solo renderiza.

### P1-03 — Añadir una entidad manual puede perder progreso de revisión

Tras añadir una entidad manual se llama `renderSidePanel(processingResult)`, recreando cards cuyo estado de review vivía únicamente en `dataset`.

### P1-04 — Reconstrucción de posiciones desde el DOM es frágil

`updateEntityPositions()` intenta recalcular offsets recorriendo contenido renderizado y nodos anidados. Las posiciones deben referirse al texto fuente/canónico, no reconstruirse desde HTML.

### P1-05 — Soporte declarado de `.doc` sin parser real

`.doc` y `.docx` pasan por Mammoth. Mammoth es un parser DOCX, no una garantía de soporte para binario DOC clásico.

**Corrección**
Retirar `.doc` de formatos soportados o introducir conversor/parser específico.

### P1-06 — PDFs escaneados pueden producir texto vacío sin señal adecuada

PDF.js extrae text layer; no hay OCR ni detección robusta de documento escaneado.

**Corrección**
Detectar extracción vacía/anormalmente corta y bloquear con mensaje explícito. OCR local como mejora posterior.

### P1-07 — Logs de PHI en consola

`input.html` registra los primeros caracteres del texto clínico y `review.html` registra resultados completos.

**Corrección**
Eliminar logs sensibles de producción.

### P1-08 — Batch oculta documentos fallidos

`processAll()` devuelve solo completados. Un batch de 20 documentos con 2 errores puede pasar a review con 18 sin que esos dos formen parte del conjunto revisable.

**Corrección**
Mantener todos los items con estado `completed/error`; bloquear cierre/export hasta reconocer o resolver incidencias.

### P1-09 — Batch excede fácilmente la capacidad de `sessionStorage`

La UI admite hasta 50 archivos × 5 MB y después serializa resultados con original, procesado y entidades. El peor caso supera ampliamente cuotas típicas de almacenamiento web.

**Corrección**
- Mantener batch en memoria dentro de un único app shell.
- Si se requiere persistencia grande, IndexedDB con gestión explícita de cuota y limpieza.
- Capturar `QuotaExceededError`.

### P1-10 — Consistencia batch incompleta

La opción de consistencia monkey-patchea `AsignadorSustitutos.obtenerSustituto`, mientras `Processor.process()` resetea managers de nombres, ubicaciones y fechas por documento.

**Corrección**
`ProcessingContext` explícito compartido entre documentos con pseudonym map, location map, date policy/seed y configuración.

### P1-11 — Monkey patch no restaurado si el procesamiento falla

La restauración de `AsignadorSustitutos.obtenerSustituto` no está en `finally`.

**Corrección mínima**
`try/finally`.

**Corrección objetivo**
Eliminar monkey patch y usar dependencia/contexto explícito.

### P1-12 — Structured mode falla abierto

`UNKNOWN → KEEP`.

Para una herramienta de privacidad esto debe ser `UNKNOWN → REVIEW_REQUIRED`, especialmente en salida destinada a IA externa.

### P1-13 — Doble autoridad para columna de ID de paciente

Existe `patient-id-column` y, simultáneamente, acciones de columna `PATIENT_ID`. Pueden divergir y distintas partes del código usan fuentes diferentes.

**Corrección**
Una única autoridad. Seleccionar ID actualiza/bloquea la acción correspondiente y ninguna segunda columna puede ser `PATIENT_ID`.

### P1-14 — Parser CSV artesanal no soporta CSV válido multilínea

`split(/\r?\n/)` rompe celdas entrecomilladas con saltos de línea.

**Corrección**
Usar parser consolidado (p.ej. PapaParse o SheetJS para CSV).

### P1-15 — Inferencia de columnas usa solo la primera fila

Una primera fila vacía puede convertir una columna de emails/teléfonos en UNKNOWN/KEEP.

**Corrección**
Perfilar N valores no vacíos distribuidos y calcular distribución/confianza por columna.

### P1-16 — Fechas de visita estructuradas se mantienen exactas por defecto

`VISIT_DATE → KEEP`.

**Corrección**
Default según política; para "preparar para IA externa" usar `SHIFT_CONSISTENT` o `GENERALIZE`, no KEEP.

### P1-17 — Fecha de nacimiento se convierte a edad actual, no edad en visita

`dateReferenceForAge = new Date()`.

**Corrección**
Si existe fecha de visita, calcular edad en visita; si se exporta fuera del entorno controlado, generalizar además la edad.

### P1-18 — Excel procesa solo la primera hoja

Debe ofrecer selección de hoja o detectar la hoja relevante.

### P1-19 — Fechas seriales de Excel requieren normalización explícita

No depender de `new Date(value)` para seriales de Excel; normalizar con SheetJS.

### P1-20 — Valores vacíos se codifican como categoría

`CODIFY` convierte `""` en `COD_01`.

**Corrección**
Preservar null/vacío como ausencia, no como categoría.

### P1-21 — "anonimizado" se usa donde en realidad hay seudonimización

Nombres de ficheros y copy deben diferenciar:
- seudonimizado;
- preparado/reducido;
- anonimizado solo si existe una evaluación de riesgo suficiente para sostenerlo.

## 5. Hallazgos P1/P2 — arquitectura y mantenibilidad

### P1A-01 — Motor modular, aplicación monolítica

`review.html` concentra gran cantidad de lógica y existe duplicación con `js/shared/review-ui.js`.

### P1A-02 — Legacy sigue siendo parte del flujo principal

`batch.html` embebe `batch-review-legacy.html` y `batch-structured-legacy.html`.

### P1A-03 — Singletons globales y configuración mutable

`Processor`, `AsignadorSustitutos`, `FechasManager` y `UbicacionesManager` comparten estado global, dificultando concurrencia, Web Workers y tests aislados.

**Arquitectura objetivo**
- `PrivacyEngine`
- `ProcessingContext`
- `RecognizerRegistry`
- `OperatorRegistry`
- `ReviewSession`
- `SafeExportService`
- `ConfidentialAuditExport`

### P1A-04 — Detección y transformación están acopladas

`Processor.transformEntity()` decide directamente qué hacer por tipo.

**Corrección**
Separar recognizers de operators/policies.

### P1A-05 — Falta un contrato estándar de detección

Propuesto:

```ts
Detection {
  id
  type
  subtype
  start
  end
  original
  confidence
  source
  reasons
}
```

### P1A-06 — Falta un contrato estándar de decisión de revisión

```ts
ReviewDecision {
  detectionId
  status: pending | accepted | modified | restored | manual
  replacement
  notes
}
```

### P1A-07 — Diccionarios se normalizan repetidamente

`ScoringEngine` reconstruye arrays/sets durante scoring.

**Corrección**
`DictionaryIndex` precomputado con Sets normalizados.

### P2-01 — Resolución de conflictos por Set de posiciones

Actualmente se ocupa carácter por carácter. Puede reemplazarse por algoritmo de intervalos/sweep.

### P2-02 — `innerHTML` todavía se usa ampliamente

Parte está correctamente escapada con `SafeRender`, pero conviene reducir construcción de UI con HTML strings y centralizar las excepciones.

### P2-03 — Error handling centrado en `alert()`

Migrar hacia errores estructurados y estados de UI no bloqueantes.

### P2-04 — Dependencias vendorizadas no tienen gobierno de supply chain suficiente

Existen copias locales (p.ej. jsPDF 2.5.1, JSZip 3.10.1) que no necesariamente están cubiertas por `npm audit`.

**Corrección**
Build reproducible desde dependencias o `VENDOR_MANIFEST.json` con versión, fuente y hash.

## 6. Hallazgos de CI y calidad

### P1Q-01 — `check:positioning` existe pero GitHub Actions no lo ejecuta

El workflow ejecuta comandos individuales en vez de `npm test`.

### P1Q-02 — Check de enlaces permite recursos externos

`check-links.mjs` ignora URLs HTTP(S), por lo que no protege el principio local-first.

### P1Q-03 — Smoke tests no son benchmark de privacidad

Corpus actual: pocos casos sintéticos y asserts específicos.

**Necesario**
Corpus versionado con:
- MUST_REMOVE
- MUST_KEEP
- MUST_FLAG_FOR_REVIEW

Métricas:
- precision
- recall
- F1
- false negative rate
- por tipo de entidad.

### P1Q-04 — Faltan E2E de los contratos críticos

Casos mínimos Playwright:
1. paste → process → review → copy;
2. modificación aparece en salida;
3. restore aparece en salida;
4. entidad manual aparece en salida;
5. safe export bloqueado con review pendiente;
6. PDF textual;
7. PDF escaneado produce warning;
8. batch con fallo conserva el fallo;
9. navegar batch no equivale a revisar;
10. UNKNOWN estructurado requiere review;
11. safe export no contiene PII fixture;
12. confidential export está marcado;
13. cero requests de red fuera del origen clínico.

### P1Q-05 — Faltan herramientas de calidad estática

Incorporar:
- ESLint;
- Prettier;
- TypeScript o, como mínimo, JSDoc + `@ts-check`;
- CodeQL;
- Dependabot/Renovate;
- coverage.

## 7. Performance

### PERF-01 — Procesamiento en main thread

Mover engine/batch a Web Worker para evitar congelación de UI.

### PERF-02 — Parsers pesados se cargan de forma eager

Lazy-load de PDF.js, Mammoth, XLSX, jsPDF y JSZip según flujo.

### PERF-03 — Diccionarios no indexados

Precomputar Sets/índices normalizados.

### PERF-04 — Serialización masiva de batch

Eliminar round-trip por `sessionStorage`.

### PERF-05 — No existe benchmark de rendimiento

Medir y versionar:
- 10 KB / 100 KB / 500 KB / 1 MB;
- 1 / 10 / 50 documentos;
- tiempo;
- memoria;
- responsiveness.

## 8. Mejoras de producto candidatas

Estas no deben ejecutarse antes de cerrar P0/P1.

1. Date shifting consistente.
2. Pseudónimos deterministas no basados en género.
3. Modos/políticas: Estándar, Estricto, Investigación longitudinal, Preparar para IA externa.
4. Panel de candidatos descartados/low-confidence.
5. Privacy Gate final con pendientes objetivos, nunca "certificado RGPD".
6. Clasificación estructurada de columnas: Identifier / Quasi-Identifier / Sensitive / Insensitive.
7. Métricas de unicidad/equivalence classes tipo ARX-lite.
8. Diccionarios institucionales configurables.
9. Recognizers plug-in.
10. NER local opcional como capa adicional, no sustituto de reglas.
11. OCR local para PDFs escaneados.
12. Adaptador FHIR JSON.
13. Reconstrucción/redacción PDF manteniendo layout.
14. DICOM como horizonte lejano.
15. Exportación DOCX/TXT segura.
16. Correspondencia opcional cifrada para investigación reversible.
17. HMAC/tokenización consistente por estudio.
18. Perfilado de columnas multi-muestra.
19. Selección multi-hoja Excel.
20. Risk summary estructurado.

## 9. Patrones externos que merece la pena adoptar

### Microsoft Presidio
Adoptar conceptualmente:
- RecognizerRegistry;
- separación Analyzer / Anonymizer;
- Operators configurables;
- recognizers custom;
- decision trace.

### Philter / Philter Lite
Adoptar:
- corpus ground truth;
- precision/recall por entidad;
- funciones stateless;
- contratos y tipado;
- tests orientados a producción.

### ARX
Adoptar para datos estructurados:
- Identifiers;
- Quasi-identifiers;
- Sensitive attributes;
- equivalence classes;
- evaluación de riesgo/utility.

No implementar todo ARX salvo necesidad real.

### Google Healthcare
Adoptar:
- date shifting consistente;
- transformaciones deterministas/tokenizadas;
- lenguaje prudente: heurística ≠ garantía de cumplimiento.

### AWS Comprehend Medical
Adoptar:
- entidad + posición + confidence;
- thresholds como decisión de workflow/review, no como mecanismo para esconder posibles falsos negativos.

### Private AI / Limina
Adoptar como patrón futuro de archivos:
`FileAdapter → extract → detect → transform → reconstruct`.

## 10. Principios de arquitectura acordados/propuestos

1. Local-first real y verificable.
2. Origen clínico sin terceros.
3. Fail-closed ante incertidumbre.
4. Estado de dominio independiente del DOM.
5. Review y export comparten una única fuente de verdad.
6. Salida segura y auditoría confidencial son artefactos distintos.
7. Detectores y transformaciones son plug-ins independientes.
8. Procesamiento pesado fuera del main thread.
9. Claims del producto deben ser testables.
10. Ninguna feature se considera terminada sin tests de regresión adecuados.

## 11. Preguntas abiertas antes de implementar

Se resolverán mediante la tercera auditoría UX/UI y la decisión de arquitectura/despliegue:
- SPA/app shell vs multipágina.
- Stack de frontend futuro.
- Modelo de navegación.
- Diseño de workflows de texto, archivos y estructurado.
- Nivel de persistencia de sesión.
- Dominio/origen de aplicación y marketing.
- Plataforma de hosting.
- Qué flujos forman MVP y cuáles quedan como módulos posteriores.

