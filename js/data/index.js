// Índice de diccionarios - Exporta todos los datos de forma centralizada
// Este archivo permite importar todos los diccionarios desde un único punto

export {
    NOMBRES_MUJER,
    NOMBRES_HOMBRE,
    NOMBRES_UNISEX,
    ABREVIATURAS_NOMBRES
} from './nombres.js';

export {
    APELLIDOS,
    APELLIDOS_COMPUESTOS,
    PARTICULAS_APELLIDOS
} from './apellidos.js';

export {
    CIUDADES,
    PROVINCIAS,
    CCAA,
    HOSPITALES,
    CENTROS_SALUD_PREFIJOS,
    BARRIOS
} from './ubicaciones.js';

// Función helper para crear versiones normalizadas de los diccionarios
export function createNormalizedSet(array, normalizer) {
    const normalizedMap = new Map();
    array.forEach(item => {
        const normalized = normalizer(item);
        normalizedMap.set(normalized, item);
    });
    return normalizedMap;
}

// Función de normalización básica (sin tildes, minúsculas)
export function normalizeText(text) {
    const accentMap = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'ñ': 'n', 'Ñ': 'N',
        'ü': 'u', 'Ü': 'U'
    };
    return text
        .split('')
        .map(char => accentMap[char] || char)
        .join('')
        .toLowerCase();
}
