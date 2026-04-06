// Detector de Fechas - Fechas completas en varios formatos

/**
 * Verifica si un texto es una escala médica (X/10, X-X/10, etc.)
 * @param {string} text - Texto a verificar
 * @returns {boolean}
 */
function esEscalaMedica(text) {
    // Patrones de escalas médicas: X/10, X-X/10, (X/10), X / 10, etc.
    const patronesEscala = [
        /^\d{1,2}\/10$/,           // 8/10
        /^\d{1,2}-\d{1,2}\/10$/,   // 2-3/10
        /^\d{1,2}\s*\/\s*10$/,     // 8 / 10
        /^\(\d{1,2}\/10\)$/,       // (8/10)
    ];
    return patronesEscala.some(p => p.test(text.trim()));
}

/**
 * Verifica si parece una fecha válida (mes <= 12, día <= 31)
 * @param {string} text - Texto de fecha
 * @returns {boolean}
 */
function parecesFechaValida(text) {
    const parts = text.split(/[\/-]/);
    if (parts.length < 2) return false;

    const num1 = parseInt(parts[0]);
    const num2 = parseInt(parts[1]);

    // Si el segundo número es 10 y el primero es pequeño (1-10), probablemente es escala
    if (num2 === 10 && num1 <= 10 && parts.length === 2) {
        return false;
    }

    // Para fechas dd/mm/yyyy: día <= 31, mes <= 12
    if (parts.length === 3) {
        const dia = num1;
        const mes = num2;
        return dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12;
    }

    return true;
}

/**
 * Detecta todas las fechas en un texto
 * @param {string} text - Texto a analizar
 * @returns {Array} - Array de entidades detectadas
 */
export function detectFechas(text) {
    const entities = [];
    let match;

    // Fechas numéricas: dd/mm/yyyy o dd-mm-yyyy (requiere año)
    const fechaNumericaRegex = /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g;
    while ((match = fechaNumericaRegex.exec(text)) !== null) {
        // Filtrar escalas médicas y validar
        if (!esEscalaMedica(match[0]) && parecesFechaValida(match[0])) {
            entities.push({
                type: 'FECHA',
                subtype: 'fecha_completa',
                text: match[0],
                original: match[0],
                position: { start: match.index, end: match.index + match[0].length },
                confidence: 0.95
            });
        }
    }

    // Fechas textuales: "18 de diciembre de 2023"
    const fechaTextualRegex = /\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+|del\s+)?\d{4}\b/gi;
    while ((match = fechaTextualRegex.exec(text)) !== null) {
        entities.push({
            type: 'FECHA',
            subtype: 'fecha_completa',
            text: match[0],
            original: match[0],
            position: { start: match.index, end: match.index + match[0].length },
            confidence: 0.95
        });
    }

    // Fechas parciales: "diciembre 2023" o "diciembre de 2023"
    const fechaParcialRegex = /\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?\d{4}\b/gi;
    while ((match = fechaParcialRegex.exec(text)) !== null) {
        // Verificar que no está contenida en una fecha completa ya detectada
        const isContained = isContainedInEntities(entities, match.index, match.index + match[0].length);
        if (!isContained) {
            entities.push({
                type: 'FECHA',
                subtype: 'fecha_parcial',
                text: match[0],
                original: match[0],
                position: { start: match.index, end: match.index + match[0].length },
                confidence: 0.85
            });
        }
    }

    // Años con contexto: "diagnosticada en 2019", "desde 2015", etc.
    const anoContextoRegex = /\b(?:en|desde|hasta|durante|diagnosticad[oa]\s+en|ingresad[oa]\s+en|alta\s+en|consulta\s+en|seguimiento\s+desde)\s+(19\d{2}|20\d{2}|2100)\b/gi;
    while ((match = anoContextoRegex.exec(text)) !== null) {
        const ano = match[1];
        const startPos = match.index + match[0].lastIndexOf(ano);
        const endPos = startPos + ano.length;

        if (!isContainedInEntities(entities, startPos, endPos)) {
            entities.push({
                type: 'FECHA',
                subtype: 'ano',
                text: ano,
                original: ano,
                position: { start: startPos, end: endPos },
                confidence: 0.78
            });
        }
    }

    // Etiquetas explícitas: "Año: 2019"
    const anoEtiquetaRegex = /\b(?:Año|Anio)\s*:?\s*(19\d{2}|20\d{2}|2100)\b/gi;
    while ((match = anoEtiquetaRegex.exec(text)) !== null) {
        const ano = match[1];
        const startPos = match.index + match[0].lastIndexOf(ano);
        const endPos = startPos + ano.length;

        if (!isContainedInEntities(entities, startPos, endPos)) {
            entities.push({
                type: 'FECHA',
                subtype: 'ano',
                text: ano,
                original: ano,
                position: { start: startPos, end: endPos },
                confidence: 0.82
            });
        }
    }

    return entities;
}

function isContainedInEntities(entities, start, end) {
    return entities.some(e =>
        e.position.start <= start && e.position.end >= end
    );
}

export default { detectFechas };
