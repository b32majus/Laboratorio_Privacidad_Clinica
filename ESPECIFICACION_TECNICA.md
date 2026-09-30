# Laboratorio de Privacidad Clínica by Sophilux
## Especificación Técnica Completa para Implementación

> **SUPERSEDED (T25 #29, DOC-001):** este documento es un artefacto
> histórico (v1.0, diciembre 2024) que describe una arquitectura anterior a
> la V4 y contiene muestras de código obsoletas (p. ej. inferencia de género
> para pseudónimos, prohibida por `docs/specs/SPEC_V4_PRIVACY_ENGINE.md`
> §12). NO es autoridad vigente. La autoridad actual es: `CONTEXT.md`,
> `docs/shaping/CURRENT_DECISIONS.md`, `docs/specs/SPEC_V4_*.md` y
> `docs/governance/CANONICAL_AUTHORITY.md`. Se conserva sin editar como
> evidencia histórica.

**Versión:** 1.0 (histórica)  
**Fecha:** Diciembre 2024  
**Estado:** SUPERSEDED — no usar como autoridad

---

## 1. VISIÓN GENERAL

### 1.1 Propósito
Herramienta web client-side para asistir a profesionales sanitarios en la seudonimización de textos clínicos, permitiéndoles usar IAs generativas de forma segura.

### 1.2 Principios Fundamentales
- **100% Client-Side:** Todo el procesamiento ocurre en el navegador. Ningún dato sale del dispositivo.
- **Zero-Friction:** No requiere instalación, registro ni permisos especiales.
- **Educativo:** Cada funcionalidad enseña el "por qué" además del "qué".
- **Humanista:** Diseño cálido que evoca el Renacimiento, no tecnología fría.

### 1.3 Modelo de Distribución
- Versión pública gratuita en GitHub Pages (lead magnet)
- Versión premium para alumnos del curso (actualizaciones, más funcionalidades)

---

## 2. ARQUITECTURA DE ARCHIVOS

```
laboratorio-privacidad-clinica/
│
├── index.html                      # Landing page
├── app.html                        # Aplicación principal
├── guia.html                       # Guía de uso
├── terminos.html                   # Términos de uso
│
├── css/
│   ├── variables.css               # Sistema de diseño
│   ├── base.css                    # Reset y tipografía
│   ├── components.css              # Componentes UI
│   ├── layout.css                  # Grid y contenedores
│   ├── landing.css                 # Estilos de landing
│   ├── app.css                     # Estilos de aplicación
│   └── print.css                   # Estilos para impresión
│
├── js/
│   ├── app.js                      # Inicialización y estado
│   │
│   ├── engine/
│   │   ├── processor.js            # Orquestador principal
│   │   ├── tokenizer.js            # Tokenización de texto
│   │   ├── patterns/
│   │   │   ├── index.js            # Exporta todos los patrones
│   │   │   ├── nombres.js          # Detección de nombres
│   │   │   ├── fechas.js           # Detección de fechas
│   │   │   ├── identificadores.js  # DNI, NHC, teléfonos
│   │   │   ├── ubicaciones.js      # Direcciones, ciudades
│   │   │   └── contextuales.js     # Cuasi-identificadores
│   │   │
│   │   ├── transformers/
│   │   │   ├── index.js
│   │   │   ├── sustitucion.js      # Sustitución de nombres
│   │   │   ├── fechas.js           # Relativización temporal
│   │   │   ├── generalizacion.js   # Generalización geográfica
│   │   │   └── eliminacion.js      # Eliminación de IDs
│   │   │
│   │   └── dictionaries/
│   │       ├── nombres-mujer.js    # ~200 nombres femeninos
│   │       ├── nombres-hombre.js   # ~200 nombres masculinos
│   │       ├── apellidos.js        # ~300 apellidos
│   │       ├── hospitales.js       # Centros sanitarios
│   │       ├── provincias.js       # Geografía española
│   │       └── prefijos.js         # D., Dña., Dr., etc.
│   │
│   ├── ui/
│   │   ├── editor.js               # Área de entrada
│   │   ├── preview.js              # Vista previa con highlighting
│   │   ├── review-panel.js         # Panel de revisión
│   │   ├── entity-cards.js         # Cards de entidades
│   │   ├── tooltips.js             # Tooltips educativos
│   │   ├── modals.js               # Diálogos
│   │   ├── notifications.js        # Notificaciones toast
│   │   └── examples-loader.js      # Cargador de ejemplos
│   │
│   ├── export/
│   │   ├── clipboard.js            # Copiar al portapapeles
│   │   ├── pdf-report.js           # Generación PDF
│   │   └── session-data.js         # Datos de sesión
│   │
│   └── utils/
│       ├── storage.js              # LocalStorage
│       ├── date-utils.js           # Utilidades fecha
│       ├── text-utils.js           # Utilidades texto
│       └── id-generator.js         # Generador de IDs sesión
│
├── lib/
│   └── jspdf.umd.min.js            # Librería PDF (local)
│
├── examples/
│   ├── consulta-general.json       # Caso genérico simple
│   ├── informe-alta.json           # Informe de alta
│   ├── interconsulta.json          # Interconsulta
│   └── acta-reunion.json           # Acta clínica
│
├── assets/
│   ├── logo.svg                    # Logo Sophilux
│   ├── logo-small.svg              # Logo para header
│   ├── bust-renaissance.png        # Imagen hero
│   ├── favicon.ico
│   └── og-image.png                # Open Graph
│
└── docs/
    └── para-dpo.pdf                # Documento para DPOs
```

---

## 3. SISTEMA DE DISEÑO

### 3.1 Paleta de Colores

```css
:root {
  /* ===== COLORES PRIMARIOS ===== */
  --oro-rosa: #B8897D;
  --oro-rosa-hover: #A67868;
  --oro-rosa-light: #D4AFA6;
  --oro-rosa-ultra-light: #F5E6D3;
  
  /* ===== FONDOS ===== */
  --bg-primary: #FAF8F5;
  --bg-card: #FFFFFF;
  --bg-elevated: #FFFFFF;
  --bg-dark: #3D3633;
  --bg-dark-hover: #2D2926;
  
  /* ===== TEXTO ===== */
  --text-primary: #2D2926;
  --text-secondary: #6B635D;
  --text-muted: #9B958F;
  --text-inverse: #FFFFFF;
  
  /* ===== HIGHLIGHTING EN TEXTO PROCESADO ===== */
  --hl-nombre: #F5E6D3;        /* Beige cálido */
  --hl-edad: #E8F0E8;          /* Verde muy suave */
  --hl-fecha: #E3F2FD;         /* Azul muy suave */
  --hl-profesion: #E8E4F0;     /* Lavanda suave */
  --hl-direccion: #FFF3E0;     /* Naranja muy suave */
  --hl-identificador: #F5F5F5; /* Gris muy suave */
  --hl-revisar: #FFF8E1;       /* Amarillo muy suave */
  
  /* ===== PUNTOS DE LEYENDA ===== */
  --dot-sustituido: #4CAF50;
  --dot-relativizado: #2196F3;
  --dot-eliminado: #9E9E9E;
  --dot-revisar: #FF9800;
  
  /* ===== ESTADOS FUNCIONALES ===== */
  --success: #4CAF50;
  --success-light: #E8F5E9;
  --warning: #FF9800;
  --warning-light: #FFF3E0;
  --error: #E53935;
  --error-light: #FFEBEE;
  --info: #2196F3;
  --info-light: #E3F2FD;
  
  /* ===== BORDES ===== */
  --border-light: #E8E4E0;
  --border-medium: #D4D0CC;
  
  /* ===== SOMBRAS ===== */
  --shadow-sm: 0 1px 2px rgba(45, 41, 38, 0.05);
  --shadow-md: 0 4px 12px rgba(45, 41, 38, 0.08);
  --shadow-lg: 0 8px 24px rgba(45, 41, 38, 0.12);
  --shadow-card: 0 2px 8px rgba(45, 41, 38, 0.06);
}
```

### 3.2 Tipografía

```css
:root {
  /* ===== FAMILIAS ===== */
  --font-display: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  
  /* ===== TAMAÑOS ===== */
  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.875rem;     /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.25rem;      /* 20px */
  --text-2xl: 1.5rem;      /* 24px */
  --text-3xl: 1.875rem;    /* 30px */
  --text-4xl: 2.25rem;     /* 36px */
  --text-5xl: 3rem;        /* 48px */
  
  /* ===== PESOS ===== */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  
  /* ===== ALTURAS DE LÍNEA ===== */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}

/* Aplicación de tipografías */
h1, h2, h3 {
  font-family: var(--font-display);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

body, p, span, div {
  font-family: var(--font-body);
  font-weight: var(--font-normal);
  color: var(--text-primary);
  line-height: var(--leading-normal);
}

code, .mono {
  font-family: var(--font-mono);
}
```

### 3.3 Espaciado

```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
  --space-24: 6rem;     /* 96px */
}
```

### 3.4 Bordes y Radios

```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}
```

### 3.5 Transiciones

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;
}
```

---

## 4. COMPONENTES UI

### 4.1 Botones

```css
/* Botón primario */
.btn-primary {
  background: var(--oro-rosa);
  color: var(--text-inverse);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-weight: var(--font-medium);
  font-size: var(--text-base);
  border: none;
  cursor: pointer;
  transition: background var(--transition-normal);
}

.btn-primary:hover {
  background: var(--oro-rosa-hover);
}

/* Botón secundario */
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-medium);
  cursor: pointer;
  transition: all var(--transition-normal);
}

.btn-secondary:hover {
  background: var(--bg-card);
  border-color: var(--oro-rosa);
}

/* Botón texto */
.btn-text {
  background: transparent;
  color: var(--oro-rosa);
  padding: var(--space-2) var(--space-3);
  border: none;
  cursor: pointer;
  font-weight: var(--font-medium);
}

.btn-text:hover {
  text-decoration: underline;
}
```

### 4.2 Cards

```css
.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--border-light);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.card-icon {
  width: 40px;
  height: 40px;
  background: var(--oro-rosa-ultra-light);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--oro-rosa);
}

.card-title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  color: var(--text-primary);
  margin: 0;
}

.card-description {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
}
```

### 4.3 Entity Cards (Panel de Revisión)

```css
.entity-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-3);
}

.entity-card:hover {
  border-color: var(--oro-rosa-light);
}

.entity-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.entity-icon {
  font-size: var(--text-lg);
}

.entity-value {
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.entity-type {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: var(--bg-primary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.entity-context {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding: var(--space-2);
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  margin-top: var(--space-2);
}

.entity-context mark {
  background: var(--hl-nombre);
  padding: 0 2px;
  border-radius: 2px;
}
```

### 4.4 Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  font-weight: var(--font-medium);
}

.badge-success {
  background: var(--success-light);
  color: var(--success);
}

.badge-warning {
  background: var(--warning-light);
  color: var(--warning);
}

.badge-info {
  background: var(--info-light);
  color: var(--info);
}

.badge-neutral {
  background: var(--bg-primary);
  color: var(--text-secondary);
}
```

### 4.5 Inputs y Textareas

```css
.input, .textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--text-primary);
  background: var(--bg-card);
  transition: border-color var(--transition-normal);
}

.input:focus, .textarea:focus {
  outline: none;
  border-color: var(--oro-rosa);
  box-shadow: 0 0 0 3px var(--oro-rosa-ultra-light);
}

.textarea {
  min-height: 200px;
  resize: vertical;
  line-height: var(--leading-relaxed);
}

.input::placeholder, .textarea::placeholder {
  color: var(--text-muted);
}
```

### 4.6 Leyenda de Colores

```css
.legend {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
}

.legend-dot.sustituido { background: var(--dot-sustituido); }
.legend-dot.relativizado { background: var(--dot-relativizado); }
.legend-dot.eliminado { background: var(--dot-eliminado); }
.legend-dot.revisar { background: var(--dot-revisar); }
```

### 4.7 Progress Bar

```css
.progress-container {
  margin-bottom: var(--space-2);
}

.progress-bar {
  height: 6px;
  background: var(--border-light);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--oro-rosa);
  border-radius: var(--radius-full);
  transition: width var(--transition-slow);
}

.progress-text {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-top: var(--space-1);
}
```

### 4.8 Session Indicator

```css
.session-indicator {
  padding: var(--space-3);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
}

.session-id {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.session-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--success);
}

.session-status::before {
  content: '';
  width: 6px;
  height: 6px;
  background: var(--success);
  border-radius: var(--radius-full);
}

.session-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-light);
  font-size: var(--text-xs);
  color: var(--text-muted);
}
```

---

## 5. LAYOUTS

### 5.1 Landing Page Layout

```html
<body class="landing">
  <header class="header">
    <nav class="nav container">
      <a href="/" class="logo">
        <img src="assets/logo.svg" alt="Sophilux">
      </a>
      <div class="nav-links">
        <a href="#como-funciona">Cómo Funciona</a>
        <a href="guia.html">Guía</a>
        <a href="terminos.html">Términos</a>
      </div>
      <a href="app.html" class="btn-primary">Empezar</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="container hero-grid">
        <div class="hero-content">
          <span class="badge badge-info">Client-Side Secure</span>
          <h1>Inteligencia Artificial<br><em>Segura</em> para la Salud</h1>
          <p>Protege la identidad de tus pacientes mientras aprovechas 
             el poder de la IA Generativa.</p>
          <div class="hero-ctas">
            <a href="app.html" class="btn-primary">Comenzar Seudonimización</a>
            <a href="#demo" class="btn-secondary">Ver Demostración</a>
          </div>
        </div>
        <div class="hero-image">
          <img src="assets/bust-renaissance.png" alt="Renaissance of Privacy">
        </div>
      </div>
    </section>

    <section class="how-it-works" id="como-funciona">
      <!-- 3 pasos -->
    </section>

    <section class="what-we-protect">
      <!-- Cards de tipos de datos -->
    </section>

    <section class="course-cta">
      <!-- CTA del curso Sophilux -->
    </section>
  </main>

  <footer class="footer">
    <!-- Footer content -->
  </footer>
</body>
```

### 5.2 App Layout

```html
<body class="app">
  <header class="app-header">
    <a href="index.html" class="back-link">← Inicio</a>
    <h1 class="app-title">Revisión Clínica</h1>
    <div class="header-actions">
      <button class="btn-icon" aria-label="Descargar">↓</button>
    </div>
  </header>

  <main class="app-main">
    <div class="app-grid">
      <!-- Panel izquierdo: Editor/Preview -->
      <section class="panel-main">
        <div class="editor-container" id="editor-view">
          <textarea class="textarea" placeholder="Pegue aquí el texto clínico..."></textarea>
          <div class="editor-actions">
            <button class="btn-secondary" id="load-example">Cargar ejemplo</button>
            <button class="btn-primary" id="process-btn">Procesar texto</button>
          </div>
        </div>
        
        <div class="preview-container hidden" id="preview-view">
          <div class="preview-text" id="preview-text">
            <!-- Texto con highlighting -->
          </div>
          <div class="preview-actions">
            <button class="btn-secondary" id="copy-btn">Copiar resultado</button>
            <button class="btn-primary" id="download-pdf">Descargar informe PDF</button>
          </div>
        </div>
      </section>

      <!-- Panel derecho: Revisión -->
      <aside class="panel-sidebar">
        <div class="sidebar-section">
          <h3 class="sidebar-title">≡ PENDIENTE DE REVISIÓN</h3>
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" style="width: 25%"></div>
            </div>
            <span class="progress-text">3 de 12 entidades revisadas</span>
          </div>
        </div>

        <div class="sidebar-section entity-list" id="entity-list">
          <!-- Entity cards generadas dinámicamente -->
        </div>

        <div class="sidebar-section">
          <h4 class="section-subtitle">LEYENDA</h4>
          <div class="legend">
            <div class="legend-item">
              <span class="legend-dot sustituido"></span>
              <span>Sustituido</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot relativizado"></span>
              <span>Relativizado</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot eliminado"></span>
              <span>Eliminado</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot revisar"></span>
              <span>Revisar</span>
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="session-indicator">
            <div class="session-id">🔒 Sesión #CL-2024-89</div>
            <div class="session-status">Local (Seguro)</div>
            <div class="session-meta">
              <span>ID: proc_8829a</span>
              <span>Modelo: Std</span>
              <span>T: 1.2s</span>
              <span>Exp: JSON</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </main>
</body>
```

### 5.3 CSS Grid para App

```css
.app-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: var(--space-6);
  height: calc(100vh - 64px); /* Restamos header */
  padding: var(--space-6);
}

.panel-main {
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  overflow: auto;
}

.panel-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow-y: auto;
}

.sidebar-section {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  border: 1px solid var(--border-light);
}

/* Responsive: móvil */
@media (max-width: 1024px) {
  .app-grid {
    grid-template-columns: 1fr;
    height: auto;
  }
  
  .panel-sidebar {
    order: -1; /* Panel de revisión arriba en móvil */
  }
}
```

---

## 6. MOTOR DE PROCESAMIENTO

### 6.1 Flujo de Datos

```
ENTRADA: string (texto clínico crudo)
    │
    ▼
┌─────────────────────────────────────────────────┐
│                  PROCESSOR.JS                    │
│                                                  │
│  1. tokenizer.tokenize(texto)                   │
│     → Array de tokens con posiciones            │
│                                                  │
│  2. Para cada patrón en patterns/*:             │
│     pattern.detect(tokens)                       │
│     → Marca tokens con tipo detectado           │
│                                                  │
│  3. resolver.resolveConflicts(tokens)           │
│     → Resuelve cuando múltiples patrones        │
│       detectan el mismo token                   │
│                                                  │
│  4. Para cada token marcado:                    │
│     transformer.transform(token)                 │
│     → Genera valor transformado                 │
│                                                  │
│  5. generator.buildOutput(tokens)               │
│     → Construye texto final + metadata          │
└─────────────────────────────────────────────────┘
    │
    ▼
SALIDA: ProcessingResult {
  original: string,
  processed: string,
  entities: Entity[],
  alerts: Alert[],
  stats: Statistics,
  sessionId: string
}
```

### 6.2 Interfaces de Datos

```javascript
// Resultado del procesamiento
interface ProcessingResult {
  original: string;
  processed: string;
  entities: Entity[];
  alerts: Alert[];
  stats: Statistics;
  sessionId: string;
  timestamp: Date;
  processingTime: number;
}

// Entidad detectada
interface Entity {
  id: string;
  type: 'NOMBRE' | 'FECHA' | 'IDENTIFICADOR' | 'UBICACION' | 'PROFESION' | 'EDAD';
  original: string;
  transformed: string;
  position: {
    start: number;
    end: number;
  };
  context: string;  // Fragmento de texto alrededor
  confidence: number;  // 0-1
  requiresReview: boolean;
  reviewed: boolean;
  approved: boolean;
}

// Alerta de cuasi-identificador
interface Alert {
  id: string;
  type: 'CUASI_IDENTIFICADOR' | 'COMBINACION_RIESGO' | 'CONTEXTO_SENSIBLE';
  text: string;
  position: {
    start: number;
    end: number;
  };
  reason: string;
  suggestedAction: 'REVIEW' | 'REMOVE' | 'GENERALIZE';
}

// Estadísticas
interface Statistics {
  totalEntities: number;
  byType: {
    nombres: number;
    fechas: number;
    identificadores: number;
    ubicaciones: number;
  };
  requiresReview: number;
  reviewed: number;
}
```

### 6.3 Patrones de Detección

#### nombres.js
```javascript
export const nombresPattern = {
  name: 'nombres',
  
  // Expresiones regulares
  patterns: {
    // Después de prefijos de tratamiento
    conPrefijo: /(?:D\.|Dña\.|Don|Doña|Sr\.|Sra\.|Srta\.)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})/g,
    
    // Después de indicadores de paciente
    conIndicador: /(?:paciente|enfermo|enferma|usuario|usuaria|el\/la\s+(?:sr|sra))\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})/gi,
    
    // Nombre compuesto (María del Carmen, José Luis)
    compuesto: /\b((?:María|Jose|Juan|Ana|Luis|Carmen)\s+(?:del?|de\s+la|de\s+los)?\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/gi,
    
    // Patrón Nombre + Apellido + Apellido
    completo: /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\b/g,
    
    // Abreviaturas: Mª, Fco., Jº
    abreviado: /\b((?:Mª|M\.|Fco\.|Jº)\s*[A-ZÁÉÍÓÚÑ]?[a-záéíóúñ]*(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})/g
  },
  
  // Contextos de exclusión (NO son pacientes)
  exclusions: [
    /(?:Dr\.|Dra\.|Doctor|Doctora|firmado|firma|elaborado\s+por|redactado\s+por)\s*/i
  ],
  
  detect(tokens) {
    const entities = [];
    // Implementación...
    return entities;
  }
};
```

#### fechas.js
```javascript
export const fechasPattern = {
  name: 'fechas',
  
  patterns: {
    // dd/mm/yyyy o dd-mm-yyyy
    numerico: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g,
    
    // "12 de mayo de 2024"
    textoCompleto: /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})\b/gi,
    
    // "mayo 2024"
    mesAño: /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})\b/gi,
    
    // Años aislados relevantes
    añoContextual: /(?:desde|en|año|nacido\s+en|diagnosticado\s+en)\s+(\d{4})\b/gi
  },
  
  transform(fecha, fechaReferencia = new Date()) {
    const diff = this.calcularDiferencia(fecha, fechaReferencia);
    
    if (diff.dias === 0) return '[hoy]';
    if (diff.dias === 1) return '[ayer]';
    if (diff.dias < 7) return `[hace ${diff.dias} días]`;
    if (diff.dias < 30) return `[hace ${Math.floor(diff.dias / 7)} semanas]`;
    if (diff.dias < 365) return `[hace ${Math.floor(diff.dias / 30)} meses]`;
    return `[hace ${Math.floor(diff.dias / 365)} años]`;
  },
  
  calcularDiferencia(fecha1, fecha2) {
    const diffTime = Math.abs(fecha2 - fecha1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { dias: diffDays };
  }
};
```

#### identificadores.js
```javascript
export const identificadoresPattern = {
  name: 'identificadores',
  
  patterns: {
    // DNI español
    dni: /\b\d{8}[A-Z]\b/gi,
    
    // NIE
    nie: /\b[XYZ]\d{7}[A-Z]\b/gi,
    
    // NHC (múltiples formatos)
    nhc: /(?:NHC|N\.?H\.?C\.?|Historia|Hª|HC)\s*:?\s*#?(\d{5,12})/gi,
    
    // SIP
    sip: /(?:SIP|N\.?SIP|NASS)\s*:?\s*(\d{10,14})/gi,
    
    // Tarjeta sanitaria
    tarjeta: /(?:tarjeta\s+sanitaria|TS|CIP)\s*:?\s*([A-Z]{2,4}\d{10,14})/gi,
    
    // Teléfono español
    telefono: /(?:\+34\s?)?(?:6\d{2}|7[1-9]\d|9\d{2})[\s\.\-]?\d{3}[\s\.\-]?\d{3}\b/g,
    
    // Email
    email: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    
    // NSS (Número Seguridad Social)
    nss: /\b\d{2}[\s\-]?\d{8}[\s\-]?\d{2}\b/g
  },
  
  transform(tipo, valor) {
    const marcadores = {
      dni: '[DNI_ELIMINADO]',
      nie: '[NIE_ELIMINADO]',
      nhc: '[NHC_ELIMINADO]',
      sip: '[SIP_ELIMINADO]',
      tarjeta: '[TS_ELIMINADO]',
      telefono: '[TELÉFONO_ELIMINADO]',
      email: '[EMAIL_ELIMINADO]',
      nss: '[NSS_ELIMINADO]'
    };
    return marcadores[tipo] || '[ID_ELIMINADO]';
  }
};
```

#### ubicaciones.js
```javascript
export const ubicacionesPattern = {
  name: 'ubicaciones',
  
  patterns: {
    // Dirección completa
    direccion: /(?:C\/|Calle|Avda\.|Avenida|Plaza|Pza\.|Paseo|Camino|Carretera)\s+[^,\.\n]+(?:,?\s*(?:nº?|núm\.?|número)?\s*\d{1,4})?(?:\s*,?\s*(?:\d{1,2}º?|bajo|ático|entresuelo))?/gi,
    
    // Código postal
    cp: /\b\d{5}\b/g,
    
    // Centro sanitario
    centro: /(?:Hospital|H\.|Clínica|Centro\s+de\s+Salud|CS\s|CAP\s|Ambulatorio|Consultorio)\s+(?:Universitario\s+)?[A-ZÁÉÍÓÚÑ][^,\.\n]{2,40}/gi,
    
    // Municipio/Ciudad (requiere diccionario)
    municipio: null  // Se detecta cruzando con diccionario
  },
  
  // Mapeo de provincias a CCAA para generalización
  provinciasACCAA: {
    'Madrid': 'Comunidad de Madrid',
    'Barcelona': 'Cataluña',
    'Valencia': 'Comunidad Valenciana',
    // ... etc
  },
  
  transform(ubicacion, nivel = 'CCAA') {
    // Detectar provincia y generalizar
    const provincia = this.detectarProvincia(ubicacion);
    if (provincia && nivel === 'CCAA') {
      return `[${this.provinciasACCAA[provincia]}]`;
    }
    return '[UBICACIÓN]';
  }
};
```

#### contextuales.js
```javascript
export const contextualesPattern = {
  name: 'contextuales',
  
  // Patrones que generan ALERTAS, no transformaciones automáticas
  alertPatterns: [
    {
      pattern: /(?:único|única|solo|sola)\s+(?:paciente|caso|persona)/gi,
      reason: 'Referencia a unicidad puede ser identificadora',
      action: 'REVIEW'
    },
    {
      pattern: /(?:alcalde|concejal|director|presidente|gerente)\s+(?:del?|de\s+la)/gi,
      reason: 'Cargo público fácilmente identificable',
      action: 'REVIEW'
    },
    {
      pattern: /(?:trabaja|empleado|funcionario|trabajador)\s+(?:en|del?)\s+(?:el|la)\s+[^,\.]{5,30}/gi,
      reason: 'Lugar de trabajo específico puede identificar',
      action: 'REVIEW'
    },
    {
      pattern: /enfermedad(?:es)?\s+(?:rara|ultra[\s\-]?rara|huérfana|poco\s+frecuente)/gi,
      reason: 'Enfermedades muy raras pueden identificar por su baja prevalencia',
      action: 'REVIEW'
    },
    {
      pattern: /(?:gemelo|trillizo|mellizo)/gi,
      reason: 'Nacimientos múltiples son estadísticamente identificables',
      action: 'REVIEW'
    },
    {
      pattern: /(?:el|la)\s+(?:hermano|hermana|padre|madre|hijo|hija|esposo|esposa|marido|mujer)\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ]/gi,
      reason: 'Relación familiar con nombre propio',
      action: 'DETECT_NAME'
    }
  ],
  
  detect(texto) {
    const alerts = [];
    
    for (const {pattern, reason, action} of this.alertPatterns) {
      let match;
      while ((match = pattern.exec(texto)) !== null) {
        alerts.push({
          id: generateId(),
          type: 'CUASI_IDENTIFICADOR',
          text: match[0],
          position: {
            start: match.index,
            end: match.index + match[0].length
          },
          reason,
          suggestedAction: action
        });
      }
    }
    
    return alerts;
  }
};
```

### 6.4 Asignador de Sustitutos

```javascript
// transformers/sustitucion.js

import { NOMBRES_MUJER } from '../dictionaries/nombres-mujer.js';
import { NOMBRES_HOMBRE } from '../dictionaries/nombres-hombre.js';
import { APELLIDOS } from '../dictionaries/apellidos.js';

export class AsignadorSustitutos {
  constructor() {
    this.mapaAsignaciones = new Map();
    this.nombresUsados = { M: new Set(), F: new Set() };
    this.apellidosUsados = new Set();
  }
  
  // Resetear para nueva sesión
  reset() {
    this.mapaAsignaciones.clear();
    this.nombresUsados = { M: new Set(), F: new Set() };
    this.apellidosUsados.clear();
  }
  
  // Obtener o generar sustituto
  obtenerSustituto(nombreOriginal, genero = null) {
    // Si ya existe asignación, devolverla
    const key = nombreOriginal.toLowerCase().trim();
    if (this.mapaAsignaciones.has(key)) {
      return this.mapaAsignaciones.get(key);
    }
    
    // Detectar género si no se proporciona
    const generoDetectado = genero || this.detectarGenero(nombreOriginal);
    
    // Generar nuevo sustituto
    const nuevoNombre = this.seleccionarNombre(generoDetectado);
    const apellido1 = this.seleccionarApellido();
    const apellido2 = this.seleccionarApellido();
    
    const sustituto = `${nuevoNombre} ${apellido1} ${apellido2}`;
    
    this.mapaAsignaciones.set(key, sustituto);
    return sustituto;
  }
  
  detectarGenero(nombre) {
    const primerNombre = nombre.split(' ')[0].toLowerCase();
    
    // Terminaciones típicas femeninas en español
    if (primerNombre.endsWith('a') || primerNombre.endsWith('ía')) {
      return 'F';
    }
    
    // Excepciones masculinas terminadas en 'a'
    const excepcionesMasculinas = ['garcía', 'borja', 'josema', 'garcia'];
    if (excepcionesMasculinas.includes(primerNombre)) {
      return 'M';
    }
    
    return 'M'; // Por defecto masculino
  }
  
  seleccionarNombre(genero) {
    const lista = genero === 'F' ? NOMBRES_MUJER : NOMBRES_HOMBRE;
    const usados = this.nombresUsados[genero];
    
    // Buscar uno no usado
    for (const nombre of lista) {
      if (!usados.has(nombre)) {
        usados.add(nombre);
        return nombre;
      }
    }
    
    // Si todos usados, seleccionar aleatorio
    return lista[Math.floor(Math.random() * lista.length)];
  }
  
  seleccionarApellido() {
    for (const apellido of APELLIDOS) {
      if (!this.apellidosUsados.has(apellido)) {
        this.apellidosUsados.add(apellido);
        return apellido;
      }
    }
    return APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
  }
  
  // Obtener tabla de mapeo para el informe
  obtenerMapeo() {
    return Array.from(this.mapaAsignaciones.entries()).map(([original, sustituto]) => ({
      original,
      sustituto
    }));
  }
}
```

---

## 7. GENERACIÓN DE PDF

### 7.1 Estructura del Informe

```javascript
// export/pdf-report.js

export class PDFReportGenerator {
  constructor(jsPDF) {
    this.jsPDF = jsPDF;
  }
  
  generate(processingResult) {
    const doc = new this.jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = margin;
    
    // === HEADER ===
    // Logo (placeholder - usar imagen base64)
    doc.setFontSize(10);
    doc.setTextColor(184, 137, 125); // oro-rosa
    doc.text('SOPHILUX', margin, y);
    
    y += 15;
    
    // Título
    doc.setFontSize(18);
    doc.setTextColor(45, 41, 38);
    doc.text('INFORME DE SESIÓN', margin, y);
    
    y += 8;
    doc.setFontSize(12);
    doc.setTextColor(107, 99, 93);
    doc.text('Laboratorio de Privacidad Clínica', margin, y);
    
    y += 15;
    
    // === LÍNEA SEPARADORA ===
    doc.setDrawColor(232, 228, 224);
    doc.line(margin, y, pageWidth - margin, y);
    
    y += 10;
    
    // === METADATOS ===
    doc.setFontSize(10);
    doc.setTextColor(107, 99, 93);
    doc.text(`Fecha de procesamiento: ${this.formatDate(processingResult.timestamp)}`, margin, y);
    y += 6;
    doc.text(`ID de sesión: ${processingResult.sessionId}`, margin, y);
    y += 6;
    doc.text(`Tiempo de procesamiento: ${processingResult.processingTime}ms`, margin, y);
    
    y += 15;
    
    // === RESUMEN DE TRANSFORMACIONES ===
    doc.setFontSize(12);
    doc.setTextColor(45, 41, 38);
    doc.text('RESUMEN DE TRANSFORMACIONES', margin, y);
    
    y += 10;
    
    // Tabla de estadísticas
    const stats = processingResult.stats;
    const tableData = [
      ['Tipo', 'Cantidad', 'Estado'],
      ['Nombres sustituidos', stats.byType.nombres.toString(), '✓ Completado'],
      ['Fechas relativizadas', stats.byType.fechas.toString(), '✓ Completado'],
      ['Identificadores eliminados', stats.byType.identificadores.toString(), '✓ Completado'],
      ['Ubicaciones generalizadas', stats.byType.ubicaciones.toString(), '✓ Completado'],
      ['Elementos revisados', stats.reviewed.toString(), stats.reviewed === stats.requiresReview ? '✓ Completado' : '⚠ Pendiente']
    ];
    
    doc.autoTable({
      startY: y,
      head: [tableData[0]],
      body: tableData.slice(1),
      margin: { left: margin },
      styles: {
        fontSize: 9,
        cellPadding: 4
      },
      headStyles: {
        fillColor: [184, 137, 125],
        textColor: 255
      }
    });
    
    y = doc.lastAutoTable.finalY + 15;
    
    // === ELEMENTOS REVISADOS MANUALMENTE ===
    if (processingResult.alerts.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(45, 41, 38);
      doc.text('ELEMENTOS REVISADOS MANUALMENTE', margin, y);
      
      y += 10;
      
      processingResult.alerts.forEach((alert, index) => {
        doc.setFontSize(10);
        doc.setTextColor(45, 41, 38);
        doc.text(`${index + 1}. "${alert.text}"`, margin, y);
        y += 5;
        doc.setTextColor(107, 99, 93);
        doc.text(`   Motivo: ${alert.reason}`, margin, y);
        y += 5;
        doc.text(`   Decisión: ${alert.approved ? 'Aprobado' : 'Pendiente'}`, margin, y);
        y += 8;
      });
    }
    
    y += 10;
    
    // === AVISO IMPORTANTE ===
    doc.setDrawColor(232, 228, 224);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(45, 41, 38);
    doc.text('AVISO IMPORTANTE', margin, y);
    y += 8;
    
    doc.setFontSize(9);
    doc.setTextColor(107, 99, 93);
    const aviso = [
      'Este informe documenta el procesamiento realizado pero NO garantiza',
      'la anonimización completa del texto. La responsabilidad final de verificar',
      'la adecuación del resultado recae en el profesional usuario.',
      '',
      'Esta herramienta es un asistente de aprendizaje,',
      'no un sistema certificado de anonimización.'
    ];
    
    aviso.forEach(line => {
      doc.text(line, margin, y);
      y += 5;
    });
    
    // === FOOTER ===
    y = doc.internal.pageSize.getHeight() - 20;
    doc.setDrawColor(232, 228, 224);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    
    doc.setFontSize(8);
    doc.setTextColor(155, 149, 143);
    doc.text('Generado por Laboratorio de Privacidad Clínica', margin, y);
    doc.text('© 2026 Sophilux · www.sophilux.com', pageWidth - margin - 60, y);
    
    return doc;
  }
  
  formatDate(date) {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }
}
```

---

## 8. CASOS DE EJEMPLO (JSON)

### 8.1 Consulta General

```json
{
  "id": "consulta-general-001",
  "titulo": "Nota de Consulta General",
  "especialidad": "Transversal",
  "descripcion": "Nota de primera consulta con datos básicos del paciente",
  "complejidad": "baja",
  "texto": "María García López, 54 años, NHC 4521987, acude a consulta el 15/03/2024 por dolor abdominal de 48h de evolución.\n\nAntecedentes: HTA controlada con Enalapril 10mg. DM tipo 2 en tratamiento con Metformina.\n\nExploración: Abdomen blando, depresible, dolor a la palpación en FID. No signos de irritación peritoneal.\n\nJuicio clínico: Sospecha de apendicitis aguda.\n\nPlan: Derivación a Urgencias del Hospital Universitario de Badajoz.\n\nDra. Carmen Ruiz Fernández\nMédico de Familia\nCentro de Salud San Fernando\nC/ Mayor 123, Badajoz",
  "entidadesEsperadas": {
    "nombres": ["María García López", "Carmen Ruiz Fernández"],
    "fechas": ["15/03/2024"],
    "identificadores": ["NHC 4521987"],
    "ubicaciones": ["Hospital Universitario de Badajoz", "Centro de Salud San Fernando", "C/ Mayor 123, Badajoz"]
  },
  "notasEducativas": {
    "nombres": "Se detectan dos nombres: la paciente (María García) y la médico firmante (Dra. Carmen Ruiz). La médico se excluye por contexto de firma.",
    "fechas": "La fecha se relativiza manteniendo la utilidad temporal para el contexto clínico.",
    "ubicaciones": "Tanto el hospital como el centro de salud y la dirección se generalizan a nivel regional."
  },
  "moduloRelacionado": "2.1"
}
```

### 8.2 Informe de Alta

```json
{
  "id": "informe-alta-001",
  "titulo": "Informe de Alta Hospitalaria",
  "especialidad": "Transversal",
  "descripcion": "Informe completo de alta con múltiples fechas y referencias",
  "complejidad": "media",
  "texto": "INFORME DE ALTA\n\nDatos del paciente:\nNombre: Juan Pérez Martínez\nNHC: 789456123\nFecha nacimiento: 12/05/1968\nDNI: 12345678A\nDirección: Avda. de la Constitución 45, 3ºB, 06001 Badajoz\nTeléfono: 654 321 987\n\nFechas de ingreso: 10/01/2024\nFecha de alta: 18/01/2024\n\nMotivo de ingreso:\nPaciente que ingresa el 10/01/2024 procedente de Urgencias por cuadro de dolor torácico.\n\nEvolución:\nDurante su estancia se realizó cateterismo cardíaco el 12/01/2024 evidenciando lesión en DA. Se implantó stent farmacoactivo el 13/01/2024 sin complicaciones.\n\nTratamiento al alta:\n- AAS 100mg c/24h\n- Clopidogrel 75mg c/24h\n- Atorvastatina 80mg c/24h\n\nRevisión en consultas externas de Cardiología en 30 días.\n\nMédico responsable: Dr. Antonio Sánchez López\nServicio de Cardiología\nHospital Infanta Cristina, Badajoz",
  "entidadesEsperadas": {
    "nombres": ["Juan Pérez Martínez", "Antonio Sánchez López"],
    "fechas": ["12/05/1968", "10/01/2024", "18/01/2024", "12/01/2024", "13/01/2024"],
    "identificadores": ["789456123", "12345678A", "654 321 987"],
    "ubicaciones": ["Avda. de la Constitución 45, 3ºB, 06001 Badajoz", "Hospital Infanta Cristina, Badajoz"]
  },
  "notasEducativas": {
    "fechas": "Este caso tiene múltiples fechas. La fecha de nacimiento se mantiene como edad. Las fechas de procedimientos mantienen sus intervalos relativos.",
    "identificadores": "Se eliminan todos los identificadores únicos: NHC, DNI y teléfono."
  },
  "moduloRelacionado": "3.1"
}
```

### 8.3 Acta de Reunión Clínica

```json
{
  "id": "acta-reunion-001",
  "titulo": "Acta de Comité de Tumores",
  "especialidad": "Oncología",
  "descripcion": "Acta con múltiples pacientes y profesionales",
  "complejidad": "alta",
  "texto": "ACTA COMITÉ DE TUMORES\nHospital Universitario Virgen del Rocío\nSevilla, 20 de noviembre de 2024\n\nAsistentes:\n- Dr. Miguel Ángel Torres (Oncología Médica)\n- Dra. Laura Vega Ruiz (Cirugía General)\n- Dr. Francisco Mora (Radiología)\n- Dra. Ana Belén Castro (Anatomía Patológica)\n\nCASO 1:\nPaciente: Rosa María Jiménez Delgado, 67 años\nNHC: 445566778\nDiagnóstico: Adenocarcinoma de colon estadio IIIB\nDecisión: Cirugía + QT adyuvante FOLFOX\n\nCASO 2:\nPaciente: Pedro Navarro Soto, 72 años\nNHC: 998877665\nDiagnóstico: Carcinoma hepatocelular sobre cirrosis\nDecisión: Valorar TACE. Contraindicada cirugía por Child B.\n\nCASO 3:\nPaciente: Carmen López Vidal, 45 años\nNHC: 112233445\nDiagnóstico: Ca. mama triple negativo\nDecisión: QT neoadyuvante + cirugía conservadora.\n\nPróxima reunión: 27 de noviembre de 2024\n\nFirma: Dr. Miguel Ángel Torres\nCoordinador del Comité",
  "entidadesEsperadas": {
    "nombres": ["Miguel Ángel Torres", "Laura Vega Ruiz", "Francisco Mora", "Ana Belén Castro", "Rosa María Jiménez Delgado", "Pedro Navarro Soto", "Carmen López Vidal"],
    "fechas": ["20 de noviembre de 2024", "27 de noviembre de 2024"],
    "identificadores": ["445566778", "998877665", "112233445"],
    "ubicaciones": ["Hospital Universitario Virgen del Rocío", "Sevilla"]
  },
  "alertas": [
    {
      "texto": "67 años + Adenocarcinoma colon IIIB",
      "razon": "La combinación de edad específica y diagnóstico poco común podría ser identificadora"
    }
  ],
  "notasEducativas": {
    "nombres": "En actas de comités hay dos tipos de nombres: profesionales (que se mantienen o generalizan según contexto) y pacientes (que se sustituyen).",
    "cuasiIdentificadores": "Las combinaciones de edad + diagnóstico específico en tumores raros pueden ser identificadoras."
  },
  "moduloRelacionado": "4.1"
}
```

---

## 9. CONTENIDO EDUCATIVO

### 9.1 Tooltips por Tipo de Transformación

```javascript
// ui/tooltips.js

export const CONTENIDO_EDUCATIVO = {
  NOMBRE: {
    titulo: 'Nombre sustituido',
    icono: '👤',
    explicacionCorta: 'Sustituido por nombre ficticio manteniendo género',
    explicacionLarga: `Los nombres propios son identificadores directos según el RGPD. 
      Los sustituimos por nombres ficticios en lugar de eliminarlos para:
      1. Mantener la coherencia gramatical del texto
      2. Permitir que la IA razone correctamente sobre el sujeto
      3. Preservar relaciones entre entidades (si hay varios nombres)`,
    ejemplo: {
      antes: 'María García presenta dolor...',
      despues: 'Elena Ruiz presenta dolor...'
    },
    modulo: {
      numero: '2.1',
      titulo: 'Nombres y apellidos: Sustitución inteligente'
    }
  },
  
  FECHA: {
    titulo: 'Fecha relativizada',
    icono: '📅',
    explicacionCorta: 'Convertida a referencia temporal relativa',
    explicacionLarga: `Las fechas exactas son cuasi-identificadores de alto riesgo.
      Al convertirlas en referencias relativas:
      1. Mantenemos la información clínicamente relevante (intervalos)
      2. Eliminamos la posibilidad de cruzar con registros externos
      3. Preservamos la secuencia temporal de eventos`,
    ejemplo: {
      antes: '15/03/2024',
      despues: '[hace 9 meses]'
    },
    modulo: {
      numero: '3.1',
      titulo: 'Fechas: El peligro oculto del calendario'
    }
  },
  
  IDENTIFICADOR: {
    titulo: 'Identificador eliminado',
    icono: '🔢',
    explicacionCorta: 'Eliminado completamente por ser identificador único',
    explicacionLarga: `Los identificadores únicos (DNI, NHC, SIP, teléfono) permiten 
      la identificación directa e inequívoca del paciente.
      No tienen valor clínico, por lo que se eliminan completamente.`,
    ejemplo: {
      antes: 'NHC: 4521987',
      despues: '[NHC_ELIMINADO]'
    },
    modulo: {
      numero: '2.2',
      titulo: 'Códigos únicos: DNI, NHC, SIP'
    }
  },
  
  UBICACION: {
    titulo: 'Ubicación generalizada',
    icono: '📍',
    explicacionCorta: 'Generalizada a nivel regional',
    explicacionLarga: `Las direcciones específicas y municipios pequeños permiten 
      la re-identificación por inferencia. Generalizamos a nivel de:
      - Comunidad Autónoma (para direcciones)
      - Tipo de centro (para hospitales específicos)`,
    ejemplo: {
      antes: 'C/ Mayor 123, Villanueva de la Serena',
      despues: '[Extremadura]'
    },
    modulo: {
      numero: '3.2',
      titulo: 'Ubicaciones: De la dirección al código postal'
    }
  },
  
  REVISAR: {
    titulo: 'Requiere revisión manual',
    icono: '⚠️',
    explicacionCorta: 'Posible cuasi-identificador detectado',
    explicacionLarga: `Este elemento podría ser un cuasi-identificador según el contexto.
      Los cuasi-identificadores son datos que individualmente no identifican, 
      pero combinados con otros pueden hacerlo.
      
      Ejemplos: profesiones poco comunes, enfermedades raras, 
      referencias a unicidad ("el único paciente con...")`,
    modulo: {
      numero: '3.4',
      titulo: 'Combinaciones únicas: Cuando 3 datos inocuos identifican'
    }
  }
};
```

### 9.2 Referencias a Módulos del Curso

```javascript
export const MODULOS_CURSO = {
  '1.1': 'Por qué la privacidad es un problema (y una oportunidad)',
  '1.2': 'RGPD y LOPDGDD: Lo que realmente necesitas saber',
  '1.3': 'Anonimización vs Seudonimización: La diferencia crítica',
  '2.1': 'Nombres y apellidos: Sustitución inteligente',
  '2.2': 'Códigos únicos: DNI, NHC, SIP, tarjeta sanitaria',
  '2.3': 'Datos de contacto: Teléfonos, emails, direcciones',
  '3.1': 'Fechas: El peligro oculto del calendario',
  '3.2': 'Ubicaciones: De la dirección al código postal',
  '3.3': 'Profesiones y roles: "El alcalde del pueblo"',
  '3.4': 'Combinaciones únicas: Cuando 3 datos inocuos identifican',
  '4.1': 'Oncología: Comités de tumores y datos genéticos',
  '4.2': 'Enfermedades raras: Cuando la patología identifica',
  '5.1': 'Qué enviar y qué nunca enviar a una IA',
  '5.2': 'Prompts seguros: Estructura recomendada',
  '6.1': 'Cómo presentar esto a tu DPO',
  '6.2': 'Documentación y trazabilidad'
};
```

---

## 10. PLAN DE IMPLEMENTACIÓN

### Fase 1: Estructura Base (1-2 sesiones)
- [ ] Crear estructura de carpetas
- [ ] Implementar variables.css
- [ ] Implementar base.css y components.css
- [ ] Crear index.html (landing page)
- [ ] Integrar assets (logo, imágenes)

### Fase 2: Motor de Procesamiento (2-3 sesiones)
- [ ] Implementar tokenizer.js
- [ ] Implementar patrones de detección (nombres, fechas, ids, ubicaciones)
- [ ] Implementar diccionarios (nombres, apellidos)
- [ ] Implementar transformadores
- [ ] Implementar processor.js (orquestador)
- [ ] Tests del motor

### Fase 3: Interfaz de Aplicación (2-3 sesiones)
- [ ] Crear app.html con layout
- [ ] Implementar editor.js
- [ ] Implementar preview.js con highlighting
- [ ] Implementar review-panel.js
- [ ] Implementar entity-cards.js
- [ ] Crear casos de ejemplo JSON
- [ ] Conectar UI con motor

### Fase 4: Exportación (1-2 sesiones)
- [ ] Integrar jsPDF
- [ ] Implementar clipboard.js
- [ ] Implementar pdf-report.js
- [ ] Diseño del informe PDF

### Fase 5: Integración Educativa y Pulido (1-2 sesiones)
- [ ] Implementar tooltips.js
- [ ] Crear guia.html
- [ ] Crear terminos.html
- [ ] Responsive design
- [ ] Testing cross-browser
- [ ] Optimización

### Fase 6: Documentación (1 sesión)
- [ ] README.md
- [ ] Documento para DPOs
- [ ] Comentarios de código

---

## 11. CRITERIOS DE ACEPTACIÓN

| Criterio | Verificación |
|----------|--------------|
| Procesa texto detectando nombres | ✓ Prueba con caso ejemplo |
| Procesa texto detectando fechas | ✓ Prueba con caso ejemplo |
| Procesa texto detectando IDs | ✓ Prueba con caso ejemplo |
| Mantiene consistencia de nombres | ✓ Mismo nombre = mismo sustituto |
| Muestra elementos para revisión | ✓ Panel lateral funcional |
| Copia al portapapeles | ✓ Chrome/Firefox/Edge |
| Genera PDF | ✓ Descarga correcta |
| Respeta paleta colores | ✓ Revisión visual |
| Responsive tablet | ✓ Test 768px |
| Tooltips educativos | ✓ Mínimo 4 tipos |
| Disclaimer visible | ✓ En landing y app |
| Funciona offline (tras carga) | ✓ Test desconectado |
| Sin llamadas externas | ✓ DevTools Network |

---

## 12. REFERENCIAS DE DISEÑO

### Mockups Aprobados
1. **Landing Desktop:** Diseño con busto renacentista, secciones de pasos, protección, curso
2. **App Revisión:** Layout dos columnas, panel izquierdo texto con highlighting, panel derecho entidades + leyenda + sesión

### Fonts a Importar
```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

### Imagen Hero
- Busto renacentista con tratamiento visual
- Badge flotante "Datos Protegidos"
- Texto "Renaissance of Privacy"

---

*Documento generado para implementación con Claude Code*
*Versión 1.0 - Diciembre 2024*
