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
- Cloudflare Pages static hosting

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
