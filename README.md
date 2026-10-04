# 🛡️ Laboratorio de Privacidad Clínica v4.0

**Herramienta educativa local-first para preparar información sanitaria antes de usar IA.**

[![Estado](https://img.shields.io/badge/Estado-Recuperaci%C3%B3n%20V4-orange)](https://github.com/)
[![Privacidad](https://img.shields.io/badge/Privacidad-100%25_Local-blue)](https://github.com/)
[![Versión](https://img.shields.io/badge/Versi%C3%B3n-4.0-purple)](https://github.com/)
[![Licencia](https://img.shields.io/badge/Licencia-MIT-green)](LICENSE)

---

> **Estado de producto (2026-10-04): recuperación V4 en curso.** La SPA V4 es la base técnica canónica y contiene mejoras sustanciales de seguridad, dominio y QA, pero la auditoría de trazabilidad posterior a T25 detectó capacidades de producto v3 y requisitos UX originales aún no recuperados. No interpretar “v4.0”, T25 o CI verde como paridad funcional/visual completa. Ver `docs/START_HERE.md` y `docs/RECOVERY_MASTER_PLAN_2026-10.md`.

## 📖 Descripción

El **Laboratorio de Privacidad Clínica** es una aplicación web diseñada para enseñar y facilitar la preparación de textos, documentos y datos estructurados antes de usar herramientas como ChatGPT, Claude o Gemini. Ayuda a detectar identificadores, revisar seudonimización y trabajar con información sanitaria con un enfoque privacy-first.

**Principio fundamental:** todo el procesamiento ocurre en el navegador del cliente (local-first). La herramienta no sustituye la revisión humana ni garantiza cumplimiento normativo por sí sola.

### ⚠️ Disclaimer de Responsabilidad

- Esta herramienta es de apoyo para automatizar parte de la seudonimización.
- La responsabilidad del tratamiento de datos y de la validación final del contenido preparado recae **exclusivamente en la persona usuaria** que procesa la información.
- La revisión humana final es **crítica y obligatoria** antes de compartir cualquier contenido.
- No garantiza cumplimiento normativo ni reemplaza los circuitos legales, de seguridad o de gobernanza de datos de cada organización.

---

## 🧭 v4.0 — Aplicación V4 (SPA) y superficie canónica

**Entrada canónica de la aplicación clínica:** `app-v4/index.html`
(build de producción: `npm run build` → `dist/index.html`; despliegue estático:
`render.yaml`, ver `docs/deployment/RENDER_STATIC.md`).

* Una única SPA (`Input → Configure → Review → Privacy Gate → Export`), estado de dominio canónico (`ReviewSession`), motor off-main-thread (Web Worker) y despliegue solo-estático con headers de seguridad clínicos.
* Motor de privacidad: `js/core/*` compuesto por el motor V4 (`app-v4/src/engine/`), preservado detrás de adaptadores con regresión determinista.
* Las páginas legacy multipágina (`app.html`, `input.html`, `batch*.html`, `review.html`) fueron retiradas (T25 #29) — ver `docs/legacy-retirement/RETIRED_SURFACES.md`.
* Gobernanza canónica (rama, checks requeridos, versionado): `docs/governance/CANONICAL_AUTHORITY.md`.

---

## ✨ Novedades en v3.0 (histórico)

### 🔄 Pseudónimos Legibles
El sistema ahora genera **texto coherente y legible** en lugar de marcadores con corchetes:

| Tipo de Dato | Versión 1.x | Versión 3.0 |
|--------------|-------------|-------------|
| Pacientes | `[NOMBRE]` | "Paciente 1", "Paciente 2"... |
| Profesionales | `[Facultativo]` | "Profesional Sanitario 1, 2..." |
| Familiares | `[Dato Personal]` | "Familiar 1, 2..." |
| Hospitales | `[Centro Sanitario]` | "Centro A", "Centro B"... |
| Ciudades | `[Localidad]` | "Ciudad A", "Ciudad B"... |
| Identificadores | `[DNI]` | Eliminación silenciosa |

### 📅 Relativización Inteligente de Fechas
- **Visita 1**: "Visita 1 (hace 9 meses)"
- **Visitas posteriores**: "Visita 2 (3 días después de Visita 1)"
- Preserva la información temporal clínica sin revelar fechas absolutas

### 🧱 Modo Estricto (Nuevo)
- Activa una preparación más agresiva desde `input.html` y `batch.html`.
- Suprime cuasi-identificadores con marcador `[dato_sensible]`.
- Generaliza más la geografía (`Zona Geografica` / `Centro Sanitario`) para reducir riesgo residual.

### 🔍 Detección Ampliada
Ahora detecta y elimina:
- ✅ Teléfonos (españoles, con/sin prefijo internacional)
- ✅ Emails
- ✅ Direcciones completas (Calle, Avda, Plaza...)
- ✅ Códigos postales
- ✅ CIP/SIP/TIS etiquetados (tarjeta sanitaria)
- ✅ Menciones familiares inline ("La madre refiere...")

### 📊 Mejoras en Excel/CSV
- **Auto-detección de cabeceras**: Salta automáticamente filas explicativas al inicio
- Busca la fila de datos real en las primeras 10 filas
- Compatible con exportaciones hospitalarias con metadatos

### 🧱 Arquitectura Local-First
- **Tailwind compilado localmente** en `css/tailwind.generated.css`
- **Fuentes e iconos locales** servidos desde `fonts/`
- **Librerías críticas locales** para PDF, DOCX y ZIP sin CDN runtime
- **Motor consolidado** en `js/core/*` con interfaz modular estable

---

## 🏥 Estado funcional V4 actual

> Para el detalle exhaustivo de qué está preservado, mejorado, perdido o pendiente de recuperación, la fuente de verdad es `docs/audits/2026-10-recovery-traceability-matrix.md`. Esta sección describe sólo la superficie V4 actual; las capacidades históricas de v3 aparecen arriba y no deben interpretarse como disponibles si la matriz las marca para recuperación.

### Texto y documentos
- Entrada única para texto pegado, TXT, PDF con capa de texto y DOCX.
- Motor local de detección/preparación orientado a texto clínico en español, con nombres, identificadores, fechas, ubicaciones, sospechosos/cuasidentificadores y edad.
- ReviewSession como autoridad de revisión: aceptar propuesta, modificar, restaurar y añadir detecciones manuales sin derivar el resultado del DOM.
- Cola visible de candidatos de baja confianza y bloqueo fail-closed de pendientes obligatorios.
- Privacy Gate factual antes de Export.
- Salida V4 actual: Safe Output de texto y Confidential Audit separados. La recuperación de Copy y formatos DOCX/PDF seguros pertenece a REC-05.

### Batch documental
- Batch como capacidad nativa del mismo Job, no como aplicación/Premium separado.
- Estado por documento, fallos visibles, revisión por documento y ProcessingContext compartido para consistencia.
- La navegación no certifica revisión y un fallo no desaparece del lote.
- **Pendiente de recuperación:** no existe todavía un Safe Output / Confidential Audit batch-wide aceptado; REC-06/REC-07 recuperan workflow y formatos de salida útiles sin restaurar los exportadores legacy inseguros.

### Datos estructurados CSV/Excel
- CSV, XLS y XLSX con selección explícita de hoja, normalización de fechas Excel, profiling distribuido y clasificación Identifier / Quasi-Identifier / Sensitive / Insensitive / Unknown.
- Una única autoridad de Patient ID; UNKNOWN requiere revisión y no se exporta como KEEP silencioso.
- Políticas de fecha/edad estructuradas con generalización o desplazamiento longitudinal por paciente según política.
- Salida V4 actual: Safe Structured CSV + Confidential Audit separado.
- **Pendiente de recuperación:** Study ID exportable/ligadura longitudinal, autodetección avanzada de fila de cabeceras, XLSX seguro/confidencial, opciones longitudinales útiles y otras capacidades trazadas en REC-03/REC-04.

### Privacidad y seguridad
- Procesamiento clínico local en el navegador; Render sirve sólo bytes estáticos.
- Estado sensible del Job en memoria; V4 no usa `sessionStorage`/`localStorage` como almacenamiento de datos clínicos.
- Sin analytics ni recursos runtime de terceros en el origen clínico; CSP y otros headers gobernados por `render.yaml`.
- Web Worker para procesamiento pesado y fallos tipados/fail-closed para entradas no soportadas o estados incompletos.
- La herramienta apoya la preparación y revisión humana; no certifica anonimización ni cumplimiento normativo.

### Recuperación de producto en curso
El plan vigente contiene 12 Work Orders (`REC-01`…`REC-12`) para cerrar aseguramiento del motor español, políticas de texto, semántica/I-O structured, outputs single/batch, productividad de entrada/review, localización completa al español, sistema visual Sophilux y el closeout trazable. La matriz reconciliada tiene 88 filas congeladas + 42 de patrimonio/target, pero REC-12 debe demostrar primero source→matrix completeness: el número de filas por sí solo no prueba paridad. Ver `docs/RECOVERY_MASTER_PLAN_2026-10.md`.

## 🚀 Despliegue canónico

La aplicación clínica V4 se construye con Vite y se publica como sitio estático desde `dist/`. El target canónico actual es **Render Static**, gobernado por `render.yaml` y `docs/deployment/RENDER_STATIC.md`. GitHub Pages y la rama histórica `3.0` ya no son la autoridad de despliegue clínico.

## 💻 Instalación Local

```bash
git clone https://github.com/b32majus/Laboratorio_Privacidad_Clinica.git
cd Laboratorio_Privacidad_Clinica
npm ci
npm run dev:v4
```

Para reproducir el artefacto de producción:

```bash
npm run build
npm run preview:v4
```

La entrada clínica V4 es `app-v4/index.html`; el build servido es `dist/index.html`. Abrir el `index.html` raíz histórico directamente no reproduce la aplicación clínica canónica.

## 🛠️ Stack Técnico actual

* **Aplicación:** Vite + TypeScript + React.
* **UI:** Tailwind compilado; fuentes locales Inter + Cormorant Garamond; Material Symbols local.
* **Motor:** `app-v4/src/engine/*` compuesto sobre capacidades preservadas de `js/core/*`, con adapters y Web Worker.
* **Entrada:** TXT, PDF con capa de texto, DOCX, CSV, XLS/XLSX; fallos tipados/fail-closed.
* **Persistencia sensible:** estado de Job en memoria; sin `sessionStorage`/`localStorage` en fuentes V4 productivas.
* **Deployment:** Render Static, sin backend de procesamiento clínico.
* **Calidad:** Vitest, Playwright, privacy-eval, lint/typecheck/format, guards de storage/red/vendor/PDF/headers y CodeQL.

Las librerías/formatos históricos de v3 se conservan sólo como referencia en las secciones históricas y en Git; no deben inferirse como superficie V4 disponible salvo evidencia en la matriz actual.

## 🏛️ Arquitectura histórica v3 (retirada en v4)

La arquitectura multipágina v3 (`app.html`, `input.html`, `batch.html`,
`review.html`, `js/batch-module.js`) fue retirada en v4 (T25 #29); este
apartado se conserva como referencia histórica. La arquitectura actual es la
SPA V4 descrita arriba; el núcleo de detección (`js/core/*` vía
`js/modular-processor.js`) sigue siendo el motor compartido, ahora consumido
por el motor compuesto V4 con Worker.

---

## ✅ Operación y Calidad

*   Guía operativa: `GUIA_OPERACION.md`
*   Baseline de regresión: `BASELINE_REGRESION.md`
*   CI: `.github/workflows/ci.yml`
*   Checks automáticos:
    *   Validación de referencias locales HTML
    *   Política de almacenamiento sensible
    *   Smoke funcional de anonimización (`scripts/ci/smoke-anonymization.mjs`)

---

## 📋 Changelog

### Histórico previo a v3.0
- ✨ Pseudónimos legibles en lugar de marcadores con corchetes
- 🔄 Coherencia de entidades (mismo original = mismo pseudónimo)
- 📅 Relativización de fechas con intervalos entre visitas
- 📞 Detección de teléfonos y emails
- 🏠 Detección de direcciones completas
- 📊 Auto-detección de cabeceras en Excel
- 🧹 Código consolidado y limpieza de archivos no usados

### v3.0 (Abril 2026)
- 🧱 Consolidación local-first sin CDN runtime
- 🔒 Refuerzo de render seguro y sanitización de metadatos visibles
- 🧠 Más cobertura de ubicaciones, barrios y tarjetas sanitarias
- 🧭 Disclaimers reforzados con responsabilidad del usuario y revisión humana obligatoria
- 🚀 Preparación para GitHub Pages desde la rama `3.0`

### v1.x
- Versión inicial con detección básica y marcadores

---

## ⚠️ Aviso Legal y Educativo

**Esta herramienta es un proyecto educativo.**

*   **NO garantiza el cumplimiento normativo total** (RGPD, HIPAA, LOPDgdd) por sí misma.
*   La responsabilidad del tratamiento de datos y de la validación final del contenido preparado corresponde exclusivamente a quien usa la herramienta.
*   Siempre debe haber una **revisión humana** de los resultados.
*   No debe usarse como único mecanismo de seguridad en entornos de producción crítica sin una auditoría previa.

---

**Desarrollado con ❤️ por Sophilux**
