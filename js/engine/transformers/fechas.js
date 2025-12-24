export const fechasTransformer = {
    transform(fechaTexto) {
        // Intentar parsear la fecha
        let fecha = this.parseFecha(fechaTexto);
        if (!fecha) return '[FECHA]';

        const diff = this.calcularDiferencia(fecha, new Date());

        if (diff.dias === 0) return '[hoy]';
        if (diff.dias === 1) return '[ayer]';
        if (diff.dias === -1) return '[mañana]';

        if (diff.dias > 0) {
            // Pasado
            if (diff.dias < 7) return `[hace ${diff.dias} días]`;
            if (diff.dias < 30) return `[hace ${Math.floor(diff.dias / 7)} semanas]`;
            if (diff.dias < 365) return `[hace ${Math.floor(diff.dias / 30)} meses]`;
            return `[hace ${Math.floor(diff.dias / 365)} años]`;
        } else {
            // Futuro
            const dias = Math.abs(diff.dias);
            if (dias < 7) return `[en ${dias} días]`;
            if (dias < 30) return `[en ${Math.floor(dias / 7)} semanas]`;
            return `[futuro]`;
        }
    },

    parseFecha(texto) {
        // Implementación simple para formatos comunes
        // dd/mm/yyyy
        const matchNumerico = texto.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (matchNumerico) {
            const day = parseInt(matchNumerico[1]);
            const month = parseInt(matchNumerico[2]) - 1; // JS months are 0-11
            let year = parseInt(matchNumerico[3]);
            if (year < 100) year += 2000; // Asumir siglo XXI si hay 2 digitos 
            return new Date(year, month, day);
        }

        // Solo año
        if (/^\d{4}$/.test(texto.trim())) {
            return new Date(parseInt(texto), 0, 1);
        }

        return null; // No se pudo parsear
    },

    calcularDiferencia(fecha1, fecha2) {
        const diffTime = fecha2 - fecha1;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return { dias: diffDays };
    }
};
