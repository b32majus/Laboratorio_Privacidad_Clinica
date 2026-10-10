/**
 * Synthetic clinical examples for the REC-08 direct-input start (issue #80).
 *
 * The maintained `ejemplos/*.json` heritage payloads are the single content
 * source: this module imports them and exposes only the `texto` each action
 * loads into the ordinary pasted-text draft. It never copies the old
 * shortened v3 inline strings, never modifies the JSON files and never
 * creates a Job — creation still goes only through `handleCreateFromDraft`.
 *
 * Pure/headless: no DOM, no React, no module state.
 */
import ejemploConsultaUrgencias from "../../../ejemplos/01-consulta-urgencias.json";
import ejemploInformeQuirurgico from "../../../ejemplos/02-informe-quirurgico.json";
import ejemploHistoriaClinica from "../../../ejemplos/03-historia-clinica.json";

/** One example action: identity, Spanish button label and draft text. */
export type SyntheticExample = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly text: string;
};

type ExamplePayload = {
  readonly descripcion?: unknown;
  readonly texto?: unknown;
};

function exampleText(payload: ExamplePayload, file: string): string {
  if (typeof payload.texto === "string" && payload.texto.trim().length > 0) return payload.texto;
  throw new Error(`Synthetic example ${file} has no usable "texto".`);
}

function exampleDescription(payload: ExamplePayload): string {
  return typeof payload.descripcion === "string" ? payload.descripcion : "";
}

/**
 * The three accepted Spanish example actions, in heritage order. Fail-fast:
 * a JSON payload without usable `texto` throws at module load, never an
 * apparently successful empty draft.
 */
export const SYNTHETIC_EXAMPLES: readonly SyntheticExample[] = Object.freeze([
  Object.freeze({
    id: "ejemplo-consulta-urgencias",
    label: "Ejemplo: consulta de urgencias",
    description: exampleDescription(ejemploConsultaUrgencias),
    text: exampleText(ejemploConsultaUrgencias, "ejemplos/01-consulta-urgencias.json"),
  }),
  Object.freeze({
    id: "ejemplo-informe-quirurgico",
    label: "Ejemplo: informe quirúrgico",
    description: exampleDescription(ejemploInformeQuirurgico),
    text: exampleText(ejemploInformeQuirurgico, "ejemplos/02-informe-quirurgico.json"),
  }),
  Object.freeze({
    id: "ejemplo-historia-clinica",
    label: "Ejemplo: historia clínica",
    description: exampleDescription(ejemploHistoriaClinica),
    text: exampleText(ejemploHistoriaClinica, "ejemplos/03-historia-clinica.json"),
  }),
]);
