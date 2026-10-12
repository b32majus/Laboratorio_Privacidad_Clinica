/**
 * Presentation-only Spanish wording for user-facing domain failure/diagnostic
 * messages (Issue #90, REC-10).
 *
 * The domain modules (`input/extract`, `engine/input-limits`, `structured/*`)
 * stay the single authority for WHICH failure applies and for every fact it
 * carries; this helper only maps their exact end-user sentences to professional
 * Spanish at the rendering boundary (handoff: "prefer string replacement at
 * rendering boundary when downstream domain reason/code messages are English;
 * do not alter domain-derived branching"). No failure semantics are re-derived
 * here and no domain module is touched.
 *
 * Embedded data is preserved verbatim: file/sheet names, quoted formats, row
 * numbers, character counts and any wrapped cause. An unrecognized sentence is
 * returned unchanged, so a future or technical domain message can never be
 * silently swallowed by this mapping.
 */
export function localizeDomainErrorMessage(message: string): string {
  // ── Pasted text (input/extract) ────────────────────────────────────────
  if (message === "Pasted text is empty; provide text before creating a job.") {
    return "El texto pegado está vacío; escriba o pegue texto antes de crear el trabajo.";
  }

  // ── TXT (input/extract) ────────────────────────────────────────────────
  let match = /^The TXT file "(.*)" could not be read\.$/.exec(message);
  if (match) return `No se pudo leer el archivo TXT "${match[1]}".`;
  match = /^The TXT file "(.*)" is empty; provide a file with content\.$/.exec(message);
  if (match) return `El archivo TXT "${match[1]}" está vacío; use un archivo con contenido.`;

  // ── DOCX (input/extract) ───────────────────────────────────────────────
  match = /^The DOCX file "(.*)" could not be read\.$/.exec(message);
  if (match) return `No se pudo leer el archivo DOCX "${match[1]}".`;
  match = /^The DOCX file "(.*)" contains no extractable text\.$/.exec(message);
  if (match) return `El archivo DOCX "${match[1]}" no contiene texto extraíble.`;
  match =
    /^The DOCX file "(.*)" could not be parsed; it may be corrupt or not a valid DOCX document\.$/.exec(
      message
    );
  if (match) {
    return `No se pudo interpretar el archivo DOCX "${match[1]}"; puede estar dañado o no ser un documento DOCX válido.`;
  }

  // ── PDF (input/extract) ────────────────────────────────────────────────
  match = /^The PDF file "(.*)" could not be read\.$/.exec(message);
  if (match) return `No se pudo leer el archivo PDF "${match[1]}".`;
  if (
    message === "The PDF contains no extractable text; it is likely a scan or has no text layer."
  ) {
    return "El PDF no contiene texto extraíble: probablemente sea un escaneo o no tenga capa de texto.";
  }
  match =
    /^The PDF file "(.*)" could not be parsed; it may be corrupt or not a valid PDF document\.$/.exec(
      message
    );
  if (match) {
    return `No se pudo interpretar el archivo PDF "${match[1]}"; puede estar dañado o no ser un documento PDF válido.`;
  }

  // ── Unsupported formats (input/extract) ────────────────────────────────
  if (
    message ===
    'Legacy Word ".doc" files are not supported; convert the document to DOCX or TXT and try again. Supported types: TXT, PDF, DOCX.'
  ) {
    return 'Los archivos heredados de Word ".doc" no son compatibles; convierta el documento a DOCX o TXT e inténtelo de nuevo. Formatos admitidos: TXT, PDF, DOCX.';
  }
  match =
    /^The file "(.*)" has an unsupported type "(.*)"; supported types: TXT, PDF, DOCX\.$/.exec(
      message
    );
  if (match) {
    return `El archivo "${match[1]}" tiene un tipo no admitido "${match[2]}"; formatos admitidos: TXT, PDF, DOCX.`;
  }

  // ── Supported-size authority (engine/input-limits) ─────────────────────
  match =
    /^Input text is (\d+) characters; this build supports up to (\d+) characters per document\. Split the text into parts of at most (\d+) characters and process each part as its own job\.$/.exec(
      message
    );
  if (match) {
    return `El texto de entrada tiene ${match[1]} caracteres; esta versión admite hasta ${match[2]} caracteres por documento. Divida el texto en partes de como máximo ${match[3]} caracteres y procese cada parte como su propio trabajo.`;
  }

  // ── Structured intake (structured/intake) ──────────────────────────────
  match = /^The structured file "(.*)" could not be read\.$/.exec(message);
  if (match) return `No se pudo leer el archivo estructurado "${match[1]}".`;
  match = /^The Excel reader could not be loaded: (.*)$/.exec(message);
  if (match) return `No se pudo cargar el lector de Excel: ${localizeDomainErrorMessage(match[1])}`;
  if (message === "The Excel reader could not be loaded.") {
    return "No se pudo cargar el lector de Excel.";
  }
  match = /^The file "(.*)" is not a supported structured type \(CSV, XLS, XLSX\)\.$/.exec(message);
  if (match)
    return `El archivo "${match[1]}" no es un tipo estructurado admitido (CSV, XLS, XLSX).`;

  // ── CSV parsing (structured/csv) ───────────────────────────────────────
  if (message === "The CSV input is empty.") return "La entrada CSV está vacía.";
  if (message === "The CSV input contains no data records.") {
    return "La entrada CSV no contiene registros de datos.";
  }
  if (message === "The CSV input ends inside an unterminated quoted field.") {
    return "La entrada CSV termina dentro de un campo entrecomillado sin cerrar.";
  }

  // ── Workbook parsing (structured/excel, structured/header-row) ─────────
  if (message === "The Excel file contains no sheets.") {
    return "El archivo de Excel no contiene hojas.";
  }
  if (message === "No Excel sheet was selected: an explicit sheet is required.") {
    return "No se seleccionó ninguna hoja de Excel: se requiere una hoja explícita.";
  }
  match = /^Sheet "(.*)" does not exist in this Excel file\. Available sheets: (.*)\.$/.exec(
    message
  );
  if (match) {
    return `La hoja "${match[1]}" no existe en este archivo de Excel. Hojas disponibles: ${match[2]}.`;
  }
  match =
    /^The worksheet "(.*)" has no clear header row in the first (\d+) rows\. Choose the header row explicitly\.$/.exec(
      message
    );
  if (match) {
    return `La hoja "${match[1]}" no tiene una fila de encabezado clara en las primeras ${match[2]} filas. Elija la fila de encabezado explícitamente.`;
  }
  match =
    /^The worksheet "(.*)" has several rows that look like headers \((.*)\)\. Choose the header row explicitly; the first row is never assumed\.$/.exec(
      message
    );
  if (match) {
    const rows = match[2].replace(/row (\d+)/g, "fila $1");
    return `La hoja "${match[1]}" tiene varias filas que parecen encabezados (${rows}). Elija la fila de encabezado explícitamente; nunca se presupone la primera fila.`;
  }
  if (message === "No header rows are available for explicit selection in this worksheet.") {
    return "No hay filas de encabezado disponibles para selección explícita en esta hoja.";
  }
  match =
    /^The selected header row is invalid: choose one of the inspected rows 1 to (\d+)\.$/.exec(
      message
    );
  if (match) {
    return `La fila de encabezado seleccionada no es válida: elija una de las filas inspeccionadas de la 1 a la ${match[1]}.`;
  }

  // ── Governed SheetJS loader (structured/xlsx-loader) ───────────────────
  if (message === "SheetJS was loaded but window.XLSX is unavailable.") {
    return "Se cargó SheetJS, pero window.XLSX no está disponible.";
  }
  match = /^SheetJS could not be loaded from (.*)\.$/.exec(message);
  if (match) return `No se pudo cargar SheetJS desde ${match[1]}.`;

  return message;
}
