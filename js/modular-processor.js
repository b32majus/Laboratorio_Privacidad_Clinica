// Modular Processor - Entry point para el sistema modular de anonimización
// Importa el core modular y los diccionarios
// Uso: <script type="module" src="js/modular-processor.js"></script>

import { Processor } from './core/processor.js';
import { AsignadorSustitutos } from './core/managers/AsignadorSustitutos.js';
import {
    NOMBRES_MUJER,
    NOMBRES_HOMBRE,
    NOMBRES_UNISEX,
    ABREVIATURAS_NOMBRES,
    APELLIDOS,
    CIUDADES,
    PROVINCIAS,
    CCAA,
    HOSPITALES,
    CENTROS_SALUD_PREFIJOS,
    BARRIOS
} from './data/index.js';

// Cargar diccionarios
const ubicacionesExtendidas = Array.from(new Set([
    ...CIUDADES,
    ...PROVINCIAS,
    ...CCAA
]));

Processor.loadDictionaries({
    nombresMujer: NOMBRES_MUJER,
    nombresHombre: NOMBRES_HOMBRE,
    nombresUnisex: NOMBRES_UNISEX,
    abreviaturasNombres: ABREVIATURAS_NOMBRES,
    apellidos: APELLIDOS,
    ciudades: ubicacionesExtendidas,
    hospitales: HOSPITALES,
    centrosSaludPrefijos: CENTROS_SALUD_PREFIJOS,
    barrios: BARRIOS
});

// Configurar scoring
Processor.configure({
    usarScoring: true,
    umbralConfianza: 0.5,
    aplicarHeuristicas: true
});

// API simplificada
const PrivacyProcessor = {
    /**
     * Procesa un texto y devuelve el resultado anonimizado
     * @param {string} text - Texto a procesar
     * @returns {Object} - Resultado del procesamiento
     */
    process(text, options = null) {
        if (options && typeof options === 'object') {
            this.configure(options);
        }
        return Processor.process(text);
    },

    /**
     * Transforma una entidad individual
     * @param {Object} entity - Entidad a transformar
     * @returns {string} - Texto transformado
     */
    transformEntity(entity) {
        return Processor.transformEntity(entity);
    },

    /**
     * Configura el procesador
     * @param {Object} options - Opciones de configuración
     */
    configure(options) {
        Processor.configure(options);
    },

    /**
     * Obtiene la versión del procesador
     * @returns {string}
     */
    getVersion() {
        return '4.0.0-modular';
    },

    /**
     * Obtiene información de los diccionarios cargados
     * @returns {Object}
     */
    getDictionaryStats() {
        return {
            nombresMujer: Processor.dictionaries.nombresMujer.length,
            nombresHombre: Processor.dictionaries.nombresHombre.length,
            nombresUnisex: Processor.dictionaries.nombresUnisex.length,
            apellidos: Processor.dictionaries.apellidos.length,
            ciudades: Processor.dictionaries.ciudades.length,
            hospitales: Processor.dictionaries.hospitales.length,
            barrios: Processor.dictionaries.barrios.length
        };
    },

    /**
     * Acceso directo al procesador interno
     */
    _processor: Processor
};

// Exportar para uso con módulos ES6
export { PrivacyProcessor, Processor };
export default PrivacyProcessor;

// Hacer disponible globalmente para scripts no-módulo
if (typeof window !== 'undefined') {
    window.PrivacyProcessor = PrivacyProcessor;
    window.Processor = Processor;
    window.AsignadorSustitutos = AsignadorSustitutos;
}
