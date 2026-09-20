# Arquitectura objetivo propuesta

> Estado: propuesta resultante de las auditorías; pendiente de aceptación explícita antes del refactor.

## Stack

- Vite
- TypeScript
- React
- Tailwind compilado en build
- Web Worker para procesamiento
- Vitest + Testing Library
- Playwright
- Render Static hosting (target inicial)
- Cloudflare Pages solo tras gate de disponibilidad en España

## Runtime

No backend. No SSR. No APIs externas para procesamiento clínico.

```
Browser
│
├── React App Shell
│
├── Job State / ReviewSession
│
├── PrivacyEngine
│    ├── RecognizerRegistry
│    ├── OperatorRegistry
│    └── ProcessingContext
│
├── Web Worker
│
├── File Adapters
│
└── Export Services
     ├── Safe Output
     └── Confidential Audit
```

## Trust boundary

El servidor/CDN entrega bytes estáticos. El contenido clínico no se incluye en requests, URLs, analytics, logs remotos ni APIs.

## Orígenes

Separar:
- marketing/docs;
- aplicación clínica.

El origen clínico debe tener CSP estricta y cero runtime third-party.

## State model

```
Job
├── source
├── policy
├── processing status
├── detections
├── review decisions
├── warnings/errors
└── final output
```

El DOM nunca es autoridad.

## Migration rule

No reescribir el engine existente hasta disponer de tests de regresión. Envolver primero, migrar después.


## Hosting availability gate — Spain / LaLiga

La elección de hosting no puede basarse solo en coste y DX. En España existe riesgo documentado de bloqueo colateral de IP compartidas durante ventanas de LaLiga.

Política:
1. Render Static es el target gestionado inicial.
2. Cloudflare Pages no se adopta como target principal sin prueba controlada.
3. Cualquier proveedor multi-tenant debe considerarse potencialmente expuesto al mismo tipo de daño colateral.
4. Si la disponibilidad clínica futura exige máxima independencia, reevaluar origen con IP propia/VPS o infraestructura institucional.
5. El hosting estático permanece fuera del data plane clínico: distribuye código, no procesa PHI.
