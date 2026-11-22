# Auditoría semántica original REC-12 / #92 — segmento B
Eres REVISOR DE SOLO LECTURA del candidato RC1@8e1fa97, NO implementador. PROHIBIDO tocar código/tests/configuración, hacer git push/merge/PR, cambiar GitHub/Render, instalar dependencias, delegar o ejecutar pruebas intrusivas. No hay datos reales.
Fuente exacta de obligaciones: /srv/kairos-lab/qualification/laboratorio-rec12-r11-semantic-20261122/docs/evidence/issue92-r11-semantic-20261122/INPUT_B.json; cada objeto trae objetivo literal, veredicto histórico (NO asumir cierto), rutas test R1, contradicciones R9. Leer también docs/audits/2026-10-recovery-traceability-matrix.md y docs/evidence/issue92-r9-semantic-rows-20261122/README.md para comprender estados.
Objetivo único: para CADA una de las 42 filas, contrastar de verdad los asserts en ficheros de test con el COMPORTAMIENTO de código productivo. Evita dar PASS por existencia de fichero; precisar qué requisito está demostrado y qué subcláusula no.
ESTADOS exactos:
SEMANTIC_PASS = soporte directo del requisito material en código y aserción verificable; mencionar fichero y línea real, sin garantía universal.
PARTIAL = hay evidencia concreta pero faltan condiciones obligatorias.
ACCEPTED_DEBT = una decisión humana explícita acepta aplazar SOLO esa obligación.
SUPERSEDED = autoridad humana aprobada y cita exacta.
FUTURE = fuera del alcance de recuperación con autoridad explícita.
GOVERNANCE_93 = corresponde a gobierno/publicación #93, no PASS en #92.
HUMAN_REQUIRED = criterio solo comprobable con aceptación humana no registrada.
UNVERIFIED = evidencia insuficiente.
CONTRADICTION = negativo concreto reproducible o código incompatible (describir, NO editar).
Producción es SPA React en navegador local sin backend clínico/BD. No exigir CRUDes, sesiones ni DB si no aplican. PDR/G-HP: no equiparar tests DOM con comprensión real.
Escribe EXCLUSIVAMENTE fichero /srv/kairos-lab/qualification/laboratorio-rec12-r11-semantic-20261122/docs/evidence/issue92-r11-semantic-20261122/AUDIT_B.json como JSON UTF-8 array de objetos para cada ID del input, sin omisiones ni IDs extras, campos: id, status, witness (cita precisa fichero:línea de test O código, no inventar), semantic_reason (1-3 frases castellano, en qué medida demuestra objetivo), residual_gap (breve o 'ninguno en alcance'), next_action ('ninguna' o especificación concreta). Pueden ser prudentes; no fuerces un PASS. No reescribas lo congelado ni fuentes. Al terminar imprime resumen por estado + los IDs pendientes. Si falta tiempo crea resultados honestos con UNVERIFIED; JAMÁS inventes citas. Mantén trabajo del propio auditor sin tocar artefactos de otros grupos.