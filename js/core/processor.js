// Processor - Orquestador principal del motor de anonimización
// Versión modular que coordina detectores, managers, scoring y transformaciones

import { TextNormalizer } from './utils/TextNormalizer.js';
import { AsignadorSustitutos } from './managers/AsignadorSustitutos.js';
import { UbicacionesManager } from './managers/UbicacionesManager.js';
import { FechasManager } from './managers/FechasManager.js';
import { detectIdentificadores } from './detectors/identificadores.js';
import { detectFechas } from './detectors/fechas.js';
import { detectUbicaciones } from './detectors/ubicaciones.js';
import { detectProfesionales, detectPacientes, detectFamiliares } from './detectors/nombres.js';
import { detectCuasiIdentificadores } from './detectors/cuasiidentificadores.js';
import { ScoringEngine } from './scoring/ScoringEngine.js';
import { HeuristicasContextuales } from './scoring/HeuristicasContextuales.js';

/**
 * Procesador principal de privacidad
 */
export const Processor = {
    // Diccionarios (se cargan externamente)
    dictionaries: {
        nombresMujer: [],
        nombresHombre: [],
        nombresUnisex: [],
        abreviaturasNombres: {},
        apellidos: [],
        ciudades: [],
        hospitales: [],
        centrosSaludPrefijos: [],
        barrios: []
    },

    // Configuración de scoring
    config: {
        usarScoring: true,           // Activar sistema de scoring
        umbralConfianza: 0.5,        // Umbral mínimo para anonimizar
        aplicarHeuristicas: true,    // Aplicar heurísticas contextuales
        modoEstricto: false          // Modo de anonimización más agresivo
    },

    /**
     * Carga los diccionarios
     * @param {Object} dicts - Objeto con los diccionarios
     */
    loadDictionaries(dicts) {
        if (dicts.nombresMujer) this.dictionaries.nombresMujer = dicts.nombresMujer;
        if (dicts.nombresHombre) this.dictionaries.nombresHombre = dicts.nombresHombre;
        if (dicts.nombresUnisex) this.dictionaries.nombresUnisex = dicts.nombresUnisex;
        if (dicts.abreviaturasNombres) this.dictionaries.abreviaturasNombres = dicts.abreviaturasNombres;
        if (dicts.apellidos) this.dictionaries.apellidos = dicts.apellidos;
        if (dicts.ciudades) this.dictionaries.ciudades = dicts.ciudades;
        if (dicts.hospitales) this.dictionaries.hospitales = dicts.hospitales;
        if (dicts.centrosSaludPrefijos) this.dictionaries.centrosSaludPrefijos = dicts.centrosSaludPrefijos;
        if (dicts.barrios) this.dictionaries.barrios = dicts.barrios;
    },

    /**
     * Configura opciones del procesador
     * @param {Object} options - Opciones de configuración
     */
    configure(options) {
        if (!options || typeof options !== 'object') return;
        if (options.usarScoring !== undefined) this.config.usarScoring = options.usarScoring;
        if (options.umbralConfianza !== undefined) this.config.umbralConfianza = options.umbralConfianza;
        if (options.aplicarHeuristicas !== undefined) this.config.aplicarHeuristicas = options.aplicarHeuristicas;
        if (options.modoEstricto !== undefined) this.config.modoEstricto = options.modoEstricto;
    },

    /**
     * Procesa un texto y anonimiza las entidades detectadas
     * @param {string} text - Texto a procesar
     * @returns {Object} - Resultado del procesamiento
     */
    process(text) {
        const startTime = performance.now();
        const sessionId = this.generateId();

        // Reset de managers
        AsignadorSustitutos.reset();
        UbicacionesManager.reset();
        FechasManager.reset();

        // Validación
        if (!text || typeof text !== 'string') {
            return this.createEmptyResult(sessionId);
        }

        // Límite de seguridad
        const MAX_TEXT_LENGTH = 1000000;
        if (text.length > MAX_TEXT_LENGTH) {
            console.warn('Texto demasiado largo, truncando a 1MB');
            text = text.substring(0, MAX_TEXT_LENGTH);
        }

        // Detección de entidades
        const entities = this.detectEntities(text);
        const resolved = this.resolveConflicts(entities);

        // Aplicar scoring y heurísticas
        let scoredEntities = resolved;
        if (this.config.usarScoring) {
            scoredEntities = ScoringEngine.aplicarScoring(
                resolved,
                this.dictionaries,
                text,
                TextNormalizer.normalize.bind(TextNormalizer)
            );
        }

        // Aplicar heurísticas contextuales
        if (this.config.aplicarHeuristicas) {
            scoredEntities = scoredEntities.map(entity =>
                HeuristicasContextuales.aplicarHeuristicas(entity, text)
            );
        }

        // Filtrar por umbral de confianza
        const effectiveThreshold = this.config.modoEstricto
            ? Math.min(this.config.umbralConfianza, 0.35)
            : this.config.umbralConfianza;

        const filteredEntities = scoredEntities.filter(e => {
            if (this.config.modoEstricto && e.type === 'SOSPECHOSO') {
                return e.confidence >= 0.25;
            }
            return e.confidence >= effectiveThreshold;
        });

        // Pre-procesar fechas
        this.preprocessFechas(filteredEntities);

        // Transformar entidades
        let processedText = text;
        const sortedEntities = [...filteredEntities].sort((a, b) => b.position.start - a.position.start);

        for (const entity of sortedEntities) {
            entity.transformed = this.transformEntity(entity);
            processedText = processedText.slice(0, entity.position.start) +
                entity.transformed +
                processedText.slice(entity.position.end);
        }

        sortedEntities.sort((a, b) => a.position.start - b.position.start);

        // Entidades descartadas por bajo score
        const descartadas = scoredEntities.filter((e) => {
            const threshold = this.config.modoEstricto && e.type === 'SOSPECHOSO'
                ? 0.25
                : effectiveThreshold;
            return e.confidence < threshold;
        });

        return {
            original: text,
            processed: processedText,
            entities: sortedEntities,
            alerts: [],
            stats: this.calculateStats(sortedEntities),
            sessionId,
            processingTime: Math.round(performance.now() - startTime),
            // Información adicional de scoring
            scoring: {
                usarScoring: this.config.usarScoring,
                umbralConfianza: this.config.umbralConfianza,
                umbralEfectivo: effectiveThreshold,
                modoEstricto: this.config.modoEstricto,
                entidadesDescartadas: descartadas.length,
                descartadas: descartadas.map(e => ({
                    text: e.text,
                    type: e.type,
                    confidence: e.confidence,
                    razon: e.scoring?.recomendacion || 'BAJO_SCORE'
                }))
            }
        };
    },

    /**
     * Detecta todas las entidades en el texto
     * @param {string} text
     * @returns {Array}
     */
    detectEntities(text) {
        const entities = [];

        // Identificadores
        entities.push(...detectIdentificadores(text));

        // Fechas
        entities.push(...detectFechas(text));

        // Ubicaciones
        entities.push(...detectUbicaciones(
            text,
            {
                ciudades: this.dictionaries.ciudades,
                hospitales: this.dictionaries.hospitales,
                centrosSaludPrefijos: this.dictionaries.centrosSaludPrefijos,
                barrios: this.dictionaries.barrios
            },
            TextNormalizer.normalize.bind(TextNormalizer)
        ));

        // Profesionales
        entities.push(...detectProfesionales(
            text,
            this.dictionaries,
            TextNormalizer.normalize.bind(TextNormalizer)
        ));

        // Pacientes
        entities.push(...detectPacientes(
            text,
            this.dictionaries,
            TextNormalizer.normalize.bind(TextNormalizer)
        ));

        // Familiares
        entities.push(...detectFamiliares(text));

        // Cuasi-identificadores contextuales
        entities.push(...detectCuasiIdentificadores(text));

        return entities;
    },

    /**
     * Resuelve conflictos entre entidades superpuestas
     * @param {Array} entities
     * @returns {Array}
     */
    resolveConflicts(entities) {
        if (!Array.isArray(entities) || entities.length === 0) {
            return [];
        }

        // Filtrar entidades malformadas
        const validEntities = entities.filter(e =>
            e && e.position &&
            typeof e.position.start === 'number' &&
            typeof e.position.end === 'number' &&
            e.position.start >= 0 &&
            e.position.end > e.position.start
        );

        // Prioridad por tipo (ubicaciones y familiares tienen prioridad)
        const getPriority = (entity) => {
            if (entity.type === 'UBICACION') return 3;
            if (entity.type === 'NOMBRE' && entity.subtype === 'familiar') return 2;
            if (entity.type === 'IDENTIFICADOR') return 2;
            if (entity.type === 'SOSPECHOSO') return 1;
            if (entity.type === 'NOMBRE' && entity.subtype === 'profesional') return 1;
            return 0;
        };

        // Ordenar por: 1) prioridad de tipo, 2) confianza, 3) tamaño
        validEntities.sort((a, b) => {
            const priorityDiff = getPriority(b) - getPriority(a);
            if (priorityDiff !== 0) return priorityDiff;
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

    /**
     * Pre-procesa fechas para calcular visitas correctamente
     * @param {Array} entities
     */
    preprocessFechas(entities) {
        const fechaEntities = entities.filter(e =>
            e.type === 'FECHA' &&
            (e.subtype === 'fecha_completa' || e.subtype === 'ano' || /^\d{1,2}[\/\-]/.test(e.text))
        );

        fechaEntities.sort((a, b) => {
            const fechaA = FechasManager.parseFecha(a.text);
            const fechaB = FechasManager.parseFecha(b.text);
            if (!fechaA || !fechaB) return 0;
            return fechaA - fechaB;
        });

        fechaEntities.forEach(e => {
            FechasManager.procesarVisita(e.text);
        });
    },

    /**
     * Transforma una entidad a su pseudónimo
     * @param {Object} entity
     * @returns {string}
     */
    transformEntity(entity) {
        if (entity.type === 'NOMBRE') {
            if (entity.subtype === 'profesional') {
                return AsignadorSustitutos.obtenerSustitutoProfesional(entity.original || entity.text);
            }
            if (entity.subtype === 'familiar') {
                return AsignadorSustitutos.obtenerSustitutoFamiliar(entity.original || entity.text);
            }
            return AsignadorSustitutos.obtenerSustituto(entity.original || entity.text);
        }

        if (entity.type === 'FECHA') {
            if (entity.subtype === 'fecha_completa' || entity.subtype === 'ano' || /^\d{1,2}[\/\-]/.test(entity.text)) {
                const key = entity.text.trim();
                if (FechasManager.visitasMap.has(key)) {
                    return FechasManager.visitasMap.get(key);
                }
                return FechasManager.relativizarRespHoy(entity.text);
            }
            return entity.text;
        }

        if (entity.type === 'IDENTIFICADOR') {
            return ''; // Eliminación silenciosa
        }

        if (entity.type === 'UBICACION') {
            if (this.config.modoEstricto) {
                if (entity.subtype === 'hospital') return 'Centro Sanitario';
                return 'Zona Geografica';
            }
            if (entity.subtype === 'hospital') {
                return UbicacionesManager.obtenerCentro(entity.original || entity.text);
            }
            if (entity.subtype === 'ciudad' || entity.subtype === 'contexto') {
                return UbicacionesManager.obtenerCiudad(entity.original || entity.text);
            }
            return UbicacionesManager.obtenerCiudad(entity.original || entity.text);
        }

        if (entity.type === 'SOSPECHOSO') {
            if (this.config.modoEstricto) return '[dato_sensible]';
            if (entity.subtype === 'enfermedad_rara') return 'diagnostico poco frecuente';
            if (entity.subtype === 'cargo_publico') return 'cargo institucional';
            if (entity.subtype === 'parentesco_especial') return 'relacion familiar sensible';
            if (entity.subtype === 'profesion_especifica') return 'profesion sensible';
            return 'dato cuasi-identificador';
        }

        return entity.text;
    },

    /**
     * Calcula estadísticas del procesamiento
     * @param {Array} entities
     * @returns {Object}
     */
    calculateStats(entities) {
        const stats = {
            totalEntities: entities.length,
            byType: {
                pacientes: 0,
                profesionales: 0,
                familiares: 0,
                fechas: 0,
                identificadores: 0,
                ubicaciones: 0,
                sospechosos: 0,
                nombres: 0
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
            if (e.type === 'SOSPECHOSO') stats.byType.sospechosos++;
        });

        return stats;
    },

    /**
     * Genera un ID único de sesión
     * @returns {string}
     */
    generateId() {
        return Math.random().toString(36).substr(2, 8);
    },

    /**
     * Crea un resultado vacío
     * @param {string} sessionId
     * @returns {Object}
     */
    createEmptyResult(sessionId) {
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

export default Processor;
