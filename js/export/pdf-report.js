/**
 * Genera un informe PDF de la sesión de procesamiento
 * Requiere jsPDF cargado globalmente
 */
export class PDFReportGenerator {
    constructor() {
        // jsPDF se carga como UMD global
        this.jsPDF = window.jspdf.jsPDF;
    }

    /**
     * Genera el PDF del informe
     * @param {Object} processingResult - Resultado del Processor.process()
     * @returns {void} - Descarga automáticamente el PDF
     */
    generate(processingResult) {
        const doc = new this.jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let y = margin;

        // === HEADER ===
        doc.setFontSize(10);
        doc.setTextColor(184, 138, 127); // oro-rosa
        doc.text('SOPHILUX', margin, y);

        y += 15;

        // Título
        doc.setFontSize(18);
        doc.setTextColor(45, 41, 38);
        doc.text('INFORME DE SESIÓN', margin, y);

        y += 8;
        doc.setFontSize(12);
        doc.setTextColor(107, 99, 93);
        doc.text('Laboratorio de Privacidad Clínica', margin, y);

        y += 15;

        // === LÍNEA SEPARADORA ===
        doc.setDrawColor(232, 228, 224);
        doc.line(margin, y, pageWidth - margin, y);

        y += 10;

        // === METADATOS ===
        doc.setFontSize(10);
        doc.setTextColor(107, 99, 93);
        doc.text(`Fecha de procesamiento: ${this.formatDate(new Date())}`, margin, y);
        y += 6;
        doc.text(`ID de sesión: ${processingResult.sessionId}`, margin, y);
        y += 6;
        doc.text(`Tiempo de procesamiento: ${processingResult.processingTime}ms`, margin, y);

        y += 15;

        // === RESUMEN DE TRANSFORMACIONES ===
        doc.setFontSize(12);
        doc.setTextColor(45, 41, 38);
        doc.text('RESUMEN DE TRANSFORMACIONES', margin, y);

        y += 10;

        // Tabla simple de estadísticas
        const stats = processingResult.stats;
        doc.setFontSize(10);
        doc.setTextColor(107, 99, 93);

        doc.text(`• Nombres sustituidos: ${stats.byType.nombres || 0}`, margin + 5, y);
        y += 6;
        doc.text(`• Fechas relativizadas: ${stats.byType.fechas || 0}`, margin + 5, y);
        y += 6;
        doc.text(`• Identificadores eliminados: ${stats.byType.identificadores || 0}`, margin + 5, y);
        y += 6;
        doc.text(`• Ubicaciones generalizadas: ${stats.byType.ubicaciones || 0}`, margin + 5, y);
        y += 6;
        doc.text(`• Total de entidades: ${stats.totalEntities}`, margin + 5, y);

        y += 15;

        // === LISTA DE ENTIDADES ===
        if (processingResult.entities.length > 0) {
            doc.setFontSize(12);
            doc.setTextColor(45, 41, 38);
            doc.text('DETALLE DE TRANSFORMACIONES', margin, y);
            y += 10;

            doc.setFontSize(9);
            processingResult.entities.slice(0, 15).forEach((entity, index) => {
                if (y > 250) { // Nueva página si es necesario
                    doc.addPage();
                    y = margin;
                }

                doc.setTextColor(45, 41, 38);
                doc.text(`${index + 1}. [${entity.type}] "${entity.original}" → "${entity.transformed}"`, margin, y);
                y += 6;
            });

            if (processingResult.entities.length > 15) {
                y += 4;
                doc.setTextColor(107, 99, 93);
                doc.text(`... y ${processingResult.entities.length - 15} más`, margin, y);
                y += 10;
            }
        }

        y += 10;

        // === AVISO IMPORTANTE ===
        if (y > 220) {
            doc.addPage();
            y = margin;
        }

        doc.setDrawColor(232, 228, 224);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;

        doc.setFontSize(10);
        doc.setTextColor(45, 41, 38);
        doc.text('AVISO IMPORTANTE', margin, y);
        y += 8;

        doc.setFontSize(9);
        doc.setTextColor(107, 99, 93);
        const aviso = [
            'Este informe documenta el procesamiento realizado pero NO garantiza',
            'la anonimización completa del texto. La responsabilidad final de verificar',
            'la adecuación del resultado recae en el profesional usuario.',
            '',
            'Esta herramienta es un asistente de aprendizaje,',
            'no un sistema certificado de anonimización.'
        ];

        aviso.forEach(line => {
            doc.text(line, margin, y);
            y += 5;
        });

        // === FOOTER ===
        const pageHeight = doc.internal.pageSize.getHeight();
        y = pageHeight - 20;
        doc.setDrawColor(232, 228, 224);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        doc.setFontSize(8);
        doc.setTextColor(155, 149, 143);
        doc.text('Generado por Laboratorio de Privacidad Clínica', margin, y);
        doc.text('© 2024 Sophilux', pageWidth - margin - 30, y);

        // Descargar
        const filename = `informe-privacidad-${processingResult.sessionId}.pdf`;
        doc.save(filename);
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }
}
