import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { PrivacyPolicyId } from "../domain/job";
import { readDateShiftState } from "./date-operator";
import {
  TEXT_POLICY_SHIFT_SEED_PREFIX,
  createInitialProcessingContext,
  textPolicyDateShiftSeed,
} from "./initial-processing-context";
import { LEGACY_OPERATOR_KEYS } from "./operator-registry";
import { PolicyError, lookupPolicyProfile } from "./policy";

/**
 * WU-B — policy-owned initial ProcessingContext seam (REC-02
 * TEXT-POLICY-COMPLETION-01).
 *
 * The seam resolves the initial context from the SAME engine authority the
 * pipeline uses (`lookupPolicyProfile`) and threads a Job-scoped, non-PHI
 * date-shift state ONLY for the policy whose FECHA operator is exactly
 * `v4.date-shift`. These oracles pin that contract mechanically and keep the
 * fail-closed policy lookup. All fixtures are synthetic; no content is used.
 */

const JOB_ID = "job-recovery-42";
const SHIFT_POLICY: PrivacyPolicyId = "longitudinal-research";
const NON_SHIFT_POLICIES: readonly PrivacyPolicyId[] = ["standard", "strict", "external-ai"];

function readModuleSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/** Strips block and line comments so prose cannot trip the structural scan. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("createInitialProcessingContext — policy-owned initial context (REC-02 WU-B)", () => {
  it("returns a bare fresh context for every policy whose FECHA operator is NOT v4.date-shift", () => {
    for (const policyId of NON_SHIFT_POLICIES) {
      // Independent authority check: these policies do not select date-shift.
      expect(lookupPolicyProfile(policyId).categoryOperatorKeys.FECHA).not.toBe(
        LEGACY_OPERATOR_KEYS.DATE_SHIFT
      );
      const context = createInitialProcessingContext({ id: JOB_ID }, policyId);
      expect(context, `${policyId} context`).toEqual({ mode: "fresh" });
      expect(
        Object.prototype.hasOwnProperty.call(context, "options"),
        `${policyId} must carry no options`
      ).toBe(false);
      expect(readDateShiftState(context.options)).toBeUndefined();
    }
  });

  it("threads exactly one Job-scoped date-shift state for the v4.date-shift policy", () => {
    expect(lookupPolicyProfile(SHIFT_POLICY).categoryOperatorKeys.FECHA).toBe(
      LEGACY_OPERATOR_KEYS.DATE_SHIFT
    );
    const context = createInitialProcessingContext({ id: JOB_ID }, SHIFT_POLICY);
    expect(context.mode).toBe("fresh");
    expect(Object.prototype.hasOwnProperty.call(context, "options")).toBe(true);

    const state = readDateShiftState(context.options);
    if (state === undefined) throw new Error("expected the seam to thread a date-shift state");
    // Independent literal of the domain-separated, non-PHI, Job-scoped seed.
    expect(state.seed).toBe(`text-policy:${JOB_ID}`);
    expect(state.seed).toBe(textPolicyDateShiftSeed(JOB_ID));
    expect(state.seed.startsWith(TEXT_POLICY_SHIFT_SEED_PREFIX)).toBe(true);
  });

  it("is a pure, stable function of Job identity: same Job → equal state; a new Job → a new seed", () => {
    const first = createInitialProcessingContext({ id: JOB_ID }, SHIFT_POLICY);
    const second = createInitialProcessingContext({ id: JOB_ID }, SHIFT_POLICY);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);

    const otherJob = createInitialProcessingContext({ id: "job-other-7" }, SHIFT_POLICY);
    expect(otherJob).not.toEqual(first);
    const firstSeed = readDateShiftState(first.options)?.seed;
    const otherSeed = readDateShiftState(otherJob.options)?.seed;
    expect(otherSeed).toBe("text-policy:job-other-7");
    expect(otherSeed).not.toBe(firstSeed);
  });

  it("consults Job identity ONLY, so unrelated Job properties can never change the shift", () => {
    const plain = createInitialProcessingContext({ id: JOB_ID }, SHIFT_POLICY);
    const jobLike: { readonly id: string } & Record<string, unknown> = {
      id: JOB_ID,
      name: "Nombre: Carmen Sánchez",
      kind: "text",
      sourceText: "Fecha de nacimiento: 12/03/1954.",
    };
    expect(createInitialProcessingContext(jobLike, SHIFT_POLICY)).toEqual(plain);
  });

  it("serializes as a plain frozen JSON value (Worker/protocol safe)", () => {
    const context = createInitialProcessingContext({ id: JOB_ID }, SHIFT_POLICY);
    expect(Object.isFrozen(context)).toBe(true);
    expect(JSON.parse(JSON.stringify(context))).toEqual(context);
  });

  it("reads the policy authority: an unknown policy id fails typed instead of guessing a context", () => {
    try {
      createInitialProcessingContext({ id: JOB_ID }, "no-such-policy" as PrivacyPolicyId);
      throw new Error("expected an unknown policy to fail closed");
    } catch (error) {
      expect(error).toBeInstanceOf(PolicyError);
      expect((error as PolicyError).code).toBe("unknown-policy");
    }
  });

  it("does not duplicate the mapping table: it imports the authorities and hard-codes no policy id", () => {
    const source = readModuleSource("./initial-processing-context.ts");
    const code = stripComments(source);
    for (const literal of ["standard", "strict", "external-ai", "longitudinal-research"]) {
      expect(code, `seam must not hard-code policy id "${literal}"`).not.toContain(`"${literal}"`);
    }
    const specifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
    expect(specifiers).toContain("./policy");
    expect(specifiers).toContain("./date-shift");
  });
});
