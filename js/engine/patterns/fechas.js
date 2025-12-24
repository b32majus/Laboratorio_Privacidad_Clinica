export const fechasPattern = {
    name: 'fechas',

    patterns: {
        // dd/mm/yyyy o dd-mm-yyyy
        numerico: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g,

        // "12 de mayo de 2024"
        textoCompleto: /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})\b/gi,

        // "mayo 2024"
        mesAño: /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})\b/gi,

        // Años aislados relevantes
        añoContextual: /(?:desde|en|año|nacido\s+en|diagnosticado\s+en)\s+(\d{4})\b/gi
    },

    detect(text) {
        const results = [];

        for (const [subtype, regex] of Object.entries(this.patterns)) {
            regex.lastIndex = 0;
            let match;

            while ((match = regex.exec(text)) !== null) {
                results.push({
                    type: 'FECHA',
                    subtype: subtype,
                    text: match[0],
                    original: match[0],
                    position: {
                        start: match.index,
                        end: match.index + match[0].length
                    },
                    confidence: 0.9
                });
            }
        }

        return results;
    }
};
