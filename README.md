# 🛡️ Laboratorio de Privacidad Clínica

**Herramienta educativa de seudonimización de datos sanitarios 100% local y segura.**

[![Estado](https://img.shields.io/badge/Estado-Estable-success)](https://github.com/)
[![Privacidad](https://img.shields.io/badge/Privacidad-100%25_Local-blue)](https://github.com/)
[![Licencia](https://img.shields.io/badge/Licencia-MIT-green)](LICENSE)

---

## 📖 Descripción

El **Laboratorio de Privacidad Clínica** es una aplicación web diseñada para enseñar y facilitar la seudonimización de textos clínicos. Su objetivo es permitir que profesionales sanitarios y estudiantes utilicen herramientas de IA generativa de forma segura, eliminando datos identificables antes de compartir la información.

**Principio Fundamental:** Todo el procesamiento ocurre en el navegador del cliente (Client-Side). **Ningún dato sale de tu dispositivo.**

## ✨ Características Principales

### 🏥 Procesamiento de Texto Clínico
- **Detección Inteligente:** Identifica nombres, fechas, ubicaciones, DNIs y números de teléfono.
- **Categorización Visual:** Sistema de colores intuitivo para revisión rápida.
- **Revisión Manual:** Herramientas para aceptar, modificar o restaurar entidades detectadas.
- **Ejemplos Precargados:** Casos de uso reales (Urgencias, Quirúrgico, Historia Clínica).

### 📊 Modo Batch (Datos Estructurados)
- **Soporte CSV/Excel:** Procesa múltiples registros simultáneamente.
- **Anonimización Consistente:** Mantiene la coherencia de identificadores (mismo ID original = mismo pseudónimo) para estudios longitudinales.
- **Tabla de Correspondencia:** Genera un archivo separado para revertir el proceso si es necesario (re-identificación controlada).

### 🔒 Privacidad y Seguridad
- **Cero Dependencias Externas:** No requiere backend ni APIs en la nube.
- **Borrado Seguro:** Limpieza automática de sesión.

---

## 🚀 Despliegue en GitHub Pages

Esta aplicación está lista para ser desplegada gratuitamente en **GitHub Pages**.

### Instrucciones paso a paso:

1.  **Subir el código:** Sube este repositorio a tu cuenta de GitHub.
2.  **Configurar Pages:**
    *   Ve a la pestaña **Settings** (Configuración) de tu repositorio.
    *   En el menú lateral izquierdo, haz clic en **Pages**.
    *   En **Source**, selecciona `Deploy from a branch`.
    *   En **Branch**, selecciona `main` (o `master`) y la carpeta `/ (root)`.
    *   Haz clic en **Save**.
3.  **Listo:** En unos minutos, tu aplicación estará disponible en `https://tu-usuario.github.io/tu-repositorio/`.

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

## ⚠️ Aviso Legal y Educativo

**Esta herramienta es un proyecto educativo.**

*   **NO garantiza el cumplimiento normativo total** (RGPD, HIPAA, LOPDgdd) por sí misma.
*   Siempre debe haber una **revisión humana** de los resultados.
*   No debe usarse como único mecanismo de seguridad en entornos de producción crítica sin una auditoría previa.

---

**Desarrollado con ❤️ por Sophilux**
