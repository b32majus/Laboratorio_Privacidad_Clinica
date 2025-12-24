/**
 * Index.js - Orchestrator for Batch Structured Module
 * Coordinates FileReader, ColumnAnalyzer, LongitudinalValidator, FileProcessor, and XLSXExporter
 */

// Estado global
let currentFile = null;
let fileData = null;
let analysisResult = null;
let processingResult = null;

// Inicializar cuando DOM está listo
document.addEventListener('DOMContentLoaded', () => {
    initializeUpload();
    initializeConfig();
    initializeResult();
});

/**
 * Paso 1: Carga de Archivo
 */
function initializeUpload() {
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const btnChangeFile = document.getElementById('btn-change-file');

    // Click en zona de carga
    uploadZone.addEventListener('click', () => fileInput.click());

    // Drag & Drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = '#B8897D';
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.style.borderColor = '#D4C5C0';
    });

    uploadZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = '#D4C5C0';

        if (e.dataTransfer.files.length > 0) {
            await handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    // Selección de archivo
    fileInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            await handleFileSelect(e.target.files[0]);
        }
    });

    // Cambiar archivo
    btnChangeFile?.addEventListener('click', () => {
        fileInput.value = '';
        fileInfo.classList.add('hidden');
        uploadZone.classList.remove('hidden');
        currentFile = null;
        fileData = null;
    });

    async function handleFileSelect(file) {
        // Validar tamaño
        if (file.size > 10 * 1024 * 1024) {
            alert('El archivo es demasiado grande. Máximo 10MB.');
            return;
        }

        // Validar formato
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['csv', 'xlsx', 'xls'].includes(ext)) {
            alert('Formato no soportado. Usa CSV o Excel.');
            return;
        }

        try {
            currentFile = file;
            const reader = new StructuredFileReader();
            fileData = await reader.read(file);

            // Mostrar info del archivo
            fileName.textContent = file.name;
            uploadZone.classList.add('hidden');
            fileInfo.classList.remove('hidden');

            // Pasar a configuración
            showConfigStep();
        } catch (error) {
            console.error('Error leyendo archivo:', error);
            alert(`Error al leer el archivo: ${error.message}`);
        }
    }
}

/**
 * Paso 2: Configuración
 */
function initializeConfig() {
    const btnBackUpload = document.getElementById('btn-back-upload');
    const btnProcess = document.getElementById('btn-process');
    const patientIdSelect = document.getElementById('patient-id-column');

    btnBackUpload?.addEventListener('click', () => {
        showUploadStep();
    });

    btnProcess?.addEventListener('click', async () => {
        await processFile();
    });

    patientIdSelect?.addEventListener('change', () => {
        validateAndShowSummary();
    });
}

function showConfigStep() {
    // Cambiar paso
    document.querySelectorAll('.batch-step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-config').classList.add('active');

    // Analizar columnas
    const analyzer = new ColumnAnalyzer();
    analysisResult = analyzer.analyze(fileData.headers, fileData.rows[0] || []);

    // Poblar selector de columna ID
    const select = document.getElementById('patient-id-column');
    select.innerHTML = '<option value="">-- Selecciona una columna --</option>';

    // Priorizar columnas detectadas como PATIENT_ID
    const patientIdCandidates = analysisResult
        .filter(c => c.detectedType === 'PATIENT_ID')
        .sort((a, b) => b.confidence - a.confidence);

    analysisResult.forEach((col, idx) => {
        const option = document.createElement('option');
        option.value = col.originalName;
        option.textContent = col.originalName;
        if (col.detectedType === 'PATIENT_ID') {
            option.textContent += ' (Recomendado)';
        }
        select.appendChild(option);
    });

    // Auto-seleccionar si hay un candidato claro
    if (patientIdCandidates.length > 0 && patientIdCandidates[0].confidence > 0.7) {
        select.value = patientIdCandidates[0].originalName;
    }

    // Poblar tabla de configuración
    const tbody = document.getElementById('column-tbody');
    tbody.innerHTML = '';

    analysisResult.forEach((col, idx) => {
        const row = tbody.insertRow();

        // Columna
        const cellName = row.insertCell();
        cellName.textContent = col.originalName;

        // Muestra
        const cellSample = row.insertCell();
        cellSample.textContent = col.sample;

        // Tipo
        const cellType = row.insertCell();
        const badge = document.createElement('span');
        badge.className = `type-badge ${col.detectedType.toLowerCase().replace('_', '-')}`;
        badge.textContent = col.detectedType.replace('_', ' ');
        cellType.appendChild(badge);

        // Acción
        const cellAction = row.insertCell();
        const selectAction = document.createElement('select');
        selectAction.className = 'action-select';
        selectAction.dataset.columnIndex = idx;

        const actions = ['KEEP', 'REMOVE', 'TO_AGE', 'CODIFY', 'PATIENT_ID'];
        actions.forEach(action => {
            const opt = document.createElement('option');
            opt.value = action;
            opt.textContent = action === 'TO_AGE' ? 'Convertir a Edad' :
                action === 'CODIFY' ? 'Codificar' :
                    action === 'PATIENT_ID' ? 'ID Paciente' :
                        action === 'KEEP' ? 'Mantener' : 'Eliminar';
            if (action === col.suggestedAction) {
                opt.selected = true;
            }
            selectAction.appendChild(opt);
        });

        cellAction.appendChild(selectAction);
    });

    // Validar inicialmente
    validateAndShowSummary();
}

function validateAndShowSummary() {
    const patientIdColumn = document.getElementById('patient-id-column').value;
    const btnProcess = document.getElementById('btn-process');

    if (!patientIdColumn) {
        btnProcess.disabled = true;
        document.getElementById('validation-summary').classList.add('hidden');
        return;
    }

    // Validar datos longitudinales
    const validator = new LongitudinalValidator();
    const validation = validator.validate(fileData.rows, fileData.headers, patientIdColumn);

    // Mostrar resumen
    if (validation.summary) {
        const summaryDiv = document.getElementById('validation-summary');
        summaryDiv.innerHTML = `
      <ul>
        <li><strong>${validation.summary.totalPatients}</strong> pacientes únicos</li>
        <li><strong>${validation.summary.totalRows}</strong> registros totales</li>
        <li><strong>${validation.summary.avgVisitsPerPatient}</strong> visitas promedio</li>
        <li><strong>${validation.summary.patientsWithMultipleVisits}</strong> pacientes con múltiples visitas</li>
      </ul>
    `;
        summaryDiv.classList.remove('hidden');
    }

    // Mostrar warnings
    if (validation.warnings.length > 0) {
        const warningsDiv = document.getElementById('validation-warnings');
        const warningsList = document.getElementById('warnings-list');
        warningsList.innerHTML = '';
        validation.warnings.forEach(w => {
            const li = document.createElement('li');
            li.textContent = w.message;
            warningsList.appendChild(li);
        });
        warningsDiv.classList.remove('hidden');
    } else {
        document.getElementById('validation-warnings').classList.add('hidden');
    }

    // Mostrar errores
    if (validation.errors.length > 0) {
        const errorsDiv = document.getElementById('validation-errors');
        const errorsList = document.getElementById('errors-list');
        errorsList.innerHTML = '';
        validation.errors.forEach(e => {
            const li = document.createElement('li');
            li.textContent = e.message;
            errorsList.appendChild(li);
        });
        errorsDiv.classList.remove('hidden');
        btnProcess.disabled = true;
    } else {
        document.getElementById('validation-errors').classList.add('hidden');
        btnProcess.disabled = false;
    }
}

async function processFile() {
    const patientIdColumn = document.getElementById('patient-id-column').value;
    const addVisitNumber = document.getElementById('opt-visit-number').checked;
    const idPrefix = document.getElementById('opt-id-prefix').value.trim() || 'PAC';

    // Recopilar configuración de columnas
    const selects = document.querySelectorAll('.action-select');
    const columnConfigs = Array.from(selects).map((select, idx) => ({
        originalName: analysisResult[idx].originalName,
        action: select.value
    }));

    // Procesar
    const processor = new FileProcessor();
    const config = {
        patientIdColumn,
        columnConfigs,
        options: {
            addVisitNumber,
            idPrefix
        }
    };

    try {
        processingResult = processor.process(fileData, config);
        showResultStep();
    } catch (error) {
        console.error('Error procesando archivo:', error);
        alert(`Error al procesar: ${error.message}`);
    }
}

/**
 * Paso 3: Resultado
 */
function initializeResult() {
    const btnDownloadAnon = document.getElementById('btn-download-anon');
    const btnDownloadCorr = document.getElementById('btn-download-corr');
    const btnNewFile = document.getElementById('btn-new-file');

    btnDownloadAnon?.addEventListener('click', () => {
        if (processingResult) {
            XLSXExporter.exportAnonymized(processingResult);
        }
    });

    btnDownloadCorr?.addEventListener('click', () => {
        if (processingResult) {
            XLSXExporter.exportCorrespondence(processingResult);
        }
    });

    btnNewFile?.addEventListener('click', () => {
        // Reset completo
        currentFile = null;
        fileData = null;
        analysisResult = null;
        processingResult = null;
        document.getElementById('file-input').value = '';
        showUploadStep();
    });
}

function showResultStep() {
    // Cambiar paso
    document.querySelectorAll('.batch-step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-result').classList.add('active');

    // Mostrar estadísticas
    const statsDiv = document.getElementById('result-stats');
    statsDiv.innerHTML = `
    <h3>Estadísticas del Procesamiento</h3>
    <ul>
      <li>Registros totales: ${processingResult.stats.totalRows}</li>
      <li>Pacientes únicos: ${processingResult.stats.uniquePatients}</li>
      <li>Visitas promedio: ${processingResult.stats.avgVisitsPerPatient}</li>
      <li>Columnas eliminadas: ${processingResult.stats.columnsRemoved}</li>
      <li>Columnas mantenidas: ${processingResult.stats.columnsKept}</li>
    </ul>
  `;
}

function showUploadStep() {
    document.querySelectorAll('.batch-step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-upload').classList.add('active');
    document.getElementById('file-info').classList.add('hidden');
    document.getElementById('upload-zone').classList.remove('hidden');
}
