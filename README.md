# Laboratorio de Privacidad Clínica by Sophilux

Herramienta web client-side para seudonimizar textos clínicos, permitiendo a sanitarios usar IAs generativas de forma segura.

## 🎯 Principios Clave

- **100% Client-Side**: Todo el procesamiento ocurre en el navegador. Ningún dato sale del dispositivo.
- **Zero-Friction**: No requiere instalación ni permisos especiales.
- **Educativo**: Cada funcionalidad enseña el "por qué" además del "qué".
- **Humanista**: Diseño cálido que evoca el Renacimiento, no tecnología fría.

## 🚀 Inicio Rápido

### Opción 1: Abrir directamente
Simplemente abre `index.html` en tu navegador (Chrome, Firefox o Edge).

### Opción 2: Servidor local (recomendado)
```powershell
# Desde el directorio del proyecto
python -m http.server 8000
```
Luego abre http://localhost:8000 en tu navegador.

## 📁 Estructura del Proyecto

```
laboratorio-privacidad-clinica/
├── index.html              # Landing page
├── app.html                # Aplicación principal
├── css/                    # Estilos CSS
│   ├── variables.css       # Sistema de diseño
│   ├── base.css            # Reset y tipografía
│   ├── components.css      # Componentes UI
│   ├── layout.css          # Grid y contenedores
│   └── landing.css         # Estilos de landing
├── js/                     # JavaScript (Fase 2)
├── assets/                 # Imágenes y recursos
├── lib/                    # Librerías locales
└── examples/               # Casos de ejemplo
```

## 🎨 Stack Técnico

- **HTML/CSS/JS Vanilla**: Sin frameworks para máxima compatibilidad
- **Tailwind CSS**: Para diseño responsive (CDN en desarrollo)
- **Google Fonts**: Cormorant Garamond + Inter
- **Material Symbols**: Iconografía
- **jsPDF**: Generación de informes (Fase 4)

## 📋 Estado del Desarrollo

### ✅ Fase 1: Estructura Base (COMPLETADO)
- [x] Estructura de carpetas
- [x] Sistema de diseño CSS
- [x] Landing page funcional
- [x] Página de aplicación base

### ✅ Fase 2: Motor de Procesamiento (COMPLETADO)
- [x] Tokenizador de texto avanzado
- [x] Patrones de detección (Nombres, fechas, lugares, identificadores)
- [x] Transformadores (Sustitución, Generalización)
- [x] Diccionarios extensos (INE, CCAA, etc.)

### ✅ Fase 3: Interfaz de Aplicación (COMPLETADO)
- [x] Flujo completo: Input -> Procesamiento -> Revisión
- [x] Highlighting dinámico de entidades
- [x] Panel de revisión interactivo
- [x] Persistencia de sesiones

### ✅ Fase 4: Exportación (COMPLETADO)
- [x] Copia segura al portapapeles
- [x] Generación de informes PDF profesionales
- [x] Metodología incluida en reportes

### ✅ Fase 5, 6 y 7: Pulido y Control (COMPLETADO)
- [x] Tooltips educativos y leyenda interactiva
- [x] Edición manual de entidades (Modificar/Restaurar)
- [x] Selección manual de texto no detectado
- [x] Barra de acciones optimizada (Action Bar)
- [x] Responsive design verificado

### ✅ Módulo Batch para Datos Estructurados (BETA)
- [x] Procesamiento de archivos CSV/Excel
- [x] Detección automática de columnas (NHC, DNI, fechas, etc.)
- [x] Mapeo consistente de IDs de paciente para seguimientos longitudinales
- [x] Generación de tabla de correspondencia reversible
- [x] Exportación a Excel (datos anonimizados + correspondencia)
- [x] Interfaz dedicada en `batch-structured.html`

**Acceso:** [batch-structured.html](./batch-structured.html) o desde el botón naranja en [app.html](./app.html)

## 🎨 Paleta de Colores

| Color | Hex | Uso |
|-------|-----|-----|
| Oro Rosa | `#B8897D` | Color principal |
| Crema | `#FAF8F5` | Fondo general |
| Piedra | `#2D2926` | Texto principal |
| Piedra Claro | `#6B635D` | Texto secundario |

## 🔤 Tipografía

- **Títulos**: Cormorant Garamond (serif)
- **Cuerpo**: Inter (sans-serif)
- **Código**: JetBrains Mono (monospace)

## 📖 Documentación

- `ESPECIFICACION_TECNICA.md`: Especificación técnica completa
- `INSTRUCCIONES_CLAUDE_CODE.md`: Guía de implementación por fases

## 🤝 Contribuir

Este proyecto está en desarrollo activo. Para contribuir:

1. Revisa `ESPECIFICACION_TECNICA.md` para entender la arquitectura
2. Sigue las fases definidas en `INSTRUCCIONES_CLAUDE_CODE.md`
3. Mantén el estilo de código consistente

## 📄 Licencia

© 2024 Sophilux. Todos los derechos reservados.

## 🔒 Privacidad

**Importante**: Esta herramienta procesa todos los datos localmente en tu navegador. Ningún dato clínico se transmite a servidores externos.

---

**Desarrollado con ❤️ por Sophilux**
