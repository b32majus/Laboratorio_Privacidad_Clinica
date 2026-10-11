/**
 * Review workspace (Work Order T07; SPEC_V4_APP_AND_REVIEW.md §4/§5/§9).
 *
 * Three-pane desktop layout, single-column stacked on tablet/mobile:
 *   left   — factual progress (counts from getProgress, never a score) and
 *            filters (status/type; D-008 keeps candidates visible);
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
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
  type Ref,
} from "react";

import type { ReviewDetection, ReviewSession } from "../../../js/domain/review-session.js";
import { getPreview, getProgress } from "../../../js/domain/review-session.js";
import {
  type DecisionExtras,
  type ExplicitDecisionStatus,
  type ManualDetectionInput,
} from "./review-domain";
import {
  type DocumentSegment,
  type StatusFilter,
  type WorkspaceFilters,
  buildDocumentSegments,
  decisionStatusOf,
  detectionTypes,
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

type KeepOriginalIntent = {
  readonly session: ReviewSession;
  readonly id: string;
  readonly type: string;
};

type ManualCapture = {
  readonly session: ReviewSession;
  readonly start: number;
  readonly end: number;
  readonly text: string;
};

type ManualReceipt = { readonly capture: ManualCapture; readonly type: string };
type ManualAdded = { readonly session: ReviewSession; readonly id: string };

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
  const [manualCapture, setManualCapture] = useState<ManualCapture | null>(null);
  const [manualType, setManualType] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualReceipt, setManualReceipt] = useState<ManualReceipt | null>(null);
  const [manualAdded, setManualAdded] = useState<ManualAdded | null>(null);
  const manualAuthorityRef = useRef(manualCapture);
  const sourceRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLButtonElement>(null);
  const manualPanelRef = useRef<HTMLFormElement>(null);
  const manualTypeRef = useRef<HTMLInputElement>(null);
  const manualNextRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const source = sourceRef.current;
    return () => {
      const selection = window.getSelection();
      if (
        selection &&
        (source?.contains(selection.anchorNode) || source?.contains(selection.focusNode))
      ) {
        selection.removeAllRanges();
      }
    };
  }, [session]);
  const [error, setError] = useState<string | null>(null);
  const [keepOriginalIntent, setKeepOriginalIntent] = useState<KeepOriginalIntent | null>(null);
  const intentRef = useRef(keepOriginalIntent);
  const keepOriginalRef = useRef<HTMLButtonElement>(null);
  const disposedRef = useRef(false);
  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      intentRef.current = null;
      manualAuthorityRef.current = null;
    };
  }, []);

  /**
   * Programmatic focus target for the small-viewport wayfinding route. The
   * inspector is focusable (`tabIndex={-1}`) so the route can hand focus to the
   * decision controls; this only ever runs on an explicit user activation.
   */
  const inspectorRef = useRef<HTMLElement>(null);
  const detectionListRef = useRef<HTMLElement>(null);
  const focusInspector = () => {
    inspectorRef.current?.focus();
  };

  const segments = useMemo(() => buildDocumentSegments(session), [session]);
  const detections = useMemo(() => visibleDetections(session, filters), [session, filters]);
  const selected = selectedId
    ? (session.detections.find((d) => d.id === selectedId) ?? null)
    : null;
  const currentContextRef = useRef({ session, selected });
  currentContextRef.current = { session, selected };
  const currentManual = manualCapture?.session === session ? manualCapture : null;
  if (manualCapture !== null && currentManual === null) {
    manualAuthorityRef.current = null;
    setManualCapture(null);
    setManualType("");
    setManualError(
      "El documento ha cambiado. Selecciona de nuevo un fragmento del texto original."
    );
  }
  if (manualAdded !== null && manualAdded.session !== session) setManualAdded(null);
  useEffect(() => {
    if (!currentManual) return;
    manualPanelRef.current?.scrollIntoView?.({ block: "start" });
    manualTypeRef.current?.focus({ preventScroll: true });
  }, [currentManual]);
  useEffect(() => {
    if (!manualReceipt) return;
    const { capture, type } = manualReceipt;
    const previous = capture.session;
    const added = session.detections.filter(
      (d) => !previous.detections.some((old) => old.id === d.id)
    );
    const detection = added[0];
    // A void bridge callback is not proof of success. Announce only the actual
    // canonical append, preserving the immutable source and prior review work.
    const applied =
      session !== previous &&
      session.originalText === previous.originalText &&
      session.sessionId === previous.sessionId &&
      session.decisions === previous.decisions &&
      session.detections.length === previous.detections.length + 1 &&
      previous.detections.every((old, i) => session.detections[i] === old) &&
      added.length === 1 &&
      detection.source === "manual" &&
      detection.requiresReview === true &&
      detection.start === capture.start &&
      detection.end === capture.end &&
      detection.original === capture.text &&
      detection.type === type;
    setManualReceipt(null);
    if (applied) {
      setManualCapture(null);
      setManualType("");
      setManualError(null);
      setManualAdded({ session, id: detection.id });
    } else if (session === previous) {
      manualAuthorityRef.current = capture;
      setManualError("No se pudo añadir el dato. Revisa el tipo y vuelve a intentarlo.");
    }
  }, [manualReceipt, session]);
  useEffect(() => {
    if (!manualAdded) return;
    manualNextRef.current?.scrollIntoView?.({ block: "nearest" });
    manualNextRef.current?.focus();
  }, [manualAdded]);
  const keepOriginalPending =
    keepOriginalIntent !== null &&
    keepOriginalIntent.session === session &&
    keepOriginalIntent.id === selected?.id &&
    keepOriginalIntent.type === selected.type;
  // Invalidate in render, not just after paint: intent cannot appear valid in
  // another context, or revive if the caller switches away and back.
  if (keepOriginalIntent !== null && !keepOriginalPending) {
    setKeepOriginalIntent(null);
  }
  intentRef.current = keepOriginalPending ? keepOriginalIntent : null;
  const clearKeepOriginal = () => {
    intentRef.current = null;
    setKeepOriginalIntent(null);
  };

  /**
   * Single coherent detection-selection transition used by every selection
   * path (left detection list, document surface). Transient inspector drafts
   * belong to the previously selected detection identity and must never
   * migrate to another detection, so they are cleared on every identity
   * change. Selection alone never touches review authority.
   */
  const selectDetection = (id: string | null) => {
    clearKeepOriginal();
    setSelectedId(id);
    setReplacementDraft("");
    setNoteDraft("");
  };

  const decide = (id: string, decision: ExplicitDecisionStatus) => {
    clearKeepOriginal();
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
    const capture = manualCapture;
    if (
      disposedRef.current ||
      !capture ||
      manualAuthorityRef.current !== capture ||
      currentContextRef.current.session !== capture.session
    )
      return;
    if (manualType.trim().length === 0) {
      setManualError("Escribe un tipo de dato para continuar.");
      return;
    }
    if (!validCapture(capture)) {
      setManualError(
        "No se puede comprobar el texto seleccionado. Selecciona de nuevo el texto original."
      );
      return;
    }
    manualAuthorityRef.current = null;
    try {
      onAddManual({ start: capture.start, end: capture.end, type: manualType.trim() });
      setManualReceipt({ capture, type: manualType.trim() });
    } catch {
      if (currentContextRef.current.session === capture.session && !disposedRef.current) {
        manualAuthorityRef.current = capture;
        setManualError("No se pudo añadir el dato. Revisa el tipo y vuelve a intentarlo.");
      }
    }
  };

  return (
    <section aria-labelledby="review-step-heading">
      <h2 id="review-step-heading" className="font-display text-xl font-bold text-primary-dark">
        Review
      </h2>
      <p className="mt-2 max-w-3xl text-base leading-relaxed">
        Review every detection in the document. Decisions are recorded in the job's review session;
        nothing is final until all mandatory decisions are complete.
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
          detectionListRef={detectionListRef}
          session={session}
          filters={filters}
          detections={detections}
          selectedId={selectedId}
          onFilterStatus={(status) => setFilters((current) => ({ ...current, status }))}
          onFilterType={(type) => setFilters((current) => ({ ...current, type }))}
          onSelect={selectDetection}
          onJumpToInspector={focusInspector}
        />
        <DocumentPane
          sourceRef={sourceRef}
          markRef={markRef}
          manualError={currentManual ? null : manualError}
          session={session}
          segments={segments}
          selectedId={selectedId}
          onSelect={selectDetection}
          onUseSelection={() => {
            const capture = selectionOffsets(sourceRef.current, session);
            manualAuthorityRef.current = capture;
            setManualCapture(capture);
            setManualType("");
            setManualAdded(null);
            setManualError(
              capture ? null : "Selecciona un fragmento del texto original y vuelve a marcarlo."
            );
          }}
        />
        <InspectorPane
          onReturnToDetections={() => detectionListRef.current?.focus()}
          inspectorRef={inspectorRef}
          session={session}
          selected={selected}
          replacementDraft={replacementDraft}
          noteDraft={noteDraft}
          manualCapture={currentManual}
          manualPanelRef={manualPanelRef}
          manualTypeRef={manualTypeRef}
          manualNextRef={manualNextRef}
          manualError={currentManual ? manualError : null}
          manualAdded={manualAdded?.session === session ? manualAdded : null}
          manualType={manualType}
          onReplacementDraft={setReplacementDraft}
          onNoteDraft={setNoteDraft}
          onDecide={decide}
          keepOriginalRef={keepOriginalRef}
          keepOriginalPending={keepOriginalPending}
          onKeepOriginal={() => {
            if (!selected) return;
            if (["FECHA", "EDAD", "UBICACION"].includes(selected.type)) {
              decide(selected.id, "restored");
            } else {
              setKeepOriginalIntent({ session, id: selected.id, type: selected.type });
            }
          }}
          onCancelKeepOriginal={() => {
            clearKeepOriginal();
            keepOriginalRef.current?.focus();
          }}
          onConfirmKeepOriginal={() => {
            const requested = keepOriginalIntent;
            const current = currentContextRef.current;
            if (
              disposedRef.current ||
              requested === null ||
              intentRef.current !== requested ||
              current.session !== requested.session ||
              current.selected?.id !== requested.id ||
              current.selected.type !== requested.type
            )
              return;
            // Consume synchronously before the sole mutation bridge, including
            // repeated activation before React has committed the next render.
            clearKeepOriginal();
            decide(requested.id, "restored");
            keepOriginalRef.current?.focus();
          }}
          onCancelManual={() => {
            manualAuthorityRef.current = null;
            setManualCapture(null);
            setManualType("");
            setManualError(null);
            markRef.current?.scrollIntoView?.({ block: "nearest" });
            markRef.current?.focus();
          }}
          onReviewManual={() => {
            if (manualAdded?.session !== currentContextRef.current.session) return;
            selectDetection(manualAdded.id);
            inspectorRef.current?.scrollIntoView?.({ block: "start" });
            focusInspector();
          }}
          onManualType={setManualType}
          onSubmitManual={submitManual}
        />
      </div>
    </section>
  );
}

function validCapture(capture: ManualCapture): boolean {
  const { session, start, end, text } = capture;
  return (
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    end > start &&
    end <= session.originalText.length &&
    session.originalText.slice(start, end) === text
  );
}

/** Prove a single Range against this workspace's complete source rendering. */
function selectionOffsets(
  source: HTMLDivElement | null,
  session: ReviewSession
): ManualCapture | null {
  const selection = window.getSelection();
  if (!source || !selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  let cursor = 0;
  // No unanchored interstitial text, nested decoration, missing segment or
  // fabricated/stale anchor can authorize even an apparently matching range.
  for (const child of source.childNodes) {
    if (
      !(child instanceof HTMLElement) ||
      child.childNodes.length !== 1 ||
      child.firstChild?.nodeType !== Node.TEXT_NODE
    )
      return null;
    const raw = child.getAttribute("data-source-start");
    if (raw === null || !/^\d+$/.test(raw) || Number(raw) !== cursor) return null;
    const text = child.firstChild.textContent ?? "";
    if (!text || session.originalText.slice(cursor, cursor + text.length) !== text) return null;
    cursor += text.length;
  }
  if (cursor !== session.originalText.length) return null;
  const start = boundaryOffset(range.startContainer, range.startOffset, source);
  const end = boundaryOffset(range.endContainer, range.endOffset, source);
  if (start === null || end === null) return null;
  const capture = { session, start, end, text: range.toString() };
  return validCapture(capture) ? capture : null;
}

function boundaryOffset(node: Node, offset: number, source: HTMLDivElement): number | null {
  if (!Number.isInteger(offset) || offset < 0) return null;
  // Element boundaries are child positions, never text-length guesses. The
  // entire source's direct one-text-node segments were proved above.
  if (node === source) {
    if (offset > source.childNodes.length) return null;
    if (offset === source.childNodes.length) {
      const last = source.lastChild;
      return last instanceof HTMLElement
        ? Number(last.dataset.sourceStart) + (last.textContent?.length ?? 0)
        : null;
    }
    const child = source.childNodes[offset];
    return child instanceof HTMLElement ? Number(child.dataset.sourceStart) : null;
  }
  if (node instanceof HTMLElement && node.parentElement === source) {
    if (offset > 1) return null;
    return Number(node.dataset.sourceStart) + (offset === 1 ? (node.textContent?.length ?? 0) : 0);
  }
  if (
    node.nodeType !== Node.TEXT_NODE ||
    node.parentElement?.parentElement !== source ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > (node.textContent?.length ?? 0)
  )
    return null;
  return Number(node.parentElement.getAttribute("data-source-start")) + offset;
}

function FilterProgressPane(props: {
  detectionListRef: Ref<HTMLElement>;
  session: ReviewSession;
  filters: WorkspaceFilters;
  detections: readonly ReviewDetection[];
  selectedId: string | null;
  onFilterStatus: (status: StatusFilter) => void;
  onFilterType: (type: string | null) => void;
  onSelect: (id: string) => void;
  /** Small-viewport wayfinding route to the Entity inspector (outcome D). */
  onJumpToInspector: () => void;
}): ReactElement {
  const {
    session,
    filters,
    detections,
    selectedId,
    onFilterStatus,
    onFilterType,
    onSelect,
    onJumpToInspector,
  } = props;
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
            <dt className="font-semibold">Low confidence:</dt>
            <dd> {progress.lowConfidence}</dd>
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
        ref={props.detectionListRef}
        tabIndex={-1}
        className={`rounded border border-primary bg-surface-light p-3 ${focusRing}`}
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
                      {detection.lowConfidence === true ? " · Low confidence" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {selectedId !== null && (
          /*
            Outcome D: on small viewports the inspector/decision controls stack
            below the document and preview, so a reviewer would have to traverse
            the whole workspace. This is a deliberate, native-button, keyboard
            route that hands focus to the inspector. It is hidden from `lg` up,
            where the inspector is already adjacent (no desktop focus jump), and
            it never itself records a decision.
          */
          <button
            type="button"
            onClick={onJumpToInspector}
            className={`mt-3 w-full rounded border border-primary-dark bg-primary-dark px-3 py-2 text-sm font-semibold text-white hover:bg-primary lg:hidden ${focusRing}`}
          >
            Go to decision controls for the selected detection
          </button>
        )}
      </section>
    </div>
  );
}

function DocumentPane(props: {
  sourceRef: Ref<HTMLDivElement>;
  markRef: Ref<HTMLButtonElement>;
  manualError: string | null;
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
            ref={props.markRef}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onUseSelection}
            className={`rounded border border-primary-dark px-2 py-1 text-xs font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
          >
            Marcar dato no detectado
          </button>
        </div>
        <div
          ref={props.sourceRef}
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
          Selecciona un fragmento del texto original y pulsa «Marcar dato no detectado».
        </p>
        {props.manualError && (
          <p role="alert" className="mt-2 text-sm font-semibold text-primary-dark">
            {props.manualError}
          </p>
        )}
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
  onReturnToDetections: () => void;
  /** Focus target handed to the small-viewport wayfinding route (outcome D). */
  inspectorRef: Ref<HTMLElement>;
  session: ReviewSession;
  selected: ReviewDetection | null;
  replacementDraft: string;
  noteDraft: string;
  manualCapture: ManualCapture | null;
  manualPanelRef: Ref<HTMLFormElement>;
  manualTypeRef: Ref<HTMLInputElement>;
  manualNextRef: Ref<HTMLButtonElement>;
  manualError: string | null;
  manualAdded: ManualAdded | null;
  manualType: string;
  onReplacementDraft: (value: string) => void;
  onNoteDraft: (value: string) => void;
  onDecide: (id: string, decision: ExplicitDecisionStatus) => void;
  keepOriginalRef: Ref<HTMLButtonElement>;
  keepOriginalPending: boolean;
  onKeepOriginal: () => void;
  onCancelKeepOriginal: () => void;
  onConfirmKeepOriginal: () => void;
  onCancelManual: () => void;
  onReviewManual: () => void;
  onManualType: (value: string) => void;
  onSubmitManual: (event: { preventDefault(): void }) => void;
}): ReactElement {
  const { session, selected } = props;
  return (
    <aside
      ref={props.inspectorRef}
      tabIndex={-1}
      aria-label="Entity inspector"
      className={`min-w-0 rounded border border-primary bg-surface-light p-3 self-start ${focusRing}`}
    >
      <h3 className="font-display text-base font-bold text-primary-dark">Entity inspector</h3>
      <button
        type="button"
        onClick={props.onReturnToDetections}
        className={`mt-2 rounded border border-primary-dark px-3 py-2 text-sm font-semibold text-primary-dark lg:hidden ${focusRing}`}
      >
        Volver a detecciones
      </button>
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
            </dd>
          </div>
          {selected.reason !== undefined && (
            <div>
              <dt className="font-semibold">Detection reason</dt>
              <dd className="font-mono">{selected.reason}</dd>
            </div>
          )}
          {selected.lowConfidence === true && (
            <div>
              <dt className="font-semibold">Low confidence</dt>
              <dd>Yes — below-threshold candidate</dd>
            </div>
          )}
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
          {selected.proposed === undefined ? (
            <>
              {/*
                Corrective C1: 'accepted' completes an EXISTING proposal; a
                detection without one must not offer a working Accept action.
                The factual reason is visible text (never color alone) and
                linked via aria-describedby; modification/restore stay
                available so the review can still be completed legitimately.
              */}
              <button
                type="button"
                disabled
                aria-describedby="accept-no-proposal-note"
                className={`w-full cursor-not-allowed rounded bg-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-600 ${focusRing}`}
              >
                Accept detection
              </button>
              <p id="accept-no-proposal-note" className="text-xs text-neutral-700">
                No proposal to accept: apply a modification or keep the original.
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => props.onDecide(selected.id, "accepted")}
              className={`w-full rounded bg-primary-dark px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary ${focusRing}`}
            >
              Accept detection
            </button>
          )}
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
            ref={props.keepOriginalRef}
            type="button"
            onClick={props.onKeepOriginal}
            aria-expanded={props.keepOriginalPending}
            aria-controls={props.keepOriginalPending ? "keep-original-confirmation" : undefined}
            className={`w-full rounded border border-primary-dark px-3 py-1.5 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
          >
            Mantener original
          </button>
          {props.keepOriginalPending && (
            <div
              id="keep-original-confirmation"
              role="group"
              aria-labelledby="keep-original-heading"
              aria-describedby="keep-original-consequence"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  props.onCancelKeepOriginal();
                }
              }}
              className="rounded border-2 border-primary-dark bg-white p-3 text-sm text-neutral-800"
            >
              <h4 id="keep-original-heading" className="font-bold">
                Confirmar mantener original
              </h4>
              <p id="keep-original-consequence" className="mt-1 leading-relaxed">
                El texto original, identificable, permanecerá sin cambios en el resultado preparado
                para compartir.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={props.onCancelKeepOriginal}
                  className={`rounded border border-primary-dark px-3 py-2 font-semibold ${focusRing}`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={props.onConfirmKeepOriginal}
                  className={`rounded bg-primary-dark px-3 py-2 font-semibold text-white hover:bg-primary ${focusRing}`}
                >
                  Sí, mantener original
                </button>
              </div>
            </div>
          )}
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

      {props.manualCapture && (
        <form
          ref={props.manualPanelRef}
          aria-label="Marcar dato"
          onSubmit={props.onSubmitManual}
          className="mt-3 scroll-mt-2 space-y-2 border-t border-primary pt-3"
        >
          <h4 className="text-sm font-bold text-primary-dark">Marcar dato</h4>
          <p id="manual-text-label" className="text-sm font-semibold">
            Texto seleccionado
          </p>
          <div
            aria-labelledby="manual-text-label"
            role="region"
            tabIndex={0}
            className={`max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-primary bg-white p-2 text-sm ${focusRing}`}
          >
            {props.manualCapture.text}
          </div>
          <div>
            <label htmlFor="manual-type" className="block text-sm font-semibold text-neutral-800">
              Tipo de dato
            </label>
            <input
              ref={props.manualTypeRef}
              id="manual-type"
              type="text"
              value={props.manualType}
              onChange={(event) => props.onManualType(event.target.value)}
              className={`mt-1 w-full rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
            />
          </div>
          <p className="text-xs text-neutral-700">
            Escribe el tipo que describa el dato, por ejemplo «Nombre» o «Contacto».
          </p>
          {props.manualError && (
            <p role="alert" className="text-sm font-semibold text-primary-dark">
              {props.manualError}
            </p>
          )}
          <button
            type="button"
            onClick={props.onCancelManual}
            className={`w-full rounded border border-primary-dark px-3 py-2 text-sm font-semibold ${focusRing}`}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={`w-full rounded bg-primary-dark px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary ${focusRing}`}
          >
            Añadir dato marcado
          </button>
        </form>
      )}
      {props.manualAdded && (
        <div className="mt-3 space-y-2">
          <p role="status">Dato añadido. Pendiente de revisar</p>
          <button
            ref={props.manualNextRef}
            type="button"
            onClick={props.onReviewManual}
            className={`w-full rounded border border-primary-dark px-3 py-2 text-sm font-semibold ${focusRing}`}
          >
            Revisar dato marcado
          </button>
        </div>
      )}
    </aside>
  );
}
