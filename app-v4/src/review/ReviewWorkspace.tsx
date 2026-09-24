/**
 * Review workspace (Work Order T07; SPEC_V4_APP_AND_REVIEW.md §4/§5/§9).
 *
 * Three-pane desktop layout, single-column stacked on tablet/mobile:
 *   left   — factual progress (counts from getProgress, never a score) and
 *            filters (status/type/low-confidence; D-008 keeps candidates visible);
 *   center — document surface rendering the immutable source text with
 *            detection spans from session offsets (never parsed back into
 *            state), plus the preview derived from the session;
 *   right  — entity inspector with decision controls and manual detection.
 *
 * The component is CONTROLLED: the ReviewSession comes in as a prop and all
 * decisions go out through `onDecide`/`onAddManual` to the domain state
 * bridge. Selected entity, filters, drafts and the manual form are transient
 * UI state held here; they can never certify or mutate review state.
 *
 * Accessibility (SPEC §9): everything is native button/input semantics,
 * keyboard-operable with visible focus rings, status is conveyed as text
 * (never color alone), and there is no hover-only essential information.
 * No floating action bar (SPEC §5). No export surface (T08 owns it).
 */
import { useMemo, useState, type ChangeEvent, type ReactElement } from "react";

import type { ReviewDetection, ReviewSession } from "../../../js/domain/review-session.js";
import { getPreview, getProgress } from "../../../js/domain/review-session.js";
import {
  type DecisionExtras,
  type ExplicitDecisionStatus,
  type ManualDetectionInput,
} from "./review-domain";
import {
  LOW_CONFIDENCE_THRESHOLD,
  type DocumentSegment,
  type StatusFilter,
  type WorkspaceFilters,
  buildDocumentSegments,
  decisionStatusOf,
  detectionTypes,
  isLowConfidence,
  statusLabel,
  visibleDetections,
} from "./reviewWorkspaceModel";

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

const STATUS_FILTERS: readonly { readonly value: StatusFilter; readonly label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "decided", label: "Decided" },
  { value: "accepted", label: "Accepted" },
  { value: "restored", label: "Restored" },
  { value: "manual", label: "Manual" },
  { value: "low-confidence", label: "Low confidence" },
];

export type ReviewWorkspaceProps = {
  /** The frozen domain session; the single review authority (D-004). */
  readonly session: ReviewSession;
  /** Apply an explicit decision through the domain state bridge. */
  readonly onDecide: (
    id: string,
    decision: ExplicitDecisionStatus,
    extras?: DecisionExtras
  ) => void;
  /** Add a manual detection anchored to source offsets. */
  readonly onAddManual: (detection: ManualDetectionInput) => void;
};

export function ReviewWorkspace(props: ReviewWorkspaceProps): ReactElement {
  const { session, onDecide, onAddManual } = props;

  // Transient UI state — never review authority.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<WorkspaceFilters>({ status: "all", type: null });
  const [replacementDraft, setReplacementDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [manualType, setManualType] = useState("");
  const [error, setError] = useState<string | null>(null);

  const segments = useMemo(() => buildDocumentSegments(session), [session]);
  const detections = useMemo(() => visibleDetections(session, filters), [session, filters]);
  const selected = selectedId
    ? (session.detections.find((d) => d.id === selectedId) ?? null)
    : null;

  const decide = (id: string, decision: ExplicitDecisionStatus) => {
    const note = noteDraft.trim().length > 0 ? { note: noteDraft.trim() } : {};
    try {
      if (decision === "modified") {
        onDecide(id, decision, { ...note, replacement: replacementDraft });
      } else {
        onDecide(id, decision, note);
      }
      setError(null);
      setReplacementDraft("");
      setNoteDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The decision could not be applied.");
    }
  };

  const submitManual = (event: { preventDefault(): void }) => {
    event.preventDefault();
    const start = Number(manualStart);
    const end = Number(manualEnd);
    try {
      onAddManual({ start, end, type: manualType });
      setError(null);
      setManualFormOpen(false);
      setManualStart("");
      setManualEnd("");
      setManualType("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The manual detection could not be added.");
    }
  };

  return (
    <section aria-labelledby="review-step-heading">
      <h2 id="review-step-heading" className="font-display text-xl font-bold text-primary-dark">
        Review
      </h2>
      <p className="mt-2 max-w-3xl text-base leading-relaxed">
        Review every detection in the document. Decisions are recorded in the job's review session;
        nothing is final until all mandatory decisions are complete. Manual detections are anchored
        to exact text offsets.
      </p>
      {error && (
        <p
          role="alert"
          className={`mt-3 max-w-3xl rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark ${focusRing}`}
        >
          {error}
        </p>
      )}

      <div role="region" aria-label="Review workspace" className="mt-4 grid gap-4 lg:grid-cols-3">
        <FilterProgressPane
          session={session}
          filters={filters}
          detections={detections}
          selectedId={selectedId}
          onFilterStatus={(status) => setFilters((current) => ({ ...current, status }))}
          onFilterType={(type) => setFilters((current) => ({ ...current, type }))}
          onSelect={setSelectedId}
        />
        <DocumentPane
          session={session}
          segments={segments}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setReplacementDraft("");
          }}
          onUseSelection={() => {
            const offsets = selectionOffsets();
            if (offsets) {
              setManualFormOpen(true);
              setManualStart(String(offsets.start));
              setManualEnd(String(offsets.end));
            } else {
              setManualFormOpen(true);
            }
          }}
        />
        <InspectorPane
          session={session}
          selected={selected}
          replacementDraft={replacementDraft}
          noteDraft={noteDraft}
          manualFormOpen={manualFormOpen}
          manualStart={manualStart}
          manualEnd={manualEnd}
          manualType={manualType}
          onReplacementDraft={setReplacementDraft}
          onNoteDraft={setNoteDraft}
          onDecide={decide}
          onManualFormOpen={setManualFormOpen}
          onManualStart={setManualStart}
          onManualEnd={setManualEnd}
          onManualType={setManualType}
          onSubmitManual={submitManual}
        />
      </div>
    </section>
  );
}

/** Map the current document selection to explicit source offsets. */
function selectionOffsets(): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const from = boundaryOffset(range.startContainer, range.startOffset);
  const to = boundaryOffset(range.endContainer, range.endOffset);
  if (from === null || to === null) return null;
  return { start: Math.min(from, to), end: Math.max(from, to) };
}

function boundaryOffset(node: Node | null, offset: number): number | null {
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const anchor = node.parentElement?.closest("[data-source-start]");
  if (!anchor) return null;
  const base = Number(anchor.getAttribute("data-source-start"));
  if (!Number.isInteger(base)) return null;
  // Each segment renders one text node, so the DOM offset maps 1:1 onto the
  // segment's source range: explicit offsets, never reconstructed markup.
  return base + offset;
}

function FilterProgressPane(props: {
  session: ReviewSession;
  filters: WorkspaceFilters;
  detections: readonly ReviewDetection[];
  selectedId: string | null;
  onFilterStatus: (status: StatusFilter) => void;
  onFilterType: (type: string | null) => void;
  onSelect: (id: string) => void;
}): ReactElement {
  const { session, filters, detections, selectedId, onFilterStatus, onFilterType, onSelect } =
    props;
  // Factual progress is domain-derived (getProgress): counts, never a score.
  const progress = getProgress(session);

  return (
    <div className="space-y-4">
      <section
        aria-label="Review filters and progress"
        className="rounded border border-primary bg-surface-light p-3"
      >
        <h3 className="font-display text-base font-bold text-primary-dark">Progress</h3>
        {progress && (
          <dl
            role="status"
            aria-label="Review progress"
            className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-800"
          >
            <dt className="font-semibold">Total:</dt>
            <dd> {progress.total}</dd>
            <dt className="font-semibold">Pending:</dt>
            <dd> {progress.pending}</dd>
            <dt className="font-semibold">Decided:</dt>
            <dd> {progress.decided}</dd>
            <dt className="font-semibold">Accepted:</dt>
            <dd> {progress.accepted}</dd>
            <dt className="font-semibold">Modified:</dt>
            <dd> {progress.modified}</dd>
            <dt className="font-semibold">Restored:</dt>
            <dd> {progress.restored}</dd>
            <dt className="font-semibold">Manual:</dt>
            <dd> {progress.manual}</dd>
            <dt className="col-span-2 mt-1 font-semibold">
              All mandatory decisions complete: {progress.canFinalize ? "yes" : "no"}
            </dt>
          </dl>
        )}
      </section>

      <section
        aria-label="Detection filters"
        className="rounded border border-primary bg-surface-light p-3"
      >
        <h3 className="font-display text-base font-bold text-primary-dark">Filters</h3>
        <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={filters.status === filter.value}
              onClick={() => onFilterStatus(filter.value)}
              className={`rounded border px-2 py-1 text-xs font-semibold ${
                filters.status === filter.value
                  ? "border-primary-dark bg-primary-dark text-white"
                  : "border-primary bg-white text-primary-dark hover:bg-surface-light"
              } ${focusRing}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label
          htmlFor="filter-by-type"
          className="mt-3 block text-sm font-semibold text-neutral-800"
        >
          Filter by type
        </label>
        <select
          id="filter-by-type"
          value={filters.type ?? ""}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onFilterType(event.target.value === "" ? null : event.target.value)
          }
          className={`mt-1 w-full rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
        >
          <option value="">All types</option>
          {detectionTypes(session).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </section>

      <section
        aria-label="Detection list"
        className="rounded border border-primary bg-surface-light p-3"
      >
        <h3 className="font-display text-base font-bold text-primary-dark">Detections</h3>
        {detections.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-700">No detections match the current filters.</p>
        ) : (
          <ul aria-label="Detections" className="mt-2 space-y-1">
            {detections.map((detection) => {
              const status = decisionStatusOf(session, detection.id);
              return (
                <li key={detection.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(detection.id)}
                    aria-current={selectedId === detection.id ? "true" : undefined}
                    className={`w-full rounded border px-2 py-1 text-left text-sm ${
                      selectedId === detection.id
                        ? "border-primary-dark bg-surface-dark text-white"
                        : "border-primary bg-white text-neutral-800 hover:bg-surface-light"
                    } ${focusRing}`}
                  >
                    <span className="font-semibold">{detection.type}</span>
                    {" — "}
                    <span className="font-mono">{truncate(detection.original)}</span>
                    <span className="block text-xs">
                      {statusLabel(status)}
                      {detection.source === "manual" ? " · Manual" : ""}
                      {isLowConfidence(detection) ? " · Low confidence" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function DocumentPane(props: {
  session: ReviewSession;
  segments: readonly DocumentSegment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUseSelection: () => void;
}): ReactElement {
  const { session, segments, selectedId, onSelect, onUseSelection } = props;
  return (
    <div className="space-y-4">
      <section aria-label="Document" className="rounded border border-primary bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-primary-dark">Document</h3>
          <button
            type="button"
            onClick={onUseSelection}
            className={`rounded border border-primary-dark px-2 py-1 text-xs font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
          >
            Add manual detection
          </button>
        </div>
        <div
          role="group"
          aria-label="Document text with detections"
          className="mt-2 whitespace-pre-wrap font-mono text-sm leading-relaxed text-neutral-900"
        >
          {segments.map((segment, index) => {
            if (segment.kind === "text") {
              return (
                <span key={index} data-source-start={segment.start}>
                  {segment.text}
                </span>
              );
            }
            const detectionId = segment.detectionIds[0];
            const detection = session.detections.find((d) => d.id === detectionId);
            const status = detection ? decisionStatusOf(session, detection.id) : "pending";
            return (
              <button
                key={index}
                type="button"
                data-source-start={segment.start}
                onClick={() => onSelect(detectionId)}
                aria-label={`${detection?.type ?? "Detection"}: "${segment.text}" — decision status: ${statusLabel(status)}`}
                className={`mx-px rounded-sm px-0.5 underline decoration-2 underline-offset-2 ${statusDecor(status)} ${
                  selectedId === detectionId ? "ring-2 ring-primary-dark" : ""
                } ${focusRing}`}
              >
                {segment.text}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-neutral-700">
          Select text and use “Add manual detection” to anchor a manual detection to exact offsets.
          Status is underlined and labeled: pending (dashed), accepted (solid), modified (double),
          restored/keep-original (dotted).
        </p>
      </section>

      <section aria-label="Preview" className="rounded border border-primary bg-surface-light p-3">
        <h3 className="font-display text-base font-bold text-primary-dark">Preview</h3>
        <p
          aria-label="Preview derived from the review session"
          className="mt-2 whitespace-pre-wrap font-mono text-sm leading-relaxed text-neutral-900"
        >
          {previewOf(session)}
        </p>
      </section>
    </div>
  );
}

/** Text-decorated, non-color-only status styles (SPEC §9). */
function statusDecor(status: string): string {
  switch (status) {
    case "accepted":
      return "decoration-solid";
    case "modified":
      return "decoration-double";
    case "restored":
      return "decoration-dotted";
    default:
      return "decoration-dashed";
  }
}

function previewOf(session: ReviewSession): string {
  // Derived purely from source offsets + decisions (D-004); the domain owns it.
  return getPreview(session);
}

function truncate(text: string): string {
  return text.length > 32 ? `${text.slice(0, 29)}…` : text;
}

function InspectorPane(props: {
  session: ReviewSession;
  selected: ReviewDetection | null;
  replacementDraft: string;
  noteDraft: string;
  manualFormOpen: boolean;
  manualStart: string;
  manualEnd: string;
  manualType: string;
  onReplacementDraft: (value: string) => void;
  onNoteDraft: (value: string) => void;
  onDecide: (id: string, decision: ExplicitDecisionStatus) => void;
  onManualFormOpen: (open: boolean) => void;
  onManualStart: (value: string) => void;
  onManualEnd: (value: string) => void;
  onManualType: (value: string) => void;
  onSubmitManual: (event: { preventDefault(): void }) => void;
}): ReactElement {
  const { session, selected } = props;
  return (
    <aside
      aria-label="Entity inspector"
      className="rounded border border-primary bg-surface-light p-3 self-start"
    >
      <h3 className="font-display text-base font-bold text-primary-dark">Entity inspector</h3>
      {!selected ? (
        <p className="mt-2 text-sm text-neutral-700">
          Select a detection in the document or the detection list to inspect it and decide.
        </p>
      ) : (
        <dl className="mt-2 space-y-2 text-sm text-neutral-800">
          <div>
            <dt className="font-semibold">Type</dt>
            <dd>
              {selected.type}
              {selected.subtype ? ` / ${selected.subtype}` : ""}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Original</dt>
            <dd>
              <code className="font-mono">{selected.original}</code>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Proposed replacement</dt>
            <dd>
              {selected.proposed === undefined ? (
                <span>None proposed</span>
              ) : selected.proposed === "" ? (
                <span>
                  <code className="font-mono">(empty)</code> — deletion
                </span>
              ) : (
                <code className="font-mono">{selected.proposed}</code>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Confidence</dt>
            <dd>
              {typeof selected.confidence === "number"
                ? `${Math.round(selected.confidence * 100)}%`
                : "Not provided"}
              {isLowConfidence(selected)
                ? ` — Low confidence (below ${LOW_CONFIDENCE_THRESHOLD}); it stays visible for explicit review.`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Context</dt>
            <dd className="font-mono">
              {session.originalText.slice(Math.max(0, selected.start - 40), selected.start)}[
              {selected.original}]{session.originalText.slice(selected.end, selected.end + 40)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Current decision</dt>
            <dd>{statusLabel(decisionStatusOf(session, selected.id))}</dd>
          </div>
        </dl>
      )}

      {selected && (
        <div className="mt-3 space-y-3 border-t border-primary pt-3">
          <button
            type="button"
            onClick={() => props.onDecide(selected.id, "accepted")}
            className={`w-full rounded bg-primary-dark px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary ${focusRing}`}
          >
            Accept detection
          </button>
          <div>
            <label
              htmlFor="replacement-input"
              className="block text-sm font-semibold text-neutral-800"
            >
              Replacement
            </label>
            <input
              id="replacement-input"
              type="text"
              value={props.replacementDraft}
              onChange={(event) => props.onReplacementDraft(event.target.value)}
              className={`mt-1 w-full rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
            />
            <button
              type="button"
              onClick={() => props.onDecide(selected.id, "modified")}
              className={`mt-1 w-full rounded border border-primary-dark px-3 py-1.5 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
            >
              Apply modification
            </button>
          </div>
          <button
            type="button"
            onClick={() => props.onDecide(selected.id, "restored")}
            className={`w-full rounded border border-primary-dark px-3 py-1.5 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
          >
            Keep original
          </button>
          <div>
            <label htmlFor="decision-note" className="block text-sm font-semibold text-neutral-800">
              Note (optional)
            </label>
            <textarea
              id="decision-note"
              value={props.noteDraft}
              onChange={(event) => props.onNoteDraft(event.target.value)}
              rows={2}
              className={`mt-1 w-full rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
            />
          </div>
        </div>
      )}

      {props.manualFormOpen && (
        <form
          aria-label="Add manual detection"
          onSubmit={props.onSubmitManual}
          className="mt-3 space-y-2 border-t border-primary pt-3"
        >
          <h4 className="text-sm font-bold text-primary-dark">Manual detection</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="manual-start"
                className="block text-sm font-semibold text-neutral-800"
              >
                Start offset
              </label>
              <input
                id="manual-start"
                type="number"
                min={0}
                value={props.manualStart}
                onChange={(event) => props.onManualStart(event.target.value)}
                className={`mt-1 w-full rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
              />
            </div>
            <div>
              <label htmlFor="manual-end" className="block text-sm font-semibold text-neutral-800">
                End offset
              </label>
              <input
                id="manual-end"
                type="number"
                min={0}
                value={props.manualEnd}
                onChange={(event) => props.onManualEnd(event.target.value)}
                className={`mt-1 w-full rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="manual-type" className="block text-sm font-semibold text-neutral-800">
              Detection type
            </label>
            <input
              id="manual-type"
              type="text"
              value={props.manualType}
              onChange={(event) => props.onManualType(event.target.value)}
              className={`mt-1 w-full rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
            />
          </div>
          <button
            type="submit"
            className={`w-full rounded bg-primary-dark px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary ${focusRing}`}
          >
            Add detection
          </button>
        </form>
      )}
    </aside>
  );
}
