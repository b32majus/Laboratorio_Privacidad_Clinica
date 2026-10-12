# Contrato de identidad visual — CANDIDATO V1 (NO CONGELADO)

> **Estado:** Propuesta HTML/CSS pendiente de valoración humana. No introducir este contrato como autoridad en Atenea, `3.0-main`, #90 o #91 hasta aceptación explícita. No reemplaza privacidad, dominio o política clínica.

## Invariantes generales propuestos

- **Marca:** escudo lineal rosa piedra + wordmark con serif editorial; sello `Clínica · Sophilux`. Mismo lenguaje en todas las pantallas, sin transformar el escudo del prototipo en un logo definitivo automáticamente.
- **Sistema cromático candidato:** papel `#fffdfa`, fondo `#f7f5f2`, rosa identidad `#ba8d83`, rosa profundo de acción `#835852`, contorno `#e9e3de`, texto `#252b30`, estados verde `#467367` y alerta roja `#943f49`. Los estados se expresan también con texto y no se confunden con decisiones seguras.
- **Tipografía:** Cormorant Garamond para titulares de marca, portada operativa y cierre; Inter para formularios, hechos, tablas y controles. El prototipo no distribuye fuentes y utiliza serif/sans del sistema si no están instaladas.
- **Shell:** cabecera compacta, política/estado local detectables y `Nuevo trabajo`; sin stepper universal, bienvenida forzosa, tarjetas explicativas reiteradas ni navegación inventada.
- **Jerarquía:** encabezado contextual → principal información para decidir → acción siguiente → ayudas y detalles bajo demanda. Las acciones sensibles distinguidas claramente.
- **Anchuras:** escritorio 1440 ancho máximo ~1356, tablet ajustable y móvil 375 px sin desplazamiento horizontal de toda la página; tablas pueden deslizarse en su propio contenedor.
- **Demostración:** barra negra superior de siete vistas es instrumento de revisión del prototipo; **NUNCA** se implementa como navegación del producto.

## Pantallas que deben aprobarse individualmente

| Vista | Composición visual V1 | Invariante funcional al implementar |
| --- | --- | --- |
| Entrada | Editorial breve a la izquierda y formulario operativo visible a la derecha | Entrada inmediata a texto/archivos; sin segunda portada. La política detallada se abre solo si se solicita. |
| Review | Documento con mayor superficie + hallazgos compactos + inspector de decisión | Evidencia y decisiones humanas sin perder contexto; los indicadores no sustituyen la revisión ni se autoaceptan. |
| Lote | Contadores + filtro + cola de documentos + foco de documento y acción contextual | Errores locales recuperables; estados de todos los documentos, sin pérdida de trabajo correcto. |
| Structured | Comparativa de 4 campos con selección por columna y inspector al lado; bloqueos antes de la tabla | Study-ID, date role, unknown, clasificadores y salida siguen derivados de autoridades existentes. |
| Texto libre estructurado | Lista de celdas, contenido central, decisión contextual | Solo cuando `process-as-text` exista; no Review vacío obligatorio; no mezclar decisión de celda y clasificación de columna. |
| Privacy Gate | Estatus factual y siguiente acción coherente con preparación | Nunca presentar un botón que lleve a un paso indisponible o un resultado no autorizado. |
| Result | Cierre editorial sereno, estado/CTA dominante, vista previa y auditoría confidencial visualmente separada | Variantes listo/pendiente/bloqueado, avisos sobre originales conservados, formatos por material y autorización adicional de Confidential Audit. |

## Checklist de aprobación para convertirlo en autoridad

1. Revisión de las **7 pantallas** a escritorio y al menos las afectadas materialmente a móvil.
2. Selección de ajustes visuales concretos: *Mantener / Cambiar* por pantalla.
3. Generar V2 revisada, sin inventar cambios de lógica, y obtener aprobación explícita.
4. Crear un commit **exclusivamente documental** con CSS/HTML, capturas/contrato, SHA de fuentes y evidencia visual; no usarlo como código de producto.
5. Fijar la autoridad de referencia para #90 (textos) y #91 (sistema visual), preservando C-087 y las decisiones existentes.

## Precisión importante

Los controles de esta demo son solo interactivos a efectos visuales: no calculan clasificaciones, ni leen datos, ni muestran verdaderas readiness gates. La lógica aprobada vive en la V4. No derivar tests de privacidad o estados productivos desde el comportamiento simplificado del prototipo.
