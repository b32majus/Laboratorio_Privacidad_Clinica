// Detector de Ubicaciones - Hospitales, ciudades, centros de salud y barrios

/**
 * Detecta ubicaciones en texto clínico.
 * @param {string} text
 * @param {Object|Array<string>} locationData - Diccionarios de ubicación o lista legacy de ciudades.
 * @param {Function} normalizeText
 * @returns {Array}
 */
export function detectUbicaciones(text, locationData, normalizeText) {
    const entities = [];
    let match;
    const seen = new Set();

    const data = Array.isArray(locationData)
        ? { ciudades: locationData }
        : (locationData || {});

    const ciudadesList = Array.isArray(data.ciudades) ? data.ciudades : [];
    const hospitalesList = Array.isArray(data.hospitales) ? data.hospitales : [];
    const centrosSaludPrefijos = Array.isArray(data.centrosSaludPrefijos) ? data.centrosSaludPrefijos : [];
    const barriosList = Array.isArray(data.barrios) ? data.barrios : [];

    const addEntity = (subtype, value, start, confidence = 0.9) => {
        const textValue = String(value || '').trim();
        if (!textValue) return;
        const end = start + textValue.length;
        if (end <= start) return;
        const key = `${subtype}:${start}:${end}:${textValue.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        entities.push({
            type: 'UBICACION',
            subtype,
            text: textValue,
            original: textValue,
            position: { start, end },
            confidence
        });
    };

    // Palabras que terminan un nombre de hospital capturado por regex.
    const palabrasFinHospital = [
        'período', 'periodo', 'médico', 'medico', 'enfermera', 'enfermero',
        'doctor', 'doctora', 'paciente', 'tratamiento', 'consulta', 'cita', 'urgencias',
        'ingreso', 'alta', 'derivación', 'derivacion', 'semana', 'mes', 'año', 'día', 'dia',
        'criterios', 'valoración', 'valoracion', 'evaluación', 'evaluacion', 'gravedad',
        'cumplidos', 'cumplidas', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
        'el', 'la', 'los', 'las', 'desde', 'hasta', 'durante', 'para', 'por', 'con'
    ];
    const palabrasFinHospitalRegex = new RegExp(`\\s+(del?\\s+\\d+\\s+)?(${palabrasFinHospital.join('|')}).*$`, 'gi');

    // === HOSPITALES POR PATRÓN ===
    const hospitalRegex = /\b(?:complejo hospitalario|hospital|clínica|clinica|centro de salud|consultorio|h\.u\.|h\.)\s+(?:(?:universitario|infantil|general|regional|comarcal|provincial|materno|clínico|clinico)\s+)*(?:de\s+(?:día\s+|dia\s+)?)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:de\s+la\s+|del\s+|de\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*/gi;
    while ((match = hospitalRegex.exec(text)) !== null) {
        let hospital = match[0].trim();
        hospital = hospital.replace(palabrasFinHospitalRegex, '').trim();
        hospital = hospital.replace(/\s+del?\s+\d{1,2}\s*(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)?\s*\d{0,4}$/gi, '').trim();
        hospital = hospital.replace(/\s+el\s+\d{1,2}\s+de\s*$/gi, '').trim();
        if (hospital.length < 10) continue;
        if (/\s+(de|del|el|la)$/i.test(hospital)) continue;
        addEntity('hospital', hospital, match.index, 0.95);
    }

    // === HOSPITALES POR DICCIONARIO ===
    if (hospitalesList.length > 0) {
        const ordered = [...hospitalesList]
            .filter(Boolean)
            .sort((a, b) => b.length - a.length);

        for (const hospitalName of ordered) {
            const regex = new RegExp(`\\b${escapeRegex(hospitalName)}\\b`, 'gi');
            while ((match = regex.exec(text)) !== null) {
                const startPos = match.index;
                const endPos = startPos + match[0].length;
                const around = text.slice(Math.max(0, startPos - 35), Math.min(text.length, endPos + 25));
                const hasContext = /(hospital|h\.u\.|cl[ií]nica|centro\s+de\s+salud|ingresad[oa]|derivad[oa]|seguimiento|urgencias|consulta)/i.test(around);
                if (hasContext) {
                    addEntity('hospital', match[0], startPos, 0.91);
                }
            }
        }
    }

    // === CENTROS DE SALUD POR PREFIJO ===
    if (centrosSaludPrefijos.length > 0) {
        const prefijos = centrosSaludPrefijos
            .filter(Boolean)
            .map(escapeRegex)
            .sort((a, b) => b.length - a.length);

        if (prefijos.length > 0) {
            const centroRegex = new RegExp(
                `\\b(?:${prefijos.join('|')})\\s+[A-ZÁÉÍÓÚÑ][^\\n\\r\\.;,]{2,80}`,
                'g'
            );

            while ((match = centroRegex.exec(text)) !== null) {
                let centro = match[0].trim();
                centro = centro.replace(/\s+(?:en|con|por|para)\s+.*$/i, '').trim();
                if (centro.length >= 8) {
                    addEntity('hospital', centro, match.index, 0.9);
                }
            }
        }
    }

    // === CIUDADES POR DICCIONARIO ===
    for (const ciudad of ciudadesList) {
        if (!ciudad) continue;
        const ciudadRegex = new RegExp(`\\b${escapeRegex(ciudad)}\\b`, 'gi');
        while ((match = ciudadRegex.exec(text)) !== null) {
            addEntity('ciudad', match[0], match.index, 0.9);
        }

        if (!normalizeText) continue;
        const normalizedCiudad = normalizeText(ciudad);
        if (normalizedCiudad === ciudad.toLowerCase()) continue;

        const normalizedRegex = new RegExp(`\\b${escapeRegex(normalizedCiudad)}\\b`, 'gi');
        while ((match = normalizedRegex.exec(text)) !== null) {
            addEntity('ciudad', match[0], match.index, 0.85);
        }
    }

    // === DETECCIÓN DE CONTEXTO GEOGRÁFICO ===
    const contextoUbiRegex = /\b(?:[Vv]ive?|[Vv]iven?|[Rr]eside|[Rr]esidente?|[Rr]esiden?|[Nn]atural(?:es)?|[Pp]rocedente|[Dd]omiciliado|[Dd]omiciliada|[Vv]ecino|[Vv]ecina)\s+(?:en\s+|de\s+)([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/g;
    while ((match = contextoUbiRegex.exec(text)) !== null) {
        const lugar = match[1];
        const startPos = match.index + match[0].lastIndexOf(lugar);
        addEntity('contexto', lugar, startPos, 0.85);
    }

    const contextoAdminRegex = /\b(?:[Mm]unicipio|[Ll]ocalidad|[Pp]rovincia|[Cc]omarca)\s+de\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/g;
    while ((match = contextoAdminRegex.exec(text)) !== null) {
        const lugar = match[1];
        const startPos = match.index + match[0].lastIndexOf(lugar);
        addEntity('contexto', lugar, startPos, 0.88);
    }

    // === BARRIOS/DISTRITOS ===
    const barrioContextRegex = /\b(?:barrio|distrito|zona|urbanizaci[oó]n)\s+de\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})/gi;
    while ((match = barrioContextRegex.exec(text)) !== null) {
        const barrio = match[1];
        const startPos = match.index + match[0].lastIndexOf(barrio);
        addEntity('barrio', barrio, startPos, 0.84);
    }

    if (barriosList.length > 0) {
        const orderedBarrios = [...barriosList]
            .filter(Boolean)
            .sort((a, b) => b.length - a.length);

        for (const barrio of orderedBarrios) {
            const regex = new RegExp(`\\b${escapeRegex(barrio)}\\b`, 'gi');
            while ((match = regex.exec(text)) !== null) {
                const startPos = match.index;
                const endPos = startPos + match[0].length;
                const around = text.slice(Math.max(0, startPos - 25), Math.min(text.length, endPos + 25));
                const hasContext = /(barrio|distrito|zona|calle|avenida|domicilio|direcci[oó]n|reside|vive)/i.test(around);
                if (hasContext) {
                    addEntity('barrio', match[0], startPos, 0.8);
                }
            }
        }
    }

    // === CIUDADES COMPUESTAS (fallback) ===
    const ciudadesCompuestas = [
        /\bMairena\s+del\s+Aljarafe\b/gi,
        /\bSan\s+Fernando\b/gi,
        /\bSan\s+Sebastián\b/gi,
        /\bSan\s+Sebastian\b/gi,
        /\bSanta\s+Cruz\s+de\s+Tenerife\b/gi,
        /\bLas\s+Palmas\s+de\s+Gran\s+Canaria\b/gi,
        /\bPalma\s+de\s+Mallorca\b/gi,
        /\bSantiago\s+de\s+Compostela\b/gi,
        /\bAlcalá\s+de\s+Henares\b/gi,
        /\bJerez\s+de\s+la\s+Frontera\b/gi,
        /\bDos\s+Hermanas\b/gi,
        /\bEl\s+Puerto\s+de\s+Santa\s+María\b/gi,
        /\bRoquetas\s+de\s+Mar\b/gi
    ];

    for (const regex of ciudadesCompuestas) {
        while ((match = regex.exec(text)) !== null) {
            addEntity('ciudad', match[0], match.index, 0.92);
        }
    }

    return entities;
}

function escapeRegex(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default { detectUbicaciones };
