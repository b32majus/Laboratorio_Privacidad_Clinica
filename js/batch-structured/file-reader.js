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
     * @returns {Promise<{headers: string[], rows: any[][]}>}
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

        return {
            headers: data[0],
            rows: data.slice(1)
        };
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
