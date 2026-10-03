import { describe, expect, it } from "vitest";

import type { JobKind, PrivacyPolicyId } from "./domain/job";
import {
  POLICY_AVAILABILITY_LABELS,
  POLICY_IDS,
  buildPolicyGuidance,
  isPolicyAvailableForJobKind,
  isPolicySelectableForJobKind,
  requiresPatientIdColumn,
} from "./policy-guidance";

/**
 * Pure-unit oracles for the Policy guidance seam (issue #56, POLICY-01). The
 * helper must DERIVE availability from the existing engine authorities and must
 * never invent an availability table or a second operator mapping.
 */
const FORBIDDEN_CLAIM =
  /anonymous|anonymi[sz]ed|GDPR|LOPDGDD|certified|complian(t|ce)|k-anonymity|differential privacy/i;

function entryFor(jobKind: JobKind | null, policyId: PrivacyPolicyId) {
  const entry = buildPolicyGuidance(jobKind).find((candidate) => candidate.policyId === policyId);
  if (entry === undefined) throw new Error(`no guidance entry for ${policyId}`);
  return entry;
}

describe("policy guidance availability derivation", () => {
  it("keeps the accepted policy identity and order", () => {
    expect(POLICY_IDS).toEqual(["standard", "external-ai", "longitudinal-research", "strict"]);
  });

  it("exposes the exact textual availability states", () => {
    expect(POLICY_AVAILABILITY_LABELS.available).toBe("Available");
    expect(POLICY_AVAILABILITY_LABELS.unavailable).toBe("Not available for this job type yet");
  });

  it("makes only Standard and Strict available for text/document/document-batch jobs", () => {
    for (const jobKind of ["text", "document", "document-batch"] as const) {
      expect(isPolicyAvailableForJobKind("standard", jobKind)).toBe("available");
      expect(isPolicyAvailableForJobKind("strict", jobKind)).toBe("available");
      expect(isPolicyAvailableForJobKind("external-ai", jobKind)).toBe("unavailable");
      expect(isPolicyAvailableForJobKind("longitudinal-research", jobKind)).toBe("unavailable");
    }
  });

  it("makes all four policies available for a structured job", () => {
    for (const policyId of POLICY_IDS) {
      expect(isPolicyAvailableForJobKind(policyId, "structured")).toBe("available");
      expect(isPolicySelectableForJobKind(policyId, "structured")).toBe(true);
    }
  });

  it("reports unknown, not availability, before a job exists", () => {
    for (const policyId of POLICY_IDS) {
      expect(isPolicyAvailableForJobKind(policyId, null)).toBe("unknown");
      expect(isPolicySelectableForJobKind(policyId, null)).toBe(false);
    }
  });

  it("reads the patient-ID requirement from the structured date/age authority", () => {
    expect(requiresPatientIdColumn("external-ai")).toBe(true);
    expect(requiresPatientIdColumn("longitudinal-research")).toBe(true);
    expect(requiresPatientIdColumn("standard")).toBe(false);
    expect(requiresPatientIdColumn("strict")).toBe(false);
  });

  it("flags the patient-ID requirement only for structured shift policies", () => {
    expect(entryFor("structured", "external-ai").requiresPatientIdColumn).toBe(true);
    expect(entryFor("structured", "longitudinal-research").requiresPatientIdColumn).toBe(true);
    expect(entryFor("structured", "standard").requiresPatientIdColumn).toBe(false);
    expect(entryFor("structured", "strict").requiresPatientIdColumn).toBe(false);

    for (const jobKind of ["text", "document", "document-batch", null] as const) {
      expect(buildPolicyGuidance(jobKind).some((entry) => entry.requiresPatientIdColumn)).toBe(
        false
      );
    }
  });

  it("never writes an anonymity/certification/compliance claim into guidance", () => {
    for (const jobKind of [null, "text", "document", "document-batch", "structured"] as const) {
      for (const entry of buildPolicyGuidance(jobKind)) {
        expect(entry.guidance).not.toMatch(FORBIDDEN_CLAIM);
      }
    }
  });
});

describe("policy guidance no-job copy (POLICY-01 #56)", () => {
  it("stays factual: no invented positioning and no job-kind-specific behavior as universal", () => {
    for (const policyId of POLICY_IDS) {
      const guidance = entryFor(null, policyId).guidance;
      expect(guidance.length).toBeGreaterThan(0);
      // No unsubstantiated qualitative positioning (e.g. the old "Balanced").
      expect(guidance).not.toMatch(/\bbalanced\b/i);
      // Before a job exists the job kind is unknown, so the structured-only
      // per-patient shift / age-band / month-level behavior must NOT be
      // presented as this policy's behavior everywhere.
      expect(guidance).not.toMatch(/per-patient|age[- ]band|month[- ]level/i);
      // Every entry must be honest that behavior/availability depend on the
      // (still unknown) job type.
      expect(guidance).toMatch(/job type/i);
    }
  });

  it("states the accepted text/document gap for External AI and Longitudinal Research", () => {
    const textGap =
      /text, document and document-batch processing has no accepted operator mapping yet/i;
    expect(entryFor(null, "external-ai").guidance).toMatch(textGap);
    expect(entryFor(null, "longitudinal-research").guidance).toMatch(textGap);
  });
});
