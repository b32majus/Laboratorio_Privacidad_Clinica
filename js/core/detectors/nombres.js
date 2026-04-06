// Detector de Nombres - Profesionales, pacientes, familiares
// Incluye sistema de scoring para mejor precisión

/**
 * Configuración de palabras a excluir
 */
const CONFIG = {
    // Palabras que NO son nombres de profesionales
    palabrasExcluidasProfesional: [
        // Especialidades médicas
        'especialista', 'dermatología', 'cardiología', 'pediatría', 'cirugía', 'medicina',
        'oncología', 'neurología', 'psiquiatría', 'traumatología', 'ginecología', 'urología',
        'oftalmología', 'otorrinolaringología', 'neumología', 'digestivo', 'endocrinología',
        'reumatología', 'nefrología', 'hematología', 'geriatría', 'radiología', 'anestesiología',
        // Cargos y roles
        'residente', 'adjunto', 'adjunta', 'jefe', 'jefa', 'responsable', 'coordinador', 'coordinadora',
        'supervisor', 'supervisora', 'titular', 'interino', 'interina', 'suplente',
        // Términos clínicos
        'correcta', 'valoración', 'valoracion', 'técnica', 'tecnica', 'evaluación', 'evaluacion',
        'escalas', 'protocolo', 'procedimiento', 'intervención', 'intervencion',
        // Otras palabras
        'médico', 'medico', 'servicio', 'unidad', 'área', 'area', 'consulta', 'planta'
    ],

    // Trailing words para profesionales
    palabrasTrailingProfesional: [
        'médico', 'medico', 'residente', 'adjunto', 'adjunta', 'especialista', 'jefe', 'jefa',
        'escalas', 'derivada', 'derivado', 'desde', 'hacia', 'para', 'con', 'del', 'de', 'la', 'el', 'en',
        'según', 'segun', 'mediante', 'durante', 'tras', 'ante', 'sobre', 'bajo', 'entre',
        'valoración', 'valoracion', 'evaluación', 'evaluacion', 'protocolo', 'procedimiento'
    ],

    // Palabras excluidas para pacientes
    palabrasExcluidasPaciente: [
        'que', 'refiere', 'estable', 'consciente', 'orientado', 'orientada', 'presenta', 'muestra',
        'niega', 'afirma', 'con', 'sin', 'ha', 'fue', 'es', 'no', 'si', 'sí', 'está', 'siendo',
        'tratado', 'tratada', 'derivado', 'derivada', 'diagnosticado', 'diagnosticada',
        'ingresado', 'ingresada', 'dado', 'dada', 'competente', 'capacitado', 'capacitada',
        'valorado', 'valorada', 'evaluado', 'evaluada', 'estabilizado', 'estabilizada',
        'mujer', 'hombre', 'varón', 'adulto', 'adulta', 'joven', 'anciano', 'anciana',
        'menor', 'niño', 'niña', 'bebé', 'recién', 'lactante', 'gestante', 'embarazada',
        'crónico', 'crónica', 'agudo', 'aguda', 'terminal', 'grave', 'leve', 'moderado', 'moderada',
        'pluripatológico', 'pluripatológica', 'polimedicado', 'polimedicada', 'crítico', 'crítica',
        // Palabras de ubicación/residencia que no son nombres
        'residente', 'reside', 'vive', 'domiciliado', 'domiciliada', 'natural', 'procedente',
        'vecino', 'vecina', 'nacido', 'nacida'
    ],

    // Palabras excluidas para familiares
    palabrasExcluidasFamiliar: [
        'telefónico', 'telefono', 'teléfono', 'presencial', 'urgente', 'pendiente',
        'ninguno', 'desconocido', 'no', 'si', 'sí'
    ],

    // Palabras que no son apellidos (terminan el nombre)
    noApellidos: [
        'derivada', 'derivado', 'desde', 'hacia', 'hasta', 'para', 'entre',
        'fármaco', 'farmaco', 'tratamiento', 'medicación', 'medicacion', 'terapia', 'dosis',
        'administración', 'administracion', 'autoadministración', 'autoadministracion',
        'hospital', 'clínica', 'clinica', 'centro', 'servicio', 'unidad', 'consulta',
        // Palabras adicionales que terminan nombres
        'el', 'la', 'los', 'las', 'del', 'de', 'al', 'con', 'por', 'en', 'que', 'como',
        'presenta', 'refiere', 'acude', 'ingresa', 'consulta', 'solicita', 'requiere'
    ]
};

/**
 * Detecta profesionales sanitarios en el texto
 * @param {string} text - Texto a analizar
 * @param {Object} dictionaries - Diccionarios {nombresMujer, nombresHombre, apellidos}
 * @param {Function} normalizeText - Función de normalización
 * @returns {Array} - Entidades detectadas
 */
export function detectProfesionales(text, dictionaries, normalizeText) {
    const entities = [];
    let match;

    const profesionalRegex = /\b(?:Dr\.|Dra\.|Doctor|Doctora|Facultativo|Enfermero|Enfermera|Enf\.|Fisioterapeuta|Psic[oó]log[oa]|Matrona|Farmac[eé]utic[oa]|Auxiliar|Técnico|T[eé]cnica)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/gi;

    while ((match = profesionalRegex.exec(text)) !== null) {
        let nombreCapturado = match[1];
        let matchCompleto = match[0];

        // Limpiar trailing words
        const palabrasNombre = nombreCapturado.split(/\s+/);
        const palabrasLimpias = [];

        for (const palabra of palabrasNombre) {
            const palabraLower = palabra.toLowerCase();
            if (CONFIG.palabrasTrailingProfesional.includes(palabraLower) ||
                CONFIG.palabrasExcluidasProfesional.includes(palabraLower)) {
                break;
            }
            palabrasLimpias.push(palabra);
        }

        if (palabrasLimpias.length === 0) continue;

        const primeraPalabra = palabrasLimpias[0].toLowerCase();
        if (CONFIG.palabrasExcluidasProfesional.includes(primeraPalabra)) continue;

        // Verificar nombre real en diccionarios
        const tieneNombreReal = verificarNombreEnDiccionarios(palabrasLimpias, dictionaries, normalizeText);

        if (!tieneNombreReal && palabrasLimpias.length < 2) continue;

        const nombreLimpio = palabrasLimpias.join(' ');
        const prefijo = matchCompleto.substring(0, matchCompleto.indexOf(match[1]));
        const textoLimpio = prefijo + nombreLimpio;
        const endPos = match.index + textoLimpio.length;

        entities.push({
            type: 'NOMBRE',
            subtype: 'profesional',
            text: textoLimpio,
            original: textoLimpio,
            position: { start: match.index, end: endPos },
            confidence: 0.9
        });
    }

    return entities;
}

/**
 * Detecta pacientes en el texto
 * @param {string} text - Texto a analizar
 * @param {Object} dictionaries - Diccionarios
 * @param {Function} normalizeText - Función de normalización
 * @returns {Array} - Entidades detectadas
 */
export function detectPacientes(text, dictionaries, normalizeText) {
    const entities = [];
    let match;
    const seen = new Set();

    const addEntity = (entity) => {
        const key = `${entity.position.start}:${entity.position.end}:${entity.text.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        entities.push(entity);
    };

    // Paciente + nombre
    const pacienteRegex = /\bpaciente\s+(?:es\s+|se\s+llama\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:(?:\s+(?:de|del|de la|de los|de las|y|i))?\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4})/gi;
    while ((match = pacienteRegex.exec(text)) !== null) {
        const nombre = match[1].trim();
        const nombreLimpio = limpiarNombrePaciente(nombre);

        if (!nombreLimpio) continue;

        const palabras = nombreLimpio.split(/\s+/);
        const primeraPalabra = palabras[0].toLowerCase();
        if (CONFIG.palabrasExcluidasPaciente.includes(primeraPalabra)) continue;

        const startPos = match.index + match[0].indexOf(nombre);
        addEntity({
            type: 'NOMBRE',
            subtype: 'paciente',
            text: nombreLimpio,
            original: nombreLimpio,
            position: { start: startPos, end: startPos + nombreLimpio.length },
            confidence: 0.88
        });
    }

    // Nombre: etiqueta
    const nombreLabelRegex = /Nombre\s*:\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:(?:\s+(?:de|del|de la|de los|de las|y|i))?\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,4})(?=\s*$|\s*\n|\r)/gmi;
    while ((match = nombreLabelRegex.exec(text)) !== null) {
        const nombre = limpiarNombrePaciente(match[1]);
        if (!nombre) continue;
        const startPos = match.index + match[0].indexOf(match[1]);
        addEntity({
            type: 'NOMBRE',
            subtype: 'paciente',
            text: nombre,
            original: nombre,
            position: { start: startPos, end: startPos + nombre.length },
            confidence: 0.95
        });
    }

    // Detección por diccionario
    if (dictionaries && dictionaries.nombresMujer && dictionaries.nombresHombre) {
        const nombresDiccionario = [
            ...dictionaries.nombresMujer,
            ...dictionaries.nombresHombre,
            ...(dictionaries.nombresUnisex || [])
        ];

        nombresDiccionario.forEach(nombre => {
            const nombreRegex = new RegExp(
                `\\b${escapeRegex(nombre)}(?:(?:\\s+(?:de|del|de la|de los|de las|y|i))?\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3}\\b`,
                'g'
            );
            let nombreMatch;

            while ((nombreMatch = nombreRegex.exec(text)) !== null) {
                const nombreCompleto = limpiarNombrePaciente(nombreMatch[0]);
                if (!nombreCompleto) continue;

                const primerToken = nombreCompleto.split(/\s+/)[0]?.toLowerCase() || '';
                if (CONFIG.palabrasExcluidasPaciente.includes(primerToken)) continue;

                addEntity({
                    type: 'NOMBRE',
                    subtype: 'paciente',
                    text: nombreCompleto,
                    original: nombreCompleto,
                    position: { start: nombreMatch.index, end: nombreMatch.index + nombreCompleto.length },
                    confidence: 0.82
                });
            }
        });
    }

    // Detección de abreviaturas frecuentes: "Mª", "Fco.", "Ant.", etc.
    if (dictionaries && dictionaries.abreviaturasNombres) {
        const abrevs = Object.keys(dictionaries.abreviaturasNombres)
            .filter(Boolean)
            .sort((a, b) => b.length - a.length)
            .map(escapeRegex);

        if (abrevs.length > 0) {
            const abrevRegex = new RegExp(
                `\\b(?:${abrevs.join('|')})\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3}\\b`,
                'g'
            );
            while ((match = abrevRegex.exec(text)) !== null) {
                const nombreAbreviado = match[0].trim();
                addEntity({
                    type: 'NOMBRE',
                    subtype: 'paciente',
                    text: nombreAbreviado,
                    original: nombreAbreviado,
                    position: { start: match.index, end: match.index + match[0].length },
                    confidence: 0.9
                });
            }
        }
    }

    return entities;
}

/**
 * Detecta familiares en el texto
 * @param {string} text - Texto a analizar
 * @returns {Array} - Entidades detectadas
 */
export function detectFamiliares(text) {
    const entities = [];
    let match;

    // Acompañante/Familiar/Contacto: Nombre
    const familiarFullRegex = /(?:Acompañante|Familiar|Contacto)\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,4})/gmi;
    while ((match = familiarFullRegex.exec(text)) !== null) {
        const contenido = match[1].trim();

        if (contenido.length >= 3 &&
            !CONFIG.palabrasExcluidasFamiliar.includes(contenido.toLowerCase()) &&
            /^[A-ZÁÉÍÓÚÑ]/.test(contenido)) {

            const startPos = match.index + match[0].indexOf(contenido);
            entities.push({
                type: 'NOMBRE',
                subtype: 'familiar',
                text: contenido,
                original: contenido,
                position: { start: startPos, end: startPos + contenido.length },
                confidence: 0.95
            });
        }
    }

    // Relación familiar con paréntesis: "Madre (María González, 68 años)"
    const relacionesFamiliares = [
        'esposa', 'esposo', 'madre', 'padre', 'hijo', 'hija',
        'hermano', 'hermana', 'abuelo', 'abuela', 'tío', 'tía',
        'primo', 'prima', 'sobrino', 'sobrina', 'cuñado', 'cuñada',
        'suegro', 'suegra', 'yerno', 'nuera', 'pareja', 'cónyuge',
        'tutor', 'tutora', 'abuela materna', 'abuela paterna',
        'abuelo materno', 'abuelo paterno', 'hermano mayor', 'hermana mayor'
    ];

    relacionesFamiliares.forEach(relacion => {
        const regexConParentesis = new RegExp(`\\b(${relacion})\\s*\\(([^)]+)\\)`, 'gmi');
        while ((match = regexConParentesis.exec(text)) !== null) {
            const contenidoParentesis = match[2];
            if (/[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/.test(contenidoParentesis)) {
                const bloque = match[0];
                entities.push({
                    type: 'NOMBRE',
                    subtype: 'familiar',
                    text: bloque,
                    original: bloque,
                    position: { start: match.index, end: match.index + bloque.length },
                    confidence: 0.98
                });
            }
        }
    });

    // Patrón alternativo: "Madre: María González" o "Padre: José López"
    const relacionSimple = ['madre', 'padre', 'esposo', 'esposa', 'hijo', 'hija'];
    relacionSimple.forEach(relacion => {
        const regexSimple = new RegExp(`\\b${relacion}\\s*:\\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})`, 'gmi');
        while ((match = regexSimple.exec(text)) !== null) {
            const nombre = match[1];
            const bloque = match[0];
            entities.push({
                type: 'NOMBRE',
                subtype: 'familiar',
                text: bloque,
                original: bloque,
                position: { start: match.index, end: match.index + bloque.length },
                confidence: 0.90
            });
        }
    });

    // Patrón: "Nombre Apellido, XX años" entre paréntesis
    // Detecta: "(María González, 68 años)" o "(José Márquez, 70 años)"
    // Acepta "años/año" con o sin tilde
    const nombreEdadRegex = /\(([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,2}),\s*\d{1,3}\s*a[ñn]os?\)/gi;
    while ((match = nombreEdadRegex.exec(text)) !== null) {
        // Verificar que no se solapa con una detección existente
        const solapado = entities.some(e =>
            (e.position.start <= match.index && e.position.end > match.index) ||
            (match.index <= e.position.start && match.index + match[0].length > e.position.start)
        );

        if (!solapado) {
            const bloque = match[0];
            entities.push({
                type: 'NOMBRE',
                subtype: 'familiar',
                text: bloque,
                original: bloque,
                position: { start: match.index, end: match.index + bloque.length },
                confidence: 0.92
            });
        }
    }

    return entities;
}

function esParticulaNombre(tokenLower) {
    return ['de', 'del', 'la', 'las', 'los', 'y', 'i'].includes(tokenLower);
}

function esTokenNombre(token) {
    return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(token);
}

function limpiarNombrePaciente(nombre) {
    if (!nombre) return '';

    const tokens = nombre
        .trim()
        .replace(/[,:;]+$/, '')
        .split(/\s+/)
        .map(token => token.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, ''))
        .filter(Boolean);

    const limpios = [];
    let totalTokensNombre = 0;

    for (const token of tokens) {
        const lower = token.toLowerCase();

        if (esParticulaNombre(lower) && limpios.length > 0) {
            limpios.push(lower);
            continue;
        }

        // Abreviaturas de una sola letra (ej: "Mª" -> "M")
        if (/^[A-ZÁÉÍÓÚÑ]$/.test(token)) {
            continue;
        }

        if (esTokenNombre(token)) {
            if (CONFIG.palabrasExcluidasPaciente.includes(lower) || CONFIG.noApellidos.includes(lower)) {
                break;
            }
            limpios.push(token);
            totalTokensNombre++;
            continue;
        }

        break;
    }

    while (limpios.length > 0 && esParticulaNombre(limpios[limpios.length - 1].toLowerCase())) {
        limpios.pop();
    }

    if (totalTokensNombre < 2 || limpios.length < 2) return '';
    return limpios.join(' ');
}

/**
 * Verifica si alguna palabra está en los diccionarios
 */
function verificarNombreEnDiccionarios(palabras, dictionaries, normalizeText) {
    if (!dictionaries || !normalizeText) return false;

    const { nombresMujer, nombresHombre, apellidos } = dictionaries;
    const allDicts = [
        ...(nombresMujer || []),
        ...(nombresHombre || []),
        ...(apellidos || [])
    ];

    const normalizedDicts = new Set(allDicts.map(n => normalizeText(n)));

    return palabras.some(p => normalizedDicts.has(normalizeText(p)));
}

/**
 * Escapa caracteres especiales para regex
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
    detectProfesionales,
    detectPacientes,
    detectFamiliares,
    CONFIG
};
