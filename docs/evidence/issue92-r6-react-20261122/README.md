# REC-12 #92 · R6 implementada en V4 real (Estructurado móvil)

**Fecha:** 22/11/2026 · **Estado:** `R6_STRUCTURED_MOBILE_OK_LOCAL`, no publicada. **Aprobación humana:** Sil respondió «Ok» a la propuesta visual R6 de 32 columnas, en la que el inspector y la decisión aparecen antes de la tabla. **Protocolo:** KairOS DIA M/sensible, implementación OpenCode directo DeepSeek V4.1 Flash, auditoría independiente Cora + segundo revisor GLM-5.3 Flash. No se han usado pacientes reales.

## Ver el resultado

Abrir **`comparador.html`**: **V4 R3 real anterior → maqueta R6 aprobada → V4 R6 real** en primer viewport a 375×800 y páginas completas (selector). Las imágenes de `actual/` y `referencias/` hacen que este comparador funcione offline; `comparaciones/` contiene las dos láminas tripartitas.

En `actual/` hay captura **viewport y full** y `metrics-*.json` para 320, 375 y 1440. La fuente reproducible es `e2e/rec12-r6-visual-capture.spec.ts`, que ejecuta **el build real de V4, con un fichero CSV sintético de 32 columnas y 19 pendientes**. `comparar.py` reagrupa capturas sin editar las fuentes aprobadas ni R3.

## Contrato visual y funcional real

| Cambio | Implementado sin copiar lógica del mock |
|---|---|
| Orden móvil | Resumen factual → **único inspector de columna activa** → **única autoridad de ID de paciente** → tabla comparativa 4 campos / 32 filas → opciones de salida |
| Cabecera | Explicación detallada permanece detrás de `<details>` «Cómo revisar columnas» en móvil; se mantiene como párrafo visible en escritorio |
| Bloqueos | Se muestran **las razones canónicas de exportación**; la lista con `role="alert"` mantiene texto completo, cuenta con altura acotada y **`tabIndex=0` y foco visible para scroll mediante teclado**. No se sustituyen razones por una síntesis inventada |
| Navegación | Filtro local Todas/Pendientes solo decide filas visibles; «Ir a la siguiente columna pendiente» solo modifica la selección; el título del inspector recibe el foco después de seleccionar, no durante la carga |
| Privacidad | Se conserva el dominio `configuration.columnsRequiringReview`, `allowedActions`, `actionLocked`, roles de fecha, ID de paciente único y callbacks de clasificación existentes. Ninguna acción se acepta automáticamente; no cambia la autorización Safe/Confidential ni descargas |
| Escritorio | Tabla a la izquierda e inspector a la derecha, alineados en y≈509; resumen y autoridad paciente co-presentes en una banda superior; sin filtros móviles visibles |

**Solo se modificaron dos archivos de producción:** `app-v4/src/structured/StructuredConfigureWorkspace.tsx` y `app-v4/src/visual/sophilux-v1.css`. Las pruebas y documentación nuevas están separadas y no modifican el producto. No se ha tocado `configuration.ts`, motor, Worker, políticas, registros, serializadores ni exportadores. Los 32 nombres del corpus son sintéticos; se emplea el motor real para producir clasificación, bloqueos y pendientes.

### Medición final sobre producto real

| Ancho | Inspector superior (y px) | Clasificación (y px) | Autoridad paciente (y px) | Tabla (y px) | Scroll página horizontal |
|---|---:|---:|---:|---:|---:|
| 375 | 530 | 679 | 980 | 1.214 | **375 = viewport** |
| 320 | 565 | 714 | 1.035 | 1.325 | **320 = viewport** |
| 1440 | 509 | 658 | 281 | 509 | **1440 = viewport** |

La **tabla comienza más abajo deliberadamente**; la mejora aprobada consiste en adelantar la decisión. En la V4 R3 previa, el inspector de móvil estaba a y≈2.847 px. A 1440, tabla e inspector siguen co-presentes.

## Pruebas y auditoría

- Test RED congelado por el diseñador **`03c3869`**: `e2e/rec12-r6-structured-mobile.spec.ts` antes de producción **3 casos RED (geometría/filtrado) y 1 PASS escritorio**. Después **4/4 PASS**, sin modificar el test.
- Tras la implementación: **39/39 Vitest focales** configurador y exportación, TypeScript, ESLint, Prettier y compilación de producción PASS.
- Regresión heredada: **12/12 E2E** en `structured-composed`, `structured-rec04-composed` y `rec12-r3-sophilux` PASS, incluyendo ruta estructurada y las 3 pantallas R3.
- Batería `npm test`: **92 suites/1.569 tests PASS** (anteriores al parche final de foco, solo `tabIndex` y dos tokens CSS); `check-external-resources.mjs --scope=source` verifica 85 fuentes sin recursos externos inesperados.
- Captura y aceptación posteriores al parche del revisor: **8/8 Playwright E2E PASS** (4 contrato + 3 capturas + 1 prueba de teclado que enfoca y desplaza la lista de motivos y lee ambas fechas), más 39/39 tests focales y build PASS.
- Segunda revisión independiente **GLM-5.3 Flash → VEREDICTO OK** con hallazgo **medio** de teclado en caja de alertas y **bajo** de dos colores literales. Ambos **corregidos directamente en la auditoría y retestados** sin lanzar una segunda auditoría global. Revisor verificó un único paciente-ID, selectores de dominio, foco condicionado y separación de estados.
- Limitación declarada: no se ha realizado prueba manual con lector de pantalla real ni se certifica el producto clínico sobre datos reales. No hay captura de comparación pixel-perfect de escritorio; el contrato es de composición, controles y medidas, no de identidad binaria exacta.

Para reproducir las pruebas en este worktree con dependencias instaladas:

```bash
npm run typecheck:v4
npx vitest run app-v4/src/structured/StructuredConfigureWorkspace.test.tsx app-v4/src/structured/structured-export.test.tsx
npm run build
E2E_PORT=4302 npx playwright test e2e/rec12-r6-structured-mobile.spec.ts e2e/rec12-r6-visual-capture.spec.ts --workers=2 --retries=0
```

**R4 `NO_GO` de cierre #92 permanece vigente**: R6 resuelve la composición concreta de Estructurado móvil pero no demuestra por inferencia todos los seis criterios de recuperación, las 142 filas ni los PDR/G-HP restantes. #92 y #93 continúan abiertos; **sin push, PR, merge, deploy, cierre ni uso clínico real**.
