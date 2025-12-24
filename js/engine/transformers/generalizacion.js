export const generalizacionTransformer = {
    // Mapeo simple de provincias a CCAA (simplificado para ejemplo)
    provinciasACCAA: {
        'Madrid': 'Comunidad de Madrid',
        'Barcelona': 'Cataluña',
        'Valencia': 'Comunidad Valenciana',
        'Sevilla': 'Andalucía',
        // ... se asume que el patrón ya devuelve metadatos si es posible
    },

    transform(texto, metadata = {}, subtype = null) {
        if (metadata.ccaa) {
            return `[${metadata.ccaa}]`;
        }

        if (subtype === 'centro') return '[CENTRO_SANITARIO]';
        if (subtype === 'cp') return '[CP_ELIMINADO]';

        // Si detectamos que es un CP (fallback)
        if (/^\d{5}$/.test(texto)) return '[CP_ELIMINADO]';

        // Dirección genérica
        return '[DIRECCIÓN]';
    }
};
