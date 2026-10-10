import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import "@testing-library/jest-dom/vitest";

import {
  addManualDetection,
  applyDecision,
  createReviewSession,
  getFinalText,
  getPreview,
  getProgress,
  type ManualDetectionInput,
  type ReviewSession,
} from "./review-domain";
import { ReviewWorkspace, type ReviewWorkspaceProps } from "./ReviewWorkspace";

/**
 * User-level oracles for the review workspace (Work Order T07): the
 * component is driven around a REAL ReviewSession and every assertion
 * derives from domain state (progress, preview, final text), never from
 * private component internals. Fixtures are synthetic Spanish clinical
 * text; no real content anywhere.
 */
const SOURCE = "Nombre: Carmen Sánchez\nTeléfono 612345678. NHC 2024/089756.";
const NAME_START = SOURCE.indexOf("Carmen Sánchez");
const NAME_END = NAME_START + "Carmen Sánchez".length;
const PHONE_START = SOURCE.indexOf("612345678");
const PHONE_END = PHONE_START + "612345678".length;
const NHC_START = SOURCE.indexOf("2024/089756");
const NHC_END = NHC_START + "2024/089756".length;
const WORD_START = SOURCE.indexOf("Teléfono");
const WORD_END = WORD_START + "Teléfono".length;

/** Deterministic three-detection session built through the real domain API. */
function buildSession(): ReviewSession {
  return createReviewSession({
    originalText: SOURCE,
    sessionId: "workspace-test",
    detections: [
      {
        type: "NOMBRE",
        start: NAME_START,
        end: NAME_END,
        confidence: 0.95,
        proposed: "PACIENTE-1",
      },
      { type: "IDENTIFICADOR", start: PHONE_START, end: PHONE_END, confidence: 0.6, proposed: "" },
      { type: "IDENTIFICADOR", start: NHC_START, end: NHC_END, confidence: 0.9, proposed: "ID-1" },
    ],
  });
}

/** Test harness: holds the session as domain state and exposes it for probing. */
function Harness(props: { initial: ReviewSession; sessionRef?: { current: ReviewSession } }) {
  const { initial, sessionRef } = props;
  const [session, setSession] = useState(initial);
  const ref = sessionRef ?? { current: initial };
  ref.current = session;
  return (
    <ReviewWorkspace
      session={session}
      onDecide={(id, decision, extras) => {
        const next = applyDecision(session, id, decision, extras);
        ref.current = next;
        setSession(next);
      }}
      onAddManual={(spec: ManualDetectionInput) => {
        const next = addManualDetection(session, spec);
        ref.current = next;
        setSession(next);
      }}
    />
  );
}

function detectionSpanButton(original: string) {
  const candidates = screen.getAllByRole("button", { name: new RegExp(original) });
  return candidates[0];
}

afterEach(cleanup);

describe("Mantener original — explicit contextual intent", () => {
  it("never silently accepts a low-confidence candidate while intent is pending or cancelled", () => {
    const session = createReviewSession({
      originalText: "Candidato sintético",
      detections: [
        {
          type: "SOSPECHOSO",
          start: 0,
          end: 19,
          proposed: "",
          lowConfidence: true,
          confidence: 0.2,
        },
      ],
    });
    const ref = { current: session };
    render(<Harness initial={session} sessionRef={ref} />);
    fireEvent.click(detectionSpanButton("Candidato sintético"));
    fireEvent.click(screen.getByRole("button", { name: /^Mantener original$/ }));
    expect(screen.getByRole("status", { name: "Review progress" })).toHaveTextContent(
      "Low confidence: 1"
    );
    expect(ref.current).toBe(session);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(ref.current.decisions).toEqual({});
    expect(getProgress(ref.current).accepted).toBe(0);
    expect(getProgress(ref.current).pending).toBe(1);
  });
  it.each(["SOSPECHOSO", "CUSTOM_MANUAL", "DESCONOCIDO", "FECHA", "EDAD", "UBICACION"])(
    "%s distinguishes conservative confirmation from ordinary one-click decisions",
    (type) => {
      const initial = createReviewSession({
        originalText: "Valor sintético",
        detections: [],
        sessionId: type,
      });
      const session = addManualDetection(initial, { start: 0, end: 15, type });
      const onDecide = vi.fn();
      render(<ReviewWorkspace session={session} onDecide={onDecide} onAddManual={vi.fn()} />);
      fireEvent.click(detectionSpanButton("Valor sintético"));
      fireEvent.click(screen.getByRole("button", { name: /^Mantener original$/ }));
      if (["FECHA", "EDAD", "UBICACION"].includes(type)) {
        expect(onDecide).toHaveBeenCalledExactlyOnceWith(session.detections[0].id, "restored", {});
        expect(
          screen.queryByRole("button", { name: "Sí, mantener original" })
        ).not.toBeInTheDocument();
      } else {
        expect(onDecide).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Sí, mantener original" })).toBeInTheDocument();
      }
      expect(session.decisions).toEqual({});
    }
  );

  it("invalidates intent on entity/session changes, including a reused detection ID", () => {
    const first = buildSession();
    const second = buildSession(); // Same sessionId and generated detection IDs; different immutable authority.
    expect(second.detections[0].id).toBe(first.detections[0].id);
    const onDecide = vi.fn();
    const props = { onDecide, onAddManual: vi.fn() };
    const view = render(<ReviewWorkspace session={first} {...props} />);
    const open = () => {
      fireEvent.click(detectionSpanButton("Carmen Sánchez"));
      fireEvent.click(screen.getByRole("button", { name: /^Mantener original$/ }));
      return screen.getByRole("button", { name: "Sí, mantener original" });
    };
    const entityConfirm = open();
    fireEvent.click(detectionSpanButton("612345678"));
    expect(screen.queryByRole("button", { name: "Sí, mantener original" })).not.toBeInTheDocument();
    fireEvent.click(entityConfirm);
    const sessionConfirm = open();
    view.rerender(<ReviewWorkspace session={second} {...props} />);
    expect(screen.queryByRole("button", { name: "Sí, mantener original" })).not.toBeInTheDocument();
    fireEvent.click(sessionConfirm);
    view.rerender(<ReviewWorkspace session={first} {...props} />);
    expect(screen.queryByRole("button", { name: "Sí, mantener original" })).not.toBeInTheDocument();
    open();
    fireEvent.keyDown(screen.getByRole("button", { name: "Cancelar" }), { key: "Escape" });
    expect(screen.getByRole("button", { name: /^Mantener original$/ })).toHaveFocus();
    const unmountedConfirm = open();
    view.unmount();
    fireEvent.click(unmountedConfirm);
    render(<ReviewWorkspace session={first} {...props} />);
    fireEvent.click(detectionSpanButton("Carmen Sánchez"));
    expect(screen.queryByRole("button", { name: "Sí, mantener original" })).not.toBeInTheDocument();
    expect(onDecide).not.toHaveBeenCalled();
    expect(first.decisions).toEqual({});
    expect(second.decisions).toEqual({});
    expect(getProgress(first)?.pending).toBe(3);
    expect(getProgress(second)?.restored).toBe(0);
  });

  it.each(["NOMBRE", "IDENTIFICADOR"])(
    "keeps %s unchanged until Confirm, then permits correction",
    (type) => {
      let session = buildSession();
      const target = session.detections.find((d) => d.type === type)!;
      for (const detection of session.detections) {
        if (detection.id !== target.id) session = applyDecision(session, detection.id, "accepted");
      }
      const before = session;
      const onDecide = vi.fn<ReviewWorkspaceProps["onDecide"]>((id, decision, extras) => {
        session = applyDecision(session, id, decision, extras);
        view.rerender(
          <ReviewWorkspace session={session} onDecide={onDecide} onAddManual={vi.fn()} />
        );
      });
      const view = render(
        <ReviewWorkspace session={session} onDecide={onDecide} onAddManual={vi.fn()} />
      );
      fireEvent.click(detectionSpanButton(target.original));
      fireEvent.change(screen.getByLabelText("Replacement"), { target: { value: "CORRECCIÓN" } });
      fireEvent.change(screen.getByLabelText("Note (optional)"), {
        target: { value: "Nota sintética" },
      });
      fireEvent.click(screen.getByRole("button", { name: /^Mantener original$/ }));
      const warning = screen.getByRole("group", { name: "Confirmar mantener original" });
      expect(warning).toHaveTextContent(
        "El texto original, identificable, permanecerá sin cambios en el resultado preparado para compartir."
      );
      expect(warning).not.toHaveTextContent(target.original);
      expect(onDecide).not.toHaveBeenCalled();
      expect(session).toBe(before);
      expect(getProgress(session)?.restored).toBe(0);
      expect(getPreview(session)).toBe(getPreview(before));
      expect(() => getFinalText(session)).toThrow(/mandatory review decision.*pending/);
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(session).toBe(before);
      expect(onDecide).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Replacement")).toHaveValue("CORRECCIÓN");
      expect(screen.getByLabelText("Note (optional)")).toHaveValue("Nota sintética");
      expect(screen.getByRole("button", { name: /^Mantener original$/ })).toHaveFocus();
      fireEvent.click(screen.getByRole("button", { name: /^Mantener original$/ }));
      const confirm = screen.getByRole("button", { name: "Sí, mantener original" });
      fireEvent.click(confirm);
      fireEvent.click(confirm);
      expect(onDecide).toHaveBeenCalledTimes(1);
      expect(onDecide).toHaveBeenCalledWith(target.id, "restored", { note: "Nota sintética" });
      expect(getProgress(session)?.restored).toBe(1);
      expect(getFinalText(session)).toContain(target.original);
      expect(screen.getByRole("button", { name: /^Mantener original$/ })).toHaveFocus();
      fireEvent.change(screen.getByLabelText("Replacement"), { target: { value: "CORRECCIÓN" } });
      fireEvent.click(screen.getByRole("button", { name: /apply modification/i }));
      expect(getFinalText(session)).not.toContain(target.original);
      expect(getFinalText(session)).toContain("CORRECCIÓN");
      expect(getProgress(session)?.accepted).toBe(2);
    }
  );
});

describe("ReviewWorkspace — progress and detection list derived from the session", () => {
  it("shows factual progress counts (never a score)", () => {
    render(<Harness initial={buildSession()} />);
    const progress = screen.getByRole("status", { name: /review progress/i });
    expect(progress).toHaveTextContent("Total: 3");
    expect(progress).toHaveTextContent("Pending: 3");
    expect(progress).toHaveTextContent("Decided: 0");
    expect(progress).toHaveTextContent("Accepted: 0");
    expect(progress).toHaveTextContent("Modified: 0");
    expect(progress).toHaveTextContent("Restored: 0");
    expect(progress).toHaveTextContent("Manual: 0");
    expect(progress).toHaveTextContent(/all mandatory decisions complete: no/i);
  });

  it("lists every detection with type and status label", () => {
    render(<Harness initial={buildSession()} />);
    // Status is conveyed by text, never by color alone.
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    // Every detection in the session stays visible and listable.
    const list = screen.getByRole("list", { name: /detections/i });
    expect(list).toHaveTextContent("NOMBRE");
    expect(list).toHaveTextContent("612345678");
    expect(list).toHaveTextContent("2024/089756");
  });
});

describe("ReviewWorkspace — transient inspector drafts never cross detection identity", () => {
  /** Left-pane detection list button for one detection. */
  function leftListButton(original: string) {
    return within(screen.getByRole("list", { name: /detections/i })).getByRole("button", {
      name: new RegExp(original),
    });
  }

  /** Document-surface span button for one detection. */
  function documentSurfaceButton(original: string) {
    return within(screen.getByRole("region", { name: /document/i })).getByRole("button", {
      name: new RegExp(original),
    });
  }

  it("replacement drafted for A cannot appear on B after selection via the left detection list", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    // Audit reproduction: A is selected on the document surface, B via the left list.
    fireEvent.click(documentSurfaceButton("Carmen Sánchez"));
    fireEvent.change(screen.getByLabelText("Replacement"), { target: { value: "A-ONLY" } });
    fireEvent.click(leftListButton("612345678"));
    expect(screen.getByLabelText("Replacement")).toHaveValue("");
  });

  it("note drafted for A cannot appear on B after selection via the left detection list", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(leftListButton("Carmen Sánchez"));
    fireEvent.change(screen.getByLabelText("Note (optional)"), {
      target: { value: "A-NOTE-ONLY" },
    });
    fireEvent.click(leftListButton("612345678"));
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("");
  });

  it("document-surface selection obeys the same draft-hygiene invariant", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(documentSurfaceButton("Carmen Sánchez"));
    fireEvent.change(screen.getByLabelText("Replacement"), { target: { value: "A-ONLY" } });
    fireEvent.change(screen.getByLabelText("Note (optional)"), {
      target: { value: "A-NOTE-ONLY" },
    });
    fireEvent.click(documentSurfaceButton("612345678"));
    expect(screen.getByLabelText("Replacement")).toHaveValue("");
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("");
  });

  it("selection alone leaves review decisions untouched (domain-owned)", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(leftListButton("Carmen Sánchez"));
    fireEvent.click(leftListButton("612345678"));
    fireEvent.click(documentSurfaceButton("2024/089756"));
    // No decision was recorded by mere selection.
    expect(Object.keys(sessionRef.current.decisions)).toHaveLength(0);
    const progress = screen.getByRole("status", { name: /review progress/i });
    expect(progress).toHaveTextContent("Pending: 3");
    expect(progress).toHaveTextContent("Decided: 0");
  });
});

describe("ReviewWorkspace — decision actions mutate the session", () => {
  it("accepting a pending detection changes progress and the derived preview", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(detectionSpanButton("Carmen Sánchez"));
    fireEvent.click(screen.getByRole("button", { name: /accept detection/i }));

    const progress = screen.getByRole("status", { name: /review progress/i });
    expect(progress).toHaveTextContent("Pending: 2");
    expect(progress).toHaveTextContent("Accepted: 1");
    // Preview is derived from the session, not from rendered markup.
    const preview = screen.getByLabelText(/preview derived from the review session/i);
    expect(preview).toHaveTextContent("PACIENTE-1");
    expect(preview).not.toHaveTextContent("Carmen Sánchez");
  });

  it("modify changes the exact final-domain replacement, not only markup", () => {
    const sessionRef = { current: buildSession() };
    const { rerender } = render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(detectionSpanButton("Carmen Sánchez"));
    fireEvent.change(screen.getByLabelText("Replacement"), {
      target: { value: "PACIENTE REEMPLAZO" },
    });
    fireEvent.click(screen.getByRole("button", { name: /apply modification/i }));
    expect(screen.getByRole("status", { name: /review progress/i })).toHaveTextContent(
      "Modified: 1"
    );

    // Complete the rest with explicit keep-original decisions.
    fireEvent.click(detectionSpanButton("612345678"));
    fireEvent.click(screen.getByRole("button", { name: /^Mantener original$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, mantener original" }));
    rerender(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(detectionSpanButton("2024/089756"));
    fireEvent.click(screen.getByRole("button", { name: /^Mantener original$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, mantener original" }));

    const expected = SOURCE.slice(0, NAME_START) + "PACIENTE REEMPLAZO" + SOURCE.slice(NAME_END);
    expect(getFinalText(sessionRef.current)).toBe(expected);
  });

  it("keep-original (restored) is an explicit completed decision that stays visible", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(detectionSpanButton("Carmen Sánchez"));
    fireEvent.click(screen.getByRole("button", { name: /^Mantener original$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, mantener original" }));

    const progress = screen.getByRole("status", { name: /review progress/i });
    expect(progress).toHaveTextContent("Restored: 1");
    expect(progress).toHaveTextContent("Decided: 1");
    expect(progress).toHaveTextContent("Pending: 2");
    // The restored detection stays visible with a text status label.
    const list = screen.getByRole("list", { name: /detections/i });
    expect(list).toHaveTextContent("Restored");
    // The Restored filter narrows the list to restored detections only.
    fireEvent.click(screen.getByRole("button", { name: /^Restored$/ }));
    const filtered = screen.getByRole("list", { name: /detections/i });
    expect(filtered).toHaveTextContent("Carmen Sánchez");
    expect(filtered).not.toHaveTextContent("612345678");
  });

  it("manual detection via explicit offsets affects the same session without corrupting decisions", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    // Make one explicit decision first.
    fireEvent.click(detectionSpanButton("Carmen Sánchez"));
    fireEvent.click(screen.getByRole("button", { name: /accept detection/i }));

    fireEvent.click(screen.getByRole("button", { name: /add manual detection/i }));
    fireEvent.change(screen.getByLabelText("Start offset"), {
      target: { value: String(WORD_START) },
    });
    fireEvent.change(screen.getByLabelText("End offset"), {
      target: { value: String(WORD_END) },
    });
    fireEvent.change(screen.getByLabelText("Detection type"), {
      target: { value: "PALABRA_CLAVE" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Add detection$/i }));

    const progress = screen.getByRole("status", { name: /review progress/i });
    expect(progress).toHaveTextContent("Manual: 1");
    expect(progress).toHaveTextContent("Pending: 3");
    expect(progress).toHaveTextContent("Accepted: 1");
    const list = screen.getByRole("list", { name: /detections/i });
    expect(list).toHaveTextContent("Teléfono");
  });

  it("manual detection via document text selection prefills explicit offsets", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    const segment = screen.getByText(
      (_, element) =>
        element?.tagName === "SPAN" && (element.textContent ?? "").includes("Teléfono")
    );
    const textNode = segment.firstChild as Text;
    const fakeSelection = {
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => ({
        startContainer: textNode,
        startOffset: 1, // "T" of Teléfono inside the segment starting at 22
        endContainer: textNode,
        endOffset: 9, // end of "Teléfono"
      }),
    };
    const spy = vi
      .spyOn(window, "getSelection")
      .mockReturnValue(fakeSelection as unknown as Selection);
    try {
      const surface = screen.getByRole("group", { name: /document text with detections/i });
      fireEvent.mouseUp(surface);
      fireEvent.click(screen.getByRole("button", { name: /add manual detection/i }));
      expect(screen.getByLabelText("Start offset")).toHaveValue(WORD_START);
      expect(screen.getByLabelText("End offset")).toHaveValue(WORD_END);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("ReviewWorkspace — accepted requires an existing proposal (C1)", () => {
  /** Manual detection over the NHC span: no proposal (proposed === undefined). */
  function manualNoProposalSession(): ReviewSession {
    const base = createReviewSession({
      originalText: SOURCE,
      sessionId: "manual-c1",
      detections: [],
    });
    return addManualDetection(base, { start: NHC_START, end: NHC_END, type: "SOSPECHOSO" });
  }

  it("cannot accept a detection without a proposal: the action is disabled and inert", () => {
    const sessionRef = { current: manualNoProposalSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(detectionSpanButton("2024/089756"));
    const accept = screen.getByRole("button", { name: /accept detection/i });
    expect(accept).toBeDisabled();
    // Clicking the disabled action records no decision (domain unchanged).
    fireEvent.click(accept);
    expect(Object.keys(sessionRef.current.decisions)).toHaveLength(0);
    expect(screen.getByRole("status", { name: /review progress/i })).toHaveTextContent(
      "Pending: 1"
    );
    // The block is explained factually, not by color alone.
    expect(accept).toHaveAccessibleDescription(/no proposal/i);
  });

  it("still completes a proposal-less detection legitimately via modification", () => {
    const sessionRef = { current: manualNoProposalSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(detectionSpanButton("2024/089756"));
    fireEvent.change(screen.getByLabelText("Replacement"), {
      target: { value: "ID-REEMPLAZO" },
    });
    fireEvent.click(screen.getByRole("button", { name: /apply modification/i }));
    expect(screen.getByRole("status", { name: /review progress/i })).toHaveTextContent(
      "Modified: 1"
    );
    const preview = screen.getByLabelText(/preview derived from the review session/i);
    expect(preview).toHaveTextContent("ID-REEMPLAZO");
    expect(preview).not.toHaveTextContent("2024/089756");
  });

  it('keeps Accept working for a detection WITH a proposal (including deletion "")', () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(detectionSpanButton("612345678")); // proposed === "" (deletion)
    const accept = screen.getByRole("button", { name: /accept detection/i });
    expect(accept).toBeEnabled();
    fireEvent.click(accept);
    expect(screen.getByRole("status", { name: /review progress/i })).toHaveTextContent(
      "Accepted: 1"
    );
    const preview = screen.getByLabelText(/preview derived from the review session/i);
    expect(preview).not.toHaveTextContent("612345678");
  });
});

describe("ReviewWorkspace — transient UI state never certifies or mutates review state", () => {
  it("rerendering and changing filters leave the session untouched", () => {
    const sessionRef = { current: buildSession() };
    const { rerender } = render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(detectionSpanButton("Carmen Sánchez"));
    fireEvent.click(screen.getByRole("button", { name: /accept detection/i }));
    const afterDecision = sessionRef.current;

    // Re-render with the same domain state (navigation away/back in App).
    rerender(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    expect(sessionRef.current).toBe(afterDecision);
    expect(screen.getByRole("status", { name: /review progress/i })).toHaveTextContent(
      "Accepted: 1"
    );

    // Pure UI interaction (filters, selection) must not mutate domain state.
    fireEvent.click(screen.getByRole("button", { name: /^Pending/ }));
    fireEvent.click(screen.getByRole("button", { name: /all statuses/i }));
    fireEvent.click(detectionSpanButton("Carmen Sánchez"));
    expect(sessionRef.current).toBe(afterDecision);
  });
});

describe("ReviewWorkspace — filters", () => {
  it("narrows the detection list by status and type without touching the session", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(detectionSpanButton("Carmen Sánchez"));
    fireEvent.click(screen.getByRole("button", { name: /accept detection/i }));

    fireEvent.click(screen.getByRole("button", { name: /^Pending/ }));
    let list = screen.getByRole("list", { name: /detections/i });
    expect(list).not.toHaveTextContent("Carmen Sánchez");
    expect(list).toHaveTextContent("612345678");

    fireEvent.click(screen.getByRole("button", { name: /^Accepted$/ }));
    list = screen.getByRole("list", { name: /detections/i });
    expect(list).toHaveTextContent("Carmen Sánchez");
    expect(list).not.toHaveTextContent("612345678");

    fireEvent.click(screen.getByRole("button", { name: /all statuses/i }));
    fireEvent.change(screen.getByLabelText(/filter by type/i), {
      target: { value: "NOMBRE" },
    });
    list = screen.getByRole("list", { name: /detections/i });
    expect(list).toHaveTextContent("Carmen Sánchez");
    expect(list).not.toHaveTextContent("2024/089756");
  });
});

describe("ReviewWorkspace — keyboard operability and responsive surfaces", () => {
  it("exposes primary actions as keyboard-operable buttons with visible focus", () => {
    render(<Harness initial={buildSession()} />);
    const accept = screen.getByRole("button", { name: /all statuses/i });
    expect(accept.tagName).toBe("BUTTON");
    accept.focus();
    expect(accept).toHaveFocus();
    // Focus visibility: compiled focus-visible ring utility classes present.
    expect(accept).toHaveClass("focus-visible:ring-2");
    const detectionButton = detectionSpanButton("Carmen Sánchez");
    expect(detectionButton.tagName).toBe("BUTTON");
    detectionButton.focus();
    expect(detectionButton).toHaveFocus();
    expect(detectionButton).toHaveClass("focus-visible:ring-2");
  });

  it("renders one responsive workspace containing filters/progress, document and inspector", () => {
    render(<Harness initial={buildSession()} />);
    // Same DOM for desktop and mobile: a responsive grid, stacked on small screens.
    const container = screen.getByRole("region", { name: /review workspace/i });
    expect(container).toHaveClass("lg:grid-cols-3");
    expect(screen.getByRole("status", { name: /review progress/i })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /document text with detections/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: /entity inspector/i })).toBeInTheDocument();
    // No hover-only or color-only information: decisions are labeled in text.
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
  });

  it("inspector shows original, proposal, type, confidence and context when a detection is selected", () => {
    render(<Harness initial={buildSession()} />);
    fireEvent.click(detectionSpanButton("Carmen Sánchez"));
    const inspector = screen.getByRole("complementary", { name: /entity inspector/i });
    expect(inspector).toHaveTextContent("Carmen Sánchez");
    expect(inspector).toHaveTextContent("PACIENTE-1");
    expect(inspector).toHaveTextContent("NOMBRE");
    expect(inspector).toHaveTextContent("95%");
  });
});

describe("ReviewWorkspace — mobile route from selection to decision controls (outcome D)", () => {
  it("returns focus to the existing detection list after Cancel and Confirm without changing selection", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(detectionSpanButton("Carmen Sánchez"));
    for (const action of ["Cancelar", "Sí, mantener original"]) {
      fireEvent.click(screen.getByRole("button", { name: /^Mantener original$/ }));
      fireEvent.click(screen.getByRole("button", { name: action }));
      const before = sessionRef.current;
      const back = screen.getByRole("button", { name: "Volver a detecciones" });
      expect(back).toHaveClass("lg:hidden", "focus-visible:ring-2");
      fireEvent.click(back);
      expect(screen.getByRole("region", { name: "Detection list" })).toHaveFocus();
      expect(sessionRef.current).toBe(before);
      expect(
        within(screen.getByRole("list", { name: "Detections" })).getByRole("button", {
          name: /Carmen Sánchez/,
        })
      ).toHaveAttribute("aria-current", "true");
    }
    expect(getProgress(sessionRef.current)?.pending).toBe(2);
  });
  /** Left-pane detection list button for one detection. */
  function leftListDetection(original: string): HTMLElement {
    return within(screen.getByRole("list", { name: /detections/i })).getByRole("button", {
      name: new RegExp(original),
    });
  }

  /** Document-surface span button for one detection. */
  function documentSpan(original: string): HTMLElement {
    return within(screen.getByRole("region", { name: /document/i })).getByRole("button", {
      name: new RegExp(original),
    });
  }

  function inspector(): HTMLElement {
    return screen.getByRole("complementary", { name: /entity inspector/i });
  }

  function route(): HTMLElement {
    return screen.getByRole("button", { name: /go to decision controls/i });
  }

  it("offers no route to the inspector until a detection is selected", () => {
    render(<Harness initial={buildSession()} />);
    expect(
      screen.queryByRole("button", { name: /go to decision controls/i })
    ).not.toBeInTheDocument();
  });

  it("provides a keyboard-operable, mobile-only route to the inspector without recording a decision", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(leftListDetection("Carmen Sánchez"));

    // Selection alone never moves focus: the route is an explicit control.
    expect(inspector()).not.toHaveFocus();

    const jump = route();
    expect(jump.tagName).toBe("BUTTON");
    expect(jump).toHaveClass("focus-visible:ring-2");
    // Mobile-only affordance: the inspector is adjacent at the desktop breakpoint.
    expect(jump).toHaveClass("lg:hidden");

    jump.focus();
    expect(jump).toHaveFocus();
    fireEvent.click(jump);
    expect(inspector()).toHaveFocus();

    // Moving focus is wayfinding, never a decision on the ReviewSession.
    expect(Object.keys(sessionRef.current.decisions)).toHaveLength(0);
    expect(screen.getByRole("status", { name: /review progress/i })).toHaveTextContent(
      "Pending: 3"
    );
    expect(screen.getByRole("status", { name: /review progress/i })).toHaveTextContent(
      "Decided: 0"
    );
  });

  it("also routes to the inspector after selecting a detection on the document surface", () => {
    render(<Harness initial={buildSession()} />);
    fireEvent.click(documentSpan("Carmen Sánchez"));
    const jump = route();
    fireEvent.click(jump);
    expect(inspector()).toHaveFocus();
  });

  it("selection alone never moves focus to the inspector", () => {
    render(<Harness initial={buildSession()} />);
    fireEvent.click(leftListDetection("Carmen Sánchez"));
    expect(inspector()).not.toHaveFocus();
    fireEvent.click(leftListDetection("612345678"));
    expect(inspector()).not.toHaveFocus();
  });
});
