/**
 * FileReader - Lee archivos CSV y Excel
 * Detecta automáticamente el formato y parsea el contenido
 */
class StructuredFileReader {

    /**
     * Lee archivo y devuelve datos estructurados
     * @param {File} file - Archivo a leer
     * @returns {Promise<{headers: string[], rows: any[][]}>}
     */
    async read(file) {
        const extension = file.name.split('.').pop().toLowerCase();

        switch (extension) {
            case 'csv':
                return this.readCSV(file);
            case 'xlsx':
            case 'xls':
                return this.readExcel(file);
            default:
                throw new Error(`Formato no soportado: ${extension}`);
        }
    }

    /**
     * Lee archivo CSV
     * @param {File} file
     * @returns {Promise<{headers: string[], rows: any[][]}>}
     */
    async readCSV(file) {
        const text = await file.text();
        const separator = this.detectSeparator(text);
        const lines = text.split(/\r?\n/).filter(line => line.trim());

        if (lines.length === 0) {
            throw new Error('El archivo CSV está vacío');
        }

        const headers = this.parseCSVLine(lines[0], separator);
        const rows = lines.slice(1).map(line => this.parseCSVLine(line, separator));

        return { headers, rows };
    }

    /**
     * Lee archivo Excel
     * @param {File} file
     * @returns {Promise<{headers: string[], rows: any[][], skippedRows: number}>}
     */
    async readExcel(file) {
        if (typeof XLSX === 'undefined') {
            throw new Error('La librería XLSX no está cargada. Asegúrate de incluir xlsx.full.min.js');
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

        if (data.length === 0) {
            throw new Error('El archivo Excel está vacío');
        }

        // Detectar automáticamente la fila de cabeceras
        const headerRowIndex = this.detectHeaderRow(data);

        return {
            headers: data[headerRowIndex],
            rows: data.slice(headerRowIndex + 1),
            skippedRows: headerRowIndex // Información sobre cuántas filas se saltaron
        };
    }

    /**
     * Detecta la fila que contiene las cabeceras reales
     * Busca la primera fila que parece una cabecera (múltiples celdas con texto, patrones conocidos)
     * @param {any[][]} data - Datos del Excel
     * @returns {number} - Índice de la fila de cabeceras (0-based)
     */
    detectHeaderRow(data) {
        // Patrones comunes en nombres de columnas de datos clínicos
        const headerPatterns = [
            /^(nhc|nombre|apellido|fecha|dni|paciente|id|codigo|edad|sexo|telefono|email|direccion|centro|medico|diagnostico|procedimiento|visita)/i
        ];

        for (let i = 0; i < Math.min(data.length, 10); i++) { // Revisar hasta las primeras 10 filas
            const row = data[i];

            // Contar celdas con contenido de texto
            const textCells = row.filter(cell =>
                cell !== null &&
                cell !== undefined &&
                String(cell).trim() !== '' &&
                typeof cell === 'string'
            );

            // Criterios para considerar una fila como cabecera:
            // 1. Tiene al menos 3 celdas con texto
            // 2. Al menos una celda coincide con patrones conocidos de cabeceras
            // 3. Las celdas son mayormente texto (no números)

            if (textCells.length >= 3) {
                const matchesPattern = row.some(cell =>
                    headerPatterns.some(pattern => pattern.test(String(cell || '')))
                );

                // Verificar que la mayoría de celdas no son números puros
                const numericCells = row.filter(cell =>
                    cell !== null &&
                    cell !== undefined &&
                    !isNaN(cell) &&
                    String(cell).trim() !== ''
                );

                const isLikelyHeader = textCells.length > numericCells.length;

                if (matchesPattern || (isLikelyHeader && textCells.length >= 3)) {
                    console.log(`📋 Cabeceras detectadas en fila ${i + 1}${i > 0 ? ` (saltando ${i} filas explicativas)` : ''}`);
                    return i;
                }
            }
        }

        // Si no se detectó, usar la primera fila como cabecera
        return 0;
    }


    /**
     * Detecta el separador más probable en un CSV
     * @param {string} text
     * @returns {string}
     */
    detectSeparator(text) {
        const firstLine = text.split(/\r?\n/)[0];
        const counts = {
            ',': (firstLine.match(/,/g) || []).length,
            ';': (firstLine.match(/;/g) || []).length,
            '\t': (firstLine.match(/\t/g) || []).length
        };
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    }

    /**
     * Parsea una línea CSV respetando comillas
     * @param {string} line
     * @param {string} separator
     * @returns {string[]}
     */
    parseCSVLine(line, separator) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                // Manejo de comillas dobles escapadas ""
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === separator && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());

        return result;
    }
}

// Exportar también como global para compatibilidad
if (typeof window !== 'undefined') {
    window.StructuredFileReader = StructuredFileReader;
}
