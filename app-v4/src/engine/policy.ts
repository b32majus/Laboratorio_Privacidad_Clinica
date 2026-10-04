/**
 * V4 headless policy lookup (Work Order T11 #15, WU2b; REC-02
 * TEXT-POLICY-COMPLETION-01 WU-A).
 *
 * SPEC_V4_PRIVACY_ENGINE.md §6: "A policy maps context/entity to operator +
 * review requirements." This unit implements the accepted slice of that
 * authority: a pure, headless lookup that resolves a {@link PrivacyPolicyId}
 * to a frozen {@link PolicyProfile} carrying the policy id, its
 * transformation-behavior flag and the category→operator-key mapping.
 *
 * Four-policy authority (REC-02; handoff "Human-accepted text/document/batch
 * policy mapping"): all four accepted policies now resolve a complete mapping.
 *
 * - `standard` / `strict` mirror the legacy `Processor.transformEntity`
 *   switch (js/core/processor.js) per category, plus the accepted T12 AGE
 *   mapping (`EDAD` → AGE_GENERALIZE, GitHub #16). They differ only in the
 *   `modoEstricto` flag and MUST stay byte/contract compatible with their
 *   current accepted behavior.
 * - `external-ai` uses the same stricter (`strictMode=true`) branch for
 *   location/quasi-identifiers and the same name/identifier/age operators, but
 *   resolves `FECHA` to the accepted date-generalization operator
 *   (`v4.date-generalize`) instead of preserving exact intervals via the
 *   legacy visit transform. It is a LOCAL preparation policy: it transmits
 *   nothing to any service.
 * - `longitudinal-research` uses the same stricter branch, but resolves
 *   `FECHA` to the accepted consistent date-shift operator (`v4.date-shift`).
 *   It deliberately fails closed when no shift state is threaded
 *   (`ProcessingContext.options.dateShift` is owned by the context seam), so
 *   it never silently passes the original date through.
 *
 * `EDAD` remains banded under all four policies (R-E-C-02 acceptance: no
 * policy keeps an exact age). The mapping is data-owned and deeply frozen
 * here; no policy is a fallback for another.
 *
 * Deliberately out of scope: review/requiresReview semantics (ARCH-011
 * coherence is a separate work unit; D-004 keeps ReviewSession as the review
 * authority), the POLICY-OWNED date-shift context factory (WU-B) and policy
 * guidance copy (WU-C).
 *
 * Fail-closed (D-009): malformed input and unknown policy ids raise typed
 * {@link PolicyError} failures. There is no fallback profile, no default
 * operator mapping and no silent KEEP. A profile that does not carry the
 * exact mapping table of its policy is rejected by
 * {@link assertPolicyProfileConsistent}.
 *
 * Privacy: this module never logs content and stays headless/Worker-safe: it
 * imports only pure local modules (engine contracts plus the job policy
 * vocabulary) and touches no DOM or browser global anywhere.
 */

import { type PrivacyPolicyId } from "../domain/job";
import { LEGACY_OPERATOR_KEYS } from "./operator-registry";
import { RECOGNIZER_CATEGORIES, type RecognizerCategory } from "./recognizer-registry";

/** Category→operator-key mapping of one policy (SPEC §5/§6). */
export type PolicyCategoryOperatorKeys = Readonly<Record<RecognizerCategory, string>>;

/**
 * Frozen policy profile returned by {@link lookupPolicyProfile}. It carries
 * the policy identity, the single accepted transformation-behavior flag and
 * the category→operator mapping. It deliberately carries NO review/requires
 * review field: review semantics are owned by the ReviewSession authority
 * (D-004) and the separate ARCH-011 coherence unit.
 */
export type PolicyProfile = {
  readonly policyId: PrivacyPolicyId;
  /**
   * The accepted transformation-behavior authority: the legacy
   * `Processor.config.modoEstricto` profile branch. `standard` → false; every
   * other accepted policy uses the stricter branch (true).
   */
  readonly strictMode: boolean;
  /**
   * Maps each taxonomy category to the stable operator registry key
   * ({@link LEGACY_OPERATOR_KEYS}) that applies under this policy. The table
   * is owned by this module and deeply frozen.
   */
  readonly categoryOperatorKeys: PolicyCategoryOperatorKeys;
};

/** Machine-readable codes carried by {@link PolicyError} (D-009). */
export type PolicyErrorCode =
  | "invalid-policy-id"
  | "unknown-policy"
  | "policy-operator-mapping-unavailable"
  | "inconsistent-policy-profile";

/** Typed policy-lookup error; carries a machine-readable code. */
export class PolicyError extends Error {
  readonly code: PolicyErrorCode;

  constructor(code: PolicyErrorCode, message: string) {
    super(message);
    this.name = "PolicyError";
    this.code = code;
  }
}

/** The full D-007 policy vocabulary (mirrors app-v4/src/domain/job.ts). */
const POLICY_IDS: readonly PrivacyPolicyId[] = [
  "standard",
  "external-ai",
  "longitudinal-research",
  "strict",
];

/** Legacy `modoEstricto` value per policy (js/core/processor.js). */
const LEGACY_STRICT_MODE: Readonly<Record<PrivacyPolicyId, boolean>> = Object.freeze({
  standard: false,
  strict: true,
  "external-ai": true,
  "longitudinal-research": true,
});

/**
 * The legacy category→operator mapping shared by `standard` and `strict`,
 * mirroring the legacy `transformEntity` switch exactly (D-003: mirror, do
 * not redesign): NOMBRE→pseudonymize, IDENTIFICADOR→redact,
 * FECHA→date-transform, UBICACION→generalize, SOSPECHOSO→generalize. EDAD is
 * the accepted T12 AGE mapping (GitHub #16): AGE_GENERALIZE, shared by all
 * four policies (the stricter policies deliberately do not invent a second
 * banding scheme). All values are the stable keys of the existing operator
 * registry.
 */
const LEGACY_CATEGORY_OPERATOR_KEYS: PolicyCategoryOperatorKeys = Object.freeze({
  NOMBRE: LEGACY_OPERATOR_KEYS.PSEUDONYMIZE,
  IDENTIFICADOR: LEGACY_OPERATOR_KEYS.REDACT,
  FECHA: LEGACY_OPERATOR_KEYS.DATE_TRANSFORM,
  UBICACION: LEGACY_OPERATOR_KEYS.GENERALIZE,
  SOSPECHOSO: LEGACY_OPERATOR_KEYS.GENERALIZE,
  EDAD: LEGACY_OPERATOR_KEYS.AGE_GENERALIZE,
});

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as object)) {
      freezeDeep((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/**
 * The single data-owned REC-02 category→operator table, keyed by policy id
 * and deeply frozen. `standard`/`strict` keep the legacy mapping;
 * `external-ai` overrides only FECHA with the date-generalization operator;
 * `longitudinal-research` overrides only FECHA with the consistent date-shift
 * operator. Nothing here is derived at lookup time, so the authority is one
 * frozen table rather than a second policy engine.
 */
const CATEGORY_OPERATOR_KEYS_BY_POLICY: Readonly<
  Record<PrivacyPolicyId, PolicyCategoryOperatorKeys>
> = freezeDeep({
  standard: { ...LEGACY_CATEGORY_OPERATOR_KEYS },
  strict: { ...LEGACY_CATEGORY_OPERATOR_KEYS },
  "external-ai": {
    ...LEGACY_CATEGORY_OPERATOR_KEYS,
    FECHA: LEGACY_OPERATOR_KEYS.DATE_GENERALIZE,
  },
  "longitudinal-research": {
    ...LEGACY_CATEGORY_OPERATOR_KEYS,
    FECHA: LEGACY_OPERATOR_KEYS.DATE_SHIFT,
  },
});

function isPolicyId(value: unknown): value is PrivacyPolicyId {
  return typeof value === "string" && (POLICY_IDS as readonly string[]).includes(value);
}

function describePolicyIdInput(policyId: unknown): string {
  if (policyId === null) return "null";
  if (typeof policyId === "string") return "(empty string)";
  return typeof policyId;
}

/**
 * Resolves a policy id to its frozen profile. Headless and pure: no DOM, no
 * global state, no network. Fail-closed (D-009):
 *
 * - malformed input (non-string or empty string) → "invalid-policy-id";
 * - a string outside the D-007 vocabulary → "unknown-policy";
 * - no policy falls back to another (there is no default profile).
 */
export function lookupPolicyProfile(policyId: unknown): PolicyProfile {
  if (typeof policyId !== "string" || policyId.length === 0) {
    throw new PolicyError(
      "invalid-policy-id",
      `Policy id must be a non-empty string; received ${describePolicyIdInput(policyId)}.`
    );
  }
  if (!isPolicyId(policyId)) {
    throw new PolicyError(
      "unknown-policy",
      `Unknown privacy policy "${policyId}"; the accepted vocabulary is ${POLICY_IDS.join(
        ", "
      )} (D-007). Failing closed instead of guessing.`
    );
  }
  return buildProfile(policyId);
}

function buildProfile(policyId: PrivacyPolicyId): PolicyProfile {
  return freezeDeep({
    policyId,
    strictMode: LEGACY_STRICT_MODE[policyId],
    categoryOperatorKeys: { ...CATEGORY_OPERATOR_KEYS_BY_POLICY[policyId] },
  });
}

/**
 * Explicit consistency checker for a policy profile (protocol §3.5 planted
 * violation detection). A profile is consistent only when it is deeply
 * frozen, belongs to an accepted policy id, carries the exact accepted
 * strictMode flag, and maps exactly the accepted taxonomy categories to the
 * exact accepted operator keys OF THAT POLICY. Anything else — a strict
 * profile flipped to strictMode=false, an `external-ai` profile whose FECHA
 * silently falls back to the legacy transform, a `longitudinal-research`
 * profile carrying date-generalize — fails typed instead of passing.
 */
export function assertPolicyProfileConsistent(profile: unknown): asserts profile is PolicyProfile {
  if (profile === null || typeof profile !== "object") {
    throw new PolicyError(
      "inconsistent-policy-profile",
      `A policy profile must be an object; received ${String(profile)}.`
    );
  }
  const candidate = profile as Partial<PolicyProfile>;
  const policyId = candidate.policyId;
  if (!isPolicyId(policyId)) {
    throw new PolicyError(
      "policy-operator-mapping-unavailable",
      `A policy profile can only be consistent for an accepted policy id (${POLICY_IDS.join(
        ", "
      )}); received "${String(policyId)}".`
    );
  }
  if (
    typeof candidate.strictMode !== "boolean" ||
    candidate.strictMode !== LEGACY_STRICT_MODE[policyId]
  ) {
    throw new PolicyError(
      "inconsistent-policy-profile",
      `Policy "${policyId}" must carry the accepted transformation-behavior flag strictMode=${
        LEGACY_STRICT_MODE[policyId]
      } (legacy modoEstricto); received ${String(candidate.strictMode)}.`
    );
  }
  const mapping = candidate.categoryOperatorKeys;
  if (mapping === null || typeof mapping !== "object") {
    throw new PolicyError(
      "inconsistent-policy-profile",
      `Policy "${policyId}" must carry a categoryOperatorKeys mapping.`
    );
  }
  const expectedCategories = [...RECOGNIZER_CATEGORIES].sort();
  const actualCategories = Object.keys(mapping).sort();
  if (actualCategories.join(",") !== expectedCategories.join(",")) {
    throw new PolicyError(
      "inconsistent-policy-profile",
      `Policy "${policyId}" must map exactly the accepted taxonomy categories ${expectedCategories.join(
        ", "
      )}; received ${actualCategories.join(", ")}.`
    );
  }
  const expectedMapping = CATEGORY_OPERATOR_KEYS_BY_POLICY[policyId];
  for (const category of expectedCategories) {
    const expectedKey = expectedMapping[category as RecognizerCategory];
    const actualKey = (mapping as PolicyCategoryOperatorKeys)[category as RecognizerCategory];
    if (actualKey !== expectedKey) {
      throw new PolicyError(
        "inconsistent-policy-profile",
        `Policy "${policyId}" maps category "${category}" to "${String(
          actualKey
        )}" but the accepted REC-02 table maps it to "${expectedKey}".`
      );
    }
  }
  if (!Object.isFrozen(profile) || !Object.isFrozen(mapping)) {
    throw new PolicyError(
      "inconsistent-policy-profile",
      `Policy "${policyId}" profiles must be deeply frozen.`
    );
  }
}
