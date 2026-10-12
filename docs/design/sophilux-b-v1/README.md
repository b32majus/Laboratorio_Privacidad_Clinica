# Laboratorio de Privacidad Clínica — Propuesta visual Sophilux B / V1

**Estado: PROPUESTA PARA REVISAR; NO APROBADA NI CONGELADA.**

Abrir `index.html` en cualquier navegador. La barra oscura superior es un **navegador de prototipo**, NO forma parte de la interfaz de producción. Permite comparar las siete vistas y estados ilustrativos. Usar los botones de cada vista para recorrer la composición y los controles de demostración. **Sin backend, sin procesamiento clínico, sin persistencia ni exportaciones reales.** Usar solo datos de ejemplo.

## Vistas

1. **Entrada:** orientación editorial + entrada inmediata de texto o archivos sin paso previo.
2. **Revisión:** documento dominante, lista de detecciones e inspector para decisiones humanas.
3. **Lote:** estados de documentos, filtro, recuperación y trabajo contextual.
4. **Estructurado:** 32 columnas, cuatro hechos visibles, selector de identificador único e inspector de columna.
5. **Texto libre en celdas:** aparece solo si existen acciones `process-as-text` reales; referencia visual, no un nuevo paso obligatorio.
6. **Comprobación de privacidad:** estados preparado/bloqueado demostrativos, sin conferir autorización técnica.
7. **Resultado:** cierre editorial, acción contextual, avisos y zona Confidential Audit separada.

## Estética propuesta

- Dirección **Sophilux B** aprobada como intención; esta ejecución visual V1 **todavía necesita validación**.
- Neutros piedra, fondos cálidos, rosa empolvado, contraste de títulos editorial/Inter.
- El CSS usa la pila `Cormorant Garamond → Georgia` para títulos e `Inter → system UI` para trabajo. **No incluye ni distribuye fuentes** ni hace solicitudes de red. Si el equipo no tiene Cormorant instalada, usa fuentes serif locales. La implementación final deberá usar exclusivamente los recursos tipográficos locales ya presentes en el proyecto.
- No hay segundo onboarding, stepper universal, Review vacío ni exposición visual equiparada de Safe y Confidential.

## Límites

- **Mockup visual y de interacción:** ninguno de los valores de revisión representa el motor real o sus permisos. Los cambios de controles simulan estados para entender el diseño.
- **No utilizar con datos de pacientes.** La entrada de demostración no guarda ni envía información pero tampoco incluye garantías de una aplicación clínica.
- **No confirma requisitos de seguridad, privacidad, accesibilidad ni fidelidad funcional de V4.** Las autoridades del repositorio prevalecen.
- El trabajo #90 de traducción y #91 de coherencia visual continúan pendientes de preparación/implementación. Este prototipo no modifica su alcance.

## Qué alinear antes de congelar

1. Distribución del trabajo real (tamaño documento, inspector, tabla, cola) en escritorio y móvil.
2. Intensidad de Sophilux B en Entrada y Resultado, incluyendo tipografía, peso de la marca y cantidad de aire.
3. Lenguaje visual de estados y bloqueos y jerarquía de acciones principales/secundarias.
4. Si se aprueba, producir una segunda versión corregida y entonces **registrar la decisión humana** y congelar una referencia visual versionada, sin convertir el mockup en lógica de producción.
