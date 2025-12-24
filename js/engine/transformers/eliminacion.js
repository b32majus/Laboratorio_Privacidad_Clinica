export const eliminacionTransformer = {
    transform(tipo, valor) {
        const marcadores = {
            dni: '[DNI_ELIMINADO]',
            nie: '[NIE_ELIMINADO]',
            nhc: '[NHC_ELIMINADO]',
            sip: '[SIP_ELIMINADO]',
            tarjeta: '[TS_ELIMINADO]',
            telefono: '[TELÉFONO_ELIMINADO]',
            email: '[EMAIL_ELIMINADO]',
            nss: '[NSS_ELIMINADO]'
        };
        // Buscar subtipo que coincida parcialmente
        for (const key of Object.keys(marcadores)) {
            if (tipo.toLowerCase().includes(key)) return marcadores[key];
        }
        return '[ID_ELIMINADO]';
    }
};
