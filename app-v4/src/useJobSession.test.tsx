import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import type { ProcessingFailure } from "./domain/job";
import { useJobSession } from "./useJobSession";

/**
 * Oracles for the state bridge's single processing-attempt entry point
 * (T15 #19, GitHub #19 acceptance bullet 3).
 *
 * The probe uses the REAL hook and drives the REAL `startReview()`; the engine
 * is never mocked, so the success route runs the composed registry engine and
 * the failure route raises the real typed `PolicyError` for the
 * known-but-unmapped `external-ai` policy. The observed state is rendered as
 * text in a `role="status"` region so the assertions derive from what the hook
 * actually exposes.
 *
 * All content is synthetic; no real clinical data anywhere.
 */
const SYNTHETIC_NOTE = "Nombre: Carmen Sanchez. Contacto: 612345678.";

/** Returned-failure display value: distinguishes "not called" from `null`. */
type ReturnedOutcome = ProcessingFailure | null | "not-called";

function ProcessingProbe() {
  const session = useJobSession();
  const [returned, setReturned] = useState<ReturnedOutcome>("not-called");

  const errorCodes =
    session.job && session.job.errors.length > 0
      ? session.job.errors.map((error) => error.code).join("|")
      : "none";
  const returnedText =
    returned === "not-called"
      ? "not-called"
      : returned === null
        ? "null"
        : `${returned.code} / ${returned.message}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => session.create({ type: "pasted-text", text: SYNTHETIC_NOTE })}
      >
        create job
      </button>
      <button type="button" onClick={() => session.updatePolicy("standard")}>
        policy standard
      </button>
      <button type="button" onClick={() => session.updatePolicy("external-ai")}>
        policy external-ai
      </button>
      <button type="button" onClick={() => setReturned(session.startReview())}>
        start review
      </button>
      <p role="status" aria-label="processing probe">
        <span>{`processing: ${session.job ? session.job.processing : "none"}`}</span>
        <span>{`errors: ${errorCodes}`}</span>
        <span>{`session: ${session.review ? "installed" : "none"}`}</span>
        <span>{`returned: ${returnedText}`}</span>
      </p>
    </div>
  );
}

afterEach(cleanup);

describe("useJobSession.startReview (T15 #19)", () => {
  it("success route: records succeeded, installs a session and returns null", () => {
    render(<ProcessingProbe />);
    fireEvent.click(screen.getByRole("button", { name: "create job" }));
    fireEvent.click(screen.getByRole("button", { name: "start review" }));

    const probe = screen.getByRole("status", { name: "processing probe" });
    expect(probe).toHaveTextContent("processing: succeeded");
    expect(probe).toHaveTextContent("errors: none");
    expect(probe).toHaveTextContent("session: installed");
    expect(probe).toHaveTextContent("returned: null");
  });

  it("typed-failure route: records failed, appends the typed error and installs no session", () => {
    render(<ProcessingProbe />);
    fireEvent.click(screen.getByRole("button", { name: "create job" }));
    fireEvent.click(screen.getByRole("button", { name: "policy external-ai" }));
    fireEvent.click(screen.getByRole("button", { name: "start review" }));

    const probe = screen.getByRole("status", { name: "processing probe" });
    expect(probe).toHaveTextContent("processing: failed");
    expect(probe).toHaveTextContent("errors: policy-unsupported");
    expect(probe).toHaveTextContent("session: none");
    expect(probe).toHaveTextContent("returned: policy-unsupported /");
    expect(probe).toHaveTextContent(/no accepted per-category operator mapping/i);
    // The failure is never mistaken for a successful review.
    expect(probe).not.toHaveTextContent("processing: succeeded");
  });

  it("retry route: a failed attempt can start again and reach a terminal success", () => {
    render(<ProcessingProbe />);
    fireEvent.click(screen.getByRole("button", { name: "create job" }));
    fireEvent.click(screen.getByRole("button", { name: "policy external-ai" }));
    fireEvent.click(screen.getByRole("button", { name: "start review" }));
    expect(screen.getByRole("status", { name: "processing probe" })).toHaveTextContent(
      "processing: failed"
    );

    // Fix the policy back to a mapped one, then retry the same job.
    fireEvent.click(screen.getByRole("button", { name: "policy standard" }));
    fireEvent.click(screen.getByRole("button", { name: "start review" }));

    const probe = screen.getByRole("status", { name: "processing probe" });
    expect(probe).toHaveTextContent("processing: succeeded");
    expect(probe).toHaveTextContent("session: installed");
    expect(probe).toHaveTextContent("returned: null");
  });

  it("never-success-never-thrown contract: a typed failure is returned, not thrown", () => {
    render(<ProcessingProbe />);
    fireEvent.click(screen.getByRole("button", { name: "create job" }));
    fireEvent.click(screen.getByRole("button", { name: "policy external-ai" }));

    // The click handler calls the real startReview(); a throw would escape it.
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "start review" }))
    ).not.toThrow();

    const probe = screen.getByRole("status", { name: "processing probe" });
    expect(probe).toHaveTextContent("processing: failed");
    expect(probe).not.toHaveTextContent("returned: null");
  });
});
