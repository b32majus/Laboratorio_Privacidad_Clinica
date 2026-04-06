# 🛡️ Laboratorio de Privacidad Clínica v2.0

**Herramienta educativa de seudonimización de datos sanitarios 100% local y segura.**

[![Estado](https://img.shields.io/badge/Estado-Estable-success)](https://github.com/)
[![Privacidad](https://img.shields.io/badge/Privacidad-100%25_Local-blue)](https://github.com/)
[![Versión](https://img.shields.io/badge/Versi%C3%B3n-2.0-purple)](https://github.com/)
[![Licencia](https://img.shields.io/badge/Licencia-MIT-green)](LICENSE)

---

## 📖 Descripción

El **Laboratorio de Privacidad Clínica** es una aplicación web diseñada para enseñar y facilitar la seudonimización de textos clínicos. Su objetivo es permitir que profesionales sanitarios y estudiantes utilicen herramientas de IA generativa de forma segura, eliminando datos identificables antes de compartir la información.

**Principio Fundamental:** Todo el procesamiento ocurre en el navegador del cliente (Client-Side). **Ningún dato sale de tu dispositivo.**

### ⚠️ Disclaimer de Responsabilidad

- Esta herramienta es de apoyo para automatizar parte de la seudonimización.
- La responsabilidad del tratamiento de datos y de la anonimización final recae **exclusivamente en la persona usuaria** que procesa la información.
- La revisión humana final es **crítica y obligatoria** antes de compartir cualquier contenido.

---

## ✨ Novedades en v2.0

### 🔄 Pseudónimos Legibles
El sistema ahora genera **texto coherente y legible** en lugar de marcadores con corchetes:

| Tipo de Dato | Versión 1.x | Versión 2.0 |
|--------------|-------------|-------------|
| Pacientes | `[NOMBRE]` | "Paciente Hombre" / "Paciente Mujer" |
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
- Activa una anonimización más agresiva desde `input.html` y `batch.html`.
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

---

## 🏥 Características Principales

### Procesamiento de Texto Clínico
- **Detección Inteligente:** Identifica nombres, fechas, ubicaciones, DNIs, teléfonos y emails.
- **Coherencia:** Mismo dato original = mismo pseudónimo en todo el documento.
- **Categorización Visual:** Sistema de colores intuitivo para revisión rápida.
- **Revisión Manual:** Herramientas para aceptar, modificar o restaurar entidades detectadas.
- **Ejemplos Precargados:** Casos de uso reales (Urgencias, Quirúrgico, Historia Clínica).

### 📊 Modo Batch (Datos Estructurados)
- **Soporte CSV/Excel:** Procesa múltiples registros simultáneamente.
- **Detección automática de cabeceras:** Salta filas explicativas.
- **Anonimización Consistente:** Mantiene coherencia para estudios longitudinales.
- **Tabla de Correspondencia:** Genera archivo de mapeo para re-identificación controlada.

### 🔒 Privacidad y Seguridad
- **Procesamiento Local:** No requiere backend ni APIs de procesamiento en la nube.
- **Sesión Efímera:** Datos clínicos en almacenamiento de sesión con borrado manual global.
- **Librerías críticas locales:** PDF.js, Mammoth y JSZip servidos desde `/lib` (sin dependencia de CDN para procesar).

---

## 🚀 Despliegue en GitHub Pages

Esta aplicación está lista para ser desplegada gratuitamente en **GitHub Pages**.

### Instrucciones paso a paso:

1.  **Subir el código:** Sube este repositorio a tu cuenta de GitHub.
2.  **Configurar Pages:**
    *   Ve a la pestaña **Settings** de tu repositorio.
    *   En el menú lateral, haz clic en **Pages**.
    *   En **Source**, selecciona `Deploy from a branch`.
    *   En **Branch**, selecciona `main` y la carpeta `/ (root)`.
    *   Haz clic en **Save**.
3.  **Listo:** En unos minutos, tu aplicación estará en `https://tu-usuario.github.io/tu-repositorio/`.

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

## 🧭 Arquitectura Actual (Refactor)

*   **Entrada principal:** `app.html`
*   **Texto clínico:** `input.html` -> `review.html`
*   **Batch unificado:** `batch.html`
    *   Modo documentos (nativo en `batch.html`)
    *   Modo estructurado embebido (`batch-structured-legacy.html`)
    *   Revisión batch embebida (`batch-review-legacy.html`)
*   **Compatibilidad de rutas:**
    *   `batch-structured.html` redirige a `batch.html?mode=structured`
    *   `batch-review.html` redirige a `batch.html?mode=review`
*   **Motor oficial:** `js/core/*` a través de `js/modular-processor.js`
*   **Módulo batch oficial:** `js/batch-module.js`

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

### v2.0 (Diciembre 2024)
- ✨ Pseudónimos legibles en lugar de marcadores con corchetes
- 🔄 Coherencia de entidades (mismo original = mismo pseudónimo)
- 📅 Relativización de fechas con intervalos entre visitas
- 📞 Detección de teléfonos y emails
- 🏠 Detección de direcciones completas
- 📊 Auto-detección de cabeceras en Excel
- 🧹 Código consolidado y limpieza de archivos no usados

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
