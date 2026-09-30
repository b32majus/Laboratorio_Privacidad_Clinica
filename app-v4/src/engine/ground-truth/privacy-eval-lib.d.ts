/**
 * Ambient declarations for the pure evaluator helpers that live with the
 * legacy privacy harness (`scripts/privacy-eval/lib/*.mjs`).
 *
 * HARDEN-02 WU-A deliberately REUSES the accepted matching/metrics logic
 * (QUALITY_EXECUTION_PROTOCOL §3.3: reuse the existing authority; do not
 * fork the metric definitions) instead of duplicating it. Those helpers are
 * plain ESM with no shipped types, so this wildcard declaration gives the
 * V4 ground-truth gate its minimal structural shape under strict TS.
 */

declare module "*/privacy-eval/lib/matching.mjs" {
  export type PrivacyEvalAnnotation = {
    label: string;
    entity_type: string;
    value: string;
  };
  export type PrivacyEvalDetection = {
    text: string;
    type: string;
    subtype?: string | null;
  };
  export type PrivacyEvalAssignment = {
    matched: Array<{ annotation: PrivacyEvalAnnotation; via: "detection" | "flagged" }>;
    missed: PrivacyEvalAnnotation[];
    flagged_only: PrivacyEvalAnnotation[];
    false_positives: Array<{
      detection: PrivacyEvalDetection;
      reason: string;
      annotation: PrivacyEvalAnnotation | null;
    }>;
    unmatched_flagged: PrivacyEvalDetection[];
  };
  export function normalizeText(value: string): string;
  export function textMatches(annotationValue: string, detectionText: string): boolean;
  export function occursInText(caseText: string, annotationValue: string): boolean;
  export function assignDetections(
    annotations: readonly PrivacyEvalAnnotation[],
    detections: readonly PrivacyEvalDetection[],
    flaggedItems?: readonly PrivacyEvalDetection[]
  ): PrivacyEvalAssignment;
}

declare module "*/privacy-eval/lib/metrics.mjs" {
  export type PrivacyEvalThresholds = {
    min_precision: number;
    min_recall: number;
    max_fnr: number;
  };
  export type PrivacyEvalCounts = { tp: number; fn: number; fp: number };
  export type PrivacyEvalMetrics = {
    tp: number;
    fn: number;
    fp: number;
    precision: number;
    recall: number;
    false_negative_rate: number;
  };
  export type PrivacyEvalGateFailure = {
    scope: string;
    metric: string;
    value: number | null;
    threshold: number | string;
  };
  export function computeMetrics(counts: PrivacyEvalCounts): PrivacyEvalMetrics;
  export function aggregateMetrics(
    entries: ReadonlyArray<{ type: string; tp: number; fn: number; fp: number }>
  ): { overall: PrivacyEvalMetrics; per_type: Record<string, PrivacyEvalMetrics> };
  export function evaluateThresholds(
    gateConfig: {
      overall: PrivacyEvalThresholds;
      per_type: Record<string, PrivacyEvalThresholds>;
    },
    metrics: { overall: PrivacyEvalMetrics; per_type: Record<string, PrivacyEvalMetrics> }
  ): { pass: boolean; failures: PrivacyEvalGateFailure[] };
}
