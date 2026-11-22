import { describe, expect, it } from "vitest";
import { localizeDomainErrorMessage } from "./domain-message-labels";

/** REC-12 F9: exact typed messages remain factual; only the professional imperative changes. */
describe("REC-12 F9 professional Spanish typed error mapping", () => {
  it("empty text offers an actionable Spanish instruction", () => {
    expect(
      localizeDomainErrorMessage("Pasted text is empty; provide text before creating a job.")
    ).toBe("El texto pegado está vacío; escribe o pega texto antes de crear el trabajo.");
  });

  it("unsupported DOC files keep the true formats and correct second-person instruction", () => {
    expect(
      localizeDomainErrorMessage(
        'Legacy Word ".doc" files are not supported; convert the document to DOCX or TXT and try again. Supported types: TXT, PDF, DOCX.'
      )
    ).toBe(
      'Los archivos heredados de Word ".doc" no son compatibles; convierte el documento a DOCX o TXT e inténtalo de nuevo. Formatos admitidos: TXT, PDF, DOCX.'
    );
  });

  it("input size preserves exact bounds and does not promise an unsafe retry", () => {
    expect(
      localizeDomainErrorMessage(
        "Input text is 4001 characters; this build supports up to 4000 characters per document. Split the text into parts of at most 4000 characters and process each part as its own job."
      )
    ).toBe(
      "El texto de entrada tiene 4001 caracteres; esta versión admite hasta 4000 caracteres por documento. Divide el texto en partes de como máximo 4000 caracteres y procesa cada parte como su propio trabajo."
    );
  });

  it("ambiguous spreadsheet header preserves sheet identity and the human choice", () => {
    expect(
      localizeDomainErrorMessage(
        'The worksheet "Hoja F9" has no clear header row in the first 5 rows. Choose the header row explicitly.'
      )
    ).toBe(
      'La hoja "Hoja F9" no tiene una fila de encabezado clara en las primeras 5 filas. Elige la fila de encabezado explícitamente.'
    );
  });

  it("multiple header rows preserve actual row numbers, not a fabricated choice", () => {
    expect(
      localizeDomainErrorMessage(
        'The worksheet "Hoja 2" has several rows that look like headers (row 1, row 3). Choose the header row explicitly; the first row is never assumed.'
      )
    ).toBe(
      'La hoja "Hoja 2" tiene varias filas que parecen encabezados (fila 1, fila 3). Elige la fila de encabezado explícitamente; nunca se presupone la primera fila.'
    );
  });

  it("explains ambiguous or malformed CSV to a user in professional Spanish", () => {
    expect(
      localizeDomainErrorMessage(
        "The CSV separator is ambiguous; check the header and choose an unambiguous file."
      )
    ).toBe(
      "No se puede identificar con seguridad el separador del CSV. Revisa la fila de encabezados y utiliza un archivo sin ambigüedad."
    );
    expect(localizeDomainErrorMessage("The CSV contains malformed quoted fields.")).toBe(
      "El CSV contiene campos entrecomillados incorrectos. Corrige el archivo antes de continuar."
    );
    expect(localizeDomainErrorMessage("A CSV row has more columns than the header.")).toBe(
      "Una fila del CSV contiene más columnas que la cabecera. Corrige el archivo antes de continuar."
    );
  });

  it("unknown domain errors remain unchanged, not translated or swallowed", () => {
    expect(localizeDomainErrorMessage("NEW_TYPED_REASON_UNRECOGNISED_F9")).toBe(
      "NEW_TYPED_REASON_UNRECOGNISED_F9"
    );
  });
});
