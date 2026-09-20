# Roadmap técnico y de producto — Laboratorio de Privacidad Clínica

> Este roadmap ordena la deuda, pero no autoriza implementación hasta cerrar la auditoría UX/UI y la decisión de arquitectura/despliegue.

## Gate 0 — Auditoría y decisión de producto

**Objetivo:** no refactorizar sobre un modelo de interacción que vayamos a abandonar.

Entregables:
- [x] Auditoría privacidad/seguridad.
- [x] Auditoría funcional/código/arquitectura/performance.
- [ ] Auditoría UX/UI, navegación y modelo de aplicación.
- [ ] Decisión de stack frontend.
- [ ] Decisión de hosting/orígenes/dominio.
- [ ] Arquitectura objetivo aprobada.
- [ ] Convertir deuda final en issues ejecutables con criterios de aceptación.

## Fase 1 — Product integrity / safety baseline

Resolver antes de nuevas features:

1. ReviewSession + finalText canónico.
2. Safe Output / Confidential Audit.
3. Review real obligatorio antes de safe export.
4. Detector y política de AGE.
5. Retirada de claims k-anonymity / differential privacy.
6. Fail closed para truncado y unknown structured columns.
7. Origen clínico sin terceros + CSP + CI network invariant.
8. Eliminar logs de PHI.
9. Batch conserva errores y no falsifica review state.
10. Terminología seudonimización/anonimización coherente.

**Definition of Done**
- Lo mostrado tras revisión es byte-semánticamente la fuente del export.
- Ningún fixture PII aparece en Safe Output salvo decisión explícita de restauración.
- Un documento no puede aparecer revisado sin decisiones completas.
- CI impide recursos externos inesperados.
- No existe claim de una técnica no implementada.

## Fase 2 — Architecture consolidation

1. App shell único.
2. `PrivacyEngine` instanciable.
3. `ProcessingContext`.
4. `RecognizerRegistry`.
5. `OperatorRegistry`.
6. `ReviewSession / ReviewDecision`.
7. Adaptadores de archivos.
8. Servicios de export separados.
9. Eliminar iframes y páginas legacy.
10. Eliminar duplicación de review y lógica de negocio inline en HTML.

**Objetivo**
Una sola cadena de estado:

```
Input → Detection → ReviewSession → Final Output
                         ├→ Safe Export
                         └→ Confidential Audit
```

## Fase 3 — Quality engineering

1. TypeScript o @ts-check.
2. ESLint/Prettier.
3. Unit tests por recognizer/operator.
4. Corpus ground truth.
5. Métricas privacy regression.
6. Playwright E2E.
7. CodeQL.
8. Dependabot/Renovate.
9. Supply-chain manifest/build reproducible.
10. Branch protection + required checks.

## Fase 4 — Structured data hardening

1. Parser CSV consolidado.
2. Column profiling multi-sample.
3. Una sola autoridad patient ID.
4. Policies por columna.
5. Fechas Excel normalizadas.
6. Multi-sheet.
7. Date/age longitudinal correctos.
8. Null preservation.
9. Identifier/Quasi-Identifier/Sensitive taxonomy.
10. Risk summary ARX-lite.

## Fase 5 — Performance and scale

1. Web Worker.
2. Batch en memoria dentro del app shell.
3. Lazy loading.
4. Dictionary indexes.
5. Interval conflict resolution.
6. Benchmarks CPU/memoria.
7. UI virtualizada si el número de detecciones lo exige.

## Fase 6 — Product capability

Orden recomendado:
1. Date shifting consistente.
2. Pseudónimos deterministas.
3. Policy profiles.
4. Low-confidence review queue.
5. Privacy Gate.
6. Diccionarios/recognizers institucionales.
7. Export DOCX/TXT.
8. Correspondence cifrada/HMAC para investigación.

## Fase 7 — Advanced adapters

Solo cuando exista necesidad:
1. OCR local.
2. NER local opcional.
3. FHIR JSON.
4. PDF layout-preserving redaction.
5. DICOM.

## Principio de priorización

No priorizar por "feature visibility". Priorizar por:

```
integridad de salida
> prevención de fugas
> coherencia de estado
> testabilidad
> mantenibilidad
> performance
> nuevas capacidades
```
