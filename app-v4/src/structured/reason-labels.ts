/**
 * Presentation-only Spanish wording for the structured preparation's
 * fail-closed block reasons.
 *
 * The structured preparation module (`transformed-dataset`) stays the single
 * authority for WHICH block reasons apply and for every fact they carry; this
 * helper only maps its exact end-user sentences to professional Spanish at the
 * rendering boundary (handoff: "prefer string replacement at rendering
 * boundary when downstream domain reason messages are English; do not alter
 * domain-derived branching"). No reason semantics are re-derived here.
 *
 * Embedded data is preserved verbatim: column headers, quoted Study-ID /
 * visit-number safe headers, technical policy ids, row/cell numbers and any
 * typed failure message. An unrecognized sentence is returned unchanged, so a
 * future domain reason can never be silently swallowed by this mapping.
 */
export function localizeStructuredBlockReason(reason: string): string {
  let match = /^Structured export is blocked while 1 column requires review\.$/.exec(reason);
  if (match) {
    return "La salida estructurada está bloqueada mientras 1 columna requiere revisión.";
  }
  match = /^Structured export is blocked while (\d+) columns require review\.$/.exec(reason);
  if (match) {
    return `La salida estructurada está bloqueada mientras ${match[1]} columnas requieren revisión.`;
  }
  match =
    /^Structured export is blocked: column "(.*)" has no accepted structured transformation\.$/.exec(
      reason
    );
  if (match) {
    return `La salida estructurada está bloqueada: la columna "${match[1]}" no tiene una transformación estructurada aceptada.`;
  }
  match =
    /^Structured export is blocked: column "(.*)" uses an action with no structured operator\.$/.exec(
      reason
    );
  if (match) {
    return `La salida estructurada está bloqueada: la columna "${match[1]}" usa una acción sin operador estructurado.`;
  }
  match =
    /^Structured export is blocked: policy "(.*)" shifts visit dates per patient and no patient-ID column is selected\.$/.exec(
      reason
    );
  if (match) {
    return `La salida estructurada está bloqueada: la política "${match[1]}" desplaza las fechas de visita por paciente y no se ha seleccionado ninguna columna de ID de paciente.`;
  }
  match =
    /^Structured export is blocked: Safe header "(.*)" is already used by another input column "(.*)"; the Study-ID column is never written over it silently\.$/.exec(
      reason
    );
  if (match) {
    return `La salida estructurada está bloqueada: el encabezado seguro "${match[1]}" ya lo usa otra columna de entrada "${match[2]}"; la columna de ID de estudio nunca se escribe sobre él en silencio.`;
  }
  match =
    /^Structured export is blocked: Safe header "(.*)" is already used by another input column "(.*)"; the visit-number column is never written over it silently\.$/.exec(
      reason
    );
  if (match) {
    return `La salida estructurada está bloqueada: el encabezado seguro "${match[1]}" ya lo usa otra columna de entrada "${match[2]}"; la columna de número de visita nunca se escribe sobre él en silencio.`;
  }
  match =
    /^Structured export is blocked: data row (\d+) has other data but no value in the patient-ID column "(.*)"; an unlinkable Safe row is never produced\.$/.exec(
      reason
    );
  if (match) {
    return `La salida estructurada está bloqueada: la fila de datos ${match[1]} tiene otros datos pero ningún valor en la columna de ID de paciente "${match[2]}"; nunca se produce una fila segura no vinculable.`;
  }
  match =
    /^Structured export is blocked: Structured output option "study-ID prefix" is invalid: "(.*)" must start with a letter and contain only letters and digits \(up to 10 characters\); fix it instead of exporting with a guessed token\.$/.exec(
      reason
    );
  if (match) {
    return `La salida estructurada está bloqueada: la opción de salida "prefijo de ID de estudio" no es válida: "${match[1]}" debe empezar por una letra y contener solo letras y dígitos (hasta 10 caracteres); corríjala en lugar de exportar con un identificador supuesto.`;
  }
  match =
    /^Structured export is blocked: 1 date\/age cell requires review \(unparseable or without the required reference\)\.$/.exec(
      reason
    );
  if (match) {
    return "La salida estructurada está bloqueada: 1 celda de fecha/edad requiere revisión (no se puede interpretar o carece de la referencia requerida).";
  }
  match =
    /^Structured export is blocked: (\d+) date\/age cells require review \(unparseable or without the required reference\)\.$/.exec(
      reason
    );
  if (match) {
    return `La salida estructurada está bloqueada: ${match[1]} celdas de fecha/edad requieren revisión (no se pueden interpretar o carecen de la referencia requerida).`;
  }
  match =
    /^Structured export is blocked: free-text column\(s\) (.*) have not been processed through the text engine yet; Safe output cannot be produced from unreviewed cells\.$/.exec(
      reason
    );
  if (match) {
    return `La salida estructurada está bloqueada: las columnas de texto libre ${match[1]} todavía no se han procesado con el motor de texto; la salida segura no se puede producir a partir de celdas sin revisar.`;
  }
  match =
    /^Structured export is blocked: the free-text review was processed under policy "(.*)" but the current policy is "(.*)"; reprocess the free-text cells under the current policy\.$/.exec(
      reason
    );
  if (match) {
    return `La salida estructurada está bloqueada: la revisión de texto libre se procesó con la política "${match[1]}" pero la política actual es "${match[2]}"; reprocese las celdas de texto libre con la política actual.`;
  }
  match =
    /^Structured export is blocked: the free-text review no longer matches the current column configuration; reprocess the free-text cells before export\.$/.exec(
      reason
    );
  if (match) {
    return "La salida estructurada está bloqueada: la revisión de texto libre ya no coincide con la configuración de columnas actual; reprocese las celdas de texto libre antes de la descarga.";
  }
  match =
    /^Structured export is blocked: free-text cell \["(.*)", row (\d+)\] failed processing \((.*)\); resolve it instead of keeping the original\.$/.exec(
      reason
    );
  if (match) {
    return `La salida estructurada está bloqueada: la celda de texto libre ["${match[1]}", fila ${match[2]}] no se pudo procesar (${match[3]}); resuélvala en lugar de conservar el original.`;
  }
  match =
    /^Structured export is blocked: free-text cell \["(.*)", row (\d+)\] still requires review; complete every mandatory decision first\.$/.exec(
      reason
    );
  if (match) {
    return `La salida estructurada está bloqueada: la celda de texto libre ["${match[1]}", fila ${match[2]}] todavía requiere revisión; complete antes cada decisión obligatoria.`;
  }
  match =
    /^Structured export is blocked: (\d+) free-text cells still require review; complete every mandatory decision first\.$/.exec(
      reason
    );
  if (match) {
    return `La salida estructurada está bloqueada: ${match[1]} celdas de texto libre todavía requieren revisión; complete antes cada decisión obligatoria.`;
  }
  return reason;
}

/**
 * Presentation-only Spanish wording for the per-column inference evidence the
 * inspector shows behind its disclosure. `column-profile`/`classification`
 * stay the authority for WHICH evidence entries apply and for every fact they
 * carry (counts, inferred type, matched header/content label); this helper only
 * maps their exact end-user sentences and labels to professional Spanish at the
 * rendering boundary. Embedded numbers and labels are preserved; an
 * unrecognized entry is returned unchanged.
 */
const INFERRED_TYPE_LABELS_ES: Record<string, string> = {
  number: "número",
  date: "fecha",
  boolean: "booleano",
  text: "texto",
  empty: "vacío",
};

const EVIDENCE_LABEL_ES: Record<string, string> = {
  "patient-ID-like header (NHC/historia/identificador de paciente)":
    "encabezado de tipo ID de paciente (NHC/historia/identificador de paciente)",
  "name header": "encabezado de nombre",
  "surname header": "encabezado de apellido",
  "full-name header": "encabezado de nombre completo",
  "national-ID header": "encabezado de documento de identidad",
  "phone header": "encabezado de teléfono",
  "email header": "encabezado de correo electrónico",
  "address header": "encabezado de dirección",
  "clinician header": "encabezado de profesional clínico",
  "birth-date header": "encabezado de fecha de nacimiento",
  "visit-date header": "encabezado de fecha de visita",
  "postal-code header": "encabezado de código postal",
  "center/ward header": "encabezado de centro/sala",
  "clinical-content header": "encabezado de contenido clínico",
  "DNI/NIE-like content": "contenido de tipo DNI/NIE",
  "Spanish phone-like content": "contenido de tipo teléfono español",
  "email-like content": "contenido de tipo correo electrónico",
  "numeric record-ID-like content": "contenido de tipo ID de registro numérico",
};

function localizeEvidenceLabel(label: string): string {
  return EVIDENCE_LABEL_ES[label] ?? label;
}

export function localizeStructuredEvidence(evidence: string): string {
  let match = /^(\d+) data row\(s\)$/.exec(evidence);
  if (match) return `${match[1]} fila(s) de datos`;
  match = /^(\d+) non-empty \/ (\d+) blank value\(s\)$/.exec(evidence);
  if (match) return `${match[1]} valor(es) con datos / ${match[2]} en blanco`;
  match = /^(\d+) non-empty value\(s\) sampled across the column$/.exec(evidence);
  if (match) return `${match[1]} valor(es) con datos muestreado(s) en toda la columna`;
  match = /^inferred (\w+): (\d+)\/(\d+) sampled value\(s\) consistent$/.exec(evidence);
  if (match) {
    const type = INFERRED_TYPE_LABELS_ES[match[1]] ?? match[1];
    return `tipo inferido ${type}: ${match[2]}/${match[3]} valor(es) muestreado(s) coherente(s)`;
  }
  if (evidence === "no non-empty values to infer from") {
    return "no hay valores con datos para inferir";
  }
  if (evidence === "no header-pattern or content evidence") {
    return "sin evidencia de patrón de encabezado ni de contenido";
  }
  match = /^header matches (.*) but the column has no non-empty values to support it$/.exec(
    evidence
  );
  if (match) {
    return `el encabezado coincide con ${localizeEvidenceLabel(match[1])} pero la columna no tiene valores con datos que lo respalden`;
  }
  match = /^header matches (.*)$/.exec(evidence);
  if (match) return `el encabezado coincide con ${localizeEvidenceLabel(match[1])}`;
  match = /^(.*) in the distributed sample$/.exec(evidence);
  if (match) return `${localizeEvidenceLabel(match[1])} en la muestra distribuida`;
  return evidence;
}
