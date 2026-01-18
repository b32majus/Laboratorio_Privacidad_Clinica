// Standalone version - All dependencies bundled
// No ES6 imports/exports

// ==================== DICTIONARIES ====================
// ==================== DICTIONARIES ====================
// Diccionarios ampliados de nombres españoles (top 100 más comunes)
const NOMBRES_MUJER = [
    'María', 'Carmen', 'Josefa', 'Isabel', 'Dolores', 'Pilar', 'Teresa', 'Ana', 'Francisca', 'Laura',
    'Cristina', 'Marta', 'Lucía', 'Elena', 'Mercedes', 'Luisa', 'Rosario', 'Juana', 'Raquel', 'Sara',
    'Paula', 'Beatriz', 'Eva', 'Patricia', 'Julia', 'Andrea', 'Rocío', 'Mónica', 'Rosa', 'Silvia',
    'Antonia', 'Manuela', 'Encarnación', 'Concepción', 'Amparo', 'Inmaculada', 'Ángela', 'Margarita',
    'Victoria', 'Josefina', 'Aurora', 'Emilia', 'Nuria', 'Alicia', 'Sofía', 'Irene', 'Claudia', 'Natalia',
    'Esther', 'Verónica', 'Susana', 'Marina', 'Sonia', 'Lorena', 'Noelia', 'Alba', 'Yolanda', 'Sandra',
    'Ángeles', 'Consuelo', 'Esperanza', 'Milagros', 'Asunción', 'Belén', 'Montserrat', 'Nieves', 'Soledad',
    'Gloria', 'Olga', 'Lidia', 'Ainhoa', 'Miriam', 'Nerea', 'Carla', 'Emma', 'Valentina', 'Martina',
    'Inés', 'Adriana', 'Clara', 'Elsa', 'Lola', 'Maite', 'Blanca', 'Celia', 'Ainara', 'Aitana'
];
const NOMBRES_HOMBRE = [
    'Antonio', 'José', 'Manuel', 'Francisco', 'Juan', 'David', 'Daniel', 'Carlos', 'Miguel', 'Pedro',
    'Javier', 'Rafael', 'Fernando', 'Ángel', 'Luis', 'Pablo', 'Sergio', 'Jorge', 'Alberto', 'Diego',
    'Adrián', 'Álvaro', 'Rubén', 'Iván', 'Enrique', 'Ramón', 'Vicente', 'Andrés', 'Joaquín', 'Santiago',
    'Jesús', 'Eduardo', 'Alejandro', 'Mario', 'Óscar', 'Roberto', 'Raúl', 'Ricardo', 'Tomás', 'Guillermo',
    'Salvador', 'Emilio', 'Ignacio', 'Alfonso', 'Marcos', 'Víctor', 'Gonzalo', 'Jaime', 'Agustín', 'Arturo',
    'Félix', 'Gabriel', 'Julián', 'Mariano', 'Nicolás', 'Sebastián', 'Felipe', 'Lorenzo', 'Esteban', 'Hugo',
    'Martín', 'Lucas', 'Leo', 'Mateo', 'Izan', 'Marc', 'Pol', 'Bruno', 'Álex', 'Iker',
    'Aitor', 'Jon', 'Mikel', 'Unai', 'Asier', 'Gorka', 'Xavi', 'Pau', 'Oriol', 'Joan'
];
const APELLIDOS = [
    'García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín',
    'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez',
    'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Ramírez', 'Serrano', 'Blanco', 'Molina',
    'Morales', 'Suárez', 'Ortega', 'Delgado', 'Castro', 'Ortiz', 'Rubio', 'Marín', 'Sanz', 'Iglesias',
    'Núñez', 'Medina', 'Garrido', 'Cortés', 'Castillo', 'Santos', 'Lozano', 'Guerrero', 'Cano', 'Prieto',
    'Méndez', 'Cruz', 'Calvo', 'Gallego', 'Vidal', 'León', 'Márquez', 'Herrera', 'Peña', 'Flores',
    'Cabrera', 'Campos', 'Vega', 'Fuentes', 'Carrasco', 'Diez', 'Caballero', 'Reyes', 'Nieto', 'Aguilar',
    'Pascual', 'Santana', 'Herrero', 'Montero', 'Lorenzo', 'Hidalgo', 'Giménez', 'Ibáñez', 'Ferrer', 'Durán',
    'Santiago', 'Benítez', 'Vargas', 'Mora', 'Vicente', 'Arias', 'Carmona', 'Crespo', 'Rivas', 'Casas',
    'Crehuet', 'Cortés', 'Casas', 'Márquez', 'Belén'
];
const CIUDADES = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Las Palmas', 'Bilbao', 'Alicante', 'Córdoba', 'Valladolid', 'Vigo', 'Gijón', 'Hospitalet', 'Vitoria', 'Coruña', 'Elche', 'Granada', 'Terrassa', 'Badalona', 'Oviedo', 'Cartagena', 'Sabadell', 'Jerez', 'Móstoles', 'Pamplona', 'Almería', 'Alcalá', 'Fuenlabrada', 'Leganés', 'Donostia', 'San Sebastián', 'Getafe', 'Burgos', 'Santander', 'Albacete', 'Castellón', 'Alcorcón', 'Logroño', 'Badajoz', 'Huelva', 'Salamanca', 'Marbella', 'Lleida', 'Mataró', 'Tarragona', 'León', 'Cádiz', 'Pozoblanco', 'Dos Hermanas', 'Santa Coloma', 'Jaén', 'Algeciras'];

// ==================== ASIGNADOR DE SUSTITUTOS ====================
const AsignadorSustitutos = {
    mapaAsignaciones: new Map(),
    profesionalesMap: new Map(),
    familiaresMap: new Map(),
    contadorProfesionales: 0,
    contadorFamiliares: 0,

    reset() {
        this.mapaAsignaciones.clear();
        this.profesionalesMap.clear();
        this.familiaresMap.clear();
        this.contadorProfesionales = 0;
        this.contadorFamiliares = 0;
    },

    // Para PACIENTES: "Paciente Hombre" o "Paciente Mujer"
    obtenerSustituto(nombreOriginal, genero = null) {
        if (!nombreOriginal || nombreOriginal.trim() === '') return '';

        const key = nombreOriginal.toLowerCase().trim();
        if (this.mapaAsignaciones.has(key)) {
            return this.mapaAsignaciones.get(key);
        }

        const generoDetectado = genero || this.detectarGenero(nombreOriginal);
        const sustituto = generoDetectado === 'F' ? 'Paciente Mujer' : 'Paciente Hombre';

        this.mapaAsignaciones.set(key, sustituto);
        return sustituto;
    },

    // Para PROFESIONALES: "Profesional Sanitario 1, 2..."
    // Normaliza para que "Dra. Ruiz" y "Dra. Carmen Ruiz" sean el mismo profesional
    normalizarProfesional(nombre) {
        if (!nombre) return '';
        let normalized = nombre.toLowerCase().trim();

        // Eliminar prefijos Dr./Dra./Doctor/Doctora
        normalized = normalized.replace(/^(dr\.|dra\.|doctor|doctora|facultativo)\s*/i, '');

        // Extraer apellidos (las palabras que empiezan con mayúscula después del nombre)
        // Normalizar espacios
        normalized = normalized.replace(/\s+/g, ' ').trim();

        return normalized;
    },

    // Extrae el apellido principal (último apellido mencionado o único apellido)
    extraerApellidoPrincipal(nombre) {
        const normalized = this.normalizarProfesional(nombre);
        const palabras = normalized.split(' ');
        // El apellido suele ser la última palabra, o la segunda si hay nombre + apellido
        if (palabras.length >= 1) {
            // Buscar en APELLIDOS conocidos
            for (let i = palabras.length - 1; i >= 0; i--) {
                const palabra = palabras[i];
                const palabraCapitalizada = palabra.charAt(0).toUpperCase() + palabra.slice(1);
                if (APELLIDOS.some(a => a.toLowerCase() === palabra)) {
                    return palabra;
                }
            }
            // Si no encontramos apellido conocido, devolver la última palabra
            return palabras[palabras.length - 1];
        }
        return normalized;
    },

    obtenerSustitutoProfesional(nombreOriginal) {
        if (!nombreOriginal || nombreOriginal.trim() === '') return '';

        const keyCompleta = this.normalizarProfesional(nombreOriginal);
        const apellidoPrincipal = this.extraerApellidoPrincipal(nombreOriginal);

        // Primero buscar coincidencia exacta
        if (this.profesionalesMap.has(keyCompleta)) {
            return this.profesionalesMap.get(keyCompleta);
        }

        // Buscar si alguna clave existente representa al mismo profesional
        // CRITERIO: Solo unificar si la versión corta está contenida en la larga
        // Ej: "ruiz" unifica con "carmen ruiz" pero NO con "pedro ruiz"
        for (const [existingKey, value] of this.profesionalesMap.entries()) {
            // Verificar si uno es versión corta del otro (ej: "ruiz" vs "carmen ruiz")
            const keyMasCorta = keyCompleta.length < existingKey.length ? keyCompleta : existingKey;
            const keyMasLarga = keyCompleta.length >= existingKey.length ? keyCompleta : existingKey;

            // Solo unificar si la clave corta es un sufijo de la larga (apellido al final)
            // O si la clave corta está contenida completamente
            if (keyMasLarga.endsWith(keyMasCorta) ||
                (keyMasCorta.split(' ').length === 1 && keyMasLarga.includes(` ${keyMasCorta}`))) {
                // Verificar que la clave corta es significativa (más de 2 caracteres)
                if (keyMasCorta.length > 2) {
                    this.profesionalesMap.set(keyCompleta, value);
                    return value;
                }
            }
        }

        this.contadorProfesionales++;
        const sustituto = `Profesional Sanitario ${this.contadorProfesionales}`;
        this.profesionalesMap.set(keyCompleta, sustituto);
        return sustituto;
    },

    // Para FAMILIARES: "Familiar 1, 2..."
    // La coherencia se basa en el TIPO de relación (madre, esposa, etc.)
    obtenerSustitutoFamiliar(nombreOriginal) {
        if (!nombreOriginal || nombreOriginal.trim() === '') return '';

        // Extraer la palabra de relación familiar del texto
        const relacionesFamiliares = ['esposa', 'esposo', 'madre', 'padre', 'hijo', 'hija', 'hermano', 'hermana', 'abuelo', 'abuela', 'tío', 'tía', 'primo', 'prima', 'sobrino', 'sobrina', 'cuñado', 'cuñada', 'suegro', 'suegra', 'yerno', 'nuera', 'pareja', 'cónyuge', 'tutor', 'tutora'];

        const textoLower = nombreOriginal.toLowerCase();
        let relacionEncontrada = null;

        for (const relacion of relacionesFamiliares) {
            if (textoLower.includes(relacion)) {
                relacionEncontrada = relacion;
                break;
            }
        }

        // Usar la relación como clave, o el texto completo si no se encuentra
        const key = relacionEncontrada || textoLower.trim();

        if (this.familiaresMap.has(key)) {
            return this.familiaresMap.get(key);
        }

        this.contadorFamiliares++;
        const sustituto = `Familiar ${this.contadorFamiliares}`;
        this.familiaresMap.set(key, sustituto);
        return sustituto;
    },


    detectarGenero(nombre) {
        const primerNombre = nombre.split(' ')[0].toLowerCase();
        if (primerNombre.endsWith('a') || primerNombre.endsWith('ía')) {
            if (['luca', 'bautista', 'borja', 'santiago', 'garcía'].includes(primerNombre)) return 'M';
            return 'F';
        }
        const nombresFemeninos = ['carmen', 'rocío', 'consuelo', 'rosario', 'raquel', 'isabel', 'pilar', 'mar', 'mercedes', 'dolores', 'nieves', 'milagros', 'belen', 'belén'];
        if (nombresFemeninos.includes(primerNombre)) return 'F';
        return 'M';
    }
};

// ==================== COHERENCIA UBICACIONES ====================
const UbicacionesManager = {
    centrosMap: new Map(),
    ciudadesMap: new Map(),
    contadorCentros: 0,
    contadorCiudades: 0,

    reset() {
        this.centrosMap.clear();
        this.ciudadesMap.clear();
        this.contadorCentros = 0;
        this.contadorCiudades = 0;
    },

    // Normaliza el nombre del centro para consistencia
    normalizarCentro(centro) {
        if (!centro) return '';
        let normalized = centro.toLowerCase().trim();

        // Eliminar palabras que no son parte del nombre del centro
        const palabrasRuido = ['período', 'periodo', 'médico', 'medico', 'del', 'de', 'la', 'el', 'los', 'las'];
        // Solo eliminar si están al final y no forman parte del nombre
        normalized = normalized.replace(/\s+(período|periodo|médico|medico)\s*$/gi, '');

        // Normalizar variantes comunes de hospitales
        // "H.U." = "Hospital Universitario", "H." = "Hospital"
        normalized = normalized.replace(/^h\.\s*u\.\s*/i, 'hospital universitario ');
        normalized = normalized.replace(/^h\.\s*/i, 'hospital ');

        // Eliminar "de día" y similares que son modificadores, no nombres
        normalized = normalized.replace(/\s+de\s+día\s*/gi, ' ');

        // Normalizar espacios múltiples
        normalized = normalized.replace(/\s+/g, ' ').trim();

        return normalized;
    },

    obtenerCentro(centroOriginal) {
        if (!centroOriginal || centroOriginal.trim() === '') return '';

        const key = this.normalizarCentro(centroOriginal);

        // Buscar si ya existe una clave similar (para manejar variantes)
        for (const [existingKey, value] of this.centrosMap.entries()) {
            // Si una clave contiene a la otra o viceversa, usar el mismo código
            if (existingKey.includes(key) || key.includes(existingKey)) {
                // Guardar también esta variante para futuras búsquedas
                this.centrosMap.set(key, value);
                return value;
            }
        }

        if (this.centrosMap.has(key)) {
            return this.centrosMap.get(key);
        }

        this.contadorCentros++;
        const letra = String.fromCharCode(64 + this.contadorCentros); // A, B, C...
        const sustituto = `Centro ${letra}`;
        this.centrosMap.set(key, sustituto);
        return sustituto;
    },

    obtenerCiudad(ciudadOriginal) {
        if (!ciudadOriginal || ciudadOriginal.trim() === '') return '';

        const key = ciudadOriginal.toLowerCase().trim();
        if (this.ciudadesMap.has(key)) {
            return this.ciudadesMap.get(key);
        }

        this.contadorCiudades++;
        const letra = String.fromCharCode(64 + this.contadorCiudades); // A, B, C...
        const sustituto = `Ciudad ${letra}`;
        this.ciudadesMap.set(key, sustituto);
        return sustituto;
    }
};

// ==================== RELATIVIZACIÓN DE FECHAS ====================
const FechasManager = {
    visitasOrdenadas: [], // Array de { fecha: Date, original: string }
    visitasMap: new Map(),
    hoy: new Date(),

    reset() {
        this.visitasOrdenadas = [];
        this.visitasMap.clear();
        this.hoy = new Date();
    },

    parseFecha(texto) {
        if (!texto) return null;
        // dd/mm/yyyy o dd-mm-yyyy
        const matchNumerico = texto.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (matchNumerico) {
            const day = parseInt(matchNumerico[1]);
            const month = parseInt(matchNumerico[2]) - 1;
            let year = parseInt(matchNumerico[3]);
            if (year < 100) year += (year > 50 ? 1900 : 2000);
            return new Date(year, month, day);
        }
        return null;
    },

    calcularDiasDiferencia(fecha1, fecha2) {
        const diffTime = fecha2 - fecha1;
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    },

    procesarVisita(fechaOriginal) {
        const key = fechaOriginal.trim();

        if (this.visitasMap.has(key)) {
            return this.visitasMap.get(key);
        }

        const fechaParsed = this.parseFecha(fechaOriginal);
        if (!fechaParsed) {
            // Si no se puede parsear, relativizar respecto a hoy
            return this.relativizarRespHoy(fechaOriginal);
        }

        // Añadir a la lista de visitas
        this.visitasOrdenadas.push({ fecha: fechaParsed, original: key });

        // Ordenar por fecha
        this.visitasOrdenadas.sort((a, b) => a.fecha - b.fecha);

        // Recalcular todas las etiquetas
        this.recalcularEtiquetas();

        return this.visitasMap.get(key);
    },

    recalcularEtiquetas() {
        this.visitasMap.clear();

        for (let i = 0; i < this.visitasOrdenadas.length; i++) {
            const visita = this.visitasOrdenadas[i];
            const numVisita = i + 1;

            let etiqueta;
            if (i === 0) {
                // Primera visita: mostrar tiempo relativo a hoy
                const diasDesdeHoy = this.calcularDiasDiferencia(visita.fecha, this.hoy);
                let tiempoRelativo = '';
                if (diasDesdeHoy === 0) tiempoRelativo = 'hoy';
                else if (diasDesdeHoy === 1) tiempoRelativo = 'hace 1 día';
                else if (diasDesdeHoy < 7) tiempoRelativo = `hace ${diasDesdeHoy} días`;
                else if (diasDesdeHoy < 30) tiempoRelativo = `hace ${Math.round(diasDesdeHoy / 7)} semanas`;
                else if (diasDesdeHoy < 365) tiempoRelativo = `hace ${Math.round(diasDesdeHoy / 30)} meses`;
                else tiempoRelativo = `hace ${Math.round(diasDesdeHoy / 365)} años`;

                etiqueta = `Visita ${numVisita} (${tiempoRelativo})`;
            } else {
                const visitaAnterior = this.visitasOrdenadas[i - 1];
                const diasDif = this.calcularDiasDiferencia(visitaAnterior.fecha, visita.fecha);

                if (diasDif === 0) {
                    etiqueta = `Visita ${numVisita} (mismo día que Visita ${i})`;
                } else if (diasDif === 1) {
                    etiqueta = `Visita ${numVisita} (1 día después de Visita ${i})`;
                } else if (diasDif < 7) {
                    etiqueta = `Visita ${numVisita} (${diasDif} días después de Visita ${i})`;
                } else if (diasDif < 30) {
                    const semanas = Math.round(diasDif / 7);
                    etiqueta = `Visita ${numVisita} (${semanas} semana${semanas > 1 ? 's' : ''} después de Visita ${i})`;
                } else if (diasDif < 365) {
                    const meses = Math.round(diasDif / 30);
                    etiqueta = `Visita ${numVisita} (${meses} mes${meses > 1 ? 'es' : ''} después de Visita ${i})`;
                } else {
                    const años = Math.round(diasDif / 365);
                    etiqueta = `Visita ${numVisita} (${años} año${años > 1 ? 's' : ''} después de Visita ${i})`;
                }
            }

            this.visitasMap.set(visita.original, etiqueta);
        }
    },


    relativizarRespHoy(fechaOriginal) {
        const fecha = this.parseFecha(fechaOriginal);
        if (!fecha) return fechaOriginal;

        const dias = this.calcularDiasDiferencia(fecha, this.hoy);

        // Fechas pasadas
        if (dias === 0) return 'hoy';
        if (dias === 1) return 'ayer';
        if (dias > 0 && dias < 7) return `hace ${dias} días`;
        if (dias >= 7 && dias < 30) return `hace ${Math.round(dias / 7)} semanas`;
        if (dias >= 30 && dias < 365) return `hace ${Math.round(dias / 30)} meses`;
        if (dias >= 365) return `hace ${Math.round(dias / 365)} años`;

        // Fechas futuras (dias negativos)
        if (dias === -1) return 'mañana';
        if (dias < 0 && dias > -7) return `en ${Math.abs(dias)} días`;
        if (dias <= -7 && dias > -30) return `en ${Math.round(Math.abs(dias) / 7)} semanas`;
        if (dias <= -30 && dias > -365) return `en ${Math.round(Math.abs(dias) / 30)} meses`;
        if (dias <= -365) return `en ${Math.round(Math.abs(dias) / 365)} años`;

        return fechaOriginal;
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

        // Reset de todos los managers para nueva sesión
        AsignadorSustitutos.reset();
        UbicacionesManager.reset();
        FechasManager.reset();

        // Validación de entrada
        if (!text || typeof text !== 'string') return this.createEmptyResult(sessionId);

        // Límite de seguridad: textos muy largos (> 1MB) podrían causar problemas
        const MAX_TEXT_LENGTH = 1000000; // 1 millón de caracteres
        if (text.length > MAX_TEXT_LENGTH) {
            console.warn('Texto demasiado largo, truncando a 1MB');
            text = text.substring(0, MAX_TEXT_LENGTH);
        }

        const entities = this.detectEntities(text);
        const resolved = this.resolveConflicts(entities);

        // PRE-PASO: Registrar todas las fechas primero para calcular visitas correctamente
        // Las fechas deben procesarse en orden cronológico, no en orden de aparición
        const fechaEntities = resolved.filter(e => e.type === 'FECHA' &&
            (e.subtype === 'fecha_completa' || /^\d{1,2}[\/\-]/.test(e.text)));

        // Ordenar por fecha real (cronológico)
        fechaEntities.sort((a, b) => {
            const fechaA = FechasManager.parseFecha(a.text);
            const fechaB = FechasManager.parseFecha(b.text);
            if (!fechaA || !fechaB) return 0;
            return fechaA - fechaB;
        });

        // Registrar todas las fechas en orden cronológico
        fechaEntities.forEach(e => {
            FechasManager.procesarVisita(e.text);
        });

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
        // Patrón clásico DNI: 8 dígitos + letra
        const dniRegex = /\b\d{8}[A-Za-z]\b/g;
        let match;
        while ((match = dniRegex.exec(text)) !== null) {
            entities.push({ type: 'IDENTIFICADOR', subtype: 'dni', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.99 });
        }

        // NIE (Número de Identidad de Extranjero): X/Y/Z + 7 dígitos + letra
        const nieRegex = /\b[XYZxyz]\d{7}[A-Za-z]\b/g;
        while ((match = nieRegex.exec(text)) !== null) {
            entities.push({ type: 'IDENTIFICADOR', subtype: 'nie', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.99 });
        }

        // NUSS (Número de Seguridad Social): 12 dígitos
        const nussRegex = /\b\d{12}\b/g;
        while ((match = nussRegex.exec(text)) !== null) {
            entities.push({ type: 'IDENTIFICADOR', subtype: 'nuss', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.85 });
        }

        // Número de afiliación SS con formato: XX/XXXXXXXX/XX
        const nussFormatRegex = /\b\d{2}\/\d{8}\/\d{2}\b/g;
        while ((match = nussFormatRegex.exec(text)) !== null) {
            entities.push({ type: 'IDENTIFICADOR', subtype: 'nuss', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.95 });
        }

        // DNI después de etiqueta "Documento:" o "DNI:" o "NIF:"
        const docLabelRegex = /(?:Documento|DNI|NIF)\s*:\s*([^\n\r]+?)(?=\s*$|\s*\n|\r)/gmi;
        while ((match = docLabelRegex.exec(text)) !== null) {
            const doc = match[1].trim();
            if (doc.length > 0) {
                const startPos = match.index + match[0].indexOf(doc);
                entities.push({ type: 'IDENTIFICADOR', subtype: 'dni', text: doc, original: doc, position: { start: startPos, end: startPos + doc.length }, confidence: 0.95 });
            }
        }

        // NHC (Historia Clínica) - Patrón común
        const nhcRegex = /\b(?:NHC|Historia|H\.?C\.?)\s*:?\s*(\d+)/gi;
        while ((match = nhcRegex.exec(text)) !== null) {
            entities.push({ type: 'IDENTIFICADOR', subtype: 'nhc', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.95 });
        }

        // 1d. Teléfonos (españoles)
        const telefonoRegex = /\b(?:\+34\s?)?[679]\d{2}[\s\.\-]?\d{3}[\s\.\-]?\d{3}\b/g;
        while ((match = telefonoRegex.exec(text)) !== null) {
            entities.push({ type: 'IDENTIFICADOR', subtype: 'telefono', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.95 });
        }

        // También detectar teléfonos después de etiquetas
        const telLabelRegex = /(?:Tel[eé]fono|Tfno|M[oó]vil|Tel)\s*:?\s*([\d\s\.\-\+]+)/gi;
        while ((match = telLabelRegex.exec(text)) !== null) {
            const tel = match[1].trim();
            if (tel.length >= 9) {
                const startPos = match.index + match[0].indexOf(tel);
                entities.push({ type: 'IDENTIFICADOR', subtype: 'telefono', text: tel, original: tel, position: { start: startPos, end: startPos + tel.length }, confidence: 0.90 });
            }
        }

        // 1e. Emails
        const emailRegex = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
        while ((match = emailRegex.exec(text)) !== null) {
            entities.push({ type: 'IDENTIFICADOR', subtype: 'email', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.99 });
        }

        // También detectar emails después de etiquetas
        const emailLabelRegex = /(?:Email|Correo|E-mail)\s*:?\s*([^\s,\n\r]+@[^\s,\n\r]+)/gi;
        while ((match = emailLabelRegex.exec(text)) !== null) {
            const email = match[1].trim();
            const startPos = match.index + match[0].indexOf(email);
            entities.push({ type: 'IDENTIFICADOR', subtype: 'email', text: email, original: email, position: { start: startPos, end: startPos + email.length }, confidence: 0.95 });
        }

        // 1f. Direcciones (calle, avenida, plaza + contenido)
        const direccionRegex = /\b(?:Calle|C\/|Avda\.?|Avenida|Plaza|Pza\.?|Paseo|Camino)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)*(?:,?\s*(?:n[º°]?\.?\s*)?\d+)?(?:\s*,?\s*(?:\d+[º°]?|piso\s+\d+|bajo|ático))?/gi;
        while ((match = direccionRegex.exec(text)) !== null) {
            entities.push({ type: 'UBICACION', subtype: 'direccion', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.85 });
        }

        // Direcciones después de etiqueta "Dirección:" o "Domicilio:"
        const dirLabelRegex = /(?:Direcci[oó]n|Domicilio)\s*:\s*(.+?)(?=\s*$|\s*\n|\r)/gmi;
        while ((match = dirLabelRegex.exec(text)) !== null) {
            const dir = match[1].trim();
            if (dir.length > 5) {
                const startPos = match.index + match[0].indexOf(dir);
                entities.push({ type: 'UBICACION', subtype: 'direccion', text: dir, original: dir, position: { start: startPos, end: startPos + dir.length }, confidence: 0.90 });
            }
        }

        // 1g. Códigos Postales
        const cpRegex = /\b(?:C\.?P\.?\s*:?\s*)?(\d{5})\b/g;
        while ((match = cpRegex.exec(text)) !== null) {
            // Verificar que parece un CP español (01000-52999)
            const cp = match[1] || match[0];
            const cpNum = parseInt(cp.replace(/\D/g, ''));
            if (cpNum >= 1000 && cpNum <= 52999) {
                entities.push({ type: 'IDENTIFICADOR', subtype: 'codigo_postal', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.80 });
            }
        }


        // 1b. Familiares después de etiquetas como "Acompañante:" - captura SOLO si contiene un nombre propio
        // Debe contener al menos una palabra capitalizada que parezca nombre
        const familiarFullRegex = /(?:Acompañante|Familiar|Contacto)\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,4})/gmi;
        while ((match = familiarFullRegex.exec(text)) !== null) {
            const contenido = match[1].trim();
            // Validar que parece un nombre (al menos 3 caracteres, no es palabra común)
            const palabrasExcluidasFamiliar = ['telefónico', 'telefono', 'teléfono', 'presencial', 'urgente', 'pendiente', 'ninguno', 'desconocido', 'no', 'si', 'sí'];
            if (contenido.length >= 3 &&
                !palabrasExcluidasFamiliar.includes(contenido.toLowerCase()) &&
                /^[A-ZÁÉÍÓÚÑ]/.test(contenido)) {
                const startPos = match.index + match[0].indexOf(contenido);
                entities.push({ type: 'NOMBRE', subtype: 'familiar', text: contenido, original: contenido, position: { start: startPos, end: startPos + contenido.length }, confidence: 0.95 });
            }
        }

        // 1c. Palabras de relación familiar seguidas de paréntesis con nombres (ej: "Madre (María González, 68 años)")
        const relacionesFamiliares = ['esposa', 'esposo', 'madre', 'padre', 'hijo', 'hija', 'hermano', 'hermana', 'abuelo', 'abuela', 'tío', 'tía', 'primo', 'prima', 'sobrino', 'sobrina', 'cuñado', 'cuñada', 'suegro', 'suegra', 'yerno', 'nuera', 'pareja', 'cónyuge', 'tutor', 'tutora'];

        // Detectar "Madre (María González, 68 años)" como un bloque completo
        // Validar que el paréntesis contiene algo que parece nombre (letra mayúscula)
        relacionesFamiliares.forEach(relacion => {
            const regexConParentesis = new RegExp(`\\b(${relacion})\\s*\\(([^)]+)\\)`, 'gmi');
            while ((match = regexConParentesis.exec(text)) !== null) {
                const contenidoParentesis = match[2];
                // Solo incluir si el paréntesis contiene un nombre (palabra capitalizada)
                if (/[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/.test(contenidoParentesis)) {
                    const bloque = match[0];
                    entities.push({ type: 'NOMBRE', subtype: 'familiar', text: bloque, original: bloque, position: { start: match.index, end: match.index + bloque.length }, confidence: 0.98 });
                }
            }
        });

        // 1d. NO detectar palabras de relación familiar solas - causan demasiados falsos positivos
        // Solo detectamos cuando van acompañadas de nombres

        // 1e. Menciones inline como "La madre refiere" - NO anonimizar la palabra "madre" sola
        // porque es una relación genérica, no identifica a nadie específico



        // 2. Ubicaciones (Hospitales, Centros, Ciudades)
        // Detección explicita de Hospital/Clínica
        // Palabras que terminan el nombre del hospital (no son parte del nombre)
        const palabrasFinHospital = ['período', 'periodo', 'médico', 'medico', 'enfermera', 'enfermero',
            'doctor', 'doctora', 'paciente', 'tratamiento', 'consulta', 'cita', 'urgencias',
            'ingreso', 'alta', 'derivación', 'derivacion', 'semana', 'mes', 'año', 'día', 'dia',
            'criterios', 'valoración', 'valoracion', 'evaluación', 'evaluacion', 'gravedad',
            'cumplidos', 'cumplidas', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const palabrasFinHospitalRegex = new RegExp(`\\s+(del?\\s+\\d+\\s+)?(${palabrasFinHospital.join('|')}).*$`, 'gi');

        // Regex mejorado para hospitales: incluye Universitario, Infantil, General, Regional, etc.
        const hospitalRegex = /\b(?:hospital|clínica|centro de salud|consultorio|h\.u\.|h\.)\s+(?:(?:universitario|infantil|general|regional|comarcal|provincial|materno|clínico)\s+)*(?:de\s+(?:día\s+)?)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:de\s+|del\s+)?(?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+|\d+))*/gi;
        while ((match = hospitalRegex.exec(text)) !== null) {
            let hosp = match[0].trim();

            // Limpiar palabras que no son parte del nombre del hospital
            hosp = hosp.replace(palabrasFinHospitalRegex, '').trim();

            // Si quedó muy corto después de limpiar, descartar
            if (hosp.length < 10) continue;

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

        // 3. Profesionales de Salud (hasta 4 palabras: nombre + apellidos)
        // Incluir doctores, enfermeras y otros profesionales sanitarios
        // Flag 'gi' para case-insensitive (detectar "DRA.", "DOCTOR", etc.)
        const profesionalRegex = /\b(?:Dr\.|Dra\.|Doctor|Doctora|Facultativo|Enfermero|Enfermera|Enf\.|Fisioterapeuta|Psic[oó]log[oa]|Matrona|Farmac[eé]utic[oa]|Auxiliar|Técnico|T[eé]cnica)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/gi;
        while ((match = profesionalRegex.exec(text)) !== null) {
            entities.push({ type: 'NOMBRE', subtype: 'profesional', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.9 });
        }


        // 4. Pacientes (Contexto de "paciente X", SOLO si va seguido de nombre propio)
        // Lista ampliada de palabras a excluir (términos clínicos comunes)
        const palabrasExcluidasPaciente = [
            // Verbos y estados
            'que', 'refiere', 'estable', 'consciente', 'orientado', 'orientada', 'presenta', 'muestra',
            'niega', 'afirma', 'con', 'sin', 'ha', 'fue', 'es', 'no', 'si', 'sí', 'está', 'siendo',
            // Adjetivos clínicos
            'tratado', 'tratada', 'derivado', 'derivada', 'diagnosticado', 'diagnosticada',
            'ingresado', 'ingresada', 'dado', 'dada', 'competente', 'capacitado', 'capacitada',
            'valorado', 'valorada', 'evaluado', 'evaluada', 'estabilizado', 'estabilizada',
            // Palabras que empiezan con mayúscula pero no son nombres
            'mujer', 'hombre', 'varón', 'adulto', 'adulta', 'joven', 'anciano', 'anciana',
            'menor', 'niño', 'niña', 'bebé', 'recién', 'lactante', 'gestante', 'embarazada',
            // Otros términos médicos
            'crónico', 'crónica', 'agudo', 'aguda', 'terminal', 'grave', 'leve', 'moderado', 'moderada',
            'pluripatológico', 'pluripatológica', 'polimedicado', 'polimedicada', 'crítico', 'crítica'
        ];

        const pacienteRegex = /\bpaciente\s+(?:es\s+|se\s+llama\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})/gi;
        while ((match = pacienteRegex.exec(text)) !== null) {
            const nombre = match[1];
            const palabras = nombre.split(/\s+/);
            const primeraPalabra = palabras[0].toLowerCase();

            // Excluir si la primera palabra está en la lista de exclusión
            // O si todas las palabras están en la lista de exclusión
            const todasExcluidas = palabras.every(p => palabrasExcluidasPaciente.includes(p.toLowerCase()));
            if (!palabrasExcluidasPaciente.includes(primeraPalabra) && !todasExcluidas) {
                const startPos = match.index + match[0].indexOf(nombre);
                entities.push({ type: 'NOMBRE', subtype: 'paciente', text: nombre, original: nombre, position: { start: startPos, end: startPos + nombre.length }, confidence: 0.85 });
            }
        }

        // 4b. Nombres después de "Nombre:" (captura hasta 4 palabras: nombre + hasta 3 apellidos)
        const nombreLabelRegex = /Nombre\s*:\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})(?=\s*$|\s*\n|\r)/gmi;
        while ((match = nombreLabelRegex.exec(text)) !== null) {
            const nombre = match[1];
            const startPos = match.index + match[0].indexOf(nombre);
            entities.push({ type: 'NOMBRE', subtype: 'paciente', text: nombre, original: nombre, position: { start: startPos, end: startPos + nombre.length }, confidence: 0.95 });
        }

        // 4c. Detección por diccionario de nombres conocidos (solo si van seguidos de apellidos)
        // Palabras que NO son apellidos aunque estén capitalizadas
        const noApellidos = [
            'derivada', 'derivado', 'desde', 'hacia', 'hasta', 'para', 'entre',
            'fármaco', 'farmaco', 'tratamiento', 'medicación', 'medicacion', 'terapia', 'dosis',
            'administración', 'administracion', 'autoadministración', 'autoadministracion',
            'hospital', 'clínica', 'clinica', 'centro', 'servicio', 'unidad', 'consulta'
        ];

        const nombresDiccionario = [...NOMBRES_MUJER, ...NOMBRES_HOMBRE];
        nombresDiccionario.forEach(nombre => {
            // Buscar nombre seguido de al menos un apellido potencial
            const nombreRegex = new RegExp(`\\b${nombre}\\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)\\b`, 'g');
            let nombreMatch;
            while ((nombreMatch = nombreRegex.exec(text)) !== null) {
                let nombreCompleto = nombreMatch[0];
                const apellidoPotencial = nombreMatch[1];

                // Verificar que el apellido potencial parece real
                const palabrasApellido = apellidoPotencial.split(/\s+/);
                const primerApellido = palabrasApellido[0].toLowerCase();

                // Excluir si el "apellido" está en la lista de palabras excluidas
                if (!noApellidos.includes(primerApellido) &&
                    !palabrasExcluidasPaciente.includes(primerApellido)) {

                    // Limpiar palabras finales que no son apellidos (derivada, desde, etc.)
                    const palabrasNombre = nombreCompleto.split(/\s+/);
                    const palabrasLimpias = [];
                    for (const palabra of palabrasNombre) {
                        const palabraLower = palabra.toLowerCase();
                        if (noApellidos.includes(palabraLower) || palabrasExcluidasPaciente.includes(palabraLower)) {
                            break; // Parar al encontrar palabra no válida
                        }
                        palabrasLimpias.push(palabra);
                    }

                    // Solo incluir si quedaron al menos 2 palabras (nombre + apellido)
                    if (palabrasLimpias.length >= 2) {
                        nombreCompleto = palabrasLimpias.join(' ');
                        entities.push({
                            type: 'NOMBRE',
                            subtype: 'paciente',
                            text: nombreCompleto,
                            original: nombreCompleto,
                            position: { start: nombreMatch.index, end: nombreMatch.index + nombreCompleto.length },
                            confidence: 0.80
                        });
                    }
                }
            }
        });

        // 5. Fechas Completas (dd/mm/yyyy o dd de mes de yyyy) - NO detectamos edad, se mantiene tal cual

        // Fechas Completas (dd/mm/yyyy o dd de mes de yyyy)
        const fechaFullRegex = /\b(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})|\b(?:\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+|del\s+)?\d{4})\b/gi;
        while ((match = fechaFullRegex.exec(text)) !== null) {
            entities.push({ type: 'FECHA', subtype: 'fecha_completa', text: match[0], original: match[0], position: { start: match.index, end: match.index + match[0].length }, confidence: 0.95 });
        }

        // NOTA: Detección de SOSPECHOSOS deshabilitada para evitar falsos positivos
        // El profesional sanitario revisará manualmente cualquier dato no detectado

        return entities;
    },

    resolveConflicts: function (entities) {
        // Validación: asegurar que entities es un array
        if (!Array.isArray(entities) || entities.length === 0) {
            return [];
        }

        // Filtrar entidades malformadas (sin posición válida)
        const validEntities = entities.filter(e =>
            e && e.position &&
            typeof e.position.start === 'number' &&
            typeof e.position.end === 'number' &&
            e.position.start >= 0 &&
            e.position.end > e.position.start
        );

        validEntities.sort((a, b) => {
            if (b.confidence !== a.confidence) return b.confidence - a.confidence;
            return (b.position.end - b.position.start) - (a.position.end - a.position.start);
        });

        const resolved = [];
        const occupied = new Set();

        for (const entity of validEntities) {
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
            if (entity.subtype === 'profesional') {
                const nombreOriginal = entity.original || entity.text;
                return AsignadorSustitutos.obtenerSustitutoProfesional(nombreOriginal);
            }
            if (entity.subtype === 'familiar') {
                const nombreOriginal = entity.original || entity.text;
                return AsignadorSustitutos.obtenerSustitutoFamiliar(nombreOriginal);
            }
            // Pacientes
            const nombreOriginal = entity.original || entity.text;
            return AsignadorSustitutos.obtenerSustituto(nombreOriginal);
        }
        if (entity.type === 'FECHA') {
            if (entity.subtype === 'fecha_completa' || /^\d{1,2}[\/\-]/.test(entity.text)) {
                // Fechas ya fueron pre-procesadas, solo hacer lookup
                const key = entity.text.trim();
                if (FechasManager.visitasMap.has(key)) {
                    return FechasManager.visitasMap.get(key);
                }
                // Fallback si no está en el mapa
                return FechasManager.relativizarRespHoy(entity.text);
            }
            return entity.text; // Otras fechas, mantener
        }

        if (entity.type === 'IDENTIFICADOR') {
            // Eliminación silenciosa: sin corchetes
            return '';
        }
        if (entity.type === 'UBICACION') {
            if (entity.subtype === 'hospital') {
                return UbicacionesManager.obtenerCentro(entity.original || entity.text);
            }
            if (entity.subtype === 'ciudad' || entity.subtype === 'contexto') {
                return UbicacionesManager.obtenerCiudad(entity.original || entity.text);
            }
            // Otras ubicaciones
            return UbicacionesManager.obtenerCiudad(entity.original || entity.text);
        }
        if (entity.type === 'SOSPECHOSO') {
            // Sospechosos: si subtype indica familiar
            if (entity.text && /\b(?:hermano|hermana|padre|madre|hijo|hija|esposo|esposa)\b/i.test(entity.text)) {
                return AsignadorSustitutos.obtenerSustitutoFamiliar(entity.original || entity.text);
            }
            // Otros sospechosos: mantener para revisión manual
            return entity.text;
        }
        return entity.text; // Por defecto, mantener original
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
            byType: {
                pacientes: 0,
                profesionales: 0,
                familiares: 0,
                fechas: 0,
                identificadores: 0,
                ubicaciones: 0,
                nombres: 0 // Mantener para compatibilidad
            }
        };

        entities.forEach(e => {
            if (e.type === 'NOMBRE') {
                stats.byType.nombres++;
                if (e.subtype === 'paciente') stats.byType.pacientes++;
                else if (e.subtype === 'profesional') stats.byType.profesionales++;
                else if (e.subtype === 'familiar') stats.byType.familiares++;
            }
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
