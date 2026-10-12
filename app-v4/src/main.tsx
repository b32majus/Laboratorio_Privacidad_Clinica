import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Local font packages only: zero remote/CDN requests at runtime.
import "@fontsource/inter";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/cormorant-garamond";
// Weights used by the accepted Sophilux B V1 identity (U1 #91): display and
// card titles (500/600) and the italic editorial emphasis (400-italic).
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/400-italic.css";

import "./index.css";
// U1 (#91) Sophilux B V1 shell + Entry composition; presentational tokens only.
import "./visual/sophilux-v1.css";
import { App } from "./App";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
