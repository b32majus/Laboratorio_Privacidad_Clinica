export const identificadoresPattern = {
    name: 'identificadores',

    patterns: {
        // DNI español: 8 dígitos + letra
        dni: /\b\d{8}[A-Z]\b/g,

        // NIE: X/Y/Z + 7 dígitos + letra
        nie: /\b[XYZ]\d{7}[A-Z]\b/g,

        // NHC (múltiples formatos)
        nhc: /(?:NHC|N\.?H\.?C\.?|Historia|Hª|HC)\s*:?\s*#?(\d{5,12})/gi,

        // SIP (Sistema Información Poblacional)
        sip: /(?:SIP|N\.?SIP|NASS)\s*:?\s*(\d{10,14})/gi,

        // Tarjeta sanitaria
        tarjeta: /(?:tarjeta\s+sanitaria|TS|CIP)\s*:?\s*([A-Z]{2,4}\d{10,14})/gi,

        // Teléfono español (móvil y fijo)
        telefono: /(?:\+34\s?)?(?:6\d{2}|7[1-9]\d|9\d{2})[\s\.\-]?\d{3}[\s\.\-]?\d{3}\b/g,

        // Email
        email: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,

        // NSS (Número Seguridad Social)
        nss: /\b\d{2}[\s\-]?\d{8}[\s\-]?\d{2}\b/g
    },

    detect(text) {
        const results = [];

        for (const [type, regex] of Object.entries(this.patterns)) {
            let match;
            // Reset lastIndex for global regex
            regex.lastIndex = 0;

            while ((match = regex.exec(text)) !== null) {
                // Para grupos de captura (NHC, SIP, etc), usamos el grupo 1, si no el match completo
                const value = match[1] || match[0];
                const fullMatch = match[0];

                // Calcular posición real del valor identificado
                const start = match.index + (match[1] ? fullMatch.indexOf(value) : 0);

                results.push({
                    type: 'IDENTIFICADOR',
                    subtype: type,
                    text: value,
                    original: value,
                    position: {
                        start: start,
                        end: start + value.length
                    },
                    confidence: 1.0
                });
            }
        }

        return results;
    }
};
