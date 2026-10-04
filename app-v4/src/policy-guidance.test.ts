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

  it("makes all four policies available for text/document/document-batch jobs (REC-02)", () => {
    for (const jobKind of ["text", "document", "document-batch"] as const) {
      for (const policyId of POLICY_IDS) {
        expect(isPolicyAvailableForJobKind(policyId, jobKind), `${policyId} on ${jobKind}`).toBe(
          "available"
        );
        expect(
          isPolicySelectableForJobKind(policyId, jobKind),
          `${policyId} selectable on ${jobKind}`
        ).toBe(true);
      }
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

  it("no longer claims the newly-mapped text policies lack an operator mapping (REC-02)", () => {
    for (const jobKind of [null, "text", "document", "document-batch"] as const) {
      for (const policyId of ["external-ai", "longitudinal-research"] as const) {
        expect(entryFor(jobKind, policyId).guidance).not.toMatch(
          /no accepted operator mapping|not available for this job type yet/i
        );
      }
    }
  });
});

/**
 * REC-02 guidance oracles: the text/document/document-batch copy must state the
 * ACTUAL four-policy behavior (not the mapping table), keep the forbidden
 * anonymity/certification/compliance vocabulary out, and avoid implying that
 * External AI transmits data or that Longitudinal Research grants research
 * approval/governance.
 */
describe("policy guidance text/document facts (REC-02)", () => {
  const TEXT_KINDS = ["text", "document", "document-batch"] as const;

  it("describes Standard as pseudonymize/redact/generalize", () => {
    for (const jobKind of TEXT_KINDS) {
      const guidance = entryFor(jobKind, "standard").guidance;
      expect(guidance).toMatch(/pseudonymiz/i);
      expect(guidance).toMatch(/redact/i);
      expect(guidance).toMatch(/generaliz/i);
    }
  });

  it("describes Strict as the stricter location/quasi generalization branch", () => {
    for (const jobKind of TEXT_KINDS) {
      const guidance = entryFor(jobKind, "strict").guidance;
      expect(guidance).toMatch(/stricter/i);
      expect(guidance).toMatch(/location|quasi/i);
    }
  });

  it("describes External AI as local-only date-precision reduction that transmits nothing (ACCEPTANCE 18)", () => {
    for (const jobKind of TEXT_KINDS) {
      const guidance = entryFor(jobKind, "external-ai").guidance;
      expect(guidance).toMatch(/local[- ]only/i);
      expect(guidance).toMatch(/precision|generaliz/i);
      expect(guidance).toMatch(/nothing is (?:transmitted|sent)/i);
      // Never implies an outbound transfer to a service/provider.
      expect(guidance).not.toMatch(
        /\bupload(?:s|ed)?\b|network request|sent to (?:an? )?(?:external|remote)/i
      );
    }
  });

  it("describes Longitudinal Research as consistent Job-scoped shifting that grants no research approval (ACCEPTANCE 18)", () => {
    for (const jobKind of TEXT_KINDS) {
      const guidance = entryFor(jobKind, "longitudinal-research").guidance;
      expect(guidance).toMatch(/local[- ]only/i);
      expect(guidance).toMatch(/shift/i);
      expect(guidance).toMatch(/order|interval/i);
      expect(guidance).toMatch(/does not grant/i);
      // No positive conferral of research approval/governance.
      expect(guidance).not.toMatch(
        /research[- ]approved|approved for research|confers? (?:research )?approval/i
      );
    }
  });

  it("keeps the four-policy text copy free of forbidden claims", () => {
    for (const jobKind of TEXT_KINDS) {
      for (const policyId of POLICY_IDS) {
        expect(entryFor(jobKind, policyId).guidance).not.toMatch(FORBIDDEN_CLAIM);
      }
    }
  });
});
