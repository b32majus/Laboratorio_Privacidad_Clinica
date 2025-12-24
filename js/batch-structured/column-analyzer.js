/**
 * ColumnAnalyzer - Analiza columnas y sugiere acciones de anonimización
 * Detecta tipos de datos automáticamente por nombre y contenido
 */
class ColumnAnalyzer {

    // Patrones de detección por nombre de columna
    static PATTERNS = {
        PATIENT_ID: /^(nhc|n[º°]?_?hist|id_?pac|codigo_?pac|num_?pac|patient_?id)/i,
        NAME: /^(nombre|name|paciente$|first_?name)/i,
        SURNAME: /^(apellido|surname|last_?name)/i,
        FULL_NAME: /^(nombre_?completo|full_?name|pac_?nombre)/i,
        DNI: /^(dni|nif|nie|documento|id_?fiscal)/i,
        PHONE: /^(tel[eé]fono|phone|m[oó]vil|mobile|tfno)/i,
        EMAIL: /^(email|correo|e-?mail|mail)/i,
        BIRTHDATE: /^(fecha_?nac|f_?nac|birthdate|nacimiento|fec_?nac)/i,
        VISIT_DATE: /^(fecha_?vis|f_?vis|fecha_?consulta|fecha$|date)/i,
        ADDRESS: /^(direcci[oó]n|address|domicilio|calle|dir)/i,
        POSTAL_CODE: /^(cp|cod_?postal|postal|zip)/i,
        CENTER: /^(centro|hospital|h_|clinic|servicio)/i,
        DOCTOR: /^(m[eé]dico|doctor|dr_?|facultativo|responsable)/i
    };

    // Acciones sugeridas por tipo
    static SUGGESTED_ACTIONS = {
        PATIENT_ID: 'PATIENT_ID',  // Acción especial: columna identificadora
        NAME: 'REMOVE',
        SURNAME: 'REMOVE',
        FULL_NAME: 'REMOVE',
        DNI: 'REMOVE',
        PHONE: 'REMOVE',
        EMAIL: 'REMOVE',
        BIRTHDATE: 'TO_AGE',
        VISIT_DATE: 'KEEP',        // IMPORTANTE: fechas de visita se mantienen
        ADDRESS: 'REMOVE',
        POSTAL_CODE: 'REMOVE',
        CENTER: 'CODIFY',
        DOCTOR: 'REMOVE',
        UNKNOWN: 'KEEP'
    };

    /**
     * Analiza todas las columnas
     * @param {string[]} headers - Nombres de columnas
     * @param {any[]} sampleRow - Primera fila de datos (muestra)
     * @returns {ColumnConfig[]}
     */
    analyze(headers, sampleRow) {
        return headers.map((header, index) => {
            const sample = sampleRow[index];
            const detectedType = this.detectType(header, sample);

            return {
                originalName: header,
                sample: this.formatSample(sample),
                detectedType,
                suggestedAction: ColumnAnalyzer.SUGGESTED_ACTIONS[detectedType],
                confidence: this.calculateConfidence(header, sample, detectedType)
            };
        });
    }

    /**
     * Detecta el tipo de columna
     */
    detectType(headerName, sampleValue) {
        // 1. Primero por nombre de columna
        for (const [type, pattern] of Object.entries(ColumnAnalyzer.PATTERNS)) {
            if (pattern.test(headerName)) {
                return type;
            }
        }

        // 2. Luego por contenido de muestra
        const sample = String(sampleValue || '').trim();

        if (this.looksLikeDNI(sample)) return 'DNI';
        if (this.looksLikePhone(sample)) return 'PHONE';
        if (this.looksLikeEmail(sample)) return 'EMAIL';
        if (this.looksLikeDate(sample)) return 'VISIT_DATE';
        if (this.looksLikeNHC(sample)) return 'PATIENT_ID';

        return 'UNKNOWN';
    }

    // Detectores de contenido
    looksLikeDNI(value) {
        return /^\d{8}[A-Z]$/i.test(value) || /^[XYZ]\d{7}[A-Z]$/i.test(value);
    }

    looksLikePhone(value) {
        const cleaned = value.replace(/[\s\-\.]/g, '');
        return /^(\+34)?[67]\d{8}$/.test(cleaned);
    }

    looksLikeEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    looksLikeDate(value) {
        return /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(value);
    }

    looksLikeNHC(value) {
        // NHC típicamente son números de 5-12 dígitos
        return /^\d{5,12}$/.test(value);
    }

    formatSample(value) {
        if (value === null || value === undefined || value === '') return '(vacío)';
        const str = String(value);
        return str.length > 30 ? str.substring(0, 27) + '...' : str;
    }

    calculateConfidence(header, sample, detectedType) {
        // Alta confianza si coincide por nombre Y por contenido
        // Media confianza si solo coincide por uno
        // Baja confianza si es UNKNOWN

        if (detectedType === 'UNKNOWN') return 0.3;

        const matchesByName = Object.entries(ColumnAnalyzer.PATTERNS)
            .some(([type, pattern]) => type === detectedType && pattern.test(header));

        const matchesByContent = this.contentMatchesType(sample, detectedType);

        if (matchesByName && matchesByContent) return 0.95;
        if (matchesByName || matchesByContent) return 0.7;
        return 0.5;
    }

    contentMatchesType(sample, type) {
        const value = String(sample || '').trim();
        switch (type) {
            case 'DNI': return this.looksLikeDNI(value);
            case 'PHONE': return this.looksLikePhone(value);
            case 'EMAIL': return this.looksLikeEmail(value);
            case 'VISIT_DATE':
            case 'BIRTHDATE': return this.looksLikeDate(value);
            case 'PATIENT_ID': return this.looksLikeNHC(value);
            default: return false;
        }
    }
}

// Exportar también como global
if (typeof window !== 'undefined') {
    window.ColumnAnalyzer = ColumnAnalyzer;
}
