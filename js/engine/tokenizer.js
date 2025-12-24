export const tokenizer = {
    /**
     * Divide el texto en tokens preservando posiciones
     * @param {string} text - Texto completo
     * @returns {Array} Tokens con metadatos
     */
    tokenize(text) {
        if (!text) return [];

        // Regex para separar por palabras, signos de puntuación y espacios
        // Manteniendo todo para poder reconstruir
        const tokenRegex = /([a-záéíóúñA-ZÁÉÍÓÚÑ0-9]+)|(\s+)|([^a-záéíóúñA-ZÁÉÍÓÚÑ0-9\s]+)/g;

        const tokens = [];
        let match;

        while ((match = tokenRegex.exec(text)) !== null) {
            tokens.push({
                text: match[0],
                start: match.index,
                end: match.index + match[0].length,
                type: this.getTokenType(match)
            });
        }

        return tokens;
    },

    getTokenType(match) {
        if (match[1]) return 'WORD';
        if (match[2]) return 'SPACE';
        if (match[3]) return 'PUNCTUATION';
        return 'UNKNOWN';
    },

    /**
     * Reconstruye texto desde tokens
     */
    detokenize(tokens) {
        return tokens.map(t => t.text).join('');
    }
};
