# Entrada Sophilux V1 — A–E, aprobacion visual de maqueta

**Estado: HUMAN_VISUAL_GO_MOCK / APP_REAL_PENDING / NO_IMPLEMENTATION_GO.**

El 18/10/2026, tras revisar la maqueta interactiva y cuatro capturas de Entrada V1 A–E, la responsable respondió: «asi esta bien». Esto aprueba los cinco artefactos visuales siguientes, no la aplicación React ni la integración.

Referencia: rama prep/entrada-v1-fine-diff-proposal-20261018, commit ca1ee9f3d4e73c1c0fba195b207526cd99b83b81.

| Archivo relativo a docs/design/sophilux-b-v1 | SHA256 |
| --- | --- |
| entrada-v1-fine-proposal-20261018.html | 7b9fa99c59dd42470019e0635b77048afb399db05a9ee3cff3e554d7f318cc24 |
| fine-proposal-20261018/entrada-texto-1440.png | a89fca914ab045fc0322f7e869637c330aefb4235f0ed852f64c7240e87dc198 |
| fine-proposal-20261018/entrada-archivos-1440.png | 241395729eaf8fb333dcd95c2f3b7147a8b229f33000e29febbcf990d602f839 |
| fine-proposal-20261018/entrada-texto-375.png | 96c47138dc1182871b60b28a86631edac7d685226755fa3a236b04ca2d927ef2 |
| fine-proposal-20261018/entrada-archivos-375.png | e032ec2ff3fe69c3e687e140974aa02c0a05d01d72d2bfbbab067d18248aec73 |

**A–E aprobados:** cabecera «¿Qué vamos a revisar?»; texto introductorio reducido; texto protagonista con portapapeles secundario y ejemplos en desplegable; pie marfil con CTA único; guía de cuatro políticas en desplegable contextual, conservando la sección global y hechos de privacidad reales.

Permanecen aprobadas las decisiones previas: identidad Sophilux V1, dos columnas escritorio, selector Texto/Archivos, estado vacio real, entrada móvil primero, ausencia de overflow, funcionalidad y accesibilidad vigentes. El HTML es únicamente maqueta: sus acciones simuladas NO sustituyen la aplicación.

Candidato de producto 7b77ce0528ddc97be5f68a754a1e49f92c201dc0 intacto, sin GO visual final. #129 82e8bee4f6599dccbe48887f9da5ef5249006f19 aprobado tecnicamente, no integrado. NO mezclar infraestructura experimental C-088.

**Siguiente checkpoint:** autorización humana separada para implementar A–E en React/CSS. No modificar los artefactos congelados, no lanzar agentes, no push, PR, merge ni deploy con esta aprobación.
