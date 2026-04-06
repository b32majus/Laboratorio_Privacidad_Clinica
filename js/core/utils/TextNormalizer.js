// TextNormalizer - Utilidades para normalización de texto
// Manejo de tildes, mayúsculas y comparaciones fuzzy

export const TextNormalizer = {
    // Mapa de caracteres con tildes a sin tildes
    accentMap: {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'ñ': 'n', 'Ñ': 'N',
        'ü': 'u', 'Ü': 'U'
    },

    /**
     * Elimina tildes de un texto
     * @param {string} text - Texto con tildes
     * @returns {string} - Texto sin tildes
     */
    removeAccents(text) {
        if (!text) return '';
        return text.split('').map(char => this.accentMap[char] || char).join('');
    },

    /**
     * Normaliza texto: sin tildes y en minúsculas
     * @param {string} text - Texto a normalizar
     * @returns {string} - Texto normalizado
     */
    normalize(text) {
        if (!text) return '';
        return this.removeAccents(text).toLowerCase();
    },

    /**
     * Compara dos strings ignorando tildes y mayúsculas
     * @param {string} str1
     * @param {string} str2
     * @returns {boolean}
     */
    matchIgnoreAccents(str1, str2) {
        return this.normalize(str1) === this.normalize(str2);
    },

    /**
     * Crea un Map normalizado para búsqueda rápida
     * @param {string[]} array - Array de strings
     * @returns {Map<string, string>} - Map de normalizado -> original
     */
    createNormalizedSet(array) {
        const normalizedMap = new Map();
        array.forEach(item => {
            const normalized = this.normalize(item);
            normalizedMap.set(normalized, item);
        });
        return normalizedMap;
    },

    /**
     * Verifica si un texto está en un Set normalizado
     * @param {string} text - Texto a buscar
     * @param {Map<string, string>} normalizedSet - Set normalizado
     * @returns {boolean}
     */
    isInNormalizedSet(text, normalizedSet) {
        return normalizedSet.has(this.normalize(text));
    },

    /**
     * Limpia espacios múltiples y trim
     * @param {string} text
     * @returns {string}
     */
    cleanSpaces(text) {
        if (!text) return '';
        return text.replace(/\s+/g, ' ').trim();
    },

    /**
     * Capitaliza la primera letra de cada palabra
     * @param {string} text
     * @returns {string}
     */
    capitalize(text) {
        if (!text) return '';
        return text.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
};

export default TextNormalizer;
