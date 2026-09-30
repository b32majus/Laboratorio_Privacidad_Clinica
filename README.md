# 🛡️ Laboratorio de Privacidad Clínica v4.0

**Herramienta educativa local-first para preparar información sanitaria antes de usar IA.**

[![Estado](https://img.shields.io/badge/Estado-Estable-success)](https://github.com/)
[![Privacidad](https://img.shields.io/badge/Privacidad-100%25_Local-blue)](https://github.com/)
[![Versión](https://img.shields.io/badge/Versi%C3%B3n-4.0-purple)](https://github.com/)
[![Licencia](https://img.shields.io/badge/Licencia-MIT-green)](LICENSE)

---

## 📖 Descripción

El **Laboratorio de Privacidad Clínica** es una aplicación web diseñada para enseñar y facilitar la preparación de textos, documentos y datos estructurados antes de usar herramientas como ChatGPT, Claude o Gemini. Ayuda a detectar identificadores, revisar seudonimización y trabajar con información sanitaria con un enfoque privacy-first.

**Principio fundamental:** todo el procesamiento ocurre en el navegador del cliente (local-first). La herramienta no sustituye la revisión humana ni garantiza cumplimiento normativo por sí sola.

### ⚠️ Disclaimer de Responsabilidad

- Esta herramienta es de apoyo para automatizar parte de la seudonimización.
- La responsabilidad del tratamiento de datos y de la anonimización final recae **exclusivamente en la persona usuaria** que procesa la información.
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

## 🏥 Características Principales

### Preparación antes de IA
- **Texto, documentos y datos estructurados:** Revisa notas, informes, abstracts, comunicaciones, pósters, proyectos de calidad, formularios y bases CSV/Excel.
- **Casos sanitarios prácticos:** Útil para comunicación científica, docencia, investigación, mejora de procesos y estructuración de textos clínicos con IA.
- **Revisión humana obligatoria:** La salida debe validarse antes de compartirla o introducirla en cualquier herramienta externa.

### Procesamiento de Texto Clínico
- **Detección Inteligente:** Identifica nombres, fechas, ubicaciones, DNIs, teléfonos y emails.
- **Coherencia:** Mismo dato original = mismo pseudónimo en todo el documento.
- **Categorización Visual:** Sistema de colores intuitivo para revisión rápida.
- **Revisión Manual:** Herramientas para aceptar, modificar o restaurar entidades detectadas.
- **Ejemplos Precargados:** Casos de uso reales (Urgencias, Quirúrgico, Historia Clínica).

### 📊 Modo Batch (Datos Estructurados)
- **Soporte CSV/Excel:** Procesa múltiples registros simultáneamente.
- **Detección automática de cabeceras:** Salta filas explicativas.
- **Seudonimización Consistente:** Mantiene coherencia para estudios longitudinales.
- **Tabla de Correspondencia:** Genera archivo de mapeo para re-identificación controlada.

### 🔒 Privacidad y Seguridad
- **Procesamiento Local:** No requiere backend ni APIs de procesamiento en la nube.
- **Sesión Efímera:** Datos clínicos en almacenamiento de sesión con borrado manual global.
- **Librerías críticas locales:** PDF.js, Mammoth y JSZip servidos desde `/lib` (sin dependencia de CDN para procesar).
- **Apoyo privacy-first:** Diseñado como paso previo de revisión, no como certificación automática de anonimización o cumplimiento.

---

## 🚀 Despliegue en GitHub Pages

Esta aplicación está lista para ser desplegada gratuitamente en **GitHub Pages**.

### Instrucciones paso a paso:

1.  **Subir el código:** Sube este repositorio a tu cuenta de GitHub.
2.  **Configurar Pages:**
    *   Ve a la pestaña **Settings** de tu repositorio.
    *   En el menú lateral, haz clic en **Pages**.
    *   En **Source**, selecciona `Deploy from a branch`.
    *   En **Branch**, selecciona `3.0` y la carpeta `/ (root)`.
    *   Haz clic en **Save**.
3.  **Listo:** En unos minutos, tu aplicación estará en `https://tu-usuario.github.io/tu-repositorio/`.

**Nota:** GitHub Pages sirve la web desde `index.html`; el `README.md` sigue siendo la portada del repositorio en GitHub, no la página pública del sitio.

---

## 💻 Instalación Local

Si prefieres ejecutarlo en tu ordenador sin internet:

1.  **Clonar:**
    ```bash
    git clone https://github.com/tu-usuario/laboratorio-privacidad-clinica.git
    ```
2.  **Ejecutar:**
    *   Opción A: Abre el archivo `index.html` directamente en tu navegador.
    *   Opción B (Recomendado): Usa un servidor local simple.
        ```bash
        # Python 3
        python -m http.server 8000
        ```
    Luego visita `http://localhost:8000`.

### Build de assets locales (UI)

Si modificas clases o estilos Tailwind:

```bash
npm install
npm run build
```

---

## 🛠️ Stack Técnico

*   **Core:** HTML5, CSS3, JavaScript (Vanilla ES6+).
*   **Estilos:** Tailwind CSS compilado a `css/tailwind.generated.css` (sin CDN en runtime).
*   **Librerías:**
    *   `Mammoth.js` (procesamiento .docx, local)
    *   `PDF.js` (lectura de PDFs, local)
    *   `SheetJS` (procesamiento Excel/CSV)
    *   `jsPDF` (generación de informes, local)
    *   `JSZip` (exportaciones batch ZIP, local)
*   **Iconos y fuentes:** Material Symbols, Inter y Cormorant Garamond servidos desde `fonts/` + `css/local-fonts.css`.

---

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
*   La responsabilidad del tratamiento de datos y de la anonimización final corresponde exclusivamente a quien usa la herramienta.
*   Siempre debe haber una **revisión humana** de los resultados.
*   No debe usarse como único mecanismo de seguridad en entornos de producción crítica sin una auditoría previa.

---

**Desarrollado con ❤️ por Sophilux**
