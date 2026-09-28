/**
 * Column classification for V4 structured ingestion (T18 #22, SPEC_V4_BATCH_
 * AND_STRUCTURED.md §5, CURRENT_DECISIONS D-012, DEBT STRUCT-001).
 *
 * SPEC §5: every column is assigned one of Identifier, Quasi-Identifier,
 * Sensitive, Insensitive, Unknown / Review Required, and "UNKNOWN is not
 * KEEP". The UI may propose a class/action with confidence, but the human
 * must be able to review and change it.
 *
 * Boundary of this module (deliberately narrow):
 *  - It proposes classes/actions as review foundations; it is NOT the
 *    privacy-policy authority (per-category operator mappings under accepted
 *    policies remain a later accepted policy decision, D-007/D-010).
 *  - `unknown` ALWAYS yields `review-required` and NEVER `keep`
 *    (D-009 fail-closed). This is the only hard rule enforced here.
 *  - No column is automatically classified `insensitive`: that class exists
 *    in the model for explicit human review decisions, not for a default
 *    guess (fail-closed).
 *  - No column carries patient-ID semantics here: the single patient-ID
 *    authority is `patient-id.ts` (STRUCT-002).
 *
 * Sensitive content is memory-only (D-013): sampled values are used only to
 * derive content evidence in-process and are never persisted, logged, or
 * embedded in the classification result.
 */
import { sampleColumnValues, type ColumnProfile, profileColumns } from "./column-profile";
import { isBlankCell, type StructuredCell, type StructuredGrid } from "./grid";

export type ColumnClass =
  "identifier" | "quasi-identifier" | "sensitive" | "insensitive" | "unknown";

/**
 * Review-facing action proposal. `review-required` is the fail-closed
 * disposition: a human must decide before any use of the column.
 */
export type ProposedAction =
  "remove" | "pseudonymize" | "generalize" | "codify" | "keep" | "review-required";

export type ColumnClassification = {
  readonly column: ColumnProfile;
  readonly columnClass: ColumnClass;
  /** True exactly when a human decision is required before use (unknown class). */
  readonly requiresReview: boolean;
  readonly proposedAction: ProposedAction;
  readonly matchedBy: "header-pattern" | "content" | "none";
  readonly confidence: number;
  readonly evidence: readonly string[];
};

/**
 * Spanish clinical header vocabulary (legacy-aligned; synthetic in tests).
 * Order matters: first match wins, so patient-ID patterns are checked first.
 */
const CLASS_HEADER_PATTERNS: readonly {
  readonly columnClass: Exclude<ColumnClass, "unknown" | "insensitive">;
  readonly pattern: RegExp;
  readonly label: string;
}[] = [
  {
    columnClass: "identifier",
    label: "patient-ID-like header (NHC/historia/identificador de paciente)",
    pattern:
      /^(nhc|n[º°]?_?hist|id_?pac|id_?paciente|codigo_?pac|num_?pac|patient_?id|historia_?clinica)/i,
  },
  {
    columnClass: "identifier",
    label: "name header",
    pattern: /^(nombre|name|paciente$|first_?name)/i,
  },
  {
    columnClass: "identifier",
    label: "surname header",
    pattern: /^(apellido|surname|last_?name)/i,
  },
  {
    columnClass: "identifier",
    label: "full-name header",
    pattern: /^(nombre_?completo|full_?name)/i,
  },
  {
    columnClass: "identifier",
    label: "national-ID header",
    pattern: /^(dni|nif|nie|documento|id_?fiscal)/i,
  },
  {
    columnClass: "identifier",
    label: "phone header",
    pattern: /^(tel[eé]fono|phone|m[oó]vil|mobile|tfno)/i,
  },
  { columnClass: "identifier", label: "email header", pattern: /^(email|correo|e-?mail|mail)/i },
  {
    columnClass: "identifier",
    label: "address header",
    pattern: /^(direcci[oó]n|address|domicilio|calle)/i,
  },
  {
    columnClass: "identifier",
    label: "clinician header",
    pattern: /^(m[eé]dico|doctor|dr_?|facultativo)/i,
  },
  {
    columnClass: "quasi-identifier",
    label: "birth-date header",
    pattern: /^(fecha_?nac|f_?nac|birthdate|nacimiento)/i,
  },
  {
    columnClass: "quasi-identifier",
    label: "visit-date header",
    pattern: /^(fecha_?vis|f_?vis|fecha_?consulta|fecha$|date)/i,
  },
  {
    columnClass: "quasi-identifier",
    label: "postal-code header",
    pattern: /^(cp|cod_?postal|postal|zip)/i,
  },
  {
    columnClass: "quasi-identifier",
    label: "center/ward header",
    pattern: /^(centro|hospital|h_?clinic|servicio|planta|sala)/i,
  },
  {
    columnClass: "sensitive",
    label: "clinical-content header",
    pattern:
      /^(diagn[oó]stico|tratamiento|medicaci[oó]n|patolog[ií]a|prueba|resultado_?prueba|procedimiento|motivo_?consulta)/i,
  },
];

/** Content detectors over sampled values (legacy-aligned; values never retained). */
const CLASS_CONTENT_PATTERNS: readonly {
  readonly columnClass: Exclude<ColumnClass, "unknown" | "insensitive">;
  readonly label: string;
  readonly test: (value: string) => boolean;
}[] = [
  {
    columnClass: "identifier",
    label: "DNI/NIE-like content",
    test: (v) => /^\d{8}[A-Z]$/i.test(v) || /^[XYZ]\d{7}[A-Z]$/i.test(v),
  },
  {
    columnClass: "identifier",
    label: "Spanish phone-like content",
    test: (v) => /^(\+34)?[67]\d{8}$/.test(v.replace(/[\s\-.]/g, "")),
  },
  {
    columnClass: "identifier",
    label: "email-like content",
    test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  },
  {
    columnClass: "identifier",
    label: "numeric record-ID-like content",
    test: (v) => /^\d{5,12}$/.test(v),
  },
];

const PROPOSAL_BY_CLASS: Readonly<
  Record<Exclude<ColumnClass, "unknown" | "insensitive">, ProposedAction>
> = {
  identifier: "remove",
  "quasi-identifier": "generalize",
  sensitive: "codify",
};

export function matchesPatientIdHeader(header: string): boolean {
  return CLASS_HEADER_PATTERNS[0].pattern.test(header);
}

/**
 * Classify one column from its profile and its distributed non-empty sample.
 * Proposals are review foundations; `unknown` is always `review-required`,
 * never `keep`.
 */
export function classifyColumn(
  column: ColumnProfile,
  sampledValues: readonly StructuredCell[] = []
): ColumnClassification {
  const headerMatch = CLASS_HEADER_PATTERNS.find((entry) => entry.pattern.test(column.header));
  if (headerMatch && column.inferredType !== "empty") {
    return {
      column,
      columnClass: headerMatch.columnClass,
      requiresReview: false,
      proposedAction: PROPOSAL_BY_CLASS[headerMatch.columnClass],
      matchedBy: "header-pattern",
      confidence: 0.9,
      evidence: [`header matches ${headerMatch.label}`, ...column.evidence],
    };
  }

  if (headerMatch) {
    // Header suggests a class but the column carries no values to support it.
    return {
      column,
      columnClass: "unknown",
      requiresReview: true,
      proposedAction: "review-required",
      matchedBy: "header-pattern",
      confidence: 0.5,
      evidence: [
        `header matches ${headerMatch.label} but the column has no non-empty values to support it`,
        ...column.evidence,
      ],
    };
  }

  // No header evidence: fall back to content evidence over the SAME
  // distributed sample used by the profiler (never just the first row).
  const stringSample = sampledValues.filter(
    (value): value is string => typeof value === "string" && value !== ""
  );
  const contentMatch =
    stringSample.length > 0
      ? CLASS_CONTENT_PATTERNS.find((entry) => stringSample.some((value) => entry.test(value)))
      : undefined;

  if (contentMatch && column.inferredType === "text") {
    return {
      column,
      columnClass: contentMatch.columnClass,
      requiresReview: false,
      proposedAction: PROPOSAL_BY_CLASS[contentMatch.columnClass],
      matchedBy: "content",
      confidence: 0.7,
      evidence: [`${contentMatch.label} in the distributed sample`, ...column.evidence],
    };
  }

  return {
    column,
    columnClass: "unknown",
    requiresReview: true,
    proposedAction: "review-required",
    matchedBy: "none",
    confidence: 0.3,
    evidence: ["no header-pattern or content evidence", ...column.evidence],
  };
}

/**
 * Profile and classify every column of a grid. Sampled values stay in
 * process memory only.
 */
export function classifyGridColumns(
  grid: StructuredGrid,
  options: { sampleSize?: number } = {}
): ColumnClassification[] {
  const profiles = profileColumns(grid, options);
  return profiles.map((profile) =>
    classifyColumn(profile, sampleColumnValues(grid, profile.columnIndex, options.sampleSize))
  );
}

export { isBlankCell };
