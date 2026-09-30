// DictionaryIndex - Índices de diccionario normalizados precomputados
// (Work Order T22 #26, PERF-003; SPEC_V4_QUALITY_SECURITY_DEPLOY §7
// "Precompute normalized dictionary indexes").
//
// Antes de este módulo, `verificarNombreEnDiccionarios`
// (js/core/detectors/nombres.js) reconstruía el Set normalizado de TODOS los
// diccionarios de nombres en CADA llamada (cientos de entradas normalizadas
// por candidato detectado). Este módulo precomputa el índice UNA vez y lo
// reutiliza; la detección resultante es idéntica porque la normalización y
// la pertenencia son las mismas operaciones sobre los mismos datos.
//
// Seguridad de caché (staleness): `Processor.loadDictionaries` sustituye las
// REFERENCIAS de los arrays dentro del mismo objeto `dictionaries`, por lo
// que una caché indexada solo por la identidad del objeto podría servir un
// índice obsoleto tras una recarga. La entrada de caché valida la identidad
// de CADA array fuente en cada acceso: si cualquier array cambió, el índice
// se reconstruye. Las validaciones son O(1) (comparaciones de identidad).
//
// Pureza: la normalización se delega siempre en la MISMA función
// `normalizeText` que pasaba el llamador original; este módulo no introduce
// ninguna regla de normalización nueva y nunca muta los diccionarios.

const cache = new WeakMap();

/**
 * Sonda de equivalencia semántica de normalizadores: si dos funciones
 * normalizan idénticamente una cadena con TODOS los caracteres mapeados
 * (tildes, ñ/Ñ, ü/Ü) más mayúsculas/minúsculas y espacios, se consideran
 * intercambiables para el índice. Esto permite reutilizar el índice aunque
 * el llamador pase una referencia nueva de la misma función (p. ej.
 * `TextNormalizer.normalize.bind(TextNormalizer)` creado por llamada) sin
 * asumir ciegamente que dos funciones distintas son equivalentes.
 */
const NORMALIZER_PROBE = 'ÁÉÍÓÚÜÑáéíóúüñ María García';

function normalizersEquivalent(a, b) {
    if (a === b) return true;
    return a(NORMALIZER_PROBE) === b(NORMALIZER_PROBE);
}

/**
 * Construye el Set normalizado a partir de los arrays indicados.
 * @param {Record<string, string[]>} dictionaries - Objeto de diccionarios del procesador.
 * @param {Function} normalizeText - Función de normalización del llamador (p. ej. TextNormalizer.normalize).
 * @param {string[]} keys - Claves de `dictionaries` que componen el índice.
 * @returns {Set<string>} Set de formas normalizadas.
 */
export function buildDictionaryIndex(dictionaries, normalizeText, keys) {
    const normalized = new Set();
    for (const key of keys) {
        const entries = dictionaries[key];
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
            if (typeof entry !== 'string' || entry.length === 0) continue;
            normalized.add(normalizeText(entry));
        }
    }
    return normalized;
}

/**
 * Índice precomputado y reutilizable entre llamadas. La entrada se reutiliza
 * mientras los arrays fuente conserven su identidad y el normalizador sea
 * semánticamente equivalente (sonda); en caso contrario el índice se
 * reconstruye con el normalizador actual.
 *
 * @param {Record<string, string[]>} dictionaries
 * @param {Function} normalizeText
 * @param {string[]} keys
 * @returns {Set<string>}
 */
export function getCachedDictionaryIndex(dictionaries, normalizeText, keys) {
    if (!dictionaries || typeof normalizeText !== 'function') return null;

    const sources = keys.map((key) => dictionaries[key]);
    const cached = cache.get(dictionaries);
    if (
        cached &&
        cached.keys.length === keys.length &&
        cached.keys.every((key, index) => key === keys[index]) &&
        cached.sources.every((source, index) => source === sources[index]) &&
        normalizersEquivalent(normalizeText, cached.normalizeText)
    ) {
        return cached.index;
    }

    const index = buildDictionaryIndex(dictionaries, normalizeText, keys);
    cache.set(dictionaries, { keys: [...keys], sources, normalizeText, index });
    return index;
}

/**
 * Índice por ENTRADA (no por palabra candidata) para detección de
 * ubicaciones: precomputa la forma normalizada de cada entrada del array
 * una vez, reutilizable mientras la identidad del array no cambie.
 *
 * @param {string[]} entries - Array de entradas del diccionario (p. ej. ciudades).
 * @param {Function} normalizeText
 * @returns {Map<string, string>} Mapa entrada -> forma normalizada.
 */
const normalizedEntriesCache = new WeakMap();

export function getCachedNormalizedEntries(entries, normalizeText) {
    if (!Array.isArray(entries) || typeof normalizeText !== 'function') return null;
    const cached = normalizedEntriesCache.get(entries);
    if (cached && normalizersEquivalent(normalizeText, cached.normalizeText)) {
        return cached.map;
    }
    const map = new Map();
    for (const entry of entries) {
        if (typeof entry !== 'string' || entry.length === 0) continue;
        map.set(entry, normalizeText(entry));
    }
    normalizedEntriesCache.set(entries, { normalizeText, map });
    return map;
}
