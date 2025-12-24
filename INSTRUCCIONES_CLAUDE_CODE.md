# Instrucciones de Inicio para Claude Code
## Laboratorio de Privacidad Clínica by Sophilux

---

## CONTEXTO DEL PROYECTO

**Qué es:** Herramienta web client-side para seudonimizar textos clínicos, permitiendo a sanitarios usar IAs generativas de forma segura.

**Principios clave:**
- 100% procesamiento en navegador (ningún dato sale del dispositivo)
- Zero-friction (no requiere instalación ni permisos)
- Educativo (cada función enseña el "por qué")
- Estética humanista (Renacimiento, no tech frío)

**Stack técnico:**
- HTML/CSS/JS vanilla (sin frameworks)
- GitHub Pages para hosting
- jsPDF para generación de informes

---

## ARCHIVOS DE REFERENCIA

1. **ESPECIFICACION_TECNICA.md** - Documento completo con:
   - Estructura de archivos
   - Sistema de diseño (colores, tipografía, componentes)
   - Especificación del motor de procesamiento
   - Patrones de detección RegEx
   - Estructura de datos
   - Casos de ejemplo JSON
   - Contenido educativo

2. **Mockups de referencia:**
   - Landing: Diseño con busto renacentista
   - App: Layout dos columnas (texto + panel revisión)

---

## FASES DE IMPLEMENTACIÓN

### FASE 1: Estructura Base
```
Objetivos:
1. Crear estructura de carpetas completa
2. Implementar sistema de diseño CSS (variables, base, components)
3. Crear landing page (index.html)
4. Integrar Google Fonts (Cormorant Garamond + Inter)

Archivos a crear:
- index.html
- css/variables.css
- css/base.css
- css/components.css
- css/layout.css
- css/landing.css

Entregable: Landing page funcional con diseño completo
```

### FASE 2: Motor de Procesamiento
```
Objetivos:
1. Implementar tokenizador de texto
2. Implementar patrones de detección
3. Implementar diccionarios de nombres/apellidos
4. Implementar transformadores
5. Crear orquestador principal

Archivos a crear:
- js/engine/processor.js
- js/engine/tokenizer.js
- js/engine/patterns/*.js
- js/engine/transformers/*.js
- js/engine/dictionaries/*.js

Entregable: Motor testeable desde consola
```

### FASE 3: Interfaz de Aplicación
```
Objetivos:
1. Crear layout de aplicación
2. Implementar editor de texto
3. Implementar vista previa con highlighting
4. Implementar panel de revisión
5. Crear casos de ejemplo

Archivos a crear:
- app.html
- css/app.css
- js/app.js
- js/ui/*.js
- examples/*.json

Entregable: App funcional completa (sin exportación)
```

### FASE 4: Exportación
```
Objetivos:
1. Implementar copia al portapapeles
2. Implementar generación de PDF
3. Diseñar informe de sesión

Archivos a crear:
- js/export/clipboard.js
- js/export/pdf-report.js
- lib/jspdf.umd.min.js

Entregable: Exportación funcional
```

### FASE 5: Pulido y Documentación
```
Objetivos:
1. Implementar tooltips educativos
2. Crear páginas de guía y términos
3. Responsive design
4. Testing cross-browser
5. Documentación

Archivos a crear:
- guia.html
- terminos.html
- js/ui/tooltips.js
- README.md

Entregable: Producto completo listo para beta
```

---

## PALETA DE COLORES PRINCIPAL

```css
--oro-rosa: #B8897D;           /* Color principal */
--oro-rosa-hover: #A67868;     /* Hover */
--bg-primary: #FAF8F5;         /* Fondo general */
--bg-card: #FFFFFF;            /* Cards */
--text-primary: #2D2926;       /* Texto principal */
--text-secondary: #6B635D;     /* Texto secundario */
```

---

## TIPOGRAFÍA

```css
--font-display: 'Cormorant Garamond', Georgia, serif;  /* Títulos */
--font-body: 'Inter', system-ui, sans-serif;           /* Cuerpo */
```

---

## CÓMO EMPEZAR

Para comenzar la Fase 1, copia este prompt:

```
Vamos a implementar el "Laboratorio de Privacidad Clínica by Sophilux".

FASE 1: Estructura Base

Necesito crear:
1. La estructura de carpetas del proyecto
2. El sistema de diseño CSS completo
3. La landing page (index.html)

Referencia de diseño:
- Paleta: oro rosa (#B8897D), crema (#FAF8F5), piedra (#2D2926)
- Tipografía: Cormorant Garamond (títulos), Inter (cuerpo)
- Estética: Renacimiento, humanismo, elegancia cálida

La landing debe incluir:
- Header con logo y navegación
- Hero con título "Inteligencia Artificial Segura para la Salud"
- Sección "Cómo funciona" (3 pasos)
- Sección "Qué protege el laboratorio" (cards)
- Sección CTA del curso
- Footer

Consulta ESPECIFICACION_TECNICA.md para detalles completos.
```

---

## NOTAS IMPORTANTES

1. **No usar CDNs externos** - Todo debe estar incluido localmente para funcionar en entornos hospitalarios restrictivos

2. **jsPDF** - Descargar desde npm y incluir como archivo local en `/lib/`

3. **Imágenes** - El busto renacentista del hero necesita ser una imagen de alta calidad

4. **Testing** - Probar en Chrome, Firefox y Edge antes de cada entrega de fase

5. **Mobile-first NO** - Esta herramienta se usa principalmente en desktop, pero debe ser usable en tablet

---

## CRITERIOS DE ACEPTACIÓN RÁPIDOS

- [ ] Landing page carga correctamente
- [ ] Colores coinciden con la paleta definida
- [ ] Tipografías cargan correctamente
- [ ] Motor procesa texto de ejemplo
- [ ] Panel de revisión muestra entidades
- [ ] Copia al portapapeles funciona
- [ ] PDF se genera y descarga
- [ ] No hay errores en consola
- [ ] Funciona sin conexión (tras carga inicial)

---

*Usa ESPECIFICACION_TECNICA.md como referencia principal*
