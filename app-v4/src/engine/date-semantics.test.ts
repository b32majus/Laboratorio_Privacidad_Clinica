import { describe, expect, it } from "vitest";

import { DATE_ROLE_CUES, classifyDateRole, type DateRole } from "./date-semantics";
import { EngineError } from "./types";

/**
 * Contract oracles for V4 date-role classification (Work Order T13 #17,
 * WU-A; SPEC_V4_PRIVACY_ENGINE.md §9; CURRENT_DECISIONS.md D-009/D-010).
 *
 * The classifier answers only "which explicit non-visit role does the
 * surrounding context claim?", never "how should the date be transformed?".
 * All fixtures are synthetic clinical-style Spanish strings; no real content
 * is used.
 */

const POSITIVE_FIXTURES: readonly { readonly role: DateRole; readonly text: string }[] = [
  { role: "birth", text: "Fecha de nacimiento: 12/03/1954" },
  { role: "birth", text: "Paciente nacido en 1980" },
  { role: "birth", text: "NACIMIENTO" },
  { role: "admission", text: "Fecha de ingreso: 05/01/2024" },
  { role: "admission", text: "Paciente ingresado el 05/01/2024" },
  { role: "admission", text: "Paciente ingresada el 05/01/2024" },
  { role: "admission", text: "Hospitalizado desde el 05/01/2024" },
  { role: "admission", text: "Hospitalizada desde el 05/01/2024" },
  { role: "admission", text: "Ingresó el 05/01/2024" },
  { role: "discharge", text: "Alta médica: 20/01/2024" },
  { role: "discharge", text: "ALTA MÉDICA" },
  { role: "discharge", text: "Alta hospitalaria el 20/01/2024" },
  { role: "discharge", text: "Se registra el alta el 20/01/2024" },
  { role: "discharge", text: "Dado de alta el 20/01/2024" },
  { role: "future-appointment", text: "Próxima cita: 10/02/2024" },
  { role: "future-appointment", text: "Proxima cita: 10/02/2024" },
  { role: "future-appointment", text: "Cita previa: 10/02/2024" },
  { role: "future-appointment", text: "Próxima consulta: 10/02/2024" },
];

const UNKNOWN_FIXTURES: readonly string[] = [
  "12/03/1954",
  "",
  "El paciente refiere dolor lumbar.",
  "Talla alta",
  "talla alta 172 cm",
  "Alta tensión 130/85",
  "Tensión alta",
  "alta",
  "Constantes: TA 130/85, FC 78.",
];

describe("classifyDateRole — explicit-cue positives", () => {
  for (const fixture of POSITIVE_FIXTURES) {
    it(`classifies "${fixture.text}" as ${fixture.role}`, () => {
      expect(classifyDateRole(fixture.text)).toBe(fixture.role);
    });
  }
});

describe("classifyDateRole — never guesses visit for unlabeled / non-discharge contexts", () => {
  for (const text of UNKNOWN_FIXTURES) {
    it(`returns unknown for "${text}"`, () => {
      expect(classifyDateRole(text)).toBe("unknown");
    });
  }

  it("does not treat bare 'alta' in 'talla alta' or 'alta tensión' as discharge", () => {
    expect(classifyDateRole("talla alta")).not.toBe("discharge");
    expect(classifyDateRole("alta tensión 130/85")).not.toBe("discharge");
  });
});

describe("classifyDateRole — determinism and normalization", () => {
  it("is a pure function of the normalized text (case/accent tolerant)", () => {
    const variants = ["Próxima Cita", "proxima cita", "PROXIMA CITA", "  próxima cita  "];
    const roles = variants.map((variant) => classifyDateRole(variant));
    expect(new Set(roles)).toEqual(new Set(["future-appointment"]));
  });

  it("returns the same role for repeated calls on the same input", () => {
    const text = "Alta médica el 20/01/2024";
    expect(classifyDateRole(text)).toBe(classifyDateRole(text));
    expect(classifyDateRole(text)).toBe("discharge");
  });

  it("resolves multiple distinct cues by the frozen, documented precedence", () => {
    // future-appointment > discharge > birth > admission.
    expect(classifyDateRole("Ingreso el 05/01/2024. Alta médica el 20/01/2024.")).toBe("discharge");
    expect(classifyDateRole("Ingreso el 05/01/2024. Próxima cita el 10/02/2024.")).toBe(
      "future-appointment"
    );
    expect(classifyDateRole("Nacimiento el 12/03/1954. Ingreso el 05/01/2024.")).toBe("birth");
    expect(classifyDateRole("Alta médica el 20/01/2024. Próxima cita el 10/02/2024.")).toBe(
      "future-appointment"
    );
  });

  it("exposes a frozen, ordered cue table consistent with the classifier", () => {
    expect(Object.isFrozen(DATE_ROLE_CUES)).toBe(true);
    expect(DATE_ROLE_CUES.map((cue) => cue.role)).toEqual([
      "future-appointment",
      "discharge",
      "birth",
      "admission",
    ]);
  });
});

describe("classifyDateRole — fail-closed on malformed argument types (D-009)", () => {
  it("throws a typed EngineError for non-string input", () => {
    expect(() => classifyDateRole(42 as unknown as string)).toThrow(EngineError);
    try {
      classifyDateRole(42 as unknown as string);
      throw new Error("expected classifyDateRole to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(EngineError);
      expect((error as EngineError).code).toBe("invalid-text");
    }
  });
});
