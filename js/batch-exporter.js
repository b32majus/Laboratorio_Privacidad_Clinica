// ==================== EXPORTADOR PDF CONSOLIDADO ====================
async function exportConsolidatedPDF(documents, mapperData) {
  if (typeof jsPDF === 'undefined') {
    alert('jsPDF no está cargado');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;
  const margin = 20;

  // === PORTADA ===
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(5, 150, 105);
  doc.text("Informe Batch - Anonimización Clínica", margin, y);
  y += 15;

  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Total de documentos: ${documents.length}`, margin, y);
  y += 8;
  doc.text(`Fecha de procesamiento: ${new Date().toLocaleDateString('es-ES')}`, margin, y);
  y += 8;
  doc.text(`Consistencia entre docs: ${mapperData ? 'Sí' : 'No'}`, margin, y);
  y += 15;

  // === ÍNDICE NAVEGABLE ===
  doc.addPage();
  y = 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(5, 150, 105);
  doc.text("Índice de Documentos", margin, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0);

  documents.forEach((document, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    doc.text(`${idx + 1}. ${document.name}`, margin + 5, y);
    doc.text(`Entidades: ${document.result.stats.totalEntities}`, margin + 100, y);
    y += 7;
  });

  // === TABLA DE MAPEO GLOBAL ===
  if (mapperData && mapperData.globalMappings && mapperData.globalMappings.length > 0) {
    doc.addPage();
    y = 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(5, 150, 105);
    doc.text("Tabla de Mapeo Global", margin, y);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text("Mapeos utilizados en todos los documentos del batch:", margin, y);
    y += 8;

    // Encabezados
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, 170, 8, 'F');
    doc.text("Original", margin + 2, y);
    doc.text("Transformado", margin + 90, y);
    y += 8;

    // Filas
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0);

    mapperData.globalMappings.forEach(([original, transformed]) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.text(original.substring(0, 35), margin + 2, y);
      doc.text(transformed.substring(0, 35), margin + 90, y);
      y += 6;
    });
  }

  // === DOCUMENTOS INDIVIDUALES ===
  documents.forEach((document, idx) => {
    doc.addPage();
    y = 20;

    // Título del documento
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(5, 150, 105);
    doc.text(`Documento ${idx + 1}: ${document.name}`, margin, y);
    y += 10;

    // Estadísticas
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Entidades detectadas: ${document.result.stats.totalEntities}`, margin, y);
    y += 6;
    doc.text(`Tiempo de procesamiento: ${document.result.processingTime}ms`, margin, y);
    y += 10;

    // Texto procesado (preview)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const textLines = doc.splitTextToSize(document.result.processed.substring(0, 2000), 170);

    textLines.slice(0, 40).forEach(line => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += 4;
    });

    // Tabla de entidades
    if (document.result.entities.length > 0) {
      doc.addPage();
      y = 20;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(5, 150, 105);
      doc.text(`Tabla de Transformaciones - ${document.name}`, margin, y);
      y += 10;

      // Encabezados
      doc.setFont("helvetica", "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 4, 170, 8, 'F');
      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text("Original", margin + 2, y);
      doc.text("Transformado", margin + 60, y);
      doc.text("Tipo", margin + 120, y);
      y += 8;

      // Filas
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      document.result.entities.forEach((entity) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        const originalText = (entity.original || entity.text || '').substring(0, 25);
        const transformedText = (entity.transformed || '').substring(0, 25);
        const typeText = entity.type.substring(0, 10);

        doc.text(originalText, margin + 2, y);
        doc.text(transformedText, margin + 60, y);
        doc.text(typeText, margin + 120, y);
        y += 6;
      });
    }
  });

  // === CERTIFICACIÓN ===
  doc.addPage();
  y = 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(5, 150, 105);
  doc.text("Certificación de Procesamiento Batch", margin, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0);
  const certText = [
    "Este informe certifica que los documentos clínicos han sido procesados mediante el",
    "Sanitizador Clínico (Modo Batch Premium) desarrollado por Sophilux.",
    "",
    "El procesamiento batch garantiza:",
    "• Consistencia en mapeos entre documentos (si configurado)",
    "• Trazabilidad completa de transformaciones",
    "• Revisión humana de cada documento",
    "• Exportación consolidada con índice navegable"
  ];

  certText.forEach(line => {
    doc.text(line, margin, y);
    y += 5;
  });

  y = 285;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Generado automáticamente - La responsabilidad final recae en el usuario", margin, y);

  // Guardar
  doc.save(`informe-batch-${Date.now()}.pdf`);
}

// ==================== EXPORTADOR PDFs INDIVIDUALES ====================
async function exportIndividualPDFs(documents) {
  if (typeof JSZip === 'undefined') {
    alert('JSZip no está cargado. No se pueden crear PDFs individuales.');
    return;
  }

  const zip = new JSZip();

  for (let i = 0; i < documents.length; i++) {
    const document = documents[i];
    const pdf = await generateSinglePDF(document, i + 1);

    // Convertir PDF a blob
    const pdfBlob = pdf.output('blob');

    // Añadir al ZIP
    const filename = document.name.replace(/\.[^.]+$/, '') + '_anonimizado.pdf';
    zip.file(filename, pdfBlob);
  }

  // Generar y descargar ZIP
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `batch-pdfs-${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

async function generateSinglePDF(document, docNumber) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const margin = 20;
  let y = 20;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(5, 150, 105);
  doc.text("Informe de Privacidad Clínica", margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Laboratorio de Privacidad Clínica by Sophilux", margin, y);
  y += 15;

  // Info de Sesión
  doc.setDrawColor(200);
  doc.line(margin, y, 190, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(`Documento: ${document.name}`, margin, y);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, margin + 80, y);
  y += 8;
  doc.text(`Total Entidades: ${document.result.stats.totalEntities}`, margin, y);
  y += 15;

  // Resumen de Entidades
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 5, 170, 25, 'F');
  doc.setFont("helvetica", "bold");
  doc.text("Resumen de Detección", margin + 5, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const stats = document.result.stats.byType || {};
  doc.text(`• Nombres/Profesionales: ${stats.nombres || 0}`, margin + 10, y);
  doc.text(`• Identificadores: ${stats.identificadores || 0}`, margin + 90, y);
  y += 6;
  doc.text(`• Ubicaciones: ${stats.ubicaciones || 0}`, margin + 10, y);
  doc.text(`• Fechas/Edades: ${stats.fechas || 0}`, margin + 90, y);
  y += 20;

  // Tabla de transformaciones (simplificada)
  if (y > 240) { doc.addPage(); y = 20; }

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(5, 150, 105);
  doc.text("Tabla de Transformaciones", margin, y);
  y += 10;

  // Encabezados de la tabla
  doc.setFont("helvetica", "bold");
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 4, 170, 8, 'F');
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text("Original", margin + 2, y);
  doc.text("Transformado", margin + 60, y);
  doc.text("Tipo", margin + 120, y);
  y += 8;

  // Líneas de la tabla
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  let tableRowCount = 0;
  const maxRowsPerPage = 20;

  document.result.entities.forEach((entity) => {
    if (tableRowCount >= maxRowsPerPage || y > 270) {
      doc.addPage();
      y = 20;
      tableRowCount = 0;

      // Repetir encabezados
      doc.setFont("helvetica", "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 4, 170, 8, 'F');
      doc.setFontSize(9);
      doc.text("Original", margin + 2, y);
      doc.text("Transformado", margin + 60, y);
      doc.text("Tipo", margin + 120, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
    }

    if (tableRowCount % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 4, 170, 6, 'F');
    }

    const originalText = (entity.original || entity.text || '').substring(0, 25);
    const transformedText = (entity.transformed || '').substring(0, 25);
    const typeText = entity.type.substring(0, 10);

    doc.text(originalText, margin + 2, y);
    doc.text(transformedText, margin + 60, y);
    doc.text(typeText, margin + 120, y);

    y += 6;
    tableRowCount++;
  });

  // Footer
  doc.addPage();
  y = 20;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont("helvetica", "bold");
  doc.text("Certificación de Proceso", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const certText = [
    "Este informe certifica que el texto clínico adjunto ha sido procesado mediante el",
    "Sanitizador Clínico desarrollado por Sophilux, aplicando técnicas de anonimización",
    "automatizadas conforme a los principios del RGPD y LOPDGDD."
  ];

  certText.forEach(line => {
    doc.text(line, margin, y);
    y += 5;
  });

  y = 285;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Generado automáticamente - La responsabilidad final recae en el usuario", margin, y);

  return doc;
}

// ==================== EXPORTADOR EXCEL/CSV ====================
function exportExcel(documents) {
  // Crear tabla con filas por documento
  const rows = [
    ['Nombre', 'Entidades Detectadas', 'Nombres', 'Fechas', 'Ubicaciones', 'Identificadores', 'Sospechosos', 'Tiempo (ms)', 'Estado']
  ];

  documents.forEach(doc => {
    const stats = doc.result.stats.byType || {};

    rows.push([
      doc.name,
      doc.result.stats.totalEntities,
      stats.nombres || 0,
      stats.fechas || 0,
      stats.ubicaciones || 0,
      stats.identificadores || 0,
      stats.sospechosos || 0,
      doc.result.processingTime,
      doc.reviewed ? 'Revisado' : 'Pendiente'
    ]);
  });

  // Convertir a CSV
  const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

  // Descargar
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM para Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `batch-resumen-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Exportar funciones
window.BatchExporter = {
  exportConsolidatedPDF,
  exportIndividualPDFs,
  exportExcel
};
