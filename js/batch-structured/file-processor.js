/**
 * FileProcessor - Procesador principal de archivos batch estructurados
 * Genera IDs consistentes, procesa columnas y crea tabla de correspondencia
 */
class FileProcessor {

    constructor() {
        this.sessionId = this.generateSessionId();
    }

    generateSessionId() {
        const now = new Date();
        const date = now.toISOString().slice(0, 10).replace(/-/g, '');
        const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
        const random = Math.random().toString(36).substring(2, 6);
        return `BATCH-${date}-${time}-${random}`;
    }

    /**
     * Procesa el archivo según la configuración
     * @param {Object} data - { headers, rows }
     * @param {ProcessingConfig} config - Configuración de procesamiento
     * @returns {ProcessingResult}
     */
    process(data, config) {
        const { headers, rows } = data;
        const {
            patientIdColumn,
            columnConfigs,
            options = {}
        } = config;

        const {
            idPrefix = 'PAC',
            addVisitNumber = true,
            dateReferenceForAge = new Date()
        } = options;

        // 1. Construir mapeo de pacientes
        const patientMapping = this.buildPatientMapping(
            rows,
            headers,
            patientIdColumn,
            idPrefix
        );

        // 2. Identificar columnas por tipo de acción
        const columnsToRemove = columnConfigs
            .filter(c => c.action === 'REMOVE')
            .map(c => c.originalName);

        const columnsToKeep = columnConfigs
            .filter(c => c.action === 'KEEP')
            .map(c => c.originalName);

        const columnsToAge = columnConfigs
            .filter(c => c.action === 'TO_AGE')
            .map(c => c.originalName);

        const columnsToCodify = columnConfigs
            .filter(c => c.action === 'CODIFY')
            .map(c => c.originalName);

        // 3. Inicializar codificadores para columnas CODIFY
        const codifiers = {};
        columnsToCodify.forEach(colName => {
            codifiers[colName] = new Map();
        });

        // 4. Procesar filas
        const visitCounters = new Map();  // Para numerar visitas
        const processedRows = [];

        rows.forEach((row, rowIndex) => {
            const patientIdIndex = headers.indexOf(patientIdColumn);
            const originalPatientId = String(row[patientIdIndex]).trim();
            const patientData = patientMapping.get(originalPatientId);

            if (!patientData) return; // Skip invalid patient IDs

            // Contador de visita
            if (!visitCounters.has(originalPatientId)) {
                visitCounters.set(originalPatientId, 0);
            }
            visitCounters.set(originalPatientId, visitCounters.get(originalPatientId) + 1);
            const visitNum = visitCounters.get(originalPatientId);

            // Construir fila procesada
            const processedRow = {
                'ID_ESTUDIO': patientData.studyId
            };

            if (addVisitNumber) {
                processedRow['Visita_Num'] = visitNum;
            }

            // Procesar cada columna
            headers.forEach((header, colIndex) => {
                const value = row[colIndex];

                // Saltar columna ID original
                if (header === patientIdColumn) return;

                // Columnas a eliminar
                if (columnsToRemove.includes(header)) return;

                // Columnas a mantener
                if (columnsToKeep.includes(header)) {
                    processedRow[header] = value;
                    return;
                }

                // Columnas a convertir a edad
                if (columnsToAge.includes(header)) {
                    const age = this.calculateAge(value, dateReferenceForAge);
                    processedRow['Edad'] = age;
                    return;
                }

                // Columnas a codificar
                if (columnsToCodify.includes(header)) {
                    const codifier = codifiers[header];
                    const key = String(value || '').toLowerCase().trim();

                    if (!codifier.has(key)) {
                        const prefix = this.generateCodePrefix(header);
                        codifier.set(key, `${prefix}_${String(codifier.size + 1).padStart(2, '0')}`);
                    }

                    processedRow[header] = codifier.get(key);
                    return;
                }

                // Por defecto mantener
                processedRow[header] = value;
            });

            processedRows.push(processedRow);
        });

        // 5. Construir tabla de correspondencia
        const correspondenceTable = this.buildCorrespondenceTable(
            rows,
            headers,
            patientMapping,
            columnConfigs,
            codifiers
        );

        // 6. Estadísticas
        const stats = {
            totalRows: rows.length,
            uniquePatients: patientMapping.size,
            avgVisitsPerPatient: (rows.length / patientMapping.size).toFixed(1),
            columnsRemoved: columnsToRemove.length,
            columnsKept: columnsToKeep.length + columnsToCodify.length,
            columnsTransformed: columnsToAge.length + columnsToCodify.length
        };

        return {
            sessionId: this.sessionId,
            timestamp: new Date(),
            stats,
            anonymizedData: processedRows,
            correspondenceTable,
            codifierMappings: this.extractCodifierMappings(codifiers),
            columnMapping: columnConfigs.map(c => ({
                original: c.originalName,
                action: c.action,
                final: c.action === 'REMOVE' ? null :
                    c.action === 'TO_AGE' ? 'Edad' :
                        c.action === 'PATIENT_ID' ? 'ID_ESTUDIO' :
                            c.originalName
            }))
        };
    }

    /**
     * Construye mapeo de pacientes únicos
     */
    buildPatientMapping(rows, headers, patientIdColumn, idPrefix) {
        const colIndex = headers.indexOf(patientIdColumn);
        const mapping = new Map();
        let counter = 1;

        rows.forEach(row => {
            const originalId = String(row[colIndex] || '').trim();

            if (originalId && !mapping.has(originalId)) {
                mapping.set(originalId, {
                    studyId: `${idPrefix}_${String(counter).padStart(3, '0')}`,
                    visitCount: 0
                });
                counter++;
            }

            if (originalId) {
                mapping.get(originalId).visitCount++;
            }
        });

        return mapping;
    }

    /**
     * Construye tabla de correspondencia (una fila por paciente)
     */
    buildCorrespondenceTable(rows, headers, patientMapping, columnConfigs, codifiers) {
        const table = [];
        const processedPatients = new Set();

        // Encontrar columnas identificadoras a incluir
        const idColumnConfigs = columnConfigs.filter(c =>
            c.action === 'REMOVE' || c.action === 'PATIENT_ID'
        );

        const patientIdConfig = columnConfigs.find(c => c.action === 'PATIENT_ID');
        const patientIdIndex = headers.indexOf(patientIdConfig.originalName);

        rows.forEach(row => {
            const originalPatientId = String(row[patientIdIndex] || '').trim();

            if (!originalPatientId || processedPatients.has(originalPatientId)) {
                return;
            }
            processedPatients.add(originalPatientId);

            const patientData = patientMapping.get(originalPatientId);

            // Fila de correspondencia
            const corrRow = {
                'ID_ESTUDIO': patientData.studyId,
                'Total_Visitas': patientData.visitCount
            };

            // Añadir columnas identificadoras originales
            idColumnConfigs.forEach(config => {
                const colIndex = headers.indexOf(config.originalName);
                corrRow[config.originalName] = row[colIndex];
            });

            table.push(corrRow);
        });

        return table;
    }

    extractCodifierMappings(codifiers) {
        const mappings = {};

        Object.entries(codifiers).forEach(([columnName, codifier]) => {
            mappings[columnName] = Array.from(codifier.entries()).map(([original, code]) => ({
                original,
                code
            }));
        });

        return mappings;
    }

    generateCodePrefix(columnName) {
        // Generar prefijo basado en nombre de columna
        const name = columnName.toUpperCase();
        if (name.includes('CENTRO') || name.includes('HOSPITAL')) return 'CENTRO';
        if (name.includes('SERVICIO')) return 'SERV';
        if (name.includes('MEDICO') || name.includes('DOCTOR')) return 'MED';
        return 'COD';
    }

    calculateAge(birthDate, referenceDate) {
        const birth = this.parseDate(birthDate);
        if (!birth) return null;

        let age = referenceDate.getFullYear() - birth.getFullYear();
        const monthDiff = referenceDate.getMonth() - birth.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birth.getDate())) {
            age--;
        }

        return age;
    }

    parseDate(value) {
        if (!value) return null;

        const str = String(value).trim();
        const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);

        if (match) {
            const [, day, month, year] = match;
            const fullYear = year.length === 2
                ? (parseInt(year) > 50 ? 1900 : 2000) + parseInt(year)
                : parseInt(year);
            return new Date(fullYear, parseInt(month) - 1, parseInt(day));
        }

        const native = new Date(value);
        return isNaN(native.getTime()) ? null : native;
    }
}

// Exportar también como global
if (typeof window !== 'undefined') {
    window.FileProcessor = FileProcessor;
}
