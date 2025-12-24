# Módulo Batch: Procesamiento de Archivos Estructurados
## Especificación Técnica - Versión Premium

**Versión:** 1.0  
**Fecha:** Diciembre 2024  
**Requisito:** Funcionalidad Premium

---

## 1. VISIÓN GENERAL

### 1.1 Propósito

Procesar archivos CSV/Excel con datos estructurados de formularios clínicos, permitiendo:
- Seudonimización de datos de pacientes
- Soporte para datos longitudinales (múltiples visitas por paciente)
- Generación de tabla de correspondencia reversible
- Preservación de fechas para análisis temporal

### 1.2 Diferencia con Procesamiento de Texto

| Característica | Texto Libre | Datos Estructurados |
|---------------|-------------|---------------------|
| Detección | RegEx contextual | Por columnas |
| Sustitución de nombres | Sintética (María → Elena) | Codificada (María → PAC_001) |
| Fechas | Relativizadas | Mantenidas (para análisis) |
| Reversibilidad | No | Sí (tabla de correspondencia) |
| Múltiples registros | No aplica | Mismo ID por paciente |

### 1.3 Caso de Uso Principal

Bases de datos de seguimiento clínico donde:
- Cada fila es una visita/registro
- Múltiples filas pueden corresponder al mismo paciente
- Se necesita analizar evolución temporal
- Los datos proceden de formularios estructurados (sin texto libre)

---

## 2. REQUISITOS FUNCIONALES

### 2.1 Requisitos Críticos

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-01 | Identificar pacientes únicos por columna clave | CRÍTICO |
| RF-02 | Asignar mismo ID a todas las visitas del mismo paciente | CRÍTICO |
| RF-03 | Mantener fechas de visita sin modificar | CRÍTICO |
| RF-04 | Generar tabla de correspondencia descargable | CRÍTICO |
| RF-05 | Detectar automáticamente tipo de columnas | ALTO |
| RF-06 | Validar coherencia de datos longitudinales | ALTO |
| RF-07 | Añadir número secuencial de visita | MEDIO |
| RF-08 | Convertir fecha de nacimiento a edad | MEDIO |
| RF-09 | Codificar centros/hospitales | MEDIO |

### 2.2 Formatos Soportados

- CSV (separadores: coma, punto y coma, tabulador)
- Excel (.xlsx)
- Excel legacy (.xls)

### 2.3 Límites

- Tamaño máximo de archivo: 10 MB
- Máximo de filas: 50,000
- Máximo de columnas: 100

---

## 3. ARQUITECTURA

### 3.1 Estructura de Archivos

```
js/
├── batch/
│   ├── index.js                    # Exporta módulo completo
│   ├── file-processor.js           # Orquestador principal
│   ├── file-reader.js              # Lectura de CSV/Excel
│   ├── column-analyzer.js          # Detección automática de tipos
│   ├── validators/
│   │   └── longitudinal-validator.js   # Validación de datos
│   ├── transformers/
│   │   ├── patient-id-mapper.js    # Mapeo de IDs de paciente
│   │   ├── column-processor.js     # Procesamiento por columna
│   │   ├── date-to-age.js          # Conversión fecha → edad
│   │   └── center-codifier.js      # Codificación de centros
│   └── exporters/
│       ├── xlsx-exporter.js        # Genera Excel anonimizado
│       ├── correspondence-exporter.js  # Genera tabla correspondencia
│       └── pdf-report-batch.js     # Informe de sesión batch
│
├── lib/
│   └── xlsx.full.min.js            # SheetJS (lectura/escritura Excel)
│
└── ui/
    └── batch-ui.js                 # Interfaz del módulo batch
```

### 3.2 Flujo de Datos

```
ENTRADA: Archivo CSV/Excel
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  1. FILE READER                                             │
│     - Detecta formato (CSV/XLSX)                           │
│     - Parsea contenido                                      │
│     - Extrae headers y rows                                 │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  2. COLUMN ANALYZER                                         │
│     - Detecta tipo de cada columna por nombre y contenido  │
│     - Sugiere acción para cada columna                     │
│     - Identifica candidatos a columna ID de paciente       │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  3. USUARIO: CONFIGURACIÓN                                  │
│     - Selecciona columna identificadora de paciente        │
│     - Confirma/modifica acciones por columna               │
│     - Configura opciones (prefijo ID, número visita, etc.) │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  4. LONGITUDINAL VALIDATOR                                  │
│     - Cuenta pacientes únicos                              │
│     - Detecta visitas por paciente                         │
│     - Valida orden cronológico                             │
│     - Reporta warnings/errors                              │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  5. FILE PROCESSOR                                          │
│     - Genera mapeo paciente original → ID estudio          │
│     - Procesa cada fila aplicando transformaciones         │
│     - Mantiene consistencia de IDs                         │
│     - Añade número de visita secuencial                    │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
SALIDA: {
  anonymizedData: [...],        // Para Excel anonimizado
  correspondenceTable: [...],   // Para tabla de correspondencia
  stats: {...},                 // Estadísticas
  sessionId: string             // ID de sesión
}
```

---

## 4. ESPECIFICACIÓN DE COMPONENTES

### 4.1 FileReader

```javascript
/**
 * Lee archivos CSV y Excel
 */
export class FileReader {
  
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
  
  async readCSV(file) {
    const text = await file.text();
    const separator = this.detectSeparator(text);
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    
    const headers = this.parseCSVLine(lines[0], separator);
    const rows = lines.slice(1).map(line => this.parseCSVLine(line, separator));
    
    return { headers, rows };
  }
  
  async readExcel(file) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    
    return {
      headers: data[0],
      rows: data.slice(1)
    };
  }
  
  detectSeparator(text) {
    const firstLine = text.split(/\r?\n/)[0];
    const counts = {
      ',': (firstLine.match(/,/g) || []).length,
      ';': (firstLine.match(/;/g) || []).length,
      '\t': (firstLine.match(/\t/g) || []).length
    };
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }
  
  parseCSVLine(line, separator) {
    // Manejo de campos con comillas
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
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
```

### 4.2 ColumnAnalyzer

```javascript
/**
 * Analiza columnas y sugiere acciones
 */
export class ColumnAnalyzer {
  
  // Patrones de detección por nombre de columna
  static PATTERNS = {
    PATIENT_ID: /^(nhc|n[º°]?_?hist|id_?pac|codigo_?pac|num_?pac)/i,
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
    if (value === null || value === undefined) return '(vacío)';
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
```

### 4.3 LongitudinalValidator

```javascript
/**
 * Valida coherencia de datos longitudinales
 */
export class LongitudinalValidator {
  
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
          if (validDates[i].dateValue < validDates[i-1].dateValue) {
            patientsWithUnorderedDates++;
            warnings.push({
              type: 'UNORDERED_DATES',
              message: `Paciente con ID "${patientId}": visitas no ordenadas cronológicamente`,
              patientId,
              rows: [validDates[i-1].rowIndex, validDates[i].rowIndex]
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
```

### 4.4 FileProcessor (Principal)

```javascript
/**
 * Procesador principal de archivos batch
 */
export class FileProcessor {
  
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
```

### 4.5 XLSXExporter

```javascript
/**
 * Exporta resultados a Excel
 */
export class XLSXExporter {
  
  /**
   * Exporta datos anonimizados
   */
  static exportAnonymized(result, filename = null) {
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
```

---

## 5. INTERFAZ DE USUARIO

### 5.1 HTML

```html
<!-- batch.html o sección en app.html para premium -->

<section class="batch-module" id="batch-module">
  
  <!-- Paso 1: Carga de archivo -->
  <div class="batch-step active" id="step-upload">
    <div class="step-header">
      <span class="step-number">1</span>
      <h2>Carga de Archivo</h2>
    </div>
    
    <p class="step-description">
      Sube un archivo CSV o Excel con datos estructurados de formularios clínicos.
      <strong>No uses esta herramienta para textos de libre escritura</strong> - 
      para eso está el procesador de texto.
    </p>
    
    <div class="upload-zone" id="upload-zone">
      <div class="upload-icon">📊</div>
      <p class="upload-title">Arrastra tu archivo aquí</p>
      <p class="upload-subtitle">o haz clic para seleccionar</p>
      <p class="upload-formats">Formatos: .csv, .xlsx, .xls (máx. 10MB)</p>
      <input type="file" id="file-input" accept=".csv,.xlsx,.xls" hidden>
    </div>
    
    <div class="file-info hidden" id="file-info">
      <span class="file-name" id="file-name"></span>
      <button class="btn-text" id="btn-change-file">Cambiar archivo</button>
    </div>
  </div>
  
  <!-- Paso 2: Configuración -->
  <div class="batch-step" id="step-config">
    <div class="step-header">
      <span class="step-number">2</span>
      <h2>Configuración de Columnas</h2>
    </div>
    
    <!-- Selector de columna identificadora -->
    <div class="config-section config-patient-id">
      <h3>🔑 Columna Identificadora de Paciente</h3>
      <p>Selecciona la columna que identifica de forma única a cada paciente 
         (aunque tenga múltiples visitas):</p>
      
      <select id="patient-id-column" class="select-large">
        <option value="">-- Selecciona una columna --</option>
      </select>
      
      <div class="validation-summary hidden" id="validation-summary">
        <!-- Se llena dinámicamente -->
      </div>
    </div>
    
    <!-- Tabla de configuración de columnas -->
    <div class="config-section">
      <h3>Configuración de Columnas</h3>
      
      <table class="column-config-table" id="column-table">
        <thead>
          <tr>
            <th>Columna</th>
            <th>Muestra</th>
            <th>Tipo Detectado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody id="column-tbody">
          <!-- Generado dinámicamente -->
        </tbody>
      </table>
    </div>
    
    <!-- Opciones adicionales -->
    <div class="config-section config-options">
      <h3>Opciones Adicionales</h3>
      
      <label class="checkbox-label">
        <input type="checkbox" id="opt-visit-number" checked>
        Añadir columna "Visita_Num" (número secuencial de visita por paciente)
      </label>
      
      <label class="inline-label">
        Prefijo para IDs de paciente:
        <input type="text" id="opt-id-prefix" value="PAC" maxlength="10" class="input-small">
      </label>
    </div>
    
    <!-- Warnings de validación -->
    <div class="validation-warnings hidden" id="validation-warnings">
      <h4>⚠️ Avisos</h4>
      <ul id="warnings-list"></ul>
    </div>
    
    <!-- Errores de validación -->
    <div class="validation-errors hidden" id="validation-errors">
      <h4>🚫 Errores (deben corregirse)</h4>
      <ul id="errors-list"></ul>
    </div>
    
    <div class="step-actions">
      <button class="btn-secondary" id="btn-back-upload">← Volver</button>
      <button class="btn-primary" id="btn-process" disabled>Procesar archivo →</button>
    </div>
  </div>
  
  <!-- Paso 3: Resultado -->
  <div class="batch-step" id="step-result">
    <div class="step-header">
      <span class="step-number">3</span>
      <h2>✓ Archivo Procesado</h2>
    </div>
    
    <div class="result-stats" id="result-stats">
      <!-- Generado dinámicamente -->
    </div>
    
    <div class="download-section">
      <h3>Descargas</h3>
      
      <button class="btn-download btn-primary" id="btn-download-anon">
        <span class="btn-icon">📊</span>
        <span class="btn-text">
          <strong>Descargar datos anonimizados</strong>
          <small>.xlsx - Listo para análisis</small>
        </span>
      </button>
      
      <button class="btn-download btn-secondary" id="btn-download-corr">
        <span class="btn-icon">🔑</span>
        <span class="btn-text">
          <strong>Descargar tabla de correspondencia</strong>
          <small>.xlsx - Guardar en lugar seguro</small>
        </span>
      </button>
      <p class="download-warning">
        ⚠️ La tabla de correspondencia permite revertir la seudonimización.
        Guárdala en un lugar seguro y separado de los datos anonimizados.
      </p>
      
      <button class="btn-text" id="btn-download-pdf">
        📋 Descargar informe de sesión (.pdf)
      </button>
    </div>
    
    <div class="step-actions">
      <button class="btn-secondary" id="btn-new-file">Procesar otro archivo</button>
    </div>
  </div>
  
</section>
```

### 5.2 CSS Adicional

```css
/* Batch module styles */
.batch-module {
  max-width: 1000px;
  margin: 0 auto;
  padding: var(--space-6);
}

.batch-step {
  display: none;
}

.batch-step.active {
  display: block;
  animation: fadeIn var(--transition-normal);
}

.step-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.step-number {
  width: 36px;
  height: 36px;
  background: var(--oro-rosa);
  color: white;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-semibold);
}

/* Config sections */
.config-section {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
}

.config-section h3 {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  margin-bottom: var(--space-4);
}

.config-patient-id {
  border-left: 4px solid var(--oro-rosa);
}

/* Select grande */
.select-large {
  width: 100%;
  max-width: 400px;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  cursor: pointer;
}

/* Validation summary */
.validation-summary {
  margin-top: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
}

.validation-summary ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-2);
}

.validation-summary li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.validation-summary strong {
  font-size: var(--text-xl);
  color: var(--oro-rosa);
}

/* Column config table */
.column-config-table {
  width: 100%;
  border-collapse: collapse;
}

.column-config-table th {
  text-align: left;
  padding: var(--space-3);
  background: var(--bg-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  border-bottom: 2px solid var(--border-light);
}

.column-config-table td {
  padding: var(--space-3);
  border-bottom: 1px solid var(--border-light);
  vertical-align: middle;
}

.column-config-table td:first-child {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.column-config-table td:nth-child(2) {
  color: var(--text-muted);
  font-size: var(--text-sm);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.column-config-table td:nth-child(3) {
  font-size: var(--text-xs);
}

/* Type badges */
.type-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.type-badge.patient-id { background: #E3F2FD; color: #1565C0; }
.type-badge.name { background: #FFEBEE; color: #C62828; }
.type-badge.dni { background: #FFEBEE; color: #C62828; }
.type-badge.phone { background: #FFEBEE; color: #C62828; }
.type-badge.date { background: #E8F5E9; color: #2E7D32; }
.type-badge.unknown { background: #F5F5F5; color: #616161; }

/* Action select */
.action-select {
  padding: var(--space-2);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  background: var(--bg-card);
  min-width: 140px;
}

/* Validation messages */
.validation-warnings,
.validation-errors {
  padding: var(--space-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}

.validation-warnings {
  background: var(--warning-light);
  border: 1px solid var(--warning);
}

.validation-errors {
  background: var(--error-light);
  border: 1px solid var(--error);
}

.validation-warnings h4,
.validation-errors h4 {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--text-sm);
}

.validation-warnings ul,
.validation-errors ul {
  margin: 0;
  padding-left: var(--space-5);
  font-size: var(--text-sm);
}

/* Download buttons */
.download-section {
  margin-top: var(--space-8);
}

.btn-download {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
  max-width: 400px;
  padding: var(--space-4);
  margin-bottom: var(--space-3);
  text-align: left;
}

.btn-download .btn-icon {
  font-size: var(--text-2xl);
}

.btn-download .btn-text {
  display: flex;
  flex-direction: column;
}

.btn-download .btn-text strong {
  font-size: var(--text-base);
}

.btn-download .btn-text small {
  font-size: var(--text-sm);
  opacity: 0.8;
  font-weight: normal;
}

.download-warning {
  font-size: var(--text-sm);
  color: var(--warning);
  max-width: 400px;
  margin: var(--space-2) 0 var(--space-6) 0;
}

/* Result stats */
.result-stats {
  background: var(--success-light);
  border: 1px solid var(--success);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
}

.result-stats h3 {
  margin: 0 0 var(--space-4) 0;
  color: var(--success);
}

.result-stats ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-3);
}

.result-stats li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.result-stats li::before {
  content: '✓';
  color: var(--success);
}

/* Config options */
.config-options {
  background: var(--bg-primary);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  margin-bottom: var(--space-3);
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--oro-rosa);
}

.inline-label {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.input-small {
  width: 80px;
  padding: var(--space-2);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  text-transform: uppercase;
}
```

---

## 6. EJEMPLO COMPLETO DE TRANSFORMACIÓN

### Entrada

**archivo_seguimiento_psoriasis.xlsx**

| NHC | Nombre | Apellidos | DNI | F_Nacimiento | Fecha_Visita | PASI | IGA | Tratamiento | Centro | Médico |
|-----|--------|-----------|-----|--------------|--------------|------|-----|-------------|--------|--------|
| 4521987 | María | García López | 12345678A | 15/06/1970 | 15/01/2024 | 12.5 | 3 | Adalimumab | H.U. Badajoz | Dr. Pérez |
| 4521987 | María | García López | 12345678A | 15/06/1970 | 15/04/2024 | 8.2 | 2 | Adalimumab | H.U. Badajoz | Dr. Pérez |
| 4521987 | María | García López | 12345678A | 15/06/1970 | 15/07/2024 | 3.1 | 1 | Adalimumab | H.U. Badajoz | Dr. Pérez |
| 7894561 | Juan | Pérez Martín | 87654321B | 22/03/1958 | 20/02/2024 | 18.0 | 4 | Secukinumab | H. Mérida | Dra. Gómez |
| 7894561 | Juan | Pérez Martín | 87654321B | 22/03/1958 | 20/05/2024 | 9.5 | 2 | Secukinumab | H. Mérida | Dra. Gómez |
| 1122334 | Ana | Ruiz Sánchez | 11223344C | 08/11/1985 | 10/03/2024 | 15.3 | 3 | Risankizumab | H.U. Badajoz | Dr. Pérez |

### Configuración

- **Columna identificadora:** NHC
- **Eliminar:** Nombre, Apellidos, DNI, Médico
- **Convertir a edad:** F_Nacimiento
- **Codificar:** Centro
- **Mantener:** Fecha_Visita, PASI, IGA, Tratamiento
- **Añadir número de visita:** ✓
- **Prefijo ID:** PAC

### Salida: datos_anonimizados_20241215.xlsx

| ID_ESTUDIO | Visita_Num | Edad | Fecha_Visita | PASI | IGA | Tratamiento | Centro |
|------------|------------|------|--------------|------|-----|-------------|--------|
| PAC_001 | 1 | 54 | 15/01/2024 | 12.5 | 3 | Adalimumab | CENTRO_01 |
| PAC_001 | 2 | 54 | 15/04/2024 | 8.2 | 2 | Adalimumab | CENTRO_01 |
| PAC_001 | 3 | 54 | 15/07/2024 | 3.1 | 1 | Adalimumab | CENTRO_01 |
| PAC_002 | 1 | 66 | 20/02/2024 | 18.0 | 4 | Secukinumab | CENTRO_02 |
| PAC_002 | 2 | 66 | 20/05/2024 | 9.5 | 2 | Secukinumab | CENTRO_02 |
| PAC_003 | 1 | 39 | 10/03/2024 | 15.3 | 3 | Risankizumab | CENTRO_01 |

### Salida: CONFIDENCIAL_correspondencia_20241215.xlsx

**Hoja: Correspondencia**

| ID_ESTUDIO | Total_Visitas | NHC | Nombre | Apellidos | DNI |
|------------|---------------|-----|--------|-----------|-----|
| PAC_001 | 3 | 4521987 | María | García López | 12345678A |
| PAC_002 | 2 | 7894561 | Juan | Pérez Martín | 87654321B |
| PAC_003 | 1 | 1122334 | Ana | Ruiz Sánchez | 11223344C |

**Hoja: Cod_Centro**

| Código | Valor_Original |
|--------|----------------|
| CENTRO_01 | H.U. Badajoz |
| CENTRO_02 | H. Mérida |

---

## 7. PLAN DE IMPLEMENTACIÓN

### Fase 1: Lectura de Archivos
- [ ] Integrar SheetJS (xlsx.min.js)
- [ ] Implementar FileReader
- [ ] Test con CSV y Excel

### Fase 2: Análisis de Columnas
- [ ] Implementar ColumnAnalyzer
- [ ] Patrones de detección
- [ ] UI de configuración

### Fase 3: Validación Longitudinal
- [ ] Implementar LongitudinalValidator
- [ ] UI de warnings/errors
- [ ] Resumen de pacientes/visitas

### Fase 4: Procesamiento
- [ ] Implementar FileProcessor
- [ ] Mapeo de pacientes consistente
- [ ] Numeración de visitas
- [ ] Codificación de columnas

### Fase 5: Exportación
- [ ] Implementar XLSXExporter
- [ ] Excel anonimizado
- [ ] Tabla de correspondencia
- [ ] Informe PDF

### Fase 6: Integración
- [ ] Conectar con UI
- [ ] Testing end-to-end
- [ ] Documentación

---

## 8. CRITERIOS DE ACEPTACIÓN

| Criterio | Verificación |
|----------|--------------|
| Lee archivos CSV correctamente | ✓ Test con diferentes separadores |
| Lee archivos Excel correctamente | ✓ Test con .xlsx y .xls |
| Detecta columnas identificadoras | ✓ NHC, DNI detectados automáticamente |
| Mismo paciente = mismo ID | ✓ Verificar en Excel de salida |
| Fechas de visita preservadas | ✓ Fechas sin modificar |
| Número de visita correcto | ✓ Secuencial por paciente |
| Tabla de correspondencia completa | ✓ Una fila por paciente único |
| Codificación de centros | ✓ Códigos consistentes |
| Conversión fecha→edad | ✓ Edad calculada correctamente |
| Validación muestra warnings | ✓ Pacientes con 1 visita detectados |

---

*Documento generado para implementación con Claude Code*
*Versión 1.0 - Diciembre 2024*
