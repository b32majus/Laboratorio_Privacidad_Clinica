# Auditoría UX/UI y modelo de producto — 2026-09

> Tercera auditoría pre-refactor.  
> Referencia: `3.0-main`.  
> Objetivo: rediseñar el Laboratorio como una aplicación coherente, no como un sitio multipágina heredado.

## 1. Conclusión ejecutiva

La interfaz actual contiene buenas piezas visuales, pero el modelo de interacción corresponde a la historia del proyecto, no al producto en el que se está convirtiendo.

Actualmente el usuario recorre múltiples documentos HTML:

```
index.html
   ↓
app.html
   ↓
modal de elección
   ├── input.html
   │      ↓
   │   review.html
   │
   ├── batch.html
   │      ├── iframe batch-review-legacy
   │      └── iframe batch-structured-legacy
   │
   └── batch-structured.html / legacy
```

La nueva dirección debe ser:

```
MARKETING ORIGIN                    CLINICAL APP ORIGIN

Landing / explicación        →       App Shell
                                      │
                                      ├── New privacy job
                                      │      ↓
                                      │    Input
                                      │      ↓
                                      │   Configure
                                      │      ↓
                                      │    Review
                                      │      ↓
                                      │    Export
                                      │
                                      ├── Policies
                                      └── Help
```

Una sola aplicación, una sola sesión y una sola fuente de verdad.

## 2. Problemas del journey actual

### UX-01 — Dos portadas antes de llegar a trabajar

`index.html` y `app.html` cumplen parcialmente el mismo papel. El usuario recibe explicación de marketing, pulsa "Abrir herramienta", vuelve a encontrarse una segunda portada y después abre un modal para elegir formato.

**Impacto**
Fricción innecesaria antes de la tarea principal.

**Dirección**
Marketing fuera del origen clínico. Al abrir la herramienta, entrar directamente al workspace.

### UX-02 — El usuario tiene que conocer la arquitectura interna

La aplicación pregunta si quiere:
- texto/documento;
- estructurado;
- batch.

Pero en la mayoría de los casos el tipo de entrada ya permite inferir la ruta:
- texto pegado → free text;
- PDF/DOCX/TXT → document;
- múltiples documentos → document batch;
- CSV/XLS/XLSX → structured.

**Dirección**
Un "New privacy job" que infiere el pipeline a partir de la entrada y permita override cuando sea necesario.

### UX-03 — Batch se presenta como upsell en lugar de capacidad natural

`input.html` contiene "Modo Batch Premium" y botón "Activar". No existe un modelo de producto suficientemente desarrollado que justifique ese lenguaje y visualmente separa una capacidad que debería formar parte del mismo workspace.

**Dirección**
Eliminar "Premium" del flujo funcional. Batch = seleccionar múltiples documentos.

### UX-04 — Structured parece otra aplicación

Usa una hoja de estilos propia, estructura de pasos distinta y actualmente puede aparecer embebida por iframe.

**Dirección**
Mismos componentes, design tokens, stepper y shell para texto/documentos/structured.

### UX-05 — Cambio de página rompe continuidad mental

Procesar lleva de input a review mediante navegación. Batch usa `sessionStorage` para transportar estado entre pantallas.

**Dirección**
Mantener el job vivo en memoria dentro de un mismo app shell.

### UX-06 — Las acciones de exportación aparecen antes de estar preparado el resultado

En review, "Copiar Texto" e "Informe de Seudonimización" están siempre en la barra superior.

**Dirección**
Un solo CTA principal contextual:
- mientras hay pendientes: `Revisar 8 pendientes`;
- cuando está listo: `Preparar salida`;
- export seguro disponible solo tras Privacy Gate.

### UX-07 — Aviso legal rojo permanente produce alarm fatigue

El mismo aviso aparece repetidamente en páginas operativas.

Rojo debe reservarse para un problema actual, no para un disclaimer permanente.

**Dirección**
- aviso completo en onboarding/help/terms;
- indicador discreto y persistente "Revisión humana requerida";
- rojo solo para leaks, errores o bloqueo real.

### UX-08 — "Strict mode" es opaco

El usuario puede activarlo, pero no sabe exactamente qué cambia.

**Dirección**
Convertirlo en una **Privacy Policy** explicable:
- Standard;
- External AI;
- Longitudinal Research;
- Strict.

Cada política muestra qué hace con personas, fechas, edades, ubicaciones e identificadores.

### UX-09 — La revisión está sobrecargada de instrucción

Antes del texto se muestran dos callouts largos, además de sidebar, leyenda y action bar flotante.

**Dirección**
Onboarding contextual la primera vez y affordances integrados. La superficie diaria debe priorizar el contenido y los pendientes.

### UX-10 — "Restaurar" es una acción de riesgo insuficientemente expresiva

Restaurar introduce de nuevo el original sensible. La etiqueta visual parece una acción neutra.

**Dirección**
Renombrar según intención:
- `Mantener original`
- confirmación contextual si el dato es identificador directo;
- explicar que permanecerá en la salida.

### UX-11 — El inspector de entidad está fragmentado

Información en card izquierda, texto central, action bar inferior y modal de modificación.

**Dirección**
Inspector lateral único al seleccionar una entidad:
- Original
- Propuesta
- Tipo
- Confianza
- Razón de detección
- Acción
- Notas

### UX-12 — Baja confianza existe en la leyenda pero no como workflow real

El motor ya conserva candidatos descartados, pero el usuario no tiene una bandeja clara para revisarlos.

**Dirección**
Filtros:
- Obligatorio;
- Baja confianza;
- Revisado;
- Restaurado;
- Añadido manualmente.

### UX-13 — Selección manual es potente pero poco descubrible

Solo aparece tras seleccionar texto.

**Dirección**
Mantener selección contextual, pero añadir:
- comando visible "Marcar dato no detectado";
- keyboard shortcut;
- affordance en inspector/help.

### UX-14 — No existe una pantalla final que responda "¿qué queda pendiente?"

Actualmente se pasa de review a export.

**Dirección**
Privacy Gate final:
- direct identifiers treated;
- pending review;
- low-confidence candidates;
- manual restores;
- warnings;
- safe output availability.

No usar scores tipo "98% seguro" ni certificaciones de cumplimiento.

## 3. Responsividad y accesibilidad

### A11Y-01 — Las pantallas operativas no están diseñadas responsive

Conteo de breakpoints en `input.html`, `review.html`, `batch.html` y `batch-structured-legacy.html`: prácticamente cero clases `sm:/md:/lg:`.

`input.html` mantiene sidebar `w-72`.  
`review.html` mantiene sidebar `w-72`, `h-screen` y `overflow-hidden`.

**Dirección**
Diseño adaptativo real:
- Desktop: multi-panel.
- Tablet: panel principal + drawer.
- Mobile: una sola columna + bottom sheet de entidad.

### A11Y-02 — Primary rose-gold no tiene contraste suficiente para texto normal blanco

`#B8897D` sobre blanco/viceversa ofrece aproximadamente 3:1, por debajo de WCAG AA 4.5:1 para texto normal.

**Dirección**
Mantener `#B8897D` como acento de marca y usar un primary operativo más oscuro (por ejemplo, una variante del entorno de `#976B60` o más oscura) para botones/texto.

### A11Y-03 — Tooltips hover-only

Los tooltips de información dependen de hover y no son una interacción robusta para teclado/touch.

### A11Y-04 — Icon buttons con accesibilidad irregular

Home/back se apoyan en `title`; debe existir `aria-label` y foco visible.

### A11Y-05 — Color no debe ser el único código de entidad

Los highlights usan colores. Debe conservarse iconografía/label/underline/pattern accesible.

### A11Y-06 — Zoom y viewport

`h-screen + overflow-hidden` puede degradar uso con zoom, pantallas pequeñas o barras de navegador móviles.

## 4. Rediseño propuesto: App Shell

### Top bar

Siempre visible, compacta:

```
[Shield] Laboratorio de Privacidad    Job: informe-derma.pdf

Local only ●   Policy: External AI ▼   [Clear sensitive session]
```

No mostrar claims tipo "Datos seguros". Mostrar un hecho verificable: procesamiento local / sin envío del contenido.

### Navigation rail

Mínima:

```
+ New job
Workspace
Policies
Help
```

No guardar "historial" con PHI por defecto. Si se incorpora recuperación local, debe ser explícita y local-only.

### Workspace

Stepper horizontal:

```
1 Input ─── 2 Configure ─── 3 Review ─── 4 Export
```

El paso Configure puede ser trivial/automático en texto y detallado en structured.

## 5. Home de aplicación

No una segunda landing.

```
┌─────────────────────────────────────────────────────────────┐
│ New privacy job                                             │
│                                                             │
│ Paste clinical text                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ...                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ OR drop files here                                          │
│ TXT · PDF · DOCX · CSV · XLSX                               │
│                                                             │
│ Policy: External AI ▼                  [Start review]        │
└─────────────────────────────────────────────────────────────┘
```

Comportamiento:
- 1 PDF → document job.
- 12 PDFs → document batch.
- XLSX → structured.
- paste → text.
- mezcla incompatible → explicar y separar jobs.

## 6. Review workspace objetivo

### Desktop

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Job / policy / progress                                      Export      │
├───────────────┬───────────────────────────────────┬───────────────────────┤
│ Filters       │ Document                          │ Entity inspector      │
│               │                                   │                       │
│ 8 Pending     │ Patient [Paciente 1] ...          │ ORIGINAL              │
│ 3 Low conf.   │ ...                               │ Juan Pérez            │
│ 12 Reviewed   │                                   │                       │
│ 1 Restored    │ highlighted inline                │ PROPOSED              │
│               │                                   │ Paciente 1            │
│ Types         │                                   │                       │
│ Person        │                                   │ Confidence 0.91       │
│ Date          │                                   │ Context match         │
│ Location      │                                   │                       │
│ ID            │                                   │ [Accept] [Modify]     │
│               │                                   │ [Keep original]       │
└───────────────┴───────────────────────────────────┴───────────────────────┘
```

Ventajas:
- no action bar flotante;
- decisión y explicación en el mismo sitio;
- el documento no se desplaza verticalmente por instrucciones;
- low-confidence se convierte en parte del trabajo;
- permite shortcuts.

### Shortcuts candidatos

- `A`: aceptar.
- `M`: modificar.
- `K`: mantener original.
- `J/K` o flechas: siguiente/anterior.
- `F`: marcar selección manual.

Solo activar cuando no se esté editando un campo.

## 7. Batch objetivo

Batch deja de ser otra app.

```
Documents  18

✓ 1 informe.pdf       Reviewed
● 2 alta.pdf          3 pending
! 3 scan.pdf          No text layer
× 4 corrupt.docx      Read error
...
```

La navegación por documento conserva el mismo inspector y review model.

Acciones:
- retry;
- remove;
- process;
- review required;
- explicit error acknowledgment.

## 8. Structured objetivo

Mantener el stepper del app shell.

En Configure, sustituir la tabla puramente técnica por un data-classification workspace:

```
COLUMN           CLASS              ACTION              CONFIDENCE
NHC              Identifier         Replace with Study ID    High
Fecha_nac        Quasi-Identifier   Age band                 High
Sexo             Quasi-Identifier   Keep / Review            -
Diagnostico      Sensitive          Keep                      -
Centro           Quasi-Identifier   Pseudonymize              Med
Notas_libres     Free text          Process as text           High
xyz              Unknown            Review required           Low
```

Panel lateral:
- selected patient ID;
- unique patients;
- visits;
- warnings;
- risk summary.

Nunca `UNKNOWN → KEEP`.

## 9. Export objetivo

Separar visual y conceptualmente:

### Safe output

Tarjeta verde/neutra:
- `Copy safe text`
- `Download safe TXT/DOCX/PDF/XLSX`
- no originals;
- no mappings.

### Confidential audit

Tarjeta amber/locked:
- contiene datos identificables;
- correspondence / review trail;
- descarga separada;
- confirmación adicional.

No mezclar ambas opciones en una misma jerarquía visual.

## 10. Sistema visual

### Dirección

Pasar de "microsite editorial elegante" a **clinical privacy workstation**.

Conservar:
- calidez;
- neutros stone;
- personalidad Sophilux;
- rose-gold como firma.

Reducir:
- grandes titulares serif;
- tarjetas de marketing;
- sombras grandes;
- hero imagery;
- gradientes decorativos dentro de la app.

### Tipografía

Marketing: Cormorant + Inter puede mantenerse fuera del origen clínico.

App:
- Inter como tipografía principal.
- JetBrains Mono para IDs/columnas/valores técnicos.
- Cormorant solo, si se desea, en una marca pequeña/empty state; no en headings operativos.

### Color semantics

- Brand accent: rose.
- Primary interaction: rose oscuro accesible.
- Success/completed: emerald.
- Needs review: amber.
- Critical/blocking: red.
- Info/context: blue.
- Neutral: stone/slate.

Rojo no se usa para disclaimers permanentes.

### Density

El review puede ser deliberadamente más denso que la landing. Es una herramienta profesional; más espacio no siempre significa mejor UX.

## 11. Arquitectura frontend recomendada

### Decisión propuesta

```
Vite
+ TypeScript
+ React
+ compiled Tailwind
+ Web Worker
+ Vitest
+ Testing Library
+ Playwright
```

No Next.js. No SSR. No servidor de aplicación.

### Por qué React ahora sí aporta valor

El producto tiene:
- workflow multi-step;
- estado de job;
- review decisions;
- filtros;
- inspectors;
- listas/batch;
- structured tables;
- modales/drawers;
- múltiples layouts responsive.

En ese contexto, componentes y estado declarativo reducen la deuda que hoy nace de modificar el DOM directamente.

### Qué NO debe migrarse ciegamente

`js/core` debe preservarse y extraerse hacia módulos TypeScript progresivamente. No reescribir recognizers solo por cambiar framework.

### Estado

Separar:
- **domain state**: engine/review/job;
- **UI state**: panel abierto, filtro, selección.

No usar el DOM como estado.

No introducir una gran store global si no hace falta. Un reducer/store pequeño por Job es suficiente inicialmente.

## 12. Persistencia

### Sensitive job data
Default: memoria.

### App preferences no sensibles
Puede persistirse localmente:
- theme;
- última policy;
- preferencias UI.

### Recuperación de job
Solo si se diseña explícitamente:
- IndexedDB;
- opt-in;
- clear/expiry;
- nunca silent persistence.

## 13. Arquitectura de origen

Recomendación:

```
Marketing / docs
https://example.com/privacy
      │
      │ link
      ▼
Clinical app — ORIGIN DISTINTO
https://privacy-app.example.com
```

El origen clínico:
- sin MailerLite;
- sin Analytics;
- sin tag manager;
- sin chat widgets;
- sin fonts remotas;
- sin imágenes remotas;
- sin APIs externas;
- CSP `default-src 'self'` como objetivo;
- no PHI en URL/query/hash;
- `Referrer-Policy: no-referrer`;
- `frame-ancestors 'none'`.

## 14. Hosting recomendado

### 1. Render Static — recomendado para la fase actual

Usar Render únicamente como **static site**: sirve HTML/CSS/JS y no participa en el procesamiento clínico.

Motivos:
- deploy automático desde Git;
- custom domain y TLS gestionado;
- custom response headers;
- CDN;
- cero servidor que administrar;
- compatible con una SPA Vite totalmente client-side;
- permite mantener al proveedor de hosting fuera del data plane clínico.

El frontend clínico debe seguir cumpliendo la regla: no analytics, no logging remoto de PHI, no APIs externas inesperadas y no datos sensibles en URL/query/hash.

### 2. Cloudflare Pages — solo candidato experimental, sujeto a prueba específica en España

No adoptarlo como production target por defecto mientras exista riesgo de bloqueo colateral de IP compartidas durante ventanas de LaLiga.

Antes de reconsiderarlo:
- desplegar un mirror sintético sin datos clínicos;
- comprobar accesibilidad desde varios ISP españoles;
- ejecutar pruebas específicamente durante ventanas de partidos;
- documentar resultados y plan de fallback.

Cloudflare puede seguir siendo útil para experimentación, pero no debe convertirse en dependencia de disponibilidad clínica sin ese gate.

### 3. Netlify / Vercel — alternativas, no solución automática al riesgo de bloqueo

El problema no es exclusivo de Cloudflare: otros proveedores multi-tenant/CDN también han sufrido bloqueos colaterales en España.

Vercel es técnicamente excelente, pero su Hobby debe revisarse en función del uso profesional/comercial. Netlify es válido, aunque su modelo de créditos añade otra variable operativa.

### 4. GitHub Pages — documentación/demo, no origen clínico objetivo

Es cómodo para docs y demos sintéticas. Para una herramienta clínica estable interesa un origen dedicado, security headers controlados y evitar depender de un project-site compartido.

### 5. VPS / origen con IP propia — fallback futuro para máxima independencia

No es la primera opción ahora porque introduce operación y mantenimiento. Pero si la disponibilidad en España se vuelve crítica y los hosts multi-tenant siguen sufriendo bloqueos, servir la SPA desde una IP propia vuelve a ser una alternativa estratégica válida.

## 15. Build / deploy objetivo

```
GitHub
   ↓ PR
CI
├── lint
├── types
├── unit
├── privacy regression
├── E2E
├── no external network
└── build
   ↓
Render Preview
   ↓ merge main
Render Production
```

Build:

```
npm ci
npm test
npm run build
→ dist/
```

Solo `dist/` se publica.

## 16. Progressive migration

No hacer big-bang rewrite.

### Step A
Crear nueva `src/` y app shell React/TS sin tocar core.

### Step B
Adaptar `PrivacyProcessor` actual detrás de una interfaz.

### Step C
Migrar Input + Review al nuevo shell.

### Step D
Migrar Batch.

### Step E
Migrar Structured.

### Step F
Extraer recognizers/operators/context a TypeScript.

### Step G
Eliminar HTML legacy una vez que los E2E demuestren paridad.

## 17. Criterios de éxito de UX

El rediseño está conseguido cuando:

1. Desde abrir la app hasta iniciar un job hay una única decisión principal.
2. No existe navegación de página entre input/review/export.
3. El usuario siempre sabe qué job y qué policy está usando.
4. El progreso de revisión es visible y fiable.
5. "Safe output" solo aparece cuando el sistema puede generarlo.
6. Un error batch no desaparece.
7. Low-confidence forma parte del workflow.
8. Text/doc/batch/structured parecen módulos de la misma aplicación.
9. Mobile/tablet tienen un flujo funcional, aunque desktop siga siendo la superficie principal.
10. Ningún elemento visual afirma cumplimiento o seguridad no demostrable.

## 18. Decisiones recomendadas antes de implementación

- Adoptar SPA/app shell.
- Adoptar Vite + TypeScript + React.
- Adoptar Render Static como production target inicial gestionado.
- Mantener Cloudflare Pages como experimento sujeto a test específico de disponibilidad en España durante ventanas LaLiga.
- Separar marketing y app en orígenes.
- Mantener el core actual y migrarlo incrementalmente.
- Rediseñar primero las pantallas objetivo y después comenzar la migración.
