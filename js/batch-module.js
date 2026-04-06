// Unified Batch module.
// Keeps backward compatibility with the old BatchProcessor API.

class BatchQueue {
  constructor() {
    this.documents = [];
    this.currentIndex = -1;
  }

  addDocument(file) {
    const doc = {
      id: this.generateId(),
      name: file.name,
      file: file,
      status: "pending",
      result: null,
      errors: [],
      processingTime: 0
    };
    this.documents.push(doc);
    return doc.id;
  }

  removeDocument(id) {
    const index = this.documents.findIndex((d) => d.id === id);
    if (index !== -1) this.documents.splice(index, 1);
  }

  getDocument(id) {
    return this.documents.find((d) => d.id === id);
  }

  getNextPending() {
    return this.documents.find((d) => d.status === "pending");
  }

  getAllCompleted() {
    return this.documents.filter((d) => d.status === "completed");
  }

  getTotalStats() {
    return {
      total: this.documents.length,
      pending: this.documents.filter((d) => d.status === "pending").length,
      processing: this.documents.filter((d) => d.status === "processing").length,
      completed: this.documents.filter((d) => d.status === "completed").length,
      errors: this.documents.filter((d) => d.status === "error").length
    };
  }

  generateId() {
    return "doc-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
  }

  clear() {
    this.documents = [];
    this.currentIndex = -1;
  }
}

class PersistentMapper {
  constructor(maintainConsistency = true) {
    this.maintainConsistency = maintainConsistency;
    this.globalMappings = new Map();
    this.documentMappings = new Map();
  }

  reset() {
    if (!this.maintainConsistency) {
      this.globalMappings.clear();
    }
  }

  getOrCreateMapping(original, docId, generatorFn) {
    const key = original.toLowerCase().trim();
    if (this.maintainConsistency && this.globalMappings.has(key)) {
      return this.globalMappings.get(key);
    }

    const mapped = generatorFn();
    if (this.maintainConsistency) {
      this.globalMappings.set(key, mapped);
    }

    if (!this.documentMappings.has(docId)) {
      this.documentMappings.set(docId, new Map());
    }
    this.documentMappings.get(docId).set(key, mapped);
    return mapped;
  }

  getAllMappings() {
    return Array.from(this.globalMappings.entries());
  }
}

window.BatchModule = {
  queue: null,
  mapper: null,
  progressCallback: null,
  processorOptions: {},

  initialize(maintainConsistency = true, onProgress = null, processorOptions = {}) {
    this.queue = new BatchQueue();
    this.mapper = new PersistentMapper(maintainConsistency);
    this.progressCallback = onProgress;
    this.processorOptions = processorOptions && typeof processorOptions === "object"
      ? processorOptions
      : {};
  },

  // Unified API.
  async process(filesOrTable, modeConfig = {}) {
    const mode = modeConfig.mode || "documents";
    if (mode === "documents") {
      const files = Array.isArray(filesOrTable) ? filesOrTable : [];
      this.initialize(
        modeConfig.maintainConsistency !== false,
        modeConfig.onProgress || null,
        modeConfig.processorOptions || {}
      );
      files.forEach((file) => this.queue.addDocument(file));
      return this.processAll();
    }

    if (mode === "structured") {
      return this.processStructured(filesOrTable, modeConfig);
    }

    throw new Error("Modo batch no soportado: " + mode);
  },

  async processAll() {
    const stats = this.queue.getTotalStats();
    let processed = 0;

    while (true) {
      const doc = this.queue.getNextPending();
      if (!doc) break;

      try {
        doc.status = "processing";
        this.notifyProgress(processed, stats.total, doc);

        const text = await this.readFile(doc.file);
        const originalObtenerSustituto = AsignadorSustitutos.obtenerSustituto.bind(AsignadorSustitutos);

        AsignadorSustitutos.obtenerSustituto = (nombreOriginal, genero) => {
          return this.mapper.getOrCreateMapping(
            nombreOriginal,
            doc.id,
            () => originalObtenerSustituto(nombreOriginal, genero)
          );
        };

        const startTime = performance.now();
        const result = window.PrivacyProcessor.process(text, this.processorOptions);
        const endTime = performance.now();

        AsignadorSustitutos.obtenerSustituto = originalObtenerSustituto;

        doc.result = result;
        doc.status = "completed";
        doc.processingTime = Math.round(endTime - startTime);

        processed++;
        this.notifyProgress(processed, stats.total, doc);
      } catch (error) {
        doc.status = "error";
        doc.errors.push(error.message);
        console.error("Error procesando " + doc.name + ":", error);

        processed++;
        this.notifyProgress(processed, stats.total, doc);
      }

      if (!this.mapper.maintainConsistency) {
        AsignadorSustitutos.reset();
      }
      doc.file = null;
    }

    return this.queue.getAllCompleted();
  },

  // Structured mode adapter.
  async processStructured(input, modeConfig = {}) {
    if (typeof FileProcessor === "undefined") {
      throw new Error("FileProcessor no esta cargado para modo estructurado.");
    }

    if (input && input.headers && input.rows && modeConfig.config) {
      const processor = new FileProcessor();
      return processor.process(input, modeConfig.config);
    }

    if (typeof File !== "undefined" && input instanceof File) {
      if (typeof StructuredFileReader === "undefined") {
        throw new Error("StructuredFileReader no esta cargado.");
      }
      const reader = new StructuredFileReader();
      const parsed = await reader.read(input);
      if (!modeConfig.config) {
        throw new Error("Falta modeConfig.config para procesado estructurado.");
      }
      const processor = new FileProcessor();
      return processor.process(parsed, modeConfig.config);
    }

    throw new Error("Entrada estructurada no valida para BatchModule.process.");
  },

  async readFile(file) {
    if (!file) throw new Error("No file provided");

    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "txt") {
      return file.text();
    }
    if (ext === "pdf") {
      return this.readPDF(file);
    }
    if (ext === "docx" || ext === "doc") {
      return this.readDOCX(file);
    }
    throw new Error("Formato no soportado: " + ext);
  },

  async readPDF(file) {
    if (typeof pdfjsLib === "undefined") {
      throw new Error("PDF.js no esta cargado");
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ");
      fullText += pageText + "\n\n";
    }
    return fullText.trim();
  },

  async readDOCX(file) {
    if (typeof mammoth === "undefined") {
      throw new Error("Mammoth.js no esta cargado");
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
        percentage: total > 0 ? Math.round((current / total) * 100) : 0,
        currentDoc: doc
      });
    }
  },

  getQueueStats() {
    return this.queue ? this.queue.getTotalStats() : null;
  },

  getMapper() {
    return this.mapper;
  },

  clearQueue() {
    if (this.queue) this.queue.clear();
  }
};

// Backward-compatible alias for legacy code paths.
window.BatchProcessor = window.BatchModule;
