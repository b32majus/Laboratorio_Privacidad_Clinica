/**
 * XLSXExporter - Exporta resultados a Excel
 * Genera archivos anonimizados y tabla de correspondencia
 */
class XLSXExporter {

    /**
     * Exporta datos anonimizados
     */
    static exportAnonymized(result, filename = null) {
        if (typeof XLSX === 'undefined') {
            throw new Error('La librería XLSX no está cargada');
        }

        const { anonymizedData, sessionId, timestamp, stats } = result;

        const wb = XLSX.utils.book_new();

        // Hoja principal de datos
        const ws = XLSX.utils.json_to_sheet(anonymizedData);
        XLSX.utils.book_append_sheet(wb, ws, 'Datos');

        // Hoja de información
        const infoData = [
            ['INFORMACIÓN DEL ARCHIVO'],
            [''],
            ['Sesión', sessionId],
            ['Fecha de procesamiento', timestamp.toLocaleString('es-ES')],
            [''],
            ['ESTADÍSTICAS'],
            ['Registros totales', stats.totalRows],
            ['Pacientes únicos', stats.uniquePatients],
            ['Visitas promedio por paciente', stats.avgVisitsPerPatient],
            [''],
            ['COLUMNAS'],
            ['Columnas eliminadas', stats.columnsRemoved],
            ['Columnas mantenidas', stats.columnsKept],
            [''],
            ['AVISO LEGAL'],
            ['Este archivo contiene datos seudonimizados.'],
            ['No contiene identificadores directos del paciente.'],
            ['Para análisis estadístico y uso con IA.'],
            [''],
            ['Generado por: Laboratorio de Privacidad Clínica - Sophilux']
        ];

        const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
        XLSX.utils.book_append_sheet(wb, wsInfo, 'Info');

        // Generar nombre de archivo
        const date = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
        const finalFilename = filename || `datos_anonimizados_${date}.xlsx`;

        XLSX.writeFile(wb, finalFilename);
    }

    /**
     * Exporta tabla de correspondencia
     */
    static exportCorrespondence(result, filename = null) {
        if (typeof XLSX === 'undefined') {
            throw new Error('La librería XLSX no está cargada');
        }

        const {
            correspondenceTable,
            sessionId,
            timestamp,
            columnMapping,
            codifierMappings
        } = result;

        const wb = XLSX.utils.book_new();

        // Hoja de advertencia (primera)
        const warningData = [
            ['⚠️ DOCUMENTO CONFIDENCIAL ⚠️'],
            [''],
            ['Este archivo contiene la tabla de correspondencia entre'],
            ['los identificadores de estudio y los datos reales de los pacientes.'],
            [''],
            ['INSTRUCCIONES DE SEGURIDAD:'],
            ['1. Guardar en ubicación segura con acceso restringido'],
            ['2. No compartir por email ni medios no cifrados'],
            ['3. No almacenar junto con los datos anonimizados'],
            ['4. Destruir cuando ya no sea necesario para el estudio'],
            [''],
            ['Sesión:', sessionId],
            ['Fecha de generación:', timestamp.toLocaleString('es-ES')],
            ['Pacientes en tabla:', correspondenceTable.length]
        ];

        const wsWarning = XLSX.utils.aoa_to_sheet(warningData);
        XLSX.utils.book_append_sheet(wb, wsWarning, '⚠️ LEER PRIMERO');

        // Hoja de correspondencia de pacientes
        const wsCorr = XLSX.utils.json_to_sheet(correspondenceTable);
        XLSX.utils.book_append_sheet(wb, wsCorr, 'Correspondencia');

        // Hojas de codificación (si hay columnas codificadas)
        if (codifierMappings && Object.keys(codifierMappings).length > 0) {
            Object.entries(codifierMappings).forEach(([columnName, mappings]) => {
                const codData = mappings.map(m => ({
                    'Código': m.code,
                    'Valor_Original': m.original
                }));

                const wsCod = XLSX.utils.json_to_sheet(codData);
                const sheetName = `Cod_${columnName}`.substring(0, 31); // Max 31 chars
                XLSX.utils.book_append_sheet(wb, wsCod, sheetName);
            });
        }

        // Hoja de mapeo de columnas
        const colMapData = columnMapping.map(c => ({
            'Columna_Original': c.original,
            'Acción': c.action,
            'Columna_Final': c.final || '[ELIMINADA]'
        }));

        const wsColMap = XLSX.utils.json_to_sheet(colMapData);
        XLSX.utils.book_append_sheet(wb, wsColMap, 'Mapeo_Columnas');

        // Generar nombre de archivo
        const date = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
        const finalFilename = filename || `CONFIDENCIAL_correspondencia_${date}.xlsx`;

        XLSX.writeFile(wb, finalFilename);
    }
}

// Exportar también como global
if (typeof window !== 'undefined') {
    window.XLSXExporter = XLSXExporter;
}
