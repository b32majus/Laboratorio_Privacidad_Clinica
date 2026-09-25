/**
 * V4 headless policy lookup (Work Order T11 #15, WU2b).
 *
 * SPEC_V4_PRIVACY_ENGINE.md §6: "A policy maps context/entity to operator +
 * review requirements." This unit implements only the accepted slice of that
 * authority: a pure, headless lookup that resolves a {@link PrivacyPolicyId}
 * to a frozen {@link PolicyProfile} carrying the policy id, its
 * transformation-behavior flag and the category→operator-key mapping.
 *
 * No-invented-semantics boundary (SPEC §6; CURRENT_DECISIONS.md D-007): the
 * only accepted transformation authority today is the legacy
 * `Processor.transformEntity` switch (js/core/processor.js), mirrored per
 * category by the WU2a operators. `standard` and `strict` resolve to the two
 * legacy `modoEstricto` profiles (false/true) with the identical
 * category→operator mapping; `external-ai` and `longitudinal-research` have
 * NO accepted per-category operator mapping yet (T12/T13 own AGE and date
 * semantics), so they fail typed instead of guessing a transformation or
 * silently falling back to `standard`.
 *
 * Deliberately out of scope: review/requiresReview semantics (ARCH-011
 * coherence is a separate work unit; D-004 keeps ReviewSession as the review
 * authority), AGE/date policy semantics (T12/T13), and any default profile.
 *
 * Fail-closed (D-009): malformed input, unknown policy ids and
 * known-but-unmapped policy ids all raise typed {@link PolicyError}
 * failures. There is no fallback profile, no default operator mapping and no
 * silent KEEP.
 *
 * Privacy: this module never logs content and stays headless/Worker-safe: it
 * imports only pure local modules (engine contracts plus the job policy
 * vocabulary) and touches no DOM or browser global anywhere.
 */

import { type PrivacyPolicyId } from "../domain/job";
import { LEGACY_OPERATOR_KEYS } from "./operator-registry";
import { RECOGNIZER_CATEGORIES, type RecognizerCategory } from "./recognizer-registry";

/** The policy ids whose transformation mapping has accepted authority today. */
type MappedPolicyId = "standard" | "strict";

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
   * The ONLY accepted transformation-behavior authority today: the legacy
   * `Processor.config.modoEstricto` profile branch (`standard` → false,
   * `strict` → true).
   */
  readonly strictMode: boolean;
  /**
   * Maps each taxonomy category to the stable operator registry key
   * ({@link LEGACY_OPERATOR_KEYS}) that applies under this policy, mirroring
   * the accepted legacy `transformEntity` semantics exactly.
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

/** Policies whose per-category operator mapping has accepted authority today. */
const POLICIES_WITH_ACCEPTED_MAPPING: readonly MappedPolicyId[] = ["standard", "strict"];

/** Legacy `modoEstricto` value per mapped policy (js/core/processor.js). */
const LEGACY_STRICT_MODE: Readonly<Record<MappedPolicyId, boolean>> = Object.freeze({
  standard: false,
  strict: true,
});

/**
 * The single accepted category→operator mapping, mirroring the legacy
 * `transformEntity` switch exactly (D-003: mirror, do not redesign):
 * NOMBRE→pseudonymize, IDENTIFICADOR→redact, FECHA→date-transform,
 * UBICACION→generalize, SOSPECHOSO→generalize. All values are the stable
 * keys of the existing operator registry.
 */
const LEGACY_CATEGORY_OPERATOR_KEYS: PolicyCategoryOperatorKeys = Object.freeze({
  NOMBRE: LEGACY_OPERATOR_KEYS.PSEUDONYMIZE,
  IDENTIFICADOR: LEGACY_OPERATOR_KEYS.REDACT,
  FECHA: LEGACY_OPERATOR_KEYS.DATE_TRANSFORM,
  UBICACION: LEGACY_OPERATOR_KEYS.GENERALIZE,
  SOSPECHOSO: LEGACY_OPERATOR_KEYS.GENERALIZE,
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
 * - a known-but-unmapped policy (`external-ai`, `longitudinal-research`) →
 *   "policy-operator-mapping-unavailable" — never a guessed transformation,
 *   never a silent fallback to `standard`.
 */
export function lookupPolicyProfile(policyId: unknown): PolicyProfile {
  if (typeof policyId !== "string" || policyId.length === 0) {
    throw new PolicyError(
      "invalid-policy-id",
      `Policy id must be a non-empty string; received ${describePolicyIdInput(policyId)}.`
    );
  }
  if (!POLICY_IDS.includes(policyId as PrivacyPolicyId)) {
    throw new PolicyError(
      "unknown-policy",
      `Unknown privacy policy "${policyId}"; the accepted vocabulary is ${POLICY_IDS.join(
        ", "
      )} (D-007). Failing closed instead of guessing.`
    );
  }
  if (!POLICIES_WITH_ACCEPTED_MAPPING.includes(policyId as MappedPolicyId)) {
    throw new PolicyError(
      "policy-operator-mapping-unavailable",
      `Privacy policy "${policyId}" is known but has no accepted per-category operator mapping yet (D-007 defers exact mappings to their owning tickets; T12/T13 own AGE and date semantics). Failing closed instead of guessing a transformation or falling back to "standard".`
    );
  }
  return buildProfile(policyId as MappedPolicyId);
}

function buildProfile(policyId: MappedPolicyId): PolicyProfile {
  return freezeDeep({
    policyId,
    strictMode: LEGACY_STRICT_MODE[policyId],
    categoryOperatorKeys: { ...LEGACY_CATEGORY_OPERATOR_KEYS },
  });
}

/**
 * Explicit consistency checker for a policy profile (protocol §3.5 planted
 * violation detection). A profile is consistent only when it is deeply
 * frozen, belongs to a policy with accepted mapping authority, carries the
 * exact accepted strictMode flag, and maps exactly the accepted taxonomy
 * categories to the exact accepted operator keys. Anything else — including
 * a strict profile flipped to strictMode=false or an `external-ai` profile
 * silently carrying the standard mapping — fails typed instead of passing.
 */
export function assertPolicyProfileConsistent(profile: unknown): asserts profile is PolicyProfile {
  if (profile === null || typeof profile !== "object") {
    throw new PolicyError(
      "inconsistent-policy-profile",
      `A policy profile must be an object; received ${String(profile)}.`
    );
  }
  const candidate = profile as Partial<PolicyProfile>;
  if (!POLICIES_WITH_ACCEPTED_MAPPING.includes(candidate.policyId as MappedPolicyId)) {
    throw new PolicyError(
      "policy-operator-mapping-unavailable",
      `A policy profile can only be consistent for a policy with an accepted operator mapping (${POLICIES_WITH_ACCEPTED_MAPPING.join(
        ", "
      )}); received "${String(candidate.policyId)}".`
    );
  }
  const policyId = candidate.policyId as MappedPolicyId;
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
  for (const category of expectedCategories) {
    const expectedKey = LEGACY_CATEGORY_OPERATOR_KEYS[category as RecognizerCategory];
    const actualKey = (mapping as PolicyCategoryOperatorKeys)[category as RecognizerCategory];
    if (actualKey !== expectedKey) {
      throw new PolicyError(
        "inconsistent-policy-profile",
        `Policy "${policyId}" maps category "${category}" to "${String(
          actualKey
        )}" but the accepted legacy semantics map it to "${expectedKey}".`
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
