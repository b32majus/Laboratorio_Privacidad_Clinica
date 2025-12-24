import { PROVINCIAS } from '../dictionaries/provincias.js';

// Convertir diccionario de provincias a Set para búsqueda rápida
const PROVINCIAS_KEYS = Object.keys(PROVINCIAS);
// Regex para provincias (case insensitive)
const PROVINCIAS_REGEX = new RegExp(`\\b(${PROVINCIAS_KEYS.join('|')})\\b`, 'gi');

export const ubicacionesPattern = {
    name: 'ubicaciones',

    patterns: {
        // Dirección completa street types
        direccion: /(?:C\/|Calle|Avda\.|Avenida|Plaza|Pza\.|Paseo|Camino|Carretera|Ronda|Travesía|Glorieta)\s+[^,\.\n]+(?:,?\s*(?:nº?|núm\.?|número)?\s*\d{1,4})?(?:\s*,?\s*(?:\d{1,2}º?|bajo|ático|entresuelo))?/gi,

        // Código postal: 5 dígitos
        cp: /\b(0[1-9]|[1-4]\d|5[0-2])\d{3}\b/g,

        // Centro sanitario
        centro: /(?:Hospital|H\.|Clínica|Centro\s+de\s+Salud|CS\s|CAP\s|Ambulatorio|Consultorio)\s+(?:Universitario\s+)?[A-ZÁÉÍÓÚÑ][^,\.\n]{2,40}/gi
    },

    detect(text) {
        const results = [];

        // 1. Detectar direcciones, CPs y centros por regex
        for (const [subtype, regex] of Object.entries(this.patterns)) {
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(text)) !== null) {
                results.push({
                    type: 'UBICACION',
                    subtype: subtype,
                    text: match[0],
                    original: match[0],
                    position: {
                        start: match.index,
                        end: match.index + match[0].length
                    },
                    confidence: 0.85
                });
            }
        }

        // 2. Detectar provincias por diccionario
        PROVINCIAS_REGEX.lastIndex = 0;
        let match;
        while ((match = PROVINCIAS_REGEX.exec(text)) !== null) {
            results.push({
                type: 'UBICACION',
                subtype: 'provincia',
                text: match[0],
                original: match[0],
                position: {
                    start: match.index,
                    end: match.index + match[0].length
                },
                confidence: 0.95,
                metadata: {
                    ccaa: this.getCCAA(match[0])
                }
            });
        }

        return results;
    },

    getCCAA(provincia) {
        // Buscar case insensitive en el diccionario
        const key = Object.keys(PROVINCIAS).find(k => k.toLowerCase() === provincia.toLowerCase());
        return key ? PROVINCIAS[key] : null;
    }
};
