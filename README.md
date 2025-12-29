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

### 🔍 Detección Ampliada
Ahora detecta y elimina:
- ✅ Teléfonos (españoles, con/sin prefijo internacional)
- ✅ Emails
- ✅ Direcciones completas (Calle, Avda, Plaza...)
- ✅ Códigos postales
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
- **Cero Dependencias Externas:** No requiere backend ni APIs en la nube.
- **Borrado Seguro:** Limpieza automática de sesión.

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

---

## 🛠️ Stack Técnico

*   **Core:** HTML5, CSS3, JavaScript (Vanilla ES6+).
*   **Estilos:** Tailwind CSS (vía CDN para desarrollo, o compilado).
*   **Librerías:**
    *   `Mammoth.js` (procesamiento .docx)
    *   `PDF.js` (lectura de PDFs)
    *   `SheetJS` (procesamiento Excel/CSV)
    *   `jsPDF` (generación de informes)
*   **Iconos:** Google Material Symbols.
*   **Fuentes:** Inter (UI) y Cormorant Garamond (Identidad).

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
*   Siempre debe haber una **revisión humana** de los resultados.
*   No debe usarse como único mecanismo de seguridad en entornos de producción crítica sin una auditoría previa.

---

**Desarrollado con ❤️ por Sophilux**
