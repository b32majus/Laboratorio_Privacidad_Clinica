// FechasManager - Gestiona la relativización de fechas
// Convierte fechas absolutas a relativas manteniendo la cronología

export const FechasManager = {
    visitasOrdenadas: [],
    visitasMap: new Map(),
    hoy: new Date(),

    /**
     * Resetea para una nueva sesión
     */
    reset() {
        this.visitasOrdenadas = [];
        this.visitasMap.clear();
        this.hoy = new Date();
    },

    /**
     * Parsea una fecha en formato dd/mm/yyyy o dd-mm-yyyy
     * @param {string} texto - Texto con fecha
     * @returns {Date|null} - Fecha parseada o null
     */
    parseFecha(texto) {
        if (!texto) return null;

        const yearOnly = texto.trim().match(/^(19\d{2}|20\d{2}|2100)$/);
        if (yearOnly) {
            return new Date(parseInt(yearOnly[1], 10), 0, 1);
        }

        const matchNumerico = texto.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (matchNumerico) {
            const day = parseInt(matchNumerico[1]);
            const month = parseInt(matchNumerico[2]) - 1;
            let year = parseInt(matchNumerico[3]);
            if (year < 100) year += (year > 50 ? 1900 : 2000);
            return new Date(year, month, day);
        }

        // Intentar parsear formato textual "18 de diciembre de 2023"
        const meses = {
            'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
            'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
            'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
        };

        const matchTextual = texto.match(/(\d{1,2})\s+de\s+(\w+)\s+(?:de\s+)?(\d{4})/i);
        if (matchTextual) {
            const day = parseInt(matchTextual[1]);
            const mesNombre = matchTextual[2].toLowerCase();
            const year = parseInt(matchTextual[3]);
            if (meses.hasOwnProperty(mesNombre)) {
                return new Date(year, meses[mesNombre], day);
            }
        }

        return null;
    },

    /**
     * Calcula diferencia en días entre dos fechas
     * @param {Date} fecha1
     * @param {Date} fecha2
     * @returns {number} - Días de diferencia
     */
    calcularDiasDiferencia(fecha1, fecha2) {
        const diffTime = fecha2 - fecha1;
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    },

    /**
     * Procesa una visita y asigna etiqueta relativa
     * @param {string} fechaOriginal - Fecha en formato original
     * @returns {string} - Etiqueta relativa
     */
    procesarVisita(fechaOriginal) {
        const key = fechaOriginal.trim();

        if (this.visitasMap.has(key)) {
            return this.visitasMap.get(key);
        }

        const fechaParsed = this.parseFecha(fechaOriginal);
        if (!fechaParsed) {
            return this.relativizarRespHoy(fechaOriginal);
        }

        this.visitasOrdenadas.push({ fecha: fechaParsed, original: key });
        this.visitasOrdenadas.sort((a, b) => a.fecha - b.fecha);
        this.recalcularEtiquetas();

        return this.visitasMap.get(key);
    },

    /**
     * Recalcula todas las etiquetas de visitas
     */
    recalcularEtiquetas() {
        this.visitasMap.clear();

        for (let i = 0; i < this.visitasOrdenadas.length; i++) {
            const visita = this.visitasOrdenadas[i];
            const numVisita = i + 1;

            let etiqueta;
            if (i === 0) {
                const diasDesdeHoy = this.calcularDiasDiferencia(visita.fecha, this.hoy);
                let tiempoRelativo = this.formatearTiempoRelativo(diasDesdeHoy);
                etiqueta = `Visita ${numVisita} (${tiempoRelativo})`;
            } else {
                const visitaAnterior = this.visitasOrdenadas[i - 1];
                const diasDif = this.calcularDiasDiferencia(visitaAnterior.fecha, visita.fecha);
                etiqueta = this.formatearEtiquetaVisita(numVisita, i, diasDif);
            }

            this.visitasMap.set(visita.original, etiqueta);
        }
    },

    /**
     * Formatea tiempo relativo respecto a hoy
     * @param {number} dias - Días de diferencia (positivo = pasado)
     * @returns {string}
     */
    formatearTiempoRelativo(dias) {
        if (dias === 0) return 'hoy';
        if (dias === 1) return 'hace 1 día';
        if (dias > 0 && dias < 7) return `hace ${dias} días`;
        if (dias >= 7 && dias < 30) return `hace ${Math.round(dias / 7)} semanas`;
        if (dias >= 30 && dias < 365) return `hace ${Math.round(dias / 30)} meses`;
        if (dias >= 365) return `hace ${Math.round(dias / 365)} años`;

        // Fechas futuras
        if (dias === -1) return 'mañana';
        if (dias < 0 && dias > -7) return `en ${Math.abs(dias)} días`;
        if (dias <= -7 && dias > -30) return `en ${Math.round(Math.abs(dias) / 7)} semanas`;
        if (dias <= -30 && dias > -365) return `en ${Math.round(Math.abs(dias) / 30)} meses`;
        if (dias <= -365) return `en ${Math.round(Math.abs(dias) / 365)} años`;

        return 'fecha desconocida';
    },

    /**
     * Formatea etiqueta de visita con referencia a visita anterior
     * @param {number} numVisita - Número de visita
     * @param {number} visitaAnteriorNum - Índice de visita anterior
     * @param {number} diasDif - Días de diferencia
     * @returns {string}
     */
    formatearEtiquetaVisita(numVisita, visitaAnteriorNum, diasDif) {
        if (diasDif === 0) {
            return `Visita ${numVisita} (mismo día que Visita ${visitaAnteriorNum})`;
        }
        if (diasDif === 1) {
            return `Visita ${numVisita} (1 día después de Visita ${visitaAnteriorNum})`;
        }
        if (diasDif < 7) {
            return `Visita ${numVisita} (${diasDif} días después de Visita ${visitaAnteriorNum})`;
        }
        if (diasDif < 30) {
            const semanas = Math.round(diasDif / 7);
            return `Visita ${numVisita} (${semanas} semana${semanas > 1 ? 's' : ''} después de Visita ${visitaAnteriorNum})`;
        }
        if (diasDif < 365) {
            const meses = Math.round(diasDif / 30);
            return `Visita ${numVisita} (${meses} mes${meses > 1 ? 'es' : ''} después de Visita ${visitaAnteriorNum})`;
        }

        const años = Math.round(diasDif / 365);
        return `Visita ${numVisita} (${años} año${años > 1 ? 's' : ''} después de Visita ${visitaAnteriorNum})`;
    },

    /**
     * Relativiza una fecha respecto a hoy
     * @param {string} fechaOriginal - Fecha en formato original
     * @returns {string} - Fecha relativizada o original si no se puede parsear
     */
    relativizarRespHoy(fechaOriginal) {
        const fecha = this.parseFecha(fechaOriginal);
        if (!fecha) return fechaOriginal;

        const dias = this.calcularDiasDiferencia(fecha, this.hoy);
        return this.formatearTiempoRelativo(dias);
    }
};

export default FechasManager;
