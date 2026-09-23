import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { App } from "./App";

describe("App shell", () => {
  afterEach(cleanup);

  it("renders the application heading", () => {
    render(<App />);
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Laboratorio de Privacidad Clínica"
    });
    expect(heading).toBeInTheDocument();
  });

  it("marks itself as the V4 scaffold placeholder without product flow", () => {
    render(<App />);
    expect(
      screen.getByText(/V4 migration scaffold placeholder/i)
    ).toBeInTheDocument();
  });
});
