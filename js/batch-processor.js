// ==================== BATCH QUEUE MANAGER ====================
class BatchQueue {
  constructor() {
    this.documents = [];  // [{id, name, file, status, result, errors, processingTime}]
    this.currentIndex = -1;
  }

  addDocument(file) {
    const doc = {
      id: this.generateId(),
      name: file.name,
      file: file,
      status: 'pending',  // pending|processing|completed|error
      result: null,
      errors: [],
      processingTime: 0
    };
    this.documents.push(doc);
    return doc.id;
  }

  removeDocument(id) {
    const index = this.documents.findIndex(d => d.id === id);
    if (index !== -1) {
      this.documents.splice(index, 1);
    }
  }

  getDocument(id) {
    return this.documents.find(d => d.id === id);
  }

  getNextPending() {
    return this.documents.find(d => d.status === 'pending');
  }

  getAllCompleted() {
    return this.documents.filter(d => d.status === 'completed');
  }

  getTotalStats() {
    return {
      total: this.documents.length,
      pending: this.documents.filter(d => d.status === 'pending').length,
      processing: this.documents.filter(d => d.status === 'processing').length,
      completed: this.documents.filter(d => d.status === 'completed').length,
      errors: this.documents.filter(d => d.status === 'error').length
    };
  }

  generateId() {
    return 'doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  clear() {
    this.documents = [];
    this.currentIndex = -1;
  }
}

// ==================== PERSISTENT ENTITY MAPPER ====================
class PersistentMapper {
  constructor(maintainConsistency = true) {
    this.maintainConsistency = maintainConsistency;
    this.globalMappings = new Map();  // "juan garcia" → "Carlos Rodríguez López"
    this.documentMappings = new Map(); // docId → Map(local mappings)
  }

  reset() {
    if (!this.maintainConsistency) {
      // Solo limpiamos los mapeos globales si NO mantenemos consistencia
      this.globalMappings.clear();
    }
    // documentMappings se mantiene para histórico
  }

  getOrCreateMapping(original, docId, generatorFn) {
    const key = original.toLowerCase().trim();

    // Si mantenemos consistencia y ya existe un mapeo global, usarlo
    if (this.maintainConsistency && this.globalMappings.has(key)) {
      return this.globalMappings.get(key);
    }

    // Generar nuevo mapeo usando la función generadora
    const mapped = generatorFn();

    // Si mantenemos consistencia, guardar en mapeo global
    if (this.maintainConsistency) {
      this.globalMappings.set(key, mapped);
    }

    // Registrar en histórico del documento
    if (!this.documentMappings.has(docId)) {
      this.documentMappings.set(docId, new Map());
    }
    this.documentMappings.get(docId).set(key, mapped);

    return mapped;
  }

  getAllMappings() {
    return Array.from(this.globalMappings.entries());
  }

  getMappingsForDocument(docId) {
    return this.documentMappings.get(docId) || new Map();
  }

  getGlobalMappingsCount() {
    return this.globalMappings.size;
  }

  getDocumentMappingsCount(docId) {
    const docMap = this.documentMappings.get(docId);
    return docMap ? docMap.size : 0;
  }
}

// ==================== BATCH PROCESSOR ====================
window.BatchProcessor = {
  queue: null,
  mapper: null,
  progressCallback: null,

  initialize(maintainConsistency = true, onProgress = null) {
    this.queue = new BatchQueue();
    this.mapper = new PersistentMapper(maintainConsistency);
    this.progressCallback = onProgress;
  },

  async processAll() {
    const stats = this.queue.getTotalStats();
    let processed = 0;

    while (true) {
      const doc = this.queue.getNextPending();
      if (!doc) break;

      try {
        // Actualizar estado
        doc.status = 'processing';
        this.notifyProgress(processed, stats.total, doc);

        // Leer archivo
        const text = await this.readFile(doc.file);

        // CLAVE: Integrar mapper con AsignadorSustitutos
        // Guardamos la función original
        const originalObtenerSustituto = AsignadorSustitutos.obtenerSustituto.bind(AsignadorSustitutos);

        // Sobrescribimos temporalmente para interceptar llamadas
        AsignadorSustitutos.obtenerSustituto = (nombreOriginal, genero) => {
          return this.mapper.getOrCreateMapping(
            nombreOriginal,
            doc.id,
            () => originalObtenerSustituto(nombreOriginal, genero)
          );
        };

        // Procesar con PrivacyProcessor existente
        const startTime = performance.now();
        const result = window.PrivacyProcessor.process(text);
        const endTime = performance.now();

        // Restaurar función original
        AsignadorSustitutos.obtenerSustituto = originalObtenerSustituto;

        // Guardar resultado
        doc.result = result;
        doc.status = 'completed';
        doc.processingTime = Math.round(endTime - startTime);

        processed++;
        this.notifyProgress(processed, stats.total, doc);

      } catch (error) {
        doc.status = 'error';
        doc.errors.push(error.message);
        console.error(`Error procesando ${doc.name}:`, error);

        processed++;
        this.notifyProgress(processed, stats.total, doc);
      }

      // Solo resetear AsignadorSustitutos si NO mantenemos consistencia
      if (!this.mapper.maintainConsistency) {
        AsignadorSustitutos.reset();
      }

      // Liberar memoria del archivo
      doc.file = null;
    }

    return this.queue.getAllCompleted();
  },

  async readFile(file) {
    if (!file) throw new Error('No file provided');

    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'txt') {
      return await file.text();
    } else if (ext === 'pdf') {
      return await this.readPDF(file);
    } else if (ext === 'docx' || ext === 'doc') {
      return await this.readDOCX(file);
    }

    throw new Error('Formato no soportado: ' + ext);
  },

  async readPDF(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js no está cargado');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
    }

    return fullText.trim();
  },

  async readDOCX(file) {
    if (typeof mammoth === 'undefined') {
      throw new Error('Mammoth.js no está cargado');
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  },

  notifyProgress(current, total, doc) {
    if (this.progressCallback) {
      this.progressCallback({
        current,
        total,
        percentage: Math.round((current / total) * 100),
        currentDoc: doc
      });
    }
  },

  // Métodos auxiliares
  getQueueStats() {
    return this.queue ? this.queue.getTotalStats() : null;
  },

  getMapper() {
    return this.mapper;
  },

  clearQueue() {
    if (this.queue) {
      this.queue.clear();
    }
  }
};
