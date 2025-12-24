// Standalone version - All dependencies bundled
// No ES6 imports/exports

// ==================== DICTIONARIES ====================
// ==================== DICTIONARIES ====================
const NOMBRES_MUJER = ['María', 'Carmen', 'Josefa', 'Isabel', 'Dolores', 'Pilar', 'Teresa', 'Ana', 'Francisca', 'Laura', 'Cristina', 'Marta', 'Lucía', 'Elena', 'Mercedes', 'Luisa', 'Rosario', 'Juana', 'Raquel', 'Sara', 'Paula', 'Beatriz', 'Eva', 'Patricia', 'Julia', 'Andrea', 'Rocío', 'Mónica', 'Rosa', 'Silvia'];
const NOMBRES_HOMBRE = ['Antonio', 'José', 'Manuel', 'Francisco', 'Juan', 'David', 'Daniel', 'Carlos', 'Miguel', 'Pedro', 'Javier', 'Rafael', 'Fernando', 'Ángel', 'Luis', 'Pablo', 'Sergio', 'Jorge', 'Alberto', 'Diego', 'Adrián', 'Álvaro', 'Rubén', 'Iván', 'Enrique', 'Ramón', 'Vicente', 'Andrés', 'Joaquín', 'Santiago'];
const APELLIDOS = ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez', 'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Ramírez', 'Serrano', 'Blanco', 'Molina'];
const CIUDADES = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Las Palmas', 'Bilbao', 'Alicante', 'Córdoba', 'Valladolid', 'Vigo', 'Gijón', 'Hospitalet', 'Vitoria', 'Coruña', 'Elche', 'Granada', 'Terrassa', 'Badalona', 'Oviedo', 'Cartagena', 'Sabadell', 'Jerez', 'Móstoles', 'Pamplona', 'Almería', 'Alcalá', 'Fuenlabrada', 'Leganés', 'Donostia', 'San Sebastián', 'Getafe', 'Burgos', 'Santander', 'Albacete', 'Castellón', 'Alcorcón', 'Logroño', 'Badajoz', 'Huelva', 'Salamanca', 'Marbella', 'Lleida', 'Mataró', 'Tarragona', 'León', 'Cádiz', 'Pozoblanco', 'Dos Hermanas', 'Santa Coloma', 'Jaén', 'Algeciras'];

// ==================== ASIGNADOR DE SUSTITUTOS ====================
const AsignadorSustitutos = {
    mapaAsignaciones: new Map(),
    nombresUsados: { M: new Set(), F: new Set() },
    apellidosUsados: new Set(),

    reset() {
        this.mapaAsignaciones.clear();
        this.nombresUsados = { M: new Set(), F: new Set() };
        this.apellidosUsados.clear();
    },

    obtenerSustituto(nombreOriginal, genero = null) {
        const key = nombreOriginal.toLowerCase().trim();
        if (this.mapaAsignaciones.has(key)) {
            return this.mapaAsignaciones.get(key);
        }

        const generoDetectado = genero || this.detectarGenero(nombreOriginal);
        const nuevoNombre = this.seleccionarNombre(generoDetectado);
        const apellido1 = this.seleccionarApellido();
        const apellido2 = this.seleccionarApellido();
        const sustituto = `${nuevoNombre} ${apellido1} ${apellido2}`;

        this.mapaAsignaciones.set(key, sustituto);
        return sustituto;
    },

    detectarGenero(nombre) {
        const primerNombre = nombre.split(' ')[0].toLowerCase();
        if (primerNombre.endsWith('a') || primerNombre.endsWith('ía')) {
            if (['luca', 'bautista', 'borja', 'santiago', 'garcía'].includes(primerNombre)) return 'M';
            return 'F';
        }
        if (['carmen', 'rocío', 'consuelo', 'rosario', 'raquel', 'isabel'].includes(primerNombre)) return 'F';
        return 'M';
    },

    seleccionarNombre(genero) {
        const lista = genero === 'F' ? NOMBRES_MUJER : NOMBRES_HOMBRE;
        const usados = this.nombresUsados[genero];
        for (let i = 0; i < 50; i++) {
            const nombre = lista[Math.floor(Math.random() * lista.length)];
            if (!usados.has(nombre)) {
                usados.add(nombre);
                return nombre;
            }
        }
        return lista[Math.floor(Math.random() * lista.length)];
    },

    seleccionarApellido() {
        for (let i = 0; i < 50; i++) {
            const apellido = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
            if (!this.apellidosUsados.has(apellido)) {
                this.apellidosUsados.add(apellido);
                return apellido;
            }
        }
        return APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
    }
};

// ==================== NORMALIZACIÓN DE TEXTO ====================
const TextNormalizer = {
    // Mapa de caracteres con tildes a sin tildes
    accentMap: {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'ñ': 'ñ', 'Ñ': 'Ñ', // Mantener la ñ
        'ü': 'u', 'Ü': 'U'
    },

    removeAccents(text) {
        return text.split('').map(char => this.accentMap[char] || char).join('');
    },

    normalize(text) {
        return this.removeAccents(text).toLowerCase();
    },

    // Comparar dos strings ignorando tildes y mayúsculas
    matchIgnoreAccents(str1, str2) {
        return this.normalize(str1) === this.normalize(str2);
    },

    // Crear versiones normalizadas de diccionarios para búsqueda
    createNormalizedSet(array) {
        const normalizedMap = new Map();
        array.forEach(item => {
            const normalized = this.normalize(item);
            normalizedMap.set(normalized, item);
        });
        return normalizedMap;
    }
};

// Crear mapas normalizados de los diccionarios para búsqueda rápida
const NORMALIZED_NOMBRES_MUJER = TextNormalizer.createNormalizedSet(NOMBRES_MUJER);
const NORMALIZED_NOMBRES_HOMBRE = TextNormalizer.createNormalizedSet(NOMBRES_HOMBRE);
const NORMALIZED_APELLIDOS = TextNormalizer.createNormalizedSet(APELLIDOS);
const NORMALIZED_CIUDADES = TextNormalizer.createNormalizedSet(CIUDADES);

// ==================== PROCESSOR ====================
window.PrivacyProcessor = {
    process: function (text) {
        const startTime = performance.now();
        const sessionId = this.generateId();

        // Reset del asignador para nueva sesión
        AsignadorSustitutos.reset();

        if (!text) return this.createEmptyResult(sessionId);

        const entities = this.detectEntities(text);
        const resolved = this.resolveConflicts(entities);

        let processedText = text;
        const sortedEntities = [...resolved].sort((a, b) => b.position.start - a.position.start);

        for (const entity of sortedEntities) {
            entity.transformed = this.transformEntity(entity);
            processedText = processedText.slice(0, entity.position.start) +
                entity.transformed +
                processedText.slice(entity.position.end);
        }

        sortedEntities.sort((a, b) => a.position.start - b.position.start);

        return {
            original: text,
            processed: processedText,
            entities: sortedEntities,
            alerts: [],
            stats: this.calculateStats(sortedEntities),
            sessionId,
            processingTime: Math.round(performance.now() - startTime)
        };
    },

    generateId: function () {
        return Math.random().toString(36).substr(2, 8);
    },

    detectEntities: function (text) {
        const entities = [];

        // 1. DNI y Identificadores
        const dniRegex = /\b\d{8}[A-Z]\b/gi;
        let match;
        while ((match = dniRegex.exec(text)) !== null) {
            entities.push({ type: 'IDENTIFICADOR', subtype: 'dni', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.99 });
        }

        // NHC (Historia Clínica) - Patrón común
        const nhcRegex = /\b(?:NHC|Historia|H\.?C\.?)\s*:?\s*(\d+)/gi;
        while ((match = nhcRegex.exec(text)) !== null) {
            entities.push({ type: 'IDENTIFICADOR', subtype: 'nhc', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.95 });
        }

        // 2. Ubicaciones (Hospitales, Centros, Ciudades)
        // Detección explicita de Hospital/Clínica
        const hospitalRegex = /\b(?:hospital|clínica|centro de salud|consultorio)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:de\s+|del\s+)?(?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+|\d+))*/gi;
        while ((match = hospitalRegex.exec(text)) !== null) {
            const hosp = match[0].trim();
            // Evitar falsos positivos como "Hospital de día" si es muy genérico, pero por seguridad anonimizamos
            entities.push({ type: 'UBICACION', subtype: 'hospital', text: hosp, original: hosp, position: { start: match.index, end: match.index + hosp.length }, confidence: 0.9 });
        }

        // Detección de Ciudades por Diccionario (con normalización para tolerar errores)
        CIUDADES.forEach(ciudad => {
            // Buscar tanto la versión con tildes como sin tildes
            const normalizedCiudad = TextNormalizer.removeAccents(ciudad);
            const ciudadRegex = new RegExp(`\\b${ciudad}\\b`, 'gi');
            const normalizedRegex = new RegExp(`\\b${normalizedCiudad}\\b`, 'gi');

            // Buscar con tildes
            while ((match = ciudadRegex.exec(text)) !== null) {
                entities.push({ type: 'UBICACION', subtype: 'ciudad', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.85 });
            }

            // Buscar sin tildes (si es diferente)
            if (normalizedCiudad !== ciudad) {
                while ((match = normalizedRegex.exec(text)) !== null) {
                    entities.push({ type: 'UBICACION', subtype: 'ciudad', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.80 });
                }
            }
        });

        // Detección por Contexto de Ubicación ("vive en X", "reside en Y")
        const contextoUbiRegex = /\b(?:vive?|viven?|reside|residen?|natural|naturales|procedente|domiciliado|domiciliada|vecino|vecina)\s+(?:en\s+|de\s+)([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/gi;
        while ((match = contextoUbiRegex.exec(text)) !== null) {
            // El grupo 1 es el lugar
            const fullMatch = match[0];
            const lugar = match[1];
            const startPos = match.index + match[0].lastIndexOf(lugar); // Ajuste aproximado
            entities.push({ type: 'UBICACION', subtype: 'contexto', text: lugar, original: lugar, position: { start: startPos, end: startPos + lugar.length }, confidence: 0.75 });
        }

        // 3. Profesionales de Salud
        const doctorRegex = /\b(?:Dr\.|Dra\.|Doctor|Doctora|Facultativo)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})/g;
        while ((match = doctorRegex.exec(text)) !== null) {
            entities.push({ type: 'NOMBRE', subtype: 'profesional', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.9 });
        }

        // 4. Pacientes (Contexto de "paciente X", permitiendo partículas como "del", "de la")
        const pacienteRegex = /\bpaciente\s+(?:es\s+|se\s+llama\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:del?|de\s+la|de\s+los\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})/gi;
        while ((match = pacienteRegex.exec(text)) !== null) {
            const nombre = match[1];
            const startPos = match.index + match[0].indexOf(nombre);
            entities.push({ type: 'NOMBRE', subtype: 'paciente', text: nombre, original: nombre, position: { start: startPos, end: startPos + nombre.length }, confidence: 0.85 });
        }

        // 5. Fechas y Edades
        // Edad (ej: "54 años")
        const edadRegex = /\b(\d{1,3})\s+años?\b/gi;
        while ((match = edadRegex.exec(text)) !== null) {
            entities.push({ type: 'FECHA', subtype: 'edad', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.85 });
        }

        // Fechas Completas (dd/mm/yyyy o dd de mes de yyyy)
        const fechaFullRegex = /\b(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})|\b(?:\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+|del\s+)?\d{4})\b/gi;
        while ((match = fechaFullRegex.exec(text)) !== null) {
            entities.push({ type: 'FECHA', subtype: 'fecha_completa', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.95 });
        }

        // 6. Entidades Sospechosas (Cuasi-identificadores)
        const patronesSospechosos = [
            // Profesiones únicas/cargos públicos
            /\b(?:alcalde|concejal|director|presidente|gerente)\s+(?:del?|de\s+la)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+)/gi,
            // Enfermedades raras
            /\b(?:enfermedad|síndrome|patología)\s+(?:rara|ultra[\s\-]?rara|huérfana|poco\s+frecuente)/gi,
            // Referencias a unicidad
            /\b(?:único|única|solo|sola)\s+(?:paciente|caso|persona|enfermo)/gi,
            // Nacimientos múltiples
            /\b(?:gemelo|trillizo|mellizo)/gi,
            // Relaciones familiares con nombres
            /\b(?:hermano|hermana|padre|madre|hijo|hija|esposo|esposa)\s+(?:de|del)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/gi
        ];

        patronesSospechosos.forEach(pattern => {
            let match2;
            while ((match2 = pattern.exec(text)) !== null) {
                const textoCompleto = match2[0];
                entities.push({
                    type: 'SOSPECHOSO',
                    subtype: 'cuasi_identificador',
                    text: textoCompleto,
                    original: textoCompleto,
                    position: { start: match2.index, end: match2.index + textoCompleto.length },
                    confidence: 0.6,
                    requiresReview: true
                });
            }
        });

        // Mantener detector de mayúsculas inesperadas
        const sospechosoRegex = /(?<!^|[.!?]\s)\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)\b/g;
        while ((match = sospechosoRegex.exec(text)) !== null) {
            const palabra = match[1];
            const palabrasComunes = ['El', 'La', 'Los', 'Las', 'Un', 'Una', 'Y', 'O', 'Pero', 'Sin', 'Con', 'Por', 'Según', 'Durante'];
            if (palabra.length > 2 && !palabrasComunes.includes(palabra)) {
                entities.push({
                    type: 'SOSPECHOSO',
                    subtype: 'mayuscula_inesperada',
                    text: palabra,
                    original: palabra,
                    position: { start: match.index + match[0].indexOf(palabra), end: match.index + match[0].indexOf(palabra) + palabra.length },
                    confidence: 0.3,
                    requiresReview: true
                });
            }
        }

        return entities;
    },

    resolveConflicts: function (entities) {
        entities.sort((a, b) => {
            if (b.confidence !== a.confidence) return b.confidence - a.confidence;
            return (b.position.end - b.position.start) - (a.position.end - a.position.start);
        });

        const resolved = [];
        const occupied = new Set();

        for (const entity of entities) {
            let collision = false;
            for (let i = entity.position.start; i < entity.position.end; i++) {
                if (occupied.has(i)) {
                    collision = true;
                    break;
                }
            }

            if (!collision) {
                resolved.push(entity);
                for (let i = entity.position.start; i < entity.position.end; i++) {
                    occupied.add(i);
                }
            }
        }

        return resolved.sort((a, b) => a.position.start - b.position.start);
    },

    transformEntity: function (entity) {
        if (entity.type === 'NOMBRE') {
            if (entity.subtype === 'profesional') return '[Facultativo]';

            // USAR AsignadorSustitutos para mantener consistencia
            const nombreOriginal = entity.original || entity.text;
            return AsignadorSustitutos.obtenerSustituto(nombreOriginal);
        }
        if (entity.type === 'FECHA') {
            if (entity.subtype === 'edad') {
                const edadMatch = entity.text.match(/(\d+)/);
                if (edadMatch) {
                    const edad = parseInt(edadMatch[1]);
                    const rangoMin = Math.floor(edad / 10) * 10;
                    const rangoMax = rangoMin + 9;
                    return `${rangoMin}-${rangoMax} años`;
                }
                return '[rango edad]';
            }
            if (entity.subtype === 'fecha_completa' || /^\d{1,2}[\/-]/.test(entity.text)) {
                // Intentar calcular tiempo relativo
                const relativo = this.calculateRelativeTime(entity.text);
                if (relativo) return `[${relativo}]`;
                return '[Fecha]';
            }
            return '[Fecha]';
        }
        if (entity.type === 'IDENTIFICADOR') {
            if (entity.subtype === 'dni') return '[DNI]';
            if (entity.subtype === 'nhc') return '[NHC]';
            return '[ID]';
        }
        if (entity.type === 'UBICACION') {
            if (entity.subtype === 'hospital') return '[Centro Sanitario]';
            if (entity.subtype === 'ciudad') return '[Localidad]';
            return '[Ubicación]';
        }
        if (entity.type === 'SOSPECHOSO') {
            // Las entidades sospechosas NO se transforman automáticamente, 
            // pero si llegan a transformarse (usuario acepta) se ocultan genéricamente
            return '[Dato Personal]';
        }
        return `[${entity.type}]`;
    },

    calculateRelativeTime: function (dateStr) {
        // Soporte básico para formatos dd/mm/yyyy y dd de mes de yyyy
        try {
            let date;
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                date = new Date(parts[2], parts[1] - 1, parts[0]);
            } else {
                // Parseo básico de texto "18 de diciembre de 2023"
                const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                const parts = dateStr.toLowerCase().replace(/de /g, '').split(' ');
                // Ej: ["18", "diciembre", "2023"]
                const day = parseInt(parts[0]);
                const monthInfo = parts.find(p => meses.includes(p));
                const year = parseInt(parts[parts.length - 1]);

                if (monthInfo && !isNaN(day) && !isNaN(year)) {
                    date = new Date(year, meses.indexOf(monthInfo), day);
                }
            }

            if (date && !isNaN(date.getTime())) {
                const now = new Date();
                const diffTime = Math.abs(now - date);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 30) return `hace ${diffDays} días`;
                if (diffDays < 365) return `hace ${Math.floor(diffDays / 30)} meses`;
                return `hace ${Math.floor(diffDays / 365)} años`;
            }
        } catch (e) {
            console.warn('Error parsing date:', dateStr);
        }
        return null;
    },

    calculateStats: function (entities) {
        const stats = {
            totalEntities: entities.length,
            byType: { nombres: 0, fechas: 0, identificadores: 0, ubicaciones: 0 }
        };

        entities.forEach(e => {
            if (e.type === 'NOMBRE') stats.byType.nombres++;
            if (e.type === 'FECHA') stats.byType.fechas++;
            if (e.type === 'IDENTIFICADOR') stats.byType.identificadores++;
            if (e.type === 'UBICACION') stats.byType.ubicaciones++;
        });

        return stats;
    },

    createEmptyResult: function (sessionId) {
        return {
            original: '',
            processed: '',
            entities: [],
            alerts: [],
            stats: { totalEntities: 0, byType: {} },
            sessionId,
            processingTime: 0
        };
    }
};
