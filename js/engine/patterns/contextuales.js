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
            pattern: /(?:alcalde|concejal|director|presidente|gerente|notario|juez|magistrado)\s+(?:del?|de\s+la)/gi,
            reason: 'Cargo público o profesional relevante fácilmente identificable',
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

    detect(text) {
        const alerts = [];

        for (const { pattern, reason, action } of this.alertPatterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                alerts.push({
                    id: crypto.randomUUID(),
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
