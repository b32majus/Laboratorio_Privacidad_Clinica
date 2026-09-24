import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import "@testing-library/jest-dom/vitest";

import {
  addManualDetection,
  applyDecision,
  createReviewSession,
  getFinalText,
  type ManualDetectionInput,
  type ReviewSession,
} from "./review-domain";
import { ReviewWorkspace } from "./ReviewWorkspace";

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

  it("lists every detection with type, status label and low-confidence badge", () => {
    render(<Harness initial={buildSession()} />);
    // Status is conveyed by text, never by color alone.
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    // Low-confidence candidates stay visible (D-008) with a text badge.
    expect(screen.getAllByText("Low confidence").length).toBeGreaterThan(0);
    const list = screen.getByRole("list", { name: /detections/i });
    expect(list).toHaveTextContent("NOMBRE");
    expect(list).toHaveTextContent("612345678");
    expect(list).toHaveTextContent("2024/089756");
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
    fireEvent.click(screen.getByRole("button", { name: /keep original/i }));
    rerender(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(detectionSpanButton("2024/089756"));
    fireEvent.click(screen.getByRole("button", { name: /keep original/i }));

    const expected = SOURCE.slice(0, NAME_START) + "PACIENTE REEMPLAZO" + SOURCE.slice(NAME_END);
    expect(getFinalText(sessionRef.current)).toBe(expected);
  });

  it("keep-original (restored) is an explicit completed decision that stays visible", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(detectionSpanButton("Carmen Sánchez"));
    fireEvent.click(screen.getByRole("button", { name: /keep original/i }));

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
