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

/** Real DOM Range: only source-anchored text nodes, not simulated offset input. */
function selectSource(start: number, end: number) {
  const group = screen.getByRole("group", { name: "Document text with detections" });
  const anchors = Array.from(group.querySelectorAll<HTMLElement>("[data-source-start]"));
  const boundary = (position: number, isEnd: boolean) => {
    const anchor = anchors.find((element) => {
      const base = Number(element.dataset.sourceStart);
      const limit = base + (element.textContent?.length ?? 0);
      return isEnd ? position > base && position <= limit : position >= base && position < limit;
    });
    if (!anchor?.firstChild) throw new Error("Missing synthetic source boundary");
    return { node: anchor.firstChild, offset: position - Number(anchor.dataset.sourceStart) };
  };
  const from = boundary(start, false);
  const to = boundary(end, true);
  const range = document.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
}

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  cleanup();
});

describe("Review productivity — current context", () => {
  it("uses source order for pending manual appends, not append order", () => {
    const base = buildSession();
    const session = addManualDetection(base, { start: 0, end: 6, type: "CONTEXTO" });
    render(<Harness initial={session} />);
    const inspector = screen.getByRole("complementary", { name: "Entity inspector" });
    expect(inspector).toHaveTextContent("OriginalNombre");
    expect(screen.getByRole("button", { name: "Anterior pendiente" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente pendiente" }));
    expect(inspector).toHaveTextContent("OriginalCarmen Sánchez");
    expect(session.decisions).toEqual({});
  });

  it("preserves an empty source's manual append as the same context without auto-selection or focus revocation", () => {
    const initial = createReviewSession({
      originalText: "Texto sintético",
      detections: [],
      sessionId: "empty-source",
    });
    const ref = { current: initial };
    render(<Harness initial={initial} sessionRef={ref} />);
    selectSource(0, 5);
    fireEvent.click(screen.getByRole("button", { name: "Marcar dato no detectado" }));
    fireEvent.change(screen.getByLabelText("Tipo de dato"), { target: { value: "CONTEXTO" } });
    fireEvent.click(screen.getByRole("button", { name: "Añadir dato marcado" }));
    expect(screen.getByText("Dato añadido. Pendiente de revisar")).toBeInTheDocument();
    expect(screen.queryByLabelText("Sustitución")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revisar dato marcado" }));
    expect(screen.getByRole("complementary", { name: "Entity inspector" })).toHaveTextContent(
      "OriginalTexto"
    );
    expect(ref.current.decisions).toEqual({});
  });
  it("opens the earliest pending source span without deciding, and preserves explicit selection after decisions and rerenders", () => {
    const base = buildSession();
    const initial = applyDecision(base, base.detections[0].id, "accepted");
    const ref = { current: initial };
    const view = render(<Harness initial={initial} sessionRef={ref} />);
    const inspector = screen.getByRole("complementary", { name: "Entity inspector" });
    expect(inspector).toHaveTextContent("612345678");
    expect(ref.current).toBe(initial);
    fireEvent.click(detectionSpanButton("2024/089756"));
    fireEvent.click(screen.getByRole("button", { name: "Aceptar detección" }));
    view.rerender(<Harness initial={initial} sessionRef={ref} />);
    expect(inspector).toHaveTextContent("2024/089756");
    expect(inspector).toHaveTextContent("Decisión actualAceptada");
    expect(getProgress(ref.current).pending).toBe(1);
  });

  it("revokes selection and drafts on identical new authority, including returning to an old session", () => {
    const first = buildSession();
    const second = buildSession();
    const handlers = { onDecide: vi.fn(), onAddManual: vi.fn() };
    const view = render(<ReviewWorkspace session={first} {...handlers} />);
    fireEvent.click(detectionSpanButton("2024/089756"));
    fireEvent.change(screen.getByLabelText("Sustitución"), { target: { value: "OLD" } });
    fireEvent.change(screen.getByLabelText("Nota (opcional)"), { target: { value: "OLD NOTE" } });
    view.rerender(<ReviewWorkspace session={second} {...handlers} />);
    expect(screen.getByRole("complementary", { name: "Entity inspector" })).toHaveTextContent(
      "Carmen Sánchez"
    );
    expect(screen.getByLabelText("Sustitución")).toHaveValue("");
    expect(screen.getByLabelText("Nota (opcional)")).toHaveValue("");
    view.rerender(<ReviewWorkspace session={first} {...handlers} />);
    expect(screen.getByRole("complementary", { name: "Entity inspector" })).toHaveTextContent(
      "Carmen Sánchez"
    );
    expect(handlers.onDecide).not.toHaveBeenCalled();
  });

  it("states zero pending factually while decided items remain available for correction", () => {
    let session = buildSession();
    for (const detection of session.detections)
      session = applyDecision(session, detection.id, "accepted");
    render(<Harness initial={session} />);
    expect(
      screen.getByText(
        "Sin pendientes. Puedes corregir las decisiones desde la lista o el texto original."
      )
    ).toBeInTheDocument();
    fireEvent.click(detectionSpanButton("Carmen Sánchez"));
    expect(screen.getByRole("button", { name: "Aplicar modificación" })).toBeEnabled();
  });
});

describe("Review productivity — pending navigation", () => {
  it("keeps the full current source highlighted when a manual datum overlaps it", () => {
    const base = buildSession();
    const session = addManualDetection(base, {
      start: NAME_START,
      end: NAME_START + 6,
      type: "FRAGMENTO",
    });
    render(<Harness initial={session} />);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente pendiente" }));
    const source = screen.getByRole("group", { name: "Document text with detections" });
    const current = source.querySelectorAll('[aria-current="true"]');
    expect(Array.from(current, (element) => element.textContent).join("")).toBe("Carmen Sánchez");
    fireEvent.click(current[0]);
    expect(screen.getByRole("complementary", { name: "Entity inspector" })).toHaveTextContent(
      "OriginalCarmen Sánchez"
    );
    expect(session.decisions).toEqual({});
  });
  it("navigates in source order independently of filters, without wrapping or domain mutation", () => {
    const session = buildSession();
    const ref = { current: session };
    render(<Harness initial={session} sessionRef={ref} />);
    const previous = screen.getByRole("button", { name: "Anterior pendiente" });
    const next = screen.getByRole("button", { name: "Siguiente pendiente" });
    expect(previous).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Filter by type"), { target: { value: "NOMBRE" } });
    fireEvent.click(next);
    const inspector = screen.getByRole("complementary", { name: "Entity inspector" });
    expect(inspector).toHaveTextContent("612345678");
    expect(inspector).toHaveTextContent("La detección actual no aparece en la lista filtrada.");
    expect(screen.getByLabelText("Filter by type")).toHaveValue("NOMBRE");
    expect(
      within(screen.getByRole("group", { name: "Document text with detections" })).getByRole(
        "button",
        { name: /612345678/ }
      )
    ).toHaveAttribute("aria-current", "true");
    fireEvent.click(next);
    expect(next).toBeDisabled();
    fireEvent.click(next);
    expect(inspector).toHaveTextContent("2024/089756");
    fireEvent.click(previous);
    expect(inspector).toHaveTextContent("612345678");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar todas las detecciones" }));
    expect(screen.getByLabelText("Filter by type")).toHaveValue("");
    expect(screen.getByRole("region", { name: "Detection list" })).toHaveFocus();
    expect(ref.current).toBe(session);
  });

  it("blocks next/previous with a local draft explanation, and discards only on explicit request before retry", () => {
    const session = buildSession();
    const ref = { current: session };
    render(<Harness initial={session} sessionRef={ref} />);
    fireEvent.change(screen.getByLabelText("Sustitución"), { target: { value: "BORRADOR" } });
    fireEvent.change(screen.getByLabelText("Nota (opcional)"), { target: { value: "NOTA" } });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente pendiente" }));
    const inspector = screen.getByRole("complementary", { name: "Entity inspector" });
    expect(within(inspector).getByRole("alert")).toHaveTextContent("Hay un borrador sin guardar");
    expect(inspector).toHaveFocus();
    expect(screen.getByLabelText("Sustitución")).toHaveValue("BORRADOR");
    expect(screen.getByLabelText("Nota (opcional)")).toHaveValue("NOTA");
    fireEvent.click(screen.getByRole("button", { name: "Descartar borrador" }));
    expect(inspector).toHaveTextContent("Carmen Sánchez");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente pendiente" }));
    expect(screen.getByLabelText("Sustitución")).toHaveValue("");
    expect(inspector).toHaveTextContent("612345678");
    fireEvent.change(screen.getByLabelText("Nota (opcional)"), { target: { value: "SEGUNDA" } });
    fireEvent.click(screen.getByRole("button", { name: "Anterior pendiente" }));
    expect(screen.getByLabelText("Nota (opcional)")).toHaveValue("SEGUNDA");
    expect(ref.current).toBe(session);
  });
});

describe("Review productivity — decision continuity", () => {
  it("keeps failed and unapplied decisions on the current item with both drafts intact", () => {
    const session = buildSession();
    const onDecide = vi.fn<ReviewWorkspaceProps["onDecide"]>(() => {
      throw new Error("Internal failure");
    });
    render(<ReviewWorkspace session={session} onDecide={onDecide} onAddManual={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Sustitución"), { target: { value: "REVISADO" } });
    fireEvent.change(screen.getByLabelText("Nota (opcional)"), { target: { value: "NOTA" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar modificación" }));
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo aplicar la decisión");
    expect(screen.getByLabelText("Sustitución")).toHaveValue("REVISADO");
    expect(screen.getByLabelText("Nota (opcional)")).toHaveValue("NOTA");
    onDecide.mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar modificación" }));
    expect(screen.getByLabelText("Sustitución")).toHaveValue("REVISADO");
    expect(screen.getByLabelText("Nota (opcional)")).toHaveValue("NOTA");
    expect(screen.getByRole("complementary", { name: "Entity inspector" })).toHaveTextContent(
      "Decisión actualPendiente"
    );
    expect(session.decisions).toEqual({});
  });

  it("stays correctable after the last decision; saved notes do not block explicit navigation", () => {
    const initial = buildSession();
    const ref = { current: initial };
    render(<Harness initial={initial} sessionRef={ref} />);
    fireEvent.change(screen.getByLabelText("Nota (opcional)"), {
      target: { value: "Nota guardada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aceptar detección" }));
    expect(ref.current.decisions[initial.detections[0].id].note).toBe("Nota guardada");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente pendiente" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aceptar detección" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente pendiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Aceptar detección" }));
    expect(screen.getByText(/^Sin pendientes\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente pendiente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior pendiente" })).toBeDisabled();
    expect(screen.getByRole("complementary", { name: "Entity inspector" })).toHaveTextContent(
      "2024/089756"
    );
    fireEvent.change(screen.getByLabelText("Sustitución"), { target: { value: "CORRECCIÓN" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar modificación" }));
    expect(ref.current.decisions[initial.detections[2].id]).toEqual({
      status: "modified",
      replacement: "CORRECCIÓN",
    });
  });
});

describe("Review productivity — scoped shortcuts", () => {
  function focusWork() {
    const inspector = screen.getByRole("complementary", { name: "Entity inspector" });
    inspector.focus();
    return inspector;
  }

  it("offers closable Spanish help and uses A/M/K plus pending arrows only on the current entity", () => {
    const session = buildSession();
    const ref = { current: session };
    render(<Harness initial={session} sessionRef={ref} />);
    fireEvent.click(screen.getByRole("button", { name: "Atajos de revisión" }));
    const help = screen.getByRole("region", { name: "Atajos de revisión" });
    expect(help).toHaveTextContent("A: aceptar");
    expect(help).toHaveTextContent("M: editar sustitución");
    expect(help).toHaveTextContent("K: mantener original");
    expect(help).toHaveTextContent("F: marcar texto seleccionado");
    expect(help).toHaveTextContent("Alt + ↓ / ↑");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar ayuda de atajos" }));
    expect(screen.queryByRole("region", { name: "Atajos de revisión" })).not.toBeInTheDocument();
    fireEvent.keyDown(focusWork(), { key: "m" });
    expect(screen.getByLabelText("Sustitución")).toHaveFocus();
    expect(ref.current).toBe(session);
    fireEvent.keyDown(focusWork(), { key: "ArrowDown", altKey: true });
    fireEvent.keyDown(focusWork(), { key: "a" });
    expect(ref.current.decisions[session.detections[1].id]?.status).toBe("accepted");
    expect(ref.current.decisions[session.detections[0].id]).toBeUndefined();
    expect(screen.getByRole("complementary", { name: "Entity inspector" })).toHaveTextContent(
      "612345678"
    );
    fireEvent.keyDown(focusWork(), { key: "ArrowUp", altKey: true });
    fireEvent.keyDown(focusWork(), { key: "k" });
    expect(screen.getByRole("group", { name: "Confirmar mantener original" })).toBeInTheDocument();
    const before = ref.current;
    fireEvent.keyDown(screen.getByRole("button", { name: "Cancelar" }), { key: "a" });
    fireEvent.keyDown(focusWork(), { key: "ArrowDown", altKey: true });
    expect(ref.current).toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(ref.current).toBe(before);
  });

  it.each(["input", "textarea", "select", "contenteditable"])(
    "refuses shortcuts while typing in %s",
    (kind) => {
      const session = buildSession();
      const onDecide = vi.fn();
      render(<ReviewWorkspace session={session} onDecide={onDecide} onAddManual={vi.fn()} />);
      const control =
        kind === "input"
          ? screen.getByLabelText("Sustitución")
          : kind === "textarea"
            ? screen.getByLabelText("Nota (opcional)")
            : kind === "select"
              ? screen.getByLabelText("Filter by type")
              : document.createElement("div");
      if (kind === "contenteditable") {
        control.setAttribute("contenteditable", "true");
        control.setAttribute("tabindex", "0");
        screen.getByRole("complementary", { name: "Entity inspector" }).append(control);
      }
      control.focus();
      for (const key of ["a", "m", "k", "f"]) fireEvent.keyDown(control, { key });
      fireEvent.keyDown(control, { key: "ArrowDown", altKey: true });
      expect(control).toHaveFocus();
      expect(onDecide).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("group", { name: "Confirmar mantener original" })
      ).not.toBeInTheDocument();
      expect(screen.getByRole("complementary", { name: "Entity inspector" })).toHaveTextContent(
        "Decisión actualPendiente"
      );
    }
  );

  it("refuses IME, repeats, modifier surprises and focus outside Review, including reused DOM after context change", () => {
    const first = buildSession();
    const onDecide = vi.fn();
    const handlers = { onDecide, onAddManual: vi.fn() };
    const view = render(<ReviewWorkspace session={first} {...handlers} />);
    const inspector = focusWork();
    for (const extras of [
      { isComposing: true },
      { keyCode: 229 },
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
      { repeat: true },
    ])
      fireEvent.keyDown(inspector, { key: "a", ...extras });
    inspector.blur();
    fireEvent.keyDown(inspector, { key: "a" });
    fireEvent.keyDown(document.body, { key: "a" });
    focusWork();
    view.rerender(<ReviewWorkspace session={buildSession()} {...handlers} />);
    expect(inspector).not.toHaveFocus();
    fireEvent.keyDown(inspector, { key: "a" });
    expect(onDecide).not.toHaveBeenCalled();
  });

  it("F requires valid original selection and invokes the unchanged manual capture; confirmation refuses shortcuts", () => {
    const session = buildSession();
    const ref = { current: session };
    render(<Harness initial={session} sessionRef={ref} />);
    fireEvent.keyDown(focusWork(), { key: "f" });
    expect(screen.queryByRole("form", { name: "Marcar dato" })).not.toBeInTheDocument();
    selectSource(WORD_START, WORD_END);
    fireEvent.keyDown(focusWork(), { key: "f" });
    expect(screen.getByLabelText("Texto seleccionado")).toHaveTextContent("Teléfono");
    const form = screen.getByRole("form", { name: "Marcar dato" });
    const cancel = within(form).getByRole("button", { name: "Cancelar" });
    cancel.focus();
    fireEvent.keyDown(cancel, { key: "a" });
    fireEvent.keyDown(cancel, { key: "ArrowDown", altKey: true });
    expect(ref.current).toBe(session);
    expect(form).toBeInTheDocument();
    fireEvent.click(cancel);
    expect(screen.getByRole("button", { name: "Marcar dato no detectado" })).toHaveFocus();
  });
});

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
      fireEvent.change(screen.getByLabelText("Sustitución"), { target: { value: "CORRECCIÓN" } });
      fireEvent.change(screen.getByLabelText("Nota (opcional)"), {
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
      expect(screen.getByLabelText("Sustitución")).toHaveValue("CORRECCIÓN");
      expect(screen.getByLabelText("Nota (opcional)")).toHaveValue("Nota sintética");
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
      fireEvent.change(screen.getByLabelText("Sustitución"), { target: { value: "CORRECCIÓN" } });
      fireEvent.click(screen.getByRole("button", { name: /aplicar modificación/i }));
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
    fireEvent.change(screen.getByLabelText("Sustitución"), { target: { value: "A-ONLY" } });
    fireEvent.click(leftListButton("612345678"));
    expect(screen.getByLabelText("Sustitución")).toHaveValue("A-ONLY");
    expect(screen.getByRole("alert")).toHaveTextContent("Hay un borrador sin guardar");
    fireEvent.click(screen.getByRole("button", { name: "Descartar borrador" }));
    fireEvent.click(leftListButton("612345678"));
    expect(screen.getByLabelText("Sustitución")).toHaveValue("");
  });

  it("note drafted for A cannot appear on B after selection via the left detection list", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(leftListButton("Carmen Sánchez"));
    fireEvent.change(screen.getByLabelText("Nota (opcional)"), {
      target: { value: "A-NOTE-ONLY" },
    });
    fireEvent.click(leftListButton("612345678"));
    expect(screen.getByLabelText("Nota (opcional)")).toHaveValue("A-NOTE-ONLY");
    fireEvent.click(screen.getByRole("button", { name: "Descartar borrador" }));
    fireEvent.click(leftListButton("612345678"));
    expect(screen.getByLabelText("Nota (opcional)")).toHaveValue("");
  });

  it("document-surface selection obeys the same draft-hygiene invariant", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(documentSurfaceButton("Carmen Sánchez"));
    fireEvent.change(screen.getByLabelText("Sustitución"), { target: { value: "A-ONLY" } });
    fireEvent.change(screen.getByLabelText("Nota (opcional)"), {
      target: { value: "A-NOTE-ONLY" },
    });
    fireEvent.click(documentSurfaceButton("612345678"));
    expect(screen.getByLabelText("Sustitución")).toHaveValue("A-ONLY");
    expect(screen.getByLabelText("Nota (opcional)")).toHaveValue("A-NOTE-ONLY");
    fireEvent.click(screen.getByRole("button", { name: "Descartar borrador" }));
    fireEvent.click(documentSurfaceButton("612345678"));
    expect(screen.getByLabelText("Sustitución")).toHaveValue("");
    expect(screen.getByLabelText("Nota (opcional)")).toHaveValue("");
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
    fireEvent.click(screen.getByRole("button", { name: /aceptar detección/i }));

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
    fireEvent.change(screen.getByLabelText("Sustitución"), {
      target: { value: "PACIENTE REEMPLAZO" },
    });
    fireEvent.click(screen.getByRole("button", { name: /aplicar modificación/i }));
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

  it("captures original text without offsets and adds one pending manual datum without corrupting decisions", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    // Make one explicit decision first.
    fireEvent.click(detectionSpanButton("Carmen Sánchez"));
    fireEvent.click(screen.getByRole("button", { name: /aceptar detección/i }));

    const before = sessionRef.current;
    selectSource(WORD_START, WORD_END);
    fireEvent.click(screen.getByRole("button", { name: "Marcar dato no detectado" }));
    const form = screen.getByRole("form", { name: "Marcar dato" });
    expect(within(form).getByLabelText("Texto seleccionado")).toHaveTextContent("Teléfono");
    expect(screen.queryByLabelText(/offset/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de dato")).toHaveFocus();
    window.getSelection()?.removeAllRanges(); // Focus collapse cannot erase captured authority.
    fireEvent.change(screen.getByLabelText("Tipo de dato"), {
      target: { value: "Palabra clínica libre" },
    });
    expect(sessionRef.current).toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "Añadir dato marcado" }));
    expect(sessionRef.current.detections).toHaveLength(4);
    expect(sessionRef.current.detections[3]).toMatchObject({
      start: 23,
      end: 31,
      original: "Teléfono",
      type: "Palabra clínica libre",
      source: "manual",
      requiresReview: true,
    });
    expect(sessionRef.current.decisions).toEqual(before.decisions);
    expect(getPreview(sessionRef.current)).toBe(getPreview(before));
    expect(screen.getByText("Dato añadido. Pendiente de revisar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revisar dato marcado" }));
    expect(screen.getByRole("complementary", { name: "Entity inspector" })).toHaveTextContent(
      "Teléfono"
    );

    const progress = screen.getByRole("status", { name: /review progress/i });
    expect(progress).toHaveTextContent("Manual: 1");
    expect(progress).toHaveTextContent("Pending: 3");
    expect(progress).toHaveTextContent("Accepted: 1");
    const list = screen.getByRole("list", { name: /detections/i });
    expect(list).toHaveTextContent("Teléfono");
  });

  it("Cancel preserves the selected detection, notes, filters and decisions and returns focus to marking", () => {
    const sessionRef = { current: buildSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(detectionSpanButton("Carmen Sánchez"));
    fireEvent.click(screen.getByRole("button", { name: /aceptar detección/i }));
    fireEvent.change(screen.getByLabelText("Nota (opcional)"), {
      target: { value: "Nota conservada" },
    });
    fireEvent.change(screen.getByLabelText("Sustitución"), {
      target: { value: "Borrador conservado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Accepted" }));
    const before = sessionRef.current;
    selectSource(0, 31); // Faithful cross-segment selection; never silently narrowed.
    fireEvent.click(screen.getByRole("button", { name: "Marcar dato no detectado" }));
    expect(screen.getByLabelText("Texto seleccionado").textContent).toBe(
      "Nombre: Carmen Sánchez\nTeléfono"
    );
    fireEvent.change(screen.getByLabelText("Tipo de dato"), { target: { value: "Texto libre" } });
    fireEvent.click(
      within(screen.getByRole("form", { name: "Marcar dato" })).getByRole("button", {
        name: "Cancelar",
      })
    );
    expect(screen.queryByRole("form", { name: "Marcar dato" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar dato no detectado" })).toHaveFocus();
    expect(screen.getByLabelText("Nota (opcional)")).toHaveValue("Nota conservada");
    expect(screen.getByLabelText("Sustitución")).toHaveValue("Borrador conservado");
    expect(screen.getByRole("button", { name: "Accepted" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(
      within(screen.getByRole("list", { name: "Detections" })).getByRole("button", {
        name: /Carmen Sánchez/,
      })
    ).toHaveAttribute("aria-current", "true");
    expect(sessionRef.current).toBe(before);
  });
});

describe("ReviewWorkspace — manual source authorization", () => {
  it("shows the entire long captured fragment in a keyboard-reachable scrollable preview", () => {
    const text = "Fragmento sintético sin truncar.\n".repeat(80);
    const initial = createReviewSession({ originalText: text, detections: [], sessionId: "long" });
    const ref = { current: initial };
    render(<Harness initial={initial} sessionRef={ref} />);
    selectSource(0, text.length);
    fireEvent.click(screen.getByRole("button", { name: "Marcar dato no detectado" }));
    const preview = screen.getByRole("region", { name: "Texto seleccionado" });
    expect(preview.textContent).toBe(text);
    expect(preview).toHaveAttribute("tabindex", "0");
    expect(preview).toHaveClass("max-h-40", "overflow-auto", "break-all");
    fireEvent.change(screen.getByLabelText("Tipo de dato"), { target: { value: "Texto extenso" } });
    expect(ref.current).toBe(initial);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(ref.current).toBe(initial);
  });

  it("consumes Add once even when re-entered before the controlled session render", () => {
    let session = buildSession();
    const onAddManual = vi.fn<ReviewWorkspaceProps["onAddManual"]>((input) => {
      fireEvent.submit(form); // Repeated activation while the first bridge call is still running.
      session = addManualDetection(session, input);
      view.rerender(
        <ReviewWorkspace session={session} onDecide={vi.fn()} onAddManual={onAddManual} />
      );
    });
    const view = render(
      <ReviewWorkspace session={session} onDecide={vi.fn()} onAddManual={onAddManual} />
    );
    selectSource(23, 31);
    fireEvent.click(screen.getByRole("button", { name: "Marcar dato no detectado" }));
    fireEvent.change(screen.getByLabelText("Tipo de dato"), { target: { value: "Dato" } });
    const form = screen.getByRole("form", { name: "Marcar dato" });
    fireEvent.submit(form);
    expect(onAddManual).toHaveBeenCalledTimes(1);
    expect(session.detections).toHaveLength(4);
    expect(getProgress(session).pending).toBe(4);
  });

  it("revokes a captured draft on unrelated immutable review revisions and unmount", () => {
    const first = buildSession();
    const revised = applyDecision(first, first.detections[0].id, "accepted");
    const onAddManual = vi.fn();
    const handlers = { onAddManual, onDecide: vi.fn() };
    const view = render(<ReviewWorkspace session={first} {...handlers} />);
    selectSource(23, 31);
    fireEvent.click(screen.getByRole("button", { name: "Marcar dato no detectado" }));
    const oldForm = screen.getByRole("form", { name: "Marcar dato" });
    view.rerender(<ReviewWorkspace session={revised} {...handlers} />);
    fireEvent.submit(oldForm);
    expect(screen.queryByRole("form", { name: "Marcar dato" })).not.toBeInTheDocument();
    selectSource(23, 31);
    fireEvent.click(screen.getByRole("button", { name: "Marcar dato no detectado" }));
    expect(screen.getByLabelText("Tipo de dato")).toHaveValue("");
    const unmounted = screen.getByRole("form", { name: "Marcar dato" });
    view.unmount();
    fireEvent.submit(unmounted);
    render(<ReviewWorkspace session={first} {...handlers} />);
    expect(screen.queryByRole("form", { name: "Marcar dato" })).not.toBeInTheDocument();
    expect(onAddManual).not.toHaveBeenCalled();
    expect(revised.decisions[first.detections[0].id].status).toBe("accepted");
    expect(first.detections).toHaveLength(3);
    expect(revised.detections).toHaveLength(3);
  });

  it.each([
    "empty",
    "collapsed",
    "preview",
    "forged outside",
    "cross-container",
    "missing anchor",
    "negative anchor",
    "wrong source anchor",
    "changed text",
    "nested text",
    "unanchored interstitial",
    "malformed boundary",
    "multiple ranges",
  ])("refuses %s provenance clearly without opening a form or changing review state", (kind) => {
    const initial = buildSession();
    const ref = { current: initial };
    render(<Harness initial={initial} sessionRef={ref} />);
    const source = screen.getByRole("group", { name: "Document text with detections" });
    const range = document.createRange();
    selectSource(23, 31);
    const selection = window.getSelection()!;
    const anchor = source.querySelector<HTMLElement>('[data-source-start="22"]')!;
    let spy: ReturnType<typeof vi.spyOn> | undefined;
    let outside: HTMLElement | undefined;
    if (kind === "empty") selection.removeAllRanges();
    if (kind === "collapsed") selection.collapse(anchor.firstChild, 1);
    if (kind === "preview") {
      range.selectNodeContents(screen.getByLabelText("Preview derived from the review session"));
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (kind === "forged outside") {
      outside = document.createElement("span");
      outside.dataset.sourceStart = "23";
      outside.textContent = "Teléfono";
      document.body.append(outside);
      range.selectNodeContents(outside);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (kind === "cross-container") {
      range.setStart(anchor.firstChild!, 1);
      range.setEnd(
        screen.getByLabelText("Preview derived from the review session").firstChild!,
        31
      );
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (kind === "missing anchor") anchor.removeAttribute("data-source-start");
    if (kind === "negative anchor") anchor.dataset.sourceStart = "-1";
    if (kind === "wrong source anchor") anchor.dataset.sourceStart = "0";
    if (kind === "changed text") anchor.firstChild!.textContent = "\nTeléfonX ";
    if (kind === "nested text") {
      const nested = document.createElement("span");
      nested.textContent = anchor.textContent;
      anchor.replaceChildren(nested);
      range.selectNodeContents(nested);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (kind === "unanchored interstitial")
      source.insertBefore(document.createTextNode(" "), anchor);
    if (kind === "malformed boundary")
      Object.defineProperty(selection.getRangeAt(0), "endOffset", { value: 999 });
    if (kind === "multiple ranges")
      spy = vi.spyOn(selection, "rangeCount", "get").mockReturnValue(2);
    try {
      fireEvent.click(screen.getByRole("button", { name: "Marcar dato no detectado" }));
      expect(screen.queryByRole("form", { name: "Marcar dato" })).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Selecciona un fragmento del texto original"
      );
      expect(screen.getByRole("alert")).not.toHaveTextContent(/offset|999|ReviewSession/);
      expect(ref.current).toBe(initial);
      expect(initial.detections).toHaveLength(3);
      expect(initial.decisions).toEqual({});
    } finally {
      spy?.mockRestore();
      outside?.remove();
    }
  });

  it("retains source/type on missing-type and domain refusal, then allows explicit same-context retry", () => {
    let session = buildSession();
    const before = session;
    let refuse = true;
    const onAddManual = vi.fn<ReviewWorkspaceProps["onAddManual"]>((input) => {
      if (refuse) throw new Error("Internal offsets must never appear in the UI: 23–31");
      session = addManualDetection(session, input);
      view.rerender(
        <ReviewWorkspace session={session} onDecide={vi.fn()} onAddManual={onAddManual} />
      );
    });
    const view = render(
      <ReviewWorkspace session={session} onDecide={vi.fn()} onAddManual={onAddManual} />
    );
    selectSource(23, 31);
    fireEvent.click(screen.getByRole("button", { name: "Marcar dato no detectado" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir dato marcado" }));
    expect(onAddManual).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe un tipo de dato");
    fireEvent.change(screen.getByLabelText("Tipo de dato"), { target: { value: "Dato abierto" } });
    fireEvent.click(screen.getByRole("button", { name: "Añadir dato marcado" }));
    expect(session).toBe(before);
    expect(screen.getByLabelText("Tipo de dato")).toHaveValue("Dato abierto");
    expect(screen.getByLabelText("Texto seleccionado").textContent).toBe("Teléfono");
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo añadir el dato");
    expect(screen.getByRole("alert")).not.toHaveTextContent(/offset|23|31/);
    refuse = false;
    const form = screen.getByRole("form", { name: "Marcar dato" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(session.detections).toHaveLength(4);
    expect(onAddManual).toHaveBeenCalledTimes(2); // One refused attempt, one successful append.
  });

  it("never claims success for a bridge no-op and preserves a correctable current draft", () => {
    const initial = buildSession();
    render(<ReviewWorkspace session={initial} onDecide={vi.fn()} onAddManual={vi.fn()} />);
    selectSource(23, 31);
    fireEvent.click(screen.getByRole("button", { name: "Marcar dato no detectado" }));
    fireEvent.change(screen.getByLabelText("Tipo de dato"), { target: { value: "Dato" } });
    fireEvent.click(screen.getByRole("button", { name: "Añadir dato marcado" }));
    expect(screen.queryByText("Dato añadido. Pendiente de revisar")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo añadir el dato");
    expect(screen.getByLabelText("Tipo de dato")).toHaveValue("Dato");
    expect(initial.detections).toHaveLength(3);
  });

  it("keeps hidden pending additions discoverable without resetting filters or unrelated notes and permits correction", () => {
    let initial = buildSession();
    for (const detection of initial.detections)
      initial = applyDecision(initial, detection.id, "accepted");
    const ref = { current: initial };
    render(<Harness initial={initial} sessionRef={ref} />);
    fireEvent.click(detectionSpanButton("Carmen Sánchez"));
    fireEvent.change(screen.getByLabelText("Nota (opcional)"), {
      target: { value: "Nota sin perder" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Accepted" }));
    fireEvent.change(screen.getByLabelText("Filter by type"), { target: { value: "NOMBRE" } });
    selectSource(23, 31);
    fireEvent.click(screen.getByRole("button", { name: "Marcar dato no detectado" }));
    fireEvent.change(screen.getByLabelText("Tipo de dato"), { target: { value: "Palabra" } });
    fireEvent.click(screen.getByRole("button", { name: "Añadir dato marcado" }));
    expect(screen.getByLabelText("Nota (opcional)")).toHaveValue("Nota sin perder");
    expect(screen.getByRole("list", { name: "Detections" })).not.toHaveTextContent("Teléfono");
    const next = screen.getByRole("button", { name: "Revisar dato marcado" });
    expect(next).toHaveFocus();
    fireEvent.click(next);
    expect(screen.getByLabelText("Nota (opcional)")).toHaveValue("Nota sin perder");
    fireEvent.click(screen.getByRole("button", { name: "Descartar borrador" }));
    fireEvent.click(next);
    expect(screen.getByRole("complementary", { name: "Entity inspector" })).toHaveFocus();
    expect(screen.getByRole("complementary", { name: "Entity inspector" })).toHaveTextContent(
      /Decisión actualPendiente/
    );
    expect(screen.getByRole("button", { name: "Accepted" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByLabelText("Filter by type")).toHaveValue("NOMBRE");
    fireEvent.change(screen.getByLabelText("Sustitución"), { target: { value: "PALABRA" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar modificación" }));
    expect(ref.current.decisions).toMatchObject(initial.decisions);
    expect(getProgress(ref.current).pending).toBe(0);
    expect(getProgress(ref.current).modified).toBe(1);
    expect(getFinalText(ref.current)).toBe("Nombre: PACIENTE-1\nPALABRA . NHC ID-1.");
  });

  it("preserves UTF-16 and repeated non-ASCII text across segments, including proven element boundaries", () => {
    const initial = createReviewSession({
      originalText: "Á🙂 Ana y Ana",
      sessionId: "unicode",
      detections: [{ start: 4, end: 7, type: "NOMBRE", proposed: "PERSONA" }],
    });
    const ref = { current: initial };
    render(<Harness initial={initial} sessionRef={ref} />);
    const range = document.createRange();
    range.selectNodeContents(screen.getByRole("group", { name: "Document text with detections" }));
    window.getSelection()?.addRange(range);
    fireEvent.click(screen.getByRole("button", { name: "Marcar dato no detectado" }));
    expect(screen.getByLabelText("Texto seleccionado").textContent).toBe("Á🙂 Ana y Ana");
    fireEvent.change(screen.getByLabelText("Tipo de dato"), {
      target: { value: "Fragmento libre" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Añadir dato marcado" }));
    expect(ref.current.detections[1]).toMatchObject({
      start: 0,
      end: 13,
      original: "Á🙂 Ana y Ana",
      source: "manual",
      requiresReview: true,
    });
    expect(ref.current.detections[0]).toBe(initial.detections[0]);
    expect(ref.current.decisions).toEqual({});
    expect(getPreview(ref.current)).toBe("Á🙂 Ana y Ana");
  });

  it("revokes both the draft and the live Range on an identical Job/session replacement and never revives them", async () => {
    const first = buildSession();
    const second = buildSession();
    const onAddManual = vi.fn();
    const handlers = { onAddManual, onDecide: vi.fn() };
    const view = render(<ReviewWorkspace session={first} {...handlers} />);
    selectSource(23, 31);
    fireEvent.click(screen.getByRole("button", { name: "Marcar dato no detectado" }));
    fireEvent.change(screen.getByLabelText("Tipo de dato"), { target: { value: "Tipo anterior" } });
    const oldForm = screen.getByRole("form", { name: "Marcar dato" });
    selectSource(23, 31); // A live source highlight must also be revoked, even if DOM is reused.
    await Promise.resolve(); // A later context transition, not the capture event.
    view.rerender(<ReviewWorkspace session={second} {...handlers} />);
    expect(screen.queryByRole("form", { name: "Marcar dato" })).not.toBeInTheDocument();
    fireEvent.submit(oldForm);
    fireEvent.click(screen.getByRole("button", { name: "Marcar dato no detectado" }));
    expect(screen.queryByRole("form", { name: "Marcar dato" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Selecciona un fragmento del texto original"
    );
    view.rerender(<ReviewWorkspace session={first} {...handlers} />);
    fireEvent.submit(oldForm);
    expect(onAddManual).not.toHaveBeenCalled();
    expect(first.detections).toHaveLength(3);
    expect(second.detections).toHaveLength(3);
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
    const accept = screen.getByRole("button", { name: /aceptar detección/i });
    expect(accept).toBeDisabled();
    // Clicking the disabled action records no decision (domain unchanged).
    fireEvent.click(accept);
    expect(Object.keys(sessionRef.current.decisions)).toHaveLength(0);
    expect(screen.getByRole("status", { name: /review progress/i })).toHaveTextContent(
      "Pending: 1"
    );
    // The block is explained factually, not by color alone.
    expect(accept).toHaveAccessibleDescription(/No hay propuesta/i);
  });

  it("still completes a proposal-less detection legitimately via modification", () => {
    const sessionRef = { current: manualNoProposalSession() };
    render(<Harness initial={sessionRef.current} sessionRef={sessionRef} />);
    fireEvent.click(detectionSpanButton("2024/089756"));
    fireEvent.change(screen.getByLabelText("Sustitución"), {
      target: { value: "ID-REEMPLAZO" },
    });
    fireEvent.click(screen.getByRole("button", { name: /aplicar modificación/i }));
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
    const accept = screen.getByRole("button", { name: /aceptar detección/i });
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
    fireEvent.click(screen.getByRole("button", { name: /aceptar detección/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /aceptar detección/i }));

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

  it("offers no route to the inspector when the session has no pending or selected detection", () => {
    render(
      <Harness initial={createReviewSession({ originalText: "Texto sintético", detections: [] })} />
    );
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
