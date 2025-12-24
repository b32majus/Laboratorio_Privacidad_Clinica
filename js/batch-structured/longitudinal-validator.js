/**
 * LongitudinalValidator - Valida coherencia de datos longitudinales
 * Identifica pacientes únicos, cuenta visitas y detecta problemas
 */
class LongitudinalValidator {

    /**
     * Valida el archivo completo
     * @param {any[][]} rows - Filas de datos
     * @param {string[]} headers - Nombres de columnas
     * @param {string} patientIdColumn - Columna identificadora
     * @param {string} [dateColumn] - Columna de fecha (opcional)
     * @returns {ValidationResult}
     */
    validate(rows, headers, patientIdColumn, dateColumn = null) {
        const errors = [];
        const warnings = [];

        const patientIdIndex = headers.indexOf(patientIdColumn);
        const dateIndex = dateColumn ? headers.indexOf(dateColumn) : -1;

        if (patientIdIndex === -1) {
            errors.push({
                type: 'COLUMN_NOT_FOUND',
                message: `Columna "${patientIdColumn}" no encontrada`
            });
            return { isValid: false, errors, warnings, summary: null };
        }

        // Agrupar por paciente
        const patientVisits = new Map();

        rows.forEach((row, rowIndex) => {
            const patientId = String(row[patientIdIndex] || '').trim();

            // Validar ID vacío
            if (!patientId) {
                errors.push({
                    type: 'EMPTY_PATIENT_ID',
                    message: `Fila ${rowIndex + 2} tiene identificador de paciente vacío`,
                    row: rowIndex + 2
                });
                return;
            }

            if (!patientVisits.has(patientId)) {
                patientVisits.set(patientId, []);
            }

            patientVisits.get(patientId).push({
                rowIndex: rowIndex + 2,  // +2 por header y base-1
                date: dateIndex >= 0 ? row[dateIndex] : null,
                dateValue: dateIndex >= 0 ? this.parseDate(row[dateIndex]) : null
            });
        });

        // Validaciones por paciente
        let patientsWithSingleVisit = 0;
        let patientsWithUnorderedDates = 0;
        let patientsWithDuplicateDates = 0;

        patientVisits.forEach((visits, patientId) => {
            // Paciente con solo 1 visita
            if (visits.length === 1) {
                patientsWithSingleVisit++;
            }

            // Validaciones de fechas
            if (dateIndex >= 0 && visits.length > 1) {
                const validDates = visits.filter(v => v.dateValue !== null);

                // Verificar orden cronológico
                for (let i = 1; i < validDates.length; i++) {
                    if (validDates[i].dateValue < validDates[i - 1].dateValue) {
                        patientsWithUnorderedDates++;
                        warnings.push({
                            type: 'UNORDERED_DATES',
                            message: `Paciente con ID "${patientId}": visitas no ordenadas cronológicamente`,
                            patientId,
                            rows: [validDates[i - 1].rowIndex, validDates[i].rowIndex]
                        });
                        break;
                    }
                }

                // Verificar fechas duplicadas
                const dateStrings = validDates.map(v => String(v.date));
                const uniqueDates = new Set(dateStrings);
                if (uniqueDates.size < dateStrings.length) {
                    patientsWithDuplicateDates++;
                    warnings.push({
                        type: 'DUPLICATE_DATES',
                        message: `Paciente con ID "${patientId}": tiene visitas con la misma fecha`,
                        patientId
                    });
                }
            }
        });

        // Generar summary
        const totalPatients = patientVisits.size;
        const totalRows = rows.length;
        const avgVisits = totalRows / totalPatients;
        const patientsWithMultipleVisits = Array.from(patientVisits.values())
            .filter(v => v.length > 1).length;

        // Warnings de resumen
        if (patientsWithSingleVisit > 0) {
            warnings.unshift({
                type: 'SINGLE_VISIT_SUMMARY',
                message: `${patientsWithSingleVisit} paciente(s) tienen solo 1 registro`
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            summary: {
                totalPatients,
                totalRows,
                avgVisitsPerPatient: avgVisits.toFixed(1),
                patientsWithMultipleVisits,
                patientsWithSingleVisit,
                patientsWithUnorderedDates,
                patientsWithDuplicateDates
            }
        };
    }

    parseDate(value) {
        if (!value) return null;

        const str = String(value).trim();

        // dd/mm/yyyy o dd-mm-yyyy
        const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (match) {
            const [, day, month, year] = match;
            const fullYear = year.length === 2
                ? (parseInt(year) > 50 ? 1900 : 2000) + parseInt(year)
                : parseInt(year);
            return new Date(fullYear, parseInt(month) - 1, parseInt(day));
        }

        // Intentar parsing nativo
        const native = new Date(value);
        return isNaN(native.getTime()) ? null : native;
    }
}

// Exportar también como global
if (typeof window !== 'undefined') {
    window.LongitudinalValidator = LongitudinalValidator;
}
